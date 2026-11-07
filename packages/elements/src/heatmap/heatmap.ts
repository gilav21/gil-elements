import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { HeatmapCell } from '../shared/chart/chart.types.js';
import { extent, formatChartValue } from '../shared/chart/chart.utils.js';
import { sequentialColorScale } from '../shared/chart/chart-color-scale.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './heatmap.css?inline';

interface Placed {
    x: number;
    y: number;
    size: number;
    color: string;
    cell: HeatmapCell;
}

const ROW_LABEL_W = 48;
const COL_LABEL_H = 22;
const GAP = 2;
const LEGEND_STEPS = 5;

/**
 * A grid of cells coloured by value on a sequential scale, one row and column per distinct label in the order they first
 * appear. Cells shrink to fit the width, between `min-cell-size` and `max-cell-size`. A cell is a button: it takes focus,
 * and focus reads it out like hover does.
 *
 * @fires cell-hover - The cell entered or focused (`detail` is the cell), or `null` once left.
 * @attr {number} max-cell-size - Largest cell edge in px. Defaults to 52.
 * @attr {number} min-cell-size - Smallest cell edge in px. Defaults to 18.
 * @attr {string} from-color - The colour of the lowest value. Defaults to `hsl(214, 95%, 93%)`.
 * @attr {string} to-color - The colour of the highest value. Defaults to `hsl(221, 83%, 40%)`.
 * @attr {boolean} show-values - The value written on each cell. Off by default.
 * @attr {boolean} show-legend - The Low to High swatches below. On by default.
 * @attr {boolean} show-tooltip - The tooltip over the hovered cell. On by default.
 * @prop {HeatmapCell[]} data - `{ row, col, value }` per cell.
 * @csspart base - The chart container.
 */
export class GeHeatmap extends GeChartBase {
    static override readonly styles = [GeChartBase.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GeChartBase.properties,
        data: { attribute: false },
        maxCellSize: { type: Number, attribute: 'max-cell-size' },
        minCellSize: { type: Number, attribute: 'min-cell-size' },
        fromColor: { attribute: 'from-color' },
        toColor: { attribute: 'to-color' },
        showValues: { type: Boolean, attribute: 'show-values' },
        showLegend: { converter: defaultTrue, attribute: 'show-legend' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        hovered: { state: true },
        tooltipPos: { state: true },
    };

    declare data: HeatmapCell[];
    declare maxCellSize: number;
    declare minCellSize: number;
    declare fromColor: string;
    declare toColor: string;
    declare showValues: boolean;
    declare showLegend: boolean;
    declare showTooltip: boolean;
    declare hovered: HeatmapCell | null;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.data = [];
        this.maxCellSize = 52;
        this.minCellSize = 18;
        this.fromColor = 'hsl(214, 95%, 93%)';
        this.toColor = 'hsl(221, 83%, 40%)';
        this.showValues = false;
        this.showLegend = true;
        this.showTooltip = true;
        this.hovered = null;
        this.tooltipPos = { x: 0, y: 0 };
        this.width = 480;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'heatmap-host';
    }

    private uniqueInOrder(pick: (c: HeatmapCell) => string): string[] {
        return [...new Set(this.data.map(pick))];
    }

    private get domain(): [number, number] {
        return extent(this.data.map((c) => c.value)) ?? [0, 1];
    }

    private colorFor(value: number): string {
        return sequentialColorScale(this.domain, [this.fromColor, this.toColor])(value);
    }

    private cellSize(cols: number): number {
        if (cols === 0) return this.maxCellSize;
        const ideal = (this.svgWidth - ROW_LABEL_W - GAP * cols) / cols;
        return Math.max(this.minCellSize, Math.min(this.maxCellSize, ideal));
    }

    private setHover(cell: HeatmapCell | null, x = 0, y = 0): void {
        this.hovered = cell;
        this.tooltipPos = { x, y };
        this.emit<HeatmapCell | null>('cell-hover', cell);
    }

    private tooltipRows(): ChartTooltipRow[] {
        const c = this.hovered;
        return c ? [{ label: c.col, value: formatChartValue(c.value), color: this.colorFor(c.value) }] : [];
    }

    private legend() {
        const [min, max] = this.domain;
        return html`<div class="legend" data-slot="heatmap-legend"><span>Low</span>${Array.from({ length: LEGEND_STEPS }, (...[, i]) => {
            const value = min + ((max - min) * i) / (LEGEND_STEPS - 1);
            return html`<span class="swatch" style=${`background:${this.colorFor(value)}`}></span>`;
        })}<span>High</span></div>`;
    }

    private cell(p: Placed) {
        return svg`<rect class="cell" data-slot="heatmap-cell" x=${p.x} y=${p.y} width=${p.size} height=${p.size} rx="3" fill=${p.color}
                tabindex="0" role="button" aria-label=${`${p.cell.row}, ${p.cell.col}: ${p.cell.value}`}
                @mouseenter=${() => this.setHover(p.cell, p.x + p.size / 2, p.y - 8)}
                @mouseleave=${() => this.setHover(null)}
                @focus=${() => this.setHover(p.cell, p.x + p.size / 2, p.y - 8)}
                @blur=${() => this.setHover(null)} />
            ${this.showValues ? svg`<text class="value" x=${p.x + p.size / 2} y=${p.y + p.size / 2 + 3} text-anchor="middle">${p.cell.value}</text>` : nothing}`;
    }

    protected override render() {
        const rows = this.uniqueInOrder((c) => c.row);
        const cols = this.uniqueInOrder((c) => c.col);
        const size = this.cellSize(cols.length);
        const usedWidth = ROW_LABEL_W + cols.length * (size + GAP);
        const height = COL_LABEL_H + rows.length * (size + GAP);
        const rowIndex = new Map(rows.map((r, i) => [r, i]));
        const colIndex = new Map(cols.map((c, i) => [c, i]));
        const placed: Placed[] = this.data.map((cell) => ({
            x: ROW_LABEL_W + (colIndex.get(cell.col) ?? 0) * (size + GAP),
            y: COL_LABEL_H + (rowIndex.get(cell.row) ?? 0) * (size + GAP),
            size,
            color: this.colorFor(cell.value),
            cell,
        }));
        const hovered = this.hovered;
        const tooltipHeading = hovered ? `${hovered.row} · ${hovered.col}` : undefined;
        return html`<div part="base" class="base" data-slot="heatmap" role="group" aria-label=${`${this.heading ? `${this.heading}. ` : ''}Heatmap with ${rows.length} rows and ${cols.length} columns.`}>
            <svg viewBox=${`0 0 ${usedWidth} ${height}`} width=${usedWidth} height=${height}>
                ${cols.map((col, ci) => svg`<text class="label" x=${ROW_LABEL_W + ci * (size + GAP) + size / 2} y="14" text-anchor="middle">${col}</text>`)}
                ${rows.map((row, ri) => svg`<text class="label" x="0" y=${COL_LABEL_H + ri * (size + GAP) + size / 2 + 3}>${row}</text>`)}
                ${placed.map((p) => this.cell(p))}
            </svg>
            ${this.showLegend ? this.legend() : nothing}
            ${this.showTooltip
                ? html`<ge-chart-tooltip
                      .visible=${hovered !== null}
                      .x=${this.tooltipPos.x}
                      .y=${this.tooltipPos.y}
                      .heading=${tooltipHeading}
                      .rows=${this.tooltipRows()}
                      .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
                  ></ge-chart-tooltip>`
                : nothing}
        </div>`;
    }
}
