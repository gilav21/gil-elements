import type { RichTextSanitizer } from './rich-text-sanitizer.js';
import type { RichTextMarkdown } from './rich-text-markdown.js';
import type { RichTextLocale } from './rich-text-locales.js';
import type {
    RichTextHistoryEntrySnapshot,
    RichTextInlineStyle,
    RichTextSelectionInlineStyle,
} from './rich-text-host.js';

/** Undo-history tuning; every field optional. */
export interface RichTextHistoryOptions {
    /** Snapshots retained; oldest dropped past it. Default 100, floor 10. */
    readonly limit?: number;
    /** Quiet time after typing before a snapshot is taken. Default 450. */
    readonly debounceMs?: number;
    /** Record each external `value` write as an undoable entry. Default off. */
    readonly recordExternalWrites?: boolean;
}

export type RichTextToolbarPosition = 'top' | 'floating' | 'none';
export type RichTextCounterMode = 'characters' | 'words' | 'both';

/** The editor's settings as a controller reads them; always the live values. */
export interface RichTextConfig {
    readonly maxLength: number | undefined;
    readonly history: RichTextHistoryOptions;
    readonly markdownShortcuts: boolean;
    readonly findDebounceMs: number;
    readonly codeHighlightDebounceMs: number;
    readonly toolbar: RichTextToolbarPosition;
    readonly toolbarItems: readonly string[] | undefined;
}

/** The undo stack; supplied by the history controller. Until then the element behaves as if history were empty. */
export interface RichTextHistoryProvider {
    /** Records the current content as one entry now. */
    push(): void;
    /** Records the current content after the typing-quiet delay. */
    schedule(): void;
    /** Records a pending debounced entry immediately. */
    flush(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
    entries(): readonly RichTextHistoryEntrySnapshot[];
    index(): number;
    reconstruct(index: number): { html: string; markdown: string } | null;
    /** Jumps to an entry without pushing a new one. */
    restore(index: number): void;
}

/** Content insertion; supplied by the insert controller. */
export interface RichTextInsertProvider {
    /** Public `insertText`: at the restored caret, guarded, one history entry. */
    text(text: string): void;
    /** Public `insertHtml`: sanitized, at the restored caret, guarded, one history entry. */
    html(html: string): void;
    textAtCaret(text: string): void;
    htmlAtCaret(html: string): void;
    block(html: string): void;
    fromOverlay(text: string): void;
}

/** Inline typography at the selection; supplied by the inline-format controller. */
export interface RichTextInlineStyleProvider {
    apply(style: RichTextInlineStyle): void;
    current(): RichTextSelectionInlineStyle;
}

/** Block commands on one block; supplied by the block controller. */
export interface RichTextBlockProvider {
    execute(command: string, block: HTMLElement | null): void;
}

export interface RichTextProviders {
    history: RichTextHistoryProvider;
    insert: RichTextInsertProvider;
    inlineStyle: RichTextInlineStyleProvider;
    blocks: RichTextBlockProvider;
}

/**
 * What the element offers its controllers beyond `RichTextCoreHost`: services, settings, the hooks
 * that let a controller plug a capability into the element, and a few state cells.
 */
export interface RichTextShellHost {
    readonly sanitizer: RichTextSanitizer;
    readonly markdown: RichTextMarkdown;
    readonly resolvedLocale: RichTextLocale;
    readonly config: RichTextConfig;
    /** Plugs a capability in; the returned teardown unplugs exactly this one. */
    provide<K extends keyof RichTextProviders>(key: K, provider: RichTextProviders[K]): () => void;
    /** Runs on every input event before the content is read; return true when it rewrote the content. */
    addInputTransform(fn: (event: Event) => boolean): () => void;
    /** Formats active at the caret, as the toolbar shows them. */
    readonly activeFormats: ReadonlySet<string>;
    setActiveFormats(formats: ReadonlySet<string>): void;
    readonly selectedImage: HTMLImageElement | null;
    setSelectedImage(image: HTMLImageElement | null): void;
    /** Captions the images the resource policy refused; call after a sanitized insert. */
    labelBlockedImages(): void;
    canRunShortcutAction(id: string): boolean;
    runShortcutAction(id: string): void;
}
