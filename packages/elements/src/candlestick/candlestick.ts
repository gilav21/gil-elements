import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartSummary } from '../shared/chart/chart.utils.js';
import { bandScale, linearScale, niceDomain, niceTimeTicks, timeScale } from '../shared/chart/chart-scale.js';
import { formatPeriod, isRising, normalizeOhlc, ohlcExtent, toTimestamp } from '../shared/chart/candlestick-utils.js';
import type { CandlestickAxisMode, OhlcPoint } from '../shared/chart/candlestick.types.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './candlestick.css?inline';

export type { CandlestickAxisMode, OhlcPoint } from '../shared/chart/candlestick.types.js';

interface Candle {
    index: number;
    point: OhlcPoint;
    label: string;
    rising: boolean;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centre: number;
    wickTop: number;
    wickBottom: number;
}

interface Slot {
    centre: number;
    width: number;
}

interface AxisTick {
    key: string;
    label: string;
    x: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 52;
const PAD_EDGE = 12;
const BAND_PADDING_INNER = 0.3;
const BAND_PADDING_OUTER = 0.15;
const TIME_SLOT_SHARE = 0.6;
const MIN_CANDLE_WIDTH = 1;
const MAX_CANDLE_WIDTH = 28;
const MIN_BODY_HEIGHT = 1;
const MAX_ORDINAL_TICKS = 8;

/**
 * One candle per OHLC period: a body from open to close, coloured by direction (a close at or above the open is rising),
 * and a wick from the low to the high. Rows whose four prices are not all finite are dropped; the series is not sorted,
 * so pass it in order. The `ordinal` axis gives every period present an equal band, so weekends leave no gap; `time`
 * places candles on a real time scale. A candle is a button: it takes focus, and Enter or Space activates it.
 * RTL reverses the period axis, the newest candle on the left.
 *
 * @fires candle-click - A candle was activated; `detail` is `{ point, index, event }`.
 * @fires candle-hover - A candle was entered or focused (`detail` is `{ point, index }`), or `null` once left.
 * @attr {'ordinal' | 'time'} axis-mode - How periods are placed. Defaults to `ordinal`.
 * @attr {boolean} show-grid - The dashed gridline behind each price tick. On by default.
 * @attr {boolean} show-tooltip - Open, high, low and close over the active candle. On by default.
 * @attr {string} rising-color - Colour of a rising candle. Defaults to `hsl(142, 71%, 45%)`.
 * @attr {string} falling-color - Colour of a falling candle. Defaults to `hsl(0, 84%, 60%)`.
 * @attr {string} unit - Written after every price, as in `$`.
 * @attr {string} locale - BCP-47 locale for date labels. Defaults to `en-US`.
 * @prop {OhlcPoint[]} points - `{ date, open, high, low, close }`; `date` is a Date, epoch ms, an ISO string, or (ordinal only) any label.
 * @csspart base - The chart container.
 */
export class GeCandlestick extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        points: { attribute: false },
        axisMode: { attribute: 'axis-mode', reflect: true },
        showGrid: { converter: defaultTrue, attribute: 'show-grid' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        risingColor: { attribute: 'rising-color' },
        fallingColor: { attribute: 'falling-color' },
        unit: {},
        locale: {},
        tooltipPos: { state: true },
    };

