import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, WaterfallBar } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, getChartSummary } from '../shared/chart/chart.utils.js';
import { bandScale, linearScale, niceDomain } from '../shared/chart/chart-scale.js';
import { nearestPointX, pointerToSvg } from '../shared/chart/chart-interaction.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './waterfall-chart.css?inline';

interface Level {
    from: number;
    to: number;
}
interface Placed {
    name: string;
    value: number;
    toLevel: number;
    color: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centreX: number;
}

const PAD_TOP = 12;
const PAD_BOTTOM = 28;
const PAD_AXIS = 44;
const PAD_EDGE = 12;

/**
 * A running total: each bar floats from where the previous one ended, rising for a gain and falling for a loss, and a
 * `total` bar stands from zero at its own value and resets the running level. The tooltip follows the pointer's category.
 * A bar is a button: it takes focus and Enter activates it.
 *
 * @fires bar-click - A bar was activated; `detail` is `{ point: { name, value }, index }`.
 * @attr {boolean} show-connectors - The dashed line from each bar's end to the next bar. On by default.
 * @attr {boolean} show-values - The value above each bar. Off by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered bar. On by default.
 * @attr {string} positive-color - Fill of a gain. Defaults to `hsl(142, 71%, 45%)`.
 * @attr {string} negative-color - Fill of a loss. Defaults to `hsl(0, 84%, 60%)`.
 * @attr {string} total-color - Fill of a total. Defaults to `hsl(221, 83%, 53%)`.
 * @attr {number} bar-radius - Corner radius of a bar in px. Defaults to 2.
 * @prop {WaterfallBar[]} data - One bar per entry: `{ name, value, type?: 'total', color? }`.
 * @csspart base - The chart container.
 */
