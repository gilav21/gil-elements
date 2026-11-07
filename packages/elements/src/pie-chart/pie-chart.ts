import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, ChartDataPoint, LegendPosition, PieSlice } from '../shared/chart/chart.types.js';
import { describeArc, formatChartValue, formatPercentage, getChartColor, getChartSummary, getPointAriaLabel, getSliceCentroid, positiveOrZero } from '../shared/chart/chart.utils.js';
import css from './pie-chart.css?inline';

/**
 * A pie or, with `inner-radius`, a donut. Slices share the circle by value; a value that is not positive gets no slice
 * but keeps its legend entry. A slice is a button: it takes focus, and Enter or Space activates it.
 *
 * @fires slice-click - A slice or its legend entry was activated; `detail` is `{ point, index, event }`.
 * @fires slice-hover - A slice or legend entry was entered or focused (`{ point, index }`), or `null` once left.
 * @attr {number} size - Width and height of the circle's box in px. Defaults to 300.
 * @attr {number} inner-radius - The hole, as a fraction of the radius: 0 (default) is a pie, 0.6 a donut.
 * @attr {boolean} show-labels - The percentage on slices of 5% or more. On by default.
 * @attr {boolean} show-legend - The legend. On by default.
 * @attr {string} legend-position - `right` (default), `left`, `top`, `bottom` or `none`. The sides stack on a narrow screen.
 * @attr {boolean} show-tooltip - The tooltip over the hovered slice. On by default.
 * @attr {string} heading - A name for the chart, put before its accessible summary.
 * @prop {ChartDataPoint[]} data - One slice per entry; `color` overrides the palette colour.
 * @csspart base - The chart container.
 */
