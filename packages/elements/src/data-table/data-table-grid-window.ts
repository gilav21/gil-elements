/**
 * The view of what is drawn out of the whole list (the window) and of where focus is, and the helpers the row and head
 * renderers use to draw only the windowed columns. Package B (window and focus) owns this file. Without a virtual
 * controller the window is the whole list and there is no padding.
 */
import { html, type TemplateResult } from 'lit';
import { type CellAddress, requireProvider } from './data-table-host.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { BodyWindow, EnhancedColumnDef } from './data-table.types.js';

export interface WindowView {
    window: BodyWindow;
    /**
     * Rows of the whole dataset under virtual scroll, for `aria-rowcount`; null: the rows view already counts the whole
     * list there (the window slices the list it draws from, it does not page it), details included.
     */
    virtualTotalRows: number | null;
    focusedCell: CellAddress | null;
    /** The viewport is the tab stop: no drawn cell holds the roving tabindex. */
    viewportTabbable: boolean;
}

/** Every row and every column, no padding. */
function fullWindow(rows: number, columns: number): BodyWindow {
    return { start: 0, end: rows, padStart: 0, padEnd: 0, colPadStart: 0, colPadEnd: 0, colStart: 0, colEnd: columns, retained: [] };
}

/** A column outside `colStart..colEnd` is not drawn, unless it is pinned: those always are. */
const columnDrawn = <T>(c: EnhancedColumnDef<T>, n: number, w: BodyWindow): boolean => c._pin !== undefined || (n >= w.colStart && n < w.colEnd);

/** Whether the cell is in the DOM: its row inside the window or retained, its column drawn. */
export function cellDrawn<T>(cell: CellAddress, columns: readonly EnhancedColumnDef<T>[], w: BodyWindow, rowCount: number): boolean {
    const n = columns.findIndex((c) => String(c.accessorKey) === cell.columnKey);
    if (n === -1 || cell.rowIndex < 0 || cell.rowIndex >= rowCount) return false;
    const rowDrawn = (cell.rowIndex >= w.start && cell.rowIndex < w.end) || w.retained.includes(cell.rowIndex);
    return rowDrawn && columnDrawn(columns[n] as EnhancedColumnDef<T>, n, w);
}

export function windowView<T>(host: DataTableViewHost<T>): WindowView {
    const query = requireProvider(host, 'query');
    const columns = requireProvider(host, 'columns').enhancedColumns();
    const rows = query.displayRows().length;
    const window = host.provider('virtual')?.window() ?? fullWindow(rows, columns.length);
    const focusedCell = host.provider('interaction')?.focusedCell() ?? null;
    return {
        window,
        virtualTotalRows: null,
        focusedCell,
        viewportTabbable: focusedCell === null || !cellDrawn(focusedCell, columns, window, rows),
    };
}

/** One entry of a row's column list: a cell at its absolute position `n`, or the stand-in for the columns left out. */
export type ColumnPart<T> = { column: EnhancedColumnDef<T>; n: number } | { spacer: 'start' | 'end' };

/**
 * The columns a head, body or footer row draws, in DOM order: pinned and windowed ones with their ABSOLUTE position
 * `n` (the key of `--ge-dt-col-N`, `aria-colindex`), and a spacer where middle columns were left out (see `columnSpacer`).
 */
export function columnParts<T>(columns: readonly EnhancedColumnDef<T>[], w: BodyWindow): ColumnPart<T>[] {
    const parts: ColumnPart<T>[] = [];
    let startDone = w.colPadStart <= 0;
    columns.forEach((column, n) => {
        if (!columnDrawn(column, n, w)) return;
        if (!startDone && column._pin !== 'left') {
            parts.push({ spacer: 'start' });
            startDone = true;
        }
        parts.push({ column, n });
    });
    if (!startDone) parts.push({ spacer: 'start' });
    if (w.colPadEnd > 0) {
        const at = parts.findIndex((p) => 'column' in p && p.column._pin === 'right');
        parts.splice(at === -1 ? parts.length : at, 0, { spacer: 'end' });
    }
    return parts;
}

/** The inline-size stand-in for the middle columns left out at one edge; its size is a custom property on the table. */
export const columnSpacer = (edge: 'start' | 'end'): TemplateResult => html`<div data-slot="data-table-spacer" data-edge=${edge} aria-hidden="true"></div>`;
