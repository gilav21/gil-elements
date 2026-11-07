/** A candidate for the `@mention` popup. */
export interface MentionItem {
    /** Unique identifier; falls back to `value`. */
    id?: string;
    /** Machine-friendly value (username or slug), stored in `data-mention`. */
    value: string;
    /** Display name. */
    label: string;
    /** Avatar image URL; without one the label's first letter is shown. */
    avatar?: string;
    /** Secondary text under the label. */
    description?: string;
}

/** A candidate for the `#tag` popup. */
export interface TagItem {
    /** Unique identifier; falls back to `value`. */
    id?: string;
    /** Machine-friendly value, stored in `data-tag`. */
    value: string;
    label: string;
    /** CSS colour of the dot; defaults to the theme accent. */
    color?: string;
}

export type RichTextEntityType = 'mention' | 'tag';

/** `chip` is a styled inline span, `link` an anchor (needs a URL, else falls back to a chip), `text` a bare span. */
export type RichTextEntityRenderMode = 'chip' | 'link' | 'text';

/** Called after the trigger character on every keystroke (debounced); a rejection or throw shows no candidates. */
export type RichTextEntitySearchFn<T> = (query: string) => Promise<readonly T[]> | readonly T[];

/** What `buildUrl`/`buildText` get, and the tokens of `urlTemplate`/`textTemplate`. */
export interface RichTextEntityRenderContext {
    type: RichTextEntityType;
    trigger: '@' | '#';
    /** `item.id ?? item.value`. */
    id: string;
    value: string;
    label: string;
    /** The text typed after the trigger. */
    query: string;
    item: MentionItem | TagItem;
    /** Alias for `id` in mention URL templates. */
    userId: string;
    /** Alias for `id` in tag URL templates. */
    tagId: string;
}

/** How an inserted mention or tag renders. */
export interface RichTextEntityRenderOptions {
    /** @default 'chip' */
    mode?: RichTextEntityRenderMode;
    /** URL pattern with `@@token@@` or `:token` placeholders (`link` mode). Tokens: id, value, label, query, type, userId, tagId. */
    urlTemplate?: string;
    /** Display text pattern with the same tokens; defaults to trigger + label. */
    textTemplate?: string;
    /** Class(es) for the element. Sanitizing keeps only syntax-highlight classes, so style chips through the data attributes. */
    className?: string;
    /** `target` of the anchor. @default '_blank' */
    target?: string;
    /** `rel` of the anchor. @default 'noopener noreferrer' */
    rel?: string;
    /** Takes priority over `urlTemplate`. */
    buildUrl?: (context: RichTextEntityRenderContext) => string;
    /** Takes priority over `textTemplate`. */
    buildText?: (context: RichTextEntityRenderContext) => string;
}

/** The detail of the `mention-insert` and `tag-insert` events. */
export interface RichTextEntityInsertEvent {
    type: RichTextEntityType;
    trigger: '@' | '#';
    id: string;
    value: string;
    label: string;
    /** The text typed after the trigger when the item was picked. */
    query: string;
    /** The resolved URL, in link mode. */
    url?: string;
    /** The inserted element's outer HTML. */
    html: string;
    item: MentionItem | TagItem;
}
