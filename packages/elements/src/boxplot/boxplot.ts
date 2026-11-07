import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, ChartOrientation } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { bandScale, linearScale, niceDomain } from '../shared/chart/chart-scale.js';
import { resolveGroupStats } from '../shared/chart/boxplot-stats.js';
import type { BoxplotGroup, BoxplotStats } from '../shared/chart/boxplot.types.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './boxplot.css?inline';

export type { BoxplotGroup, BoxplotStats } from '../shared/chart/boxplot.types.js';

interface Line {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface Box {
    index: number;
    group: BoxplotGroup;
    stats: BoxplotStats;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    median: Line;
    whisker: Line;
    minCap: Line;
    maxCap: Line;
    labelX: number;
    labelY: number;
    labelAnchor: 'middle' | 'start' | 'end';
    outliers: { value: number; cx: number; cy: number }[];
}

interface Tick {
    value: number;
    line: Line;
    labelX: number;
    labelY: number;
    anchor: 'start' | 'end' | 'middle';
}

interface Resolved {
    group: BoxplotGroup;
    stats: BoxplotStats;
    sourceIndex: number;
}

type Area = { left: number; right: number; top: number; bottom: number };

const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_AXIS = 48;
const PAD_EDGE = 16;
const BAND_PADDING_INNER = 0.4;
const BAND_PADDING_OUTER = 0.2;
const CAP_FRACTION = 0.5;
const MIN_EXTENT = 1;

/**
 * The spread of one or more samples: a box from the first to the third quartile with a line at the median, whiskers to
 * the furthest samples inside 1.5 x IQR of the box, and each sample beyond them as a ring. Give each group either raw
 * `values` (summarised here, quartiles by linear interpolation) or a pre-computed `stats`, which wins. A group with
 * neither is skipped. A box, and each outlier ring, is a button: it takes focus, and Enter or Space activates it.
 *
 * @fires group-click - A box or outlier was activated; `detail` is `{ point: group, index, event }`.
 * @fires group-hover - A box was entered or focused (`detail` is `{ point: group, index }`), or `null` once left.
 * @attr {'vertical' | 'horizontal'} orientation - Whether the categories run across (default) or down the chart.
 * @attr {boolean} show-grid - The dashed gridline behind each value tick. On by default.
 * @attr {boolean} show-outliers - The samples beyond the whiskers. On by default.
 * @attr {boolean} show-tooltip - The five-number summary over the active box. On by default.
 * @attr {number} box-radius - Corner radius in px. Defaults to 2.
 * @attr {string} unit - Written after every number, as in `ms`.
 * @prop {BoxplotGroup[]} groups - `{ label, values?, stats?, color? }` per box, in order.
 * @csspart base - The chart container.
 */
export class GeBoxplot extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        groups: { attribute: false },
        orientation: { reflect: true },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showOutliers: { converter: defaultTrue, attribute: 'show-outliers' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        boxRadius: { type: Number, attribute: 'box-radius' },
        unit: {},
        tooltipPos: { state: true },
    };

