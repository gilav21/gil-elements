import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { registerLayer } from '../shared/overlay.js';

export const CONTEXT_MENU_REGISTER = 'ge-context-menu-register';

/** One row of the data-driven `items`. */
export interface ContextMenuItem {
    label?: string;
    shortcut?: string;
    disabled?: boolean;
    /** `item` (default), `separator`, `label` or `sub`. */
    type?: 'item' | 'separator' | 'label' | 'sub';
    /** The rows of a `sub` submenu. */
    children?: ContextMenuItem[];
    inset?: boolean;
    /** Runs when the row is activated by pointer or keyboard. */
    click?: (item: ContextMenuItem) => void;
}

/** What the parts of a context menu need from it. */
export interface ContextMenuHost extends HTMLElement {
    readonly open: boolean;
    /** Viewport coordinates the menu was asked to open at. */
    readonly x: number;
    readonly y: number;
    show(x: number, y: number, data?: unknown): void;
    close(): void;
    register(part: ContextMenuPart): void;
    unregister(part: ContextMenuPart): void;
}

/** A part that re-renders when the menu opens or closes. */
export interface ContextMenuPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A menu that opens at the pointer on right-click or long-press. This element holds the open state; put a
 * `ge-context-menu-trigger` (the area that answers right-click) and a `ge-context-menu-content` inside it, or set
 * `items` to have the content built for you. A click outside, a scroll, Tab or Escape closes it.
 *
 * @slot - `ge-context-menu-trigger` and `ge-context-menu-content`.
 * @attr {boolean} open - Whether the menu is showing.
 */
export class GeContextMenu extends UiElement implements ContextMenuHost {
    static override styles = [UiElement.styles, unsafeCSS(':host{display:contents}')];
    static override properties = {
        open: { type: Boolean, reflect: true },
        items: { attribute: false },
        x: { state: true },
        y: { state: true },
    };

    declare open: boolean;
    declare x: number;
    declare y: number;
    /** Whatever the caller wants the menu to carry, for example the row that was right-clicked; set by `show`. */
    data?: unknown;
    /** Builds the menu body from descriptors, nested `sub` rows included. Use this or projected content, not both. */
    declare items: ContextMenuItem[];
    private readonly parts = new Set<ContextMenuPart>();
    private release?: () => void;

    constructor() {
        super();
        this.open = false;
        this.items = [];
        this.x = 0;
        this.y = 0;
        adoptChildren<ContextMenuHost, ContextMenuPart>(this, CONTEXT_MENU_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('click', this.onOutsideClick, true);
        document.addEventListener('scroll', this.onScroll, true);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick, true);
        document.removeEventListener('scroll', this.onScroll, true);
        this.release?.();
        this.release = undefined;
    }

    register(part: ContextMenuPart): void {
        this.parts.add(part);
    }

    unregister(part: ContextMenuPart): void {
        this.parts.delete(part);
    }

    /** Opens the menu with its top-left corner at viewport coordinates `x`, `y`; it shifts to stay inside the viewport. */
    show(x: number, y: number, data?: unknown): void {
        this.x = x;
        this.y = y;
        this.data = data;
        this.open = true;
    }

    close(): void {
        this.open = false;
    }

    // Capture phase, so a handler that stops propagation cannot keep a stale menu open.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (!this.open) return;
        const inside = event.composedPath().some((node) => node instanceof Element && node.matches('ge-context-menu-content, ge-context-menu-sub-content'));
        if (!inside) this.close();
    };

    private readonly onScroll = () => {
        if (this.open) this.close();
    };

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('open')) {
            this.release?.();
            this.release = this.open && this.isConnected ? registerLayer({ modal: false, dismiss: () => this.close() }) : undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    private row(item: ContextMenuItem): TemplateResult {
        if (item.type === 'separator') return html`<ge-context-menu-separator></ge-context-menu-separator>`;
        if (item.type === 'label') return html`<ge-context-menu-label ?inset=${item.inset}>${item.label}</ge-context-menu-label>`;
        if (item.type === 'sub') {
            return html`<ge-context-menu-sub>
                <ge-context-menu-sub-trigger ?inset=${item.inset} ?disabled=${item.disabled}>${item.label}</ge-context-menu-sub-trigger>
                <ge-context-menu-sub-content>${(item.children ?? []).map((child) => this.row(child))}</ge-context-menu-sub-content>
            </ge-context-menu-sub>`;
        }
        return html`<ge-context-menu-item
            ?inset=${item.inset}
            ?disabled=${item.disabled}
            shortcut=${item.shortcut ?? ''}
            @click=${() => item.click?.(item)}
            >${item.label}</ge-context-menu-item
        >`;
    }

    protected override render() {
        return html`<slot></slot>${this.items.length > 0
            ? html`<ge-context-menu-content>${this.items.map((item) => this.row(item))}</ge-context-menu-content>`
            : nothing}`;
    }
}
