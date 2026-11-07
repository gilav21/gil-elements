import { ZERO_WIDTH, clampNodeOffset, findAncestorByTag, placeCaretAtEndOfBlock, placeCaretAtStartOfBlock, setSelectionRange } from './rich-text-dom.js';
import { isRichTextFormatCommand, type RichTextController, type RichTextFormatCommand } from './rich-text-host.js';
import {
    MAX_NESTING_DEPTH,
    blockquoteDepthOf,
    buildLineIndex,
    flattenIntoRowText,
    holdsNothing,
    isLineOwner,
    isNestedList,
    isPhrasing,
    lineIsTextOnly,
    lineOf,
    lineOwnNodes,
    lineTagIsFixed,
    lineText,
    linesBetween,
    rowRunsOf,
    structureAround,
    type Line,
} from './rich-text-lines.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import { Disposables } from './rich-text-registry.js';

const EMPTY_LINE = '<br>';
const HORIZONTAL_RULE = '<hr><p><br></p>';
const TOGGLE_BLOCK = '<details open><summary>Toggle title</summary><p>Content here...</p></details>';
const SUBLIST = ':scope > ul, :scope > ol';
/** Where a list stops being the item's own: the nearest element that holds blocks on its own. */
const ITEM_BOUNDARIES = new Set(['BLOCKQUOTE', 'DETAILS', 'TD', 'TH', 'SUMMARY']);

type ListTag = 'ul' | 'ol';

interface ToggleContext {
    readonly selection: Selection;
    readonly range: Range;
    readonly anchor: Node;
    readonly offset: number;
    readonly focus: Node;
    readonly focusOffset: number;
}

// Shared DOM helpers: also used by the insert, list and markdown-shortcut controllers.

export function replaceBlockTag(block: HTMLElement, tag: string): HTMLElement {
    if (block.tagName === tag.toUpperCase()) return block;
    const replacement = block.ownerDocument.createElement(tag);
    replacement.append(...block.childNodes);
    block.replaceWith(replacement);
    return replacement;
}

/** The number an ordered list counts from. */
export function listStartOf(list: Element): number {
    const start = Number.parseInt(list.getAttribute('start') ?? '', 10);
    return Number.isInteger(start) ? start : 1;
}

/**
 * Moves the items after `item` into a new list of the same kind, right after its own, so a
 * block can go between the halves. Returns the new list, or null when `item` is the last.
 */
export function splitListAfter(item: HTMLElement): HTMLElement | null {
    const list = item.parentElement;
    if (!list || !item.nextElementSibling) return null;
    const tail = list.cloneNode(false) as HTMLElement;
    while (item.nextSibling) tail.append(item.nextSibling);
    list.after(tail);
    return tail;
}

/** Finishes a split: a numbered tail counts on from the items left in the head, and an empty head goes. */
export function settleSplitList(head: HTMLElement, tail: HTMLElement | null): void {
    const count = head.querySelectorAll(':scope > li').length;
    if (tail?.tagName === 'OL') {
        const start = listStartOf(head) + count;
        if (start === 1) tail.removeAttribute('start');
        else tail.setAttribute('start', String(start));
    }
    if (count === 0) head.remove();
}

/** One task row: the checkbox plus the span holding its text, seeded so an empty row still takes a caret. */
export function createTaskListItem(doc: Document, checked: boolean): HTMLElement {
    const item = doc.createElement('li');
    item.dataset['task'] = '';
    item.dataset['checked'] = String(checked);
    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    const text = doc.createElement('span');
    // A non-breaking space: a plain one collapses, so Chrome parks the caret before the span and typing
    // lands beside it; a zero-width one gives the span no width, so the caret has nothing to draw against.
    text.append(doc.createTextNode(' '));
    item.append(checkbox, text);
    return item;
}

export function enableTaskCheckboxes(container: HTMLElement): void {
    for (const box of container.querySelectorAll<HTMLInputElement>('li[data-task] input[type="checkbox"]')) {
        box.removeAttribute('disabled');
        box.checked = box.closest<HTMLElement>('li[data-task]')?.dataset['checked'] === 'true';
    }
}

export function stripTaskMarkers(list: HTMLElement): void {
    if (list.dataset['taskList'] === undefined) return;
    delete list.dataset['taskList'];
    for (const item of Array.from(list.children) as HTMLElement[]) {
        delete item.dataset['task'];
        delete item.dataset['checked'];
        item.querySelector(':scope > input[type="checkbox"]')?.remove();
        const span = item.querySelector(':scope > span');
        span?.replaceWith(...span.childNodes);
    }
}

