import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-group-content.css?inline';

/**
 * The body of a group, usually a `ge-sidebar-menu`.
 *
 * @slot - The group's content.
 */
export class GeSidebarGroupContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="content" data-slot="sidebar-group-content"><slot></slot></div>`;
    }
}
