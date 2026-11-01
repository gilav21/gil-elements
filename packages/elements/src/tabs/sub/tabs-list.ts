import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './tabs-list.css?inline';

/**
 * The row of tab triggers, in a muted rounded bar.
 *
 * @slot - `ge-tabs-trigger`s.
 * @attr {string} aria-label - Accessible name of the tab list.
 * @attr {boolean} skeleton - Shows placeholder tabs instead of the triggers.
 * @attr {number} skeleton-count - How many placeholders. Defaults to 3.
 * @csspart base - The bar.
 */
export class GeTabsList extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        ariaLabel: { attribute: 'aria-label' },
        skeleton: { type: Boolean, reflect: true },
        skeletonCount: { type: Number, attribute: 'skeleton-count' },
    };

    declare ariaLabel: string | null;
    declare skeleton: boolean;
    declare skeletonCount: number;

    constructor() {
        super();
        this.ariaLabel = null;
        this.skeleton = false;
        this.skeletonCount = 3;
    }

    protected override render() {
        if (this.skeleton) {
            return html`<div part="base" class="list loading" data-slot="tabs-list">
                ${Array.from({ length: this.skeletonCount }, () => html`<ge-skeleton></ge-skeleton>`)}
            </div>`;
        }
        return html`<div part="base" class="list" role="tablist" data-slot="tabs-list" aria-label=${this.ariaLabel ?? nothing}><slot></slot></div>`;
    }
}
