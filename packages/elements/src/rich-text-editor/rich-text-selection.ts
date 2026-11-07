import { caretTakesTextStyle } from './rich-text-blocks.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController, RichTextSelectionInlineStyle } from './rich-text-host.js';
import { Disposables } from './rich-text-registry.js';

/** Colours chosen at a collapsed caret that the browser holds as a pending typing style. */
export interface RichTextCaretStyle {
    readonly color?: string;
    readonly backgroundColor?: string;
}

/** What the selection controller offers the rest of the editor; supplied through `provide('selection', ...)`. */
export interface RichTextSelectionProvider {
    /** The inline style at the caret as raw computed values. */
    readonly inlineStyle: RichTextSelectionInlineStyle;
    /** Whether the text-style select can change the caret's line. */
    readonly textStyleAvailable: boolean;
    /** The text selected inside the editor; '' for a selection elsewhere on the page. */
    selectedTextInEditor(): string;
    /** The colours the next typed character takes at the current caret, if one was armed there. */
    pendingCaretStyle(): RichTextCaretStyle;
    /** Records the colours just applied; they stay pending only while the caret is collapsed where it is now. */
    armCaretStyle(style: RichTextCaretStyle): void;
    /**
     * Keeps the selection usable after a command replaced its nodes: selects across `spans`, or saves
     * the live range when it is still inside the editor.
     */
    reSaveLiveSelection(spans?: readonly HTMLElement[]): void;
}

const COMMAND_FORMATS: readonly (readonly [string, string])[] = [
    ['bold', 'bold'],
    ['italic', 'italic'],
    ['underline', 'underline'],
    ['strikethrough', 'strikeThrough'],
    ['bulletList', 'insertUnorderedList'],
    ['orderedList', 'insertOrderedList'],
];

const BLOCK_FORMAT_TAGS: ReadonlyMap<string, string> = new Map([
    ['H1', 'heading1'],
    ['H2', 'heading2'],
    ['H3', 'heading3'],
    ['BLOCKQUOTE', 'blockquote'],
    ['PRE', 'codeBlock'],
]);

/** Blocks that mean the caret is not in a plain paragraph, even when a `P` or `DIV` wraps it. */
const NON_PARAGRAPH_TAGS: ReadonlySet<string> = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'LI', 'TD', 'TH', 'SUMMARY',
]);

const ALIGNMENT_BLOCK_TAGS: ReadonlySet<string> = new Set([...NON_PARAGRAPH_TAGS, 'P', 'DIV']);

const LOGICAL_ALIGNMENT: ReadonlyMap<string, string> = new Map([
    ['center', 'alignCenter'],
    ['start', 'alignLeft'],
    ['end', 'alignRight'],
]);

const BOLD_WEIGHT = /^(bold|[6-9]\d\d)$/;
const EMPTY_STYLE: RichTextSelectionInlineStyle = { color: '', backgroundColor: '', fontSize: '', fontFamily: '' };

/** `left` and `right` are physical, so an RTL locale presses the opposite, already mirrored, item. */
function alignmentFormat(textAlign: string, rtl: boolean): string | undefined {
    if (textAlign === 'left' || textAlign === 'right') return (textAlign === 'left') === rtl ? 'alignRight' : 'alignLeft';
    return LOGICAL_ALIGNMENT.get(textAlign);
}

function addElementFormats(node: HTMLElement, root: Node, formats: Set<string>): void {
    const tag = node.tagName;
    const blockFormat = BLOCK_FORMAT_TAGS.get(tag);
    if (blockFormat) formats.add(blockFormat);
    if (tag === 'UL' && node.dataset['taskList'] !== undefined) formats.add('taskList');
    if (tag === 'LI' && listDepth(node, root) >= 2) formats.add('indent');
}

function listDepth(item: Element, root: Node): number {
    let depth = 0;
    for (let node: Node | null = item; node && node !== root; node = node.parentNode) {
        if (node.nodeName === 'UL' || node.nodeName === 'OL') depth++;
    }
    return depth;
}

function sameStyle(a: RichTextSelectionInlineStyle, b: RichTextSelectionInlineStyle): boolean {
    return a.color === b.color && a.backgroundColor === b.backgroundColor && a.fontSize === b.fontSize && a.fontFamily === b.fontFamily;
}

/**
 * Detects what is active at the caret on every selection move: the formats the toolbar presses,
 * whether the text-style select applies, and the inline typography and colours. It also tracks a
 * colour armed at a collapsed caret, which the DOM cannot show until the next character is typed.
 */
export class SelectionController implements RichTextController, RichTextSelectionProvider {
    private readonly life = new Disposables();
    private caretStyle: (RichTextCaretStyle & { node: Node; offset: number }) | null = null;
    private style = EMPTY_STYLE;
    private available = true;

    constructor(private readonly host: RichTextControllerHost) {}

    get inlineStyle(): RichTextSelectionInlineStyle {
        return this.style;
    }

    get textStyleAvailable(): boolean {
        return this.available;
    }

    attach(): void {
        this.life.add(this.host.provide('selection', this));
        this.life.add(this.host.onSelectionMoved(() => this.onSelectionMoved()));
    }

    detach(): void {
        this.life.dispose();
        this.caretStyle = null;
    }

    selectedTextInEditor(): string {
        const selection = this.host.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';
        return this.host.contentRoot.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.toString() : '';
    }

    pendingCaretStyle(): RichTextCaretStyle {
        const anchor = this.caretStyle;
        const caret = this.collapsedCaret();
        if (!anchor || caret?.node !== anchor.node || caret.offset !== anchor.offset) return {};
        return { color: anchor.color, backgroundColor: anchor.backgroundColor };
    }

