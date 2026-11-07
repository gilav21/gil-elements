import { html, isServer, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { graphemeLength } from '../shared/grapheme.js';
import { highlightCodeBlocks, stripCodeHighlighting } from '../shared/code-highlight.js';
import { THEME_ATTRIBUTE, type ThemeName } from '../shared/theme-presets.js';
import { RichTextCommandRegistry } from './rich-text-command-registry.js';
import { RICH_TEXT_CONTROLLERS, type RichTextControllerFactory, type RichTextRenderingController } from './rich-text-controllers.js';
import { adoptRichTextContentStyles, adoptSheet } from './rich-text-content.js';
import { ZERO_WIDTH, offsetAfterSweep } from './rich-text-dom.js';
import type {
    CommitOptions,
    RichTextAddon,
    RichTextAddonHost,
    RichTextCoreHost,
    RichTextExclusivePopover,
    RichTextFormatCommand,
    RichTextHistoryEntrySnapshot,
    RichTextInlineStyle,
    RichTextOverlay,
    RichTextSelectionInlineStyle,
    RichTextSelectionSnapshot,
    RichTextToolbarSlot,
    RichTextTopic,
} from './rich-text-host.js';
import { interpolate, resolveRichTextLocale, type RichTextLocale } from './rich-text-locales.js';
import { RichTextMarkdown } from './rich-text-markdown.js';
import type {
    RichTextConfig,
    RichTextCounterMode,
    RichTextHistoryOptions,
    RichTextProviders,
    RichTextShellHost,
    RichTextToolbarPosition,
} from './rich-text-providers.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import { Disposables, HandlerChain, SlotRegistry, TopicBus } from './rich-text-registry.js';
import { labelBlockedImages, reportResourceDecisions, type RichTextAllow } from './rich-text-resource-policy.js';
import { RichTextSanitizer } from './rich-text-sanitizer.js';
import { isRichTextEmpty, richTextValidityFlag, validateRichText } from './rich-text-validators.js';
import css from './rich-text-editor.css?inline';

export type RichTextMode = 'markdown' | 'html';
export type RichTextVariant = 'default' | 'ghost';
export type RichTextSize = 'default' | 'sm' | 'lg';

export interface RichTextSetContentOptions {
    /** Push one history entry so the write can be undone. Default `true`. */
    readonly recordHistory?: boolean;
}

/** The editor as a custom toolbar button sees it; every write goes through the editor's own seams. */
export interface RichTextEditorRef {
    insertText(text: string): void;
    insertHtml(html: string): void;
    focus(): void;
    getSelectedText(): string;
    getHtmlContent(): string;
}

/** A toolbar button supplied as data; it renders after the built-in items. */
export interface RichTextCustomToolbarItem {
    /** Stable id, also the button's `data-addon-slot` value. */
    readonly id: string;
    /** Inline SVG markup, or a short text glyph. */
    readonly icon: string;
    readonly tooltip: string;
    /** Sort order among added buttons; lower first. Default 500. */
    readonly order?: number;
    /** Pressed state, judged from the formats active at the caret. */
    readonly isActive?: (formats: ReadonlySet<string>) => boolean;
    readonly onClick?: (ref: RichTextEditorRef) => void;
}

/** An element that declares what content beneath it may load and link to. */
export interface RichTextAllowElement extends HTMLElement {
    readonly allow: RichTextAllow;
}

const CUSTOM_TOOLBAR_ITEM_ORDER = 500;
const EMPTY_INLINE_STYLE: RichTextSelectionInlineStyle = { color: '', backgroundColor: '', fontSize: '', fontFamily: '' };
const VALIDATION_MESSAGES = {
    required: 'Please fill out this field.',
    minWords: 'The text is too short.',
    maxlength: 'The text is too long.',
};

const tokenList = { fromAttribute: (value: string | null) => (value ?? '').split(/[\s,]+/).filter(Boolean) };
const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false' };

let nextId = 0;

function setAttribute(element: Element, name: string, value: string | null): void {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
}

function closestWithAttrs(node: Node | null, attrs: readonly string[], boundary: HTMLElement): HTMLElement | null {
    let element = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    while (element && boundary.contains(element)) {
        if (attrs.some((attr) => element?.hasAttribute(attr))) return element;
        element = element.parentElement;
    }
    return null;
}

/**
 * A rich text editor for Markdown or HTML.
 *
 * The editable is created in the light DOM and slotted into the shadow root, so the page's own
 * selection, spellcheck, IME and `id` references work on it; its content styles are one stylesheet
 * adopted onto the tree the editor lives in. Keep the editor in the document or in a shadow root
 * whose `getSelection` is the document's.
 *
 * Features are separate controllers (history, formats, tables, find, ...) listed in
 * `rich-text-controllers.ts`; each plugs into this element through the host contract and through
 * `provide()`. Until a controller provides undo history, inserts or typography, those calls do nothing.
 *
 * @fires value-change - After an edit, with `{ value, html, markdown }`. Not fired for writes to `value`.
 * @fires input - On every edit.
 * @fires change - On blur when the value changed since focus.
 * @fires word-count-change - When the word count changes, with the number.
 * @fires history-change - When the undo stack changes, with `{ canUndo, canRedo }`.
 * @fires image-blocked - Once per remote resource `allowed-image-hosts` refused.
 * @fires custom-toolbar-action - When a custom toolbar button is clicked, with `{ id, ref }`.
 * @attr {'markdown' | 'html'} mode - Format of `value`. Defaults to `markdown`.
 * @attr {string} value - Content in the `mode` format.
 * @attr {'top' | 'floating' | 'none'} toolbar - Where the formatting toolbar goes. Defaults to `top`.
 * @attr {'default' | 'ghost'} variant - Border treatment.
 * @attr {'default' | 'sm' | 'lg'} size - Text size.
 * @attr {string} theme - Colour preset name.
 * @attr {'ltr' | 'rtl' | 'auto'} dir - Text direction; unset follows the locale.
 * @attr {'characters' | 'words' | 'both'} counter - Which counter to show below the editor.
 * @attr {boolean} disabled - Blocks editing and dims the editor.
 * @attr {boolean} readonly - Not editable but selectable; hides the toolbar.
 * @attr {boolean} required - Invalid while empty.
 * @attr {number} max-length - Visible-character limit; advisory while typing, enforced by validity.
 * @attr {number} min-words - Minimum word count for validity.
 * @attr {boolean} markdown-shortcuts - Whether typed Markdown markers turn into formatting. Defaults to true; `false` disables.
 * @attr {string} placeholder - Hint shown while empty.
 * @attr {string} min-height - CSS min-height of the editable. Defaults to `120px`.
 * @attr {string} max-height - CSS max-height of the editable, scrolling beyond it. Defaults to `400px`.
 * @attr {string} allowed-image-hosts - Space or comma separated hosts remote images may load from; empty means no policy.
 * @attr {string} allowed-link-schemes - Link schemes allowed in addition to the built-in list.
 * @attr {string} blocked-image-message - Caption on an image the policy refused.
 * @attr {string} locale - Locale id; set a `RichTextLocale` object through the property.
 * @attr {string} addons - Space separated ids of registered addons to enable.
 * @attr {string} name - Field name for form submission.
 * @attr {string} aria-label - Accessible name of the editable.
 * @attr {string} aria-labelledby - Ids that name the editable.
 * @attr {string} aria-describedby - Ids that describe the editable; the counter is added.
 * @slot toolbar - Custom toolbar content.
 * @csspart container - The bordered box around the editable.
 * @csspart toolbar - The toolbar region.
 */
export class GeRichTextEditor extends UiElement implements RichTextCoreHost, RichTextShellHost, RichTextConfig, RichTextAddonHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        name: { reflect: true },
        value: {},
        mode: { reflect: true },
        toolbar: { reflect: true },
        variant: { reflect: true },
        size: { reflect: true },
        theme: { reflect: true },
        dir: { reflect: true },
        counter: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        readonly: { type: Boolean, reflect: true },
        required: { type: Boolean, reflect: true },
        markdownShortcuts: { attribute: 'markdown-shortcuts', converter: defaultTrue },
        placeholder: {},
        minHeight: { attribute: 'min-height' },
        maxHeight: { attribute: 'max-height' },
        maxLength: { type: Number, attribute: 'max-length' },
        minWords: { type: Number, attribute: 'min-words' },
        allowedImageHosts: { attribute: 'allowed-image-hosts', converter: tokenList },
        allowedLinkSchemes: { attribute: 'allowed-link-schemes', converter: tokenList },
        blockedImageMessage: { attribute: 'blocked-image-message' },
        locale: {},
        addons: {},
        findDebounceMs: { type: Number, attribute: 'find-debounce-ms' },
        codeHighlightDebounceMs: { type: Number, attribute: 'code-highlight-debounce-ms' },
        toolbarItems: { attribute: false },
        customToolbarItems: { attribute: false },
        history: { attribute: false },
        addonOptions: { attribute: false },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        ariaDescribedby: { attribute: 'aria-describedby' },
        dragOver: { state: true },
        fieldsetDisabled: { state: true },
        suggestionPopup: { state: true },
    };

    private static readonly addonRegistry = new Map<string, RichTextAddon>();
    private static readonly startedEditors = new Set<GeRichTextEditor>();

    /** Makes an addon available by id to every editor, for the `addons` attribute; editors already running pick it up. */
    static registerAddon(addon: RichTextAddon): void {
        GeRichTextEditor.addonRegistry.set(addon.id, addon);
        for (const editor of GeRichTextEditor.startedEditors) editor.syncAddons();
    }

    declare name: string;
    declare value: string;
    declare mode: RichTextMode;
    declare toolbar: RichTextToolbarPosition;
    declare variant: RichTextVariant;
    declare size: RichTextSize;
    declare theme: ThemeName | undefined;
    declare counter: RichTextCounterMode | undefined;
    declare disabled: boolean;
    declare readonly: boolean;
    declare required: boolean;
    declare markdownShortcuts: boolean;
    declare placeholder: string;
    declare minHeight: string;
    declare maxHeight: string;
    declare maxLength: number | undefined;
    declare minWords: number | undefined;
    declare allowedImageHosts: readonly string[];
    declare allowedLinkSchemes: readonly string[];
    declare blockedImageMessage: string | undefined;
    declare locale: string | RichTextLocale | undefined;
    declare addons: string;
    declare findDebounceMs: number;
    declare codeHighlightDebounceMs: number;
    declare toolbarItems: readonly string[] | undefined;
    declare customToolbarItems: readonly RichTextCustomToolbarItem[];
    declare history: RichTextHistoryOptions;
    declare addonOptions: Readonly<Record<string, unknown>>;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare ariaDescribedby: string | null;
    declare dragOver: boolean;
    declare fieldsetDisabled: boolean;
    declare suggestionPopup: { controlsId: string; activeOptionId: string | null } | null;

    readonly sanitizer = new RichTextSanitizer();
    readonly markdown = new RichTextMarkdown(this.sanitizer);
    readonly commands = new RichTextCommandRegistry();
    readonly toolbarSlots = new SlotRegistry<RichTextToolbarSlot>();
    readonly overlays = new SlotRegistry<RichTextOverlay>();
    readonly commandTable = new Map<RichTextFormatCommand, () => void>();

    private readonly internals?: ElementInternals;
    private readonly counterId = `rte-counter-${++nextId}`;
    private readonly bus = new TopicBus<RichTextTopic>();
    private readonly life = new Disposables();
    private readonly keyHandlers = new HandlerChain<[KeyboardEvent]>();
    private readonly pasteInterceptors = new HandlerChain<[ClipboardEvent]>();
    private readonly dropInterceptors = new HandlerChain<[DragEvent]>();
    private readonly dropZonePredicates = new HandlerChain<[DragEvent]>();
    private readonly inputTransforms = new HandlerChain<[Event]>();
    private readonly inputObservers = new Set<(text: string, caret: number) => void>();
    private readonly exclusivePopovers = new Set<() => void>();
    private readonly shortcutActions = new Map<string, { run: () => void; when?: () => boolean }>();
    private readonly replacedHooks = new Set<() => void>();
    private readonly providers: Partial<RichTextProviders> = {};
    private readonly usedAddons = new Map<string, { addon: RichTextAddon; options?: unknown }>();
    private readonly activeAddons = new Map<string, { teardown: void | (() => void); options: unknown }>();
    private readonly markdownMemo = this.memo((source) => this.markdown.toMarkdown(source));
    private readonly countsMemo = this.memo((source) => {
        const text = this.sanitizer.stripTags(source);
        const trimmed = text.trim();
        return { characters: graphemeLength(text), words: trimmed ? trimmed.split(/\s+/).length : 0 };
    });

    private editable?: HTMLDivElement;
    private counterElement?: HTMLElement;
    private counterKey = '';
    private controllers: RichTextRenderingController[] = [];
    private controllersBuilt = false;
    private allowHost: RichTextAllowElement | null = null;
    private customTeardowns: Array<() => void> = [];
    private imageFileHandler: ((file: File) => void) | null = null;
    private linkEditor: ((hint?: { x: number; y: number }) => void) | null = null;
    private savedRange: Range | null = null;
    private htmlContent = '';
    private cleanHtml = '';
    private lastOutput = '';
    private defaultValue?: string;
    private valueAtFocus = '';
    private announcedFor?: string;
    private announcedWords = -1;
    private announcedDisabled = false;
    private selected: HTMLImageElement | null = null;
    private formats: ReadonlySet<string> = new Set();
    private started = false;
    private ready = false;

    constructor() {
        super();
        this.name = '';
        this.value = '';
        this.mode = 'markdown';
        this.toolbar = 'top';
        this.variant = 'default';
        this.size = 'default';
        this.disabled = false;
        this.readonly = false;
        this.required = false;
        this.markdownShortcuts = true;
        this.placeholder = '';
        this.minHeight = '120px';
        this.maxHeight = '400px';
        this.allowedImageHosts = [];
        this.allowedLinkSchemes = [];
        this.addons = '';
        this.findDebounceMs = 150;
        this.codeHighlightDebounceMs = 150;
        this.customToolbarItems = [];
        this.history = {};
        this.addonOptions = {};
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.ariaDescribedby = null;
        this.dragOver = false;
        this.fieldsetDisabled = false;
        this.suggestionPopup = null;
        this.overlays.subscribe(() => this.requestUpdate());
        // Read at the moment each sanitize pass runs, so the first pass already sees the policy.
        this.sanitizer.setRemoteHostPolicy(() => this.allowedImageHosts.length > 0 ? this.allowedImageHosts : (this.allowHost?.allow.imageHosts ?? []));
        this.sanitizer.setLinkSchemePolicy(() => this.allowedLinkSchemes.length > 0 ? this.allowedLinkSchemes : (this.allowHost?.allow.linkSchemes ?? []));
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    // Host contract: environment and state

    get doc(): Document {
        return this.ownerDocument;
    }

    get element(): HTMLElement {
        return this;
    }

    get contentRoot(): HTMLElement {
        return this.editable ?? this;
    }

    get overlayAnchor(): HTMLElement {
        return this.renderRoot.querySelector<HTMLElement>('.container') ?? this;
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    get resolvedLocale(): RichTextLocale {
        return resolveRichTextLocale(this.locale);
    }

    private get resolvedDir(): string {
        return this.dir || (this.resolvedLocale.rtl ? 'rtl' : 'ltr');
    }

    get isRtl(): boolean {
        return this.resolvedDir === 'rtl';
    }

    get config(): RichTextConfig {
        return this;
    }

    get activeFormats(): ReadonlySet<string> {
        return this.formats;
    }

    get selectedImage(): HTMLImageElement | null {
        return this.selected;
    }

    get selectionInlineStyle(): RichTextSelectionInlineStyle {
        return this.providers.selection?.inlineStyle ?? EMPTY_INLINE_STYLE;
    }

    get textStyleAvailable(): boolean {
        return this.providers.selection?.textStyleAvailable ?? true;
    }

    get hasImageFileHandler(): boolean {
        return this.imageFileHandler !== null;
    }

    // Content outputs

    /** The content as sanitized HTML, whatever the `mode`. */
    get htmlOutput(): string {
        return this.htmlContent;
    }

    /** The content as Markdown, whatever the `mode`. */
    get markdownOutput(): string {
        return this.markdownMemo();
    }

    get characterCount(): number {
        return this.countsMemo().characters;
    }

    get wordCount(): number {
        return this.countsMemo().words;
    }

    /** Whether the content differs from what was last written to `value` or marked clean. */
    get isDirty(): boolean {
        return this.htmlContent !== this.cleanHtml;
    }

    get canUndo(): boolean {
        return this.providers.history?.canUndo() ?? false;
    }

    get canRedo(): boolean {
        return this.providers.history?.canRedo() ?? false;
    }

    // Lifecycle

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
        if (!this.controllersBuilt) {
            this.controllers = RICH_TEXT_CONTROLLERS.map((create: RichTextControllerFactory) => create(this));
            this.controllersBuilt = true;
        }
        this.allowHost = this.closest<RichTextAllowElement>('ge-rich-text-allow');
        const wrapper = this.allowHost;
        if (wrapper) {
            this.life.listen(wrapper, 'change', (event) => {
                if (event.target === wrapper) this.rejudge();
            });
        }
        if (this.editable) this.start();
    }

    override disconnectedCallback(): void {
        this.stop();
        this.life.dispose();
        super.disconnectedCallback();
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? '';
    }

    formStateRestoreCallback(state: string): void {
        this.value = state;
    }

    get validity(): ValidityState | undefined {
        return this.internals?.validity;
    }

    get validationMessage(): string {
        return this.internals?.validationMessage ?? '';
    }

    checkValidity(): boolean {
        return this.internals?.checkValidity() ?? true;
    }

    reportValidity(): boolean {
        return this.internals?.reportValidity() ?? true;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        // The content is parsed with the DOM, which a server render does not have.
        if (isServer) return;
        if (changed.has('value')) {
            const next = this.value ?? '';
            if (next !== this.lastOutput) {
                this.lastOutput = next;
                this.writeValue(next);
            }
            this.internals?.setFormValue(next);
        }
        if (changed.has('value') || changed.has('required') || changed.has('minWords') || changed.has('maxLength')) this.updateValidity();
    }

    protected override firstUpdated(): void {
        const root = this.getRootNode();
        adoptRichTextContentStyles(root instanceof ShadowRoot ? root : this.doc);
        const editable = this.doc.createElement('div');
        editable.dataset['slot'] = 'editor';
        editable.slot = 'editable';
        editable.setAttribute('role', 'textbox');
        editable.setAttribute('aria-multiline', 'true');
        this.editable = editable;
        this.append(editable);
        this.start();
        this.replaceEditorHtml(this.htmlContent);
    }

    protected override updated(changed: PropertyValues<this>): void {
        this.syncCounter();
        this.syncEditable();
        if (changed.has('theme')) setAttribute(this, THEME_ATTRIBUTE, this.theme ?? null);
        if (changed.has('customToolbarItems')) this.registerCustomItems();
        if (changed.has('addons') || changed.has('addonOptions')) this.syncAddons();
        if (this.ready && (changed.has('allowedImageHosts') || changed.has('allowedLinkSchemes'))) this.rejudge();
        if (this.ready && changed.has('locale')) this.bus.emit('locale');
        if (this.ready && changed.has('readonly')) this.bus.emit('state');
        this.ready = true;
        this.announce();
    }

    protected override render() {
        return html`
            <div class="toolbar" part="toolbar" ?hidden=${this.toolbar !== 'top' || this.readonly}>
                ${this.controllers.map((controller) => controller.renderToolbar?.())}<slot name="toolbar"></slot>
            </div>
            <div class="container" part="container" dir=${this.resolvedDir} ?data-disabled=${this.isDisabled} ?data-readonly=${this.readonly}>
                <slot name="editable"></slot>
                ${this.dragOver ? html`<div class="drop-zone" aria-hidden="true"></div>` : nothing}
                ${this.controllers.map((controller) => controller.renderOverlay?.())}
                ${this.overlays.slots.map((overlay) => overlay.render())}
                <slot name="popup"></slot>
            </div>
            <slot name="counter"></slot>
        `;
    }

    private start(): void {
        const editable = this.editable;
        if (!editable || this.started) return;
        this.started = true;
        GeRichTextEditor.startedEditors.add(this);
        const listen = <E extends Event>(type: string, fn: (event: E) => void) => this.life.listen(editable, type, fn);
        listen('input', this.onInput);
        listen('keydown', (event: KeyboardEvent) => {
            this.keyHandlers.run(event);
        });
        listen('paste', this.onPaste);
        listen('focus', this.onFocus);
        listen('blur', this.onBlur);
        listen('click', this.onClick);
        listen('mouseup', () => this.bus.emit('selection'));
        listen('keyup', () => this.bus.emit('selection'));
        this.watchSelection(editable);
        listen('dragover', this.onDragOver);
        listen('dragleave', this.onDragLeave);
        listen('drop', this.onDrop);
        for (const controller of this.controllers) controller.attach();
        this.syncAddons();
    }

    /** One 'selection' per frame while the selection moves inside the editable. */
    private watchSelection(editable: HTMLElement): void {
        let frame = 0;
        this.life.listen(this.doc, 'selectionchange', () => {
            const anchor = this.getSelection()?.anchorNode;
            if (frame || !anchor || !editable.contains(anchor)) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                this.bus.emit('selection');
            });
        });
        this.life.add(() => cancelAnimationFrame(frame));
    }

    private stop(): void {
        if (!this.started) return;
        this.started = false;
        GeRichTextEditor.startedEditors.delete(this);
        for (const controller of [...this.controllers].reverse()) controller.detach();
        for (const { teardown } of this.activeAddons.values()) teardown?.();
        this.activeAddons.clear();
    }

    // Services for controllers

    subscribe(topic: RichTextTopic, fn: () => void): () => void {
        return this.bus.on(topic, fn);
    }

    onContentReplaced(fn: () => void): () => void {
        this.replacedHooks.add(fn);
        return () => this.replacedHooks.delete(fn);
    }

    onSelectionMoved(fn: () => void): () => void {
        return this.bus.on('selection', fn);
    }

    invalidate(): void {
        this.bus.emit('state');
        this.requestUpdate();
    }

    provider<K extends keyof RichTextProviders>(key: K): RichTextProviders[K] | undefined {
        return this.providers[key];
    }

    emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
        if (name === 'history-change') this.bus.emit('history');
    }

    provide<K extends keyof RichTextProviders>(key: K, provider: RichTextProviders[K]): () => void {
        this.providers[key] = provider;
        return () => {
            if (this.providers[key] === provider) delete this.providers[key];
        };
    }

    addKeyHandler(priority: number, fn: (event: KeyboardEvent) => boolean): () => void {
        return this.keyHandlers.add(priority, fn);
    }

    addInputTransform(fn: (event: Event) => boolean): () => void {
        return this.inputTransforms.add(0, fn);
    }

    setActiveFormats(formats: ReadonlySet<string>): void {
        const same = formats.size === this.formats.size && [...formats].every((format) => this.formats.has(format));
        if (same) return;
        this.formats = formats;
        this.bus.emit('state');
        this.requestUpdate();
    }

    setSelectedImage(image: HTMLImageElement | null): void {
        if (this.selected === image) return;
        this.selected = image;
        this.bus.emit('selection');
        this.bus.emit('state');
        this.requestUpdate();
    }

    mountPopup(element: HTMLElement): () => void {
        element.slot = 'popup';
        this.append(element);
        return () => element.remove();
    }

    adoptStyles(source: string, scope: 'shadow' | 'document'): () => void {
        const root = scope === 'shadow' ? this.shadowRoot : this.getRootNode();
        if (root instanceof ShadowRoot) return adoptSheet(root, source, source);
        return scope === 'document' ? adoptSheet(this.doc, source, source) : () => undefined;
    }

    // Addons

    /** Enables an addon on this editor, now and on every reconnect; the returned function removes it. */
    use(addon: RichTextAddon, options?: unknown): () => void {
        this.usedAddons.set(addon.id, { addon, options });
        this.syncAddons();
        return () => {
            this.usedAddons.delete(addon.id);
            this.syncAddons();
        };
    }

    private syncAddons(): void {
        if (!this.started) return;
        const wanted = this.wantedAddons();
        for (const [id, active] of this.activeAddons) {
            const entry = wanted.get(id);
            if (entry && this.optionsFor(id, entry) === active.options) continue;
            active.teardown?.();
            this.activeAddons.delete(id);
        }
        for (const [id, { addon, options }] of wanted) {
            const resolved = this.optionsFor(id, { addon, options });
            if (resolved === false || this.activeAddons.has(id)) continue;
            this.activeAddons.set(id, { teardown: addon.setup(this, resolved), options: resolved });
        }
    }

    /** The used and listed addons, once per id; an enabled bundle stands in for the ids it covers. */
    private wantedAddons(): Map<string, { addon: RichTextAddon; options?: unknown }> {
        const wanted = new Map(this.usedAddons);
        for (const id of new Set(this.addons.split(/[\s,]+/).filter(Boolean))) {
            const addon = GeRichTextEditor.addonRegistry.get(id);
            if (addon) wanted.set(id, { addon });
            else console.warn(`[ge-rich-text-editor] unknown addon "${id}": import its define module first.`);
        }
        const bundles = [...wanted].filter(([id, entry]) => entry.addon.covers && this.optionsFor(id, entry) !== false);
        for (const [, { addon }] of bundles) for (const covered of addon.covers ?? []) wanted.delete(covered);
        return wanted;
    }

    private optionsFor(id: string, { addon, options }: { addon: RichTextAddon; options?: unknown }): unknown {
        if (this.addonOptions[id] === false) return false;
        if (addon.covers) return this.addonOptions;
        return options ?? this.addonOptions[id];
    }

    private registerCustomItems(): void {
        for (const teardown of this.customTeardowns) teardown();
        const ref = this.editorRef();
        this.customTeardowns = this.customToolbarItems.map((item) => this.toolbarSlots.register({
            id: item.id,
            icon: item.icon,
            tooltip: item.tooltip,
            order: item.order ?? CUSTOM_TOOLBAR_ITEM_ORDER,
            isEnabled: () => !this.readonly && !this.isDisabled,
            isActive: item.isActive ? () => item.isActive?.(this.formats) ?? false : undefined,
            onClick: () => {
                item.onClick?.(ref);
                this.emit('custom-toolbar-action', { id: item.id, ref });
            },
        }));
    }

    private editorRef(): RichTextEditorRef {
        return {
            insertText: (text) => this.insertText(text),
            insertHtml: (markup) => this.insertHtml(markup),
            focus: () => this.focus(),
            getSelectedText: () => this.selection().text,
            getHtmlContent: () => this.htmlOutput,
        };
    }

    // Registrations

    registerExclusivePopover(close: () => void): RichTextExclusivePopover {
        this.exclusivePopovers.add(close);
        return {
            notifyOpened: () => {
                for (const other of this.exclusivePopovers) if (other !== close) other();
            },
            release: () => this.exclusivePopovers.delete(close),
        };
    }

    registerKeydownInterceptor(fn: (event: KeyboardEvent) => boolean): () => void {
        return this.keyHandlers.add(KEY_PRIORITY.interceptor, fn);
    }

    registerPasteInterceptor(fn: (event: ClipboardEvent) => boolean): () => void {
        return this.pasteInterceptors.add(0, fn);
    }

    registerDropInterceptor(fn: (event: DragEvent) => boolean): () => void {
        return this.dropInterceptors.add(0, fn);
    }

    registerDropZonePredicate(fn: (event: DragEvent) => boolean): () => void {
        return this.dropZonePredicates.add(0, fn);
    }

    registerInputObserver(fn: (text: string, caret: number) => void): () => void {
        this.inputObservers.add(fn);
        return () => this.inputObservers.delete(fn);
    }

    registerImageFileHandler(fn: (file: File) => void): () => void {
        this.imageFileHandler = fn;
        this.requestUpdate();
        return () => {
            if (this.imageFileHandler !== fn) return;
            this.imageFileHandler = null;
            this.requestUpdate();
        };
    }

    insertImageFile(file: File): boolean {
        if (!this.imageFileHandler) return false;
        this.imageFileHandler(file);
        return true;
    }

    registerLinkEditor(open: (hint?: { x: number; y: number }) => void): () => void {
        this.linkEditor = open;
        return () => {
            if (this.linkEditor === open) this.linkEditor = null;
        };
    }

    showLinkDialog(hint?: { x: number; y: number }): void {
        this.linkEditor?.(hint);
    }

    registerShortcutAction(id: string, run: () => void, when?: () => boolean): () => void {
        const entry = { run, when };
        this.shortcutActions.set(id, entry);
        return () => {
            if (this.shortcutActions.get(id) === entry) this.shortcutActions.delete(id);
        };
    }

    canRunShortcutAction(id: string): boolean {
        const entry = this.shortcutActions.get(id);
        return entry !== undefined && (entry.when?.() ?? true);
    }

    runShortcutAction(id: string): void {
        this.shortcutActions.get(id)?.run();
    }

    setActiveSuggestionPopup(popup: { controlsId: string; activeOptionId: string | null } | null): void {
        this.suggestionPopup = popup;
    }

    // Public API

    /** Focuses the editable and restores the caret the user last had in it. */
    override focus(): void {
        if (this.isDisabled) return;
        this.focusEditor();
        // The saved caret, not the live one: focusing makes the browser drop a default caret at the start.
        this.restoreSelection({ preferLive: false });
    }

    insertText(text: string): void {
        if (text !== '') this.providers.insert?.text(text);
    }

    insertHtml(markup: string): void {
        this.providers.insert?.html(markup);
    }

    insertTextAtCaret(text: string): void {
        this.providers.insert?.textAtCaret(text);
    }

    insertHtmlAtCaret(markup: string): void {
        this.providers.insert?.htmlAtCaret(markup);
    }

    insertBlockAtCaret(markup: string): void {
        this.providers.insert?.block(markup);
    }

    insertTextFromOverlay(text: string): void {
        this.providers.insert?.fromOverlay(text);
    }

    applyInlineStyle(style: RichTextInlineStyle): void {
        this.providers.inlineStyle?.apply(style);
    }

    executeToolbarCommandOnBlock(command: string, block: HTMLElement | null): void {
        this.providers.blocks?.execute(command, block);
    }

    /** Runs a toolbar command exactly as a toolbar click would. */
    format(command: RichTextFormatCommand): void {
        const run = this.commandTable.get(command);
        if (!run || this.readonly || this.isDisabled) return;
        this.restoreSelection();
        this.flushPendingHistoryPush();
        run();
        this.commit({ focus: true });
    }

    undo(): void {
        this.providers.history?.undo();
    }

    redo(): void {
        this.providers.history?.redo();
    }

    /** No visible text and no image, rule or table; the same rule `required` applies. */
    isEmpty(): boolean {
        return isRichTextEmpty(this.htmlContent);
    }

    /**
     * Replaces the content as an edit the code is making: fires the change events, records one
     * history entry unless `recordHistory` is false, and leaves the dirty baseline alone.
     */
    setContent(value: string, options?: RichTextSetContentOptions): void {
        this.flushPendingHistoryPush();
        this.applyExternalHtml(value);
        this.placeCaretAtEnd();
        this.syncContent();
        if (options?.recordHistory !== false) this.pushHistory();
    }

    /** Treats the current content as saved, so `isDirty` reads false until the next change. */
    markClean(): void {
        this.cleanHtml = this.readContent() ?? this.htmlContent;
    }

    // History seam

    pushHistory(): void {
        this.providers.history?.push();
    }

    flushPendingHistoryPush(): void {
        this.providers.history?.flush();
    }

    historyEntries(): readonly RichTextHistoryEntrySnapshot[] {
        return this.providers.history?.entries() ?? [];
    }

    currentHistoryIndex(): number {
        return this.providers.history?.index() ?? -1;
    }

    reconstructHistoryEntry(index: number): { html: string; markdown: string } | null {
        return this.providers.history?.reconstruct(index) ?? null;
    }

    restoreHistoryEntry(index: number): void {
        this.providers.history?.restore(index);
    }

    // Content in and out

    /** The editable's content, sanitized and cleaned of decoration; refreshes the model. Null before the editable exists. */
    readContent(): string | null {
        const root = this.editable;
        if (!root) return null;
        const markup = this.undecorated(root);
        const content = this.sanitizer.sanitize(markup).replaceAll(ZERO_WIDTH, '');
        if (this.setModel(content)) this.bus.emit('content');
        return content;
    }

    /** The one place the editable's innerHTML is replaced wholesale, so no detached node survives as a selection. */
    replaceEditorHtml(markup: string): void {
        const root = this.editable;
        if (!root) return;
        root.innerHTML = markup;
        highlightCodeBlocks(root);
        this.labelBlockedImages();
        this.selected = null;
        for (const hook of this.replacedHooks) hook();
    }

    labelBlockedImages(): void {
        if (!this.editable) return;
        labelBlockedImages(this.editable, this.blockedImageMessage ?? this.resolvedLocale.editor.blockedImage);
    }

    commit(options?: CommitOptions): void {
        this.flushPendingHistoryPush();
        this.syncContent();
        if (options?.focus) this.focusEditor();
        this.bus.emit('selection');
        if (options?.history !== false) this.pushHistory();
    }

    mutateContent(fn: (root: HTMLElement) => void): void {
        if (!this.editable) return;
        fn(this.editable);
        this.commit();
    }

    commitContent(): void {
        this.syncContent();
        this.flushPendingHistoryPush();
    }

    wrapSelection(build: () => HTMLElement): HTMLElement[] {
        this.restoreSelection();
        const range = this.rangeInEditor();
        if (!range) return [];
        const wrapper = build();
        try {
            range.surroundContents(wrapper);
        } catch {
            wrapper.append(range.extractContents());
            range.insertNode(wrapper);
        }
        this.commit();
        return [wrapper];
    }

    remainingLength(): number {
        if (!this.maxLength) return Number.POSITIVE_INFINITY;
        const perceived = this.perceivedText();
        const selected = this.rangeInEditor()?.toString() ?? '';
        // Signed, not clamped: an addon whose text is already in the document needs to know if it is over.
        return this.maxLength - (graphemeLength(perceived) - graphemeLength(selected));
    }

    private perceivedText(): string {
        return (this.editable?.textContent ?? '').replaceAll(ZERO_WIDTH, '');
    }

    private writeValue(value: string): void {
        const record = this.history.recordExternalWrites;
        if (record) this.flushPendingHistoryPush();
        this.applyExternalHtml(value);
        if (record) this.pushHistory();
        this.markClean();
    }

    private applyExternalHtml(text = ''): void {
        const converted = this.mode === 'markdown' && text ? this.markdown.toHtml(text) : this.sanitizer.sanitize(text);
        this.swapContent(converted);
    }

    /** Stores the model, puts it in the editable, then announces it, so 'content' listeners see the new DOM. */
    private swapContent(content: string): void {
        const changed = this.setModel(content);
        this.replaceEditorHtml(this.htmlContent);
        if (changed) this.bus.emit('content');
    }

    private setModel(content: string): boolean {
        if (content === this.htmlContent) return false;
        this.htmlContent = content;
        this.requestUpdate();
        return true;
    }

    private memo<T>(compute: (source: string) => T): () => T {
        let key: string | undefined;
        let result: T;
        return () => {
            if (key !== this.htmlContent) {
                result = compute(this.htmlContent);
                key = this.htmlContent;
            }
            return result;
        };
    }

    private undecorated(root: HTMLElement): string {
        if (!root.querySelector('pre > code span.token')) return root.innerHTML;
        const copy = root.cloneNode(true) as HTMLElement;
        stripCodeHighlighting(copy);
        return copy.innerHTML;
    }

    /** Re-reads the editable into the model and publishes it when the value changed. */
    private syncContent(source: 'input' | 'command' = 'command'): void {
        if (this.readContent() === null) return;
        const output = this.mode === 'markdown' ? this.markdownOutput : this.htmlContent;
        if (output === this.lastOutput) return;
        this.lastOutput = output;
        this.value = output;
        this.emit('value-change', { value: output, html: this.htmlContent, markdown: this.markdownOutput });
        if (source === 'command') this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }

    /** Re-judges the document under the current resource policy and shows the result. */
    private rejudge(): void {
        if (!this.editable) return;
        this.swapContent(this.sanitizer.sanitize(this.htmlContent));
    }

    private placeCaretAtEnd(): void {
        const root = this.editable;
        const selection = this.getSelection();
        if (!root || !selection) return;
        const range = new Range();
        range.selectNodeContents(root);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Selection

    getSelection(): Selection | null {
        return this.doc.getSelection();
    }

    private rangeInEditor(): Range | null {
        const selection = this.getSelection();
        if (!this.editable || !selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        return this.editable.contains(range.startContainer) ? range : null;
    }

    selection(): RichTextSelectionSnapshot {
        const root = this.editable;
        const range = this.rangeInEditor();
        if (!root || !range) return { kind: 'none', text: '', range: null, imageElement: null, closestWithAttrs: () => null };
        const image = this.selected;
        if (image) {
            return {
                kind: 'image', text: '', range: range.cloneRange(), imageElement: image,
                closestWithAttrs: (attrs) => closestWithAttrs(image, attrs, root),
            };
        }
        const text = range.toString();
        return {
            kind: text.length > 0 ? 'text' : 'none', text, range: range.cloneRange(), imageElement: null,
            closestWithAttrs: (attrs) => closestWithAttrs(range.startContainer, attrs, root),
        };
    }

    saveSelection(): void {
        const range = this.rangeInEditor();
        if (range) this.savedRange = range.cloneRange();
    }

    get savedSelection(): Range | null {
        const range = this.savedRange;
        return range && this.editable?.contains(range.startContainer) ? range : null;
    }

    /**
     * Puts the caret back inside the editable: the live selection when it is already there, else the
     * saved range, else the end of the content, so an insert always lands in the text.
     */
    restoreSelection(options?: { preferLive?: boolean }): void {
        const root = this.editable;
        const selection = this.getSelection();
        if (!root || !selection) return;
        if (options?.preferLive !== false && this.rangeInEditor()) return;
        this.focusEditor();
        selection.removeAllRanges();
        if (this.savedRange && root.contains(this.savedRange.startContainer)) {
            selection.addRange(this.savedRange);
            return;
        }
        this.placeCaretAtEnd();
    }

    private focusEditor(): void {
        this.editable?.focus();
    }

    /** Drops caret-anchor characters from text nodes that now hold real text, keeping the selection where it was. */
    private sweepSpentCaretAnchors(root: HTMLElement): void {
        const walker = this.doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const spent: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node as Text;
            if (text.data.includes(ZERO_WIDTH) && text.data.replaceAll(ZERO_WIDTH, '').length > 0) spent.push(text);
        }
        if (spent.length === 0) return;
        const selection = this.getSelection();
        const live = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        // Writing a text node's data collapses any selection inside it, so both ends are captured first.
        const anchor = live && {
            start: live.startContainer, startOffset: live.startOffset, end: live.endContainer, endOffset: live.endOffset,
        };
        const before = new Map(spent.map((node) => [node, node.data]));
        for (const node of spent) node.data = node.data.replaceAll(ZERO_WIDTH, '');
        if (!anchor || !selection) return;
        const restored = new Range();
        restored.setStart(anchor.start, offsetAfterSweep(anchor.start, anchor.startOffset, before));
        restored.setEnd(anchor.end, offsetAfterSweep(anchor.end, anchor.endOffset, before));
        selection.removeAllRanges();
        selection.addRange(restored);
    }

    // Editable events

    private readonly onInput = (event: Event): void => {
        const root = this.editable;
        if (!root || this.isDisabled || this.readonly) return;
        const transformed = this.inputTransforms.run(event);
        this.sweepSpentCaretAnchors(root);
        this.notifyInputObservers(root);
        this.syncContent('input');
        if (transformed) this.pushHistory();
        else this.providers.history?.schedule();
    };

    private notifyInputObservers(root: HTMLElement): void {
        if (this.inputObservers.size === 0) return;
        const blockAware = root.innerHTML
            .replaceAll(/<br\s*\/?>/gi, '\n')
            .replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');
        const text = this.sanitizer.stripTags(blockAware);
        const selection = this.getSelection();
        const caret = selection?.anchorNode ? this.textOffsetWithin(root, selection.anchorNode, selection.anchorOffset) : text.length;
        for (const observer of this.inputObservers) observer(text, caret);
    }

    private textOffsetWithin(root: HTMLElement, node: Node, offset: number): number {
        const range = new Range();
        range.selectNodeContents(root);
        range.setEnd(node, offset);
        return range.toString().length;
    }

    private readonly onPaste = (event: ClipboardEvent): void => {
        // Nothing reaches the DOM unfiltered; a paste controller inserts what it accepts.
        event.preventDefault();
        this.flushPendingHistoryPush();
        if (this.isDisabled || this.readonly || this.pasteInterceptors.run(event)) event.stopImmediatePropagation();
    };

    private readonly onFocus = (): void => {
        this.valueAtFocus = this.value;
        this.dispatchEvent(new FocusEvent('focus', { composed: true }));
    };

    private readonly onBlur = (): void => {
        this.saveSelection();
        this.flushPendingHistoryPush();
        this.dispatchEvent(new FocusEvent('blur', { composed: true }));
        if (this.value !== this.valueAtFocus) this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private readonly onClick = (event: MouseEvent): void => {
        this.setSelectedImage(event.target instanceof HTMLImageElement ? event.target : null);
    };

    private readonly onDragOver = (event: DragEvent): void => {
        if (this.isDisabled || this.readonly || !event.dataTransfer?.types.includes('Files')) return;
        if (!this.dropZonePredicates.run(event)) return;
        event.preventDefault();
        this.dragOver = true;
    };

    private readonly onDragLeave = (event: DragEvent): void => {
        const current = event.currentTarget;
        const related = event.relatedTarget;
        if (!(current instanceof Node) || !(related instanceof Node) || !current.contains(related)) this.dragOver = false;
    };

    private readonly onDrop = (event: DragEvent): void => {
        this.dragOver = false;
        if (this.isDisabled || this.readonly) return;
        if (this.dropInterceptors.run(event)) event.stopImmediatePropagation();
    };

    // Rendering the light-DOM parts

    private syncEditable(): void {
        const root = this.editable;
        if (!root) return;
        const locale = this.resolvedLocale.editor;
        const hint = this.placeholder || locale.placeholder;
        const describedBy = [this.ariaDescribedby, this.counterElement ? this.counterId : null].filter(Boolean).join(' ');
        const popup = this.suggestionPopup;
        root.tabIndex = this.isDisabled ? -1 : 0;
        setAttribute(root, 'contenteditable', String(!this.isDisabled && !this.readonly));
        setAttribute(root, 'aria-disabled', String(this.isDisabled));
        setAttribute(root, 'aria-readonly', this.readonly ? 'true' : null);
        setAttribute(root, 'placeholder', hint);
        setAttribute(root, 'aria-placeholder', hint);
        setAttribute(root, 'aria-label', this.ariaLabel || locale.ariaLabel);
        setAttribute(root, 'aria-labelledby', this.ariaLabelledby);
        setAttribute(root, 'aria-describedby', describedBy || null);
        setAttribute(root, 'aria-expanded', popup ? 'true' : null);
        setAttribute(root, 'aria-controls', popup?.controlsId ?? null);
        setAttribute(root, 'aria-activedescendant', popup?.activeOptionId ?? null);
        setAttribute(root, 'dir', this.resolvedDir);
        root.style.minHeight = this.minHeight;
        root.style.maxHeight = this.maxHeight;
    }

    /** The counter is a light-DOM sibling so the editable's `aria-describedby` can name it. */
    private syncCounter(): void {
        const showCharacters = this.counter === 'characters' || this.counter === 'both';
        const showWords = this.counter === 'words' || this.counter === 'both';
        if (!this.editable || (!showCharacters && !showWords)) {
            this.counterElement?.remove();
            this.counterElement = undefined;
            this.counterKey = '';
            return;
        }
        const locale = this.resolvedLocale.editor;
        const parts: string[] = [];
        const atLimit = this.maxLength !== undefined && this.characterCount >= this.maxLength;
        if (showCharacters) {
            const limit = this.maxLength ? ` (${this.maxLength} max)` : '';
            parts.push(interpolate(locale.characters, { count: this.characterCount }) + limit);
        }
        if (showWords) parts.push(interpolate(locale.words, { count: this.wordCount }));
        const key = `${parts.join('|')}|${atLimit}`;
        if (!this.counterElement) {
            const element = this.doc.createElement('output');
            element.id = this.counterId;
            element.slot = 'counter';
            element.dataset['slot'] = 'counter';
            element.setAttribute('aria-live', 'polite');
            this.append(element);
            this.counterElement = element;
        }
        if (key === this.counterKey) return;
        this.counterKey = key;
        this.counterElement.replaceChildren(...parts.map((text, index) => {
            const span = this.doc.createElement('span');
            span.textContent = text;
            span.toggleAttribute('data-at-limit', atLimit && showCharacters && index === 0);
            return span;
        }));
    }

    /** Reports what changed in the content since the last update: blocked resources and the word count. */
    private announce(): void {
        if (this.announcedFor !== this.htmlContent) {
            this.announcedFor = this.htmlContent;
            reportResourceDecisions(this.sanitizer.drainResourceDecisions(), (decision) => this.emit('image-blocked', decision), 'rich-text-editor');
            if (this.announcedWords !== this.wordCount) {
                this.announcedWords = this.wordCount;
                this.emit('word-count-change', this.wordCount);
            }
        }
        if (this.announcedDisabled !== this.isDisabled) {
            this.announcedDisabled = this.isDisabled;
            this.bus.emit('disabled');
            this.bus.emit('state');
        }
    }

    private updateValidity(): void {
        const error = validateRichText(this.value, { required: this.required, minWords: this.minWords, maxLength: this.maxLength });
        if (error) this.internals?.setValidity(richTextValidityFlag(error), VALIDATION_MESSAGES[error.key], this.editable);
        else this.internals?.setValidity({});
    }
}
