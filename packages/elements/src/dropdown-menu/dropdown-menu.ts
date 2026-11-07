import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { INTERACTIVE } from '../shared/activator.js';
import { adoptChildren } from '../shared/compound.js';
import { deepActive, registerLayer } from '../shared/overlay.js';
import css from './dropdown-menu.css?inline';

export const DROPDOWN_MENU_REGISTER = 'ge-dropdown-menu-register';

/** One row of the data-driven `items`. */
export interface DropdownItem {
    label?: string;
    shortcut?: string;
    disabled?: boolean;
    /** `item` (default), `separator`, `label` or `sub`. */
    type?: 'item' | 'separator' | 'label' | 'sub';
    /** The rows of a `sub` submenu. */
    children?: DropdownItem[];
    inset?: boolean;
    /** Runs when the row is activated by pointer or keyboard. */
    click?: (item: DropdownItem) => void;
}

/** What the parts of a menu need from it. */
export interface DropdownMenuHost {
    readonly open: boolean;
    show(): void;
    hide(): void;
    toggle(): void;
    register(part: DropdownMenuPart): void;
    unregister(part: DropdownMenuPart): void;
}

/** A part that re-renders when the menu opens or closes. */
export interface DropdownMenuPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A menu that opens from a trigger. This element holds the open state; put a `ge-dropdown-menu-trigger` and a
 * `ge-dropdown-menu-content` inside it, or set `items` to have the content built for you. A click outside closes
 * it, and Escape closes the innermost open overlay only.
 *
 * @slot - `ge-dropdown-menu-trigger` and `ge-dropdown-menu-content`.
 * @attr {boolean} open - Whether the menu is showing.
 * @fires open-change - When the user opens or closes it; `detail` is the new state. Setting `open` yourself does not fire it.
 */
export class GeDropdownMenu extends UiElement implements DropdownMenuHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        open: { type: Boolean, reflect: true },
        items: { attribute: false },
    };

    declare open: boolean;
    /** Builds the menu body from descriptors, nested `sub` rows included. Use this or projected content, not both. */
    declare items: DropdownItem[];
    private readonly parts = new Set<DropdownMenuPart>();
    private release?: () => void;

    constructor() {
        super();
        this.open = false;
        this.items = [];
        adoptChildren<DropdownMenuHost, DropdownMenuPart>(this, DROPDOWN_MENU_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        this.release?.();
        this.release = undefined;
    }

    register(part: DropdownMenuPart): void {
        this.parts.add(part);
    }

    unregister(part: DropdownMenuPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.setOpen(true);
    }

    toggle(): void {
        this.setOpen(!this.open);
    }

    /**
     * Closes the menu. When focus is inside the panel it goes back to the trigger, since the panel is about to
     * leave; a close from an outside click leaves focus where the user put it.
     */
    hide(): void {
        const active = deepActive(document);
        const trigger = this.querySelector('ge-dropdown-menu-trigger');
        const inside = !!active && (this.contains(active) || !!this.shadowRoot?.contains(active)) && !trigger?.contains(active);
        this.setOpen(false);
        // After the key event: Enter's default action would otherwise click the trigger focus just landed on and reopen the menu.
        if (inside) setTimeout(() => this.focusTrigger());
    }

    private focusTrigger(): void {
        const trigger = this.querySelector<HTMLElement>('ge-dropdown-menu-trigger');
        (trigger?.querySelector<HTMLElement>(INTERACTIVE) ?? trigger?.shadowRoot?.querySelector<HTMLElement>('[part="base"]'))?.focus();
    }

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: next, bubbles: true, composed: true }));
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (this.open && !event.composedPath().includes(this)) this.hide();
    };

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('open')) {
            this.release?.();
            this.release = this.open && this.isConnected ? registerLayer({ modal: false, dismiss: () => this.hide() }) : undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    private row(item: DropdownItem): TemplateResult {
        if (item.type === 'separator') return html`<ge-dropdown-menu-separator></ge-dropdown-menu-separator>`;
        if (item.type === 'label') return html`<ge-dropdown-menu-label>${item.label}</ge-dropdown-menu-label>`;
        if (item.type === 'sub') {
            return html`<ge-dropdown-menu-sub>
                <ge-dropdown-menu-sub-trigger ?inset=${item.inset} ?disabled=${item.disabled}>${item.label}</ge-dropdown-menu-sub-trigger>
                <ge-dropdown-menu-sub-content>${(item.children ?? []).map((child) => this.row(child))}</ge-dropdown-menu-sub-content>
            </ge-dropdown-menu-sub>`;
        }
        return html`<ge-dropdown-menu-item
            ?inset=${item.inset}
            ?disabled=${item.disabled}
            shortcut=${item.shortcut ?? ''}
            @click=${() => item.click?.(item)}
            >${item.label}</ge-dropdown-menu-item
        >`;
    }

    protected override render() {
        return html`<slot></slot>${this.items.length > 0
            ? html`<ge-dropdown-menu-content>${this.items.map((item) => this.row(item))}</ge-dropdown-menu-content>`
            : nothing}`;
    }
}