    declare points: OhlcPoint[];
    declare axisMode: CandlestickAxisMode;
    declare showGrid: boolean;
    declare showTooltip: boolean;
    declare risingColor: string;
    declare fallingColor: string;
    declare unit: string;
    declare locale: string;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.points = [];
        this.axisMode = 'ordinal';
        this.showGrid = true;
        this.showTooltip = true;
        this.risingColor = 'hsl(142, 71%, 45%)';
        this.fallingColor = 'hsl(0, 84%, 60%)';
        this.unit = '';
        this.locale = 'en-US';
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'candlestick-host';
    }

    private get timeAxis(): boolean {
        return this.axisMode === 'time';
    }

    /** The periods that survive validation for the active axis. */
    private get usable(): OhlcPoint[] {
        const clean = normalizeOhlc(this.points);
        return this.timeAxis ? clean.filter((p) => Number.isFinite(toTimestamp(p.date))) : clean;
    }

    private get area() {
        const rtl = this.rtl;
        return { left: rtl ? PAD_EDGE : PAD_AXIS, right: this.svgWidth - (rtl ? PAD_AXIS : PAD_EDGE), top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    private price(value: number): string {
        return formatChartValue(value, { decimals: 2 }) + this.unit;
    }

    private ordinalSlots(count: number): Slot[] {
        const a = this.area;
        const keys = Array.from({ length: count }, (...[, i]) => String(i));
        const bands = bandScale(this.rtl ? [...keys].reverse() : keys, [a.left, a.right], BAND_PADDING_INNER, BAND_PADDING_OUTER);
        const bandwidth = Math.abs(bands.bandwidth);
        return keys.map((key) => ({ centre: (bands.position(key) ?? a.left) + bandwidth / 2, width: Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, bandwidth)) }));
    }

    private timeFn(stamps: number[]) {
        const a = this.area;
        const [lo, hi] = extent(stamps) ?? [0, 0];
        return { scale: timeScale([lo, hi === lo ? lo + 1 : hi], this.rtl ? [a.right, a.left] : [a.left, a.right]), lo, hi };
    }

    private candles(points: OhlcPoint[], stamps: number[], prices: ReturnType<typeof linearScale>): Candle[] {
        const a = this.area;
        let slots: Slot[];
        if (this.timeAxis) {
            const { scale } = this.timeFn(stamps);
            const width = Math.max(MIN_CANDLE_WIDTH, Math.min(MAX_CANDLE_WIDTH, (Math.abs(a.right - a.left) / Math.max(1, points.length)) * TIME_SLOT_SHARE));
            slots = stamps.map((ts) => ({ centre: scale.scale(ts), width }));
        } else {
            slots = this.ordinalSlots(points.length);
        }
        return points.map((point, index) => {
            const slot = slots[index] ?? { centre: 0, width: MIN_CANDLE_WIDTH };
            const rising = isRising(point);
            const bodyA = prices.scale(point.open);
            const bodyB = prices.scale(point.close);
            const wickA = prices.scale(point.high);
            const wickB = prices.scale(point.low);
            return {
                index,
                point,
                label: formatPeriod(point.date, this.locale),
                rising,
                color: rising ? this.risingColor : this.fallingColor,
                x: slot.centre - slot.width / 2,
                y: Math.min(bodyA, bodyB),
                width: slot.width,
                height: Math.max(MIN_BODY_HEIGHT, Math.abs(bodyB - bodyA)),
                centre: slot.centre,
                wickTop: Math.min(wickA, wickB),
                wickBottom: Math.max(wickA, wickB),
            };
        });
    }

    private axisTicks(candles: Candle[], stamps: number[]): AxisTick[] {
        if (this.timeAxis) {
            const { scale, lo, hi } = this.timeFn(stamps);
            return niceTimeTicks(lo, hi, 5).map((t) => ({ key: String(t), label: formatPeriod(t, this.locale), x: scale.scale(t) }));
        }
        const stride = Math.max(1, Math.ceil(candles.length / MAX_ORDINAL_TICKS));
        return candles.filter((...[, i]) => i % stride === 0).map((c) => ({ key: String(c.index), label: c.label, x: c.centre }));
    }

    private readonly enter = (candle: Candle) => {
        this.hoverIndex = candle.index;
        this.tooltipPos = { x: candle.centre + 8, y: Math.max(8, candle.wickTop - 8) };
        this.emit<ChartClickEvent<OhlcPoint>>('candle-hover', { point: candle.point, index: candle.index });
    };

    private readonly leave = () => {
        this.hoverIndex = null;
        this.emit('candle-hover', null);
    };

    private activate(event: Event, candle: Candle): void {
        this.emit<ChartClickEvent<OhlcPoint>>('candle-click', { point: candle.point, index: candle.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onKey(event: KeyboardEvent, candle: Candle): void {
        if (event.key === 'Enter' || event.key === ' ') this.activate(event, candle);
    }

    private candle(candle: Candle) {
        const hover = this.hoverIndex;
        const p = candle.point;
        return svg`<g class=${`candle${hover !== null && hover !== candle.index ? ' dim' : ''}`} data-slot="candlestick-candle" data-direction=${candle.rising ? 'rising' : 'falling'} tabindex="0" role="button"
            aria-label=${`${candle.label}: open ${this.price(p.open)}, high ${this.price(p.high)}, low ${this.price(p.low)}, close ${this.price(p.close)}`}
            @mouseenter=${() => this.enter(candle)} @touchstart=${() => this.enter(candle)} @mouseleave=${this.leave} @focus=${() => this.enter(candle)} @blur=${this.leave}
            @click=${(event: MouseEvent) => this.activate(event, candle)} @keydown=${(event: KeyboardEvent) => this.onKey(event, candle)}>
            <line data-slot="candlestick-wick" x1=${candle.centre} x2=${candle.centre} y1=${candle.wickTop} y2=${candle.wickBottom} stroke=${candle.color} stroke-width="1" />
            <rect class=${hover === candle.index ? 'hot' : ''} data-slot="candlestick-body" x=${candle.x} y=${candle.y} width=${candle.width} height=${candle.height} fill=${candle.color} stroke=${candle.color} stroke-width="1" />
        </g>`;
    }

    private tooltip(candles: Candle[]) {
        const hover = this.hoverIndex;
        const candle = hover === null ? undefined : candles[hover];
        const p = candle?.point;
        const rows: ChartTooltipRow[] = candle && p
            ? [
                  { label: 'Open', value: this.price(p.open), color: candle.color },
                  { label: 'High', value: this.price(p.high) },
                  { label: 'Low', value: this.price(p.low) },
                  { label: 'Close', value: this.price(p.close) },
              ]
            : [];
        return html`<ge-chart-tooltip
            .visible=${hover !== null}
            .x=${this.tooltipPos.x}
            .y=${this.tooltipPos.y}
            .heading=${candle?.label}
            .rows=${rows}
            .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
        ></ge-chart-tooltip>`;
    }

    protected override render() {
        const points = this.usable;
        const label = getChartSummary('Candlestick chart', points.length, this.heading);
        if (points.length === 0) {
            return html`<div part="base" class="base" data-slot="candlestick" role="group" aria-label=${label}>
                <div class="empty" data-slot="candlestick-empty" style=${`min-height:${this.height}px`}>No data to display</div>
            </div>`;
        }
        const a = this.area;
        const rtl = this.rtl;
        const stamps = points.map((p) => toTimestamp(p.date));
        const prices = linearScale(niceDomain(...(ohlcExtent(points) ?? ([0, 1] as [number, number])), 5), [a.bottom, a.top]);
        const candles = this.candles(points, stamps, prices);
        const ticks = prices.ticks(5).map((value) => ({ value, y: prices.scale(value) }));
        return html`<div part="base" class="base" data-slot="candlestick" role="group" aria-label=${label}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${this.height}`} width="100%" height=${this.height}>
                ${this.showGrid ? ticks.map((t) => svg`<line class="grid" data-slot="grid-line" x1=${a.left} x2=${a.right} y1=${t.y} y2=${t.y} stroke-width="1" stroke-dasharray="2 3" />`) : nothing}
                ${ticks.map((t) => svg`<text class="tick" x=${rtl ? a.right + 8 : a.left - 8} y=${t.y + 3} text-anchor=${rtl ? 'start' : 'end'}>${this.price(t.value)}</text>`)}
                ${this.axisTicks(candles, stamps).map((t) => svg`<text class="tick" x=${t.x} y=${this.height - 10} text-anchor="middle">${t.label}</text>`)}
                ${candles.map((c) => this.candle(c))}
            </svg>
            ${this.showTooltip ? this.tooltip(candles) : nothing}
        </div>`;
    }
}
