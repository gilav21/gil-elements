import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { RichTextControllerHost, RichTextRenderingController } from './rich-text-controllers.js';
import { INLINE_WRAPPER_SELECTOR, INLINE_WRAPPER_TAGS } from './rich-text-dom.js';
import {
    buildFindIndex,
    compileFindRegex,
    offsetToPosition,
    type FindIndex,
    type FindOptions,
} from './rich-text-find.utils.js';
import { Disposables } from './rich-text-registry.js';
import css from './rich-text-find.css?inline';

/** Most match rectangles painted at once; the current match always is. */
export const FIND_MAX_PAINTED_RECTS = 500;
const FIND_MAX_MATCHES = 10_000;
const VOID_CONTENT_SELECTOR = 'img, br, hr, input';

interface PaintedRect {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
    readonly current: boolean;
}

/**
 * Find & replace: a panel over the editor and a layer of highlight rectangles drawn from the match
 * ranges, so nothing about the search ever enters the content, the form value or the history.
 */
export class FindController implements RichTextRenderingController {
    query = '';
    replacement = '';
    caseSensitive = false;
    wholeWord = false;
    useRegex = false;
    regexError = false;
    matches: Range[] = [];
    currentIndex = -1;

    private readonly life = new Disposables();
    private readonly sheet = new CSSStyleSheet();
    /** Scroll/resize listeners and pending frames; alive only while the panel is open. */
    private readonly panelLife = new Disposables();
    private visible = false;
    private showReplace = false;
    private rects: PaintedRect[] = [];
    private cancelSearch: (() => void) | null = null;
    private repaintFrame: number | null = null;

    constructor(private readonly host: RichTextControllerHost) {
        this.sheet.replaceSync(css);
    }

