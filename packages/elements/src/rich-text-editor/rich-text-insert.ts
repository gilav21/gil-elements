import { graphemeLength } from '../shared/grapheme.js';
import { settleSplitList, splitListAfter, linesForRange } from './rich-text-blocks.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import { BLOCK_CONTAINER_TAGS, BLOCK_TAGS, placeCaretAtStartOfBlock } from './rich-text-dom.js';
import type { RichTextController } from './rich-text-host.js';
import { lineIsEmpty, structureAround, type Line } from './rich-text-lines.js';
import type { RichTextInsertProvider } from './rich-text-providers.js';
import { Disposables } from './rich-text-registry.js';

const ZERO_WIDTH = '​';
const KEYBOARD_GUARD_MS = 100;
const BLOCK_LANDING = 'td, th, p, li, summary';

function fragmentOf(doc: Document, markup: string): DocumentFragment {
    const template = doc.createElement('template');
    template.innerHTML = markup;
    return template.content;
}

/**
 * The block that must be split to give an incoming block the top level, or null when nothing needs
 * splitting. A cell or list item already holds blocks, so a paste inside one belongs where it is.
 */
function blockToSplit(start: Node, root: HTMLElement): HTMLElement | null {
    for (let node: Node | null = start; node && node !== root; node = node.parentNode) {
        if (!(node instanceof HTMLElement)) continue;
        if (BLOCK_CONTAINER_TAGS.has(node.tagName)) return null;
        if (BLOCK_TAGS.has(node.tagName)) return node;
    }
    return null;
}

/**
 * Moves `range` out of the block the caret sits in when `fragment` carries blocks of its own, so
 * "<p>one</p><p>two</p>" pasted at the end of a paragraph is not nested inside it. An inline-only
 * fragment is left alone, so a word pasted mid-sentence still lands mid-sentence.
 */
function escapeEnclosingBlock(range: Range, fragment: DocumentFragment, root: HTMLElement): void {
    if (!Array.from(fragment.children).some((node) => BLOCK_TAGS.has(node.tagName))) return;
    const block = blockToSplit(range.startContainer, root);
    const parent = block?.parentNode;
    if (!block || !parent) return;

    const tail = range.cloneRange();
    tail.setEndAfter(block);
    block.after(tail.extractContents());

    // The caret's place is decided BEFORE the shells go: read afterwards, a removed block gave -1 and the
    // caret jumped to the top of the parent instead of following the pasted content.
    const insertAt = Array.from(parent.childNodes).indexOf(block) + 1;
    let removedBefore = 0;
    for (const shell of [block, block.nextElementSibling]) {
        // A shell is left behind when the caret sat at the very start or end of the block.
        if (shell instanceof HTMLElement && !shell.textContent?.trim() && !shell.querySelector('img, br, input')) {
            if (shell === block) removedBefore++;
            shell.remove();
        }
    }
    range.setStart(parent, Math.max(0, insertAt - removedBefore));
    range.collapse(true);
}