/** The node a range boundary points at, resolving one anchored on the root itself. */
function boundaryNodeOf(container: Node, offset: number, root: HTMLElement): Node | null {
    if (container !== root) return container;
    return root.childNodes.item(Math.min(offset, root.childNodes.length - 1));
}

function startsItsOwnLine(node: Node, root: HTMLElement): boolean {
    return node.nodeType === Node.ELEMENT_NODE
        && (isLineOwner(node as Element, root) || isNestedList(node) || node.nodeName === 'TABLE');
}

/**
 * Gives a run of inline content with no line of its own one, in place. Text can sit in a CONTAINER
 * (an `<li>` that also holds a block), and wrapping the root's child there would move the whole list.
 */
function wrapStrayRunAround(node: Node, root: HTMLElement): Node | null {
    let stray = node as ChildNode;
    for (let parent = stray.parentNode; parent && parent !== root && !lineOf(parent, root); parent = stray.parentNode) {
        if (!(parent instanceof Element) || Array.from(parent.children).some((child) => isLineOwner(child, root))) break;
        stray = parent;
    }
    if (!stray.parentNode) return null;
    const run: ChildNode[] = [];
    for (let at: ChildNode | null = stray; at && !startsItsOwnLine(at, root); at = at.previousSibling) run.unshift(at);
    for (let at = stray.nextSibling; at && !startsItsOwnLine(at, root); at = at.nextSibling) run.push(at);
    const first = run[0];
    if (!first) return null;
    const paragraph = root.ownerDocument.createElement('p');
    first.before(paragraph);
    paragraph.append(...run);
    return paragraph;
}

/**
 * The lines a block command acts on: the line the range starts in, the one it ends in, and those
 * between them that share the first one's container, so a command never crosses a list or table boundary.
 * Loose text under the root, or in a container, is wrapped in a paragraph where it lives first.
 * Both boundaries are resolved to nodes before wrapping, which re-parents nodes and drags a live range.
 */
export function linesForRange(range: Range, root: HTMLElement): Line[] {
    const startNode = boundaryNodeOf(range.startContainer, range.startOffset, root);
    const endNode = boundaryNodeOf(range.endContainer, range.endOffset, root);
    if (!startNode || !endNode) return [];
    const from = lineOf(startNode, root) ? startNode : wrapStrayRunAround(startNode, root);
    const to = lineOf(endNode, root) ? endNode : wrapStrayRunAround(endNode, root);
    if (!from || !to) return [];
    const touched = linesBetween(buildLineIndex(root), from, to);
    const container = touched[0]?.owner.parentNode;
    return touched.filter((line) => line.owner.parentNode === container);
}

/** Whether a heading or Normal text may re-tag a line: not a fixed tag, and not inside an item, cell or summary. */
function lineTakesTextStyle(line: Line, root: HTMLElement): boolean {
    return !lineTagIsFixed(line) && structureAround(line, root).length === 0;
}

/**
 * Whether a text style command would change anything at the caret, judged without touching the
 * document: loose text has no line yet, and a command would give it one it can re-tag.
 */
export function caretTakesTextStyle(selection: Selection | null, root: HTMLElement): boolean {
    if (!selection || selection.rangeCount === 0) return true;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer)) return true;
    const from = boundaryNodeOf(range.startContainer, range.startOffset, root);
    const to = boundaryNodeOf(range.endContainer, range.endOffset, root);
    if (!from || !to) return true;
    if (range.collapsed) {
        const line = lineOf(from, root);
        return line ? lineTakesTextStyle(line, root) : true;
    }
    const touched = linesBetween(buildLineIndex(root), from, to);
    const container = touched[0]?.owner.parentNode;
    return touched.length === 0 || touched.some((line) => line.owner.parentNode === container && lineTakesTextStyle(line, root));
}

/**
 * How a block that takes the place of `lines` may be built, or null when it may not: beside lines that
 * stand on their own, or in place of top-level list items of one line each (the list splits around it).
 * Anywhere else the block has no form a save keeps without reordering or burying text, so a command stands down.
 */