    attach(): void {
        const root = this.host.element.shadowRoot;
        if (root) {
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.sheet];
            this.life.add(() => {
                root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== this.sheet);
            });
        }
        this.life.add(this.host.provide('find', this));
        this.life.add(this.host.registerShortcutAction('rich-text.find', () => this.open(false)));
        this.life.add(this.host.registerShortcutAction('rich-text.find-replace', () => this.open(true), () => this.canEdit));
        this.life.add(this.host.subscribe('content', this.onContentChange));
        this.life.listen(this.host.element, 'find-toggle', () => this.toggle());
        this.life.add(() => this.panelLife.dispose());
    }

    detach(): void {
        this.life.dispose();
    }

    isOpen(): boolean {
        return this.visible;
    }

    private get canEdit(): boolean {
        return !this.host.readonly && !this.host.isDisabled;
    }

    get showsReplaceRow(): boolean {
        return this.showReplace && this.canEdit;
    }

    /** The localized counter: `{current} of {total}`, the no-results string, the invalid-expression string, or empty. */
    get counterText(): string {
        const locale = this.host.resolvedLocale.findReplace;
        if (!this.query) return '';
        if (this.regexError) return locale.invalidRegex;
        if (this.matches.length === 0) return locale.noResults;
        return locale.matchCounter
            .replace('{current}', String(this.currentIndex + 1))
            .replace('{total}', String(this.matches.length));
    }

    /**
     * Shows the panel. A non-empty single-line selection seeds the query and is searched at once,
     * ignoring the debounce; a collapsed one leaves the previous query alone. Find works in a
     * readonly editor, replace is never offered there.
     */
    open(showReplace = this.canEdit): void {
        this.showReplace = showReplace;
        const seed = this.host.selection().text.trim();
        if (!this.visible) this.watchLayout();
        this.visible = true;
        if (seed && !seed.includes('\n')) {
            this.query = seed;
            this.search(false);
        }
        this.host.invalidate();
        const frame = requestAnimationFrame(() => this.queryInput()?.focus());
        this.panelLife.add(() => cancelAnimationFrame(frame));
    }

    /**
     * Hides the panel and forgets the query, replacement and matches, leaving the match the user was on
     * selected in the focused editable. The three search toggles are kept.
     */
    close(): void {
        if (!this.visible) return;
        const current = this.matches[this.currentIndex]?.cloneRange();
        this.cancelSearch?.();
        this.panelLife.dispose();
        this.visible = false;
        this.query = '';
        this.replacement = '';
        this.matches = [];
        this.currentIndex = -1;
        this.regexError = false;
        this.rects = [];
        this.host.invalidate();
        this.host.contentRoot.focus();
        if (!current) return;
        const selection = this.host.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(current);
    }

    toggle(): void {
        if (this.visible) this.close();
        else this.open();
    }

    setQuery(query: string): void {
        this.query = query;
        this.scheduleSearch(false);
    }

    setReplacement(replacement: string): void {
        this.replacement = replacement;
    }

    toggleCaseSensitive(): void {
        this.caseSensitive = !this.caseSensitive;
        this.search(false);
    }

    toggleWholeWord(): void {
        this.wholeWord = !this.wholeWord;
        this.search(false);
    }

    toggleRegex(): void {
        this.useRegex = !this.useRegex;
        this.search(false);
    }

    findNext(): void {
        this.step(1);
    }

    findPrevious(): void {
        this.step(-1);
    }

    /** Replaces the current match, then searches again keeping the index so the next call moves on. */
    replaceSingle(): void {
        const range = this.matches[this.currentIndex];
        if (!this.canEdit || !range) return;
        this.replaceRanges([range], this.replacerForQuery());
    }

    /** Replaces every match as one history step; a pending typing burst is recorded as its own entry first. */
    replaceAll(): void {
        if (!this.canEdit || this.matches.length === 0) return;
        this.replaceRanges([...this.matches].reverse(), this.replacerForQuery());
    }

    renderOverlay(): TemplateResult | null {
        if (!this.visible) return null;
        return html`${this.renderRects()}${this.renderPanel()}`;
    }

    private renderRects(): TemplateResult | typeof nothing {
        if (this.rects.length === 0) return nothing;
        return html`<div class="find-overlay" data-slot="rich-text-find-overlay" aria-hidden="true">
            ${this.rects.map((rect) => html`<div
                data-find-rect
                ?data-find-current=${rect.current}
                style=${styleMap({
                    left: `${rect.left}px`,
                    top: `${rect.top}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                })}
            ></div>`)}
        </div>`;
    }

    private renderPanel(): TemplateResult {
        const locale = this.host.resolvedLocale.findReplace;
        const none = this.matches.length === 0;
        const toggleButton = (label: string, glyph: string, pressed: boolean, onClick: () => void) => html`
            <button type="button" aria-pressed=${pressed} aria-label=${label} title=${label} @click=${onClick}>${glyph}</button>`;
        const iconButton = (label: string, glyph: string, onClick: () => void, disabled = false) => html`
            <button type="button" aria-label=${label} title=${label} ?disabled=${disabled} @click=${onClick}>${glyph}</button>`;
        return html`<div class="find-panel" data-slot="rich-text-find-panel" tabindex="-1" @keydown=${this.onPanelKeydown}>
            <div class="find-row">
                <input
                    data-slot="rich-text-find-query"
                    type="text"
                    placeholder=${locale.findPlaceholder}
                    aria-label=${locale.find}
                    aria-invalid=${this.regexError ? 'true' : nothing}
                    .value=${this.query}
                    @input=${(event: Event) => this.setQuery(inputValue(event))}
                />
                ${toggleButton(locale.caseSensitive, 'Aa', this.caseSensitive, () => this.toggleCaseSensitive())}
                ${toggleButton(locale.wholeWord, 'ab', this.wholeWord, () => this.toggleWholeWord())}
                ${toggleButton(locale.useRegex, '.*', this.useRegex, () => this.toggleRegex())}
            </div>
            <div class="find-row" data-spread>
                <span class="find-counter" data-slot="rich-text-find-counter" aria-live="polite">${this.counterText}</span>
                <div class="find-nav">
                    ${iconButton(locale.previous, '▲', () => this.findPrevious(), none)}
                    ${iconButton(locale.next, '▼', () => this.findNext(), none)}
                    ${iconButton(locale.close, '✕', () => this.close())}
                </div>
            </div>
            ${this.showsReplaceRow
                ? html`<div class="find-row">
                    <input
                        data-slot="rich-text-find-replace"
                        type="text"
                        placeholder=${locale.replacePlaceholder}
                        aria-label=${locale.replace}
                        .value=${this.replacement}
                        @input=${(event: Event) => this.setReplacement(inputValue(event))}
                    />
                    <button type="button" data-text ?disabled=${none} @click=${() => this.replaceSingle()}>${locale.replace}</button>
                    <button type="button" data-text ?disabled=${none} @click=${() => this.replaceAll()}>${locale.replaceAll}</button>
                </div>`
                : nothing}
        </div>`;
    }

    /** Escape closes; Enter steps through matches, replaces from the replace field, and replaces all with Mod+Alt. */
    private readonly onPanelKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
            this.close();
            return;
        }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (event.altKey && (event.ctrlKey || event.metaKey)) this.replaceAll();
        else if (event.target instanceof HTMLElement && event.target.dataset['slot'] === 'rich-text-find-replace') this.replaceSingle();
        else if (event.shiftKey) this.findPrevious();
        else this.findNext();
    };

    private readonly onContentChange = (): void => {
        if (this.visible && this.query) this.scheduleSearch(true);
    };

    private queryInput(): HTMLInputElement | null {
        return this.host.element.shadowRoot?.querySelector<HTMLInputElement>('[data-slot="rich-text-find-query"]') ?? null;
    }

    private scheduleSearch(preserveIndex: boolean): void {
        this.cancelSearch?.();
        const delay = this.host.config.findDebounceMs;
        if (delay <= 0) {
            this.search(preserveIndex);
            return;
        }
        this.cancelSearch = this.life.timeout(() => this.search(preserveIndex), delay);
    }

    private search(preserveIndex: boolean): void {
        this.cancelSearch?.();
        this.cancelSearch = null;
        const regex = this.query ? compileFindRegex(this.query, this.options()) : null;
        this.regexError = this.query !== '' && !regex;
        const matches = regex ? this.collectMatches(buildFindIndex(this.host.contentRoot), regex) : [];
        this.matches = matches;
        if (matches.length === 0) this.currentIndex = -1;
        else this.currentIndex = preserveIndex ? Math.min(Math.max(this.currentIndex, 0), matches.length - 1) : 0;
        this.paint();
        this.scrollToCurrentMatch();
    }

    private options(useRegex = this.useRegex): FindOptions {
        return { caseSensitive: this.caseSensitive, wholeWord: this.wholeWord, useRegex };
    }

    /** Walks the regex over the flattened text; zero-length matches advance by a whole code point so `a*` terminates. */
    private collectMatches(index: FindIndex, regex: RegExp): Range[] {
        const matches: Range[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(index.text)) !== null && matches.length < FIND_MAX_MATCHES) {
            if (match[0].length === 0) {
                const codePoint = index.text.codePointAt(regex.lastIndex);
                regex.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
                continue;
            }
            const range = this.rangeForMatch(index, match.index, match.index + match[0].length);
            if (range) matches.push(range);
        }
        return matches;
    }

    private rangeForMatch(index: FindIndex, start: number, end: number): Range | null {
        const from = offsetToPosition(index.segments, start);
        const to = offsetToPosition(index.segments, end, true);
        if (!from || !to) return null;
        const range = this.host.doc.createRange();
        range.setStart(from.node, from.offset);
        range.setEnd(to.node, to.offset);
        return range;
    }

    private step(direction: 1 | -1): void {
        const total = this.matches.length;
        if (total === 0) return;
        this.currentIndex = (this.currentIndex + direction + total) % total;
        this.paint();
        this.scrollToCurrentMatch();
    }

    /** Rectangles for the visible matches. Geometry forces layout, so only rectangles that will be drawn are requested. */
    private paint(): void {
        const base = this.host.overlayAnchor.getBoundingClientRect();
        const painted: PaintedRect[] = [];
        for (const [i, range] of this.matches.entries()) {
            const current = i === this.currentIndex;
            if (!current && painted.length >= FIND_MAX_PAINTED_RECTS) continue;
            for (const rect of range.getClientRects()) {
                painted.push({ left: rect.left - base.left, top: rect.top - base.top, width: rect.width, height: rect.height, current });
            }
        }
        this.rects = painted;
        this.host.invalidate();
    }

    /** Scrolls the editable itself, not the page, to bring the current match into view. */
    private scrollToCurrentMatch(): void {
        const range = this.matches[this.currentIndex];
        if (!range) return;
        const editable = this.host.contentRoot;
        const rect = range.getBoundingClientRect();
        const view = editable.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) return;
        if (rect.top < view.top) editable.scrollTop += rect.top - view.top;
        else if (rect.bottom > view.bottom) editable.scrollTop += rect.bottom - view.bottom;
    }

    /** Keeps the rectangles on the text as the editable scrolls or resizes. */
    private watchLayout(): void {
        const editable = this.host.contentRoot;
        const repaint = (): void => {
            if (this.repaintFrame !== null) return;
            this.repaintFrame = requestAnimationFrame(() => {
                this.repaintFrame = null;
                this.paint();
            });
        };
        this.panelLife.listen(editable, 'scroll', repaint, { passive: true });
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(repaint);
            observer.observe(editable);
            this.panelLife.add(() => observer.disconnect());
        }
        this.panelLife.add(() => {
            if (this.repaintFrame !== null) cancelAnimationFrame(this.repaintFrame);
            this.repaintFrame = null;
        });
    }

    /** Turns one matched string into its replacement; in regex mode capture groups expand through `String.replace`. */
    private replacerForQuery(): (matched: string) => string {
        const replacement = this.replacement;
        if (!this.useRegex) return () => replacement;
        const regex = compileFindRegex(this.query, this.options(true));
        if (!regex) return () => replacement;
        const single = new RegExp(regex.source, regex.flags.replace('g', ''));
        return (matched) => matched.replace(single, replacement);
    }

    private replaceRanges(ranges: readonly Range[], replacer: (matched: string) => string): void {
        this.host.flushPendingHistoryPush();
        this.host.mutateContent(() => {
            for (const range of ranges) this.replaceRange(range, replacer(range.toString()));
        });
        this.search(true);
    }

    /**
     * Swaps a range's contents for `text` at its start, keeping the formatting around it; inline
     * wrappers the deletion emptied are removed, nothing else is.
     */
    private replaceRange(range: Range, text: string): void {
        const candidates = this.inlineWrappersTouchedBy(range);
        range.deleteContents();
        if (text) range.insertNode(this.host.doc.createTextNode(text));
        for (const el of candidates) {
            if (el.isConnected && el.textContent === '' && !el.querySelector(VOID_CONTENT_SELECTOR)) el.remove();
        }
    }

    /** The inline wrappers a range starts in, ends in or overlaps, walked up from each boundary to the first block. */
    private inlineWrappersTouchedBy(range: Range): Set<Element> {
        const root = this.host.contentRoot;
        const candidates = new Set<Element>();
        // A task item's text span is the caret target the editor made; emptied, it must stay.
        const isStructural = (el: Element): boolean => el.tagName === 'SPAN' && el.parentElement?.matches('li[data-task]') === true;
        const climb = (from: Node): void => {
            for (let node: Node | null = from; node && node !== root; node = node.parentNode) {
                if (!(node instanceof Element)) continue;
                if (!INLINE_WRAPPER_TAGS.has(node.tagName)) break;
                if (!isStructural(node)) candidates.add(node);
            }
        };
        climb(range.startContainer);
        climb(range.endContainer);
        const ancestor = range.commonAncestorContainer;
        if (ancestor instanceof Element) {
            for (const el of ancestor.querySelectorAll(INLINE_WRAPPER_SELECTOR)) {
                if (range.intersectsNode(el) && !isStructural(el)) candidates.add(el);
            }
        }
        return candidates;
    }
}

function inputValue(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
}