/** Inserts text, HTML and blocks at the caret; the public `insertText`/`insertHtml` and every addon insert run through it. */
export class InsertController implements RichTextController {
    private readonly life = new Disposables();
    private priorInputMode: string | undefined;
    private cancelRelease: (() => void) | undefined;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const text = (value: string) => this.insertAtRestoredCaret(value, (root) => this.insertTextNode(root, value));
        const provider: RichTextInsertProvider = {
            text,
            html: (markup) => this.insertHtml(markup),
            textAtCaret: (value) => this.insertAtCaret(value, (root) => this.insertTextNode(root, value)),
            htmlAtCaret: (markup) => this.insertAtCaret(this.plainTextOf(markup), (root) => this.insertSanitized(root, this.host.sanitizer.sanitize(markup))),
            block: (markup) => this.insertBlock(markup),
            fromOverlay: text,
        };
        this.life.add(() => this.releaseKeyboard());
        this.life.add(this.host.provide('insert', provider));
    }

    detach(): void {
        this.life.dispose();
    }

    private get canEdit(): boolean {
        return !this.host.readonly && !this.host.isDisabled;
    }

    private plainTextOf(markup: string): string {
        // The sanitizer's inert parser, not a live element: unsanitized markup assigned to one starts image fetches.
        return this.host.sanitizer.stripTags(markup);
    }

    /** The live selection range, when it sits inside the editable. */
    private caret(): { selection: Selection; range: Range } | null {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        return this.host.contentRoot.contains(range.startContainer) ? { selection, range } : null;
    }

    private exceedsMaxLength(text: string): boolean {
        return graphemeLength(text) > this.host.remainingLength();
    }

    /** Whether `text` added beside the document, replacing nothing, would pass the limit. */
    private exceedsMaxLengthBeside(text: string): boolean {
        const max = this.host.config.maxLength;
        if (!max) return false;
        const shown = (this.host.contentRoot.textContent ?? '').replaceAll(ZERO_WIDTH, '');
        return graphemeLength(shown) + graphemeLength(text) > max;
    }

    /**
     * Runs `insert` at the caret the user last had in the editor, as one history entry: the click that
     * triggered it already moved focus away. A pending typing burst is flushed as its own entry first.
     * The limit is measured once the caret is restored, against what the insert will replace; measured
     * before, a selection elsewhere on the page was counted as freed.
     */
    private insertAtRestoredCaret(plainText: string, insert: (root: HTMLElement) => void): void {
        if (!this.canEdit) return;
        this.holdKeyboardBack();
        this.host.restoreSelection();
        this.host.contentRoot.focus();
        if (this.exceedsMaxLength(plainText)) {
            this.releaseKeyboard();
            return;
        }
        this.host.flushPendingHistoryPush();
        this.host.mutateContent(insert);
        // Saved afterwards so consecutive inserts append instead of stacking at the same spot.
        this.host.saveSelection();
    }

    /** At the live caret, for addons that already hold the editor's selection. */
    private insertAtCaret(plainText: string, insert: (root: HTMLElement) => void): void {
        if (!this.canEdit || this.exceedsMaxLength(plainText)) return;
        this.host.flushPendingHistoryPush();
        this.host.mutateContent(insert);
    }

    /** Pins `inputMode` to none while focus returns, so the mobile keyboard does not flash open. */
    private holdKeyboardBack(): void {
        const root = this.host.contentRoot;
        this.priorInputMode ??= root.inputMode;
        root.inputMode = 'none';
        this.cancelRelease?.();
        this.cancelRelease = this.life.timeout(() => this.releaseKeyboard(), KEYBOARD_GUARD_MS);
    }

    private releaseKeyboard(): void {
        if (this.priorInputMode === undefined) return;
        this.host.contentRoot.inputMode = this.priorInputMode;
        this.priorInputMode = undefined;
    }

    private insertTextNode(root: HTMLElement, text: string): void {
        const node = this.host.doc.createTextNode(text);
        const caret = this.caret();
        if (!caret) {
            root.append(node);
            return;
        }
        caret.range.deleteContents();
        caret.range.insertNode(node);
        this.collapseAfter(caret.selection, node);
    }

    private collapseAfter(selection: Selection, node: Node): void {
        const range = new Range();
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    private insertHtml(markup: string): void {
        if (!this.canEdit) return;
        // One sanitize pass both decides whether anything survives and supplies what is inserted.
        const sanitized = this.host.sanitizer.sanitize(markup);
        if (sanitized === '') return;
        this.insertAtRestoredCaret(this.plainTextOf(sanitized), (root) => this.insertSanitized(root, sanitized));
    }

    private insertSanitized(root: HTMLElement, sanitized: string): void {
        const caret = this.caret();
        if (!caret) {
            root.insertAdjacentHTML('beforeend', sanitized);
            this.host.labelBlockedImages();
            return;
        }
        const { selection, range } = caret;
        range.deleteContents();
        const fragment = fragmentOf(this.host.doc, sanitized);
        const last = fragment.lastChild;
        escapeEnclosingBlock(range, fragment, root);
        range.insertNode(fragment);
        if (last) this.collapseAfter(selection, last);
        this.host.labelBlockedImages();
    }

    private insertBlock(markup: string): void {
        if (!this.canEdit) return;
        const sanitized = this.host.sanitizer.sanitize(markup);
        if (this.exceedsMaxLengthBeside(this.plainTextOf(sanitized))) return;
        this.host.flushPendingHistoryPush();
        this.host.mutateContent((root) => {
            const fragment = fragmentOf(this.host.doc, sanitized);
            const landing = fragment.querySelector<HTMLElement>(BLOCK_LANDING);
            const caret = this.caret();
            const line = caret ? linesForRange(caret.range, root)[0] : undefined;
            if (line) this.placeBlock(fragment, line, root);
            else root.append(fragment);
            const selection = this.host.getSelection();
            if (landing && selection) placeCaretAtStartOfBlock(selection, landing);
            this.host.labelBlockedImages();
        });
    }

    /**
     * Puts an inserted block at the caret's line, somewhere a save keeps it: beside a line that stands on
     * its own (in its place when the author cleared it), between the halves of a list split after the top
     * item, and after the table or at the start of the details body for a cell or summary. Inside an item
     * or a cell the block would have no markdown form, and in a task row the next keypress moved it into the text.
     */
    private placeBlock(fragment: DocumentFragment, line: Line, root: HTMLElement): void {
        const outer = structureAround(line, root).at(-1);
        if (!outer) {
            const empty = lineIsEmpty(line);
            line.owner.parentNode?.insertBefore(fragment, empty ? line.owner : line.owner.nextSibling);
            if (empty) line.owner.remove();
            return;
        }
        if (outer.nodeName !== 'LI') {
            outer.after(fragment);
            return;
        }
        const list = outer.parentElement;
        if (!list) return;
        const tail = splitListAfter(outer);
        list.after(fragment);
        // An empty item the caret sat in is the place the author cleared for it.
        if (line.owner === outer && lineIsEmpty(line) && !outer.querySelector(':scope > ul, :scope > ol')) outer.remove();
        settleSplitList(list, tail);
    }
}
