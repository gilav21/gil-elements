import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { BarRect, ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries } from '../shared/chart/chart.types.js';
import { formatChartValue, getChartColor, getChartSummary, getPointAriaLabel } from '../shared/chart/chart.utils.js';
import { linearScale, zeroBasedDomain } from '../shared/chart/chart-scale.js';
import css from './bar-chart-drilldown.css?inline';

interface Placed extends BarRect {
    labelY: number;
}

const PAD_TOP = 20;
const PAD_BOTTOM = 35;
const PAD_AXIS = 70;
const PAD_EDGE = 20;

/**
 * Columns over one series, where a column whose `drilldown` names the `id` of an entry in `drilldownSeries` opens that
 * child series, with a breadcrumb back. Navigation is one level deep. A `drilldown` id with no matching series is inert.
 * Columns grow from a zero baseline, so a negative value hangs below it. A column is a button: it takes focus, and Enter
 * or Space activates it.
 *
 * @fires drilldown - The chart navigated into a child series; `detail` is `{ seriesId, parentPoint }`. `bar-click` fires first.
 * @fires drillup - The chart returned to the top level.
 * @fires bar-click - A column was activated at either level; `detail` is `{ point, index, event }`.
 * @fires bar-hover - A column was entered or focused (`{ point, index }`), or `null` once left.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-values - The value above each column. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the active column, with a hint on columns that drill. On by default.
 * @attr {number} bar-radius - Corner radius in px. Defaults to 4.
 * @attr {number} bar-gap - Gap between columns in px. Defaults to 8.
 * @attr {boolean} show-breadcrumb - The back button and series name while drilled down. On by default.
 * @attr {string} back-button-text - Label of the back button. Defaults to `Back`.
 * @attr {string} heading - A name for the top level, used in the accessible summary. Defaults to `Overview`.
 * @prop {DrilldownDataPoint[]} data - The top-level columns; `drilldown` names a child series.
 * @prop {DrilldownSeries[]} drilldownSeries - The child series: `{ id, name, data }`.
 * @csspart base - The chart container.
 */
