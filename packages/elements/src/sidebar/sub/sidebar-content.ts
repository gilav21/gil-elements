import '../../scroll-area/define.js';
import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-content.css?inline';

/**
 * The scrolling middle of the sidebar; it takes the space between the header and the footer.
 *
 * @slot - The groups.
 */
export class GeSidebarContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<ge-scroll-area data-slot="sidebar-content"><slot></slot></ge-scroll-area>`;
    }
}