export class GeWaterfallChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        showConnectors: { converter: defaultTrue, attribute: 'show-connectors' },
        showValues: { type: Boolean, attribute: 'show-values' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        positiveColor: { attribute: 'positive-color' },
        negativeColor: { attribute: 'negative-color' },
        totalColor: { attribute: 'total-color' },
        barRadius: { type: Number, attribute: 'bar-radius' },
        tooltipPos: { state: true },
    };

    declare data: WaterfallBar[];
    declare showConnectors: boolean;
    declare showValues: boolean;
    declare showTooltip: boolean;
    declare positiveColor: string;
    declare negativeColor: string;
    declare totalColor: string;
    declare barRadius: number;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.showConnectors = true;
        this.showValues = false;
        this.showTooltip = true;
        this.positiveColor = 'hsl(142, 71%, 45%)';
        this.negativeColor = 'hsl(0, 84%, 60%)';
        this.totalColor = 'hsl(221, 83%, 53%)';
        this.barRadius = 2;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 520;
        this.height = 320;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'waterfall-chart-host';
    }

    private get levels(): Level[] {
        let running = 0;
        return this.data.map((bar) => {
            if (bar.type === 'total') {
                running = bar.value;
                return { from: 0, to: bar.value };
            }
            const from = running;
            running += bar.value;
            return { from, to: running };
        });
    }

    private colourFor(bar: WaterfallBar): string {
        if (bar.color) return bar.color;
        if (bar.type === 'total') return this.totalColor;
        return bar.value >= 0 ? this.positiveColor : this.negativeColor;
    }

    private get area() {
        return { left: PAD_AXIS, right: this.svgWidth - PAD_EDGE, top: PAD_TOP, bottom: this.height - PAD_BOTTOM };
    }

    private get yScale() {
        const a = this.area;
        const [min, max] = extent(this.levels.flatMap((l) => [l.from, l.to]).concat(0)) ?? [0, 0];
        return linearScale(niceDomain(min, max, 5), [a.bottom, a.top]);
    }

    /** Placed by position rather than name, since two bars may share a label. */
    private get band() {
        const a = this.area;
        return bandScale(this.data.map((...[, i]) => String(i)), this.rtl ? [a.right, a.left] : [a.left, a.right], 0.3, 0.15);
    }

    private placed(): Placed[] {
        const ys = this.yScale;
        const band = this.band;
        const levels = this.levels;
        return this.data.map((bar, i) => {
            const { from, to } = levels[i]!;
            const yFrom = ys.scale(from);
            const yTo = ys.scale(to);
            const x = band.position(String(i)) ?? 0;
            return { name: bar.name, value: bar.value, toLevel: to, color: this.colourFor(bar), x, y: Math.min(yFrom, yTo), width: band.bandwidth, height: Math.max(1, Math.abs(yFrom - yTo)), centreX: x + band.bandwidth / 2 };
        });
    }

    private readonly onPointerMove = (event: MouseEvent | TouchEvent) => {
        const el = this.shadowRoot?.querySelector('svg');
        if (!el) return;
        const local = pointerToSvg(event, el);
        const nearest = nearestPointX(local.x, this.placed().map((b, i) => ({ x: b.centreX, datum: i })));
        if (!nearest) return;
        this.tooltipPos = { x: nearest.point.x + 12, y: Math.max(8, local.y - 8) };
        this.hoverIndex = nearest.index;
    };

    private readonly onPointerLeave = () => (this.hoverIndex = null);

    private activate(index: number): void {
        const d = this.data[index];
        if (d) this.emit<ChartClickEvent>('bar-click', { point: { name: d.name, value: d.value }, index });
    }

    private tooltipRows(bars: Placed[]): ChartTooltipRow[] {
        const bar = this.hoverIndex === null ? undefined : bars[this.hoverIndex];
        if (!bar) return [];
        return [
            { label: 'Change', value: formatChartValue(bar.value), color: bar.color },
            { label: 'Total', value: formatChartValue(bar.toLevel) },
        ];
    }

    private connectors(bars: Placed[]) {
        const ys = this.yScale;
        const levels = this.levels;
        return bars.slice(0, -1).map((bar, i) => {
            const y = ys.scale(levels[i]!.to);
            return svg`<line class="connector" data-slot="waterfall-connector" x1=${bar.x + bar.width} y1=${y} x2=${bars[i + 1]!.x} y2=${y} stroke-width="1" stroke-dasharray="3 2" />`;
        });
    }

    private bar(bar: Placed, i: number) {
        const hover = this.hoverIndex;
        return svg`<rect class="bar" data-slot="waterfall-bar" x=${bar.x} y=${bar.y} width=${bar.width} height=${bar.height} rx=${this.barRadius} fill=${bar.color}
                fill-opacity=${hover === null || hover === i ? 1 : 0.6} tabindex="0" role="button" aria-label=${`${bar.name}: ${bar.value} (total ${bar.toLevel})`}
                @click=${() => this.activate(i)}
                @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this.activate(i)} />
            ${this.showValues ? svg`<text class="value" x=${bar.centreX} y=${bar.y - 4} text-anchor="middle">${bar.value}</text>` : nothing}
            <text class="tick" x=${bar.centreX} y=${this.height - 10} text-anchor="middle">${bar.name}</text>`;
    }

    protected override render() {
        const bars = this.placed();
        const ys = this.yScale;
        const ticks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
        const hover = this.hoverIndex;
        const tooltipHeading = hover === null ? undefined : this.data[hover]?.name;
        return html`<div part="base" class="base" data-slot="waterfall-chart" role="group" aria-label=${getChartSummary('Waterfall chart', this.data.length, this.heading)}>
            <svg
                viewBox=${`0 0 ${this.svgWidth} ${this.height}`}
                width="100%"
                height=${this.height}
                @mousemove=${this.onPointerMove}
                @mouseleave=${this.onPointerLeave}
                @touchstart=${this.onPointerMove}
                @touchmove=${this.onPointerMove}
            >
                ${ticks.map((g) => svg`<line class="grid" x1="0" x2=${this.svgWidth} y1=${g.y} y2=${g.y} stroke-width="1" stroke-dasharray="2 3" />
                    <text class="tick" x="4" y=${g.y - 2}>${g.value}</text>`)}
                ${this.showConnectors ? this.connectors(bars) : nothing} ${bars.map((b, i) => this.bar(b, i))}
            </svg>
            ${this.showTooltip
                ? html`<ge-chart-tooltip
                      .visible=${hover !== null}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .heading=${tooltipHeading}
                      .rows=${this.tooltipRows(bars)}
                      .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
                  ></ge-chart-tooltip>`
                : nothing}
        </div>`;
    }
}
