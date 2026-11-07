import { INLINE_WRAPPER_SELECTOR, INLINE_WRAPPER_TAGS, LINE_OWNING_TAGS, ZERO_WIDTH, findAncestorByTag, setSelectionRange } from './rich-text-dom.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController, RichTextFormatCommand, RichTextInlineStyle } from './rich-text-host.js';
import { lineOf } from './rich-text-lines.js';
import { Disposables } from './rich-text-registry.js';
import type { RichTextCaretStyle, RichTextSelectionProvider } from './rich-text-selection.js';

const MENTION_SELECTOR = '[data-mention], [data-tag]';
const FORMAT_WRAPPER_SELECTOR = `${INLINE_WRAPPER_SELECTOR}, font`;
const MENTION_STYLE_PROPS = [
    'fontWeight', 'fontStyle', 'textDecoration', 'color', 'backgroundColor', 'fontSize', 'fontFamily',
] as const;

type MentionStyleProp = (typeof MENTION_STYLE_PROPS)[number];
type CaretTextPosition = { block: HTMLElement; offset: number };

const toggledOn = (on: string) => (current: string) => (current === on ? 'normal' : on);

const toggledDecoration = (decoration: string) => (current: string) =>
    current.includes(decoration) ? current.replace(decoration, '').trim() : `${current} ${decoration}`.trim();

function setMentionStyle(chips: readonly HTMLElement[], prop: MentionStyleProp, value: string): void {
    for (const chip of chips) chip.style[prop] = value;
}

function clearMentionStyles(chips: readonly HTMLElement[]): void {
    for (const chip of chips) {
        for (const prop of MENTION_STYLE_PROPS) chip.style[prop] = '';
    }
}

function cssPixels(size: string): string {
    return size.endsWith('px') ? size : `${size}px`;
}

function replaceWithSpan(font: HTMLElement, prop: 'fontSize' | 'fontFamily', value: string): HTMLElement {
    const span = font.ownerDocument.createElement('span');
    span.style[prop] = value;
    span.append(...font.childNodes);
    font.replaceWith(span);
    return span;
}

/** Lifts the text out of every formatting wrapper in the run; links and mention chips stay, minus their styles. */
function unwrapInlineFormatting(run: HTMLElement): void {
    const wrappers = [run, ...run.querySelectorAll<HTMLElement>(FORMAT_WRAPPER_SELECTOR)].reverse();
    for (const wrapper of wrappers) {
        if (wrapper.tagName === 'A' || wrapper.dataset['mention'] !== undefined) {
            wrapper.removeAttribute('style');
        } else {
            wrapper.replaceWith(...wrapper.childNodes);
        }
    }
}

/** The outermost inline wrapper between `node` and its line block, or null in plain text. */
function formattedRunAround(node: Node, root: HTMLElement): HTMLElement | null {
    let run: HTMLElement | null = null;
    let current = node instanceof HTMLElement ? node : node.parentElement;
    // A task row's span holds the row's text: it is the line, not formatting.
    const holder = lineOf(node, root)?.holder ?? null;
    while (current && current !== root && current !== holder && !LINE_OWNING_TAGS.has(current.tagName)) {
        if (INLINE_WRAPPER_TAGS.has(current.tagName) || current.tagName === 'FONT') run = current;
        current = current.parentElement;
    }
    return run;
}

/** The caret as a character offset inside its line block, which survives the block's inline nodes being rebuilt. */
function caretTextPosition(range: Range, root: HTMLElement): CaretTextPosition | null {
    let block = range.startContainer instanceof HTMLElement ? range.startContainer : range.startContainer.parentElement;
    while (block && block !== root && !LINE_OWNING_TAGS.has(block.tagName)) block = block.parentElement;
    if (!block || block === root) return null;
    const before = new Range();
    before.setStart(block, 0);
    before.setEnd(range.startContainer, range.startOffset);
    return { block, offset: before.toString().length };
}

function placeCaretAtTextPosition(selection: Selection, { block, offset }: CaretTextPosition): void {
    const walker = block.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let text = walker.nextNode() as Text | null;
    while (text && remaining > text.data.length) {
        remaining -= text.data.length;
        text = walker.nextNode() as Text | null;
    }
    if (text) setSelectionRange(selection, text, remaining);
    else setSelectionRange(selection, block, block.childNodes.length);
}

