import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, ChartDataPoint, ChartSeries, StackingMode } from '../shared/chart/chart.types.js';
import { formatChartValueOrGap, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { linearScale, zeroBasedDomain } from '../shared/chart/chart-scale.js';
import { areaPath, bandAreaPath, linePath, stackSeries, type CurveType } from '../shared/chart/chart-path.js';
import { nearestPointX, pointerToSvg } from '../shared/chart/chart-interaction.js';
import type { ChartLegendItem } from '../chart-legend/index.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './area-chart.css?inline';

interface AreaPath {
    name: string;
    color: string;
    area: string;
    line: string;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 12;

const seriesKey = (s: ChartSeries): string => s.id ?? s.name;

/**
 * Filled areas over shared categories, overlapping or stacked. Points match across series by position, and the
 * categories come from the first series. A missing value (`NaN`, `null`, `undefined`, infinite) breaks the area.
 *
 * @fires point-hover - The nearest category's point from the first visible series, or `null` when the pointer leaves.
 * @attr {string} curve - `linear` (default), `monotone` or `step`.
 * @attr {boolean} stacked - Stack the series instead of overlapping them.
 * @attr {string} stacking-mode - `absolute` (default) or `percent`, for a stacked chart.
 * @attr {number} fill-opacity - Opacity of the fill, 0 to 1. Defaults to 0.25.
 * @attr {boolean} show-grid - The dashed gridlines. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered category. On by default.
 * @attr {boolean} show-legend - The legend below the chart. On by default.
 * @attr {boolean} show-crosshair - The vertical line at the hovered category. On by default.
 * @prop {ChartSeries[]} series - One entry per area; `id` (else `name`) keys the legend.
 * @csspart base - The chart container.
 */
export class GeAreaChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        series: { attribute: false },
        curve: {},
        stacked: { type: Boolean },
        stackingMode: { attribute: 'stacking-mode' },
        fillOpacity: { type: Number, attribute: 'fill-opacity' },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        showCrosshair: { converter: defaultTrue, attribute: 'show-crosshair' },
        tooltipPos: { state: true },
    };

    declare series: ChartSeries[];
    declare curve: CurveType;
    declare stacked: boolean;
    declare stackingMode: StackingMode;
    declare fillOpacity: number;
    declare showGrid: boolean;
    declare showTooltip: boolean;
    declare showLegend: boolean;
    declare showCrosshair: boolean;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.series = [];
        this.curve = 'linear';
        this.stacked = false;
        this.stackingMode = 'absolute';
        this.fillOpacity = 0.25;
        this.showGrid = true;
        this.showTooltip = true;
        this.showLegend = true;
        this.showCrosshair = true;
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'area-chart-host';
    }

    /** The x axis categories, taken from the first series. */
    get categories(): string[] {
        return this.series[0]?.data.map((d) => d.name) ?? [];
    }

    private get visible(): { s: ChartSeries; i: number }[] {
        return this.series.map((s, i) => ({ s, i })).filter(({ s }) => !this.hiddenKeys.includes(seriesKey(s)));
    }

    private get area() {
        const rtl = this.rtl;
        return { left: rtl ? PAD_EDGE : PAD_AXIS, right: this.svgWidth - (rtl ? PAD_AXIS : PAD_EDGE), top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    private get xScale() {
        const a = this.area;
        const n = this.categories.length;
        return linearScale([0, Math.max(1, n - 1)], this.rtl ? [a.right, a.left] : [a.left, a.right]);
    }

    private get domain(): [number, number] {
        const vis = this.visible;
        if (this.stacked) {
            const bands = stackSeries(vis.map((v) => v.s), this.stackingMode);
            return zeroBasedDomain(bands.flatMap((band) => band.flatMap((b) => [b.lower, b.upper])), 5);
        }
        return zeroBasedDomain(vis.flatMap(({ s }) => s.data.map((d) => d.value)), 5);
    }

    private get yScale() {
        const a = this.area;
        return linearScale(this.domain, [a.bottom, a.top]);
    }

    /** Sets the active category, which drives the crosshair and the tooltip; `null` clears it. */
    setHover(index: number | null): void {
        this.hoverIndex = index;
        const first = this.visible[0];
        if (index === null || !first) {
            if (index === null) this.emit<ChartClickEvent | null>('point-hover', null);
            return;
        }
        this.emit<ChartClickEvent | null>('point-hover', { point: first.s.data[index] as ChartDataPoint, index });
    }

    private readonly onPointerMove = (event: MouseEvent | TouchEvent) => {
        const el = this.shadowRoot?.querySelector('svg');
        if (!el) return;
        const local = pointerToSvg(event, el);
        const xs = this.xScale;
        const nearest = nearestPointX(local.x, this.categories.map((...[, i]) => ({ x: xs.scale(i), datum: i })));
        if (!nearest) return;
        this.tooltipPos = { x: nearest.point.x + 12, y: Math.max(8, local.y - 8) };
        this.setHover(nearest.index);
    };

    private readonly onPointerLeave = () => this.setHover(null);

    private readonly onToggle = (event: Event) => {
        event.stopPropagation();
        this.toggleSeries((event as CustomEvent<string>).detail);
    };

    private paths(): AreaPath[] {
        return this.stacked ? this.stackedPaths() : this.overlapPaths();
    }

    private overlapPaths(): AreaPath[] {
        const xs = this.xScale;
        const ys = this.yScale;
        const baseline = ys.scale(0);
        return this.visible.map(({ s, i }) => {
            const points = s.data.map((d, index) => ({ x: xs.scale(index), y: Number.isFinite(d.value) ? ys.scale(d.value) : Number.NaN }));
            return { name: s.name, color: getChartColor(i, s.color), area: areaPath(points, baseline, this.curve), line: linePath(points, this.curve) };
        });
    }

    private stackedPaths(): AreaPath[] {
        const xs = this.xScale;
        const ys = this.yScale;
        const vis = this.visible;
        const bands = stackSeries(vis.map((v) => v.s), this.stackingMode);
        return vis.map(({ s, i }, k) => {
            const upper = bands[k]!.map((b, index) => ({ x: xs.scale(index), y: ys.scale(b.upper) }));
            const lower = bands[k]!.map((b, index) => ({ x: xs.scale(index), y: ys.scale(b.lower) }));
            return { name: s.name, color: getChartColor(i, s.color), area: bandAreaPath(upper, lower, this.curve), line: linePath(upper, this.curve) };
        });
    }

    private plot() {
        const a = this.area;
        const xs = this.xScale;
        const ys = this.yScale;
        const rtl = this.rtl;
        const ticks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
        const hover = this.hoverIndex;
        return svg`
            ${this.showGrid ? ticks.map((g) => svg`<line class="grid" data-slot="grid-line" x1=${a.left} x2=${a.right} y1=${g.y} y2=${g.y} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
            ${ticks.map((g) => svg`<text class="tick" x=${rtl ? a.right + 8 : a.left - 8} y=${g.y + 3} text-anchor=${rtl ? 'start' : 'end'}>${g.value}</text>`)}
            ${this.categories.map((name, i) => svg`<text class="tick" x=${xs.scale(i)} y=${this.height - 10} text-anchor="middle">${name}</text>`)}
            ${this.paths().map(
                (p) => svg`<path data-slot="area-series" d=${p.area} fill=${p.color} fill-opacity=${this.fillOpacity} stroke="none" />
                    <path d=${p.line} fill="none" stroke=${p.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`,
            )}
            ${this.showCrosshair && hover !== null ? svg`<line class="crosshair" data-slot="crosshair" x1=${xs.scale(hover)} x2=${xs.scale(hover)} y1=${a.top} y2=${a.bottom} stroke-width="1" />` : nothing}`;
    }

    private tooltipRows(): ChartTooltipRow[] {
        const i = this.hoverIndex;
        if (i === null) return [];
        return this.visible.map(({ s, i: si }) => ({ label: s.name, value: formatChartValueOrGap(s.data[i]?.value), color: getChartColor(si, s.color) }));
    }

    protected override render() {
        const rows = this.tooltipRows();
        const legend: ChartLegendItem[] = this.series.map((s, i) => ({ key: seriesKey(s), label: s.name, color: getChartColor(i, s.color) }));
        const hover = this.hoverIndex;
        return html`<div part="base" class="base" data-slot="area-chart" role="group" aria-label=${getChartSummary('Area chart', this.categories.length, this.heading)}>
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
                      .visible=${hover !== null && rows.length > 0}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .heading=${hover === null ? undefined : this.categories[hover]}
                      .rows=${rows}
                      .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
                  ></ge-chart-tooltip>`
                : nothing}
            ${this.showLegend ? html`<ge-chart-legend .items=${legend} .hiddenKeys=${this.hiddenKeys} @item-toggle=${this.onToggle}></ge-chart-legend>` : nothing}
        </div>`;
    }
}
