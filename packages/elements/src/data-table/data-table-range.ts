/**
 * Cell-range maths: normalisation, membership, stats and chart payload, clamping after the rows change, paste parsing
 * and coercion. Pure. Rows are addressed by RENDERED index (see the grouping module) and columns by their position
 * among the navigable keys (the data columns, in drawn order).
 */
import type { CellRange, ColumnDef, RangeAggregateStats, RangeChartPayload } from './data-table.types.js';
import { resetWarnOnce, warnOnce } from './data-table-warn.js';
import { computeAggregateValue, getCellValue, isSpecialColumnKey, stringifyValue, toAggregatableNumber } from './data-table.utils.js';

export interface NormalizedRange {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

/**
 * The range as a min/max rectangle, or `null` when either end column is not among `navigableKeys` (a column hidden
 * since the range was made; Angular would produce a `-1` column index here).
 */
export function normalizeCellRange(range: CellRange | null, navigableKeys: readonly string[]): NormalizedRange | null {
    if (!range) return null;
    const a = navigableKeys.indexOf(range.startCol);
    const b = navigableKeys.indexOf(range.endCol);
    if (a < 0 || b < 0) return null;
    return {
        minRow: Math.min(range.startRow, range.endRow),
        maxRow: Math.max(range.startRow, range.endRow),
        minCol: Math.min(a, b),
        maxCol: Math.max(a, b),
    };
}

export function isCellInRange(range: NormalizedRange | null, navigableKeys: readonly string[], rowIndex: number, columnKey: string): boolean {
    if (!range) return false;
    const col = navigableKeys.indexOf(columnKey);
    return rowIndex >= range.minRow && rowIndex <= range.maxRow && col >= range.minCol && col <= range.maxCol;
}

/** The edges of `range` that the cell at (`rowIndex`, column index `col`) touches, space-separated (`top`, `bottom`, `start` = lower column index, `end`); '' for an inner cell. */
export function rangeEdges(range: NormalizedRange, rowIndex: number, col: number): string {
    const edges: string[] = [];
    if (rowIndex === range.minRow) edges.push('top');
    if (rowIndex === range.maxRow) edges.push('bottom');
    if (col === range.minCol) edges.push('start');
    if (col === range.maxCol) edges.push('end');
    return edges.join(' ');
}

/**
 * A range a consumer assigns (`cellRange`), made safe: `undefined` and `null` are "no range"; anything that is not a range (integer rows
 * from 0, string column keys), or that names a column not among `keys` (when `keys` is known), is refused with `undefined`; rows past the
 * last of `rowCount` rows are trimmed (a range wholly past them is dropped), and an unknown row count (0) leaves the rows as they are.
 * Only the four fields are kept.
 */
export function sanitizeCellRange(input: unknown, rowCount: number, keys: readonly string[]): CellRange | null | undefined {
    if (input === null || input === undefined) return null;
    const { startRow, startCol, endRow, endCol } = input as Partial<CellRange>;
    const row = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
    if (!row(startRow) || !row(endRow) || typeof startCol !== 'string' || typeof endCol !== 'string') return undefined;
    if (keys.length > 0 && !(keys.includes(startCol) && keys.includes(endCol))) return undefined;
    const range: CellRange = { startRow, startCol, endRow, endCol };
    const clamped = rowCount > 0 ? clampToRows(null, range, rowCount).range : range;
    // A valid range that needs no trimming and carries nothing else comes back as the SAME object (`table.cellRange = r; table.cellRange === r`).
    return clamped && sameRange(clamped, range) && Object.keys(input as object).length === 4 ? (input as CellRange) : clamped;
}

/** Field-wise equality of two ranges (either may be absent). */
export function sameRange(a: CellRange | null | undefined, b: CellRange | null | undefined): boolean {
    return a && b ? a.startRow === b.startRow && a.endRow === b.endRow && a.startCol === b.startCol && a.endCol === b.endCol : !a === !b;
}

/** The keys a range may name: the data columns of the table's `columns`, visible or hidden (visibility only affects drawing), never a special column. */
export function rangeColumnKeys(columns: readonly { accessorKey: unknown }[]): string[] {
    return columns.map((c) => String(c.accessorKey)).filter((key) => !isSpecialColumnKey(key));
}

/** Range SELECTION is drawn and claimed (`data-range-selection`, `aria-selected`, `aria-multiselectable`): the flag is on and the range part handles ranges (the one predicate the element and the state view both use). */
export const rangeSelectionDrawn = (config: { readonly enableCellRangeSelection: boolean }, rangeActive: boolean): boolean => config.enableCellRangeSelection && rangeActive;

/** Range mode is on: range selection or the fill handle (the one predicate the element and the range session both use). */
export const rangeModeOn = (config: { readonly enableCellRangeSelection: boolean; readonly enableFillHandle: boolean }): boolean => config.enableCellRangeSelection || config.enableFillHandle;

/** What an owner of a range says, ONCE per page, when it refuses a value that is not a range of the table (the element before the first connect and the session after share it). */
export function warnBadRange(value: unknown): void {
    warnOnce('bad-range', '[ge-data-table] cellRange is not a range of this table (integer startRow / endRow, and startCol / endCol the keys of data columns); ignored, the previous range stays:', value);
}

/** For tests: lets `warnBadRange` speak again. */
export const resetBadRangeWarning = (): void => resetWarnOnce('bad-range');

/** The fill source: the selected range, or the focused cell as a 1x1 range. */
export function fillSourceRange(
    range: NormalizedRange | null,
    focused: { rowIndex: number; columnKey: string } | null,
    navigableKeys: readonly string[],
): NormalizedRange | null {
    if (range) return range;
    if (!focused) return null;
    const col = navigableKeys.indexOf(focused.columnKey);
    return col < 0 ? null : { minRow: focused.rowIndex, maxRow: focused.rowIndex, minCol: col, maxCol: col };
}

/**
 * Keeps focus and range from pointing past the last drawn row: a focus past it is dropped, a range wholly past it is
 * dropped and a range running past it is trimmed. An empty list changes nothing (a server page that is loading must
 * not lose them).
 */
export function clampToRows(
    focused: { rowIndex: number; columnKey: string } | null,
    range: CellRange | null,
    rowCount: number,
): { focused: typeof focused; range: CellRange | null } {
    if (rowCount === 0) return { focused, range };
    const last = rowCount - 1;
    const nextFocus = focused !== null && focused.rowIndex >= rowCount ? null : focused;
    if (range === null) return { focused: nextFocus, range };
    if (Math.min(range.startRow, range.endRow) > last) return { focused: nextFocus, range: null };
    if (Math.max(range.startRow, range.endRow) <= last) return { focused: nextFocus, range };
    return {
        focused: nextFocus,
        range: { ...range, startRow: Math.min(range.startRow, last), endRow: Math.min(range.endRow, last) },
    };
}

export interface RangeColumn {
    key: string;
    header: string;
    values: unknown[];
}

/** The range reshaped per column: header and cell values (rows missing from `rows` are skipped). */
export function readRangeColumns<T>(
    range: NormalizedRange,
    navigableKeys: readonly string[],
    rows: readonly T[],
    columns: readonly ColumnDef<T>[],
): RangeColumn[] {
    const found = navigableKeys.slice(range.minCol, range.maxCol + 1).map((key) => {
        const col = columns.find((c) => String(c.accessorKey) === key);
        return { key, header: col?.header ?? key, col, values: [] as unknown[] };
    });
    for (let r = range.minRow; r <= range.maxRow; r++) {
        const row = rows[r];
        if (row === undefined) continue;
        for (const entry of found) {
            if (entry.col) entry.values.push(getCellValue(row, entry.col.accessorKey, entry.col));
        }
    }
    return found.map(({ key, header, values }) => ({ key, header, values }));
}

const isNumeric = (v: unknown): boolean => toAggregatableNumber(v) !== null;

/** Sum/Avg/Count/Min/Max of a multi-cell range; `null` for fewer than two cells. */
export function rangeStats(cols: readonly RangeColumn[]): RangeAggregateStats | null {
    const values = cols.flatMap((c) => c.values);
    if (values.length < 2) return null;
    return {
        count: values.length,
        numericCount: values.filter(isNumeric).length,
        sum: computeAggregateValue(values, 'sum'),
        avg: computeAggregateValue(values, 'avg'),
        min: computeAggregateValue(values, 'min'),
        max: computeAggregateValue(values, 'max'),
    };
}

/** The range as chart data: the first non-numeric column gives the categories, each numeric column a series. */
export function rangeChartPayload(cols: readonly RangeColumn[]): RangeChartPayload | null {
    const rowCount = cols[0]?.values.length ?? 0;
    if (rowCount === 0) return null;
    const numeric = cols.filter((c) => c.values.some(isNumeric));
    if (numeric.length === 0) return null;
    const label = cols.find((c) => !numeric.includes(c));
    return {
        categories: label ? label.values.map(stringifyValue) : Array.from({ length: rowCount }, (...[, i]) => `Row ${i + 1}`),
        series: numeric.map((c) => ({ name: c.header, values: c.values.map((v) => toAggregatableNumber(v) ?? 0) })),
    };
}

// ---- paste ---------------------------------------------------------------------------------------------------

/** Splits delimited text into rows of cells. A cell that starts with a quote may hold the delimiter, doubled quotes and line breaks. */
function parseDelimited(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    let atStart = true;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charAt(i);
        if (quoted) {
            if (ch !== '"') cell += ch;
            else if (text.charAt(i + 1) === '"') {
                cell += '"';
                i++;
            } else quoted = false;
        } else if (ch === '"' && atStart) {
            quoted = true;
            atStart = false;
        } else if (ch === delimiter) {
            row.push(cell);
            cell = '';
            atStart = true;
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            atStart = true;
        } else {
            cell += ch;
            atStart = false;
        }
    }
    row.push(cell);
    rows.push(row);
    return rows;
}

