import { createTaskListItem, enableTaskCheckboxes, listStartOf } from './rich-text-blocks.js';
import {
    createEmptyParagraph,
    findAncestorByTag,
    lastChildTagged,
    placeCaretAtEndOf,
    placeCaretAtStartOfBlock,
    emptyBlockCaretTarget,
    setSelectionRange,
} from './rich-text-dom.js';
import type { RichTextController } from './rich-text-host.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import {
    buildLineIndex,
    caretPosition,
    holdsNothing,
    isNestedList,
    isPhrasing,
    lineAbove,
    lineBelow,
    lineIsEmpty,
    lineOf,
    lineOwnNodes,
    linesMayJoin,
    nodeShowsNothing,
    placeCaretIn,
    rangeShowsNothing,
    separateListKinds,
    type Line,
} from './rich-text-lines.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import { Disposables } from './rich-text-registry.js';

const BLOCK_INDENT_STEP_REM = 2;
const MAX_BLOCK_INDENT_REM = 12;
const MAX_LIST_DEPTH = 6;
const PLACEHOLDER_ONLY = /^[ ​]*$/;

/** A collapsed caret inside the text of a line that belongs to a list row. */
interface RowCaret {
    readonly line: Line;
    readonly row: HTMLElement;
    readonly range: Range;
}

interface LineCaret {
    readonly owner: HTMLElement;
    readonly offset: number;
}

function listTag(list: Element | null): 'ol' | 'ul' {
    return list?.tagName === 'OL' ? 'ol' : 'ul';
}

function isBlankText(node: Node): boolean {
    return node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() === '';
}

/**
 * List behaviour: nesting with Tab / Shift+Tab, the indent and outdent commands, Enter and
 * Backspace / Delete in task rows, vertical arrows across them, and the task checkboxes.
 * The bullet, numbered and task list *toggles* belong to the block controller.
 */
