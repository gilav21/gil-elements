import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-header.css?inline';

/**
 * The top of the sidebar. On a collapsed rail its children stay for assistive technology but are visually hidden.
 *
 * @slot - The header content.
 */
export class GeSidebarHeader extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div class="header" data-slot="sidebar-header" ?data-collapsed=${this.collapsedState}><slot></slot></div>`;
    }
}
