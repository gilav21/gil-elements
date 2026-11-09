import type { DataTableCoreHost } from './data-table-host.js';
import { requireProvider } from './data-table-host.js';
import { isFlagged } from './data-table-expansion.js';
import type { VirtualService } from './data-table-providers.js';
import {
    type BodyWindowShape,
    buildPrefixSums,
    clampScroll,
    computeBodyWindow,
    firstRowAt,
    heightChanged,
    isVirtualScrollActive,
    parsePx,
    revealOffset,
    sameWindow,
    windowCovers,
    scrollTopForRow,
    setRetainedTops,
} from './data-table-virtual.js';
import { pxOf } from './data-table-columns.js';
import type { BodyWindow, EnhancedColumnDef, FlattenedTreeRow, VirtualRenderRange } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

const VIEWPORT = '[data-slot="data-table-viewport"]';
const BODY = '[data-slot="table-body"]';
const ROW = '[data-slot="table-row"]';

/** What the window is drawn from, as far as the browser tells us: sizes of the scroller, header, footer and pinned stacks. */
interface Chrome {
    viewH: number;
    viewW: number;
    headH: number;
    footH: number;
    pinStart: number;
    pinEnd: number;
}

interface Measurement {
    index: number;
    detail: boolean;
    height: number;
}

/**
 * The virtual window: which rows and middle columns are drawn out of the whole list, the padding standing in for the
 * rest, and the rows kept drawn outside it (the focused one). It also owns the scroller: scroll position, the scroll API
 * and `reveal` (the minimal scroll that brings a cell into view clear of the sticky header, footer and pinned columns).
 *
 * The window is recomputed before every render and on scroll; a render is requested only when it changed. Heights of
 * variable rows come from one ResizeObserver, whose callback never renders: it stores sizes and asks for a frame, or
 * Chromium reports "ResizeObserver loop completed with undelivered notifications".
 */
export class VirtualController<T> {
    private viewport: HTMLElement | null = null;
    private chrome: Chrome = { viewH: 0, viewW: 0, headH: 0, footH: 0, pinStart: 0, pinEnd: 0 };
    private scrollTop = 0;
    private scrollInline = 0;
    private rowHeight = 40;
    private rowHeightDirty = true;
    private measuredWidths = new Map<string, number>();
    private measureDirty = false;

    private activeNow = false;
    private resolving = false;
    private variable = false;
    private source: readonly unknown[] | null = null;
    private total = 0;
    private readonly heights = new Map<number, { row: number; detail: number }>();
    /** The same heights by row id, so they survive a new list: pruned when it outgrows the list by far. */
    private byId = new Map<string, { row: number; detail: number }>();
    private prefix: Float64Array | null = null;
    private prefixDirty = true;
    /** Changes whenever the vertical geometry (row count, heights) does, so a kept window is never kept across it. */
    private geometry = '';
    private remeasure = false;

    private readonly retained = new Map<string, readonly number[]>();
    private current: BodyWindowShape = { start: 0, end: 0, padStart: 0, padEnd: 0, colPadStart: 0, colPadEnd: 0, colStart: 0, colEnd: 0, retained: [] };
    private tops: readonly number[] = [];
    private middleWidths: number[] = [];

    private frame = 0;
    private binding = false;
    private viewportObserver: ResizeObserver | null = null;
    private rowObserver: ResizeObserver | null = null;
    private bodyObserver: MutationObserver | null = null;
    private readonly observed = new Set<Element>();
    private teardown: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    // ---- the service ------------------------------------------------------------------------------------------------

    private readonly service: VirtualService = {
        active: () => this.resolveActive(),
        renderRange: (): VirtualRenderRange => ({ rowStart: this.current.start, rowEnd: this.current.end, colStart: this.current.colStart, colEnd: this.current.colEnd }),
        window: (): BodyWindow => (this.activeNow ? this.current : this.wholeList()),
        scrollToRow: (index) => this.moveTo(this.topOfRow(index), undefined),
        scrollToColumn: (key) => this.moveTo(undefined, this.startOfColumn(key)),
        scrollToCell: (rowIndex, key) => this.moveTo(this.topOfRow(rowIndex), this.startOfColumn(key)),
        reveal: (rowIndex, key) => this.reveal(rowIndex, key),
        retain: (owner, rows) => this.retain(owner, rows),
        measure: () => this.measure(),
    };

