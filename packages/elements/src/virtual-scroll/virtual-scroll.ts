import { html, nothing, render, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import { VirtualAxis } from './virtual-axis.js';
import css from './virtual-scroll.css?inline';

export type VirtualScrollOrientation = 'vertical' | 'horizontal' | 'both';
export type VirtualRenderItem = (item: unknown, index: number) => unknown;
export type VirtualTrackBy = (item: unknown, index: number) => unknown;

export interface VirtualScrollState {
    windowStart: number;
    windowEnd: number;
    windowSize: number;
    totalItems: number;
    scrollProgress: number;
}
export interface VirtualScrollWindow2D {
    readonly rowStart: number;
    readonly rowEnd: number;
    readonly columnStart: number;
    readonly columnEnd: number;
}

interface Range {
    start: number;
    end: number;
}
interface Adjustment {
    top: number;
    left: number;
}

const CHUNK_SIZE = 500;
const ITEM = '[data-virtual-item]';

/**
 * Renders only the rows (or cells) in view of a very long list, with variable sizes: sizes start as `min-item-height` /
 * `min-item-width` estimates, are measured once rendered, and the scroll position is anchored when a row above the
 * viewport changes size. Give the element a bounded height (or width, when horizontal); it fills its parent otherwise.
 *
 * Rows are rendered into the element's light DOM, so the page's own styles reach them. `renderItem` returns a Lit
 * template (or a node, or text) for one item; a template keeps its nodes while the window moves, a node you create is
 * only called again for rows that enter the window.
 *
 * With `orientation="both"`, `items` is a flat row-major grid of `column-count` columns and both axes are windowed.
 *
 * @fires window-change - The rendered index window moved. `detail` is `{ start, end }` (end exclusive), buffer included.
 * @fires scroll-state - Scroll or data changed. `detail` is `{ windowStart, windowEnd, windowSize, totalItems, scrollProgress }`, progress 0 to 1.
 * @fires cell-window-change - `both` mode only: `detail` is `{ rowStart, rowEnd, columnStart, columnEnd }`.
 * @fires scroll-end - Infinite-scroll trigger: the viewport is within two rows of the end while `has-more` is on and `loading` is off. Set `loading` synchronously in the handler or it fires again on the next scroll.
 * @attr {number} min-item-height - Assumed height of an unmeasured row in pixels (default 50).
 * @attr {number} min-item-width - Assumed width of an unmeasured cell in pixels, for `horizontal` and `both` (default 100).
 * @attr {'vertical' | 'horizontal' | 'both'} orientation - Which axes are virtualized (default `vertical`).
 * @attr {number} column-count - Columns of the grid in `both` mode (default 1; below 1 means 1).
 * @attr {number} buffer - Extra rows rendered beyond each edge of the viewport (default 5).
 * @attr {boolean} loading - Shows the loading row at the bottom and suppresses `scroll-end`.
 * @attr {boolean} has-more - Whether more pages exist (default true; `has-more="false"` stops `scroll-end`).
 * @prop {unknown[]} items - The full list.
 * @prop {(item, index) => unknown} renderItem - Returns the content of one item; `index` is the index in `items`.
 * @prop {(item, index) => unknown} trackBy - Key of an item so its row keeps its node as the window moves; defaults to `item.id`, then the index.
 * @slot loading - Replaces the default spinner and "Loading..." shown while `loading` is set.
 * @csspart viewport - The scrolling box.
 */
export class GeVirtualScroll extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        items: { attribute: false },
        renderItem: { attribute: false },
        trackBy: { attribute: false },
        minItemHeight: { attribute: 'min-item-height', type: Number },
        minItemWidth: { attribute: 'min-item-width', type: Number },
        orientation: { reflect: true },
        columnCount: { attribute: 'column-count', type: Number },
        buffer: { type: Number },
        loading: { type: Boolean, reflect: true },
        hasMore: { attribute: 'has-more', converter: defaultTrue, reflect: true },
        containerHeight: { state: true },
        containerWidth: { state: true },
        scrolledY: { state: true },
        scrolledX: { state: true },
        measurements: { state: true },
    };

    declare items: unknown[];
    declare renderItem: VirtualRenderItem | null;
    declare trackBy: VirtualTrackBy;
    declare minItemHeight: number;
    declare minItemWidth: number;
    declare orientation: VirtualScrollOrientation;
    declare columnCount: number;
    declare buffer: number;
    declare loading: boolean;
    declare hasMore: boolean;
    declare protected containerHeight: number;
    declare protected containerWidth: number;
    declare protected scrolledY: number;
    declare protected scrolledX: number;
    declare protected measurements: number;

    private readonly rowAxis = new VirtualAxis(CHUNK_SIZE);
    private readonly columnAxis = new VirtualAxis(CHUNK_SIZE);
    private readonly rows = document.createElement('div');
    private itemObserver: ResizeObserver | null = null;
    private containerObserver: ResizeObserver | null = null;
    private readonly observed = new Set<Element>();
    private renderedKey = '';
    private emittedWindow = '';

    constructor() {
        super();
        this.items = [];
        this.renderItem = null;
        this.trackBy = (item, index) => (item as { id?: unknown } | null)?.id ?? index;
        this.minItemHeight = 50;
        this.minItemWidth = 100;
        this.orientation = 'vertical';
        this.columnCount = 1;
        this.buffer = 5;
        this.loading = false;
        this.hasMore = true;
        this.containerHeight = 0;
        this.containerWidth = 0;
        this.scrolledY = 0;
        this.scrolledX = 0;
        this.measurements = 0;
        this.rows.slot = 'items';
        this.rows.style.display = 'contents';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'virtual-scroll';
        this.append(this.rows);
        if (this.hasUpdated) this.startObserving();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.itemObserver?.disconnect();
        this.containerObserver?.disconnect();
        this.itemObserver = null;
        this.containerObserver = null;
        this.observed.clear();
        this.rows.remove();
    }

    protected override firstUpdated(): void {
        this.startObserving();
    }

    private get viewport(): HTMLElement | null {
        return this.renderRoot.querySelector<HTMLElement>('.viewport');
    }

    private startObserving(): void {
        const viewport = this.viewport;
        if (!viewport) return;
        this.measureViewport(viewport);
        if (typeof ResizeObserver !== 'function') return;
        this.itemObserver = new ResizeObserver((entries) => this.handleResizes(entries));
        this.containerObserver = new ResizeObserver(() => this.measureViewport(viewport));
        this.containerObserver.observe(viewport);
    }

    private measureViewport(viewport: HTMLElement): void {
        this.containerHeight = viewport.clientHeight;
        this.containerWidth = viewport.clientWidth;
    }

    // ---- geometry -----------------------------------------------------------------------------------------

    private get grid(): boolean {
        return this.orientation === 'both';
    }
    private get horizontal(): boolean {
        return this.orientation === 'horizontal';
    }
    private get columns(): number {
        return this.grid ? Math.max(1, Math.trunc(this.columnCount) || 1) : 1;
    }
    private get mainCount(): number {
        return this.horizontal ? this.items.length : this.grid ? Math.ceil(this.items.length / this.columns) : this.items.length;
    }
    private get mainAxis(): VirtualAxis {
        return this.horizontal ? this.columnAxis : this.rowAxis;
    }
    private get mainEstimate(): number {
        return this.horizontal ? this.minItemWidth : this.minItemHeight;
    }

    private get viewportRange(): Range {
        return this.mainAxis.window(this.horizontal ? this.scrolledX : this.scrolledY, this.horizontal ? this.containerWidth : this.containerHeight, this.mainEstimate, this.mainCount);
    }

    private get renderRange(): Range {
        const { start, end } = this.viewportRange;
        return { start: Math.max(0, start - this.buffer), end: Math.min(this.mainCount, end + this.buffer) };
    }

    private get columnViewportRange(): Range {
        if (!this.grid) return { start: 0, end: 1 };
        return this.columnAxis.window(this.scrolledX, this.containerWidth, this.minItemWidth, this.columns);
    }

    private get columnRenderRange(): Range {
        if (!this.grid) return { start: 0, end: 1 };
        const { start, end } = this.columnViewportRange;
        return { start: Math.max(0, start - this.buffer), end: Math.min(this.columns, end + this.buffer) };
    }

    private get paddingTop(): number {
        return this.horizontal ? 0 : this.rowAxis.offsetForIndex(this.renderRange.start, this.minItemHeight);
    }

    private get paddingBottom(): number {
        if (this.horizontal) return 0;
        const total = this.rowAxis.totalSize(this.mainCount, this.minItemHeight);
        return Math.max(0, total - this.rowAxis.offsetForIndex(this.renderRange.end, this.minItemHeight));
    }

    private get paddingStart(): number {
        if (this.horizontal) return this.columnAxis.offsetForIndex(this.renderRange.start, this.minItemWidth);
        return this.grid ? this.columnAxis.offsetForIndex(this.columnRenderRange.start, this.minItemWidth) : 0;
    }

    private get paddingEnd(): number {
        if (this.horizontal) {
            const total = this.columnAxis.totalSize(this.items.length, this.minItemWidth);
            return Math.max(0, total - this.columnAxis.offsetForIndex(this.renderRange.end, this.minItemWidth));
        }
        if (!this.grid) return 0;
        const total = this.columnAxis.totalSize(this.columns, this.minItemWidth);
        return Math.max(0, total - this.columnAxis.offsetForIndex(this.columnRenderRange.end, this.minItemWidth));
    }

    // ---- rows ---------------------------------------------------------------------------------------------

    private renderContent(item: unknown, index: number): unknown {
        return this.renderItem?.(item, index);
    }

    private rowsTemplate(): unknown {
        const { start, end } = this.renderRange;
        if (this.grid) return this.gridTemplate(start, end);
        const style = this.horizontal ? 'flex-shrink:0;height:100%' : 'width:100%';
        const indexes = Array.from({ length: Math.max(0, end - start) }, (_, offset) => start + offset);
        return repeat(
            indexes,
            (index) => this.trackBy(this.items[index], index),
            (index) => html`<div data-virtual-item data-index=${index} style=${style}>${this.renderContent(this.items[index], index)}</div>`,
        );
    }

    private gridTemplate(rowStart: number, rowEnd: number): unknown {
        const columns = this.columns;
        const cols = this.columnRenderRange;
        const rows = Array.from({ length: Math.max(0, rowEnd - rowStart) }, (_, offset) => rowStart + offset);
        const rowStyle = `display:flex;padding-inline-start:${this.paddingStart}px;padding-inline-end:${this.paddingEnd}px`;
        return repeat(
            rows,
            (row) => row,
            (row) => {
                const cells: TemplateResult[] = [];
                for (let column = cols.start; column < cols.end; column++) {
                    const index = row * columns + column;
                    if (index >= this.items.length) continue;
                    cells.push(html`<div data-virtual-item data-index=${index} data-row=${row} data-column=${column} style="flex-shrink:0">${this.renderContent(this.items[index], index)}</div>`);
                }
                return html`<div data-virtual-row data-row=${row} style=${rowStyle}>${cells}</div>`;
            },
        );
    }

    // ---- resize and anchoring -----------------------------------------------------------------------------

    private handleResizes(entries: ResizeObserverEntry[]): void {
        const adjustment: Adjustment = { top: 0, left: 0 };
        const firstMain = this.viewportRange.start;
        const firstColumn = this.grid ? this.columnViewportRange.start : 0;
        let changed = false;
        for (const entry of entries) changed = this.recordEntry(entry, firstMain, firstColumn, adjustment) || changed;
        const viewport = this.viewport;
        if (viewport && (adjustment.top !== 0 || adjustment.left !== 0)) this.applyAdjustment(viewport, adjustment);
        if (changed) this.measurements++;
    }

    private recordEntry(entry: ResizeObserverEntry, firstMain: number, firstColumn: number, adjustment: Adjustment): boolean {
        const el = entry.target as HTMLElement;
        const box = entry.borderBoxSize[0];
        if (!box) return false;
        if (this.grid) return this.recordGridEntry(el, box, firstMain, firstColumn, adjustment);
        const index = Number.parseInt(el.dataset.index ?? '-1', 10);
        if (index === -1) return false;
        if (this.horizontal) {
            const delta = this.columnAxis.record(index, box.inlineSize, this.minItemWidth);
            if (delta !== 0 && index < firstMain) adjustment.left += delta;
            return delta !== 0;
        }
        const delta = this.rowAxis.record(index, box.blockSize, this.minItemHeight);
        if (delta !== 0 && index < firstMain) adjustment.top += delta;
        return delta !== 0;
    }

    /** Every cell of a row reports that row; the axis sees the first as a change and the rest as noise, so the delta counts once. */
    private recordGridEntry(el: HTMLElement, box: ResizeObserverSize, firstRow: number, firstColumn: number, adjustment: Adjustment): boolean {
        const row = Number.parseInt(el.dataset.row ?? '-1', 10);
        const column = Number.parseInt(el.dataset.column ?? '-1', 10);
        let changed = false;
        if (row !== -1) {
            const delta = this.rowAxis.record(row, box.blockSize, this.minItemHeight);
            if (delta !== 0 && row < firstRow) adjustment.top += delta;
            changed = delta !== 0;
        }
        if (column !== -1) {
            const delta = this.columnAxis.record(column, box.inlineSize, this.minItemWidth);
            if (delta !== 0 && column < firstColumn) adjustment.left += delta;
            changed = changed || delta !== 0;
        }
        return changed;
    }

    private applyAdjustment(viewport: HTMLElement, adjustment: Adjustment): void {
        if (adjustment.top !== 0) {
            viewport.scrollTop += adjustment.top;
            this.scrolledY = viewport.scrollTop;
        }
        if (adjustment.left !== 0) {
            viewport.scrollLeft += adjustment.left;
            this.scrolledX = viewport.scrollLeft;
        }
    }

    private readonly onScroll = (event: Event): void => {
        const target = event.target as HTMLElement;
        this.scrolledY = target.scrollTop;
        this.scrolledX = target.scrollLeft;
    };

    // ---- public API ---------------------------------------------------------------------------------------

    /** Jumps to an item without smooth scrolling. Horizontal scrolls X; in `both` mode `index` is the row (see `scrollToCell`). Far into unmeasured territory it lands approximately and settles as rows are measured. */
    scrollToIndex(index: number): void {
        const viewport = this.viewport;
        if (!viewport) return;
        const offset = this.mainAxis.offsetForIndex(index, this.mainEstimate);
        if (this.horizontal) {
            viewport.scrollTo({ left: offset, behavior: 'instant' });
            this.scrolledX = offset;
            return;
        }
        viewport.scrollTo({ top: offset, behavior: 'instant' });
        this.scrolledY = offset;
    }

    /** Jumps to a grid cell, scrolling both axes. Outside `both` mode it is `scrollToIndex(row)`. */
    scrollToCell(row: number, column: number): void {
        const viewport = this.viewport;
        if (!this.grid || !viewport) {
            this.scrollToIndex(row);
            return;
        }
        const top = this.rowAxis.offsetForIndex(row, this.minItemHeight);
        const left = this.columnAxis.offsetForIndex(column, this.minItemWidth);
        viewport.scrollTo({ top, left, behavior: 'instant' });
        this.scrolledY = top;
        this.scrolledX = left;
    }

    /** Jumps to the first item. */
    scrollToTop(): void {
        this.scrollToIndex(0);
    }

    /** Jumps to the end of the content known so far on the main axis; unrendered rows are estimates, so this is the estimated end. */
    scrollToBottom(): void {
        const viewport = this.viewport;
        if (!viewport) return;
        if (this.horizontal) {
            viewport.scrollLeft = viewport.scrollWidth;
            this.scrolledX = viewport.scrollLeft;
            return;
        }
        viewport.scrollTop = viewport.scrollHeight;
        this.scrolledY = viewport.scrollTop;
    }

    // ---- lifecycle ----------------------------------------------------------------------------------------

    protected override updated(changed: PropertyValues<this>): void {
        this.syncRows(changed);
        this.syncObserved();
        this.announce(changed);
    }

    private syncRows(changed: PropertyValues<this>): void {
        const { start, end } = this.renderRange;
        const cols = this.columnRenderRange;
        const key = `${start}:${end}:${cols.start}:${cols.end}:${this.paddingStart}:${this.paddingEnd}`;
        const dataChanged = changed.has('items') || changed.has('renderItem') || changed.has('trackBy') || changed.has('orientation') || changed.has('columnCount');
        if (!dataChanged && key === this.renderedKey) return;
        this.renderedKey = key;
        render(this.rowsTemplate(), this.rows, { host: this });
    }

    private syncObserved(): void {
        if (!this.itemObserver) return;
        const present = new Set(this.rows.querySelectorAll(ITEM));
        for (const el of this.observed) {
            if (present.has(el)) continue;
            this.itemObserver.unobserve(el);
            this.observed.delete(el);
        }
        for (const el of present) {
            if (this.observed.has(el)) continue;
            this.itemObserver.observe(el);
            this.observed.add(el);
        }
    }

    private progress(): number {
        const viewport = this.viewport;
        if (!viewport) return 0;
        if (this.horizontal) {
            const { scrollLeft, scrollWidth, clientWidth } = viewport;
            return scrollWidth <= clientWidth ? 0 : scrollLeft / (scrollWidth - clientWidth);
        }
        const { scrollTop, scrollHeight, clientHeight } = viewport;
        return scrollHeight <= clientHeight ? 0 : scrollTop / (scrollHeight - clientHeight);
    }

    private announce(changed: PropertyValues<this>): void {
        const moved = ['items', 'scrolledY', 'scrolledX', 'containerHeight', 'containerWidth', 'measurements', 'orientation', 'columnCount', 'buffer', 'minItemHeight', 'minItemWidth'].some((name) => (changed as Map<PropertyKey, unknown>).has(name));
        if (!moved && !changed.has('loading') && !changed.has('hasMore')) return;
        if (this.viewportRange.end >= this.mainCount - 2 && !this.loading && this.hasMore) this.emit('scroll-end', undefined);
        if (!moved) return;
        const { start, end } = this.renderRange;
        const cols = this.columnRenderRange;
        const key = `${start}:${end}:${this.grid ? `${cols.start}:${cols.end}` : ''}`;
        if (key === this.emittedWindow) {
            this.emitState(start, end);
            return;
        }
        this.emittedWindow = key;
        this.emit('window-change', { start, end });
        this.emitState(start, end);
        if (this.grid) this.emit('cell-window-change', { rowStart: start, rowEnd: end, columnStart: cols.start, columnEnd: cols.end } satisfies VirtualScrollWindow2D);
    }

    private emitState(start: number, end: number): void {
        this.emit('scroll-state', { windowStart: start, windowEnd: end, windowSize: end - start, totalItems: this.items.length, scrollProgress: this.progress() } satisfies VirtualScrollState);
    }

    private emit(name: string, detail: unknown): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    protected override render() {
        const orientation = this.orientation;
        const content =
            orientation === 'both'
                ? `padding-top:${this.paddingTop}px;padding-bottom:${this.paddingBottom}px`
                : orientation === 'horizontal'
                  ? `padding-inline-start:${this.paddingStart}px;padding-inline-end:${this.paddingEnd}px`
                  : `padding-top:${this.paddingTop}px;padding-bottom:${this.paddingBottom}px`;
        return html`<div class="viewport" part="viewport" data-orientation=${orientation} tabindex="0" @scroll=${this.onScroll}>
            <div class="content" data-orientation=${orientation} style=${content}><slot name="items"></slot></div>
            ${this.loading
                ? html`<div class="loading"><slot name="loading"><div class="indicator"><div class="ring"></div><span>Loading...</span></div></slot></div>`
                : nothing}
        </div>`;
    }
}
