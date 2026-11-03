import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { BadgeVariant } from '../badge/badge.js';
import css from './stat-card.css?inline';

/**
 * Which way a metric moved. `up` and `down` mean a favourable and an unfavourable change, not the sign of
 * the delta text: a falling churn rate is `up`. `neutral` has no direction: a secondary badge and no arrow.
 */
export type StatCardTrend = 'up' | 'down' | 'neutral';

const VARIANTS: Readonly<Record<StatCardTrend, BadgeVariant>> = { up: 'default', down: 'destructive', neutral: 'secondary' };
const ARROWS: Readonly<Record<StatCardTrend, string | null>> = {
    up: 'M12 19V5m0 0-7 7m7-7 7 7',
    down: 'M12 5v14m0 0 7-7m-7 7-7-7',
    neutral: null,
};

/**
 * A KPI tile: a label, a headline value, an optional delta badge and an optional projected sparkline.
 * The host is `display: contents`, so the card inside is the real grid item; style it through `::part(card)`.
 *
 * @slot - Extra content under the delta, usually a sparkline.
 * @attr {string} label - Metric name, muted above the value. Truncates instead of wrapping.
 * @attr {string} value - The headline figure, shown as given: format it before passing it in. Truncates.
 * @attr {string} delta - Change since the previous period, e.g. `+20.1%`. Empty means no badge.
 * @attr {'up' | 'down' | 'neutral'} trend - Direction of the change: badge colour and arrow.
 * @attr {boolean} hide-trend-icon - Keep the trend colour but drop the arrow.
 * @csspart card - The card surface.
 */
export class GeStatCard extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        label: {},
        value: {},
        delta: {},
        trend: { reflect: true },
        hideTrendIcon: { type: Boolean, attribute: 'hide-trend-icon', reflect: true },
        extra: { state: true },
    };

    declare label: string;
    declare value: string;
    declare delta: string;
    declare trend: StatCardTrend;
    declare hideTrendIcon: boolean;
    declare extra: boolean;

    constructor() {
        super();
        this.label = '';
        this.value = '';
        this.delta = '';
        this.trend = 'neutral';
        this.hideTrendIcon = false;
        this.extra = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'stat-card';
    }

    private readonly onSlotChange = (event: Event) => {
        this.extra = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
    };

    private arrow() {
        const path = this.hideTrendIcon ? null : ARROWS[this.trend];
        if (!path) return nothing;
        return svg`<svg class="trend" data-slot="stat-card-trend" data-trend=${this.trend} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d=${path} /></svg>`;
    }

    protected override render() {
        const hasArrow = !this.hideTrendIcon && ARROWS[this.trend] !== null;
        return html`<ge-card part="card">
            <ge-card-header>
                <ge-card-description>${this.label}</ge-card-description>
                <ge-card-title>${this.value}</ge-card-title>
            </ge-card-header>
            <ge-card-content ?hidden=${!this.delta && !this.extra}>
                ${this.delta
                    ? html`<ge-badge variant=${VARIANTS[this.trend]} data-trend=${hasArrow ? this.trend : nothing}>${this.arrow()}${this.delta}</ge-badge>`
                    : nothing}
                <slot @slotchange=${this.onSlotChange}></slot>
            </ge-card-content>
        </ge-card>`;
    }
}
