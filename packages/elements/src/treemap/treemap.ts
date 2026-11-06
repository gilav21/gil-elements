import { html, nothing, svg, unsafeCSS } from 'lit';
import { GeChartBase, defaultTrue } from '../shared/chart/chart-base.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import { formatChartValue, getChartColor, getChartSummary } from '../shared/chart/chart.utils.js';
import { flattenLayout, layoutTreemap, nodeValue } from '../shared/chart/treemap-layout.js';
import type { TreemapLayoutNode, TreemapNode } from '../shared/chart/treemap.types.js';
import type { ChartTooltipRow } from '../chart-tooltip/index.js';
import css from './treemap.css?inline';

export type { TreemapNode } from '../shared/chart/treemap.types.js';

/** A laid-out node ready to draw: its rectangle, colour and whether its label fits. */
interface Cell {
    index: number;
    path: string;
    node: TreemapNode;
    value: number;
    depth: number;
    isLeaf: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    fillOpacity: number;
    showLabel: boolean;
    labelX: number;
    labelY: number;
}

const PAD = 4;
const MIN_LABEL_WIDTH = 44;
const MIN_LABEL_HEIGHT = 16;
const LABEL_INSET_X = 5;
const LABEL_INSET_Y = 13;
const LEAF_OPACITY = 0.85;
const DEPTH_FADE = 0.12;

/**
 * A hierarchy as nested rectangles whose areas are proportional to value, laid out with the squarified algorithm so they
 * stay close to square. A node with `children` is a group: its area is the sum of its children and its own `value` is
 * ignored. Missing, negative and non-finite values count as 0. Every rectangle is a button that takes focus; Enter or
 * Space activates it. RTL mirrors the layout, so the largest node sits top-right.
 *
 * @fires node-click - A node, group or leaf, was activated; `detail` is `{ point: node, index, event }`.
 * @fires node-hover - A node was entered or focused (`detail` is `{ point: node, index }`), or `null` once left.
 * @attr {number} group-padding - Inset in px inside every group before its children are laid out. Defaults to 3.
 * @attr {boolean} show-labels - Each node's label, when it fits. On by default.
 * @attr {number} min-label-width - Narrowest rectangle in px that still gets a label. Defaults to 44.
 * @attr {number} min-label-height - Shortest rectangle in px that still gets a label. Defaults to 16.
 * @attr {boolean} show-tooltip - The tooltip over the active node. On by default.
 * @attr {number} cell-radius - Corner radius in px. Defaults to 2.
 * @attr {string} unit - Written after every value, tooltip and accessible names alike, as in ` MB`.
 * @prop {TreemapNode[]} nodes - `{ label, value?, color?, children? }` entries; `color` is inherited by descendants that set none.
 * @csspart base - The chart container.
 */
export class GeTreemap extends GeChartBase {
    static override styles = [GeChartBase.styles, unsafeCSS(css)];
    static override properties = {
        ...GeChartBase.properties,
        nodes: { attribute: false },
        groupPadding: { type: Number, attribute: 'group-padding' },
        showLabels: { converter: defaultTrue, attribute: 'show-labels' },
        minLabelWidth: { type: Number, attribute: 'min-label-width' },
        minLabelHeight: { type: Number, attribute: 'min-label-height' },
        showTooltip: { converter: defaultTrue, attribute: 'show-tooltip' },
        cellRadius: { type: Number, attribute: 'cell-radius' },
        unit: {},
        tooltipPos: { state: true },
    };

    declare nodes: TreemapNode[];
    declare groupPadding: number;
    declare showLabels: boolean;
    declare minLabelWidth: number;
    declare minLabelHeight: number;
    declare showTooltip: boolean;
    declare cellRadius: number;
    declare unit: string;
    declare tooltipPos: { x: number; y: number };

