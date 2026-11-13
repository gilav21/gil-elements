/**
 * Pivot a flat dataset into rows x columns x one aggregated value. Pure; bind the result's `columns` and `rows` to a
 * data table.
 */
import { toAggregatableNumber } from '../../../shared/aggregate-number.js';
import type { ColumnDef } from '../../data-table.types.js';

/**
 * Aggregate applied at each pivot cell. `count` counts the source rows in the cell, whatever their values. The others
 * read only numbers and non-blank numeric strings; `null`, `undefined`, blank strings, booleans and other text are
 * skipped. Over no numeric values `sum` is `0` and `avg` / `min` / `max` are `null` (a blank cell), so a missing value
 * is never mistaken for a zero.
 */
export type PivotAggregate = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface PivotConfig {
    /** Column keys whose distinct combinations form the pivot rows. */
    rows: string[];
    /** Column key whose distinct values spread across the pivot columns. */
    column: string;
    /** Column key whose values are aggregated at each (row x column) cell. */
    value: string;
    aggregate: PivotAggregate;
    /** Add a trailing "Total" column aggregating across the row. */
    showRowTotals?: boolean;
}

export interface PivotColumn {
    key: string;
    header: string;
}

export interface PivotResult {
    columns: PivotColumn[];
    rows: Record<string, unknown>[];
    /** The dynamic pivot-column keys (excludes the row-dimension and total columns). */
    pivotColumnKeys: string[];
}

export const PIVOT_KEY_PREFIX = 'pivot:';
export const PIVOT_TOTAL_KEY = '__total__';

const defaultGetValue = (row: unknown, key: string): unknown => (row as Record<string, unknown> | null)?.[key];

export { toAggregatableNumber };

function aggregateNumbers(values: readonly number[], fn: PivotAggregate): number | null {
    if (fn === 'count') return values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    if (fn === 'sum') return sum;
    if (values.length === 0) return null;
    if (fn === 'avg') return Math.round((sum / values.length) * 100) / 100;
    if (fn === 'min') return values.reduce((a, b) => Math.min(a, b));
    if (fn === 'max') return values.reduce((a, b) => Math.max(a, b));
    return 0; // an unknown aggregate (a config from untyped code): 0, as Angular
}

function aggregateCell<T>(rows: readonly T[], config: PivotConfig, getValue: (row: T, key: string) => unknown): number | null {
    if (config.aggregate === 'count') return rows.length;
    const nums: number[] = [];
    for (const row of rows) {
        const n = toAggregatableNumber(getValue(row, config.value));
        if (n !== null) nums.push(n);
    }
    return aggregateNumbers(nums, config.aggregate);
}

export function computePivot<T>(
    data: readonly T[],
    config: PivotConfig,
    getValue: (row: T, key: string) => unknown = defaultGetValue,
): PivotResult {
    const columnOf = (row: T): string => String(getValue(row, config.column));
    const columnValues = [...new Set(data.map(columnOf))].sort((a, b) => a.localeCompare(b));

    // Rows group by the whole dimension tuple: a joined string is ambiguous ('a b' + 'c' vs 'a' + 'b c'), a JSON array
    // is not. Values compare as strings, the same equality the column dimension uses.
    const groups = new Map<string, { dim: [string, unknown][]; rows: T[] }>();
    for (const row of data) {
        const dimValues = config.rows.map((key) => getValue(row, key));
        const groupKey = JSON.stringify(dimValues.map(String));
        let group = groups.get(groupKey);
        if (!group) {
            group = { dim: config.rows.map((key, i) => [key, dimValues[i]]), rows: [] };
            groups.set(groupKey, group);
        }
        group.rows.push(row);
    }

    const columns: PivotColumn[] = [
        ...config.rows.map((key) => ({ key, header: key })),
        ...columnValues.map((value) => ({ key: PIVOT_KEY_PREFIX + value, header: value })),
        ...(config.showRowTotals ? [{ key: PIVOT_TOTAL_KEY, header: 'Total' }] : []),
    ];

    const rows = Array.from(groups.values(), (group) => {
        const byColumn = new Map<string, T[]>();
        for (const row of group.rows) {
            const value = columnOf(row);
            const bucket = byColumn.get(value);
            if (bucket) bucket.push(row);
            else byColumn.set(value, [row]);
        }
        const out: Record<string, unknown> = Object.fromEntries(group.dim);
        for (const value of columnValues) out[PIVOT_KEY_PREFIX + value] = aggregateCell(byColumn.get(value) ?? [], config, getValue);
        if (config.showRowTotals) out[PIVOT_TOTAL_KEY] = aggregateCell(group.rows, config, getValue);
        return out;
    });

    return { columns, rows, pivotColumnKeys: columnValues.map((v) => PIVOT_KEY_PREFIX + v) };
}

/** The pivot's columns as table columns (`accessorKey` = the pivot key, `header`), so `other.columns = pivotToColumns(result)` renders it. */
export function pivotToColumns(result: Pick<PivotResult, 'columns'>): ColumnDef<Record<string, unknown>>[] {
    return result.columns.map(({ key, header }) => ({ accessorKey: key, header }));
}
