import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { arrowNavigation, ownItems } from '../../shared/menu.js';
import { deepActive } from '../../shared/overlay.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';
import css from './context-menu-content.css?inline';

const EDGE = 8;
const MENU_PANEL = 'ge-context-menu-content, ge-context-menu-sub-content';

/**
 * The panel; it is the element with `role="menu"`, and draws nothing until the menu is open. It sits in the browser's
 * top layer at the point the menu was opened, shifted to stay 8px inside the viewport. Up, Down, Home and End move
 * through the items, Tab closes the menu, and focus lands on the first enabled item.
 *
 * @slot - Items, labels, separators and submenus.
 */
export class GeContextMenuContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    private owner?: ContextMenuHost;
    private wasOpen = false;
    private frame = 0;
    private returnFocusTo: HTMLElement | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.setAttribute('popover', 'manual');
        this.tabIndex = -1;
        this.dataset.slot = 'context-menu-content';
        this.addEventListener('keydown', this.onKeydown);
        this.owner = findParent<ContextMenuHost, GeContextMenuContent>(this, CONTEXT_MENU_REGISTER);
        this.owner?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        cancelAnimationFrame(this.frame);
        this.removeEventListener('keydown', this.onKeydown);
        this.owner?.unregister(this);
        this.owner = undefined;
    }

    private focusBelongsToMenu(): boolean {
        const active = deepActive(document);
        return !!active && !!active.closest(MENU_PANEL);
    }

    protected override updated(): void {
        const open = this.owner?.open ?? false;
        if (open) this.onOpen();
        else if (this.wasOpen) this.onClose();
        this.wasOpen = open;
    }

    private onOpen(): void {
        // Opened again from another focusable target while already open: hand focus back to that one.
        const active = deepActive(document);
        if (!this.focusBelongsToMenu()) this.returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
        if (!this.matches(':popover-open')) this.showPopover();
        this.place(this.owner?.x ?? 0, this.owner?.y ?? 0);
        // Two frames: layout has to settle before the panel can be measured.
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            this.frame = requestAnimationFrame(() => this.settle());
        });
    }

    private onClose(): void {
        cancelAnimationFrame(this.frame);
        const returnTo = this.focusBelongsToMenu() ? this.returnFocusTo : null;
        this.returnFocusTo = null;
        if (this.matches(':popover-open')) this.hidePopover();
        if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    }

    private place(x: number, y: number): void {
        this.style.setProperty('--_x', `${x}px`);
        this.style.setProperty('--_y', `${y}px`);
    }

    /** Keeps the panel EDGE px inside the viewport, then puts focus on the first item. */
    private settle(): void {
        const rect = this.getBoundingClientRect();
        let x = this.owner?.x ?? 0;
        let y = this.owner?.y ?? 0;
        if (x + rect.width > innerWidth) x = innerWidth - rect.width - EDGE;
        if (x < EDGE) x = EDGE;
        if (y + rect.height > innerHeight) y = innerHeight - rect.height - EDGE;
        if (y < EDGE) y = EDGE;
        this.place(x, y);
        this.focusInitial();
    }

    // Two frames after opening, a user who already arrowed into a submenu is inside the menu too; stealing their focus would send their next key to the wrong panel.
    private focusInitial(): void {
        if (this.focusBelongsToMenu()) return;
        (ownItems(this)[0] ?? this).focus({ preventScroll: true });
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === 'Tab') {
            event.preventDefault();
            this.owner?.close();
            return;
        }
        arrowNavigation(event, this, { edges: true });
    };

    protected override render() {
        return html`<slot></slot>`;
    }
}
