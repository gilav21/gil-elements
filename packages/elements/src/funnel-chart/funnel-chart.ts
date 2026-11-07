import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent, ChartDataPoint } from '../shared/chart/chart.types.js';
import { extent, formatChartValue, formatPercentage, getChartColor, getChartSummary, positiveOrZero } from '../shared/chart/chart.utils.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './funnel-chart.css?inline';

type PercentageMode = 'first' | 'previous';

interface Stage {
    index: number;
    name: string;
    value: number;
    percent: number;
    color: string;
    points: string;
    topWidth: number;
    centreX: number;
    midY: number;
}

const PAD = 8;

/**
 * Stacked trapezoids whose widths follow the values, widest at the top, for stages that narrow. Each stage narrows towards
 * the next one; the last stays as wide as itself. A stage is a button: it takes focus, and Enter activates it.
 *
 * @fires stage-click - A stage was activated; `detail` is `{ point, index }`.
 * @attr {string} percentage-mode - What a stage's share is measured against: `first` (default) or `previous`.
 * @attr {number} gap - Gap between stages in px. Defaults to 2.
 * @attr {boolean} show-values - The name and share written on each stage. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered stage. On by default.
 * @prop {ChartDataPoint[]} data - One stage per entry, in order from the top; `color` overrides the palette colour.
 * @csspart base - The chart container.
 */
export class GeFunnelChart extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        percentageMode: { attribute: 'percentage-mode' },
        gap: { type: Number },
        showValues: { converter: defaultTrue, attribute: 'show-values' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        tooltipPos: { state: true },
    };

    declare data: ChartDataPoint[];
    declare percentageMode: PercentageMode;
    declare gap: number;
    declare showValues: boolean;
    declare showTooltip: boolean;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.percentageMode = 'first';
        this.gap = 2;
        this.showValues = true;
        this.showTooltip = true;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 440;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'funnel-chart-host';
    }

    private get maxValue(): number {
        return extent(this.data.map((d) => positiveOrZero(d.value)))?.[1] ?? 0;
    }

    private percentFor(index: number): number {
        if (index === 0) return 100;
        const reference = positiveOrZero((this.percentageMode === 'first' ? this.data[0]! : this.data[index - 1]!).value);
        return reference === 0 ? 0 : (positiveOrZero(this.data[index]!.value) / reference) * 100;
    }

    private widthShare(value: number): number {
        const max = this.maxValue;
        return max === 0 ? 0 : positiveOrZero(value) / max;
    }

    private stages(): Stage[] {
        const n = this.data.length;
        if (n === 0) return [];
        const innerWidth = this.svgWidth - PAD * 2;
        const centreX = this.svgWidth / 2;
        const stageHeight = (this.height - PAD * 2 - this.gap * (n - 1)) / n;
        return this.data.map((d, i) => {
            const topWidth = this.widthShare(d.value) * innerWidth;
            const bottomWidth = this.widthShare(i < n - 1 ? this.data[i + 1]!.value : d.value) * innerWidth;
            const yTop = PAD + i * (stageHeight + this.gap);
            const yBottom = yTop + stageHeight;
            const points = [`${centreX - topWidth / 2},${yTop}`, `${centreX + topWidth / 2},${yTop}`, `${centreX + bottomWidth / 2},${yBottom}`, `${centreX - bottomWidth / 2},${yBottom}`].join(' ');
            return { index: i, name: d.name, value: d.value, percent: this.percentFor(i), color: getChartColor(i, d.color), points, topWidth, centreX, midY: yTop + stageHeight / 2 };
        });
    }

    private enter(stage: Stage): void {
        this.tooltipPos = { x: stage.centreX, y: Math.max(8, stage.midY - 8) };
        this.hoverIndex = stage.index;
    }

    private leave(): void {
        this.hoverIndex = null;
    }

    private activate(index: number): void {
        const point = this.data[index];
        if (point) this.emit<ChartClickEvent>('stage-click', { point, index });
    }

    private tooltipRows(): ChartTooltipRow[] {
        const i = this.hoverIndex;
        const d = i === null ? undefined : this.data[i];
        if (i === null || !d) return [];
        return [
            { label: 'Value', value: formatChartValue(d.value), color: getChartColor(i, d.color) },
            { label: 'Share', value: formatPercentage(this.percentFor(i)) },
        ];
    }

    private stage(stage: Stage) {
        const hover = this.hoverIndex;
        return svg`<polygon class="stage" data-slot="funnel-stage" points=${stage.points} fill=${stage.color} fill-opacity=${hover === null || hover === stage.index ? 0.9 : 0.55}
                tabindex="0" role="button" aria-label=${`${stage.name}: ${stage.value} (${formatPercentage(stage.percent)})`}
                @mouseenter=${() => this.enter(stage)}
                @mouseleave=${() => this.leave()}
                @focus=${() => this.enter(stage)}
                @blur=${() => this.leave()}
                @click=${() => this.activate(stage.index)}
                @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && this.activate(stage.index)} />
            ${this.showValues && stage.topWidth > 0
                ? svg`<text class="caption" x=${stage.centreX} y=${stage.midY} text-anchor="middle" dominant-baseline="middle">${`${stage.name} · ${formatPercentage(stage.percent)}`}</text>`
                : nothing}`;
    }

    protected override render() {
        const rows = this.tooltipRows();
        const hover = this.hoverIndex;
        return html`<div part="base" class="base" data-slot="funnel-chart" role="group" aria-label=${getChartSummary('Funnel chart', this.data.length, this.heading)}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${this.height}`} width="100%" height=${this.height}>${this.stages().map((s) => this.stage(s))}</svg>
            ${this.showTooltip
                ? html`<ge-chart-tooltip
                      .visible=${hover !== null}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .heading=${hover === null ? undefined : this.data[hover]?.name}
                      .rows=${rows}
                  ></ge-chart-tooltip>`
                : nothing}
        </div>`;
    }
}
