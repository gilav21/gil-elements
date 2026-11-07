import { html, nothing, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-menu-badge.css?inline';

/**
 * A count or tag pinned to the end of a menu row. On a collapsed rail it shrinks to a dot on the icon's corner.
 * It is decorative (`aria-hidden`) unless `announce` is set.
 *
 * @slot - The text, usually a number.
 * @attr {boolean} announce - Lets assistive technology read the badge.
 */
export class GeSidebarMenuBadge extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override readonly properties = { announce: { type: Boolean, reflect: true } };

    declare announce: boolean;

    constructor() {
        super();
        this.announce = false;
    }

    protected override render() {
        return html`<span data-slot="sidebar-menu-badge" ?data-collapsed=${this.collapsedState} aria-hidden=${this.announce ? nothing : 'true'}><slot></slot></span>`;
    }
}
