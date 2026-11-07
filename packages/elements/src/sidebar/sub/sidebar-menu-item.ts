import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-menu-item.css?inline';

/**
 * A row of the menu. It is the positioning box of a menu badge or action, and the place a hover-only action reveals from.
 *
 * @slot - The button or link, and optionally a badge, an action or a sub-menu.
 */
export class GeSidebarMenuItem extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'listitem');
        this.dataset.slot = 'sidebar-menu-item';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
