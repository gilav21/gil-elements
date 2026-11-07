import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-menu-sub-item.css?inline';

/**
 * A row of a sub-menu; like a menu item it positions an action.
 *
 * @slot - A `ge-sidebar-menu-sub-button` and optionally an action.
 */
export class GeSidebarMenuSubItem extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'listitem');
        this.dataset.slot = 'sidebar-menu-sub-item';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