export class GePieChart extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        data: { attribute: false },
        size: { type: Number },
        innerRadius: { type: Number, attribute: 'inner-radius' },
        showLabels: { converter: defaultTrue, attribute: 'show-labels' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        legendPosition: { attribute: 'legend-position', reflect: true },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        heading: {},
        hoverIndex: { state: true },
        tooltipPos: { state: true },
    };

    declare data: ChartDataPoint[];
    declare size: number;
    declare innerRadius: number;
    declare showLabels: boolean;
    declare showLegend: boolean;
    declare legendPosition: LegendPosition;
    declare showTooltip: boolean;
    declare heading: string | undefined;
    declare hoverIndex: number | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.size = 300;
        this.innerRadius = 0;
        this.showLabels = true;
        this.showLegend = true;
        this.legendPosition = 'right';
        this.showTooltip = true;
        this.hoverIndex = null;
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'pie-chart-host';
    }

    private get total(): number {
        return this.data.reduce((sum, point) => sum + positiveOrZero(point.value), 0);
    }

    private get outerRadius(): number {
        return this.size / 2 - 10;
    }

    private entries(): PieSlice[] {
        const total = this.total;
        const outer = this.outerRadius;
        const inner = outer * this.innerRadius;
        let angle = -Math.PI / 2;
        return this.data.map((point, index) => {
            const share = total === 0 ? 0 : positiveOrZero(point.value) / total;
            const start = angle;
            const end = angle + share * Math.PI * 2;
            angle = end;
            return {
                index,
                data: point,
                startAngle: start,
                endAngle: end,
                percentage: share * 100,
                color: getChartColor(index, point.color),
                path: share > 0 ? describeArc(0, 0, outer, inner, start, end) : '',
                labelPosition: getSliceCentroid(0, 0, outer * 1.15, start, end),
                centroid: getSliceCentroid(0, 0, outer, start, end),
            };
        });
    }

    /** Beside the slice's centroid, so pointer, legend and keyboard all land in the same place. */
    private tooltipFor(slice: PieSlice): { x: number; y: number } {
        const box = this.shadowRoot?.querySelector('.base')?.getBoundingClientRect();
        const el = this.shadowRoot?.querySelector('svg')?.getBoundingClientRect();
        const half = this.size / 2;
        const scale = el && el.width > 0 ? el.width / this.size : 1;
        return {
            x: (el && box ? el.left - box.left : 0) + (half + slice.centroid.x) * scale + 12,
            y: (el && box ? el.top - box.top : 0) + (half + slice.centroid.y) * scale - 8,
        };
    }

    private onSliceHover(slice: PieSlice): void {
        this.hoverIndex = slice.index;
        this.tooltipPos = this.tooltipFor(slice);
        this.emit<ChartClickEvent | null>('slice-hover', { point: slice.data, index: slice.index });
    }

    private onSliceLeave(): void {
        this.hoverIndex = null;
        this.emit<ChartClickEvent | null>('slice-hover', null);
    }

    private onSliceClick(event: Event, slice: PieSlice): void {
        this.emit<ChartClickEvent>('slice-click', { point: slice.data, index: slice.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onSliceKey(event: KeyboardEvent, slice: PieSlice): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.onSliceClick(event, slice);
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }

    private readonly percent = (value: number) => formatPercentage(value, 1);
    private readonly isLight = (color: string) => color.includes('yellow') || color.includes('50%)');

    private sliceGroup(slice: PieSlice) {
        const hover = this.hoverIndex;
        const total = this.total;
        return svg`<g class="slice" data-dim=${hover !== null && hover !== slice.index ? '' : nothing} tabindex="0" role="button" aria-label=${getPointAriaLabel(slice.data.name, slice.data.value, slice.percentage, total)}
            @mouseenter=${() => this.onSliceHover(slice)}
            @mouseleave=${() => this.onSliceLeave()}
            @focus=${() => this.onSliceHover(slice)}
            @blur=${() => this.onSliceLeave()}
            @click=${(event: Event) => this.onSliceClick(event, slice)}
            @keydown=${(event: KeyboardEvent) => this.onSliceKey(event, slice)}>
            <path d=${slice.path} fill=${slice.color} transform-origin="0 0" data-hover=${hover === slice.index ? '' : nothing} />
            ${this.showLabels && slice.percentage >= 5
                ? svg`<text class="percent" data-light=${this.isLight(slice.color) ? '' : nothing} x=${slice.centroid.x} y=${slice.centroid.y} text-anchor="middle" dominant-baseline="middle">${this.percent(slice.percentage)}</text>`
                : nothing}
        </g>`;
    }

    private legend(entries: PieSlice[]) {
        const hover = this.hoverIndex;
        return html`<div class="legend" data-slot="pie-legend">
            ${entries.map(
                (slice) => html`<button type="button" class="entry" ?data-dim=${hover !== null && hover !== slice.index}
                    @mouseenter=${() => slice.percentage > 0 && this.onSliceHover(slice)}
                    @mouseleave=${() => this.onSliceLeave()}
                    @click=${(event: Event) => this.onSliceClick(event, slice)}>
                    <span class="swatch" style="background-color:${slice.color}"></span>
                    <span class="name">${slice.data.name}</span>
                    <span class="amount">${formatChartValue(slice.data.value)}</span>
                </button>`,
            )}
        </div>`;
    }

    protected override render() {
        const entries = this.entries();
        const slices = entries.filter((e) => e.percentage > 0);
        const half = this.size / 2;
        const hovered = this.hoverIndex === null ? null : (slices.find((s) => s.index === this.hoverIndex) ?? null);
        const label = getChartSummary('Pie chart', this.data.length, this.heading);
        return html`<div part="base" class="base" data-slot="pie-chart">
            <svg role="group" aria-label=${label} viewBox=${`0 0 ${this.size} ${this.size}`} width="100%" height="auto" style=${`max-width:${this.size}px;aspect-ratio:1 / 1`}>
                <g transform=${`translate(${half},${half})`}>
                    ${slices.length === 0 ? svg`<circle class="empty" data-slot="pie-empty" r=${this.outerRadius} fill="none" stroke="currentColor" stroke-dasharray="4 4" />` : nothing}
                    ${slices.map((slice) => this.sliceGroup(slice))}
                </g>
            </svg>
            ${this.showLegend && this.legendPosition !== 'none' ? this.legend(entries) : nothing}
            ${hovered && this.showTooltip
                ? html`<div class="tooltip" style=${`left:${this.tooltipPos.x}px;top:${this.tooltipPos.y}px`}>
                      <div class="tip-name">${hovered.data.name}</div>
                      <div class="tip-amount">${`${formatChartValue(hovered.data.value)} (${this.percent(hovered.percentage)})`}</div>
                  </div>`
                : nothing}
        </div>`;
    }
}