    declare groups: BoxplotGroup[];
    declare orientation: ChartOrientation;
    declare showGrid: boolean;
    declare showOutliers: boolean;
    declare showTooltip: boolean;
    declare boxRadius: number;
    declare unit: string;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.groups = [];
        this.orientation = 'vertical';
        this.showGrid = true;
        this.showOutliers = true;
        this.showTooltip = true;
        this.boxRadius = 2;
        this.unit = '';
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'boxplot-host';
    }

    private get vertical(): boolean {
        return this.orientation === 'vertical';
    }

    private resolved(): Resolved[] {
        return this.groups.flatMap((group, sourceIndex) => {
            const stats = resolveGroupStats(group);
            return stats ? [{ group, stats, sourceIndex }] : [];
        });
    }

    private get area(): Area {
        const rtl = this.rtl;
        const axisLeft = this.vertical ? PAD_AXIS : PAD_AXIS + 24;
        return { left: rtl ? PAD_EDGE : axisLeft, right: this.svgWidth - (rtl ? axisLeft : PAD_EDGE), top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    /** Formats a summary value or an axis tick, keeping up to two decimals, then the unit. */
    private fmt(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit;
    }

    private tick(value: number, at: number, a: Area): Tick {
        if (this.vertical) {
            const rtl = this.rtl;
            return { value, line: { x1: a.left, x2: a.right, y1: at, y2: at }, labelX: rtl ? a.right + 8 : a.left - 8, labelY: at + 3, anchor: rtl ? 'start' : 'end' };
        }
        return { value, line: { x1: at, x2: at, y1: a.top, y2: a.bottom }, labelX: at, labelY: a.bottom + 14, anchor: 'middle' };
    }

    private layout(items: Resolved[]) {
        const a = this.area;
        const rtl = this.rtl;
        const vertical = this.vertical;
        const all = items.flatMap(({ stats }) => [stats.min, stats.max, stats.q1, stats.q3, ...stats.outliers]);
        const range = extent(all);
        const domain = range ? niceDomain(range[0], range[1], 5) : ([0, 1] as [number, number]);
        const values = linearScale(domain, vertical ? [a.bottom, a.top] : rtl ? [a.right, a.left] : [a.left, a.right]);
        const keys = items.map((...[, i]) => String(i));
        const bands = bandScale(vertical && rtl ? [...keys].reverse() : keys, vertical ? [a.left, a.right] : [a.top, a.bottom], BAND_PADDING_INNER, BAND_PADDING_OUTER);
        const band = Math.abs(bands.bandwidth);
        const ticks = values.ticks(5).map((value) => this.tick(value, values.scale(value), a));
        const boxes = items.map((item, i) => this.box(item, i, bands.position(String(i)) ?? 0, band, values.scale, a));
        return { ticks, boxes };
    }

    private box({ group, stats, sourceIndex }: Resolved, index: number, start: number, band: number, scale: (v: number) => number, a: Area): Box {
        const [q1, q3, median, min, max] = [stats.q1, stats.q3, stats.median, stats.min, stats.max].map(scale) as [number, number, number, number, number];
        const centre = start + band / 2;
        const capHalf = (band * CAP_FRACTION) / 2;
        const color = getChartColor(sourceIndex, group.color);
        if (this.vertical) {
            return {
                index, group, stats, color,
                x: start, y: Math.min(q1, q3), width: band, height: Math.max(MIN_EXTENT, Math.abs(q1 - q3)),
                median: { x1: start, x2: start + band, y1: median, y2: median },
                whisker: { x1: centre, x2: centre, y1: Math.min(min, max), y2: Math.max(min, max) },
                minCap: { x1: centre - capHalf, x2: centre + capHalf, y1: min, y2: min },
                maxCap: { x1: centre - capHalf, x2: centre + capHalf, y1: max, y2: max },
                labelX: centre, labelY: this.height - 10, labelAnchor: 'middle',
                outliers: stats.outliers.map((value) => ({ value, cx: centre, cy: scale(value) })),
            };
        }
        const rtl = this.rtl;
        return {
            index, group, stats, color,
            x: Math.min(q1, q3), y: start, width: Math.max(MIN_EXTENT, Math.abs(q3 - q1)), height: band,
            median: { x1: median, x2: median, y1: start, y2: start + band },
            whisker: { x1: Math.min(min, max), x2: Math.max(min, max), y1: centre, y2: centre },
            minCap: { x1: min, x2: min, y1: centre - capHalf, y2: centre + capHalf },
            maxCap: { x1: max, x2: max, y1: centre - capHalf, y2: centre + capHalf },
            labelX: rtl ? a.right + 8 : a.left - 8, labelY: centre + 3, labelAnchor: rtl ? 'start' : 'end',
            outliers: stats.outliers.map((value) => ({ value, cx: scale(value), cy: centre })),
        };
    }

    private readonly enter = (box: Box) => {
        this.hoverIndex = box.index;
        this.tooltipPos = { x: box.x + box.width / 2 + 8, y: Math.max(8, box.y - 8) };
        this.emit<ChartClickEvent<BoxplotGroup>>('group-hover', { point: box.group, index: box.index });
    };

    private readonly leave = () => {
        this.hoverIndex = null;
        this.emit('group-hover', null);
    };

    private activate(event: Event, box: Box): void {
        this.emit<ChartClickEvent<BoxplotGroup>>('group-click', { point: box.group, index: box.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onKey(event: KeyboardEvent, box: Box): void {
        if (event.key === 'Enter' || event.key === ' ') this.activate(event, box);
    }

    private boxLabel(box: Box): string {
        const s = box.stats;
        return `${box.group.label}: median ${this.fmt(s.median)}, Q1 ${this.fmt(s.q1)}, Q3 ${this.fmt(s.q3)}, min ${this.fmt(s.min)}, max ${this.fmt(s.max)}`;
    }

    private handlers(box: Box) {
        return {
            enter: () => this.enter(box),
            click: (event: MouseEvent) => this.activate(event, box),
            key: (event: KeyboardEvent) => this.onKey(event, box),
        };
    }

    private drawBox(box: Box) {
        const hover = this.hoverIndex;
        const on = this.handlers(box);
        const line = (slot: string, l: Line, width: number) => svg`<line data-slot=${slot} x1=${l.x1} x2=${l.x2} y1=${l.y1} y2=${l.y2} stroke=${box.color} stroke-width=${width} />`;
        return svg`<g class=${`box${hover !== null && hover !== box.index ? ' dim' : ''}`} data-slot="boxplot-box" tabindex="0" role="button" aria-label=${this.boxLabel(box)}
            @mouseenter=${on.enter} @touchstart=${on.enter} @mouseleave=${this.leave} @focus=${on.enter} @blur=${this.leave} @click=${on.click} @keydown=${on.key}>
            ${line('boxplot-whisker', box.whisker, 1.5)}${line('boxplot-whisker-cap', box.minCap, 1.5)}${line('boxplot-whisker-cap', box.maxCap, 1.5)}
            <rect class=${hover === box.index ? 'hot' : ''} x=${box.x} y=${box.y} width=${box.width} height=${box.height} rx=${this.boxRadius} fill=${box.color} fill-opacity="0.35" stroke=${box.color} stroke-width="1.5" />
            ${line('boxplot-median', box.median, 2.5)}
        </g>
        ${this.showOutliers
            ? box.outliers.map(
                  (point) => svg`<circle class="outlier" data-slot="boxplot-outlier" cx=${point.cx} cy=${point.cy} r="3" fill="none" stroke=${box.color} stroke-width="1.5" tabindex="0" role="button" aria-label=${`${box.group.label}: outlier ${this.fmt(point.value)}`}
                      @mouseenter=${on.enter} @touchstart=${on.enter} @mouseleave=${this.leave} @focus=${on.enter} @blur=${this.leave} @click=${on.click} @keydown=${on.key} />`,
              )
            : nothing}`;
    }

    private tooltip(boxes: Box[]) {
        const hover = this.hoverIndex;
        const box = hover === null ? undefined : boxes[hover];
        const s = box?.stats;
        const rows: ChartTooltipRow[] = box && s
            ? [
                  { label: 'Max', value: this.fmt(s.max), color: box.color },
                  { label: 'Q3', value: this.fmt(s.q3) },
                  { label: 'Median', value: this.fmt(s.median) },
                  { label: 'Q1', value: this.fmt(s.q1) },
                  { label: 'Min', value: this.fmt(s.min) },
              ]
            : [];
        return html`<ge-chart-tooltip
            .visible=${hover !== null}
            .x=${this.tooltipPos.x}
            .y=${this.tooltipPos.y}
            .heading=${box?.group.label}
            .rows=${rows}
            .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
        ></ge-chart-tooltip>`;
    }

    protected override render() {
        const items = this.resolved();
        const label = getChartSummary('Box plot', items.length, this.heading);
        if (items.length === 0) {
            return html`<div part="base" class="base" data-slot="boxplot" role="group" aria-label=${label}>
                <div class="empty" data-slot="boxplot-empty" style=${`min-height:${this.height}px`}>No data to display</div>
            </div>`;
        }
        const { ticks, boxes } = this.layout(items);
        return html`<div part="base" class="base" data-slot="boxplot" role="group" aria-label=${label}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${this.height}`} width="100%" height=${this.height}>
                ${this.showGrid ? ticks.map((t) => svg`<line class="grid" data-slot="grid-line" x1=${t.line.x1} x2=${t.line.x2} y1=${t.line.y1} y2=${t.line.y2} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
                ${ticks.map((t) => svg`<text class="tick" x=${t.labelX} y=${t.labelY} text-anchor=${t.anchor}>${this.fmt(t.value)}</text>`)}
                ${boxes.map((b) => svg`<text class="tick" x=${b.labelX} y=${b.labelY} text-anchor=${b.labelAnchor}>${b.group.label}</text>`)}
                ${boxes.map((b) => this.drawBox(b))}
            </svg>
            ${this.showTooltip ? this.tooltip(boxes) : nothing}
        </div>`;
    }
}
