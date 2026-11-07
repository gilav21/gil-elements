import type { RichTextAddonHost } from '../rich-text-host.js';
import css from './shared-popup.css?inline';

const CARET_GAP = 4;
const EDGE = 8;
const POPUP_WIDTH = 288;
const POPUP_HEIGHT = 240;
let popupCount = 0;

/** Creates an element with an optional class and text. */
export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

/** The caret's rect, or the fallback element's when the caret has none (an empty block). */
export function caretRect(range: Range, fallback: Element | null | undefined): DOMRect | null {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) return rect;
    const box = fallback?.getBoundingClientRect();
    return box && (box.width > 0 || box.height > 0) ? box : null;
}

export interface SuggestionPopupOptions<T> {
    readonly host: RichTextAddonHost;
    /** Keys the popup consumes while open. */
    readonly keys: ReadonlySet<string>;
    /** Whether a pointer press inside the editable also dismisses it. */
    readonly dismissOnEditorPointer?: boolean;
    /** Fills one option button. */
    fill(option: HTMLElement, item: T): void;
    onSelect(item: T): void;
    /** The user asked to close it: Escape, an outside press or a scroll. */
    onDismiss(): void;
}

export interface SuggestionView<T> {
    readonly items: readonly T[];
    readonly label: string;
    readonly emptyText: string;
    /** Where the caret is: given on a new trigger, it moves the popup there and resets the highlight. */
    readonly anchor?: DOMRect | null;
}

/**
 * A plain light-DOM listbox of options, shared by the addons that suggest while the user types.
 * Focus stays in the editable, which names the listbox and the active option through
 * `setActiveSuggestionPopup`, so the list must live in the same tree as the editable.
 */
export class SuggestionPopup<T> {
    private root: HTMLElement | undefined;
    private release: (() => void) | undefined;
    private items: readonly T[] = [];
    private index = 0;
    private readonly id = `rte-suggestions-${popupCount++}`;

    constructor(private readonly options: SuggestionPopupOptions<T>) {}

    get isOpen(): boolean {
        return this.root !== undefined;
    }

    get listboxId(): string {
        return this.id;
    }

    optionId(index: number): string {
        return `${this.id}-option-${index}`;
    }

    show(view: SuggestionView<T>): void {
        const root = this.root ?? this.open();
        this.items = view.items;
        if (view.anchor !== undefined) this.index = 0;
        this.index = Math.max(0, Math.min(this.index, this.items.length - 1));
        if (view.anchor) this.place(root, view.anchor);
        this.render(root, view);
        this.highlight(this.index);
    }

    /** Handles a keydown; true when the popup consumed it. */
    handleKey(event: KeyboardEvent): boolean {
        if (!this.root || !this.options.keys.has(event.key)) return false;
        event.preventDefault();
        if (this.items.length === 0) {
            if (event.key === 'Escape' || event.key === 'Tab') this.options.onDismiss();
            return true;
        }
        if (event.key === 'ArrowDown') this.highlight(Math.min(this.index + 1, this.items.length - 1));
        else if (event.key === 'ArrowUp') this.highlight(Math.max(this.index - 1, 0));
        else if (event.key === 'Escape') this.options.onDismiss();
        else this.accept(this.index);
        return true;
    }

    close(): void {
        this.release?.();
        this.release = undefined;
        this.root = undefined;
        this.index = 0;
        this.options.host.setActiveSuggestionPopup(null);
    }

    private accept(index: number): void {
        const item = this.items[index];
        if (item !== undefined) this.options.onSelect(item);
    }

    private open(): HTMLElement {
        const { host } = this.options;
        const root = node('div');
        root.id = this.id;
        root.tabIndex = -1;
        root.dataset['slot'] = 'suggestions';
        root.setAttribute('role', 'listbox');
        const unstyle = host.adoptStyles(css, 'document');
        const unmount = host.mountPopup(root);
        if ('showPopover' in root) {
            root.setAttribute('popover', 'manual');
            root.showPopover();
        }
        const doc = host.doc;
        const onPress = (event: Event): void => {
            const target = event.target instanceof Node ? event.target : null;
            if (!target || root.contains(target)) return;
            if (!this.options.dismissOnEditorPointer && host.contentRoot.contains(target)) return;
            this.options.onDismiss();
        };
        const onScroll = (event: Event): void => {
            if (!(event.target instanceof Node && root.contains(event.target))) this.options.onDismiss();
        };
        doc.addEventListener('mousedown', onPress, true);
        globalThis.addEventListener('scroll', onScroll, { capture: true, passive: true });
        this.release = () => {
            doc.removeEventListener('mousedown', onPress, true);
            globalThis.removeEventListener('scroll', onScroll, { capture: true });
            unmount();
            unstyle();
        };
        this.root = root;
        return root;
    }

    private place(root: HTMLElement, rect: DOMRect): void {
        const x = Math.max(EDGE, Math.min(rect.left, globalThis.innerWidth - POPUP_WIDTH - EDGE));
        const below = rect.bottom + CARET_GAP;
        const flipped = below + POPUP_HEIGHT > globalThis.innerHeight;
        const y = flipped ? Math.max(EDGE, rect.top - POPUP_HEIGHT - CARET_GAP) : below;
        root.style.left = `${Math.round(x)}px`;
        root.style.top = `${Math.round(y)}px`;
    }

    private render(root: HTMLElement, view: SuggestionView<T>): void {
        root.setAttribute('aria-label', view.label);
        root.replaceChildren();
        if (this.items.length === 0) {
            root.append(node('div', 'empty', view.emptyText));
            return;
        }
        const list = node('div', 'list');
        this.items.forEach((item, index) => {
            const option = node('button', 'option');
            option.type = 'button';
            option.id = this.optionId(index);
            option.setAttribute('role', 'option');
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('mouseenter', () => this.highlight(index));
            option.addEventListener('click', () => this.accept(index));
            this.options.fill(option, item);
            list.append(option);
        });
        root.append(list);
    }

    private highlight(index: number): void {
        this.index = index;
        const options = this.root?.querySelectorAll<HTMLElement>('[role="option"]') ?? [];
        options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
        const active = options[index];
        const list = active?.parentElement;
        if (active && list && (active.offsetTop < list.scrollTop || active.offsetTop + active.offsetHeight > list.scrollTop + list.clientHeight)) {
            active.scrollIntoView?.({ block: 'nearest' });
        }
        this.options.host.setActiveSuggestionPopup({ controlsId: this.id, activeOptionId: active ? this.optionId(index) : null });
    }
}
