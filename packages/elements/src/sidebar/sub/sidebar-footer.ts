import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-footer.css?inline';

/**
 * The bottom of the sidebar, pushed down by an auto top margin.
 *
 * @slot - The footer content.
 */
export class GeSidebarFooter extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="footer" data-slot="sidebar-footer"><slot></slot></div>`;
    }
}
