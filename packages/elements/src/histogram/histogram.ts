import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale, niceDomain } from '../shared/chart/chart-scale.js';
import { computeBins, type HistogramBin } from '../shared/chart/histogram-bins.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './histogram.css?inline';

interface Bar {
    index: number;
    bin: HistogramBin;
    x: number;
    y: number;
    width: number;
    height: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 12;

/**
 * The distribution of a raw sample: pass the observations and the element bins them (Sturges' rule unless `bin-count` or
 * `binEdges` say otherwise), drops non-finite entries, and draws a bar per bin. A bar is a button: it takes focus, and
 * Enter or Space activates it. RTL mirrors the value axis, not the count axis.
 *
 * @fires bin-click - A bar was activated; `detail` is `{ point: bin, index, event }`.
 * @fires bin-hover - A bar was entered or focused (`detail` is `{ point: bin, index }`), or `null` once left.
 * @attr {number} bin-count - How many equal-width bins; below 1 or unset falls back to Sturges' rule.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-values - The count above each non-empty bar. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the active bar. On by default.
 * @attr {number} bar-radius - Corner radius in px. Defaults to 2.
 * @attr {number} bar-gap - Gap between bars in px, taken out of each bar. Defaults to 2.
 * @attr {string} color - Fill of every bar.
 * @attr {string} unit - Written after the bin bounds, as in `ms`.
 * @prop {number[]} values - The sample, one number per observation.
 * @prop {number[]} binEdges - Explicit ascending boundaries; wins over `bin-count`, and samples outside them are not counted.
 * @csspart base - The chart container.
 */
export class GeHistogram extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        values: { attribute: false },
        binCount: { type: Number, attribute: 'bin-count' },
        binEdges: { attribute: false },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showValues: { converter: defaultTrue, attribute: 'show-values' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        barGap: { type: Number, attribute: 'bar-gap' },
        color: {},
        unit: {},
        tooltipPos: { state: true },
    };