export function replacementFor(lines: readonly Line[], root: HTMLElement): 'lines' | 'items' | null {
    const structures = lines.map((line) => structureAround(line, root));
    if (structures.every((found) => found.length === 0)) return 'lines';
    const topLevelItems = lines.every((line, i) => line.owner.nodeName === 'LI' && structures[i]?.length === 1 && structures[i]?.[0] === line.owner);
    if (!topLevelItems) return null;
    const holdsSublist = lines.some((line) => line.owner.querySelector(SUBLIST));
    return holdsSublist && lines.length > 1 ? null : 'items';
}

/** Puts `built` in place of list items, splitting their list around it; a single item's sub-list follows the block. */
export function putBlockInPlaceOfItems(built: HTMLElement, lines: readonly Line[]): void {
    const first = lines[0]?.owner;
    const last = lines.at(-1)?.owner;
    const list = first?.parentElement;
    if (!first || !last || !list) return;
    const tail = splitListAfter(last);
    const sublist = lines.length === 1 ? first.querySelector(SUBLIST) : null;
    list.after(built);
    if (sublist) built.after(sublist);
    for (const line of lines) line.owner.remove();
    settleSplitList(list, tail);
}

/**
 * Wraps lines in one `<blockquote>` and returns them as its lines. A quote's direct children are always
 * line blocks, never bare text, or Enter could not leave it; a `<div>` becomes a `<p>` on the way in.
 */
export function quoteLines(lines: readonly Line[], root: HTMLElement): HTMLElement[] {
    const first = lines[0];
    const replacement = replacementFor(lines, root);
    if (!first || replacement === null) return [];
    const doc = root.ownerDocument;
    const quote = doc.createElement('blockquote');
    if (replacement === 'items') {
        const paragraphs = lines.map((line) => {
            const paragraph = doc.createElement('p');
            paragraph.append(...lineOwnNodes(line));
            if (holdsNothing(paragraph)) paragraph.innerHTML = EMPTY_LINE;
            quote.append(paragraph);
            return paragraph;
        });
        putBlockInPlaceOfItems(quote, lines);
        return paragraphs;
    }
    first.owner.before(quote);
    return lines.map(({ owner }) => {
        const line = owner.tagName === 'DIV' ? replaceBlockTag(owner, 'p') : owner;
        quote.append(line);
        return line;
    });
}

function quoteBlock(block: HTMLElement, root: HTMLElement): HTMLElement {
    const line = lineOf(block, root);
    return (line ? quoteLines([line], root)[0] : undefined) ?? block;
}

/**
 * Quotes one block `levels` deep, or as deep as the markdown reader's ceiling allows: a quote nested past
 * it is unwrapped on reload. Quotes the block already sits in count towards the ceiling.
 */
export function quoteBlockToDepth(block: HTMLElement, levels: number, root: HTMLElement): HTMLElement {
    const room = MAX_NESTING_DEPTH - blockquoteDepthOf(block, root);
    let quoted = block;
    for (let level = 0; level < Math.min(levels, room); level++) quoted = quoteBlock(quoted, root);
    return quoted;
}

/** Turns a code block back into one paragraph per line; returns the first. */
function unwrapCodeBlock(pre: HTMLElement): HTMLElement | null {
    if (!pre.parentNode) return null;
    const doc = pre.ownerDocument;
    const paragraphs = (pre.textContent ?? '').replace(/\n$/, '').split('\n').map((text) => {
        const paragraph = doc.createElement('p');
        if (text === '') paragraph.innerHTML = EMPTY_LINE;
        else paragraph.textContent = text;
        return paragraph;
    });
    pre.replaceWith(...paragraphs);
    return paragraphs[0] ?? null;
}

/** Task rows keep their sub-lists; every other kind of content in the item is flattened into the row's text. */
function addTaskMarkers(list: HTMLElement): void {
    const target = list.tagName === 'OL' ? replaceBlockTag(list, 'ul') : list;
    target.dataset['taskList'] = '';
    for (const item of Array.from(target.children) as HTMLElement[]) {
        if (item.dataset['task'] !== undefined) continue;
        // Content after a nested list starts the next row (see rowRunsOf).
        const rows = rowRunsOf(item).map((run) => {
            const built = createTaskListItem(item.ownerDocument, false);
            const span = built.querySelector('span') as HTMLElement;
            span.textContent = '';
            flattenIntoRowText(run.content, span);
            if (holdsNothing(span)) span.textContent = ZERO_WIDTH;
            built.append(...run.lists);
            return built;
        });
        item.replaceWith(...rows);
    }
    enableTaskCheckboxes(target);
}