    attach(): void {
        const { host } = this;
        const coarse = host.root.ownerDocument.defaultView?.matchMedia('(pointer: coarse)');
        this.teardown = [
            host.provide('virtual', this.service),
            host.topics.on('columns', () => this.invalidate()),
            host.topics.on('expansion', () => this.dropClosedDetails()),
            host.disposables.listen(host.root, 'scroll', (event) => event.target === this.viewport && this.schedule(), { capture: true, passive: true }),
            ...(coarse ? [host.disposables.listen(coarse, 'change', () => this.measure())] : []),
        ];
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.unbind();
        this.host.root.removeAttribute('data-virtual');
        cancelAnimationFrame(this.frame);
        this.frame = 0;
        this.activeNow = false;
        this.source = null;
    }

    hostUpdate(): void {
        const active = this.resolveActive();
        this.syncMode(active);
        if (!this.viewport?.isConnected && !this.binding) {
            this.binding = true;
            this.host.afterRender(() => {
                this.binding = false;
                this.bind();
            });
        }
        if (active) this.recompute();
    }

    // ---- is it on, and what does it slice ---------------------------------------------------------------------------------

    /**
     * Resolved on demand: the query stage asks while it computes, so this must not depend on a result of its own. In tree
     * mode the row count comes from the same stage that is asking; the re-entrant ask gets the last answer.
     */
    private resolveActive(): boolean {
        if (this.resolving) return this.activeNow;
        this.resolving = true;
        try {
            const { config } = this.host;
            const mode = config.enableVirtualScroll;
            const pager = config.localPagination && config.showPagination;
            const counted = mode === 'auto' && !pager;
            const rows = counted ? requireProvider(this.host, 'query').rowWindowSource().length : 0;
            const columns = counted ? requireProvider(this.host, 'columns').enhancedColumns().filter((c) => c._pin === undefined && !isSpecialColumnKey(c.accessorKey)).length : 0;
            this.activeNow = isVirtualScrollActive(mode, pager, rows, columns, config.virtualAutoThreshold);
        } finally {
            this.resolving = false;
        }
        return this.activeNow;
    }

    /** Rows with an unmeasured detail row cannot have a fixed height: heights are measured then too. */
    private syncMode(active: boolean): void {
        const { config, root } = this.host;
        const variable = active && (config.virtualVariableRowHeight || config.enableRowExpansion);
        if (active) root.setAttribute('data-virtual', variable ? 'variable' : 'fixed');
        else root.removeAttribute('data-virtual');
        if (variable === this.variable) return;
        this.variable = variable;
        this.prefixDirty = true;
        this.heights.clear();
        this.byId.clear();
        if (variable) this.watchRows();
        else this.unwatchRows();
    }

    private wholeList(): BodyWindow {
        const rows = requireProvider(this.host, 'query').displayRows().length;
        const columns = requireProvider(this.host, 'columns').enhancedColumns().length;
        return { start: 0, end: rows, padStart: 0, padEnd: 0, colPadStart: 0, colPadEnd: 0, colStart: 0, colEnd: columns, retained: [] };
    }

    // ---- the window -------------------------------------------------------------------------------------------------------

    private widthOf(column: EnhancedColumnDef<T>): number {
        return pxOf(column._width) ?? this.measuredWidths.get(String(column.accessorKey)) ?? this.host.config.virtualAutoColumnWidth;
    }

    private itemHeight(index: number): number {
        const h = this.heights.get(index);
        return h ? h.row + h.detail : this.rowHeight;
    }

    private ensurePrefix(): Float64Array | undefined {
        if (!this.variable) return undefined;
        if (this.prefixDirty || !this.prefix || this.prefix.length !== this.total + 1) {
            this.prefix = buildPrefixSums((i) => this.itemHeight(i), this.total);
            this.prefixDirty = false;
        }
        return this.prefix;
    }

    /** A collapsed row's detail row leaves the DOM before the observer could report it at 0: its measured height goes with it. */
    private dropClosedDetails(): void {
        if (!this.variable) return;
        const expanded = this.host.model.get('expandedRows');
        const gone: Measurement[] = [];
        for (const [index, { detail }] of this.heights) {
            const id = this.idOf(this.source?.[index]);
            if (detail > 0 && !(id !== undefined && isFlagged(expanded, id))) gone.push({ index, detail: true, height: 0 });
        }
        if (gone.length > 0) this.applyHeights(gone);
    }

    /** The id of a row of the window source: the tree's visible rows in tree mode, the sorted rows themselves otherwise. */
    private idOf(item: unknown): string | undefined {
        if (item === undefined) return undefined;
        const { config } = this.host;
        return config.getRowId(config.enableSubRows ? (item as FlattenedTreeRow<T>).row : (item as T));
    }

