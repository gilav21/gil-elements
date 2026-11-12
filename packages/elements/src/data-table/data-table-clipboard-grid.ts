/**
 * What each copy scope puts on the clipboard, as a grid of cell strings (wave 6, package B), and the one text-field test of the clipboard keys and
 * events. The grids are pure: the rows and columns come from the query and
 * columns services, never from the DOM, so a range larger than the virtual window copies every row and a custom-element cell copies its column's
 * text (`cellText`: the `cell` formatter, else the value stringified). `toClipboardText` (tabs, quotes, the formula guard) turns a grid into the TSV.
 * Angular: `copyCellToClipboard`, `copyRowToClipboard`, `copySelectedToClipboard`, `copyCellRangeToClipboard`, `copyAllToClipboard`, `handleCopyKeydown`.
 */
import { cellText } from './data-table-cells.js';
import { ownClosest } from './data-table-host.js';
import type { NormalizedRange } from './data-table-range.js';
import type { ColumnDef } from './data-table.types.js';

export type CopyScope = 'cell' | 'row' | 'selected' | 'range' | 'all';

/** What a grid is built from: the services' answers, read at copy time. */
export interface CopySource<T> {
    /** The visible data columns in drawn order (no selection, expander or action column). */
    columns: readonly ColumnDef<T>[];
    /** The column keys a range addresses (`navigableKeys`). */
    navigableKeys: readonly string[];
    /** A drawn row by its index (`renderedRowAt`), also past the virtual window. */
    rowAt(rowIndex: number): T | undefined;
    /** The focused cell, if any. */
    focused: { rowIndex: number; columnKey: string } | null;
    /** The normalised range, only while the range part is active; null otherwise. */
    range: NormalizedRange | null;
    /** Every row across pages in DRAWN order (grouped: group by group, collapsed groups included). */
    drawnRows(): readonly T[];
    isSelected(row: T): boolean;
    /** Header plus every filtered row, ignoring paging and selection (`exportData`). */
    exportAll(): string[][];
}

const columnOf = <T>(columns: readonly ColumnDef<T>[], key: string): ColumnDef<T> | undefined => columns.find((c) => String(c.accessorKey) === key);

/** The focused cell as a 1x1 grid; null with no focused cell (or one whose row or column is gone). */
export function cellGrid<T>(source: CopySource<T>): string[][] | null {
    const { focused } = source;
    const row = focused ? source.rowAt(focused.rowIndex) : undefined;
    const column = focused ? columnOf(source.columns, focused.columnKey) : undefined;
    return row !== undefined && column ? [[cellText(column, row)]] : null;
}

/** One row of its visible data columns, no header. */
export function rowGrid<T>(columns: readonly ColumnDef<T>[], row: T): string[][] {
    return [columns.map((c) => cellText(c, row))];
}

/** The selected rows with a header line, in drawn order across pages; null when none is selected. */
export function selectedGrid<T>(source: CopySource<T>): string[][] | null {
    const rows = source.drawnRows().filter((row) => source.isSelected(row));
    if (rows.length === 0) return null;
    return [source.columns.map((c) => c.header), ...rows.map((row) => source.columns.map((c) => cellText(c, row)))];
}

/** The range rectangle, no header, cells in drawn column order, rows that do not exist skipped; null without a range. */
export function rangeGrid<T>(source: CopySource<T>): string[][] | null {
    const { range } = source;
    if (!range) return null;
    const columns = source.navigableKeys.slice(range.minCol, range.maxCol + 1).map((key) => columnOf(source.columns, key));
    const grid: string[][] = [];
    for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = source.rowAt(r);
        if (row !== undefined) grid.push(columns.map((c) => (c ? cellText(c, row) : '')));
    }
    return grid.length > 0 ? grid : null;
}

/** The grid of a scope (`row` takes the row to copy); null when there is nothing to copy. */
export function copyGrid<T>(scope: CopyScope, source: CopySource<T>, row?: T): string[][] | null {
    switch (scope) {
        case 'cell':
            return cellGrid(source);
        case 'row':
            return row === undefined ? null : rowGrid(source.columns, row);
        case 'selected':
            return selectedGrid(source);
        case 'range':
            return rangeGrid(source);
        default:
            return source.exportAll();
    }
}

/** What Ctrl/Cmd+C copies (Angular's precedence): the range, else the focused cell, else the selected rows; null when nothing is copyable. */
export function keyboardCopyGrid<T>(source: CopySource<T>): string[][] | null {
    return rangeGrid(source) ?? cellGrid(source) ?? selectedGrid(source);
}

/** The number of cells a grid holds (what the announcement counts). */
export const gridCells = (grid: readonly (readonly string[])[]): number => grid.reduce((sum, cells) => sum + cells.length, 0);

/** A body cell of the table. */
export const CELL_SELECTOR = '[data-slot="table-cell"]';
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * The event comes from a text field (an editor, a filter box, a detail-row input, one inside a consumer component's open shadow root): its copy and paste
 * are the browser's, never the grid's. The same test as the navigation keys: a field of this table (`ownClosest`), or the deepest node of the path.
 */
export function inTextField(root: Element, event: Event): boolean {
    return ownClosest(root, event.target, TEXT_FIELD) !== null || ((event.composedPath()[0] as Element | undefined)?.matches?.(TEXT_FIELD) ?? false);
}

/**
 * The user selected TEXT inside this table (a non-collapsed selection that starts or ends in it): a copy is then the browser's copy of that text, not the
 * grid's (Ctrl/Cmd+C and the native `copy` event alike).
 */
export function hasTextSelection(root: Element): boolean {
    const selection = root.ownerDocument?.getSelection?.(); // (a host without a document, a node test's, has no selection)
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
    const inside = (node: Node | null): boolean => node !== null && root.contains(node);
    return inside(selection.anchorNode) || inside(selection.focusNode);
}