/** Whether flattening any item of `list` into a row would drop a rule (its own sub-lists stay lists). */
function itemsHoldARule(list: HTMLElement): boolean {
    return Array.from(list.children).some((item) =>
        Array.from(item.querySelectorAll('hr')).some((rule) =>
            !Array.from(item.children).some((child) => isNestedList(child) && child.contains(rule))));
}

/** The top-level item a list sits in, below the nearest quote, details block or cell; null at top level. */
function outermostItemAround(list: HTMLElement, root: HTMLElement): HTMLElement | null {
    let item: HTMLElement | null = null;
    for (let el = list.parentElement; el && el !== root; el = el.parentElement) {
        if (ITEM_BOUNDARIES.has(el.nodeName)) break;
        if (el.nodeName === 'LI') item = el;
    }
    return item;
}

/**
 * An item's content as blocks in its own order: each run of inline content becomes a paragraph, and a
 * block (code block, quote, sub-list) moves out as it is.
 */
function itemAsBlocks(item: Element): Node[] {
    const doc = item.ownerDocument;
    const pieces: Node[] = [];
    let run: HTMLElement | null = null;
    for (const child of Array.from(item.childNodes)) {
        if (isPhrasing(child)) {
            run ??= doc.createElement('p');
            run.append(child);
            continue;
        }
        if (run) pieces.push(run);
        run = null;
        pieces.push(child);
    }
    if (run) pieces.push(run);
    const kept = pieces.filter((piece) => piece.nodeName !== 'P' || !holdsNothing(piece as Element));
    if (kept.every(isNestedList)) {
        const empty = doc.createElement('p');
        empty.innerHTML = EMPTY_LINE;
        kept.unshift(empty);
    }
    return kept;
}

/** Every item back to a paragraph in the list's place; nested lists stay lists beside it. Returns the first paragraph. */
function unwrapList(list: HTMLElement, root: HTMLElement): HTMLElement | null {
    if (!list.parentNode) return null;
    const parentItem = list.parentElement?.nodeName === 'LI' ? list.parentElement : null;
    // A sub-list's items cannot become paragraphs inside their item, so they follow the top-level item,
    // which keeps the text in order only when the sub-list ends it.
    if (parentItem && (outermostItemAround(list, root) !== parentItem || parentItem.lastElementChild !== list)) return null;
    stripTaskMarkers(list);
    const pieces = Array.from(list.children).flatMap(itemAsBlocks);
    const head = parentItem?.parentElement;
    if (parentItem && head) {
        list.remove();
        const tail = splitListAfter(parentItem);
        let at: ChildNode = head;
        for (const piece of pieces) {
            at.after(piece);
            at = piece as ChildNode;
        }
        settleSplitList(head, tail);
    } else {
        list.before(...pieces);
        list.remove();
    }
    return (pieces.find((piece) => piece.nodeName === 'P') as HTMLElement | undefined) ?? null;
}

/** Turns lines that stand on their own into a list, one item per line, in place; null with nothing to wrap. */
function wrapLinesInList(lines: readonly Line[], tag: ListTag): HTMLElement | null {
    const first = lines[0];
    if (!first) return null;
    const doc = first.owner.ownerDocument;
    const list = doc.createElement(tag);
    first.owner.before(list);
    for (const line of lines) {
        const item = doc.createElement('li');
        item.append(...lineOwnNodes(line));
        if (holdsNothing(item)) item.innerHTML = EMPTY_LINE;
        list.append(item);
        line.owner.remove();
    }
    return list;
}