/**
 * Parses clipboard text into a grid of cell strings: tab-separated when that gives more than one column (Excel, Sheets, the
 * table's own copy), else comma-separated when several lines agree on the column count, else one cell per line. Quoted cells may span lines and hold the delimiter. One trailing line break is dropped.
 */
export function parseClipboardGrid(text: string): string[][] {
    if (text === '') return [];
    const body = text.replace(/(\r\n|\n|\r)$/, '');
    const tabbed = parseDelimited(body, '\t');
    if (tabbed.some((row) => row.length > 1)) return tabbed;
    // Commas only make columns when several lines agree on how many: a sentence or a list with commas is one cell per line.
    const csv = parseDelimited(body, ',');
    const width = csv[0]?.length ?? 0;
    return csv.length > 1 && width > 1 && csv.every((row) => row.length === width) ? csv : tabbed;
}

/** Pasted text takes the type of the value it replaces: numbers stay numbers when the text parses, booleans follow `true`. */
export function coercePasteValue(raw: string, current: unknown): unknown {
    if (typeof current === 'number') {
        // A blank cell clears a number rather than writing 0; text that is no number is kept as typed.
        if (raw.trim() === '') return null;
        return toAggregatableNumber(raw) ?? raw;
    }
    return typeof current === 'boolean' ? raw.toLowerCase() === 'true' : raw;
}

export interface PasteTarget {
    rowIndex: number;
    columnKey: string;
    raw: string;
}

/** Maps a pasted grid onto cells from `(startRow, startColumn)`; cells past the last navigable column are dropped. */
export function planPaste(grid: readonly (readonly string[])[], startRow: number, startColumn: string, navigableKeys: readonly string[]): PasteTarget[] {
    const startCol = navigableKeys.indexOf(startColumn);
    if (startCol < 0) return [];
    return grid.flatMap((cells, r) =>
        cells.flatMap((raw, c) => {
            const columnKey = navigableKeys[startCol + c];
            return columnKey === undefined ? [] : [{ rowIndex: startRow + r, columnKey, raw }];
        }),
    );
}

/**
 * THE answer to "is this cell selected" (Angular's `isCellSelected`), shared by `interaction.isCellSelected` and the cell's `aria-selected`: with a range, whether
 * the cell is in it (`inRange`, asked only then); with none, whether it is the focused cell.
 */
export function cellSelectedBy(range: CellRange | null | undefined, inRange: () => boolean, focused: { rowIndex: number; columnKey: string } | null, rowIndex: number, columnKey: string): boolean {
    return range ? inRange() : focused?.rowIndex === rowIndex && focused.columnKey === columnKey;
}