    constructor() {
        super();
        this.nodes = [];
        this.height = 320;
        this.groupPadding = 3;
        this.showLabels = true;
        this.minLabelWidth = MIN_LABEL_WIDTH;
        this.minLabelHeight = MIN_LABEL_HEIGHT;
        this.showTooltip = true;
        this.cellRadius = 2;
        this.unit = '';
        this.tooltipPos = { x: 0, y: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'treemap-host';
    }

    /** The magnitude of the whole hierarchy, the denominator behind every share. */
    get total(): number {
        return this.nodes.reduce((sum, node) => sum + nodeValue(node), 0);
    }

    private formatValue(value: number): string {
        return formatChartValue(value, { compact: true }) + this.unit;
    }

    private cells(): Cell[] {
        const plot = { x: PAD, y: PAD, width: Math.max(0, this.svgWidth - PAD * 2), height: Math.max(0, this.height - PAD * 2) };
        const roots = layoutTreemap(this.nodes, plot, this.groupPadding);
        const rootColor = new Map(roots.map((root, i) => [root.path, getChartColor(i, root.node.color)]));
        const rtl = this.rtl;
        return flattenLayout(roots).map((placed: TreemapLayoutNode, index) => {
            const isLeaf = placed.children.length === 0;
            const x = rtl ? plot.x + plot.width - (placed.rect.x - plot.x) - placed.rect.width : placed.rect.x;
            return {
                index,
                path: placed.path,
                node: placed.node,
                value: placed.value,
                depth: placed.depth,
                isLeaf,
                x,
                y: placed.rect.y,
                width: placed.rect.width,
                height: placed.rect.height,
                color: placed.node.color ?? rootColor.get(placed.path.split('/')[0] ?? '') ?? getChartColor(0),
                fillOpacity: isLeaf ? Math.max(0.2, LEAF_OPACITY - placed.depth * DEPTH_FADE) : 0,
                showLabel: this.showLabels && placed.rect.width >= this.minLabelWidth && placed.rect.height >= this.minLabelHeight,
                labelX: rtl ? x + placed.rect.width - LABEL_INSET_X : x + LABEL_INSET_X,
                labelY: placed.rect.y + LABEL_INSET_Y,
            };
        });
    }

    private readonly enter = (cell: Cell) => {
        this.hoverIndex = cell.index;
        this.tooltipPos = { x: cell.x + 8, y: Math.max(8, cell.y + 8) };
        this.emit<ChartClickEvent<TreemapNode>>('node-hover', { point: cell.node, index: cell.index });
    };

    private readonly leave = () => {
        this.hoverIndex = null;
        this.emit('node-hover', null);
    };

    private activate(event: Event, cell: Cell): void {
        this.emit<ChartClickEvent<TreemapNode>>('node-click', { point: cell.node, index: cell.index, event: event instanceof MouseEvent ? event : undefined });
    }

    private onKey(event: KeyboardEvent, cell: Cell): void {
        if (event.key === 'Enter' || event.key === ' ') this.activate(event, cell);
    }

    /**
     * SVG `text-anchor` is relative to the text's own direction, so under an inherited `direction: rtl` it is `start`
     * that hugs the right edge; only when the layout direction was forced against the page's is it `end`.
     */
    private get labelAnchor(): 'start' | 'end' {
        return this.rtl === this.domRtl ? 'start' : 'end';
    }

    private cell(cell: Cell) {
        const hover = this.hoverIndex;
        return svg`<g class=${`cell${hover !== null && hover !== cell.index ? ' dim' : ''}`} data-slot="treemap-cell" data-depth=${cell.depth} data-leaf=${cell.isLeaf} tabindex="0" role="button" aria-label=${`${cell.node.label}: ${this.formatValue(cell.value)}`}
            @mouseenter=${() => this.enter(cell)} @touchstart=${() => this.enter(cell)} @mouseleave=${this.leave} @focus=${() => this.enter(cell)} @blur=${this.leave}
            @click=${(event: MouseEvent) => this.activate(event, cell)} @keydown=${(event: KeyboardEvent) => this.onKey(event, cell)}>
            <rect class=${hover === cell.index ? 'hot' : ''} x=${cell.x} y=${cell.y} width=${cell.width} height=${cell.height} rx=${this.cellRadius} fill=${cell.color} fill-opacity=${cell.fillOpacity} stroke=${cell.color} stroke-width=${cell.isLeaf ? 1 : 1.5} />
            ${cell.showLabel ? svg`<text class="label" data-slot="treemap-label" x=${cell.labelX} y=${cell.labelY} text-anchor=${this.labelAnchor}>${cell.node.label}</text>` : nothing}
        </g>`;
    }

    private tooltip(cells: Cell[]) {
        const hover = this.hoverIndex;
        const cell = hover === null ? undefined : cells[hover];
        // Only drawn when the total is positive (see render), so a share never divides by zero.
        const rows: ChartTooltipRow[] = cell
            ? [
                  { label: 'Value', value: this.formatValue(cell.value), color: cell.color },
                  { label: 'Share', value: `${formatChartValue((cell.value / this.total) * 100, { decimals: 1 })}%` },
              ]
            : [];
        return html`<ge-chart-tooltip
            .visible=${hover !== null}
            .x=${this.tooltipPos.x}
            .y=${this.tooltipPos.y}
            .heading=${cell?.node.label}
            .rows=${rows}
            .flipX=${this.tooltipPos.x > this.svgWidth * 0.7}
        ></ge-chart-tooltip>`;
    }

    protected override render() {
        const label = getChartSummary('Treemap', this.nodes.length, this.heading);
        if (this.total <= 0) {
            return html`<div part="base" class="base" data-slot="treemap" role="group" aria-label=${label}>
                <div class="empty" data-slot="treemap-empty" style=${`min-height:${this.height}px`}>No data to display</div>
            </div>`;
        }
        const cells = this.cells();
        return html`<div part="base" class="base" data-slot="treemap" role="group" aria-label=${label}>
            <svg viewBox=${`0 0 ${this.svgWidth} ${this.height}`} width="100%" height=${this.height}>${cells.map((c) => this.cell(c))}</svg>
            ${this.showTooltip ? this.tooltip(cells) : nothing}
        </div>`;
    }
}