/** Block commands: headings, quote, lists, code block, rule and alignment. Also the engine behind slash-menu block commands. */
export class BlocksController implements RichTextController {
    private readonly life = new Disposables();

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host } = this;
        const align = (command: string, swapped: string) => () => this.align(command, swapped);
        const commands: ReadonlyArray<readonly [RichTextFormatCommand, () => void]> = [
            ['paragraph', () => this.retag('p')],
            ['heading1', () => this.retag('h1')],
            ['heading2', () => this.retag('h2')],
            ['heading3', () => this.retag('h3')],
            ['bulletList', () => this.toggleList('ul')],
            ['orderedList', () => this.toggleList('ol')],
            ['taskList', () => this.toggleTaskList()],
            ['blockquote', () => this.toggleBlockquote()],
            ['codeBlock', () => this.toggleCodeBlock()],
            ['horizontalRule', () => host.insertBlockAtCaret(HORIZONTAL_RULE)],
            ['alignLeft', align('justifyLeft', 'justifyRight')],
            ['alignCenter', align('justifyCenter', 'justifyCenter')],
            ['alignRight', align('justifyRight', 'justifyLeft')],
        ];
        for (const [name, run] of commands) {
            host.commandTable.set(name, run);
            this.life.add(() => {
                if (host.commandTable.get(name) === run) host.commandTable.delete(name);
            });
        }
        this.life.add(host.provide('blocks', { execute: (command, block) => this.execute(command, block) }));
    }

    detach(): void {
        this.life.dispose();
    }

    private get root(): HTMLElement {
        return this.host.contentRoot;
    }

    /**
     * Runs a built-in command on one block (the slash-menu seam); `null` targets the selection. A block that
     * is no longer in the editor, one captured before an undo or a value write, is ignored.
     */
    private execute(command: string, block: HTMLElement | null): void {
        const { host } = this;
        if (host.readonly || host.isDisabled) return;
        if (block && !(block.isConnected && this.root.contains(block))) return;
        if (block) this.placeCaretAtEnd(block);
        host.restoreSelection();
        host.flushPendingHistoryPush();
        if (command === 'code') {
            this.insertInlineCode();
        } else if (command === 'toggle') {
            this.insertToggle();
        } else {
            const run = isRichTextFormatCommand(command) ? host.commandTable.get(command) : undefined;
            if (!run) return;
            run();
            host.commit({ focus: true });
        }
    }

    private placeCaretAtEnd(block: HTMLElement): void {
        const selection = this.host.getSelection();
        if (selection) placeCaretAtEndOfBlock(selection, block);
    }

    private insertInlineCode(): void {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const doc = this.host.doc;
        const range = selection.getRangeAt(0);
        const code = doc.createElement('code');
        const text = doc.createTextNode(ZERO_WIDTH);
        code.append(text);
        range.deleteContents();
        range.insertNode(doc.createTextNode(ZERO_WIDTH));
        range.insertNode(code);
        setSelectionRange(selection, text, 1);
        this.host.commit();
    }

    private insertToggle(): void {
        this.host.insertHtmlAtCaret(TOGGLE_BLOCK);
        const summary = Array.from(this.root.querySelectorAll('summary')).at(-1);
        const selection = this.host.getSelection();
        if (summary && selection) {
            const range = new Range();
            range.selectNodeContents(summary);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        this.host.commit({ focus: true, history: false });
    }

    private align(command: string, swapped: string): void {
        this.host.doc.execCommand(this.host.isRtl ? swapped : command);
    }

    private toggleContext(): ToggleContext | null {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!this.root.contains(range.startContainer)) return null;
        return {
            selection,
            range,
            anchor: range.startContainer,
            offset: range.startOffset,
            focus: range.endContainer,
            focusOffset: range.endOffset,
        };
    }

    private linesOf(ctx: ToggleContext | null): Line[] {
        return ctx ? linesForRange(ctx.range, this.root) : [];
    }

    /** The selection back on its anchors when they survived, else a caret at the start of `fallback`. */
    private restoreToggleCaret(ctx: ToggleContext, fallback: HTMLElement | null): void {
        const alive = (node: Node): boolean => node.isConnected && this.root.contains(node);
        if (!alive(ctx.anchor)) {
            if (fallback) placeCaretAtStartOfBlock(ctx.selection, fallback);
            return;
        }
        const restored = new Range();
        restored.setStart(ctx.anchor, clampNodeOffset(ctx.anchor, ctx.offset));
        if (alive(ctx.focus)) restored.setEnd(ctx.focus, clampNodeOffset(ctx.focus, ctx.focusOffset));
        else restored.collapse(true);
        ctx.selection.removeAllRanges();
        ctx.selection.addRange(restored);
    }

    /** Headings and paragraphs re-tag the caret's own lines; a line in an item, cell or summary keeps its tag. */
    private retag(tag: string): void {
        const ctx = this.toggleContext();
        const lines = this.linesOf(ctx);
        if (!ctx || lines.length === 0) return;
        let last: HTMLElement | null = null;
        for (const line of lines) {
            if (lineTakesTextStyle(line, this.root)) last = replaceBlockTag(line.owner, tag);
        }
        this.restoreToggleCaret(ctx, last);
    }

    /** Quotes the selected top-level blocks, or lifts the quote the selection sits in. */
    private toggleBlockquote(): void {
        const ctx = this.toggleContext();
        if (!ctx) return;
        const quote = findAncestorByTag(ctx.anchor, 'BLOCKQUOTE');
        if (quote) {
            quote.replaceWith(...quote.childNodes);
        } else {
            const lines = this.linesOf(ctx);
            if (lines.length === 0) return;
            quoteLines(lines, this.root);
        }
        // Chrome drops a selection whose container was re-parented; the container itself is intact.
        setSelectionRange(ctx.selection, ctx.anchor, ctx.offset);
    }

    /** What a list toggle acts on: the list of the innermost item holding the caret's line. Null in a cell, summary or code block. */
    private listToggleTarget(ctx: ToggleContext): { list: HTMLElement | null; lines: Line[] } | null {
        const lines = this.linesOf(ctx);
        // A code block's line breaks have no place in a list item: they became inline code a save wrote as markup.
        if (lines.some((line) => line.kind === 'code')) return null;
        const inner = lines[0] ? structureAround(lines[0], this.root)[0] : undefined;
        if (inner && inner.nodeName !== 'LI') return null;
        return { list: inner?.parentElement ?? null, lines };
    }

    /** Bullet and numbered lists are built here, at the paragraph's level: the same kind toggles back, the other re-tags. */
    private toggleList(tag: ListTag): void {
        const ctx = this.toggleContext();
        const target = ctx ? this.listToggleTarget(ctx) : null;
        if (!ctx || !target) return;
        const { list, lines } = target;
        let fallback: HTMLElement | null = null;
        if (list?.tagName === tag.toUpperCase() && list.dataset['taskList'] === undefined) {
            fallback = unwrapList(list, this.root);
        } else if (list) {
            stripTaskMarkers(list);
            replaceBlockTag(list, tag);
        } else {
            // Its first item, never the list: a caret at the start of a one-empty-item list cleared the item.
            fallback = wrapLinesInList(lines, tag)?.querySelector('li') ?? null;
        }
        this.restoreToggleCaret(ctx, fallback);
    }

    /** The selected lines become task rows keeping their text, a plain list gains checkboxes, a task list goes back to paragraphs. */
    private toggleTaskList(): void {
        const ctx = this.toggleContext();
        const target = ctx ? this.listToggleTarget(ctx) : null;
        if (!ctx || !target) return;
        const { list, lines } = target;
        let fallback: HTMLElement | null = null;
        if (list?.dataset['taskList'] !== undefined) {
            fallback = unwrapList(list, this.root);
        } else if (list) {
            // A row is one line of text, so flattening an item that holds a rule would delete it.
            if (itemsHoldARule(list)) return;
            addTaskMarkers(list);
        } else {
            const created = wrapLinesInList(lines, 'ul');
            if (!created) return;
            addTaskMarkers(created);
            fallback = created.querySelector('span');
        }
        this.restoreToggleCaret(ctx, fallback);
    }

    /** The caret's lines become one `<pre><code>`, and a code block goes back to one paragraph per line. */
    private toggleCodeBlock(): void {
        const ctx = this.toggleContext();
        if (!ctx) return;
        const pre = findAncestorByTag(ctx.anchor, 'PRE');
        if (pre) {
            const first = unwrapCodeBlock(pre);
            if (first) placeCaretAtStartOfBlock(ctx.selection, first);
            return;
        }
        const lines = this.linesOf(ctx);
        // A code block holds text only; building one from a line with an image would drop the image for good.
        if (lines.length === 0 || !lines.every(lineIsTextOnly)) return;
        const replacement = replacementFor(lines, this.root);
        if (replacement === null) return;
        const text = lines.map((line) => lineText(line).replaceAll(ZERO_WIDTH, '')).join('\n');
        const doc = this.host.doc;
        const built = doc.createElement('pre');
        const code = doc.createElement('code');
        // An empty block keeps the seeded newline the Enter-to-exit rule looks for.
        code.textContent = text.trim() === '' ? '\n' : text;
        built.append(code);
        if (replacement === 'items') {
            putBlockInPlaceOfItems(built, lines);
        } else {
            lines[0]?.owner.before(built);
            for (const line of lines) line.owner.remove();
        }
        setSelectionRange(ctx.selection, code.firstChild ?? code, 0);
    }
}
