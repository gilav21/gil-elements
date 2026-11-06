import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartSeries, StackingMode } from '../shared/chart/chart.types.js';
import { formatChartValue, formatPercentage, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale, zeroBasedDomain } from '../shared/chart/chart-scale.js';
import css from './stacked-bar-chart.css?inline';

interface Segment {
    seriesIndex: number;
    categoryIndex: number;
    seriesName: string;
    category: string;
    value: number;
    percentage: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}
interface Stack {
    categoryIndex: number;
    category: string;
    segments: Segment[];
    total: number;
}
interface HoverKey {
    category: number;
    series: number;
}

const PAD_TOP = 20;
const PAD_BOTTOM = 35;
const PAD_SIDE = 20;
const PAD_AXIS = 70;

/**
 * Stacked columns over shared categories. Series data pairs with `categories` by index, and a missing entry counts as 0.
 * Positive segments stack up from zero and negative ones down. A segment is a button: it takes focus, and Enter or
 * Space activates it.
 *
 * @fires segment-click - A segment was activated; `detail` is `{ series, category, value }`, the value being the raw one.
 * @attr {string} stacking - `absolute` (default) or `percent`, which fills every stack and labels the axis in `%`.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-total - The stack total above each stack. Off by default.
 * @attr {boolean} show-legend - The legend below the chart. On by default.
 * @attr {number} bar-radius - Corner radius of a segment in px. Defaults to 4.
 * @attr {number} bar-gap - Gap between stacks in px. Defaults to 12.
 * @prop {ChartSeries[]} series - One layer per entry, stacked in array order.
 * @prop {string[]} categories - One stack per entry; its length decides how many are drawn.
 * @csspart base - The chart container.
 */
