/**
 * The pure STATIC half of the column and advanced filter UI (wave 5, package A): the three filter functions a consumer pairs with the ready-made
 * panels, the questions the header and the floating row ask, and filter equality. It is in `define.js`; what only the lazy panels and builder
 * use (selection rules, date-range presets, tree operations) is `data-table-filter-panels.ts`. No DOM, no lit: node-tested. Angular sources:
 * sub/data-table-date-filter, sub/data-table-date-range-filter, sub/data-table-multiselect-filter, sub/data-table-filter-builder, cmp 2523-2560
 * and 3943-3980.
 */
import type { ColumnDef, DataTableDateRange, FilterGroup } from './data-table.types.js';
import { asEditableDate, isFilterValueEmpty, isSpecialColumnKey } from './data-table.utils.js';

// ---- filter functions (exported from the package index) ---------------------------------------------------------------------------

/** Local midnight of `d`, as a timestamp: the day granularity every date filter compares at. */
export const toDateOnlyTimestamp = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * The date panel's filter: the cell (a `Date`, an ISO date or date-time string, a timestamp) falls on the picked day. The filter value is read
 * the same way (`asEditableDate`), so one restored from JSON (a saved view: an ISO string) or given as a timestamp still filters; no value, or
 * one that is not a date, lets every row through (never a throw). A cell that is not a date never matches. Use it as
 * `filterFn: (row, value) => dateFilterFn(row, value, (r) => r.date)`.
 */
export function dateFilterFn<R>(row: R, filterValue: Date | string | number | null | undefined, getValue: (row: R) => unknown): boolean {
    const day = asEditableDate(filterValue);
    if (!day) return true;
    const cell = asEditableDate(getValue(row));
    if (!cell) return false;
    return toDateOnlyTimestamp(cell) === toDateOnlyTimestamp(day);
}

/** One end of a range filter value, read like a cell (a `Date`, an ISO string, a timestamp); anything else is an open end. */
const rangeEnd = (range: unknown, end: 'start' | 'end'): Date | null =>
    typeof range === 'object' && range !== null ? asEditableDate((range as Record<string, unknown>)[end]) : null;

/**
 * The date-range panel's filter: inclusive at both ends, open-ended when one end is missing. The ends are read like cells, so a range restored
 * from JSON (ISO strings) still filters; no range, an empty one, or a value that is not a range lets every row through (never a throw).
 */
export function dateRangeFilterFn<R>(row: R, filterValue: DataTableDateRange | { start?: unknown; end?: unknown } | null | undefined, getValue: (row: R) => unknown): boolean {
    const start = rangeEnd(filterValue, 'start');
    const end = rangeEnd(filterValue, 'end');
    if (!start && !end) return true;
    const cell = asEditableDate(getValue(row));
    if (!cell) return false;
    const ts = toDateOnlyTimestamp(cell);
    if (start && ts < toDateOnlyTimestamp(start)) return false;
    return !end || ts <= toDateOnlyTimestamp(end);
}

/**
 * The multiselect panel's filter: the cell value is one of the selected values (by identity, `includes`); no selection lets every row through.
 * Only an array (or a `Set`, read as its values) is a selection: any other value (a string set from outside, an object) is no filter and lets every
 * row through. It never throws and never matches a substring.
 */
export function multiselectFilterFn<R>(row: R, filterValue: readonly unknown[] | ReadonlySet<unknown> | null | undefined, getValue: (row: R) => unknown): boolean {
    const selected: readonly unknown[] = Array.isArray(filterValue) ? filterValue : filterValue instanceof Set ? [...filterValue] : [];
    return selected.length === 0 || selected.includes(getValue(row));
}

/** How long a filter result announcement waits for the edits to settle (D7): ONE value for the global filter and the column / advanced filters. */
export const FILTER_ANNOUNCE_MS = 500;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

/**
 * Structural equality of filter state: primitives by `Object.is`, `Date`s by time, arrays item by item, PLAIN objects key by key (an absent key and
 * one holding `undefined` are the same). Anything else (a class instance, a `Map`) only by identity. A cycle answers "different" (never loops).
 * The echo test: a consumer that writes back a NEW but equal object (a framework's two-way binding) changed nothing.
 */
export function sameStructure(a: unknown, b: unknown, stack: unknown[] = []): boolean {
    if (Object.is(a, b)) return true;
    if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && Object.is(a.getTime(), b.getTime());
    if (stack.includes(a)) return false;
    const inner = [...stack, a];
    if (Array.isArray(a) || Array.isArray(b)) {
        return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameStructure(item, b[i], inner));
    }
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!sameStructure(a[key], b[key], inner)) return false;
    return true;
}

// ---- filter value equality -----------------------------------------------------------------------------------------------------------

/**
 * Two column filter values that are CERTAINLY the same filter, so writing one over the other is a no-op (no new object, no page reset, no event).
 * Conservative on purpose: only (a) both "no filter" (the `isFilterValueEmpty` rule: null, undefined, an absent key, `''`, `[]`, an empty range),
 * (b) the same primitive (`Object.is`), or (c) two dates of the same instant. Any array or object (a Set, a Map, a class instance, a range, and
 * the SAME array mutated and re-emitted) counts as a change, as in Angular: the table writes it and re-filters.
 */
