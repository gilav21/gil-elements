import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../shared/compound.js';
import { onLongPress } from '../shared/touch.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu/context-menu.js';

/** What `node-context-menu` and the menu's `data` carry about the item that was hit. */
export interface TreeContextNode {
    /** The item's `value`. */
    key: string;
    /** The text of the item's own `ge-tree-label`, trimmed (not a child's). */
    label: string;
    expanded: boolean;
    selected: boolean;
    element: HTMLElement;
}

export interface TreeContextMenuDetail {
    node: TreeContextNode;
    /** The `contextmenu` event, or the `touchstart` that began a long press. */
    event: MouseEvent | TouchEvent;
}

/** A browser follows a long press with its own `contextmenu`; one arriving this soon is that echo, not a second request. */
const ECHO_MS = 1000;

/**
 * Wraps a `ge-tree` so that a right-click, the context-menu key or a long press on one of its items opens a
 * `ge-context-menu` at the pointer, and hands the menu the item that was hit as its `data`.
 *
 * By default it opens the `ge-context-menu` it sits in; set `for` to the id of a menu elsewhere on the page. It
 * draws no box of its own.
 *
 * With the keyboard the browser raises `contextmenu` on the tree itself (the tree keeps focus and points at an
 * item), so the menu then opens for the focused item, anchored to its row.
 *
 * @slot - The `ge-tree`.
 * @attr {string} for - The id of the `ge-context-menu` to open, for a menu that is not around this element.
 * @attr {boolean} disabled - Leaves the gesture to the browser: no menu, no event.
 * @fires node-context-menu - An item asked for the menu; `detail` is `{ node, event }` with `node` as `{ key, label, expanded, selected, element }`.
 */
export class GeTreeContextMenu extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];
    static override properties = {
        forMenu: { attribute: 'for' },
        disabled: { type: Boolean, reflect: true },
    };

    declare forMenu: string;
    declare disabled: boolean;
    private parent?: ContextMenuHost;
    private stopLongPress?: () => void;
    private lastPress: { at: number; target: EventTarget | null } | null = null;
    /** The item under the finger when it went down: `composedPath()` is empty by the time the hold completes. */
    private pressedItem: HTMLElement | null = null;

    constructor() {
        super();
        this.forMenu = '';
        this.disabled = false;
    }

    private get menu(): ContextMenuHost | undefined {
        if (!this.forMenu) return this.parent;
        const target = (this.getRootNode() as Document | ShadowRoot).getElementById(this.forMenu);
        return target && 'show' in target ? (target as ContextMenuHost) : undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'tree-context-menu';
        this.parent = findParent<ContextMenuHost, GeTreeContextMenu>(this, CONTEXT_MENU_REGISTER);
        this.addEventListener('contextmenu', this.onContextMenu);
        this.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.stopLongPress = onLongPress(this, this.onLongPress);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('contextmenu', this.onContextMenu);
        this.removeEventListener('touchstart', this.onTouchStart);
        this.stopLongPress?.();
        this.parent = undefined;
    }

    /** The innermost item a gesture landed on. A row lives in the item's shadow root, so `closest` alone would stop at it. */
    private itemAt(event: Event): HTMLElement | null {
        const hit = event.composedPath().find((node) => node instanceof HTMLElement && node.dataset.slot === 'tree-item');
        return (hit as HTMLElement | undefined) ?? null;
    }

    /** The row of the item the tree is pointing at, for a gesture that carries no item (the context-menu key). */
    private focusedItem(): HTMLElement | null {
        return this.querySelector<HTMLElement>('[data-slot="tree-item"][data-focused="true"]');
    }

    private nodeOf(item: HTMLElement): TreeContextNode {
        // Nested items render inside their parent, so the first label in the subtree may belong to a child.
        const own = [...item.querySelectorAll('[data-slot="tree-label"]')].find((label) => label.closest('[data-slot="tree-item"]') === item);
        return {
            key: (item as HTMLElement & { value?: string }).value ?? item.getAttribute('value') ?? '',
            label: own?.textContent?.trim() ?? '',
            expanded: item.dataset.expanded === 'true',
            selected: item.dataset.selected === 'true',
            element: item,
        };
    }

    private open(item: HTMLElement, x: number, y: number, event: MouseEvent | TouchEvent): void {
        const node = this.nodeOf(item);
        this.dispatchEvent(new CustomEvent<TreeContextMenuDetail>('node-context-menu', { detail: { node, event }, bubbles: true, composed: true }));
        this.menu?.show(x, y, node);
    }

    private readonly onContextMenu = (event: MouseEvent) => {
        if (this.disabled) return;
        const echo = this.lastPress;
        if (echo && Date.now() - echo.at < ECHO_MS) {
            event.preventDefault();
            return;
        }
        const hit = this.itemAt(event);
        if (hit) {
            event.preventDefault();
            this.open(hit, event.clientX, event.clientY, event);
            return;
        }
        const focused = this.focusedItem();
        if (!focused) return;
        event.preventDefault();
        const row = focused.shadowRoot?.querySelector('.header')?.getBoundingClientRect() ?? focused.getBoundingClientRect();
        this.open(focused, row.left + Math.min(row.width / 2, 24), row.bottom, event);
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        this.pressedItem = this.itemAt(event);
    };

    private readonly onLongPress = (event: TouchEvent) => {
        if (this.disabled) return;
        const hit = this.pressedItem;
        const touch = event.touches[0] ?? event.changedTouches[0];
        if (!hit || !touch) return;
        this.lastPress = { at: Date.now(), target: event.target };
        this.open(hit, touch.clientX, touch.clientY, event);
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}
