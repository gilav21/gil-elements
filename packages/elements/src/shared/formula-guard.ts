/**
 * Spreadsheet formula-injection guard (OWASP "CSV Injection"). A cell that leads with `=`, `+`, `-`, `@`, a tab or a
 * carriage return is read as a formula by Excel, LibreOffice and Google Sheets. Tab and CR are on the list because
 * some importers strip them and then see the character behind.
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r']);

/** A whole cell that is a signed decimal number, which a spreadsheet stores as a number, never a formula. */
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Whether a cell must be quoted. A cell that already starts with the quote counts when the text behind it does, so a
 * genuine `'=x` is quoted to `''=x` and {@link restoreSpreadsheetText} can undo exactly what was added.
 */
function needsFormulaGuard(cell: string): boolean {
    let start = 0;
    while (cell.charAt(start) === "'") start++;
    const text = cell.slice(start);
    return FORMULA_TRIGGERS.has(text.charAt(0)) && !PLAIN_NUMBER.test(text);
}

/**
 * Makes a cell safe to hand to a spreadsheet by prefixing a single quote when it would run as a formula. A plain
 * number such as `-12`, `+3.5` or `-1e3` is left alone so it stays numeric. Apply it to every cell of a CSV/TSV export
 * or clipboard copy, before any CSV quoting; XLSX needs no guard (typed string cells).
 */
export function guardSpreadsheetFormula(cell: string): string {
    return needsFormulaGuard(cell) ? `'${cell}` : cell;
}

/**
 * The exact inverse of {@link guardSpreadsheetFormula}: drops the leading quote only when the rest is something the
 * guard would have quoted, so `restoreSpreadsheetText(guardSpreadsheetFormula(x)) === x` for every string.
 */
export function restoreSpreadsheetText(cell: string): string {
    return cell.startsWith("'") && needsFormulaGuard(cell.slice(1)) ? cell.slice(1) : cell;
}
