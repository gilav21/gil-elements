import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import type { CalendarDay } from '../shared/chart/chart.types.js';
import { extent, formatChartValue } from '../shared/chart/chart.utils.js';
import { sequentialColorScale } from '../shared/chart/chart-color-scale.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './calendar-heatmap.css?inline';

interface Placed {
    x: number;
    y: number;
    day: CalendarDay;
    color: string;
}

const DAY_MS = 86_400_000;
const LEFT_PAD = 26;
const TOP_PAD = 16;
const GAP = 3;
const LEGEND_STEPS = 5;

const parseYmd = (date: string): number => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
};

const weekdayOf = (ms: number): number => new Date(ms).getUTCDay();

/**
 * A year-at-a-glance grid of days: a column per week (Sunday first), a row per weekday, coloured by value. Only the days in
 * `data` are drawn, so a day without an entry is a gap; give it a zero to paint it. A day is a button: it takes focus, and
 * focus reads it out like hover does.
 *
 * @fires day-hover - The day entered or focused (`detail` is the entry), or `null` once left.
 * @attr {number} cell-size - Edge of a day in px. Defaults to 13.
 * @attr {string} from-color - The colour of the lowest value. Defaults to `hsl(214, 95%, 92%)`.
 * @attr {string} to-color - The colour of the highest value. Defaults to `hsl(221, 83%, 38%)`.
 * @attr {boolean} show-legend - The Less to More swatches below. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered day. On by default.
 * @attr {string} heading - A name for the chart, put before its accessible summary.
 * @prop {CalendarDay[]} data - `{ date: 'YYYY-MM-DD', value }` per day.
 * @csspart base - The chart container.
 */
export class GeCalendarHeatmap extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        data: { attribute: false },
        cellSize: { type: Number, attribute: 'cell-size' },
        fromColor: { attribute: 'from-color' },
        toColor: { attribute: 'to-color' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        heading: {},
        hovered: { state: true },
        tooltipPos: { state: true },
    };

    declare data: CalendarDay[];
    declare cellSize: number;
    declare fromColor: string;
    declare toColor: string;
    declare showLegend: boolean;
    declare showTooltip: boolean;
    declare heading: string | undefined;
    declare hovered: CalendarDay | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.cellSize = 13;
        this.fromColor = 'hsl(214, 95%, 92%)';
        this.toColor = 'hsl(221, 83%, 38%)';
        this.showLegend = true;
        this.showTooltip = true;
        this.hovered = null;
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'calendar-heatmap-host';
    }

    /** The Sunday that starts the first column: the week of the earliest day. */
    private get origin(): number {
        const first = extent(this.data.map((d) => parseYmd(d.date)))?.[0];
        return first === undefined ? 0 : first - weekdayOf(first) * DAY_MS;
    }

    private get domain(): [number, number] {
        return extent(this.data.map((d) => d.value)) ?? [0, 1];
    }

    private colorFor(value: number): string {
        return sequentialColorScale(this.domain, [this.fromColor, this.toColor])(value);
    }

    private placed(): Placed[] {
        const origin = this.origin;
        const step = this.cellSize + GAP;
        return this.data.map((day) => {
            const ms = parseYmd(day.date);
            return { x: LEFT_PAD + Math.floor((ms - origin) / (7 * DAY_MS)) * step, y: TOP_PAD + weekdayOf(ms) * step, day, color: this.colorFor(day.value) };
        });
    }

    private setHover(day: CalendarDay | null, x = 0, y = 0): void {
        this.hovered = day;
        this.tooltipPos = { x, y };
        this.emit(day);
    }

    private emit(day: CalendarDay | null): void {
        this.dispatchEvent(new CustomEvent<CalendarDay | null>('day-hover', { detail: day, bubbles: true, composed: true }));
    }

    private tooltipRows(): ChartTooltipRow[] {
        const d = this.hovered;
        return d ? [{ label: 'Count', value: formatChartValue(d.value), color: this.colorFor(d.value) }] : [];
    }

    private legend() {
        const [min, max] = this.domain;
        return html`<div class="legend" data-slot="calendar-heatmap-legend"><span>Less</span>${Array.from({ length: LEGEND_STEPS }, (...[, i]) => {
            const color = this.colorFor(min + ((max - min) * i) / (LEGEND_STEPS - 1));
            return html`<span class="swatch" style=${`background:${color}`}></span>`;
        })}<span>More</span></div>`;
    }

    private day(p: Placed) {
        const enter = () => this.setHover(p.day, p.x + this.cellSize, p.y - 8);
        return svg`<rect class="day" data-slot="calendar-day" x=${p.x} y=${p.y} width=${this.cellSize} height=${this.cellSize} rx="2" fill=${p.color}
            tabindex="0" role="button" aria-label=${`${p.day.date}: ${p.day.value}`}
            @mouseenter=${enter} @mouseleave=${() => this.setHover(null)} @focus=${enter} @blur=${() => this.setHover(null)} />`;
    }

    protected override render() {
        const placed = this.placed();
        const step = this.cellSize + GAP;
        const right = extent(placed.map((p) => p.x))?.[1];
        const weeks = right === undefined ? 0 : (right - LEFT_PAD) / step + 1;
        const usedWidth = LEFT_PAD + weeks * step;
        const height = TOP_PAD + 7 * step;
        const hovered = this.hovered;
        return html`<div part="base" class="base" data-slot="calendar-heatmap" role="group" aria-label=${`${this.heading ? `${this.heading}. ` : ''}Calendar heatmap with ${this.data.length} days.`}>
            <svg viewBox=${`0 0 ${usedWidth} ${height}`} width=${usedWidth} height=${height}>
                ${[['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([label, row]) => svg`<text class="weekday" x="0" y=${TOP_PAD + (row as number) * step + this.cellSize / 2}>${label}</text>`)}
                ${placed.map((p) => this.day(p))}
            </svg>
            ${this.showLegend ? this.legend() : nothing}
            ${this.showTooltip
                ? html`<ge-chart-tooltip .visible=${hovered !== null} .x=${this.tooltipPos.x} .y=${this.tooltipPos.y} .heading=${hovered?.date} .rows=${this.tooltipRows()}></ge-chart-tooltip>`
                : nothing}
        </div>`;
    }
}