    /** Recomputes the window from the current scroll state; true when what is drawn changed. */
    private recompute(): boolean {
        const { host } = this;
        const source = requireProvider(host, 'query').rowWindowSource();
        if (source !== this.source) {
            // Heights are by row position but belong to the row: a new list (sort, filter, expand, an edited cell) moves them
            // with their rows, so the scroll height holds; the drawn rows are read again for what really changed.
            if (this.variable && this.source !== null) {
                this.heights.clear();
                source.forEach((item, i) => {
                    const id = this.idOf(item);
                    const known = id === undefined ? undefined : this.byId.get(id);
                    if (known) this.heights.set(i, known);
                });
                if (this.byId.size > 2 * this.heights.size + 100) this.byId = new Map([...this.heights].map(([i, h]) => [this.idOf(source[i]) as string, h]));
                this.prefixDirty = true;
                this.remeasure = true;
                this.schedule();
            }
            this.source = source;
        }
        this.total = source.length;
        if (this.rowHeightDirty) this.readRowHeight();
        const columns = requireProvider(host, 'columns').enhancedColumns();
        const first = columns.findIndex((c) => c._pin !== 'left');
        const middleFirst = first === -1 ? columns.length : first;
        const middle = columns.slice(middleFirst).filter((c) => c._pin === undefined);
        this.middleWidths = middle.map((c) => this.widthOf(c));
        const prefix = this.ensurePrefix();
        // Before the first measurement the box itself stands in for the scroller: it over-draws by the toolbar and pager at most.
        const unmeasured = this.chrome.viewH === 0 && this.viewport === null;
        const next = computeBodyWindow({
            total: this.total,
            scrollTop: this.scrollTop,
            viewportHeight: unmeasured ? host.root.clientHeight : this.chrome.viewH,
            rowHeight: this.rowHeight,
            ...(prefix ? { prefix } : {}),
            rowBuffer: host.config.virtualRowBuffer,
            columnCount: columns.length,
            middleFirst,
            middleWidths: this.middleWidths,
            scrollInline: this.scrollInline,
            viewportWidth: unmeasured ? host.root.clientWidth : this.chrome.viewW,
            columnBuffer: host.config.virtualColumnBuffer,
            retained: this.retained.values(),
        });
        const geometry = `${this.total}|${this.rowHeight}|${prefix?.[this.total] ?? 0}|${this.middleWidths.length}`;
        const stable = geometry === this.geometry;
        this.geometry = geometry;
        if (stable && this.keepsCovering(next, prefix)) return false;
        const tops = next.retained.map((row) => (prefix ? (prefix[row] ?? 0) : row * this.rowHeight));
        const same = sameWindow(this.current, next) && tops.length === this.tops.length && tops.every((t, i) => t === this.tops[i]);
        if (same) return false;
        this.current = next;
        this.tops = tops;
        setRetainedTops(next, new Map(next.retained.map((row, i) => [row, tops[i] as number])));
        return true;
    }

    /** A small scroll inside the buffer keeps the drawn rows: they still cover the viewport with spare rows on both sides. */
    private keepsCovering(next: BodyWindowShape, prefix: Float64Array | undefined): boolean {
        const cur = this.current;
        const sameColumns = cur.colStart === next.colStart && cur.colEnd === next.colEnd && cur.colPadStart === next.colPadStart && cur.colPadEnd === next.colPadEnd;
        const sameRetained = cur.retained.length === next.retained.length && cur.retained.every((row, i) => row === next.retained[i]);
        if (!sameColumns || !sameRetained || cur.end === 0) return false;
        const tight = computeBodyWindow({ total: this.total, scrollTop: this.scrollTop, viewportHeight: this.chrome.viewH || this.host.root.clientHeight, rowHeight: this.rowHeight, ...(prefix ? { prefix } : {}), rowBuffer: 0, columnCount: 0, middleFirst: 0, middleWidths: [], scrollInline: 0, viewportWidth: 0, columnBuffer: 0, retained: [] });
        return windowCovers(cur, tight, Math.max(1, Math.floor(this.host.config.virtualRowBuffer / 2)), this.total);
    }

    /** Recomputes and, when what is drawn changed, tells the readers and asks for a render. */
    private update(): void {
        if (!this.activeNow || !this.recompute()) return;
        this.host.topics.emit('viewport');
        this.host.requestRender();
    }

