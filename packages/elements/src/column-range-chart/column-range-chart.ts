import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, RangeDataPoint } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale, niceDomain } from '../shared/chart/chart-scale.js';
import css from './column-range-chart.css?inline';

interface Bar {
    index: number;
    data: RangeDataPoint;
    lowValue: number;
    highValue: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    lowY: number;
    highY: number;
}

const PAD_TOP = 30;
const PAD_BOTTOM = 35;
const PAD_SIDE = 20;
const PAD_AXIS = 70;

/**
 * Floating columns, each spanning a low to a high value on a nice axis: temperature ranges, price bands, tolerances.
 * Each column is a button: it takes focus, and Enter or Space activates it. A span under 1px is drawn as a 1px line
 * centred on its value.
 *
 * @fires bar-click - A column was activated; `detail` is `{ point, index, event }`.
 * @attr {string} unit - Put after every value, as in `°C`.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-range-labels - The high and low value at the ends of each column. On by default.
 * @attr {number} bar-radius - Corner radius of a column in px. Defaults to 4.
 * @attr {number} bar-gap - Gap between columns in px. Defaults to 12.
 * @prop {RangeDataPoint[]} data - One column per entry: `{ name, low, high, color? }`; the ends may come in either order.
 * @csspart base - The chart container.
 */
export class GeColumnRangeChart extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        unit: {},
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showRangeLabels: { converter: defaultTrue, attribute: 'show-range-labels' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
    };

    declare data: RangeDataPoint[];
    declare unit: string;
    declare showGrid: boolean;
    declare showRangeLabels: boolean;
    declare barRadius: number;
    declare barGap: number;

    constructor() {
        super();
        this.data = [];
        this.unit = '';
        this.showGrid = true;
        this.showRangeLabels = true;
        this.barRadius = 4;
        this.barGap = 12;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'column-range-chart-host';
        setTimeout(() => (this.domRtl = getComputedStyle(this).direction === 'rtl'));
    }

    private get area() {
        const rtl = this.rtl;
        const left = rtl ? PAD_SIDE : PAD_AXIS;
        const right = this.svgWidth - (rtl ? PAD_AXIS : PAD_SIDE);
        return { left, right, top: PAD_TOP, bottom: this.height - PAD_BOTTOM, width: right - left };
    }

    private get scale() {
        const a = this.area;
        const bounds = extent(this.data.flatMap((d) => [d.low, d.high]));
        const domain: [number, number] = bounds ? niceDomain(bounds[0], bounds[1], 5) : [0, 100];
        return linearScale(domain, [a.bottom, a.top]);
    }

    private bars(): Bar[] {
        const count = this.data.length;
        if (count === 0) return [];
        const a = this.area;
        const size = (a.width - (count - 1) * this.barGap) / count;
        const scale = this.scale;
        return this.data.map((point, index) => {
            const lowValue = Math.min(point.low, point.high);
            const highValue = Math.max(point.low, point.high);
            const lowY = scale.scale(lowValue);
            const highY = scale.scale(highValue);
            const offset = index * (size + this.barGap);
            const x = this.rtl ? a.right - offset - size : a.left + offset;
            // A span under 1px is a line centred on its value, so it never sticks out of the plot by a full pixel.
            const height = Math.max(1, lowY - highY);
            const y = lowY - highY < 1 ? (lowY + highY) / 2 - height / 2 : highY;
            return { index, data: point, lowValue, highValue, x, y, width: size, height, color: getChartColor(index, point.color), lowY, highY };
        });
    }

    private lowLabelY(bar: Bar): number {
        const below = bar.lowY + 14;
        return below <= this.area.bottom + 2 ? below : bar.lowY - 6;
    }

    private value(value: number): string {
        return formatChartValue(value, { decimals: 0 }) + this.unit;
    }

    private axisValue(value: number): string {
        return formatChartValue(value, { compact: true, decimals: Number.isInteger(value) ? 0 : 6 }) + this.unit;
    }

    private activate(event: Event, bar: Bar): void {
        this.emit<ChartClickEvent<RangeDataPoint>>('bar-click', { point: bar.data, index: bar.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onKey(event: KeyboardEvent, bar: Bar): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.activate(event, bar);
    }

    private barGroup(bar: Bar) {
        const hover = this.hoverIndex;
        const centre = bar.x + bar.width / 2;
        return svg`<g class="bar" data-dim=${hover !== null && hover !== bar.index ? '' : nothing} tabindex="0" role="button"
            aria-label=${`${bar.data.name}: ${bar.lowValue}${this.unit} to ${bar.highValue}${this.unit}`}
            @mouseenter=${() => (this.hoverIndex = bar.index)}
            @mouseleave=${() => (this.hoverIndex = null)}
            @focus=${() => (this.hoverIndex = bar.index)}
            @blur=${() => (this.hoverIndex = null)}
            @click=${(event: Event) => this.activate(event, bar)}
            @keydown=${(event: KeyboardEvent) => this.onKey(event, bar)}>
            <rect x=${bar.x} y=${bar.y} width=${bar.width} height=${bar.height} rx=${this.barRadius} fill=${bar.color} data-hover=${hover === bar.index ? '' : nothing} />
            ${this.showRangeLabels
                ? svg`<text class="range" x=${centre} y=${bar.highY - 6} text-anchor="middle">${this.value(bar.highValue)}</text>
                    <text class="range" x=${centre} y=${this.lowLabelY(bar)} text-anchor="middle">${this.value(bar.lowValue)}</text>`
                : nothing}
        </g>`;
    }

    private tooltip(bars: Bar[]) {
        const bar = this.hoverIndex === null ? undefined : bars[this.hoverIndex];
        if (!bar) return nothing;
        const x = bar.x + bar.width / 2 + 12;
        return html`<div class="tooltip" data-flip=${x > this.svgWidth * 0.7 ? '' : nothing} style=${`left:${x}px;top:${bar.y - 8}px`}>
            <div class="name">${bar.data.name}</div>
            <div class="amount">${`Range: ${this.value(bar.lowValue)} – ${this.value(bar.highValue)}`}</div>
        </div>`;
    }

    protected override render() {
        const a = this.area;
        const rtl = this.rtl;
        const scale = this.scale;
        const ticks = scale.ticks(5);
        const bars = this.bars();
        const w = this.svgWidth;
        return html`<div part="base" class="base" data-slot="column-range-chart">
            <svg role="group" aria-label=${getChartSummary('Column range chart', this.data.length, this.heading)} viewBox=${`0 0 ${w} ${this.height}`} width="100%" height="auto" style=${`max-width:${w}px;aspect-ratio:${w} / ${this.height}`}>
                ${this.showGrid
                    ? svg`<g class="grid">${ticks.map((t) => svg`<line x1=${a.left} y1=${scale.scale(t)} x2=${a.right} y2=${scale.scale(t)} stroke="currentColor" stroke-opacity="0.2" stroke-dasharray="4 4" />`)}</g>`
                    : nothing}
                <g class="axis">${ticks.map((t) => svg`<text x=${rtl ? a.right + 12 : a.left - 12} y=${scale.scale(t)} text-anchor="end" dominant-baseline="middle" fill="currentColor">${this.axisValue(t)}</text>`)}</g>
                <g class="axis">${bars.map((b) => svg`<text x=${b.x + b.width / 2} y=${a.bottom + 16} text-anchor="middle" fill="currentColor">${b.data.name}</text>`)}</g>
                <g>${bars.map((b) => this.barGroup(b))}</g>
            </svg>
            ${this.tooltip(bars)}
        </div>`;
    }
}
