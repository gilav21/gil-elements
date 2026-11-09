/**
 * The view of what is drawn out of the whole list (the window) and of where focus is. Package B (window and focus) owns
 * this file. Without a virtual controller the window is the whole list and there is no padding.
 */
import { requireProvider, type CellAddress } from './data-table-host.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { BodyWindow } from './data-table.types.js';

export interface WindowView {
    window: BodyWindow;
    /** Rows of the whole dataset under virtual scroll (plus measured details), for `aria-rowcount`; null when not windowed. */
    virtualTotalRows: number | null;
    focusedCell: CellAddress | null;
    /** The viewport is the tab stop: no cell holds the roving tabindex. */
    viewportTabbable: boolean;
}

/** Every row and every column, no padding. */
function fullWindow(rows: number, columns: number): BodyWindow {
    return { start: 0, end: rows, padStart: 0, padEnd: 0, colPadStart: 0, colPadEnd: 0, colStart: 0, colEnd: columns, retained: [] };
}

export function windowView<T>(host: DataTableViewHost<T>): WindowView {
    const virtual = host.provider('virtual');
    const columns = requireProvider(host, 'columns').enhancedColumns().length;
    const focusedCell = host.provider('interaction')?.focusedCell() ?? null;
    return {
        window: virtual?.window() ?? fullWindow(requireProvider(host, 'query').displayRows().length, columns),
        virtualTotalRows: null,
        focusedCell,
        viewportTabbable: focusedCell === null,
    };
}
