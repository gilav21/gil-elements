import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-rail.css?inline';

/**
 * A thin hit target on the sidebar's outer edge that collapses and expands the rail; a line appears on hover or
 * focus. Desktop only. Place it inside the `ge-sidebar`.
 *
 * @attr {string} label - Accessible name and title. Defaults to "Expand sidebar" or "Collapse sidebar" for the current state.
 * @attr {'left' | 'right'} side - The edge of the sidebar it sits on; match the sidebar's `side`.
 * @csspart base - The `<button>`.
 */
export class GeSidebarRail extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override readonly properties = {
        label: {},
        side: { reflect: true },
    };

    declare label: string;
    declare side: 'left' | 'right';

    constructor() {
        super();
        this.label = '';
        this.side = 'left';
    }

    protected override render() {
        const collapsed = this.provider?.isCollapsed ?? false;
        const label = this.label || (collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        return html`<button
            part="base"
            type="button"
            data-slot="sidebar-rail"
            data-state=${collapsed ? 'collapsed' : 'expanded'}
            data-side=${this.side}
            ?data-collapsed=${collapsed}
            aria-label=${label}
            aria-expanded=${String(!collapsed)}
            title=${label}
            @click=${() => this.provider?.toggle()}
        >
            <span class="line" aria-hidden="true"></span>
        </button>`;
    }
}
