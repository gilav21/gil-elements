import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The row of items (`role="menubar"`). It wraps on narrow screens instead of scrolling: a scrolling list would clip
 * the panels that hang below it.
 *
 * @slot - `ge-navigation-menu-item` elements.
 */
export class GeNavigationMenuList extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{display:flex;flex:1 1 0%;flex-wrap:wrap;align-items:center;justify-content:center;gap:0.25rem;list-style:none}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menubar');
        this.dataset.slot = 'navigation-menu-list';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
