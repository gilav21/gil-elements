/**
 * What each copy scope puts on the clipboard, as a grid of cell strings (wave 6, package B), and the one text-field test of the clipboard keys and
 * events. The grids are pure: the rows and columns come from the query and
 * columns services, never from the DOM, so a range larger than the virtual window copies every row and a custom-element cell copies its column's
 * text (`cellText`: the `cell` formatter, else the value stringified). `toClipboardText` (tabs, quotes, the formula guard) turns a grid into the TSV.
 * Angular: `copyCellToClipboard`, `copyRowToClipboard`, `copySelectedToClipboard`, `copyCellRangeToClipboard`, `copyAllToClipboard`, `handleCopyKeydown`.
 */
import { cellText } from './data-table-cells.js';
import { type CellAddress, type DataTableCoreHost, isTextFieldKey, ownClosest, ownsTarget, VIEWPORT } from './data-table-host.js';
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
        default: {
            // A header with no data row under it is nothing to copy (`empty`, like the other scopes), not a header-only clipboard.
            const all = source.exportAll();
            return all.length > 1 ? all : null;
        }
    }
}

/** What Ctrl/Cmd+C copies (Angular's precedence): the range, else the focused cell, else the selected rows; null when nothing is copyable. */
export function keyboardCopyGrid<T>(source: CopySource<T>): string[][] | null {
    return rangeGrid(source) ?? cellGrid(source) ?? selectedGrid(source);
}

/** The number of cells a grid holds (what the announcement counts). */
export const gridCells = (grid: readonly (readonly string[])[]): number => grid.reduce((sum, cells) => sum + cells.length, 0);

/** A body DATA cell of the table (it has a column). */
export const CELL_SELECTOR = '[data-slot="table-cell"][data-column]'; // a DATA cell: a detail, group or full-width cell has no column

/**
 * The user selected TEXT over what the grid would copy (a non-collapsed selection that intersects one of `cells`: the focused cell, the cells in the
 * range): a copy is then the browser's copy of that text, not the grid's (Ctrl/Cmd+C and the native `copy` event alike). A stale selection elsewhere on
 * the page, or over other cells, does not stop the grid's copy.
 */
export function selectsGridText(root: Element, cells: readonly Element[]): boolean {
    const selection = root.ownerDocument?.getSelection?.(); // (a host without a document, a node test's, has no selection)
    if (!selection || selection.isCollapsed || cells.length === 0) return false;
    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        if (!range.collapsed && cells.some((cell) => range.intersectsNode(cell))) return true;
    }
    return false;
}

/**
 * A grid key (the clipboard's Ctrl/Cmd+C / V, the range keys, the row move): typed on a body cell of THIS table or on its viewport or root (the roving
 * focus, a grid with nothing focused), never in a text field (`isTextFieldKey`, the host's one rule). A header control, the readout's button, a toolbar or
 * pager control keep their keys.
 */
export function onGrid(root: Element, event: Event): boolean {
    const target = event.target as Element | null;
    if (!target || !ownsTarget(root, target) || isTextFieldKey(root, event)) return false;
    return target === root || target.matches?.(VIEWPORT) === true || ownClosest(root, target, CELL_SELECTOR) !== null;
}

/**
 * A native `copy` / `paste` event is this table's: it landed on one of its cells, or it landed OUTSIDE the table (the browser's menu, a target the page
 * chose) while the focus is on an element of THIS table (not of a table nested in it). An event inside the table but not on its cells (a header, a
 * nested table) is not.
 */
export function clipboardEventForGrid(root: Element, event: Event): boolean {
    const target = event.target as Node | null;
    if (ownClosest(root, target, CELL_SELECTOR)) return true;
    if (target === null || root.contains(target)) return false;
    // The element with the focus in the tree the table lives in (the document, or the shadow root that holds it): a consumer component's focused
    // inner element shows as its host there. It must be THIS table's own, not a table nested in one of its detail rows.
    const tree = root.getRootNode?.() as Document | ShadowRoot | undefined;
    const active = tree?.activeElement ?? null;
    return active !== null && ownsTarget(root, active);
}

/** Where a paste starts: the TOP-LEFT cell of the range when there is one (however it was made: dragged from its bottom-right too), else the focused cell. */
export function pasteStart<T>(host: DataTableCoreHost<T>): CellAddress | null {
    const range = host.provider('range');
    const rect = range?.active() ? range.normalized() : null;
    const key = rect ? host.provider('columns')?.navigableKeys()[rect.minCol] : undefined;
    if (rect && key !== undefined) return { rowIndex: rect.minRow, columnKey: key };
    return host.provider('interaction')?.focusedCell() ?? null;
}

/** An editor is open somewhere in the table (the one test the clipboard controller and the paste part share). */
export const editorOpen = <T>(host: DataTableCoreHost<T>): boolean => host.provider('interaction')?.editingCell?.() != null;
