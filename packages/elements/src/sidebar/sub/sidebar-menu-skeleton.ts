import '../../skeleton/define.js';
import { html, nothing, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import type { SkeletonVariant } from '../../skeleton/skeleton.js';
import css from './sidebar-menu-skeleton.css?inline';

/**
 * A loading placeholder shaped like a menu row. On a collapsed rail only the icon block remains.
 *
 * @attr {boolean} hide-icon - Leaves out the icon block.
 * @attr {'pulse' | 'shimmer'} variant - The skeleton style.
 * @attr {number} seed - Picks the text bar's width from four, so a list of skeletons does not look uniform. Any integer works.
 */
export class GeSidebarMenuSkeleton extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override readonly properties = {
        hideIcon: { attribute: 'hide-icon', type: Boolean, reflect: true },
        variant: { reflect: true },
        seed: { type: Number },
    };

    declare hideIcon: boolean;
    declare variant: SkeletonVariant;
    declare seed: number;

    constructor() {
        super();
        this.hideIcon = false;
        this.variant = 'pulse';
        this.seed = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'listitem');
    }

    protected override render() {
        const collapsed = this.collapsedState;
        // The modulo of a negative or fractional seed would leave the four widths, so it is made a non-negative integer first.
        const width = Math.abs(Math.trunc(this.seed)) % 4;
        return html`<div class="row" data-slot="sidebar-menu-skeleton" ?data-collapsed=${collapsed}>
            ${this.hideIcon ? nothing : html`<ge-skeleton class="icon" variant=${this.variant}></ge-skeleton>`}
            ${collapsed ? nothing : html`<ge-skeleton class="bar" data-width=${width} variant=${this.variant}></ge-skeleton>`}
        </div>`;
    }
}
