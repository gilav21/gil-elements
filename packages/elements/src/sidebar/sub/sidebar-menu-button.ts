import { html, unsafeCSS } from 'lit';
import { attachHint } from '../../shared/hint.js';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-menu-button.css?inline';

/**
 * A button row of the menu. On a collapsed rail it shows only its first child (the icon) and a `tooltip` bubble
 * appears on hover. A native `click` event bubbles from it.
 *
 * @slot - Usually an icon followed by a `<span>` label; every child after the first is hidden on a collapsed rail.
 * @attr {boolean} active - Highlights the row as the current one.
 * @attr {string} tooltip - Text of the bubble shown beside a collapsed rail; also the button's accessible name.
 * @csspart base - The `<button>`.
 */
export class GeSidebarMenuButton extends GeSidebarPart {
    static override styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override properties = {
        active: { type: Boolean, reflect: true },
        tooltip: {},
    };

    declare active: boolean;
    declare tooltip: string;
    private detachHint?: () => void;

    constructor() {
        super();
        this.active = false;
        this.tooltip = '';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.detachHint?.();
        this.detachHint = undefined;
    }

    protected override firstUpdated(): void {
        const button = this.shadowRoot?.querySelector('button');
        if (!button) return;
        this.detachHint = attachHint(button, {
            text: () => this.tooltip,
            side: () => 'right',
            disabled: () => !this.collapsedState || !this.tooltip,
        });
    }

    protected override render() {
        return html`<button
            part="base"
            type="button"
            data-slot="sidebar-menu-button"
            ?data-active=${this.active}
            ?data-collapsed=${this.collapsedState}
            aria-label=${this.tooltip || ''}
        >
            <slot></slot>
        </button>`;
    }
}