/** Replaces `element` with its own children, keeping that text selected. */
function unwrapElement(element: HTMLElement, selection: Selection): void {
    const parent = element.parentNode;
    if (!parent) return;
    const first = element.firstChild;
    const last = element.lastChild;
    element.replaceWith(...element.childNodes);
    parent.normalize();
    if (!first || !last) return;
    const restored = new Range();
    restored.setStartBefore(first);
    restored.setEndAfter(last);
    selection.removeAllRanges();
    selection.addRange(restored);
}

/** Bold, italic, underline, strikethrough, inline code and clear-formatting, plus colour, size and family at the selection. */
export class InlineFormatsController implements RichTextController {
    private readonly life = new Disposables();

    constructor(private readonly host: RichTextControllerHost) {}

    /** The selection controller owns the caret colour the browser holds as a typing style. */
    private get selection(): RichTextSelectionProvider | undefined {
        return this.host.provider('selection');
    }

    attach(): void {
        const { host, life } = this;
        const commands: [RichTextFormatCommand, () => void][] = [
            ['bold', () => this.execToggling('bold', 'fontWeight', toggledOn('bold'))],
            ['italic', () => this.execToggling('italic', 'fontStyle', toggledOn('italic'))],
            ['underline', () => this.execToggling('underline', 'textDecoration', toggledDecoration('underline'))],
            ['strikethrough', () => this.execToggling('strikeThrough', 'textDecoration', toggledDecoration('line-through'))],
            ['code', () => this.toggleInlineCode()],
            ['clear', () => this.clearFormatting()],
        ];
        for (const [name, run] of commands) {
            host.commandTable.set(name, run);
            life.add(() => {
                if (host.commandTable.get(name) === run) host.commandTable.delete(name);
            });
        }
        life.add(host.provide('inlineStyle', { apply: (style) => this.apply(style) }));
    }

    detach(): void {
        this.life.dispose();
    }

    private exec(command: string, value?: string): boolean {
        return this.host.doc.execCommand(command, false, value);
    }

    private liveRange(): Range | null {
        const selection = this.host.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        return range && this.host.contentRoot.contains(range.startContainer) ? range : null;
    }

    private allMentions(): HTMLElement[] {
        return Array.from(this.host.contentRoot.querySelectorAll<HTMLElement>(MENTION_SELECTOR));
    }

    /** Document-order positions of the chips in the selection; `execCommand` may rebuild nodes, so chips are re-found by position. */
    private selectedMentions(): number[] {
        const selection = this.host.getSelection();
        if (!selection || !this.liveRange()) return [];
        return this.allMentions().flatMap((chip, position) => (selection.containsNode(chip, true) ? [position] : []));
    }

    private mentionsAt(positions: readonly number[]): HTMLElement[] {
        const all = this.allMentions();
        return positions.flatMap((position) => all[position] ?? []);
    }

    /**
     * Runs a toggling command, then flips the same style on the chips it skips. The new value is decided before the
     * command, because the browser itself strips a chip's matching inline style when it turns the format off.
     */
    private execToggling(command: string, prop: MentionStyleProp, next: (current: string) => string): void {
        const positions = this.selectedMentions();
        const targets = this.mentionsAt(positions).map((chip) => next(chip.style[prop]));
        this.exec(command);
        this.mentionsAt(positions).forEach((chip, index) => {
            chip.style[prop] = targets[index] ?? '';
        });
    }

    /**
     * Wraps the selection in `<code>`, or unwraps it when the caret is already inside one. Wrapped text stays
     * selected so a second click unwraps; a collapsed caret goes inside the new element on a zero-width anchor,
     * since a browser will not place one in a truly empty element.
     */
    private toggleInlineCode(): void {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const existing = findAncestorByTag(range.startContainer, 'CODE', this.host.contentRoot);
        if (existing) {
            unwrapElement(existing, selection);
            return;
        }
        const collapsed = range.collapsed;
        const code = this.host.doc.createElement('code');
        code.append(range.extractContents());
        range.insertNode(code);
        const next = new Range();
        if (collapsed) {
            const anchor = this.host.doc.createTextNode(ZERO_WIDTH);
            code.append(anchor);
            next.setStart(anchor, anchor.data.length);
            next.collapse(true);
        } else {
            next.selectNodeContents(code);
        }
        selection.removeAllRanges();
        selection.addRange(next);
    }

    /**
     * Clears the selection, or with a collapsed caret the formatted run around it: `removeFormat` with nothing
     * selected is a no-op, and Chrome's command is unreliable at element boundaries, so the run is unwrapped by hand.
     */
    private clearFormatting(): void {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const positions = this.selectedMentions();
        const range = selection.getRangeAt(0);
        if (!range.collapsed) {
            this.exec('removeFormat');
            clearMentionStyles(this.mentionsAt(positions));
            return;
        }
        const root = this.host.contentRoot;
        const caret = caretTextPosition(range, root);
        const run = formattedRunAround(range.startContainer, root);
        if (!caret || !run) return;
        unwrapInlineFormatting(run);
        clearMentionStyles(this.mentionsAt(positions));
        placeCaretAtTextPosition(selection, caret);
    }

