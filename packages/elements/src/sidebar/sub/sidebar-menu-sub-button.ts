import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-menu-sub-button.css?inline';

export type SidebarMenuSubButtonSize = 'sm' | 'md';

/**
 * A link row of a sub-menu. A native `click` event bubbles from it.
 *
 * @slot - Usually a `<span>` label, optionally after an icon.
 * @attr {string} href - Where it goes. Defaults to `#`.
 * @attr {string} target - The link target.
 * @attr {boolean} active - Marks the current page: highlights the row and sets `aria-current="page"`.
 * @attr {'sm' | 'md'} size - Row height, 28px or 32px.
 * @csspart base - The `<a>`.
 */
export class GeSidebarMenuSubButton extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        href: {},
        target: {},
        active: { type: Boolean, reflect: true },
        size: { reflect: true },
    };

    declare href: string;
    declare target: string;
    declare active: boolean;
    declare size: SidebarMenuSubButtonSize;

    constructor() {
        super();
        this.href = '#';
        this.target = '';
        this.active = false;
        this.size = 'sm';
    }

    protected override render() {
        return html`<a
            part="base"
            data-slot="sidebar-menu-sub-button"
            href=${this.href}
            target=${this.target || nothing}
            ?data-active=${this.active}
            data-size=${this.size}
            aria-current=${this.active ? 'page' : nothing}
        >
            <slot></slot>
        </a>`;
    }
}
