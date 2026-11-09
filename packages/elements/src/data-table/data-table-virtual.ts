/**
 * Virtual-scroll window maths for rows and columns. Pure.
 *
 * Every window covers EVERY item that intersects `[scroll, scroll + viewport)`: the end is found by walking item edges
 * up to the viewport's far edge, never by summing sizes from the first item's top, or a half-hidden first item would
 * use up viewport and drop the last visible one. Buffers widen a window on each side; a scroll past the end gives
 * `start == end == total`, never `start > end`.
 *
 * Variable row heights use prefix sums here rather than `virtual-scroll/virtual-axis.ts`; whether the axis can replace
 * them is decided with the virtual controller.
 */
import type { VirtualAutoThreshold } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

export interface RowRange {
    readonly start: number;
    readonly end: number;
}

export interface ColumnRange extends RowRange {
    readonly paddingLeft: number;
    readonly paddingRight: number;
}

export interface VariableRowRange extends RowRange {
    readonly paddingTop: number;
    readonly paddingBottom: number;
}

/** Non-finite or negative input reads as 0 so a layout glitch cannot produce a NaN window. */
const safe = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/** The window of fixed-height rows to render. */
export function computeRowRange(scrollTop: number, viewportHeight: number, rowHeight: number, totalRows: number, buffer: number): RowRange {
    if (!(totalRows > 0) || !(rowHeight > 0)) return { start: 0, end: 0 };
    const top = safe(scrollTop);
    const buf = Math.floor(safe(buffer));
    // Measured from scrollTop, not from the first row's top edge (see the module note).
    const startRow = Math.floor(top / rowHeight);
    const endRow = Math.ceil((top + safe(viewportHeight)) / rowHeight);
    return {
        start: Math.min(totalRows, Math.max(0, startRow - buf)),
        end: Math.min(totalRows, endRow + buf),
    };
}

/** The first index whose far edge is past `scroll`, with that item's leading edge; `length` when none. */
function firstVisible(sizeAt: (i: number) => number, length: number, scroll: number): { index: number; offset: number } {
    let offset = 0;
    for (let i = 0; i < length; i++) {
        const size = sizeAt(i);
        if (offset + size > scroll) return { index: i, offset };
        offset += size;
    }
    return { index: length, offset };
}

/** The window of columns to render; the paddings are the widths of the columns left out on each side. */
export function computeColumnRange(scrollLeft: number, viewportWidth: number, columnWidths: readonly number[], buffer: number): ColumnRange {
    const total = columnWidths.length;
    if (total === 0) return { start: 0, end: 0, paddingLeft: 0, paddingRight: 0 };
    const width = (i: number): number => safe(columnWidths[i] ?? 0);
    const left = safe(scrollLeft);
    const buf = Math.floor(safe(buffer));

    const first = firstVisible(width, total, left);
    const viewportEnd = left + safe(viewportWidth);
    let end = first.index;
    for (let edge = first.offset; end < total && edge < viewportEnd; end++) edge += width(end);

    const start = Math.max(0, first.index - buf);
    const bufferedEnd = Math.min(total, end + buf);
    let paddingLeft = 0;
    for (let i = 0; i < start; i++) paddingLeft += width(i);
    let paddingRight = 0;
    for (let i = bufferedEnd; i < total; i++) paddingRight += width(i);
    return { start, end: bufferedEnd, paddingLeft, paddingRight };
}

/** `sums[i]` is the top edge of row `i`; `sums[total]` is the full height. */
export function buildPrefixSums(getRowHeight: (index: number) => number, totalRows: number): Float64Array {
    const sums = new Float64Array(Math.max(0, totalRows) + 1);
    for (let i = 0; i < totalRows; i++) sums[i + 1] = (sums[i] ?? 0) + safe(getRowHeight(i));
    return sums;
}

