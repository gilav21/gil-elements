import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './navigation-menu-link.css?inline';

/**
 * A link row (`role="menuitem"`): a title, and optionally a description under it. Always a plain anchor
 * navigation; activating it does not close the dropdown.
 *
 * The host is the box that takes part in a grid or flex layout (`style="grid-column: span 2"`); to restyle the row itself use `::part(base)`.
 *
 * @slot - The lines of the row.
 * @attr {string} href - Where it goes. Defaults to `#`, an in-page link.
 * @attr {boolean} active - Tints the row as the current one. Purely visual: it sets no `aria-current`.
 */
export class GeNavigationMenuLink extends UiElement {
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        href: {},
        active: { type: Boolean, reflect: true },
    };

    declare href: string;
    declare active: boolean;

    constructor() {
        super();
        this.href = '#';
        this.active = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'navigation-menu-link';
    }

    protected override render() {
        return html`<a part="base" class="base" role="menuitem" href=${this.href} ?data-active=${this.active}><slot></slot></a>`;
    }
}
