import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { NAVIGATION_MENU_ITEM_REGISTER, type NavigationMenuItemHost } from './navigation-menu-item.js';
import css from './navigation-menu-trigger.css?inline';

/**
 * The button that opens its item's dropdown. Hovering the item opens it too; clicking or tapping toggles it, so
 * clicking a hover-opened trigger closes the panel.
 *
 * @slot - The label.
 */
export class GeNavigationMenuTrigger extends UiElement {
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    private item?: NavigationMenuItemHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'navigation-menu-trigger';
        this.item = findParent<NavigationMenuItemHost, GeNavigationMenuTrigger>(this, NAVIGATION_MENU_ITEM_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.item = undefined;
    }

    protected override render() {
        const open = this.item?.open ?? false;
        return html`<button
            type="button"
            part="base"
            class="base"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded=${open}
            data-state=${open ? 'open' : 'closed'}
            @click=${() => this.item?.toggle()}
        >
            <slot></slot>
            <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>`;
    }
}
