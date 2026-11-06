import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { BarRect, ChartClickEvent, ChartDataPoint, ChartOrientation } from '../shared/chart/chart.types.js';
import { formatChartValue, getChartColor, getChartSummary, getPointAriaLabel } from '../shared/chart/chart.utils.js';
import { linearScale, zeroBasedDomain } from '../shared/chart/chart-scale.js';
import css from './bar-chart.css?inline';

/** Room, in px, a horizontal bar's value label needs between the bar end and the plot edge. */
const LABEL_ROOM = 32;

interface Span {
    start: number;
    length: number;
    value: number;
}
interface Area {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
}

/**
 * Bars from a zero baseline on a nice value axis; vertical (columns) or horizontal. A bar is a button: it takes focus,
 * and Enter or Space activates it. Negative values grow the other way.
 *
 * @fires bar-click - A bar was activated; `detail` is `{ point, index, event }`.
 * @fires bar-hover - A bar was entered or focused (`{ point, index }`), or `null` once left.
 * @attr {string} orientation - `vertical` (default) or `horizontal`.
 * @attr {boolean} show-grid - The gridlines. On by default.
 * @attr {boolean} show-values - The value printed on each bar. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered bar. On by default.
 * @attr {number} bar-radius - Corner radius of a bar in px. Defaults to 4.
 * @attr {number} bar-gap - Gap between bars in px. Defaults to 8.
 * @attr {string} x-axis-label - A caption under the chart.
 * @attr {string} y-axis-label - A caption beside the chart, turned to read along the axis.
 * @prop {ChartDataPoint[]} data - One bar per entry; `color` overrides the palette colour.
 * @csspart base - The chart container.
 */
