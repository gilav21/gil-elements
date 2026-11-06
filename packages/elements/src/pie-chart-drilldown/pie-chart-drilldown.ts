import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries, LegendPosition, PieSlice } from '../shared/chart/chart.types.js';
import { describeArc, formatChartValue, formatPercentage, getChartColor, getChartSummary, getPointAriaLabel, getSliceCentroid, positiveOrZero } from '../shared/chart/chart.utils.js';
import pieCss from '../pie-chart/pie-chart.css?inline';
import css from './pie-chart-drilldown.css?inline';

/**
 * A pie whose slices can open a child series: a slice whose `drilldown` names the `id` of an entry in `drilldownSeries`
 * navigates into it, and a breadcrumb leads back. Navigation is one level deep. A `drilldown` id with no matching series
 * is inert. A slice is a button: it takes focus, and Enter or Space activates it.
 *
 * @fires drilldown - The chart navigated into a child series; `detail` is `{ seriesId, parentPoint }`. `slice-click` fires first.
 * @fires drillup - The chart returned to the top level.
 * @fires slice-click - A slice or its legend entry was activated at either level; `detail` is `{ point, index, event }`.
 * @fires slice-hover - A slice or legend entry was entered or focused (`{ point, index }`), or `null` once left.
 * @attr {number} size - Width and height of the circle's box in px. Defaults to 300.
 * @attr {number} inner-radius - The hole as a fraction of the radius; 0 (default) is a pie.
 * @attr {boolean} show-labels - The percentage on slices of 5% or more. On by default.
 * @attr {boolean} show-legend - The legend. On by default.
 * @attr {string} legend-position - `right` (default), `left`, `top`, `bottom` or `none`.
 * @attr {boolean} show-tooltip - The tooltip over the hovered slice, with a hint on slices that drill. On by default.
 * @attr {boolean} show-breadcrumb - The back button and series name while drilled down. On by default.
 * @attr {string} back-button-text - Label of the back button. Defaults to `Back`.
 * @attr {string} heading - A name for the top level, used in the accessible summary. Defaults to `Overview`.
 * @prop {DrilldownDataPoint[]} data - The top-level slices; `drilldown` names a child series.
 * @prop {DrilldownSeries[]} drilldownSeries - The child series: `{ id, name, data }`.
 * @csspart base - The chart container.
 */