    armCaretStyle(style: RichTextCaretStyle): void {
        const caret = this.collapsedCaret();
        this.caretStyle = caret ? { ...caret, ...style } : null;
    }

    reSaveLiveSelection(spans?: readonly HTMLElement[]): void {
        const selection = this.host.getSelection();
        const first = spans?.[0];
        const last = spans?.at(-1);
        if (!selection) return;
        if (first && last) {
            // `execCommand` replaced the styled run with new nodes, so the live range points at detached ones.
            const range = new Range();
            range.setStartBefore(first);
            range.setEndAfter(last);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        this.host.saveSelection();
    }

    private onSelectionMoved(): void {
        this.refresh();
        this.releaseCaretStyle();
    }

    private refresh(): void {
        const formats = this.detectFormats();
        // A task list is a <ul> to the browser; only its own button reads pressed.
        if (formats.has('taskList')) formats.delete('bulletList');
        this.host.setActiveFormats(formats);
        const available = caretTakesTextStyle(this.host.getSelection(), this.host.contentRoot);
        const style = this.detectInlineStyle();
        if (available === this.available && sameStyle(style, this.style)) return;
        this.available = available;
        this.style = style;
        this.host.invalidate();
    }

    private detectFormats(): Set<string> {
        const formats = new Set<string>();
        for (const [format, command] of COMMAND_FORMATS) {
            if (this.host.doc.queryCommandState(command) && !(format === 'bold' && this.boldOnlyFromHeading())) formats.add(format);
        }
        this.detectBlockFormats(formats);
        return formats;
    }

    /** The browser reads bold from the computed weight, so a heading would light Bold with nothing to turn off. */
    private boldOnlyFromHeading(): boolean {
        const start = this.rangeInEditor()?.startContainer;
        for (let node = start ?? null; node && node !== this.host.contentRoot; node = node.parentNode) {
            if (!(node instanceof HTMLElement)) continue;
            if (node.tagName === 'B' || node.tagName === 'STRONG' || BOLD_WEIGHT.test(node.style.fontWeight)) return false;
            if (/^H[1-6]$/.test(node.tagName)) return true;
        }
        return false;
    }

    /** One walk from the caret to the root collects block type, inline code, task list, nesting and alignment. */
    private detectBlockFormats(formats: Set<string>): void {
        const root = this.host.contentRoot;
        const start = this.rangeInEditor()?.startContainer;
        if (!start) return;
        let alignBlock: HTMLElement | null = null;
        let code = false;
        let pre = false;
        let nonParagraph = false;
        for (let node = start.nodeType === Node.TEXT_NODE ? start.parentNode : start; node && node !== root; node = node.parentNode) {
            if (!(node instanceof HTMLElement)) continue;
            const tag = node.tagName;
            if (ALIGNMENT_BLOCK_TAGS.has(tag)) alignBlock ??= node;
            code ||= tag === 'CODE';
            pre ||= tag === 'PRE';
            nonParagraph ||= NON_PARAGRAPH_TAGS.has(tag);
            addElementFormats(node, root, formats);
        }
        // A `CODE` is inline code only when no `PRE` was passed on the way up.
        if (code && !pre) formats.add('code');
        if (!nonParagraph) formats.add('paragraph');
        const textAlign = alignBlock?.style.textAlign || alignBlock?.getAttribute('align') || '';
        const alignment = alignmentFormat(textAlign, this.host.isRtl);
        if (alignment) formats.add(alignment);
    }

    /** Keeps the last in-editor style when the selection sits in an overlay the editor owns (a colour popover, say). */
    private detectInlineStyle(): RichTextSelectionInlineStyle {
        const element = this.selectedElement();
        if (!element) return this.style;
        const computed = this.host.doc.defaultView?.getComputedStyle(element);
        if (!computed) return this.style;
        const size = Number.parseInt(computed.fontSize, 10);
        const family = computed.fontFamily.split(',')[0]?.trim().replaceAll(/^["']|["']$/g, '');
        const pending = this.pendingCaretStyle();
        return {
            color: pending.color || computed.color,
            backgroundColor: pending.backgroundColor || computed.backgroundColor,
            fontSize: Number.isNaN(size) ? this.style.fontSize : String(size),
            fontFamily: family || this.style.fontFamily,
        };
    }

    /** Drops a pending colour once the caret has left it and restores the default `styleWithCSS`. */
    private releaseCaretStyle(): void {
        const anchor = this.caretStyle;
        if (!anchor) return;
        const caret = this.collapsedCaret();
        if (caret?.node === anchor.node && caret.offset === anchor.offset) return;
        this.caretStyle = null;
        this.host.doc.execCommand('styleWithCSS', false, 'false');
    }

    private rangeInEditor(): Range | null {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        return this.host.contentRoot.contains(range.startContainer) ? range : null;
    }

    private selectedElement(): HTMLElement | null {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        let node: Node = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement ?? node;
        return this.host.contentRoot.contains(node) && node instanceof HTMLElement ? node : null;
    }

    /** The collapsed caret inside the editor, or null for a span or a selection elsewhere. */
    private collapsedCaret(): { node: Node; offset: number } | null {
        const selection = this.host.getSelection();
        const node = selection?.anchorNode;
        if (!selection?.isCollapsed || !node || !this.host.contentRoot.contains(node)) return null;
        return { node, offset: selection.anchorOffset };
    }
}