    private apply(style: RichTextInlineStyle): void {
        if (style.color !== undefined || style.backgroundColor !== undefined) {
            this.applyColor(style.color, style.backgroundColor);
        }
        if (style.fontSize !== undefined) this.applyFontSize(cssPixels(style.fontSize));
        if (style.fontFamily !== undefined) this.applyFontFamily(style.fontFamily);
    }

    /**
     * Applies a text colour and/or highlight. The order is load-bearing:
     * - both channels are re-issued together, because restoring the selection disarms a pending typing style;
     * - `styleWithCSS` is on so the browser emits inline styles (its `<font color>` is stripped by the sanitizer),
     *   and stays on while a caret holds a pending style, or the pending text colour is lost;
     * - `foreColor` and `hiliteColor` run back to back, since anything re-setting the selection disarms the first;
     * - the editor is deliberately not focused: the picker lives in an open popover, and stealing focus back would
     *   collapse the selection and leave the next pick with no target.
     */
    private applyColor(color: string | undefined, backgroundColor: string | undefined): void {
        if (!this.hasColorTarget()) return;
        const prior = this.selection?.pendingCaretStyle() ?? {};
        const intent: RichTextCaretStyle = { color: color ?? prior.color, backgroundColor: backgroundColor ?? prior.backgroundColor };
        this.host.flushPendingHistoryPush();
        this.restoreColorTarget();
        const positions = this.selectedMentions();

        this.exec('styleWithCSS', 'true');
        if (intent.color !== undefined) this.exec('foreColor', intent.color);
        if (intent.backgroundColor !== undefined && !this.exec('hiliteColor', intent.backgroundColor)) {
            this.exec('backColor', intent.backgroundColor);
        }
        if (this.liveRange()?.collapsed !== true) this.exec('styleWithCSS', 'false');
        const chips = this.mentionsAt(positions);
        if (color !== undefined) setMentionStyle(chips, 'color', color);
        if (backgroundColor !== undefined) setMentionStyle(chips, 'backgroundColor', backgroundColor);

        this.selection?.armCaretStyle(intent);
        this.host.commit({ focus: false });
    }

    /** A colour command with no target is a no-op, so an unplaced selection must not focus the editor or push an empty value. */
    private hasColorTarget(): boolean {
        return this.host.savedSelection !== null || this.liveRange() !== null;
    }

    /** Prefers a live non-collapsed range, which survives in the document while a picker holds focus. */
    private restoreColorTarget(): void {
        const selection = this.host.getSelection();
        const saved = this.host.savedSelection;
        if (!selection || !saved || (this.liveRange() && !selection.isCollapsed)) return;
        selection.removeAllRanges();
        selection.addRange(saved);
    }

    private applyFontSize(size: string): void {
        this.restyleFonts(() => this.exec('fontSize', '7'), 'size', 'fontSize', size);
    }

    private applyFontFamily(family: string): void {
        this.restyleFonts(() => this.exec('fontName', family), 'face', 'fontFamily', family);
    }

    /**
     * Runs a `fontSize`/`fontName` command, rewrites the `<font>` elements it produced into spans the sanitizer
     * keeps, and styles the mention chips the command skipped. The elements are the ones whose attribute the
     * command set or changed, since the browser normalises the value (it drops the quotes of a family name).
     * The text stays selected so a second pick from the still-open picker restyles it.
     */
    private restyleFonts(run: () => void, attr: 'size' | 'face', prop: 'fontSize' | 'fontFamily', value: string): void {
        const fonts = () => Array.from(this.host.contentRoot.querySelectorAll<HTMLElement>(`font[${attr}]`));
        this.host.flushPendingHistoryPush();
        this.host.restoreSelection();
        const positions = this.selectedMentions();
        const before = new Map(fonts().map((font) => [font, font.getAttribute(attr)]));
        run();
        const spans = fonts()
            .filter((font) => before.get(font) !== font.getAttribute(attr))
            .map((font) => replaceWithSpan(font, prop, value));
        setMentionStyle(this.mentionsAt(positions), prop, value);
        this.selection?.reSaveLiveSelection(spans);
        this.host.commit({ focus: false });
    }
}
