/**
 * Cell-range maths: normalisation, membership, stats and chart payload, clamping after the rows change, paste parsing
 * and coercion. Pure. Rows are addressed by RENDERED index (see the grouping module) and columns by their position
 * among the navigable keys (the data columns, in drawn order).
 */
import type { CellRange, ColumnDef, RangeAggregateStats, RangeChartPayload } from './data-table.types.js';
import { computeAggregateValue, getCellValue, stringifyValue } from './data-table.utils.js';

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

const isNumeric = (v: unknown): boolean => Number.isFinite(Number(v));

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
        series: numeric.map((c) => ({ name: c.header, values: c.values.map((v) => (isNumeric(v) ? Number(v) : 0)) })),
    };
}

// ---- paste ---------------------------------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line.charAt(i);
        if (ch === '"') {
            if (inQuotes && line.charAt(i + 1) === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    cells.push(current);
    return cells;
}

/**
 * Parses clipboard text into a grid of cell strings: tab-separated when any line holds a tab (Excel, the table's own
 * copy), else comma-separated with quoted-cell support. A single trailing newline is dropped. A quoted cell cannot
 * span lines (a limitation shared with Angular).
 */
export function parseClipboardGrid(text: string): string[][] {
    if (text === '') return [];
    const normalized = text.replaceAll(/\r\n?/g, '\n');
    const lines = (normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized).split('\n');
    return lines.some((line) => line.includes('\t')) ? lines.map((line) => line.split('\t')) : lines.map(parseCsvLine);
}

/** Pasted text takes the type of the value it replaces: numbers stay numbers when the text parses, booleans follow `true`. */
export function coercePasteValue(raw: string, current: unknown): unknown {
    if (typeof current === 'number') {
        const num = Number(raw);
        return Number.isFinite(num) ? num : raw;
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
