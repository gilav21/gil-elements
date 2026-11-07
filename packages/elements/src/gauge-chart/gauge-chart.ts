import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { GaugeThreshold } from '../shared/chart/chart.types.js';
import { describeArc, formatChartValue, getChartColor } from '../shared/chart/chart.utils.js';
import { defaultTrue } from '../shared/chart/chart-base.js';
import css from './gauge-chart.css?inline';

const START_ANGLE = Math.PI;
const SWEEP = Math.PI;
const EDGE = 8;
const LABEL_ROOM = 36;

/**
 * A semicircle that fills from `min` to `max` to show one value, coloured by the highest threshold the value has
 * reached. A value outside the range fills nothing or everything.
 *
 * @attr {number} value - The value to show.
 * @attr {number} min - The value at the left end. Defaults to 0.
 * @attr {number} max - The value at the right end. Defaults to 100.
 * @attr {number} size - Width of the dial in px; the rest follows. Defaults to 220.
 * @attr {number} thickness - Width of the band as a fraction of the radius. Defaults to 0.2.
 * @attr {string} label - A caption under the value.
 * @attr {string} unit - Put after the value, as in `%`.
 * @attr {boolean} show-value - The value in the middle. On by default.
 * @attr {string} heading - A name for the gauge, put before its accessible summary.
 * @prop {GaugeThreshold[]} thresholds - `{ value, color }` steps; the highest one at or below the value sets the colour.
 * @csspart base - The container.
 */
export class GeGaugeChart extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { type: Number },
        min: { type: Number },
        max: { type: Number },
        size: { type: Number },
        thickness: { type: Number },
        thresholds: { attribute: false },
        label: {},
        unit: {},
        showValue: { converter: defaultTrue, attribute: 'show-value' },
        heading: {},
    };

    declare value: number;
    declare min: number;
    declare max: number;
    declare size: number;
    declare thickness: number;
    declare thresholds: GaugeThreshold[];
    declare label: string;
    declare unit: string;
    declare showValue: boolean;
    declare heading: string | undefined;

    constructor() {
        super();
        this.value = 0;
        this.min = 0;
        this.max = 100;
        this.size = 220;
        this.thickness = 0.2;
        this.thresholds = [];
        this.label = '';
        this.unit = '';
        this.showValue = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'gauge-chart-host';
    }

    /** How far the value is along the dial, 0 to 1. */
    get ratio(): number {
        const span = this.max - this.min;
        if (span <= 0) return 0;
        return Math.max(0, Math.min(1, (this.value - this.min) / span));
    }

    private get activeColor(): string {
        let color = getChartColor(0);
        for (const t of [...this.thresholds].sort((a, b) => a.value - b.value)) {
            if (this.value >= t.value) color = t.color;
        }
        return color;
    }

    private get displayValue(): string {
        return `${formatChartValue(this.value)}${this.unit}`;
    }

    private get summary(): string {
        const name = this.heading ? `${this.heading}. ` : '';
        const caption = this.label ? `${this.label}: ` : '';
        return `${name}Gauge. ${caption}${this.displayValue} of ${formatChartValue(this.max)}${this.unit}.`;
    }

    protected override render() {
        const c = this.size / 2;
        const outer = c - EDGE;
        const inner = outer * (1 - this.thickness);
        const height = c + LABEL_ROOM;
        const ratio = this.ratio;
        return html`<div part="base" class="base" data-slot="gauge-chart" role="img" aria-label=${this.summary}>
            <svg viewBox=${`0 0 ${this.size} ${height}`} width="100%" height=${height}>
                <path class="track" data-slot="gauge-track" d=${describeArc(c, c, outer, inner, START_ANGLE, START_ANGLE + SWEEP)} />
                ${ratio > 0
                    ? svg`<path class="fill" data-slot="gauge-value" d=${describeArc(c, c, outer, inner, START_ANGLE, START_ANGLE + SWEEP * ratio)} fill=${this.activeColor} />`
                    : nothing}
                ${this.showValue ? svg`<text class="value" x=${c} y=${c - 2} text-anchor="middle">${this.displayValue}</text>` : nothing}
                ${this.label ? svg`<text class="label" x=${c} y=${c + 18} text-anchor="middle">${this.label}</text>` : nothing}
            </svg>
        </div>`;
    }
}
