/** The clipboard side of the formula guard; the guard itself is shared with CSV export. */
import { guardSpreadsheetFormula } from '../shared/formula-guard.js';

export { guardSpreadsheetFormula, restoreSpreadsheetText } from '../shared/formula-guard.js';

/**
 * A grid as the TSV every copy path writes: one line per row, cells formula-guarded so pasting into a spreadsheet never
 * runs a cell as a formula. The paste path undoes the guard with `restoreSpreadsheetText`.
 */
export function toClipboardText(grid: readonly (readonly string[])[]): string {
    const quote = (cell: string): string => (/[\t\r\n"]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);
    return grid.map((cells) => cells.map((cell) => quote(guardSpreadsheetFormula(cell))).join('\t')).join('\n');
}

/**
 * `value` as a quoted CSS string for an attribute selector (`[data-row-id="..."]`). Only quotes, backslashes and line
 * breaks need escaping inside a quoted string; unlike `CSS.escape` this works where the `CSS` global is missing.
 * Not used yet on purpose: it will replace the `CSS.escape` uses once the spreadsheet addon is wired (waves 5-7).
 */
export function cssString(value: string): string {
    const escaped = value
        .replaceAll(/["\\]/g, (ch) => `\\${ch}`)
        .replaceAll('\n', String.raw`\a `)
        .replaceAll('\r', String.raw`\d `)
        .replaceAll('\f', String.raw`\c `);
    return `"${escaped}"`;
}
