import type { TemplateResult } from 'lit';
import type { RichTextCommandRegistry } from './rich-text-command-registry.js';
import type { SlotRegistry } from './rich-text-registry.js';

/** Every toolbar command `format()` accepts; the single source for the type and for runtime checks. */
export const RICH_TEXT_FORMAT_COMMANDS = [
    'bold',
    'italic',
    'underline',
    'strikethrough',
    'paragraph',
    'heading1',
    'heading2',
    'heading3',
    'bulletList',
    'orderedList',
    'blockquote',
    'code',
    'codeBlock',
    'clear',
    'alignLeft',
    'alignCenter',
    'alignRight',
    'indent',
    'outdent',
    'taskList',
    'horizontalRule',
] as const;

export type RichTextFormatCommand = (typeof RICH_TEXT_FORMAT_COMMANDS)[number];

export function isRichTextFormatCommand(value: string): value is RichTextFormatCommand {
    return (RICH_TEXT_FORMAT_COMMANDS as readonly string[]).includes(value);
}

export type RichTextTopic = 'state' | 'selection' | 'history' | 'disabled' | 'content';

/**
 * An addon-contributed toolbar item, rendered after the built-ins.
 * Either a button slot (`icon` + `tooltip` + `onClick`) or a component slot
 * (`render` or `tag`, which wins over the button fields and owns its trigger UI).
 */
export interface RichTextToolbarSlot {
    /** Stable id, also the `data-addon-slot` value. */
    readonly id: string;
    /** Inline SVG markup for the button glyph. */
    readonly icon?: string;
    readonly tooltip?: string;
    /** Sort order among slots; lower first. */
    readonly order?: number;
    readonly isEnabled?: () => boolean;
    readonly isActive?: () => boolean;
    readonly onClick?: (event: Event) => void;
    /** Rendered in place of a button. */
    readonly render?: () => TemplateResult;
    /** Custom element tag created in place of a button; receives a `compact` attribute in the floating toolbar. */
    readonly tag?: string;
}

/** Read-only projection of one history entry; the delta and serialized selection stay private. */
export interface RichTextHistoryEntrySnapshot {
    readonly index: number;
    /** Capture time, epoch milliseconds. */
    readonly timestamp: number;
    /** Single-line truncated plain-text preview. */
    readonly preview: string;
    readonly previewLines: readonly string[];
    readonly lineCount: number;
}

/** Inline style an addon applies to the selection; a caller sets only the property it owns. */
export interface RichTextInlineStyle {
    readonly color?: string;
    readonly backgroundColor?: string;
    /** CSS font size, e.g. `18px`. */
    readonly fontSize?: string;
    readonly fontFamily?: string;
}

/** The inline style at the caret as raw computed browser values (`rgb(...)`, `18px`, first family). */
export interface RichTextSelectionInlineStyle {
    readonly color: string;
    readonly backgroundColor: string;
    readonly fontSize: string;
    readonly fontFamily: string;
}

export interface RichTextSelectionSnapshot {
    readonly kind: 'text' | 'image' | 'none';
    /** Selected text; '' for image or none. */
    readonly text: string;
    /** A clone of the selection range. */
    readonly range: Range | null;
    readonly imageElement: HTMLImageElement | null;
    /** Nearest ancestor element carrying any of the attributes, if the caret sits inside one. */
    closestWithAttrs(attrs: readonly string[]): HTMLElement | null;
}

export interface CommitOptions {
    /** Skip the history entry. */
    readonly history?: boolean;
    /** Return focus to the editable. */
    readonly focus?: boolean;
}

/** Membership in the toolbar's mutually exclusive popover group. */
export interface RichTextExclusivePopover {
    /** Announce that this panel just opened, closing every other member. */
    readonly notifyOpened: () => void;
    readonly release: () => void;
}

