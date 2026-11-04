import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-menu.css?inline';

/**
 * A vertical list of `ge-sidebar-menu-item`s.
 *
 * @slot - The items.
 */
export class GeSidebarMenu extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<ul data-slot="sidebar-menu"><slot></slot></ul>`;
    }
}