    declare values: number[];
    declare binCount: number | undefined;
    declare binEdges: number[] | undefined;
    declare showGrid: boolean;
    declare showValues: boolean;
    declare showTooltip: boolean;
    declare barRadius: number;
    declare barGap: number;
    declare color: string | undefined;
    declare unit: string;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.values = [];
        this.showGrid = true;
        this.showValues = true;
        this.showTooltip = true;
        this.barRadius = 2;
        this.barGap = 2;
        this.unit = '';
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'histogram-host';
    }

    /** The binned sample. */
    get bins(): HistogramBin[] {
        return computeBins(this.values, { binCount: this.binCount, binEdges: this.binEdges });
    }

    private get area() {
        const rtl = this.rtl;
        return { left: rtl ? PAD_EDGE : PAD_AXIS, right: this.svgWidth - (rtl ? PAD_AXIS : PAD_EDGE), top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    private fmt(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit;
    }

    private range(bin: HistogramBin): string {
        return `${this.fmt(bin.start)} – ${this.fmt(bin.end)}`;
    }

    private layout(bins: HistogramBin[]) {
        const a = this.area;
        const max = Math.max(0, extent(bins.map((b) => b.count))?.[1] ?? 0);
        const ys = linearScale(max > 0 ? niceDomain(0, max, 5) : [0, 1], [a.bottom, a.top]);
        const xs = linearScale([bins[0]?.start ?? 0, bins.at(-1)?.end ?? 1], this.rtl ? [a.right, a.left] : [a.left, a.right]);
        const bars: Bar[] = bins.map((bin, index) => {
            const startX = xs.scale(bin.start);
            const endX = xs.scale(bin.end);
            const slot = Math.abs(endX - startX);
            const width = Math.max(1, slot - this.barGap);
            const y = ys.scale(bin.count);
            return { index, bin, x: Math.min(startX, endX) + (slot - width) / 2, y, width, height: Math.max(0, a.bottom - y) };
        });
        const whole = ys.ticks(5).filter((t) => Number.isInteger(t));
        const counts = (whole.length > 0 ? whole : [0]).map((value) => ({ value, y: ys.scale(value) }));
        const edges = [bins[0]!.start, ...bins.map((b) => b.end)].map((value) => ({ value, x: xs.scale(value) }));
        return { bars, counts, edges };
    }

    /** Marks a bar as active, which dims the others and fills the tooltip; `null` clears it. */
    setHover(index: number | null): void {
        this.hoverIndex = index;
    }

    private readonly enter = (bar: Bar) => {
        this.hoverIndex = bar.index;
        this.tooltipPos = { x: bar.x + bar.width / 2 + 8, y: Math.max(8, bar.y - 8) };
        this.emit('bin-hover', { point: bar.bin, index: bar.index });
    };

    private readonly leave = () => {
        this.hoverIndex = null;
        this.emit('bin-hover', null);
    };

    private activate(event: Event, bar: Bar): void {
        this.emit<ChartClickEvent<HistogramBin>>('bin-click', { point: bar.bin, index: bar.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onKey(event: KeyboardEvent, bar: Bar): void {
        if (event.key === 'Enter' || event.key === ' ') this.activate(event, bar);
    }

    private bar(bar: Bar, color: string) {
        const hover = this.hoverIndex;
        return svg`<g class=${`group${hover !== null && hover !== bar.index ? ' dim' : ''}`} data-slot="histogram-bar" tabindex="0" role="button" aria-label=${`${this.range(bar.bin)}: ${bar.bin.count}`}
            @mouseenter=${() => this.enter(bar)} @touchstart=${() => this.enter(bar)} @mouseleave=${this.leave} @focus=${() => this.enter(bar)} @blur=${this.leave}
            @click=${(event: MouseEvent) => this.activate(event, bar)} @keydown=${(event: KeyboardEvent) => this.onKey(event, bar)}>
            <rect class=${`bar${hover === bar.index ? ' hot' : ''}`} x=${bar.x} y=${bar.y} width=${bar.width} height=${bar.height} rx=${this.barRadius} fill=${color} />
            ${this.showValues && bar.bin.count > 0 ? svg`<text class="value" x=${bar.x + bar.width / 2} y=${bar.y - 4} text-anchor="middle">${bar.bin.count}</text>` : nothing}
        </g>`;
    }

    private tooltip(bins: HistogramBin[]) {
        const hover = this.hoverIndex;
        const bin = hover === null ? undefined : bins[hover];
        const rows: ChartTooltipRow[] = bin ? [{ label: 'Count', value: formatChartValue(bin.count, { decimals: 0 }), color: getChartColor(0, this.color) }] : [];
        return html`<ge-chart-tooltip
            .visible=${hover !== null}
            .x=${this.tooltipPos.x}
            .y=${this.tooltipPos.y}
            .heading=${bin ? this.range(bin) : undefined}
            .rows=${rows}
            .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
        ></ge-chart-tooltip>`;
    }

    protected override render() {
        const bins = this.bins;
        const label = getChartSummary('Histogram', bins.length, this.heading);
        if (bins.length === 0) {
            return html`<div part="base" class="base" data-slot="histogram" role="group" aria-label=${label}>
                <div class="empty" data-slot="histogram-empty" style=${`min-height:${this.height}px`}>No data to display</div>
            </div>`;
        }
        const a = this.area;
        const rtl = this.rtl;
        const { bars, counts, edges } = this.layout(bins);
        const color = getChartColor(0, this.color);
        return html`<div part="base" class="base" data-slot="histogram" role="group" aria-label=${label}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${this.height}`} width="100%" height=${this.height}>
                ${this.showGrid ? counts.map((g) => svg`<line class="grid" data-slot="grid-line" x1=${a.left} x2=${a.right} y1=${g.y} y2=${g.y} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
                ${counts.map((g) => svg`<text class="tick" x=${rtl ? a.right + 8 : a.left - 8} y=${g.y + 3} text-anchor=${rtl ? 'start' : 'end'}>${g.value}</text>`)}
                ${edges.map((t) => svg`<text class="tick" x=${t.x} y=${this.height - 10} text-anchor="middle">${this.fmt(t.value)}</text>`)}
                ${bars.map((b) => this.bar(b, color))}
            </svg>
            ${this.showTooltip ? this.tooltip(bins) : nothing}
        </div>`;
    }
}