export class GeBarChartDrilldown extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        drilldownSeries: { attribute: false },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showValues: { converter: defaultTrue, attribute: 'show-values' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
        showBreadcrumb: { converter: defaultTrue, attribute: 'show-breadcrumb' },
        backButtonText: { attribute: 'back-button-text' },
        currentDrilldownId: { state: true },
        tooltipPos: { state: true },
    };

    declare data: DrilldownDataPoint[];
    declare drilldownSeries: DrilldownSeries[];
    declare showGrid: boolean;
    declare showValues: boolean;
    declare showTooltip: boolean;
    declare barRadius: number;
    declare barGap: number;
    declare showBreadcrumb: boolean;
    declare backButtonText: string;
    /** The `id` of the child series shown, or `null` at the top level. */
    declare currentDrilldownId: string | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.drilldownSeries = [];
        this.showGrid = true;
        this.showValues = true;
        this.showTooltip = true;
        this.barRadius = 4;
        this.barGap = 8;
        this.showBreadcrumb = true;
        this.backButtonText = 'Back';
        this.currentDrilldownId = null;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 500;
        this.height = 300;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bar-chart-drilldown-host';
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

    private get area() {
        const rtl = this.rtl;
        const left = rtl ? PAD_EDGE : PAD_AXIS;
        const right = this.svgWidth - (rtl ? PAD_AXIS : PAD_EDGE);
        return { left, right, top: PAD_TOP, bottom: this.height - PAD_BOTTOM, width: right - left };
    }

    private get domain(): [number, number] {
        return zeroBasedDomain(this.current.data.map((d) => d.value), 5);
    }

    private get scale() {
        const a = this.area;
        return linearScale(this.domain, [a.bottom, a.top]);
    }

    private hasDrilldown(point: DrilldownDataPoint): boolean {
        return !!point.drilldown && this.drilldownSeries.some((s) => s.id === point.drilldown);
    }

    private bars(): Placed[] {
        const data = this.current.data;
        if (data.length === 0) return [];
        const a = this.area;
        const scale = this.scale;
        const width = (a.width - (data.length - 1) * this.barGap) / data.length;
        const zero = scale.scale(0);
        return data.map((point, index) => {
            const end = scale.scale(point.value);
            const y = Math.min(zero, end);
            const height = Math.abs(end - zero);
            const offset = index * (width + this.barGap);
            const x = this.rtl ? a.right - offset - width : a.left + offset;
            // A negative column hangs below the baseline, so its label goes under the free end,
            // or inside the bar end when that would reach the axis labels at the bottom of the plot.
            const below = y + height + 14;
            let labelY = y - 6;
            if (point.value < 0) labelY = below <= a.bottom + 2 ? below : y + height - 6;
            return { index, data: point, x, y, width, height, color: getChartColor(index, point.color), value: point.value, labelPosition: { x: x + width / 2, y: labelY }, labelAnchor: 'middle', labelY };
        });
    }

    private fmtAxis(value: number): string {
        return formatChartValue(value, { compact: true, decimals: Number.isInteger(value) ? 0 : 6 });
    }

    private readonly enter = (bar: Placed) => {
        this.hoverIndex = bar.index;
        this.tooltipPos = { x: bar.x + bar.width / 2 + 12, y: bar.y - 8 };
        this.emit<ChartClickEvent<DrilldownDataPoint> | null>('bar-hover', { point: bar.data, index: bar.index });
    };

    private readonly leave = () => {
        this.hoverIndex = null;
        this.emit<ChartClickEvent<DrilldownDataPoint> | null>('bar-hover', null);
    };

    private activate(event: Event, bar: Placed): void {
        const point = bar.data as DrilldownDataPoint;
        this.emit<ChartClickEvent<DrilldownDataPoint>>('bar-click', { point, index: bar.index, event: event instanceof MouseEvent ? event : undefined });
        if (!point.drilldown || this.isDrilledDown || !this.hasDrilldown(point)) return;
        this.currentDrilldownId = point.drilldown;
        this.hoverIndex = null;
        this.emit<DrilldownEvent>('drilldown', { seriesId: point.drilldown, parentPoint: point });
    }

    private onKey(event: KeyboardEvent, bar: Placed): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.activate(event, bar);
    }

    /** Returns to the top-level data and fires `drillup`; call it from your own control when `show-breadcrumb` is off. */
    drillUp(): void {
        this.currentDrilldownId = null;
        this.hoverIndex = null;
        this.emit('drillup', undefined);
    }

    private barLabel(bar: Placed): string {
        const label = getPointAriaLabel(bar.data.name, bar.value);
        return this.hasDrilldown(bar.data) ? `${label}. Press Enter to drill down.` : label;
    }

    private barGroup(bar: Placed) {
        const hover = this.hoverIndex;
        return svg`<g class="bar-group" data-dim=${hover !== null && hover !== bar.index ? '' : nothing} data-slot="drilldown-bar" tabindex="0" role="button" aria-label=${this.barLabel(bar)}
            @mouseenter=${() => this.enter(bar)} @touchstart=${() => this.enter(bar)} @mouseleave=${this.leave} @focus=${() => this.enter(bar)} @blur=${this.leave}
            @click=${(event: MouseEvent) => this.activate(event, bar)} @keydown=${(event: KeyboardEvent) => this.onKey(event, bar)}>
            <rect x=${bar.x} y=${bar.y} width=${bar.width} height=${bar.height} rx=${this.barRadius} fill=${bar.color} data-hover=${hover === bar.index ? '' : nothing} />
            ${this.showValues ? svg`<text class="value" x=${bar.x + bar.width / 2} y=${bar.labelY} text-anchor="middle">${formatChartValue(bar.value, { compact: true })}</text>` : nothing}
        </g>`;
    }

    private breadcrumb() {
        const chevron = this.rtl ? svg`<path d="m9 18 6-6-6-6" />` : svg`<path d="m15 18-6-6 6-6" />`;
        return html`<div class="crumb" data-slot="drilldown-breadcrumb">
            <button type="button" class="back" data-slot="drilldown-back" @click=${() => this.drillUp()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${chevron}</svg>
                ${this.backButtonText}
            </button>
            <span class="sep">/</span>
            <span class="series-name">${this.current.name}</span>
        </div>`;
    }

    private tooltip(bars: Placed[]) {
        const hovered = this.hoverIndex === null ? undefined : bars[this.hoverIndex];
        if (!hovered || !this.showTooltip) return nothing;
        return html`<div class="tooltip" data-flip=${this.tooltipPos.x > this.svgWidth * 0.7 ? '' : nothing} style=${`left:${this.tooltipPos.x}px;top:${this.tooltipPos.y}px`}>
            <div class="tip-name">${hovered.data.name}</div>
            <div class="tip-amount">${formatChartValue(hovered.value, { compact: true })}</div>
            ${this.hasDrilldown(hovered.data) ? html`<div class="hint">Click to drill down</div>` : nothing}
        </div>`;
    }

    protected override render() {
        const a = this.area;
        const rtl = this.rtl;
        const scale = this.scale;
        const ticks = scale.ticks(5);
        const negative = this.domain[0] < 0;
        const bars = this.bars();
        const w = this.svgWidth;
        return html`<div part="base" class="base" data-slot="bar-chart-drilldown">
            ${this.isDrilledDown && this.showBreadcrumb ? this.breadcrumb() : nothing}
            <svg role="group" aria-label=${getChartSummary('Column chart with drilldown', this.current.data.length, this.current.name)} viewBox=${`0 0 ${w} ${this.height}`} width="100%" height="auto" style=${`max-width:${w}px;aspect-ratio:${w} / ${this.height}`}>
                ${this.showGrid
                    ? svg`<g class="grid">${ticks.map((tick) => {
                          const zeroLine = tick === 0 && negative;
                          const y = scale.scale(tick);
                          return svg`<line x1=${a.left} y1=${y} x2=${a.right} y2=${y} stroke="currentColor" stroke-opacity=${zeroLine ? 1 : 0.2} stroke-dasharray=${zeroLine ? nothing : '4 4'} class=${zeroLine ? 'zero' : nothing} />`;
                      })}</g>`
                    : nothing}
                <g class="axis">${ticks.map((tick) => svg`<text x=${rtl ? a.right + 12 : a.left - 12} y=${scale.scale(tick)} text-anchor="end" dominant-baseline="middle" fill="currentColor">${this.fmtAxis(tick)}</text>`)}</g>
                <g class="axis">${bars.map((b) => svg`<text x=${b.x + b.width / 2} y=${a.bottom + 16} text-anchor="middle" fill="currentColor">${b.data.name}</text>`)}</g>
                <g>${bars.map((b) => this.barGroup(b))}</g>
            </svg>
            ${this.tooltip(bars)}
        </div>`;
    }
}
