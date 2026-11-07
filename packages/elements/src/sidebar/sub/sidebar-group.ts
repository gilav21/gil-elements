import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-group.css?inline';

/**
 * A labelled section of the sidebar.
 *
 * @slot - A `ge-sidebar-group-label` and a `ge-sidebar-group-content`.
 */
export class GeSidebarGroup extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="group" data-slot="sidebar-group"><slot></slot></div>`;
    }
}
