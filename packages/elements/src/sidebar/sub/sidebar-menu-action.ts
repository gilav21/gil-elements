import { html, nothing, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-menu-action.css?inline';

/**
 * A small icon button pinned to the end of a menu row, beside the link (for example "more options"). It is hidden
 * on a collapsed rail. Pressing it fires `triggered` and does not follow the row's link.
 *
 * @slot - The icon.
 * @fires triggered - When pressed; `detail` is the click event.
 * @attr {string} label - Accessible name of the button.
 * @attr {boolean} show-on-hover - Fades the action in only while the row is hovered or the action focused; on a touch screen it is always shown.
 * @csspart base - The `<button>`.
 */
export class GeSidebarMenuAction extends GeSidebarPart {
    static override styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override properties = {
        label: {},
        showOnHover: { attribute: 'show-on-hover', type: Boolean, reflect: true },
    };

    declare label: string;
    declare showOnHover: boolean;

    constructor() {
        super();
        this.label = '';
        this.showOnHover = false;
    }

    protected override render() {
        return html`<button
            part="base"
            type="button"
            data-slot="sidebar-menu-action"
            ?data-collapsed=${this.collapsedState}
            aria-label=${this.label || nothing}
            @click=${this.onClick}
        >
            <slot></slot>
        </button>`;
    }

    private readonly onClick = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent<MouseEvent>('triggered', { detail: event, bubbles: true }));
    };
}