/** The stable surface controllers and addons reach the editor through. */
export interface RichTextEditorHost {
    readonly element: HTMLElement;
    /** The contenteditable. */
    readonly contentRoot: HTMLElement;
    /** Positioned container an overlay addon may append to. */
    readonly overlayAnchor: HTMLElement;
    readonly doc: Document;
    /** The only way controllers read the selection, so the source stays swappable. */
    getSelection(): Selection | null;
    /** Disabled by attribute or by the surrounding form. */
    readonly isDisabled: boolean;
    readonly readonly: boolean;
    readonly isRtl: boolean;
    readonly mode: 'markdown' | 'html';
    subscribe(topic: RichTextTopic, fn: () => void): () => void;
    selection(): RichTextSelectionSnapshot;
    readonly selectionInlineStyle: RichTextSelectionInlineStyle;
    saveSelection(): void;
    restoreSelection(options?: { preferLive?: boolean }): void;
    /** Runs `fn` against the content root as one transaction: history entry, sanitize, change events. */
    mutateContent(fn: (root: HTMLElement) => void): void;
    /** Re-reads the model after direct DOM edits and flushes a pending history push. */
    commitContent(): void;
    /** Syncs the model, records history, restores focus and re-detects active formats. */
    commit(options?: CommitOptions): void;
    /** Wraps the saved text selection in the built element; returns the elements created. */
    wrapSelection(build: () => HTMLElement): HTMLElement[];
    applyInlineStyle(style: RichTextInlineStyle): void;
    /** Runs a built-in command on one block; `null` targets the current selection. */
    executeToolbarCommandOnBlock(command: string, block: HTMLElement | null): void;
    insertTextAtCaret(text: string): void;
    insertHtmlAtCaret(html: string): void;
    /** Inserts block markup after the caret's line, or in its place when that line is empty. */
    insertBlockAtCaret(html: string): void;
    /** Restores the in-editor selection, inserts as one history entry and guards the mobile keyboard. */
    insertTextFromOverlay(text: string): void;
    /** Characters the document can still take; `Infinity` without `maxLength`, negative when over. */
    remainingLength(): number;
    /** Announces an open suggestion popup on the editable (WAI-ARIA combobox); `null` clears it. */
    setActiveSuggestionPopup(popup: { controlsId: string; activeOptionId: string | null } | null): void;
    readonly toolbarSlots: SlotRegistry<RichTextToolbarSlot>;
    /** This instance's slash-command registry. */
    readonly commands: RichTextCommandRegistry;
    /** Every addon toolbar panel must join, so opening one closes the others. */
    registerExclusivePopover(close: () => void): RichTextExclusivePopover;
    /** Runs before base handling; return true to consume the event. */
    registerKeydownInterceptor(fn: (event: KeyboardEvent) => boolean): () => void;
    registerPasteInterceptor(fn: (event: ClipboardEvent) => boolean): () => void;
    registerDropInterceptor(fn: (event: DragEvent) => boolean): () => void;
    /** Claims a drag so the base shows its drop zone and cancels the default. */
    registerDropZonePredicate(fn: (event: DragEvent) => boolean): () => void;
    registerInputObserver(fn: (text: string, caret: number) => void): () => void;
    /** One addon owns image files; registering replaces the previous handler. */
    registerImageFileHandler(fn: (file: File) => void): () => void;
    readonly hasImageFileHandler: boolean;
    /** Routes a file through the image owner; false when none is registered. */
    insertImageFile(file: File): boolean;
    registerLinkEditor(open: (hint?: { x: number; y: number }) => void): () => void;
    /** Opens the registered link editor; inert without one. */
    showLinkDialog(hint?: { x: number; y: number }): void;
    registerShortcutAction(id: string, run: () => void, when?: () => boolean): () => void;
    historyEntries(): readonly RichTextHistoryEntrySnapshot[];
    currentHistoryIndex(): number;
    reconstructHistoryEntry(index: number): { html: string; markdown: string } | null;
    flushPendingHistoryPush(): void;
    /** Jumps to an entry without pushing a new one, so forward entries stay redoable. */
    restoreHistoryEntry(index: number): void;
}

/** Internal extension used only by core controllers. */
export interface RichTextCoreHost extends RichTextEditorHost {
    /** Controllers register their command ids on attach; the element's `format()` is the one dispatcher. */
    readonly commandTable: Map<RichTextFormatCommand, () => void>;
    /** Lower priority runs first, after addon interceptors and shortcuts. */
    addKeyHandler(priority: number, fn: (event: KeyboardEvent) => boolean): () => void;
    pushHistory(): void;
    readContent(): string | null;
    replaceEditorHtml(html: string): void;
    /** Reset hook for state tied to the old DOM (cell selection, image selection). */
    onContentReplaced(fn: () => void): () => void;
    onSelectionMoved(fn: () => void): () => void;
    /** Requests a render for controllers that draw. */
    invalidate(): void;
    emit<T>(name: string, detail: T): void;
}

/** Plain class built as `new XController(host)`, never in the constructor of the element. */
export interface RichTextController {
    attach(): void;
    detach(): void;
}

export interface RichTextAddon {
    readonly id: string;
    /** May return a teardown. */
    setup(host: RichTextEditorHost, options?: unknown): void | (() => void);
}

/** Switches every toolbar-contributing addon accepts. */
export interface RichTextAddonOptions {
    /** Contribute the addon's toolbar button. Default true. */
    readonly toolbar?: boolean;
    /** Register the addon's slash command, where it has one. Default true. */
    readonly slashCommand?: boolean;
    /** Sort order among addon toolbar buttons; lower first. */
    readonly order?: number;
}

/** Bare (`''`), a boolean, or the options. */
export type RichTextAddonSetting = boolean | '' | RichTextAddonOptions;

export interface RichTextAddonState extends Required<RichTextAddonOptions> {
    readonly enabled: boolean;
}

/** Bare or `true` enables with defaults, `false` disables, an object enables and overrides the named fields. */
export function addonSetting(defaultOrder: number): (value: RichTextAddonSetting) => RichTextAddonState {
    const defaults: RichTextAddonState = { enabled: true, toolbar: true, slashCommand: true, order: defaultOrder };
    return (value) => {
        if (value === '' || value === true) return defaults;
        if (value === false) return { ...defaults, enabled: false };
        return { ...defaults, ...value };
    };
}