/** Number of rows whose far edge is at or before `target` (binary search). */
function rowsEndingBefore(sums: Float64Array, target: number, totalRows: number): number {
    let lo = 0;
    let hi = totalRows;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if ((sums[mid + 1] ?? 0) <= target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * The window of variable-height rows. Uses `prefixSums` when it matches `totalRows` (O(log n)), else walks
 * `getRowHeight`.
 */
export function computeVariableRowRange(
    scrollTop: number,
    viewportHeight: number,
    getRowHeight: (index: number) => number,
    totalRows: number,
    buffer: number,
    prefixSums?: Float64Array,
): VariableRowRange {
    if (!(totalRows > 0)) return { start: 0, end: 0, paddingTop: 0, paddingBottom: 0 };
    const sums = prefixSums?.length === totalRows + 1 ? prefixSums : buildPrefixSums(getRowHeight, totalRows);
    const top = safe(scrollTop);
    const bottom = top + safe(viewportHeight);
    const buf = Math.floor(safe(buffer));

    const startRow = rowsEndingBefore(sums, top, totalRows);
    let endRow = startRow;
    if (startRow < totalRows) {
        endRow = rowsEndingBefore(sums, bottom, totalRows);
        // The row at `endRow` starts before the viewport's far edge, so it is partly visible.
        if ((sums[endRow] ?? 0) < bottom && endRow < totalRows) endRow++;
    }
    const start = Math.max(0, startRow - buf);
    const end = Math.min(totalRows, endRow + buf);
    return {
        start,
        end,
        paddingTop: sums[start] ?? 0,
        paddingBottom: (sums[totalRows] ?? 0) - (sums[end] ?? 0),
    };
}

/** The scroll offset that puts row `index` at the top edge. */
export function scrollTopForRow(index: number, rowHeight: number, prefixSums?: Float64Array): number {
    if (prefixSums && index >= 0 && index < prefixSums.length) return prefixSums[index] ?? 0;
    return Math.max(0, index) * rowHeight;
}

/** The scroll offset that puts column `index` at the leading edge (the sum of the widths before it). */
export function scrollLeftForColumn(index: number, columnWidths: readonly number[]): number {
    let offset = 0;
    for (let i = 0; i < index && i < columnWidths.length; i++) offset += columnWidths[i] ?? 0;
    return offset;
}

/**
 * Whether the table windows its rows. `false` never; `'auto'` only when no pager is in play and the data crosses the
 * threshold in rows or in scrollable columns; `true` always (even beside a pager, which is then inert).
 */
export function isVirtualScrollActive(
    mode: boolean | 'auto',
    pagerActive: boolean,
    totalRows: number,
    scrollableColumns: number,
    threshold: VirtualAutoThreshold,
): boolean {
    if (mode === false) return false;
    if (mode === true) return true;
    if (pagerActive) return false;
    return totalRows > threshold.rows || scrollableColumns > threshold.columns;
}

/** The floor for a data column that sets no `minWidth`. */
export const DEFAULT_COLUMN_MIN_WIDTH = '80px';

/** A column's `minWidth`, else the default floor; the table's own control columns carry their own width (`0px`). */
export function resolveColumnMinWidth(col: { accessorKey?: PropertyKey; minWidth?: string }): string {
    if (col.minWidth) return col.minWidth;
    const key = String(col.accessorKey);
    return isSpecialColumnKey(key) ? '0px' : DEFAULT_COLUMN_MIN_WIDTH;
}

/** A CSS length in pixels: `px`, `rem` and `em` (against `rootPx`) or a bare number; anything else (`%`, `calc()`) is unknown. */
function lengthToPx(length: string, rootPx: number): number | null {
    const match = /^\s*(-?\d*\.?\d+)\s*(px|rem|em)?\s*$/.exec(length);
    if (!match) return null;
    const value = Number(match[1]);
    return match[2] === 'rem' || match[2] === 'em' ? value * rootPx : value;
}

/** The root element's font size in px, what a `rem` width or minimum is relative to (16 when it cannot be read). */
export function rootFontPx(el: Element): number {
    const { ownerDocument } = el;
    return Number.parseFloat(ownerDocument.defaultView?.getComputedStyle(ownerDocument.documentElement).fontSize ?? '') || 16;
}

/** The pixel floor resize and auto-fit clamp to: `minWidth` in px or rem, else the default floor. */
export function columnMinWidthPx(col: { accessorKey?: PropertyKey; minWidth?: string }, rootPx = 16): number {
    return lengthToPx(resolveColumnMinWidth(col), rootPx) ?? Number.parseFloat(DEFAULT_COLUMN_MIN_WIDTH);
}

// ---- the window of a whole body (rows, columns, retained rows) ---------------------------------------------------------

export interface BodyWindowInput {
    /** Rows of the list the window slices. */
    total: number;
    scrollTop: number;
    viewportHeight: number;
    /** Fixed row height, or the estimate of unmeasured rows when `prefix` is given. */
    rowHeight: number;
    /** Top edge of every row (`sums[total]` is the full height), for variable heights. */
    prefix?: Float64Array;
    rowBuffer: number;
    /** Columns of the table, pinned or not. */
    columnCount: number;
    /** Absolute index of the first non-pinned column. */
    middleFirst: number;
    /** Widths of the non-pinned columns, in drawn order. */
    middleWidths: readonly number[];
    /** Distance scrolled from the inline-start edge (the absolute `scrollLeft`, so right-to-left reads like left-to-right). */
    scrollInline: number;
    viewportWidth: number;
    columnBuffer: number;
    /** Rows kept drawn outside the window, by owner. */
    retained: Iterable<Iterable<number>>;
}

export interface BodyWindowShape {
    start: number;
    end: number;
    padStart: number;
    padEnd: number;
    colPadStart: number;
    colPadEnd: number;
    colStart: number;
    colEnd: number;
    retained: readonly number[];
}

/** Rows that stay drawn for their owners: absolute, ascending, existing, and not already inside `start..end`. */
export function retainedRows(owners: Iterable<Iterable<number>>, start: number, end: number, total: number): number[] {
    const out = new Set<number>();
    for (const rows of owners) for (const row of rows) if (Number.isInteger(row) && row >= 0 && row < total && (row < start || row >= end)) out.add(row);
    return [...out].sort((a, b) => a - b);
}

/** What the body draws for a scroll position: a row window with its padding, a window of the middle columns, the retained rows. */
export function computeBodyWindow(i: BodyWindowInput): BodyWindowShape {
    const total = Math.max(0, Math.floor(i.total));
    let start: number;
    let end: number;
    let padStart: number;
    let padEnd: number;
    if (i.prefix) {
        const r = computeVariableRowRange(i.scrollTop, i.viewportHeight, () => i.rowHeight, total, i.rowBuffer, i.prefix);
        ({ start, end } = r);
        padStart = r.paddingTop;
        padEnd = r.paddingBottom;
    } else {
        ({ start, end } = computeRowRange(i.scrollTop, i.viewportHeight, i.rowHeight, total, i.rowBuffer));
        padStart = start * i.rowHeight;
        padEnd = (total - end) * i.rowHeight;
    }
    const range = computeColumnRange(i.scrollInline, i.viewportWidth, i.middleWidths, i.columnBuffer);
    const whole = range.start === 0 && range.end === i.middleWidths.length;
    return {
        start,
        end,
        padStart,
        padEnd,
        colPadStart: range.paddingLeft,
        colPadEnd: range.paddingRight,
        colStart: whole ? 0 : i.middleFirst + range.start,
        colEnd: whole ? i.columnCount : i.middleFirst + range.end,
        retained: retainedRows(i.retained, start, end, total),
    };
}

export function sameWindow(a: BodyWindowShape, b: BodyWindowShape): boolean {
    return (
        a.start === b.start &&
        a.end === b.end &&
        a.colStart === b.colStart &&
        a.colEnd === b.colEnd &&
        a.padStart === b.padStart &&
        a.padEnd === b.padEnd &&
        a.colPadStart === b.colPadStart &&
        a.colPadEnd === b.colPadEnd &&
        a.retained.length === b.retained.length &&
        a.retained.every((row, n) => row === b.retained[n])
    );
}

// ---- scrolling to a target ---------------------------------------------------------------------------------------------

/**
 * The scroll offset that brings `[start, end)` (content coordinates) inside the band the viewport really shows, which is
 * the viewport minus `lead` (the sticky header, the pinned columns before) and `trail` (the footer, the pinned columns
 * after), moving as little as possible: unchanged when it already fits, aligned to the near edge otherwise. An item
 * larger than the band is aligned at its start.
 */
export function revealOffset(start: number, end: number, scroll: number, viewport: number, lead: number, trail: number): number {
    if (start < scroll + lead) return Math.max(0, start - lead);
    const bottom = scroll + viewport - trail;
    if (end > bottom) return Math.max(0, Math.min(start - lead, end - viewport + trail));
    return scroll;
}

/** `value` kept within `[0, max]`; a non-finite value reads as 0. */
export const clampScroll = (value: number, max: number): number => Math.min(Math.max(0, Number.isFinite(value) ? value : 0), Math.max(0, max));

/** The first row whose far edge is past `scroll`: the first one the viewport shows (`total` when none). */
export function firstRowAt(scroll: number, rowHeight: number, total: number, prefix?: Float64Array): number {
    if (prefix) return rowsEndingBefore(prefix, scroll, total);
    return rowHeight > 0 ? Math.min(total, Math.floor(Math.max(0, scroll) / rowHeight)) : 0;
}

/** The `px` of a computed custom property or length, or null when it is not a plain pixel number. */
export function parsePx(value: string): number | null {
    const match = /^\s*(-?\d*\.?\d+)px\s*$/.exec(value);
    return match ? Number(match[1]) : null;
}

/** Whether a height changed enough to be a measurement and not layout noise (page zoom rounds to fractions of a pixel). */
export const heightChanged = (from: number, to: number): boolean => Math.abs(to - from) >= 0.5;

/** Where retained rows sit (px from the top of the body), by window object; read by the row renderer. */
const retainedTops = new WeakMap<object, ReadonlyMap<number, number>>();

export function setRetainedTops(window: object, tops: ReadonlyMap<number, number>): void {
    retainedTops.set(window, tops);
}

/** The offset of retained row `index` for the window the renderer was given (0 when unknown). */
export const retainedTopOf = (window: object, index: number): number => retainedTops.get(window)?.get(index) ?? 0;

/**
 * Whether the drawn rows `current` still cover the rows the viewport shows (`tight`, a window with no buffer) with at
 * least `margin` spare rows on each side (or the list's edge), so a small scroll does not redraw.
 */
export function windowCovers(current: { start: number; end: number }, tight: { start: number; end: number }, margin: number, total: number): boolean {
    return (current.start === 0 || current.start <= tight.start - margin) && (current.end === total || current.end >= tight.end + margin);
}
