import { html, nothing, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-menu-link.css?inline';

/**
 * A link row of the menu. On a collapsed rail it shows only its first child (the icon). A native `click` event
 * bubbles from it.
 *
 * @slot - Usually an icon followed by a `<span>` label; every child after the first is hidden on a collapsed rail.
 * @attr {string} href - Where it goes. Defaults to `#`.
 * @attr {string} target - The link target.
 * @attr {boolean} active - Marks the current page: highlights the row and sets `aria-current="page"`.
 * @csspart base - The `<a>`.
 */
export class GeSidebarMenuLink extends GeSidebarPart {
    static override styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override properties = {
        href: {},
        target: {},
        active: { type: Boolean, reflect: true },
    };

    declare href: string;
    declare target: string;
    declare active: boolean;

    constructor() {
        super();
        this.href = '#';
        this.target = '';
        this.active = false;
    }

    protected override render() {
        return html`<a
            part="base"
            data-slot="sidebar-menu-link"
            href=${this.href}
            target=${this.target || nothing}
            ?data-active=${this.active}
            ?data-collapsed=${this.collapsedState}
            aria-current=${this.active ? 'page' : nothing}
        >
            <slot></slot>
        </a>`;
    }
}