export class GeStackedBarChart extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        series: { attribute: false },
        categories: { attribute: false },
        stacking: {},
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showTotal: { type: Boolean, attribute: 'show-total' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
        hoverKey: { state: true },
    };

    declare series: ChartSeries[];
    declare categories: string[];
    declare stacking: StackingMode;
    declare showGrid: boolean;
    declare showTotal: boolean;
    declare showLegend: boolean;
    declare barRadius: number;
    declare barGap: number;
    declare hoverKey: HoverKey | null;

    constructor() {
        super();
        this.series = [];
        this.categories = [];
        this.stacking = 'absolute';
        this.showGrid = true;
        this.showTotal = false;
        this.showLegend = true;
        this.barRadius = 4;
        this.barGap = 12;
        this.hoverKey = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'stacked-bar-chart-host';
        setTimeout(() => (this.domRtl = getComputedStyle(this).direction === 'rtl'));
    }

    private get percent(): boolean {
        return this.stacking === 'percent';
    }

    private get area() {
        const rtl = this.rtl;
        const left = rtl ? PAD_SIDE : PAD_AXIS;
        const right = this.svgWidth - (rtl ? PAD_AXIS : PAD_SIDE);
        return { left, right, top: PAD_TOP, bottom: this.height - PAD_BOTTOM, width: right - left };
    }

    private rawValues(categoryIndex: number): number[] {
        return this.series.map((s) => s.data[categoryIndex]?.value ?? 0);
    }

    /** What each segment adds to its stack: the raw value, or in percent mode its share of the stack's absolute total. */
    private stackUnits(): number[][] {
        return this.categories.map((...[, index]) => {
            const raw = this.rawValues(index);
            if (!this.percent) return raw;
            const absTotal = raw.reduce((sum, v) => sum + Math.abs(v), 0);
            return raw.map((v) => (absTotal === 0 ? 0 : (100 * v) / absTotal));
        });
    }

    private get domain(): [number, number] {
        let up = 0;
        let down = 0;
        for (const units of this.stackUnits()) {
            up = Math.max(up, units.reduce((sum, v) => sum + Math.max(0, v), 0));
            down = Math.min(down, units.reduce((sum, v) => sum + Math.min(0, v), 0));
        }
        if (this.percent && down === 0) return [0, 100];
        return zeroBasedDomain([up, down], 5);
    }

    private get scale() {
        const a = this.area;
        return linearScale(this.domain, [a.bottom, a.top]);
    }

    private get ticks(): number[] {
        if (this.percent && this.domain[0] === 0) return [0, 25, 50, 75, 100];
        return this.scale.ticks(5);
    }

    private stacks(): Stack[] {
        const count = this.categories.length;
        if (count === 0) return [];
        const a = this.area;
        const size = (a.width - (count - 1) * this.barGap) / count;
        const scale = this.scale;
        const units = this.stackUnits();
        return this.categories.map((category, ci) => {
            const offset = ci * (size + this.barGap);
            const x = this.rtl ? a.right - offset - size : a.left + offset;
            const raw = this.rawValues(ci);
            const absTotal = raw.reduce((sum, v) => sum + Math.abs(v), 0);
            let up = 0;
            let down = 0;
            const segments = this.series.map((s, si): Segment => {
                const unit = units[ci]![si]!;
                const near = unit >= 0 ? up : down;
                const far = near + unit;
                if (unit >= 0) up = far;
                else down = far;
                const top = scale.scale(Math.max(near, far));
                return {
                    seriesIndex: si,
                    categoryIndex: ci,
                    seriesName: s.name,
                    category,
                    value: raw[si]!,
                    percentage: absTotal > 0 ? (raw[si]! / absTotal) * 100 : 0,
                    x,
                    y: top,
                    width: size,
                    height: scale.scale(Math.min(near, far)) - top,
                    color: getChartColor(si, s.color),
                };
            });
            return { categoryIndex: ci, category, segments, total: raw.reduce((sum, v) => sum + v, 0) };
        });
    }

    private readonly fmt = (value: number) => formatChartValue(value, { compact: true });

    private fmtAxis(value: number): string {
        if (this.percent) return `${value}%`;
        return formatChartValue(value, { compact: true, decimals: Number.isInteger(value) ? 0 : 6 });
    }

    private isHovered(segment: Segment): boolean {
        const k = this.hoverKey;
        return k !== null && k.category === segment.categoryIndex && k.series === segment.seriesIndex;
    }

    private hoverSegment(segment: Segment): void {
        this.hoverKey = { category: segment.categoryIndex, series: segment.seriesIndex };
    }

    private activate(segment: Segment): void {
        this.emit('segment-click', { series: segment.seriesName, category: segment.category, value: segment.value });
    }

    private onKey(event: KeyboardEvent, segment: Segment): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.activate(segment);
    }

    private segmentGroup(segment: Segment) {
        const hovered = this.isHovered(segment);
        return svg`<g class="segment" data-dim=${this.hoverKey !== null && !hovered ? '' : nothing} tabindex="0" role="button"
            aria-label=${`${segment.seriesName} in ${segment.category}: ${formatChartValue(segment.value)}`}
            @mouseenter=${() => this.hoverSegment(segment)}
            @mouseleave=${() => (this.hoverKey = null)}
            @focus=${() => this.hoverSegment(segment)}
            @blur=${() => (this.hoverKey = null)}
            @click=${() => this.activate(segment)}
            @keydown=${(event: KeyboardEvent) => this.onKey(event, segment)}>
            <rect x=${segment.x} y=${segment.y} width=${segment.width} height=${segment.height} rx=${this.barRadius} fill=${segment.color} data-hover=${hovered ? '' : nothing} />
        </g>`;
    }

    private stackGroup(stack: Stack) {
        const first = stack.segments[0];
        const top = stack.segments.reduce((min, s) => Math.min(min, s.y), first?.y ?? 0);
        const centre = first ? first.x + first.width / 2 : 0;
        return svg`${stack.segments.map((s) => this.segmentGroup(s))}
            ${this.showTotal ? svg`<text class="total" x=${centre} y=${top - 6} text-anchor="middle">${this.fmt(stack.total)}</text>` : nothing}`;
    }

    private tooltip(stacks: Stack[]) {
        const k = this.hoverKey;
        const segment = k ? stacks.find((s) => s.categoryIndex === k.category)?.segments.find((s) => s.seriesIndex === k.series) : undefined;
        if (!segment) return nothing;
        const x = segment.x + segment.width / 2 + 12;
        const y = segment.y - 8;
        const share = this.percent ? ` (${formatPercentage(segment.percentage, 1)})` : '';
        return html`<div class="tooltip" data-flip=${x > this.svgWidth * 0.7 ? '' : nothing} style=${`left:${x}px;top:${y}px`}>
            <div class="name">${segment.seriesName}</div>
            <div class="amount">${`${this.fmt(segment.value)}${share}`}</div>
        </div>`;
    }

    protected override render() {
        const a = this.area;
        const rtl = this.rtl;
        const scale = this.scale;
        const ticks = this.ticks;
        const negative = this.domain[0] < 0;
        const stacks = this.stacks();
        const w = this.svgWidth;
        return html`<div part="base" class="base" data-slot="stacked-bar-chart">
            <svg role="group" aria-label=${getChartSummary('Stacked column chart', this.categories.length, this.heading)} viewBox=${`0 0 ${w} ${this.height}`} width="100%" height="auto" style=${`max-width:${w}px;aspect-ratio:${w} / ${this.height}`}>
                ${this.showGrid
                    ? svg`<g class="grid">${ticks.map((tick) => {
                          const zeroLine = tick === 0 && negative;
                          const y = scale.scale(tick);
                          return svg`<line x1=${a.left} y1=${y} x2=${a.right} y2=${y} stroke="currentColor" stroke-opacity=${zeroLine ? 1 : 0.2} stroke-dasharray=${zeroLine ? nothing : '4 4'} class=${zeroLine ? 'zero' : nothing} />`;
                      })}</g>`
                    : nothing}
                <g class="axis">${ticks.map((tick) => svg`<text x=${rtl ? a.right + 12 : a.left - 12} y=${scale.scale(tick)} text-anchor="end" dominant-baseline="middle" fill="currentColor">${this.fmtAxis(tick)}</text>`)}</g>
                <g class="axis">${stacks.map((s) => svg`<text x=${s.segments[0] ? s.segments[0].x + s.segments[0].width / 2 : 0} y=${a.bottom + 16} text-anchor="middle" fill="currentColor">${s.category}</text>`)}</g>
                <g>${stacks.map((s) => this.stackGroup(s))}</g>
            </svg>
            ${this.showLegend
                ? html`<div class="legend" data-slot="stacked-bar-chart-legend">${this.series.map(
                      (s, i) => html`<div class="item"><span class="swatch" style=${`background-color:${getChartColor(i, s.color)}`}></span><span class="label">${s.name}</span></div>`,
                  )}</div>`
                : nothing}
            ${this.tooltip(stacks)}
        </div>`;
    }
}
