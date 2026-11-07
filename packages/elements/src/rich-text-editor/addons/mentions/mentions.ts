import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { caretRect, node, SuggestionPopup } from '../shared-popup.js';
import { mentionsLocales, type MentionsLocale } from './mentions-locale.js';
import type {
    MentionItem,
    RichTextEntityInsertEvent,
    RichTextEntityRenderOptions,
    RichTextEntitySearchFn,
    RichTextEntityType,
    TagItem,
} from './mentions-types.js';
import { buildEntityInsertNode, buildEntityRenderContext, detectTrigger, selectTriggerRange } from './mentions-utils.js';
import css from './mentions.css?inline';

export interface MentionsOptions extends RichTextAddonOptions {
    /** Open the popup on `@`. Default true. */
    readonly mentions?: boolean;
    readonly search?: RichTextEntitySearchFn<MentionItem>;
    readonly render?: RichTextEntityRenderOptions;
    /** Open the popup on `#`. Default false. */
    readonly tags?: boolean;
    readonly tagsSearch?: RichTextEntitySearchFn<TagItem>;
    readonly tagsRender?: RichTextEntityRenderOptions;
    /** Milliseconds to wait after the last keystroke before searching. Default 200. */
    readonly debounceMs?: number;
    /** A locale id or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | MentionsLocale;
}

type Entity = MentionItem | TagItem;

const MAX_ITEMS = 10;
const KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);

function containerElement(range: Range): Element | null | undefined {
    const container = range.startContainer;
    return container instanceof Element ? container : container.parentElement;
}

class MentionsController {
    private type: RichTextEntityType = 'mention';
    private query = '';
    private items: readonly Entity[] = [];
    private run = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private readonly popup: SuggestionPopup<Entity>;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly options: MentionsOptions,
        private readonly locale: MentionsLocale,
    ) {
        this.popup = new SuggestionPopup({
            host,
            keys: KEYS,
            dismissOnEditorPointer: true,
            fill: (option, item) => this.fill(option, item),
            onSelect: (item) => this.insert(item),
            onDismiss: () => this.close(),
        });
    }

    readonly observe = (): void => {
        const doc = this.host.doc;
        if (this.host.isDisabled || this.host.readonly) return this.close();
        const match = detectTrigger(doc, this.options.mentions ?? true, this.options.tags ?? false);
        if (!match) return this.close();
        this.type = match.type;
        this.query = match.query;
        const selection = doc.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
        const anchor = range ? caretRect(range, containerElement(range)) : null;
        this.show(anchor);
        this.schedule(match.type, match.query);
    };

    readonly keydown = (event: KeyboardEvent): boolean => this.popup.handleKey(event);

    close(): void {
        this.run++;
        clearTimeout(this.timer);
        this.items = [];
        this.query = '';
        this.popup.close();
    }

    private show(anchor?: DOMRect | null): void {
        const mention = this.type === 'mention';
        this.popup.show({
            items: this.items,
            label: mention ? this.locale.selectUser : this.locale.selectTag,
            emptyText: mention ? this.locale.noUsersFound : this.locale.noTagsFound,
            anchor,
        });
    }

    private schedule(type: RichTextEntityType, query: string): void {
        clearTimeout(this.timer);
        const run = ++this.run;
        this.timer = setTimeout(() => void this.search(type, query, run), this.options.debounceMs ?? 200);
    }

    /** A failing search shows no candidates; a newer keystroke makes an older result stale. */
    private async search(type: RichTextEntityType, query: string, run: number): Promise<void> {
        let found: readonly Entity[] = [];
        try {
            found = (await (type === 'mention' ? this.options.search : this.options.tagsSearch)?.(query)) ?? [];
        } catch {
            found = [];
        }
        if (run !== this.run) return;
        this.items = found.slice(0, MAX_ITEMS);
        this.show();
    }

    private fill(option: HTMLElement, item: Entity): void {
        const row = node('div', 'row');
        if (this.type === 'tag') {
            const dot = node('span', 'dot');
            if ('color' in item && item.color) dot.style.backgroundColor = item.color;
            row.append(dot, node('span', 'label', item.label));
        } else {
            row.append(...this.userCells(item));
        }
        option.append(row);
    }

    private userCells(item: Entity): HTMLElement[] {
        const avatar = 'avatar' in item ? item.avatar : undefined;
        const description = 'description' in item ? item.description : undefined;
        const src = avatar ? this.host.sanitizer.sanitizeUrl(avatar) : null;
        const picture = node('img', 'avatar');
        if (src) {
            picture.src = src;
            picture.alt = item.label;
        }
        const text = node('div', 'text');
        text.append(node('span', 'label', item.label));
        if (description) text.append(node('span', 'description', description));
        return [src ? picture : node('div', 'avatar', item.label.charAt(0).toUpperCase()), text];
    }

    private insert(item: Entity): void {
        const { host, type, query } = this;
        const mention = type === 'mention';
        const trigger = mention ? '@' : '#';
        const context = buildEntityRenderContext(item, type, trigger, query);
        const { element, url } = buildEntityInsertNode(
            host.doc,
            context,
            (mention ? this.options.render : this.options.tagsRender) ?? {},
            (raw) => host.sanitizer.sanitizeUrl(raw),
        );
        if (!host.selection().range) host.restoreSelection();
        host.mutateContent((root) => this.place(root, element, trigger + query));
        const detail: RichTextEntityInsertEvent = {
            type, trigger, id: context.id, value: context.value, label: context.label, query, url, html: element.outerHTML, item,
        };
        host.emit(mention ? 'mention-insert' : 'tag-insert', detail);
        this.close();
        host.contentRoot.focus();
    }

    private place(root: HTMLElement, element: HTMLElement, trigger: string): void {
        const doc = this.host.doc;
        const selection = doc.getSelection();
        if (!selection || selection.rangeCount === 0) {
            root.append(element);
            return;
        }
        const range = selection.getRangeAt(0);
        selectTriggerRange(doc, range, trigger, root);
        range.deleteContents();
        const space = doc.createTextNode(' ');
        range.insertNode(space);
        range.insertNode(element);
        const after = doc.createRange();
        after.setStart(space, space.length);
        after.collapse(true);
        selection.removeAllRanges();
        selection.addRange(after);
    }
}

export const mentionsAddon = defineAddon<MentionsOptions>('mentions', 0, ({ host, options, life }) => {
    const controller = new MentionsController(host, options, resolveAddonLocale(mentionsLocales, host, options.locale));
    life.add(host.adoptStyles(css, 'document'));
    life.add(host.registerInputObserver(controller.observe));
    life.add(host.registerKeydownInterceptor(controller.keydown));
    life.add(() => controller.close());
});