export class GePieChartDrilldown extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(pieCss), unsafeCSS(css)];
    static override properties = {
        data: { attribute: false },
        drilldownSeries: { attribute: false },
        size: { type: Number },
        innerRadius: { type: Number, attribute: 'inner-radius' },
        showLabels: { converter: defaultTrue, attribute: 'show-labels' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        legendPosition: { attribute: 'legend-position', reflect: true },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        showBreadcrumb: { converter: defaultTrue, attribute: 'show-breadcrumb' },
        backButtonText: { attribute: 'back-button-text' },
        heading: {},
        currentDrilldownId: { state: true },
        hoverIndex: { state: true },
        tooltipPos: { state: true },
    };

    declare data: DrilldownDataPoint[];
    declare drilldownSeries: DrilldownSeries[];
    declare size: number;
    declare innerRadius: number;
    declare showLabels: boolean;
    declare showLegend: boolean;
    declare legendPosition: LegendPosition;
    declare showTooltip: boolean;
    declare showBreadcrumb: boolean;
    declare backButtonText: string;
    declare heading: string | undefined;
    /** The `id` of the child series shown, or `null` at the top level. */
    declare currentDrilldownId: string | null;
    declare hoverIndex: number | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.drilldownSeries = [];
        this.size = 300;
        this.innerRadius = 0;
        this.showLabels = true;
        this.showLegend = true;
        this.legendPosition = 'right';
        this.showTooltip = true;
        this.showBreadcrumb = true;
        this.backButtonText = 'Back';
        this.currentDrilldownId = null;
        this.hoverIndex = null;
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'pie-chart-drilldown-host';
    }

    get isDrilledDown(): boolean {
        return this.currentDrilldownId !== null;
    }

    private get current(): { name: string; data: DrilldownDataPoint[] } {
        const id = this.currentDrilldownId;
        if (id === null) return { name: this.heading ?? 'Overview', data: this.data };
        const series = this.drilldownSeries.find((s) => s.id === id);
        return { name: series?.name ?? '', data: series?.data ?? [] };
    }

    private get total(): number {
        return this.current.data.reduce((sum, point) => sum + positiveOrZero(point.value), 0);
    }

    private get outerRadius(): number {
        return this.size / 2 - 10;
    }

    private hasDrilldown(slice: PieSlice): boolean {
        const id = (slice.data as DrilldownDataPoint).drilldown;
        return !!id && this.drilldownSeries.some((s) => s.id === id);
    }

    private entries(): PieSlice[] {
        const total = this.total;
        const outer = this.outerRadius;
        const inner = outer * this.innerRadius;
        let angle = -Math.PI / 2;
        return this.current.data.map((point, index) => {
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
        const el = this.shadowRoot?.querySelector('svg.pie')?.getBoundingClientRect();
        const half = this.size / 2;
        const scale = el && el.width > 0 ? el.width / this.size : 1;
        return {
            x: (el && box ? el.left - box.left : 0) + (half + slice.centroid.x) * scale + 12,
            y: (el && box ? el.top - box.top : 0) + (half + slice.centroid.y) * scale - 8,
        };
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
    }

    private onSliceHover(slice: PieSlice): void {
        this.hoverIndex = slice.index;
        this.tooltipPos = this.tooltipFor(slice);
        this.emit<ChartClickEvent<DrilldownDataPoint> | null>('slice-hover', { point: slice.data, index: slice.index });
    }

    private onSliceLeave(): void {
        this.hoverIndex = null;
        this.emit<ChartClickEvent<DrilldownDataPoint> | null>('slice-hover', null);
    }

    private onSliceClick(event: Event, slice: PieSlice): void {
        const point = slice.data as DrilldownDataPoint;
        this.emit<ChartClickEvent<DrilldownDataPoint>>('slice-click', { point, index: slice.index, event: event instanceof MouseEvent ? event : undefined });
        if (!point.drilldown || this.isDrilledDown || !this.drilldownSeries.some((s) => s.id === point.drilldown)) return;
        this.currentDrilldownId = point.drilldown;
        this.hoverIndex = null;
        this.emit<DrilldownEvent>('drilldown', { seriesId: point.drilldown, parentPoint: point });
    }

    private onSliceKey(event: KeyboardEvent, slice: PieSlice): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.onSliceClick(event, slice);
    }

    /** Returns to the top-level data and fires `drillup`; call it from your own control when `show-breadcrumb` is off. */
    drillUp(): void {
        this.currentDrilldownId = null;
        this.hoverIndex = null;
        this.emit('drillup', undefined);
    }

    private readonly percent = (value: number) => formatPercentage(value, 1);
    private readonly isLight = (color: string) => color.includes('yellow') || color.includes('50%)');

    private sliceLabel(slice: PieSlice): string {
        const label = getPointAriaLabel(slice.data.name, slice.data.value, slice.percentage, this.total);
        return this.hasDrilldown(slice) ? `${label}. Press Enter to drill down.` : label;
    }

    private sliceGroup(slice: PieSlice) {
        const hover = this.hoverIndex;
        return svg`<g class="slice" data-dim=${hover !== null && hover !== slice.index ? '' : nothing} tabindex="0" role="button" aria-label=${this.sliceLabel(slice)}
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
                    ${this.hasDrilldown(slice) ? html`<svg class="chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6" /></svg>` : nothing}
                </button>`,
            )}
        </div>`;
    }

    private breadcrumb() {
        return html`<div class="crumb" data-slot="drilldown-breadcrumb">
            <button type="button" class="back" data-slot="drilldown-back" @click=${() => this.drillUp()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                ${this.backButtonText}
            </button>
            <span class="sep">/</span>
            <span class="series-name">${this.current.name}</span>
        </div>`;
    }

    protected override render() {
        const entries = this.entries();
        const slices = entries.filter((e) => e.percentage > 0);
        const half = this.size / 2;
        const hovered = this.hoverIndex === null ? null : (slices.find((s) => s.index === this.hoverIndex) ?? null);
        const label = getChartSummary('Pie chart with drilldown', this.current.data.length, this.current.name);
        return html`<div part="base" class="outer" data-slot="pie-chart-drilldown">
            ${this.isDrilledDown && this.showBreadcrumb ? this.breadcrumb() : nothing}
            <div class="base">
                <svg class="pie" role="group" aria-label=${label} viewBox=${`0 0 ${this.size} ${this.size}`} width="100%" height="auto" style=${`max-width:${this.size}px;aspect-ratio:1 / 1`}>
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
                          ${this.hasDrilldown(hovered) ? html`<div class="hint">Click to drill down</div>` : nothing}
                      </div>`
                    : nothing}
            </div>
        </div>`;
    }
}