    private readRowHeight(): void {
        this.rowHeightDirty = false;
        const { host } = this;
        const fromConfig = host.config.virtualRowHeight;
        if (fromConfig !== undefined && fromConfig > 0) {
            this.rowHeight = fromConfig;
            return;
        }
        // The CSS owns the height (density, touch targets, consumer overrides); a non-pixel value is read off the first drawn row.
        const css = parsePx(getComputedStyle(host.root).getPropertyValue('--ge-dt-row-height'));
        const drawn = host.root.querySelector<HTMLElement>(`${ROW}[data-kind="data"]`)?.getBoundingClientRect().height;
        const height = css ?? drawn;
        if (height !== undefined && height > 0) this.rowHeight = height;
    }

    // ---- the browser's side: scroller, observers --------------------------------------------------------------------------

    private invalidate(): void {
        this.measureDirty = true;
        this.schedule();
    }

    /** One frame for everything pending: a scroll, a resize, a measurement. */
    private schedule(): void {
        if (this.frame !== 0) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            this.flush();
        });
    }

    private flush(): void {
        const vp = this.viewport;
        if (!vp?.isConnected) return;
        this.scrollTop = vp.scrollTop;
        this.scrollInline = Math.abs(vp.scrollLeft);
        if (this.measureDirty) this.measureChrome();
        if (this.remeasure) {
            this.remeasure = false;
            this.applyHeights(this.readRows());
        }
        this.update();
    }

    private bind(): void {
        const vp = this.host.root.querySelector<HTMLElement>(VIEWPORT);
        if (!vp || vp === this.viewport) return;
        this.unbind();
        this.viewport = vp;
        if (typeof ResizeObserver !== 'undefined') this.viewportObserver = new ResizeObserver(() => this.invalidate());
        this.watchChrome();
        if (this.variable) this.watchRows();
        this.measureDirty = true;
        this.rowHeightDirty = true;
        this.scrollTop = vp.scrollTop;
        this.scrollInline = Math.abs(vp.scrollLeft);
        this.measureChrome();
        this.update();
    }

    private unbind(): void {
        this.viewportObserver?.disconnect();
        this.viewportObserver = null;
        this.unwatchRows();
        this.viewport = null;
    }

    private watchChrome(): void {
        const vp = this.viewport;
        if (!vp || !this.viewportObserver) return;
        for (const el of [vp, ...vp.querySelectorAll<HTMLElement>('[data-slot="table-header"], [data-slot="table-footer"]')]) this.viewportObserver.observe(el);
    }

    /** Reads the sizes the window depends on: scroller, sticky header and footer, pinned stacks, widths of non-pixel columns. */
    private measureChrome(): void {
        const vp = this.viewport;
        if (!vp) return;
        this.measureDirty = false;
        this.watchChrome();
        const rect = (selector: string): number => vp.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;
        let pinStart = 0;
        let pinEnd = 0;
        // Only the drawn heads can be read: a windowed-out column keeps the width it had, unless it no longer exists.
        const keys = new Set(requireProvider(this.host, 'columns').enhancedColumns().map((c) => String(c.accessorKey)));
        this.measuredWidths = new Map([...this.measuredWidths].filter(([key]) => keys.has(key)));
        for (const head of vp.querySelectorAll<HTMLElement>('[data-slot="table-head"][data-column-id]')) {
            const width = head.getBoundingClientRect().width;
            const pin = head.dataset['pinned'];
            if (pin === 'left') pinStart += width;
            else if (pin === 'right') pinEnd += width;
            else this.measuredWidths.set(head.dataset['columnId'] as string, width);
        }
        const next: Chrome = { viewH: vp.clientHeight, viewW: vp.clientWidth, headH: rect('[data-slot="table-header"]'), footH: rect('[data-slot="table-footer"]'), pinStart, pinEnd };
        const style = this.host.root.style;
        style.setProperty('--ge-dt-head-h', `${next.headH}px`);
        style.setProperty('--ge-dt-foot-h', `${next.footH}px`);
        style.setProperty('--ge-dt-pin-start-w', `${next.pinStart}px`);
        style.setProperty('--ge-dt-pin-end-w', `${next.pinEnd}px`);
        this.chrome = next;
        this.rowHeightDirty = true;
    }

    // ---- variable heights -------------------------------------------------------------------------------------------------

    private watchRows(): void {
        const body = this.viewport?.querySelector(BODY);
        if (!body || this.rowObserver || typeof ResizeObserver === 'undefined') return;
        this.rowObserver = new ResizeObserver((entries) =>
            this.applyHeights(entries.map((e) => ({ ...this.addressOf(e.target as HTMLElement), height: e.borderBoxSize[0]?.blockSize ?? e.contentRect.height }))),
        );
        this.bodyObserver = new MutationObserver(() => this.observeRows());
        this.bodyObserver.observe(body, { childList: true });
        this.observeRows();
    }

    private unwatchRows(): void {
        this.rowObserver?.disconnect();
        this.bodyObserver?.disconnect();
        this.rowObserver = this.bodyObserver = null;
        this.observed.clear();
    }

    private rowElements(): HTMLElement[] {
        return [...(this.viewport?.querySelectorAll<HTMLElement>(`${BODY} > ${ROW}[data-kind="data"], ${BODY} > ${ROW}[data-kind="detail"]`) ?? [])];
    }

    private observeRows(): void {
        const rows = this.rowElements();
        for (const el of this.observed) {
            if (el.isConnected) continue;
            this.rowObserver?.unobserve(el);
            this.observed.delete(el);
        }
        for (const el of rows) {
            if (this.observed.has(el)) continue;
            this.observed.add(el);
            this.rowObserver?.observe(el);
        }
    }

    /** Which item a drawn row is: a data row by `data-row-index`, a detail row by the `data-detail-for` of its data row. */
    private addressOf(el: HTMLElement): { index: number; detail: boolean } {
        const detail = el.dataset['kind'] === 'detail';
        return { index: Number(detail ? el.dataset['detailFor'] : el.dataset['rowIndex']), detail };
    }

    private readRows(): Measurement[] {
        return this.rowElements().map((el) => ({ ...this.addressOf(el), height: el.getBoundingClientRect().height }));
    }

    /**
     * Stores measured heights. A row that ends above the first visible row and changed shifts everything below it, so the
     * scroller moves by the same amount (Angular's rule; the scroller has `overflow-anchor: none` so the browser adds no
     * correction of its own). The first visible row is read from the prefix sums as they were before this batch.
     */
    private applyHeights(measurements: readonly Measurement[]): void {
        const vp = this.viewport;
        if (!vp || !this.variable) return;
        const first = firstRowAt(vp.scrollTop, this.rowHeight, this.total, this.prefix ?? undefined);
        let shift = 0;
        let changed = false;
        for (const m of measurements) {
            if (!Number.isInteger(m.index)) continue;
            const known = this.heights.get(m.index) ?? { row: this.rowHeight, detail: 0 };
            const before = known.row + known.detail;
            const next = m.detail ? { row: known.row, detail: m.height } : { row: m.height, detail: known.detail };
            if (!heightChanged(before, next.row + next.detail)) continue;
            this.heights.set(m.index, next);
            const id = this.idOf(this.source?.[m.index]);
            if (id !== undefined) this.byId.set(id, next);
            this.prefixDirty = changed = true;
            if (m.index < first) shift += next.row + next.detail - before;
        }
        if (!changed) return;
        if (shift !== 0) {
            vp.scrollTop += shift;
            this.scrollTop = vp.scrollTop;
        }
        this.schedule();
    }

    /** `refresh()`: reads the scroller, the row heights of the drawn rows and the column widths again. */
    private measure(): void {
        this.bind();
        if (!this.viewport) return;
        this.scrollTop = this.viewport.scrollTop;
        this.scrollInline = Math.abs(this.viewport.scrollLeft);
        this.measureChrome();
        this.readRowHeight();
        // Heights already measured stay (the unmeasured rows follow the new row height): clearing them would move the scroll position.
        if (this.variable) {
            this.prefixDirty = true;
            this.applyHeights(this.readRows());
        }
        this.update();
    }

    // ---- retained rows, scrolling ----------------------------------------------------------------------------------------

    private retain(owner: string, rows: readonly number[]): void {
        const had = this.retained.get(owner);
        if (rows.length === 0) this.retained.delete(owner);
        else this.retained.set(owner, [...rows]);
        const same = (had?.length ?? 0) === rows.length && (had ?? []).every((row, i) => row === rows[i]);
        if (!same) this.update();
    }

    private topOfRow(index: number): number | undefined {
        const body = this.viewport?.querySelector(BODY);
        if (this.activeNow) return scrollTopForRow(Math.min(Math.max(0, index), Math.max(0, this.total - 1)), this.rowHeight, this.ensurePrefix());
        const row = this.host.rowAt(index);
        // The sticky header takes the first `headH` of the content, so a row at `top` below the body's start is scrolled to `top`.
        return row && body ? row.getBoundingClientRect().top - body.getBoundingClientRect().top : undefined;
    }

    /** Where column `key` starts among the scrolling columns, or undefined for a pinned or unknown one. */
    private startOfColumn(key: string): number | undefined {
        const columns = requireProvider(this.host, 'columns').enhancedColumns();
        const n = columns.findIndex((c) => String(c.accessorKey) === key);
        const column = columns[n];
        if (!column || column._pin !== undefined) return undefined;
        let offset = 0;
        for (const c of columns) {
            if (c === column) break;
            if (c._pin === undefined) offset += this.widthOf(c);
        }
        return offset;
    }

    private isRtl(): boolean {
        return this.viewport !== null && getComputedStyle(this.viewport).direction === 'rtl';
    }

    /** Scrolls to `top` and `inline` (either may be undefined: leave that axis), clamped, and draws the new window now. */
    private moveTo(top: number | undefined, inline: number | undefined): void {
        const vp = this.viewport;
        if (!vp) return;
        const options: ScrollToOptions = { behavior: 'instant' };
        if (top !== undefined) options.top = clampScroll(top, vp.scrollHeight - vp.clientHeight);
        if (inline !== undefined) options.left = (this.isRtl() ? -1 : 1) * clampScroll(inline, vp.scrollWidth - vp.clientWidth);
        vp.scrollTo(options);
        this.scrollTop = vp.scrollTop;
        this.scrollInline = Math.abs(vp.scrollLeft);
        this.update();
    }

    /** The minimal scroll that brings the cell inside the area the viewport really shows, clear of header, footer and pinned columns. */
    private reveal(rowIndex: number, columnKey?: string): void {
        const vp = this.viewport;
        if (!vp) return;
        const { headH, footH, pinStart, pinEnd } = this.chrome;
        let top = vp.scrollTop;
        const current = Math.abs(vp.scrollLeft); // live: the cached offset is stale until the frame after a scroll
        const rowTop = this.activeNow ? this.rowTopIn(rowIndex) : this.rowRectIn(rowIndex);
        if (rowTop) top = revealOffset(headH + rowTop.top, headH + rowTop.top + rowTop.size, vp.scrollTop, vp.clientHeight, headH, footH);
        let inline: number | undefined;
        const columns = requireProvider(this.host, 'columns').enhancedColumns();
        const column = columns.find((c) => String(c.accessorKey) === columnKey);
        if (column && column._pin === undefined) {
            const at = this.activeNow ? this.startOfColumn(String(column.accessorKey)) : this.columnRectIn(String(column.accessorKey), rowIndex);
            if (at !== undefined) {
                const x = this.activeNow ? pinStart + at : at;
                const width = this.activeNow ? this.widthOf(column) : (this.measuredWidths.get(String(column.accessorKey)) ?? this.widthOf(column));
                inline = revealOffset(x, x + width, current, vp.clientWidth, pinStart, pinEnd);
            }
        }
        if (top !== vp.scrollTop || (inline !== undefined && inline !== current)) this.moveTo(top, inline);
    }

    private rowTopIn(index: number): { top: number; size: number } | null {
        if (index < 0 || index >= this.total) return null;
        const prefix = this.ensurePrefix();
        const top = prefix ? (prefix[index] ?? 0) : index * this.rowHeight;
        const detail = this.heights.get(index)?.detail ?? 0;
        return { top, size: (prefix ? (prefix[index + 1] ?? top) - top - detail : this.rowHeight) };
    }

    private rowRectIn(index: number): { top: number; size: number } | null {
        const row = this.host.rowAt(index);
        const body = this.viewport?.querySelector(BODY);
        if (!row || !body) return null;
        const rect = row.getBoundingClientRect();
        return { top: rect.top - body.getBoundingClientRect().top, size: rect.height };
    }

    /** Distance of a drawn column from the start of the scrolling columns, from the DOM (every column is drawn when not windowed). */
    private columnRectIn(key: string, rowIndex: number): number | undefined {
        const cell = this.host.cellAt(rowIndex, key) ?? this.viewport?.querySelector<HTMLElement>(`[data-slot="table-head"][data-column-id="${CSS.escape(key)}"]`);
        const table = this.viewport?.querySelector('[data-slot="table"]');
        if (!cell || !table) return undefined;
        const c = cell.getBoundingClientRect();
        const t = table.getBoundingClientRect();
        return this.isRtl() ? t.right - c.right : c.left - t.left;
    }
}
