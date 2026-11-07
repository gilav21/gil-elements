import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { NAVIGATION_MENU_ITEM_REGISTER, type NavigationMenuItemHost } from './navigation-menu-item.js';

/**
 * The dropdown panel (`role="menu"`); it draws nothing until its item is open. It is placed under the item,
 * start-aligned, and never wider than the screen.
 *
 * @slot - Links, or any content.
 */
export class GeNavigationMenuContent extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(`:host{--_d:var(--density-menu,var(--density,1));position:absolute;inset-inline-start:0;top:100%;box-sizing:border-box;min-width:200px;max-width:calc(100vw - 2rem);margin-top:0.375rem;padding:calc(1rem * var(--_d));border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);background-color:var(--popover);color:var(--popover-foreground);box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1);text-align:start}
:host(:not([data-state="open"])){display:none}`),
    ];

    private item?: NavigationMenuItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.dataset.slot = 'navigation-menu-content';
        this.item = findParent<NavigationMenuItemHost, GeNavigationMenuContent>(this, NAVIGATION_MENU_ITEM_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item = undefined;
    }

    protected override updated(): void {
        if (this.item?.open) this.dataset.state = 'open';
        else delete this.dataset.state;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