export class ListsController implements RichTextController {
    private readonly life = new Disposables();

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host, life } = this;
        const handlers: [number, (event: KeyboardEvent) => boolean][] = [
            [KEY_PRIORITY.confineCaret, () => this.confineBeforeKey()],
            [KEY_PRIORITY.joinTaskRows, (event) => this.joinTaskRows(event)],
            [KEY_PRIORITY.verticalArrow, (event) => this.verticalArrowInTaskRow(event)],
            [KEY_PRIORITY.tab, (event) => this.tab(event)],
            [KEY_PRIORITY.enterTaskList, (event) => this.enterInTaskList(event)],
            [KEY_PRIORITY.enterLeavingList, (event) => this.enterLeavingList(event)],
        ];
        for (const [priority, handler] of handlers) life.add(host.addKeyHandler(priority, handler));

        const commands = [['indent', () => this.indent()], ['outdent', () => this.outdent()]] as const;
        for (const [name, run] of commands) {
            host.commandTable.set(name, run);
            life.add(() => {
                if (host.commandTable.get(name) === run) host.commandTable.delete(name);
            });
        }

        life.add(host.onSelectionMoved(() => this.confineCaretToTaskText()));
        // Sanitized markup carries disabled boxes.
        life.add(host.onContentReplaced(() => enableTaskCheckboxes(host.contentRoot)));
        life.listen<MouseEvent>(host.contentRoot, 'click', (event) => this.onClick(event));
        enableTaskCheckboxes(host.contentRoot);
    }

    detach(): void {
        this.life.dispose();
    }

    /**
     * Toggles one task row, taking the click over from the browser so the state lives on
     * `data-checked`. Rows are independent: a parent's state says nothing about its sub-rows.
     */
    private onClick(event: MouseEvent): void {
        const box = event.target;
        if (!(box instanceof HTMLInputElement) || box.type !== 'checkbox') return;
        const row = box.closest<HTMLElement>('li[data-task]');
        if (!row) return;

        event.preventDefault();
        const checked = row.dataset['checked'] !== 'true';
        row.dataset['checked'] = String(checked);
        const own = row.querySelector<HTMLInputElement>(':scope > input[type="checkbox"]');
        if (own) {
            own.toggleAttribute('checked', checked);
            own.checked = checked;
        }
        // The prevented click reverts the clicked box's `checked` once this handler returns.
        this.life.timeout(() => {
            box.checked = checked;
        }, 0);
        this.placeCaretAfterCheckbox(row);
        this.host.commit();
    }

    private placeCaretAfterCheckbox(row: HTMLElement): void {
        const span = row.querySelector<HTMLElement>(':scope > span');
        const selection = this.host.getSelection();
        if (!span || !selection) return;
        const range = this.host.doc.createRange();
        range.selectNodeContents(span);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Caret helpers

    private caretRange(): Range | null {
        const selection = this.host.getSelection();
        return selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    }

    private listItemAtCaret(): HTMLElement | null {
        const range = this.caretRange();
        return range ? findAncestorByTag(range.startContainer, 'LI', this.host.contentRoot) : null;
    }

    private taskRowAtCaret(): HTMLElement | null {
        const row = this.listItemAtCaret();
        return row?.dataset['task'] === undefined ? null : row;
    }

    private rowCaret(): RowCaret | null {
        const range = this.caretRange();
        if (!range?.collapsed) return null;
        const line = lineOf(range.startContainer, this.host.contentRoot);
        if (line?.kind !== 'item' || !line.holder.contains(range.startContainer)) return null;
        return { line, row: line.owner, range };
    }

    private atLineTextStart({ line, range }: RowCaret): boolean {
        const before = this.host.doc.createRange();
        before.setStart(line.holder, 0);
        before.setEnd(range.startContainer, range.startOffset);
        return rangeShowsNothing(before);
    }

    private atLineTextEnd({ line, range }: RowCaret): boolean {
        const last = lineOwnNodes(line).at(-1);
        if (!last) return true;
        const after = this.host.doc.createRange();
        after.setStart(range.startContainer, range.startOffset);
        after.setEndAfter(last);
        return rangeShowsNothing(after);
    }

    /**
     * Keeps a collapsed caret in a task row inside the row's text span. The browser lands on the
     * positions beside the checkbox, where typed text sits outside the span and Backspace would
     * delete the box. Stray text next to the span is gathered back into it first.
     */
    private confineCaretToTaskText(): void {
        const selection = this.host.getSelection();
        if (!selection?.isCollapsed || selection.rangeCount === 0) return;
        const row = this.taskRowAtCaret();
        const span = row?.querySelector<HTMLElement>(':scope > span');
        if (!row || !span) return;

        this.gatherStrayRowText(row, span, selection);
        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        const element = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
        // A caret in a list nested under the row belongs to that list.
        if (span.contains(container) || element?.closest('li, ul, ol, table') !== row) return;

        const spanStart = this.host.doc.createRange();
        spanStart.setStart(span, 0);
        spanStart.collapse(true);
        if (range.compareBoundaryPoints(Range.START_TO_START, spanStart) < 0) placeCaretAtStartOfBlock(selection, span);
        else placeCaretAtEndOf(selection, span);
    }

    private gatherStrayRowText(row: HTMLElement, span: HTMLElement, selection: Selection): void {
        const stray = Array.from(row.childNodes).filter(
            (node) => node !== span && node.nodeName !== 'INPUT' && !isNestedList(node),
        );
        if (stray.length === 0) return;
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const anchor = range ? { node: range.startContainer, offset: range.startOffset } : null;
        for (const node of stray) span.appendChild(node);
        if (anchor?.node.isConnected) setSelectionRange(selection, anchor.node, anchor.offset);
    }

    private confineBeforeKey(): boolean {
        this.confineCaretToTaskText();
        return false;
    }

    // Keys

    private tab(event: KeyboardEvent): boolean {
        if (event.key !== 'Tab') return false;
        event.preventDefault();
        if (!this.listItemAtCaret()) {
            this.host.insertTextAtCaret('\t');
            return true;
        }
        if (event.shiftKey ? this.outdentListItem() : this.indentListItem()) this.host.commit({ focus: true });
        return true;
    }

    private isPlainEnter(event: KeyboardEvent): boolean {
        return event.key === 'Enter' && !event.shiftKey;
    }

    private enterInTaskList(event: KeyboardEvent): boolean {
        const selection = this.host.getSelection();
        const row = this.isPlainEnter(event) && selection && selection.rangeCount > 0 ? this.taskRowAtCaret() : null;
        if (!row || !selection) return false;

        event.preventDefault();
        const line = lineOf(row, this.host.contentRoot);
        if (line && lineIsEmpty(line)) this.exitTaskRow(row, selection);
        else this.insertTaskRowAfter(row, selection);
        this.host.commit();
        return true;
    }

    private insertTaskRowAfter(row: HTMLElement, selection: Selection): void {
        const added = createTaskListItem(this.host.doc, false);
        row.parentNode?.insertBefore(added, row.nextSibling);
        // Inside the seed, not at the span's boundary, so typing lands in the span and the row
        // does not start with a space.
        const anchor = added.querySelector(':scope > span')?.firstChild;
        if (anchor) setSelectionRange(selection, anchor, 0);
    }

    /** A nested row steps out one level; a top-level one becomes a paragraph after its list. */
    private exitTaskRow(row: HTMLElement, selection: Selection): void {
        if (this.moveItemOutOneLevel(row)) {
            const span = row.querySelector<HTMLElement>(':scope > span');
            if (span) placeCaretAtStartOfBlock(selection, span);
            return;
        }
        const list = row.parentElement;
        const paragraph = createEmptyParagraph(this.host.doc);
        list?.parentNode?.insertBefore(paragraph, list.nextSibling);
        row.remove();
        if (list && !list.hasChildNodes()) list.remove();
        setSelectionRange(selection, paragraph, 0);
    }

    /**
     * Enter on an empty top-level item of the last position leaves the list as a `<p>`; without it
     * the browser's default separator would be a `<div>`. A nested item is left to the outdent path.
     */
    private enterLeavingList(event: KeyboardEvent): boolean {
        const selection = this.host.getSelection();
        const range = this.isPlainEnter(event) && selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        if (!selection || !range) return false;
        const item = findAncestorByTag(range.startContainer, 'LI', this.host.contentRoot);
        const list = item?.parentElement;
        if (!item || !list || !holdsNothing(item)) return false;
        if (!isNestedList(list) || list.parentElement?.tagName === 'LI' || item !== list.lastElementChild) return false;

        event.preventDefault();
        const paragraph = createEmptyParagraph(this.host.doc);
        list.parentNode?.insertBefore(paragraph, list.nextSibling);
        item.remove();
        if (list.children.length === 0) list.remove();
        setSelectionRange(selection, paragraph, 0);
        this.host.commit();
        return true;
    }

    /**
     * Backspace / Delete across list rows. A row is `<li><input><span>..</span></li>`, so the
     * browser's own join would delete the checkbox and bake the row's struck rendering into the
     * surviving text. The neighbour is the line above / below in document order.
     */
    private joinTaskRows(event: KeyboardEvent): boolean {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
        const caret = this.rowCaret();
        if (!caret) return false;
        const joined = event.key === 'Backspace' ? this.joinLineUpwards(caret) : this.joinLineFromBelow(caret);
        if (!joined) return false;
        event.preventDefault();
        this.host.commit();
        return true;
    }

    private joinLineUpwards(caret: RowCaret): boolean {
        if (!this.atLineTextStart(caret)) return false;
        const above = lineAbove(buildLineIndex(this.host.contentRoot), caret.line);
        if (!above) return this.firstLineLeavesItsList(caret);
        // Document order alone would join a row into the cell or code block above it.
        if (!linesMayJoin(caret.line, above)) return false;
        this.moveLineText(caret.line, above);
        this.removeJoinedLine(caret.line);
        return true;
    }

    private joinLineFromBelow(caret: RowCaret): boolean {
        if (!this.atLineTextEnd(caret)) return false;
        const below = lineBelow(buildLineIndex(this.host.contentRoot), caret.line);
        if (!below || !linesMayJoin(caret.line, below)) return false;
        this.moveLineText(below, caret.line, { keepCaret: true });
        this.removeJoinedLine(below);
        return true;
    }

    /** The document's first line is a list row: it leaves the list as a paragraph; later rows keep theirs. */
    private firstLineLeavesItsList(caret: RowCaret): boolean {
        const list = caret.row.parentElement;
        if (!list || !isNestedList(list)) return false;
        const paragraph = this.host.doc.createElement('p');
        list.parentNode?.insertBefore(paragraph, list);
        this.moveLineText(caret.line, { kind: 'block', owner: paragraph, holder: paragraph }, { placeholder: 'block' });
        this.promoteNestedRows(caret.row, list);
        this.placeCaretInJoinedParagraph(paragraph);
        caret.row.remove();
        if (list.children.length === 0) list.remove();
        if (list.isConnected) this.separateListKindsKeepingCaret(list);
        return true;
    }

    /** Removes a line whose text has gone, keeping the lines nested under it at its level. */
    private removeJoinedLine(line: Line): void {
        const owner = line.owner;
        const list = owner.parentElement;
        this.promoteNestedRows(owner, list);
        owner.remove();
        if (list && isNestedList(list) && list.children.length === 0) list.remove();
        if (list?.isConnected && isNestedList(list)) this.separateListKindsKeepingCaret(list);
    }

    /** `separateListKinds`, keeping the caret on its character: moving items detaches the selected nodes. */
    private separateListKindsKeepingCaret(list: HTMLElement): void {
        const selection = this.host.getSelection();
        const range = this.caretRange();
        const caret = range ? caretPosition(buildLineIndex(this.host.contentRoot), range) : null;
        if (!separateListKinds(list) || !caret || !selection) return;
        selection.removeAllRanges();
        selection.addRange(placeCaretIn(caret.line, caret.offset));
    }

    private promoteNestedRows(row: HTMLElement, list: Element | null): void {
        if (!list) return;
        for (const nested of Array.from(row.children)) {
            if (!isNestedList(nested)) continue;
            while (nested.firstChild) list.insertBefore(nested.firstChild, row);
        }
    }

    /**
     * Appends one line's text to another, before the target's own nested list. An emptied line
     * keeps a space so it can hold a caret; a `'block'` target stays truly empty. Unless
     * `keepCaret`, the caret lands on the join.
     */
    private moveLineText(
        from: Line,
        into: Line,
        options: { keepCaret?: boolean; placeholder?: 'line' | 'block' } = {},
    ): void {
        // The emptiness rule, not a text test: a target holding an image has no text.
        if (lineIsEmpty(into)) for (const node of lineOwnNodes(into)) node.remove();
        const moved = lineOwnNodes(from).filter(
            (node) => !(node.nodeType === Node.TEXT_NODE && PLACEHOLDER_ONLY.test((node as Text).data)),
        );
        const holder = into.holder;
        const stop = Array.from(holder.childNodes).find((node) => isNestedList(node)) ?? null;
        const joinAt = stop ? Array.prototype.indexOf.call(holder.childNodes, stop) : holder.childNodes.length;
        for (const node of moved) {
            if (stop) stop.before(node);
            else holder.appendChild(node);
        }
        if (lineOwnNodes(into).length === 0 && options.placeholder !== 'block') {
            holder.append(' ');
        }
        const selection = this.host.getSelection();
        if (options.keepCaret || !selection) return;
        setSelectionRange(selection, holder, Math.min(joinAt, holder.childNodes.length));
    }

    /** An emptied first line stays a genuinely empty block, not a paragraph holding a counted space. */
    private placeCaretInJoinedParagraph(paragraph: HTMLElement): void {
        const selection = this.host.getSelection();
        if (!selection) return;
        if (paragraph.hasChildNodes()) {
            placeCaretAtStartOfBlock(selection, paragraph);
            return;
        }
        paragraph.innerHTML = '<br>';
        setSelectionRange(selection, paragraph, 0);
    }

    /**
     * ArrowUp / ArrowDown from a task row. The caret position beside the checkbox is a line stop
     * of its own, so one press landed there; the move is repeated once when it did. A row that
     * wraps is not a reason to repeat: its own lines are real stops.
     */
    private verticalArrowInTaskRow(event: KeyboardEvent): boolean {
        if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
            return false;
        }
        const selection = this.host.getSelection();
        if (!this.rowCaret() || typeof selection?.modify !== 'function') return false;

        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 'backward' : 'forward';
        selection.modify('move', direction, 'line');
        if (this.caretBesideLineText(selection)) selection.modify('move', direction, 'line');
        this.confineCaretToTaskText();
        return true;
    }

    private caretBesideLineText(selection: Selection): boolean {
        if (!selection.isCollapsed || selection.rangeCount === 0) return false;
        const container = selection.getRangeAt(0).startContainer;
        const line = lineOf(container, this.host.contentRoot);
        return !!line && line.holder !== line.owner && !line.holder.contains(container);
    }

    // Indent / outdent

    /** Nests a list item, or steps a plain block right by a margin the sanitizer allows. */
    private indent(): boolean {
        return this.listItemAtCaret() ? this.indentListItem() : this.stepBlockIndent(BLOCK_INDENT_STEP_REM);
    }

    private outdent(): boolean {
        return this.listItemAtCaret() ? this.outdentListItem() : this.stepBlockIndent(-BLOCK_INDENT_STEP_REM);
    }

    private stepBlockIndent(deltaRem: number): boolean {
        const range = this.caretRange();
        const block = range ? lineOf(range.startContainer, this.host.contentRoot)?.owner : null;
        if (!block) return false;

        const current = Number.parseFloat(block.style.marginLeft) || 0;
        const next = Math.min(MAX_BLOCK_INDENT_REM, Math.max(0, current + deltaRem));
        if (next === current) return false;

        // Physical `margin-left`: the sanitizer allow-list has no logical property.
        if (next === 0) block.style.removeProperty('margin-left');
        else block.style.marginLeft = `${next}rem`;
        return true;
    }

    private listDepth(item: HTMLElement): number {
        let depth = 0;
        for (let node: Node | null = item; node && node !== this.host.contentRoot; node = node.parentNode) {
            if (isNestedList(node)) depth++;
        }
        return depth;
    }

    private indentListItem(): boolean {
        const item = this.listItemAtCaret();
        if (!item || this.listDepth(item) >= MAX_LIST_DEPTH) return false;
        const previous = item.previousElementSibling;
        if (previous?.tagName !== 'LI') return false;

        const parentList = item.parentElement;
        const nested = this.listToAppendUnder(previous, listTag(parentList), parentList?.dataset['taskList'] !== undefined);
        const caret = this.caretInLine(item);
        nested.appendChild(item);
        separateListKinds(nested);
        if (caret) this.restoreCaretInLine(caret);
        return true;
    }

    private outdentListItem(): boolean {
        const item = this.listItemAtCaret();
        if (!item) return false;
        const caret = this.caretInLine(item);
        const line = this.moveItemOutOneLevel(item);
        if (!line) return false;
        // The item's own line may now be a paragraph, when a block came along with it.
        if (caret) this.restoreCaretInLine(caret.owner === item ? { ...caret, owner: line } : caret);
        return true;
    }

    /**
     * The caret's line inside `item` as the element owning it plus a character offset. Moving an
     * item re-parents the node the selection points at; the line is kept by owner because an item
     * holding a paragraph, code block or table is no line itself.
     */
    private caretInLine(item: HTMLElement): LineCaret | null {
        const range = this.caretRange();
        if (!range || !item.contains(range.startContainer)) return null;
        const position = caretPosition(buildLineIndex(this.host.contentRoot), range);
        return position ? { owner: position.line.owner, offset: position.offset } : null;
    }

    private restoreCaretInLine({ owner, offset }: LineCaret): void {
        const selection = this.host.getSelection();
        const line = lineOf(owner, this.host.contentRoot);
        if (!selection || !line) return;
        selection.removeAllRanges();
        selection.addRange(lineOwnNodes(line).length > 0 ? placeCaretIn(line, offset) : this.emptyLineCaretRange(line.holder));
    }

    private emptyLineCaretRange(holder: HTMLElement): Range {
        const target = emptyBlockCaretTarget(holder);
        const range = this.host.doc.createRange();
        range.setStart(target, target.data.length);
        range.collapse(true);
        return range;
    }

    /**
     * Moves a nested item up one level, to just after its parent item, taking the items that
     * followed it along as its own sub-list. Returns the element holding the item's own line
     * afterwards, or null when the item is not nested and nothing moves.
     */
    private moveItemOutOneLevel(item: HTMLElement): HTMLElement | null {
        const parentList = item.parentElement;
        if (!parentList || !isNestedList(parentList)) return null;
        const grandparentItem = parentList.parentElement;
        if (grandparentItem?.tagName !== 'LI') return null;
        const grandparentList = grandparentItem.parentElement;
        if (!grandparentList) return null;

        this.reparentFollowingSiblings(item, parentList);
        const trailing: ChildNode[] = [];
        for (let node = parentList.nextSibling; node; node = node.nextSibling) trailing.push(node);
        grandparentList.insertBefore(item, grandparentItem.nextSibling);
        if (parentList.children.length === 0) parentList.remove();
        const line = this.carryTrailingContent(item, trailing);
        separateListKinds(grandparentList);
        return line;
    }

    /**
     * Puts what the parent item held after the moved item's list at the end of the moved item:
     * it shows below that item, and left behind it would move above. Returns the element holding
     * the moved item's own line.
     */
    private carryTrailingContent(item: HTMLElement, trailing: readonly ChildNode[]): HTMLElement {
        if (trailing.every((node) => nodeShowsNothing(node))) return item;
        if (item.dataset['task'] !== undefined) {
            this.carryAfterTaskRow(item, trailing);
            return item;
        }
        item.append(...trailing);
        return this.giveLooseTextLines(item) ?? item;
    }

    /**
     * A task row keeps the nested lists leading the carried content, as a row's sub-lists do; the
     * rest, from the first content that shows something, becomes an item after the row.
     */
    private carryAfterTaskRow(row: HTMLElement, trailing: readonly ChildNode[]): void {
        const at = trailing.findIndex((node) => !isNestedList(node) && !nodeShowsNothing(node));
        const leading = at < 0 ? trailing : trailing.slice(0, at);
        row.append(...leading.filter((node) => isNestedList(node)));
        if (at < 0) return;
        const item = this.host.doc.createElement('li');
        item.append(...trailing.slice(at));
        row.after(item);
        this.giveLooseTextLines(item);
    }

    /** Gives each run of loose text in an item that holds a block a paragraph; returns the first run's. */
    private giveLooseTextLines(item: HTMLElement): HTMLElement | null {
        if (Array.from(item.childNodes).every((node) => isPhrasing(node) || isNestedList(node))) return null;
        const runs: ChildNode[][] = [[]];
        for (const node of Array.from(item.childNodes)) {
            if (isPhrasing(node) && node.nodeName !== 'INPUT') runs.at(-1)?.push(node);
            else runs.push([]);
        }
        return runs.map((run) => this.paragraphAround(run))[0] ?? null;
    }

    private paragraphAround(run: readonly ChildNode[]): HTMLElement | null {
        const [first] = run;
        if (!first || run.every(isBlankText)) return null;
        const paragraph = this.host.doc.createElement('p');
        first.before(paragraph);
        paragraph.append(...run);
        return paragraph;
    }

    /** Moves the items after `item` into a sub-list beneath it, so outdenting it carries them along. */
    private reparentFollowingSiblings(item: HTMLElement, parentList: HTMLElement): void {
        const following: HTMLElement[] = [];
        for (let sibling = item.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
            if (sibling.tagName === 'LI') following.push(sibling as HTMLElement);
        }
        if (following.length === 0) return;

        const nested = this.listToAppendUnder(item, listTag(parentList), parentList.dataset['taskList'] !== undefined);
        for (const moved of following) nested.appendChild(moved);
        separateListKinds(nested);
    }

    /**
     * The list a line moved under `item` goes into: the one that ends the item when it has the
     * tag, else a new one after everything the item holds. A numbered list created past another
     * numbered one keeps counting from its last item.
     */
    private listToAppendUnder(item: Element, tag: 'ul' | 'ol', taskList: boolean): HTMLElement {
        let last: ChildNode | null = item.lastChild;
        while (last && isBlankText(last)) last = last.previousSibling;
        if (last?.nodeName === tag.toUpperCase()) return last as HTMLElement;

        const made = this.host.doc.createElement(tag);
        if (taskList) made.dataset['taskList'] = '';
        const previous = tag === 'ol' ? lastChildTagged(item, 'OL') : null;
        if (previous) {
            const start = listStartOf(previous) + previous.querySelectorAll(':scope > li').length;
            if (start !== 1) made.setAttribute('start', String(start));
        }
        item.appendChild(made);
        return made;
    }
}
