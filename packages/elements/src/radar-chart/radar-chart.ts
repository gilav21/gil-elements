import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartSeries } from '../shared/chart/chart.types.js';
import { extent, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { polygonPath, radarPoint } from '../shared/chart/chart-polar.js';
import type { ChartLegendItem } from '../chart-legend/index.js';
import css from './radar-chart.css?inline';

interface Vertex {
    x: number;
    y: number;
    axis: string;
    value: number;
}
interface Polygon {
    name: string;
    color: string;
    path: string;
    vertices: Vertex[];
}

const UNIT_SCALE: readonly [number, number] = [0, 1];
const LABEL_ROOM = 36;
const LABEL_OFFSET = 18;

const seriesKey = (s: ChartSeries): string => s.id ?? s.name;

/**
 * One filled polygon per series on shared radial axes. The axes come from the first series, and every series is matched to
 * them by position. The centre is zero (or the lowest value, when any is negative) and the outer ring is `max-value`;
 * a value beyond either end sits on it. Hidden series still count towards the scale, so the rings do not move.
 *
 * @attr {number} size - Edge of the square chart in px; it does not scale with its container. Defaults to 320.
 * @attr {number} levels - Number of background rings. Defaults to 4.
 * @attr {number} max-value - The value that reaches the outer ring. Defaults to the largest value across all series.
 * @attr {number} fill-opacity - Opacity of each polygon's fill, 0 to 1. Defaults to 0.2.
 * @attr {boolean} show-legend - The legend below the chart. On by default.
 * @prop {ChartSeries[]} series - One polygon per entry; `id` (else `name`) keys the legend.
 * @csspart base - The chart container.
 */
export class GeRadarChart extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        series: { attribute: false },
        size: { type: Number },
        levels: { type: Number },
        maxValue: { type: Number, attribute: 'max-value' },
        fillOpacity: { type: Number, attribute: 'fill-opacity' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
    };

    declare series: ChartSeries[];
    declare size: number;
    declare levels: number;
    declare maxValue: number | undefined;
    declare fillOpacity: number;
    declare showLegend: boolean;

    constructor() {
        super();
        this.series = [];
        this.size = 320;
        this.levels = 4;
        this.maxValue = undefined;
        this.fillOpacity = 0.2;
        this.showLegend = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'radar-chart-host';
    }

    /** The axis names, taken from the first series. */
    get axes(): string[] {
        return this.series[0]?.data.map((d) => d.name) ?? [];
    }

    private get centre(): number {
        return this.size / 2;
    }

    private get radius(): number {
        return this.size / 2 - LABEL_ROOM;
    }

    private get bounds(): [number, number] {
        const range = extent(this.series.flatMap((s) => s.data.map((d) => d.value)));
        return [Math.min(0, range?.[0] ?? 0), this.maxValue ?? range?.[1] ?? 1];
    }

    private at(radius: number, axis: number, count: number, value = 1, scale: readonly [number, number] = UNIT_SCALE) {
        return radarPoint(this.centre, this.centre, radius, axis, count, value, scale);
    }

    private rings(): string[] {
        const count = this.axes.length;
        return Array.from({ length: this.levels }, (...[, index]) => {
            const r = (this.radius * (index + 1)) / this.levels;
            return this.axes.map((...[, i]) => this.at(r, i, count)).map((p) => `${p.x},${p.y}`).join(' ');
        });
    }

    private polygons(): Polygon[] {
        const count = this.axes.length;
        const bounds = this.bounds;
        return this.series
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => !this.hiddenKeys.includes(seriesKey(s)))
            .map(({ s, i }) => {
                const vertices = s.data.map((d, ai): Vertex => ({ ...this.at(this.radius, ai, count, d.value, bounds), axis: d.name, value: d.value }));
                return { name: s.name, color: getChartColor(i, s.color), path: polygonPath(vertices), vertices };
            });
    }

    private readonly onToggle = (event: Event) => {
        event.stopPropagation();
        this.toggleSeries((event as CustomEvent<string>).detail);
    };

    private frame() {
        const count = this.axes.length;
        const c = this.centre;
        return svg`${this.rings().map((points) => svg`<polygon class="ring" data-slot="radar-ring" points=${points} fill="none" stroke-width="1" />`)}
            ${this.axes.map((axis, i) => {
                const outer = this.at(this.radius, i, count);
                const label = this.at(this.radius + LABEL_OFFSET, i, count);
                return svg`<line class="ring" x1=${c} y1=${c} x2=${outer.x} y2=${outer.y} stroke-width="1" />
                    <text class="axis" x=${label.x} y=${label.y} text-anchor="middle" dominant-baseline="middle">${axis}</text>`;
            })}`;
    }

    private polygon(poly: Polygon) {
        return svg`<path data-slot="radar-series" d=${poly.path} fill=${poly.color} fill-opacity=${this.fillOpacity} stroke=${poly.color} stroke-width="2" stroke-linejoin="round" />
            ${poly.vertices.map((v) => svg`<circle cx=${v.x} cy=${v.y} r="3" fill=${poly.color} tabindex="0" role="button" aria-label=${`${poly.name}, ${v.axis}: ${v.value}`} />`)}`;
    }

    protected override render() {
        const legend: ChartLegendItem[] = this.series.map((s, i) => ({ key: seriesKey(s), label: s.name, color: getChartColor(i, s.color) }));
        return html`<div part="base" class="base" data-slot="radar-chart" role="group" aria-label=${getChartSummary('Radar chart', this.axes.length, this.heading)}>
            <svg viewBox=${`0 0 ${this.size} ${this.size}`} width=${this.size} height=${this.size}>
                ${this.frame()} ${this.polygons().map((p) => this.polygon(p))}
            </svg>
            ${this.showLegend ? html`<ge-chart-legend .items=${legend} .hiddenKeys=${this.hiddenKeys} @item-toggle=${this.onToggle}></ge-chart-legend>` : nothing}
        </div>`;
    }
}
