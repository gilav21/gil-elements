import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, XYDataPoint, XYSeries } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale, niceDomain } from '../shared/chart/chart-scale.js';
import { nearestPoint2D, pointerToSvg } from '../shared/chart/chart-interaction.js';
import type { ChartLegendItem } from '../chart-legend/index.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './scatter-chart.css?inline';

interface PlottedPoint {
    cx: number;
    cy: number;
    color: string;
    seriesIndex: number;
    pointIndex: number;
    datum: XYDataPoint;
    seriesName: string;
}
interface Hovered {
    s: number;
    p: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 14;

const seriesKey = (s: XYSeries): string => s.id ?? s.name;

/**
 * Clouds of points in continuous x/y space, one cloud per series. Both axes scale to nice bounds covering the visible
 * points, so hiding a series in the legend rescales the chart. A point is a button: it takes focus and Enter activates it.
 *
 * @fires point-click - A point was activated; `detail` is `{ point, index }`, the index within its own series.
 * @attr {number} point-radius - Radius of a point in px; the hovered one is 2px larger. Defaults to 5.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the nearest point. On by default.
 * @attr {boolean} show-legend - The legend below the chart. On by default.
 * @prop {XYSeries[]} series - One cloud per entry: `{ id?, name, color?, points: { x, y, label? }[] }`.
 * @csspart base - The chart container.
 */
export class GeScatterChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        series: { attribute: false },
        pointRadius: { type: Number, attribute: 'point-radius' },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        hovered: { state: true },
        tooltipPos: { state: true },
    };

    declare series: XYSeries[];
    declare pointRadius: number;
    declare showGrid: boolean;
    declare showTooltip: boolean;
    declare showLegend: boolean;
    declare hovered: Hovered | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.series = [];
        this.pointRadius = 5;
        this.showGrid = true;
        this.showTooltip = true;
        this.showLegend = true;
        this.hovered = null;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 520;
        this.height = 320;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'scatter-chart-host';
    }

    private get visible(): { s: XYSeries; i: number }[] {
        return this.series.map((s, i) => ({ s, i })).filter(({ s }) => !this.hiddenKeys.includes(seriesKey(s)));
    }

    private get area() {
        const rtl = this.rtl;
        return { left: rtl ? PAD_EDGE : PAD_AXIS, right: this.svgWidth - (rtl ? PAD_AXIS : PAD_EDGE), top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    private domainOf(pick: (p: XYDataPoint) => number): [number, number] {
        const range = extent(this.visible.flatMap(({ s }) => s.points.map(pick)));
        return range ? niceDomain(range[0], range[1], 5) : [0, 1];
    }

    private get xScale() {
        const a = this.area;
        return linearScale(this.domainOf((p) => p.x), this.rtl ? [a.right, a.left] : [a.left, a.right]);
    }

    private get yScale() {
        const a = this.area;
        return linearScale(this.domainOf((p) => p.y), [a.bottom, a.top]);
    }

    private plotted(): PlottedPoint[] {
        const xs = this.xScale;
        const ys = this.yScale;
        return this.visible.flatMap(({ s, i }) =>
            s.points.map((p, pi) => ({ cx: xs.scale(p.x), cy: ys.scale(p.y), color: getChartColor(i, s.color), seriesIndex: i, pointIndex: pi, datum: p, seriesName: s.name })),
        );
    }

    /** Highlights a point, which enlarges it and fills the tooltip; `null` clears it. The tooltip keeps its last position. */
    setHover(seriesIndex: number | null, pointIndex = 0): void {
        this.hovered = seriesIndex === null ? null : { s: seriesIndex, p: pointIndex };
    }

    private readonly onPointerMove = (event: MouseEvent | TouchEvent) => {
        const el = this.shadowRoot?.querySelector('svg');
        if (!el) return;
        const local = pointerToSvg(event, el);
        const nearest = nearestPoint2D(local, this.plotted().map((p) => ({ x: p.cx, y: p.cy, datum: p })));
        if (!nearest) return;
        const point = nearest.point.datum;
        this.tooltipPos = { x: point.cx + 10, y: Math.max(8, point.cy - 8) };
        this.hovered = { s: point.seriesIndex, p: point.pointIndex };
    };

    private readonly onPointerLeave = () => this.setHover(null);

    private readonly onToggle = (event: Event) => {
        event.stopPropagation();
        this.toggleSeries((event as CustomEvent<string>).detail);
    };

    private activate(seriesIndex: number, pointIndex: number): void {
        const point = this.series[seriesIndex]?.points[pointIndex];
        if (point) this.emit<ChartClickEvent<XYDataPoint>>('point-click', { point, index: pointIndex });
    }

    private tooltipRows(): ChartTooltipRow[] {
        const h = this.hovered;
        const s = h ? this.series[h.s] : undefined;
        const p = h ? s?.points[h.p] : undefined;
        if (!h || !s || !p) return [];
        return [{ label: s.name, value: `(${formatChartValue(p.x)}, ${formatChartValue(p.y)})`, color: getChartColor(h.s, s.color) }];
    }

    private plot() {
        const a = this.area;
        const xs = this.xScale;
        const ys = this.yScale;
        const rtl = this.rtl;
        const yTicks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
        const xTicks = xs.ticks(5).map((value) => ({ value, x: xs.scale(value) }));
        const h = this.hovered;
        return svg`
            ${this.showGrid ? yTicks.map((g) => svg`<line class="grid" data-slot="grid-line" x1=${a.left} x2=${a.right} y1=${g.y} y2=${g.y} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
            ${yTicks.map((g) => svg`<text class="tick" x=${rtl ? a.right + 8 : a.left - 8} y=${g.y + 3} text-anchor=${rtl ? 'start' : 'end'}>${g.value}</text>`)}
            ${xTicks.map((g) => svg`<text class="tick" x=${g.x} y=${this.height - 10} text-anchor="middle">${g.value}</text>`)}
            ${this.plotted().map(
                (p) => svg`<circle class="point" data-slot="scatter-point" cx=${p.cx} cy=${p.cy} r=${h?.s === p.seriesIndex && h?.p === p.pointIndex ? this.pointRadius + 2 : this.pointRadius}
                    fill=${p.color} fill-opacity="0.75" tabindex="0" role="button" aria-label=${`${p.seriesName}: (${p.datum.x}, ${p.datum.y})`}
                    @click=${() => this.activate(p.seriesIndex, p.pointIndex)}
                    @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this.activate(p.seriesIndex, p.pointIndex)} />`,
            )}`;
    }

    protected override render() {
        const rows = this.tooltipRows();
        const legend: ChartLegendItem[] = this.series.map((s, i) => ({ key: seriesKey(s), label: s.name, color: getChartColor(i, s.color) }));
        return html`<div part="base" class="base" data-slot="scatter-chart" role="group" aria-label=${getChartSummary('Scatter chart', this.series.length, this.heading)}>
            <svg
                viewBox=${`0 0 ${this.svgWidth} ${this.height}`}
                width="100%"
                height=${this.height}
                @mousemove=${this.onPointerMove}
                @mouseleave=${this.onPointerLeave}
                @touchstart=${this.onPointerMove}
                @touchmove=${this.onPointerMove}
            >
                ${this.plot()}
            </svg>
            ${this.showTooltip
                ? html`<ge-chart-tooltip
                      .visible=${this.hovered !== null && rows.length > 0}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .rows=${rows}
                      .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
                  ></ge-chart-tooltip>`
                : nothing}
            ${this.showLegend ? html`<ge-chart-legend .items=${legend} .hiddenKeys=${this.hiddenKeys} @item-toggle=${this.onToggle}></ge-chart-legend>` : nothing}
        </div>`;
    }
}
