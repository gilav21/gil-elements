/**
 * Small pure kernels shared by the data-table modules: value access, row identity, aggregates, the AI filter parser
 * and the date helpers. Nothing here touches the DOM.
 */
import type { AggregateFn, ColumnDef } from './data-table.types.js';

/** Text for a cell value. Total: a cyclic object or a BigInt inside one reads as its `String()` instead of throwing. */
/** The value as a number, or `null` when it holds none. `Number()` alone turns `null`, `''`, whitespace and `false` into 0. */
export function toAggregatableNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function stringifyValue(value: unknown): string {
    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
        case 'boolean':
        case 'bigint':
        case 'symbol':
            return value.toString();
        case 'function':
            return '';
        default:
            if (value == null) return '';
            // A Date as its ISO text, not a quoted JSON string (which no `startsWith` or `equals` could match).
            if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
            try {
                return JSON.stringify(value) ?? '';
            } catch {
                return String(value);
            }
    }
}

/**
 * The raw (unformatted) value behind a cell, which sorting, filtering and export compare against. A column
 * `accessorFn` wins outright; otherwise a dotted key is walked as a path (`'user.name'`), giving `undefined` at the
 * first null/undefined link rather than throwing.
 */
export function getCellValue<T>(row: T, key: string | keyof T, column?: Pick<ColumnDef<T>, 'accessorFn'>): unknown {
    if (column?.accessorFn) return column.accessorFn(row);
    const name = String(key);
    if (name.includes('.')) {
        let value: unknown = row;
        for (const segment of name.split('.')) {
            if (value === null || value === undefined) return undefined;
            value = (value as Record<string, unknown>)[segment];
        }
        return value;
    }
    return (row as Record<string, unknown> | null | undefined)?.[name];
}

/** The keys of the columns the table adds itself; they are never data. */
export const SPECIAL_COLUMN_KEYS: ReadonlySet<string> = new Set(['_selection', '_expander', '_actions']);

export function isSpecialColumnKey(key: unknown): boolean {
    return SPECIAL_COLUMN_KEYS.has(String(key));
}

/**
 * The "no filter" test used to skip column filters: `undefined`, `null`, `''`, an empty array (an emptied
 * multiselect), and a date range whose `start` and `end` are both null.
 */
export function isFilterValueEmpty(value: unknown): boolean {
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && 'start' in value && 'end' in value) {
        return value.start === null && value.end === null;
    }
    return false;
}

const identityIds = new WeakMap<object, string>();
let nextIdentityId = 0;

/**
 * The default row id: the row's `id` when it has one, else a per-object identity id.
 *
 * Angular falls back to `JSON.stringify(row)`, which gives identical rows the same id (selection, edit and flash then
 * hit all of them), is O(row size) per call, and throws on cyclic or BigInt data. The identity id is cheap, total and
 * stable across sort/filter/paging; like the JSON id it changes when a row is replaced by an edited copy, so give
 * editable tables a real `getRowId`. Primitive rows have no identity and fall back to their typed value.
 */
export function defaultGetRowId<T>(row: T): string {
    if (row !== null && typeof row === 'object') {
        const id = (row as Record<string, unknown>)['id'];
        if (id !== undefined && id !== null) return stringifyValue(id);
        let own = identityIds.get(row);
        if (own === undefined) {
            own = `~${++nextIdentityId}`;
            identityIds.set(row, own);
        }
        return own;
    }
    return `${typeof row}:${stringifyValue(row)}`;
}

/** The ids that more than one row maps to, in first-seen order. */
export function findDuplicateRowIds<T>(rows: readonly T[], getId: (row: T) => string): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const row of rows) {
        const id = getId(row);
        if (seen.has(id)) dupes.add(id);
        else seen.add(id);
    }
    return [...dupes];
}

/**
 * Reduces cell values to one aggregate string. Shared by column footers and the range readout. `count` counts all
 * values; the numeric aggregates ignore values that are not finite once passed through `Number`.
 */
export function computeAggregateValue(values: readonly unknown[], fn: AggregateFn): string {
    if (typeof fn === 'function') return fn([...values]);

    const nums = values.map(toAggregatableNumber).filter((n): n is number => n !== null);
    if (nums.length === 0 && fn !== 'count') return '';
    const sum = () => nums.reduce((a, b) => a + b, 0);

    switch (fn) {
        case 'sum':
            return String(sum());
        case 'avg':
            return String(Math.round((sum() / nums.length) * 100) / 100);
        case 'count':
            return String(values.length);
        case 'min':
            return String(nums.reduce((a, b) => Math.min(a, b)));
        case 'max':
            return String(nums.reduce((a, b) => Math.max(a, b)));
        default:
            return '';
    }
}

/** A filter spec compiled from a natural-language query by an AI provider. */
export interface NlFilterSpec {
    globalFilter?: string;
    columnFilters?: Record<string, unknown>;
}

/**
 * Parses an AI provider's JSON into a safe {@link NlFilterSpec}: keeps a string `globalFilter` and only the
 * `columnFilters` whose keys are known columns. Malformed input gives an empty spec; the provider's output is never
 * trusted to address unknown columns.
 */
export function parseNlFilterSpec(raw: string, validColumnKeys: readonly string[]): NlFilterSpec {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    const spec: NlFilterSpec = {};
    if (typeof obj['globalFilter'] === 'string') spec.globalFilter = obj['globalFilter'];
    const columnFilters = obj['columnFilters'];
    if (columnFilters && typeof columnFilters === 'object') {
        const valid = new Set(validColumnKeys);
        const kept = Object.entries(columnFilters).filter(([key]) => valid.has(key));
        // fromEntries defines own properties, so a column named `__proto__` cannot rewrite the prototype.
        if (kept.length > 0) spec.columnFilters = Object.fromEntries(kept);
    }
    return spec;
}

export interface Ymd {
    y: number;
    m: number;
    d: number;
}

/** The year, month and day of a strictly date-only ISO string (`YYYY-MM-DD`), or `null` for any other string. */
export function dateOnlyParts(v: string): Ymd | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    return match ? { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) } : null;
}

export function ymdToDate(ymd: Ymd): Date {
    return new Date(ymd.y, ymd.m - 1, ymd.d);
}

/** Local midnight of `ymd`, or `null` when no such day exists (`2026-02-30` would roll into March). */
function localDay(ymd: Ymd): Date | null {
    const date = ymdToDate(ymd);
    return date.getMonth() === ymd.m - 1 && date.getDate() === ymd.d ? date : null;
}

/**
 * Reads a cell value as a date, whatever shape the column keeps it in (`Date`, ISO string, epoch number). Anything
 * that is not a real date reads as `null`. A date-only string names a calendar day, so it reads as LOCAL midnight of
 * that day (the `Date` parser would read UTC midnight: the previous day west of Greenwich); date-time strings and
 * epoch numbers name an instant and go to the parser.
 */
export function asEditableDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const ymd = dateOnlyParts(value);
        if (ymd) return localDay(ymd);
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/** A date as `YYYY-MM-DD` in the LOCAL calendar (`toISOString` converts to UTC and is a day off east of Greenwich). */
export function toLocalDateString(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Writes a picked date back in the shape the cell already held: strings stay ISO strings. With nothing to go on (an
 * empty cell) a `Date` is returned.
 */
export function toEditedDateValue(picked: Date | null, previous: unknown): unknown {
    if (picked === null) return null;
    return typeof previous === 'string' ? toLocalDateString(picked) : picked;
}
