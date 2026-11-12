/**
 * Paste as a plan, then one write (wave 6, package B; reached only from the lazy paste part). Angular's `pasteGridAt` / `pasteCell` (cmp 2751-2793)
 * with two deliberate differences: every target row is resolved BEFORE the first write (`writeCells`; Angular re-reads `processedData()` after each
 * cell, so pasting into the sort column moves rows mid-paste, AB3), and a blank cell clears a number instead of writing 0 (`coercePasteValue`, D9 /
 * AB2). The whole paste is ONE `runAsCommand` (one undo step, one `data-change`); `edit-error` per rejected cell comes from the writer.
 */
import type { CellWriteRequest, CellWriteResult } from './data-table-cell-write.js';
import { coercePasteValue, parseClipboardGrid, planPaste } from './data-table-range.js';
import { type DataTableLocale, interpolate } from './data-table.locales.js';
import { restoreSpreadsheetText } from './data-table.spreadsheet.js';
import type { CellRange, CellsPasteEvent, ColumnDef } from './data-table.types.js';

export interface PasteSource<T> {
    /** The columns a paste may land in, in drawn order (`navigableKeys`). */
    navigableKeys: readonly string[];
    /** Drawn data rows: a paste never appends rows. */
    rowCount: number;
    rowAt(rowIndex: number): T | undefined;
    columnByKey(key: string): ColumnDef<T> | undefined;
    cellValue(row: T, column: ColumnDef<T>): unknown;
}

export interface PastePlan {
    /** The cells to write, rows and columns that exist and have a `valueSetter`, values coerced by the type of the value they replace. */
    requests: CellWriteRequest[];
    /** The `cells-paste` detail before the write (the counts are filled in from the results). */
    startRow: number;
    startColumn: string;
    rowsAffected: number;
    /** The rectangle the paste covered, inside the table (rows and columns trimmed); null when it covers no cell. */
    rect: CellRange | null;
}

/** The pasted text as cells, the formula guard of our own copy undone (`'=x` back to `=x`). */
export const pastedGrid = (text: string): string[][] => parseClipboardGrid(text).map((cells) => cells.map(restoreSpreadsheetText));

/**
 * Plans a paste of `grid` from (`startRow`, `startColumn`); null when nothing can happen: an empty grid, or a start column that is not navigable
 * (Angular is a no-op then, no event). Columns past the last navigable one are dropped by `planPaste`; rows past the last drawn row are skipped.
 */
export function planPasteRequests<T>(grid: readonly (readonly string[])[], startRow: number, startColumn: string, source: PasteSource<T>): PastePlan | null {
    const { navigableKeys, rowCount } = source;
    const startCol = navigableKeys.indexOf(startColumn);
    if (grid.length === 0 || startCol < 0) return null;
    const requests: CellWriteRequest[] = [];
    for (const target of planPaste(grid, startRow, startColumn, navigableKeys)) {
        if (target.rowIndex >= rowCount) continue;
        const row = source.rowAt(target.rowIndex);
        const column = source.columnByKey(target.columnKey);
        if (row === undefined || !column?.valueSetter) continue;
        requests.push({ target: { rowIndex: target.rowIndex, columnKey: target.columnKey }, value: coercePasteValue(target.raw, source.cellValue(row, column)) });
    }
    const width = Math.max(...grid.map((cells) => cells.length));
    const endRow = Math.min(startRow + grid.length, rowCount) - 1;
    const endCol = Math.min(startCol + width, navigableKeys.length) - 1;
    const rect = endRow >= startRow && endCol >= startCol ? { startRow, startCol: startColumn, endRow, endCol: navigableKeys[endCol] as string } : null;
    return { requests, startRow, startColumn, rowsAffected: grid.length, rect };
}

/** What a finished paste says in the live region: the cells written, and the rejected ones when there are any. */
export function pasteAnnouncement(locale: DataTableLocale, applied: number, rejected: number): string {
    if (rejected > 0) return interpolate(locale.pasteRejectedAnnouncement, { count: applied, rejected });
    return applied === 1 ? locale.pasteResultAnnouncementOne : interpolate(locale.pasteResultAnnouncement, { count: applied });
}

/** The `cells-paste` detail of a plan once written. */
export function pasteEvent<T>(plan: PastePlan, results: readonly CellWriteResult<T>[]): CellsPasteEvent {
    return {
        startRow: plan.startRow,
        startColumn: plan.startColumn,
        rowsAffected: plan.rowsAffected,
        cellsApplied: results.filter((r) => r.status === 'written').length,
        cellsRejected: results.filter((r) => r.status === 'rejected').length,
    };
}