export class GeBarChart extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        orientation: {},
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showValues: { converter: defaultTrue, attribute: 'show-values' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
        xAxisLabel: { attribute: 'x-axis-label' },
        yAxisLabel: { attribute: 'y-axis-label' },
        tooltipPos: { state: true },
    };

    declare data: ChartDataPoint[];
    declare orientation: ChartOrientation;
    declare showGrid: boolean;
    declare showValues: boolean;
    declare showTooltip: boolean;
    declare barRadius: number;
    declare barGap: number;
    declare xAxisLabel: string;
    declare yAxisLabel: string;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.orientation = 'vertical';
        this.showGrid = true;
        this.showValues = true;
        this.showTooltip = true;
        this.barRadius = 4;
        this.barGap = 8;
        this.xAxisLabel = '';
        this.yAxisLabel = '';
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'bar-chart-host';
        // The inherited direction can change after the first layout (a parent's `dir` applied late).
        setTimeout(() => (this.domRtl = getComputedStyle(this).direction === 'rtl'));
    }

    private get vertical(): boolean {
        return this.orientation === 'vertical';
    }

    private get area(): Area {
        const rtl = this.rtl;
        const p = { top: 20, right: rtl ? 80 : 20, bottom: this.xAxisLabel ? 50 : 35, left: rtl ? 20 : 80 };
        const w = this.svgWidth;
        return { left: p.left, right: w - p.right, top: p.top, bottom: this.height - p.bottom, width: w - p.left - p.right, height: this.height - p.top - p.bottom };
    }

    private get domain(): [number, number] {
        return zeroBasedDomain(this.data.map((d) => d.value), 5);
    }

    private get valueScale() {
        const a = this.area;
        let range: [number, number] = [a.left, a.right];
        if (this.vertical) range = [a.bottom, a.top];
        else if (this.rtl) range = [a.right, a.left];
        return linearScale(this.domain, range);
    }

    private growsRight(value: number): boolean {
        return value >= 0 !== this.rtl;
    }

    private verticalLabelY(area: Area, span: Span): number {
        if (span.value >= 0) return span.start - 6;
        const below = span.start + span.length + 14;
        return below <= area.bottom + 2 ? below : span.start + span.length - 6;
    }

    private horizontalLabel(area: Area, span: Span): { x: number; anchor: 'start' | 'end' } {
        const growsRight = this.growsRight(span.value);
        const freeEnd = growsRight ? span.start + span.length : span.start;
        const room = growsRight ? area.right - freeEnd : freeEnd - area.left;
        const outside = room >= LABEL_ROOM;
        return { x: growsRight === outside ? freeEnd + 6 : freeEnd - 6, anchor: growsRight === outside ? 'start' : 'end' };
    }

    private bars(): BarRect[] {
        const data = this.data;
        if (data.length === 0) return [];
        const area = this.area;
        const gap = this.barGap;
        const size = ((this.vertical ? area.width : area.height) - (data.length - 1) * gap) / data.length;
        const scale = this.valueScale;
        const zero = scale.scale(0);
        return data.map((point, index) => {
            const end = scale.scale(point.value);
            const span: Span = { start: Math.min(zero, end), length: Math.abs(end - zero), value: point.value };
            const offset = index * (size + gap);
            const rect = this.vertical ? this.columnRect(area, span, size, offset) : this.rowRect(area, span, size, area.top + offset);
            return { index, data: point, color: getChartColor(index, point.color), value: point.value, ...rect };
        });
    }

    private columnRect(area: Area, span: Span, size: number, offset: number) {
        const x = this.rtl ? area.right - offset - size : area.left + offset;
        return { x, y: span.start, width: size, height: span.length, labelPosition: { x: x + size / 2, y: this.verticalLabelY(area, span) }, labelAnchor: 'middle' as const };
    }

    private rowRect(area: Area, span: Span, size: number, y: number) {
        const label = this.horizontalLabel(area, span);
        return { x: span.start, y, width: span.length, height: size, labelPosition: { x: label.x, y: y + size / 2 }, labelAnchor: label.anchor };
    }

    /** Where the tooltip sits for a bar: beside its free end, so pointer and keyboard land in the same place. */
    private tooltipFor(bar: BarRect): { x: number; y: number } {
        return this.vertical ? { x: bar.x + bar.width / 2 + 12, y: bar.y - 8 } : { x: bar.x + bar.width + 12, y: bar.y + bar.height / 2 };
    }

    private onBarHover(bar: BarRect): void {
        this.hoverIndex = bar.index;
        this.tooltipPos = this.tooltipFor(bar);
        this.emit<ChartClickEvent | null>('bar-hover', { point: bar.data, index: bar.index });
    }

    private onBarLeave(): void {
        this.hoverIndex = null;
        this.emit<ChartClickEvent | null>('bar-hover', null);
    }

    private onBarClick(event: Event, bar: BarRect): void {
        this.emit<ChartClickEvent>('bar-click', { point: bar.data, index: bar.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onBarKey(event: KeyboardEvent, bar: BarRect): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.onBarClick(event, bar);
    }

    private readonly fmt = (value: number) => formatChartValue(value, { compact: true });
    private readonly fmtAxis = (value: number) => formatChartValue(value, { compact: true, decimals: Number.isInteger(value) ? 0 : 6 });

    private grid(area: Area, ticks: number[]) {
        const scale = this.valueScale;
        const negative = this.domain[0] < 0;
        return svg`<g class="grid">${ticks.map((tick) => {
            const zeroLine = tick === 0 && negative;
            const pos = scale.scale(tick);
            const [x1, y1, x2, y2] = this.vertical ? [area.left, pos, area.right, pos] : [pos, area.top, pos, area.bottom];
            return svg`<line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke="currentColor" stroke-opacity=${zeroLine ? 1 : 0.2} stroke-dasharray=${zeroLine ? nothing : '4 4'} class=${zeroLine ? 'zero' : nothing} />`;
        })}</g>`;
    }

    private axes(area: Area, ticks: number[], bars: BarRect[]) {
        const scale = this.valueScale;
        const rtl = this.rtl;
        return svg`<g class="axis">${ticks.map((tick) =>
            this.vertical
                ? svg`<text x=${rtl ? area.right + 8 : area.left - 8} y=${scale.scale(tick)} text-anchor="end" dominant-baseline="middle" fill="currentColor">${this.fmtAxis(tick)}</text>`
                : svg`<text x=${scale.scale(tick)} y=${area.bottom + 16} text-anchor="middle" fill="currentColor">${this.fmtAxis(tick)}</text>`,
        )}</g>
        <g class="axis">${bars.map((bar) =>
            this.vertical
                ? svg`<text x=${bar.x + bar.width / 2} y=${area.bottom + 16} text-anchor="middle" fill="currentColor">${bar.data.name}</text>`
                : svg`<text x=${rtl ? area.right + 12 : area.left - 12} y=${bar.y + bar.height / 2} text-anchor="end" dominant-baseline="middle" fill="currentColor">${bar.data.name}</text>`,
        )}</g>`;
    }

    private barGroup(bar: BarRect) {
        const hover = this.hoverIndex;
        return svg`<g class="bar" data-dim=${hover !== null && hover !== bar.index ? '' : nothing} tabindex="0" role="button" aria-label=${getPointAriaLabel(bar.data.name, bar.value)}
            @mouseenter=${() => this.onBarHover(bar)}
            @mouseleave=${() => this.onBarLeave()}
            @focus=${() => this.onBarHover(bar)}
            @blur=${() => this.onBarLeave()}
            @click=${(event: Event) => this.onBarClick(event, bar)}
            @keydown=${(event: KeyboardEvent) => this.onBarKey(event, bar)}>
            <rect x=${bar.x} y=${bar.y} width=${bar.width} height=${bar.height} rx=${this.barRadius} fill=${bar.color} data-hover=${hover === bar.index ? '' : nothing} />
            ${this.showValues
                ? svg`<text class="value" x=${bar.labelPosition.x} y=${bar.labelPosition.y} text-anchor=${bar.labelAnchor} dominant-baseline=${this.vertical ? 'auto' : 'middle'}>${this.fmt(bar.value)}</text>`
                : nothing}
        </g>`;
    }

    private captions() {
        const w = this.svgWidth;
        const rtl = this.rtl;
        const rotate = rtl ? `rotate(90 ${w - 12} ${this.height / 2})` : `rotate(-90 12 ${this.height / 2})`;
        return svg`${this.xAxisLabel ? svg`<text class="caption" x=${w / 2} y=${this.height - 4} text-anchor="middle">${this.xAxisLabel}</text>` : nothing}
            ${this.yAxisLabel ? svg`<text class="caption" x=${rtl ? w - 12 : 12} y=${this.height / 2} text-anchor="middle" transform=${rotate}>${this.yAxisLabel}</text>` : nothing}`;
    }

    protected override render() {
        const area = this.area;
        const bars = this.bars();
        const ticks = this.valueScale.ticks(5);
        const hovered = this.hoverIndex === null ? null : (bars.find((b) => b.index === this.hoverIndex) ?? null);
        const w = this.svgWidth;
        const label = getChartSummary(this.vertical ? 'Column chart' : 'Bar chart', this.data.length, this.heading);
        return html`<div part="base" class="base" data-slot="bar-chart">
            <svg role="group" aria-label=${label} viewBox=${`0 0 ${w} ${this.height}`} width="100%" height="auto" style=${`max-width:${w}px;aspect-ratio:${w} / ${this.height}`}>
                ${this.showGrid ? this.grid(area, ticks) : nothing} ${this.axes(area, ticks, bars)}
                <g>${bars.map((bar) => this.barGroup(bar))}</g>
                ${this.captions()}
            </svg>
            ${hovered && this.showTooltip
                ? html`<div class="tooltip" data-flip=${this.tooltipPos.x > w * 0.7 ? '' : nothing} style=${`left:${this.tooltipPos.x}px;top:${this.tooltipPos.y}px`}>
                      <div class="name">${hovered.data.name}</div>
                      <div class="amount">${this.fmt(hovered.value)}</div>
                  </div>`
                : nothing}
        </div>`;
    }
}
