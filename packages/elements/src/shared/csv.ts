import { guardSpreadsheetFormula } from './formula-guard.js';

/**
 * Encodes one CSV cell: formula-guards it first (the guard's quote has to sit INSIDE the CSV quotes, where the
 * spreadsheet reads it), then quotes it when it holds a delimiter, quote or line break.
 */
export function escapeCsvCell(value: string): string {
    const cell = guardSpreadsheetFormula(value);
    return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

/** A grid as CSV text: comma-separated, CRLF between rows, no trailing newline. */
export function toCsv(grid: readonly (readonly string[])[]): string {
    return grid.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/** A byte-order mark so Excel opens the file as UTF-8. */
export const CSV_BOM = '\uFEFF';
