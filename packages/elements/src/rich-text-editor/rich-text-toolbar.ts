import { html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { UiElement } from '@gilav21/elements-base';
import { isRichTextFormatCommand, type RichTextToolbarSlot } from './rich-text-host.js';
import { RICH_TEXT_LOCALES, type RichTextLocale } from './rich-text-locales.js';
import { SlotRegistry } from './rich-text-registry.js';
import css from './rich-text-toolbar.css?inline';

export type ToolbarItem =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'textStyle'
    | 'paragraph'
    | 'heading1'
    | 'heading2'
    | 'heading3'
    | 'bulletList'
    | 'orderedList'
    | 'blockquote'
    | 'code'
    | 'codeBlock'
    | 'separator'
    | 'undo'
    | 'redo'
    | 'clear'
    | 'alignLeft'
    | 'alignCenter'
    | 'alignRight'
    | 'indent'
    | 'outdent'
    | 'taskList'
    | 'horizontalRule'
    | 'find';

/** Every item that renders a button: all but the visual `'separator'` and the `'textStyle'` select. */
export type ToolbarButtonItem = Exclude<ToolbarItem, 'separator' | 'textStyle'>;

/** The format names active at the caret, under the same ids as the toggle items (`bold`, `heading2`, `alignCenter`...). */
export type RichTextActiveFormats = ReadonlySet<string>;

export interface ToolbarButton {
    /** Key into {@link RichTextLocale.toolbar}. */
    readonly localeKey: keyof RichTextLocale['toolbar'];
    /** Inside of a 24x24 stroked `<svg>`. */
    readonly icon: string;
    /** Appended to the tooltip in parentheses. */
    readonly shortcut?: string;
}

const HEADING_MARK = '<path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/>';

export const TOOLBAR_BUTTONS: Record<ToolbarButtonItem, ToolbarButton> = {
    bold: { localeKey: 'bold', shortcut: 'Ctrl+B', icon: '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>' },
    italic: { localeKey: 'italic', shortcut: 'Ctrl+I', icon: '<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>' },
    underline: { localeKey: 'underline', shortcut: 'Ctrl+U', icon: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>' },
    strikethrough: { localeKey: 'strikethrough', icon: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>' },
    paragraph: { localeKey: 'paragraph', icon: '<path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>' },
    heading1: { localeKey: 'heading1', icon: `${HEADING_MARK}<path d="m17 12 3-2v8"/>` },
    heading2: { localeKey: 'heading2', icon: `${HEADING_MARK}<path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/>` },
    heading3: { localeKey: 'heading3', icon: `${HEADING_MARK}<path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/>` },
    bulletList: { localeKey: 'bulletList', icon: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>' },
    orderedList: { localeKey: 'orderedList', icon: '<line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>' },
    blockquote: { localeKey: 'blockquote', icon: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"/>' },
    code: { localeKey: 'inlineCode', icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' },
    codeBlock: { localeKey: 'codeBlock', icon: '<path d="M10 9.5 8 12l2 2.5"/><path d="m14 9.5 2 2.5-2 2.5"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>' },
    undo: { localeKey: 'undo', shortcut: 'Ctrl+Z', icon: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>' },
    redo: { localeKey: 'redo', shortcut: 'Ctrl+Shift+Z', icon: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>' },
    clear: { localeKey: 'clearFormatting', icon: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>' },
    alignLeft: { localeKey: 'alignLeft', icon: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>' },
    alignCenter: { localeKey: 'alignCenter', icon: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/>' },
    alignRight: { localeKey: 'alignRight', icon: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/>' },
    indent: { localeKey: 'indent', icon: '<polyline points="3 8 7 12 3 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/>' },
    outdent: { localeKey: 'outdent', icon: '<polyline points="7 8 3 12 7 16"/><line x1="21" x2="11" y1="12" y2="12"/><line x1="21" x2="11" y1="6" y2="6"/><line x1="21" x2="11" y1="18" y2="18"/>' },
    taskList: { localeKey: 'taskList', icon: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>' },
    horizontalRule: { localeKey: 'horizontalRule', icon: '<path d="M5 12h14"/>' },
    find: { localeKey: 'find', shortcut: 'Ctrl+F', icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>' },
};

const TEXT_STYLE_ROW: ToolbarButton = { localeKey: 'textStyle', icon: TOOLBAR_BUTTONS.paragraph.icon };

/** Block types the Text style select offers, in order. */
export const TEXT_STYLE_OPTIONS = ['paragraph', 'heading1', 'heading2', 'heading3'] as const;
export type TextStyleOption = (typeof TEXT_STYLE_OPTIONS)[number];

function isTextStyle(value: string): value is TextStyleOption {
    return (TEXT_STYLE_OPTIONS as readonly string[]).includes(value);
}

const ROWS = new Map<string, ToolbarButton>([...Object.entries(TOOLBAR_BUTTONS), ['textStyle', TEXT_STYLE_ROW]]);

/** Items that name a state the caret can be in; the rest are momentary actions and carry no `aria-pressed`. */
const PRESSABLE: ReadonlySet<string> = new Set([
    'bold', 'italic', 'underline', 'strikethrough', 'code', 'taskList',
    'bulletList', 'orderedList', 'paragraph', 'heading1', 'heading2', 'heading3',
    'blockquote', 'codeBlock', 'alignLeft', 'alignCenter', 'alignRight',
]);

const ICON_MIRROR: Readonly<Record<string, string>> = { alignLeft: 'alignRight', alignRight: 'alignLeft', indent: 'outdent', outdent: 'indent' };
const LABEL_MIRROR: Readonly<Record<string, string>> = { alignLeft: 'alignRight', alignRight: 'alignLeft' };

/** Items that raise their own event instead of `toolbar-command`. */
const REQUESTS: Readonly<Record<string, string>> = { undo: 'undo', redo: 'redo', find: 'find-toggle' };

/** A panel an addon button opens inside the toolbar: its own focus scope, outside the roving order. */
const HOSTED_PANEL = '[data-slot="popover-content"], [data-slot="emoji-picker-content"]';

const DEFAULT_ITEMS: readonly ToolbarItem[] = ['bold', 'italic', 'underline', 'separator', 'heading1', 'heading2', 'separator', 'bulletList', 'orderedList'];

const glyph = (inner: string) =>
    html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${unsafeSVG(inner)}</svg>`;

/**
 * The formatting toolbar of the rich-text editor: a roving-tabindex `role="toolbar"` that owns no editor state.
 * The host runs the commands and feeds the result back through `activeFormats`.
 *
 * @fires toolbar-command - A format button was pressed; `detail` is the {@link RichTextFormatCommand}.
 * @fires text-style-select - The Text style select picked a block type; `detail` is `paragraph` or `heading1`-`heading3`.
 * @fires undo - The undo button was pressed.
 * @fires redo - The redo button was pressed.
 * @fires find-toggle - The find button was pressed.
 * @attr {boolean} compact - Floating-toolbar sizing: tighter padding, no border or background. Also set on `tag` slot elements.
 * @attr {boolean} disabled - Disables every control.
 * @attr {boolean} readonly - Same effect as `disabled`.
 * @attr {boolean} text-style-available - Whether the Text style select can change the caret's line; defaults to true.
 */
export class GeRichTextToolbar extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        items: { attribute: false },
        activeFormats: { attribute: false },
        locale: { attribute: false },
        slots: { attribute: false },
        compact: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
        readonly: { type: Boolean, reflect: true },
        textStyleAvailable: { type: Boolean, attribute: 'text-style-available' },
    };

    declare items: readonly ToolbarItem[];
    declare activeFormats: RichTextActiveFormats;
    declare locale: RichTextLocale;
    /** Addon slots: the editor's registry (followed live) or a fixed list. */
    declare slots: SlotRegistry<RichTextToolbarSlot> | readonly RichTextToolbarSlot[];
    declare compact: boolean;
    declare disabled: boolean;
    declare readonly: boolean;
    declare textStyleAvailable: boolean;

    private rovingIndex = 0;
    private unsubscribeSlots: (() => void) | undefined;
    private observer: MutationObserver | undefined;
    private readonly tagElements = new WeakMap<RichTextToolbarSlot, HTMLElement>();

    constructor() {
        super();
        this.items = DEFAULT_ITEMS;
        this.activeFormats = new Set();
        this.locale = RICH_TEXT_LOCALES.en;
        this.slots = [];
        this.compact = false;
        this.disabled = false;
        this.readonly = false;
        this.textStyleAvailable = true;
    }

    /** Re-reads every addon slot's `isEnabled` / `isActive`; call it when the editor's state changed. */
    refresh(): void {
        this.requestUpdate();
    }

    private get interactionDisabled(): boolean {
        return this.disabled || this.readonly;
    }

    private get textStyleDisabled(): boolean {
        return this.interactionDisabled || !this.textStyleAvailable;
    }

    private get textStyleValue(): TextStyleOption {
        const active = this.activeFormats;
        return TEXT_STYLE_OPTIONS.find((option) => option !== 'paragraph' && active.has(option)) ?? 'paragraph';
    }

    private get slotList(): readonly RichTextToolbarSlot[] {
        const list = this.slots instanceof SlotRegistry ? this.slots.slots : this.slots;
        return [...list].sort((a, b) => (a.order ?? 1000) - (b.order ?? 1000));
    }

    private get bar(): HTMLElement | null {
        return this.renderRoot.querySelector<HTMLElement>('[role="toolbar"]');
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.followSlots();
        if (this.hasUpdated) this.observe();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unsubscribeSlots?.();
        this.unsubscribeSlots = undefined;
        this.observer?.disconnect();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('slots') && this.isConnected) this.followSlots();
    }

    protected override firstUpdated(): void {
        this.observe();
    }

    protected override updated(): void {
        this.applyRovingTabIndex();
    }

    private followSlots(): void {
        this.unsubscribeSlots?.();
        this.unsubscribeSlots = this.slots instanceof SlotRegistry ? this.slots.subscribe(() => this.requestUpdate()) : undefined;
    }

    private observe(): void {
        const bar = this.bar;
        if (!bar) return;
        this.observer ??= new MutationObserver(() => this.applyRovingTabIndex());
        this.observer.observe(bar, { childList: true, subtree: true });
    }

    private emit(name: string, detail?: unknown): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    private tooltip(item: string): string {
        const row = ROWS.get(this.locale.rtl ? (LABEL_MIRROR[item] ?? item) : item);
        if (!row) return item;
        const label = this.locale.toolbar[row.localeKey];
        return row.shortcut ? `${label} (${row.shortcut})` : label;
    }

    private iconOf(item: string): string {
        return ROWS.get(this.locale.rtl ? (ICON_MIRROR[item] ?? item) : item)?.icon ?? '';
    }

    private isActive(item: string): boolean {
        return PRESSABLE.has(item) && this.activeFormats.has(item);
    }

    private press(item: string): void {
        if (this.interactionDisabled) return;
        const request = REQUESTS[item];
        if (request) this.emit(request);
        else if (isRichTextFormatCommand(item)) this.emit('toolbar-command', item);
    }

    private onTextStyleChange(event: Event): void {
        if (!(event.target instanceof HTMLSelectElement)) return;
        const select = event.target;
        const actual = this.textStyleValue;
        if (!this.textStyleDisabled && isTextStyle(select.value)) this.emit('text-style-select', select.value);
        select.value = actual;
    }

    private rovingStops(): HTMLElement[] {
        const controls = this.bar?.querySelectorAll<HTMLElement>('button, select') ?? [];
        return [...controls].filter((el) => (el.offsetParent !== null || el.tagName === 'SELECT') && !el.closest(HOSTED_PANEL));
    }

    private applyRovingTabIndex(stops: HTMLElement[] = this.rovingStops()): void {
        const active = Math.min(this.rovingIndex, stops.length - 1);
        for (const [index, el] of stops.entries()) {
            const wanted = index === active ? 0 : -1;
            if (el.tabIndex !== wanted) el.tabIndex = wanted;
        }
    }

    private onKeydown(event: KeyboardEvent): void {
        const stops = this.rovingStops();
        const current = stops.indexOf(event.target as HTMLElement);
        if (current === -1) return;
        const forward = this.locale.rtl ? 'ArrowLeft' : 'ArrowRight';
        const backward = this.locale.rtl ? 'ArrowRight' : 'ArrowLeft';
        const moves: Record<string, number> = {
            [forward]: (current + 1) % stops.length,
            [backward]: (current - 1 + stops.length) % stops.length,
            Home: 0,
            End: stops.length - 1,
        };
        const next = moves[event.key];
        if (next === undefined) return;
        event.preventDefault();
        this.rovingIndex = next;
        this.applyRovingTabIndex(stops);
        stops[next]?.focus();
    }

    private onFocusin(event: FocusEvent): void {
        const stops = this.rovingStops();
        const index = stops.indexOf(event.target as HTMLElement);
        if (index === -1) return;
        this.rovingIndex = index;
        this.applyRovingTabIndex(stops);
    }

    private renderTextStyle(): TemplateResult {
        const label = this.tooltip('textStyle');
        const current = this.textStyleValue;
        return html`<label class="style-wrap" data-slot="rich-text-toolbar-text-style-wrap">
            <span class="style-icon">${glyph(TEXT_STYLE_ROW.icon)}</span>
            <select
                data-slot="rich-text-toolbar-text-style"
                aria-label=${label}
                title=${label}
                ?disabled=${this.textStyleDisabled}
                @change=${this.onTextStyleChange}
                @mousedown=${(event: Event) => event.stopPropagation()}
            >
                ${TEXT_STYLE_OPTIONS.map((option) => html`<option value=${option} .selected=${option === current}>${this.locale.toolbar[option]}</option>`)}
            </select>
        </label>`;
    }

    private renderButton(item: string): TemplateResult {
        const label = this.tooltip(item);
        const active = this.isActive(item);
        return html`<button
            type="button"
            data-toolbar-item=${item}
            title=${label}
            aria-label=${label}
            aria-pressed=${PRESSABLE.has(item) ? String(active) : nothing}
            data-state=${active ? 'on' : 'off'}
            ?disabled=${this.interactionDisabled}
            @click=${() => this.press(item)}
        >${glyph(this.iconOf(item))}</button>`;
    }

    private renderItem(item: ToolbarItem): TemplateResult {
        if (item === 'separator') return html`<ge-separator orientation="vertical"></ge-separator>`;
        if (item === 'textStyle') return this.renderTextStyle();
        return this.renderButton(item);
    }

    private renderSlot(slot: RichTextToolbarSlot): TemplateResult | typeof nothing {
        if (slot.render) return html`<span class="slot" data-addon-slot=${slot.id}>${slot.render()}</span>`;
        if (slot.tag) return html`<span class="slot" data-addon-slot=${slot.id}>${this.tagElement(slot, slot.tag)}</span>`;
        if (!slot.icon) return nothing;
        const active = slot.isActive?.() ?? false;
        return html`<button
            type="button"
            data-addon-slot=${slot.id}
            title=${slot.tooltip ?? nothing}
            aria-label=${slot.tooltip ?? nothing}
            aria-pressed=${slot.isActive ? String(active) : nothing}
            data-state=${active ? 'on' : 'off'}
            ?disabled=${this.interactionDisabled || !(slot.isEnabled?.() ?? true)}
            @click=${(event: Event) => slot.onClick?.(event)}
        >${unsafeHTML(slot.icon)}</button>`;
    }

    private tagElement(slot: RichTextToolbarSlot, tag: string): HTMLElement {
        let element = this.tagElements.get(slot);
        if (!element) {
            element = document.createElement(tag);
            this.tagElements.set(slot, element);
        }
        element.toggleAttribute('compact', this.compact);
        return element;
    }

    protected override render() {
        return html`<div
            class="bar"
            role="toolbar"
            aria-label=${this.locale.editor.formattingOptions}
            dir=${this.locale.rtl ? 'rtl' : 'ltr'}
            @keydown=${this.onKeydown}
            @focusin=${this.onFocusin}
        >
            ${this.items.map((item) => this.renderItem(item))}${this.slotList.map((slot) => this.renderSlot(slot))}
        </div>`;
    }
}
