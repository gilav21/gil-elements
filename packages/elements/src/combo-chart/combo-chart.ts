import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, ChartDataPoint, ChartSeries } from '../shared/chart/chart.types.js';
import { extent, formatChartValueOrGap, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { bandScale, linearScale, zeroBasedDomain } from '../shared/chart/chart-scale.js';
import { finiteOrZero, linePath } from '../shared/chart/chart-path.js';
import { nearestPointX, pointerToSvg } from '../shared/chart/chart-interaction.js';
import type { ChartLegendItem } from '../chart-legend/index.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './combo-chart.css?inline';

interface Bar {
    categoryIndex: number;
    seriesIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}
interface Line {
    key: string;
    name: string;
    color: string;
    path: string;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const CUMULATIVE_KEY = '__cumulative__';

/**
 * Grouped bars on one axis with lines over them on a second, hidden one, for a quantity and a rate or a running share. The
 * first bar series names the categories and feeds the cumulative line; the line axis has no labels, so put its unit in the
 * series names. The legend is a key only.
 *
 * @fires bar-click - A bar was clicked; `detail` is `{ point, index }`, the point of that bar's own series and the category index.
 * @attr {boolean} show-cumulative - A Pareto line of the first bar series' running total as a percentage of its total. Off by default.
 * @attr {string} cumulative-label - The name of that line. Defaults to `Cumulative`.
 * @attr {number} bar-radius - Corner radius of a bar in px. Defaults to 2.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered category. On by default.
 * @attr {boolean} show-legend - The key below the chart. On by default.
 * @prop {ChartSeries[]} barSeries - One bar per category for each entry, side by side, matched to categories by position.
 * @prop {ChartSeries[]} lineSeries - One line per entry, on the second axis.
 * @csspart base - The chart container.
 */
export class GeComboChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        barSeries: { attribute: false },
        lineSeries: { attribute: false },
        showCumulative: { type: Boolean, attribute: 'show-cumulative' },
        cumulativeLabel: { attribute: 'cumulative-label' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        tooltipPos: { state: true },
    };

    declare barSeries: ChartSeries[];
    declare lineSeries: ChartSeries[];
    declare showCumulative: boolean;
    declare cumulativeLabel: string;
    declare barRadius: number;
    declare showGrid: boolean;
    declare showTooltip: boolean;
    declare showLegend: boolean;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.barSeries = [];
        this.lineSeries = [];
        this.showCumulative = false;
        this.cumulativeLabel = 'Cumulative';
        this.barRadius = 2;
        this.showGrid = true;
        this.showTooltip = true;
        this.showLegend = true;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 540;
        this.height = 320;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'combo-chart-host';
    }

    /** The category labels, taken from the first bar series. */
    get categories(): string[] {
        return this.barSeries[0]?.data.map((d) => d.name) ?? [];
    }

    /** The hovered category. An index counts only while it names a category, so a stale one reads as no hover. */
    private get hovered(): number | null {
        const i = this.hoverIndex;
        return i !== null && Number.isInteger(i) && i >= 0 && i < this.categories.length ? i : null;
    }

    /** Highlights a whole category, which dims the other bars and drives the crosshair and tooltip; `null` clears it. */
    setHover(index: number | null): void {
        this.hoverIndex = index;
    }

    private get cumulative(): number[] {
        const first = this.barSeries[0];
        if (!first) return [];
        // A non-finite value counts as 0, so one bad datum never changes the rest.
        const total = first.data.reduce((sum, d) => sum + finiteOrZero(d.value), 0) || 1;
        let running = 0;
        return first.data.map((d) => {
            running += finiteOrZero(d.value);
            return (running / total) * 100;
        });
    }

    private get area() {
        return { left: PAD_AXIS, right: this.svgWidth - PAD_AXIS, top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    /** Categories are keyed by position, not name: two categories may share a label. */
    private get band() {
        const a = this.area;
        return bandScale(this.categories.map((...[, i]) => String(i)), this.rtl ? [a.right, a.left] : [a.left, a.right], 0.3, 0.15);
    }

    private get primary() {
        const a = this.area;
        return linearScale(zeroBasedDomain(this.barSeries.flatMap((s) => s.data.map((d) => d.value)), 5), [a.bottom, a.top]);
    }

    private get secondary() {
        const a = this.area;
        const values = this.lineSeries.flatMap((s) => s.data.map((d) => d.value));
        if (this.showCumulative) values.push(100, ...this.cumulative);
        return linearScale(extent(values) ? zeroBasedDomain(values, 5) : [0, 100], [a.bottom, a.top]);
    }

    private get centres(): number[] {
        const band = this.band;
        return this.categories.map((...[, i]) => (band.position(String(i)) ?? 0) + band.bandwidth / 2);
    }

    private bars(): Bar[] {
        const band = this.band;
        const scale = this.primary;
        const zero = scale.scale(0);
        const sub = band.bandwidth / Math.max(1, this.barSeries.length);
        return this.categories.flatMap((...[, ci]) =>
            this.barSeries.map((s, si) => {
                const end = scale.scale(finiteOrZero(s.data[ci]?.value));
                return { categoryIndex: ci, seriesIndex: si, x: (band.position(String(ci)) ?? 0) + si * sub, y: Math.min(zero, end), width: sub, height: Math.abs(end - zero), color: getChartColor(si, s.color) };
            }),
        );
    }

    private lines(): Line[] {
        const centres = this.centres;
        const scale = this.secondary;
        const place = (values: (number | undefined)[]) => linePath(values.flatMap((v, ci) => (centres[ci] === undefined ? [] : [{ x: centres[ci], y: scale.scale(v as number) }])), 'linear');
        const explicit = this.lineSeries.map((s, i): Line => ({ key: s.id ?? s.name, name: s.name, color: getChartColor(this.barSeries.length + i, s.color), path: place(s.data.map((d) => d.value)) }));
        if (!this.showCumulative) return explicit;
        return [{ key: CUMULATIVE_KEY, name: this.cumulativeLabel, color: getChartColor(this.barSeries.length + explicit.length), path: place(this.cumulative) }, ...explicit];
    }

    private tooltipRows(i: number): ChartTooltipRow[] {
        const bars = this.barSeries.map((s, si) => ({ label: s.name, value: formatChartValueOrGap(s.data[i]?.value), color: getChartColor(si, s.color) }));
        const lines = this.lineSeries.map((s, li) => ({ label: s.name, value: formatChartValueOrGap(s.data[i]?.value), color: getChartColor(this.barSeries.length + li, s.color) }));
        const rows = [...bars, ...lines];
        if (this.showCumulative) {
            rows.push({ label: this.cumulativeLabel, value: `${(this.cumulative[i] ?? 0).toFixed(0)}%`, color: getChartColor(this.barSeries.length + this.lineSeries.length) });
        }
        return rows;
    }

    private readonly onPointerMove = (event: MouseEvent | TouchEvent) => {
        const el = this.shadowRoot?.querySelector('svg');
        if (!el) return;
        const local = pointerToSvg(event, el);
        const nearest = nearestPointX(local.x, this.centres.map((x, i) => ({ x, datum: i })));
        if (!nearest) return;
        this.tooltipPos = { x: nearest.point.x + 12, y: Math.max(8, local.y - 8) };
        this.setHover(nearest.index);
    };

    private readonly onPointerLeave = () => this.setHover(null);

    private activate(bar: Bar): void {
        const point: ChartDataPoint | undefined = this.barSeries[bar.seriesIndex]?.data[bar.categoryIndex];
        if (point) this.emit<ChartClickEvent>('bar-click', { point, index: bar.categoryIndex });
    }

    protected override render() {
        const a = this.area;
        const primary = this.primary;
        const ticks = primary.ticks(5).map((value) => ({ value, y: primary.scale(value) }));
        const hover = this.hovered;
        const centres = this.centres;
        const lines = this.lines();
        const legend: ChartLegendItem[] = [
            ...this.barSeries.map((s, i) => ({ key: s.name, label: s.name, color: getChartColor(i, s.color) })),
            ...lines.map((l) => ({ key: l.key, label: l.name, color: l.color })),
        ];
        const rows = hover === null ? [] : this.tooltipRows(hover);
        const tooltipHeading = hover === null ? undefined : this.categories[hover];
        return html`<div part="base" class="base" data-slot="combo-chart" role="group" aria-label=${getChartSummary('Combo chart', this.categories.length, this.heading)}>
            <svg
                viewBox=${`0 0 ${this.svgWidth} ${this.height}`}
                width="100%"
                height=${this.height}
                @mousemove=${this.onPointerMove}
                @mouseleave=${this.onPointerLeave}
                @touchstart=${this.onPointerMove}
                @touchmove=${this.onPointerMove}
            >
                ${this.showGrid ? ticks.map((g) => svg`<line class="grid" data-slot="grid-line" x1=${a.left} x2=${a.right} y1=${g.y} y2=${g.y} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
                ${ticks.map((g) => svg`<text class="tick" x=${a.left - 8} y=${g.y + 3} text-anchor="end">${g.value}</text>`)}
                ${this.categories.map((name, i) => svg`<text class="tick" x=${centres[i]!} y=${this.height - 10} text-anchor="middle">${name}</text>`)}
                ${this.bars().map(
                    (b) => svg`<rect class="bar" data-slot="combo-bar" x=${b.x} y=${b.y} width=${b.width} height=${b.height} rx=${this.barRadius} fill=${b.color}
                        opacity=${hover === null || hover === b.categoryIndex ? 1 : 0.55} @click=${() => this.activate(b)} />`,
                )}
                ${hover === null ? nothing : svg`<line class="crosshair" data-slot="crosshair" x1=${centres[hover]!} x2=${centres[hover]!} y1=${a.top} y2=${a.bottom} stroke-width="1" />`}
                ${lines.map((l) => svg`<path data-slot="combo-line" d=${l.path} fill="none" stroke=${l.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`)}
            </svg>
            ${this.showTooltip
                ? html`<ge-chart-tooltip
                      .visible=${hover !== null && rows.length > 0}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .heading=${tooltipHeading}
                      .rows=${rows}
                      .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
                  ></ge-chart-tooltip>`
                : nothing}
            ${this.showLegend ? html`<ge-chart-legend .items=${legend} .interactive=${false}></ge-chart-legend>` : nothing}
        </div>`;
    }
}