export function sameFilterValue(a: unknown, b: unknown): boolean {
    const emptyA = isFilterValueEmpty(a);
    if (emptyA || isFilterValueEmpty(b)) return emptyA && isFilterValueEmpty(b);
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    const primitive = (v: unknown): boolean => v === null || (typeof v !== 'object' && typeof v !== 'function');
    return primitive(a) && primitive(b) && Object.is(a, b);
}

// ---- the built-in panels -------------------------------------------------------------------------------------------------------------

/** The tags of the three ready-made panels (defined by the lazy `lazy/filter-panels` entry): ONE list, read by the controller and the config check. */
export const BUILT_IN_FILTER_PANELS: readonly string[] = Object.freeze(['ge-data-table-date-filter', 'ge-data-table-date-range-filter', 'ge-data-table-multiselect-filter']);

/** `tag` is one of the built-in panels, whatever its case (a tag name is case-insensitive), as the lower-case tag of that list; else undefined. */
export const builtInPanelOf = (tag: string | undefined): string | undefined => {
    const lower = tag?.toLowerCase();
    return lower !== undefined && BUILT_IN_FILTER_PANELS.includes(lower) ? lower : undefined;
};

// ---- header trigger and floating row ------------------------------------------------------------------------------------------------

/** The column holds a filter value that filters (`!isFilterValueEmpty`): the header's "filtered" state. */
export const isFilterActive = (filters: Readonly<Record<string, unknown>>, key: string): boolean => !isFilterValueEmpty(Object.hasOwn(filters, key) ? filters[key] : undefined);

/**
 * Some filter filters: a set value on a column with `enableFiltering` (a key of another column is skipped by the pipeline), an advanced condition
 * (`advancedConditions`, counted by the caller), or the global text. ONE rule for "all filters cleared" in every filter announcement.
 */
export const anyFilterOn = <T>(columns: readonly ColumnDef<T>[], filters: Readonly<Record<string, unknown>>, advancedConditions: number, globalFilter: string): boolean =>
    advancedConditions > 0 || globalFilter.trim() !== '' || columns.some((c) => !!c.enableFiltering && isFilterActive(filters, String(c.accessorKey)));

/**
 * The column's filter value as a panel, a floating component or a renderer is given it: the value held, `null` for none (an absent key, or one
 * holding `undefined`). An own key only (never an inherited `toString`).
 */
export const currentFilterValue = (filters: Readonly<Record<string, unknown>>, key: string): unknown => (Object.hasOwn(filters, key) ? (filters[key] ?? null) : null);

/** The header draws a filter trigger: `enableFiltering` and a panel (`filterComponent`), never on a special column (Angular html 633). */
export const hasFilterTrigger = <T>(column: ColumnDef<T>): boolean => !!column.enableFiltering && !!column.filterComponent && !isSpecialColumnKey(column.accessorKey);

/**
 * The column gets the DEFAULT floating text input: `enableFiltering` and no built-in structured header panel. DEVIATION from Angular (cmp 2549,
 * which draws the text input there too): a date, date-range or multiselect column's filter value is not text, so a text input would write a
 * string its `filterFn` cannot read; only an explicit floating component or renderer draws in that cell.
 */
const hasDefaultFloatingInput = <T>(column: ColumnDef<T>): boolean => !!column.enableFiltering && builtInPanelOf(column.filterComponent) === undefined;

/** The floating row draws a control for this column (cmp 2538): not opted out, not special, and a component, a renderer or the default input. */
export function hasFloatingFilter<T>(column: ColumnDef<T>): boolean {
    if (column.floatingFilter === false || isSpecialColumnKey(column.accessorKey)) return false;
    return !!column.floatingFilterComponent || !!column.floatingFilterRenderer || hasDefaultFloatingInput(column);
}

/**
 * Some column draws a floating control, so the floating row is drawn: exactly the columns `hasFloatingFilter` draws. Angular (cmp 2523) also counts a bare
 * `floatingFilter: true`, which draws nothing there: an empty row. Not here; the config check warns about that column instead.
 */
export const hasAnyFloatingFilter = <T>(columns: readonly ColumnDef<T>[]): boolean => columns.some((c) => hasFloatingFilter(c));

/** `filterComponentInputs`, read afresh (a factory is called on every render, cmp 3943). */
export const filterInputsOf = <T>(column: ColumnDef<T>): Record<string, unknown> =>
    (typeof column.filterComponentInputs === 'function' ? column.filterComponentInputs() : column.filterComponentInputs) ?? {};

// ---- the builder's inputs (the toolbar draws them; the tree operations are lazy: data-table-filter-panels.ts) ------------------------

export interface FilterBuilderColumn {
    key: string;
    header: string;
}

/** The tree the builder shows while there is no advanced filter: ONE frozen object (the tree operations never mutate, they build new trees). */
export const EMPTY_GROUP: FilterGroup = Object.freeze({ type: 'group', combinator: 'and', rules: Object.freeze([]) as unknown as FilterGroup['rules'] }) as FilterGroup;

/** The columns the builder offers: the consumer's columns, special ones left out. */
export const builderColumns = <T>(columns: readonly ColumnDef<T>[]): FilterBuilderColumn[] =>
    columns.filter((c) => !isSpecialColumnKey(c.accessorKey)).map((c) => ({ key: String(c.accessorKey), header: c.header }));
