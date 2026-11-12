/**
 * The filter and sort pipeline as pure functions over `T[]`, plus a memoised wrapper.
 *
 * Order matches Angular: advanced filter is applied last, after global and column filters (the three are ANDed, so
 * the order only matters for cost). Paging, trees and grouping live in their own modules and consume the output.
 */
import type {
    ColumnDef,
    FilterGroup,
    FilterOperator,
    FilterRule,
    PaginationState,
    SortDirection,
    SortState,
} from './data-table.types.js';
import type { ModelStore } from './data-table-model.js';
import { getCellValue, isFilterValueEmpty, isSpecialColumnKey, stringifyValue, toAggregatableNumber } from './data-table.utils.js';

export type GlobalFilterFn<T> = (row: T, filter: string, columns: ColumnDef<T>[]) => boolean;

/** Columns by `String(accessorKey)`; the first of two columns sharing a key wins. */
export function indexColumns<T>(columns: readonly ColumnDef<T>[]): Map<string, ColumnDef<T>> {
    const map = new Map<string, ColumnDef<T>>();
    for (const column of columns) {
        const key = String(column.accessorKey);
        if (!map.has(key)) map.set(key, column);
    }
    return map;
}

const lower = (value: unknown): string => stringifyValue(value).toLowerCase();

/** Case-insensitive substring match on the stringified cell, the default text filter. */
export function textIncludes(cell: unknown, needle: unknown): boolean {
    return lower(cell).includes(lower(needle));
}

// ---- advanced filter -------------------------------------------------------------------------------------------

function looseEquals(cell: unknown, value: unknown): boolean {
    const a = toAggregatableNumber(cell);
    const b = toAggregatableNumber(value);
    if (a !== null && b !== null) return a === b;
    return lower(cell) === lower(value);
}

/** A numeric comparison; an empty or non-numeric side never matches (only `isEmpty` selects blanks). */
const compare = (test: (a: number, b: number) => boolean) => (cell: unknown, value: unknown): boolean => {
    const a = toAggregatableNumber(cell);
    const b = toAggregatableNumber(value);
    return a !== null && b !== null && test(a, b);
};

const FILTER_OPS = new Map<string, (cell: unknown, value: unknown) => boolean>([
    ['isEmpty', (cell) => stringifyValue(cell).trim() === ''],
    ['isNotEmpty', (cell) => stringifyValue(cell).trim() !== ''],
    ['equals', looseEquals],
    ['notEquals', (cell, value) => !looseEquals(cell, value)],
    ['contains', (cell, value) => lower(cell).includes(lower(value))],
    ['notContains', (cell, value) => !lower(cell).includes(lower(value))],
    ['startsWith', (cell, value) => lower(cell).startsWith(lower(value))],
    ['endsWith', (cell, value) => lower(cell).endsWith(lower(value))],
    ['gt', compare((a, b) => a > b)],
    ['gte', compare((a, b) => a >= b)],
    ['lt', compare((a, b) => a < b)],
    ['lte', compare((a, b) => a <= b)],
]);

/** Tests one cell against an advanced-filter operator. An unknown operator (stale saved view) matches everything. */
export function matchesCondition(cell: unknown, operator: FilterOperator, value: unknown): boolean {
    return FILTER_OPS.get(operator)?.(cell, value) ?? true;
}

function evaluateRule(rule: FilterRule, getValue: (column: string) => unknown): boolean {
    return rule.type === 'group'
        ? evaluateAdvancedFilter(rule, getValue)
        : matchesCondition(getValue(rule.column), rule.operator, rule.value);
}

/** Evaluates an AND/OR tree against a row. An empty group matches everything; nested groups recurse. */
export function evaluateAdvancedFilter(group: FilterGroup, getValue: (column: string) => unknown): boolean {
    if (group.rules.length === 0) return true;
    const test = (rule: FilterRule) => evaluateRule(rule, getValue);
    return group.combinator === 'and' ? group.rules.every(test) : group.rules.some(test);
}

/** Number of leaf conditions in a tree, nested groups included. */
export function countConditions(group: FilterGroup | null | undefined): number {
    if (!group) return 0;
    return group.rules.reduce((n, rule) => n + (rule.type === 'group' ? countConditions(rule) : 1), 0);
}

// ---- row predicates --------------------------------------------------------------------------------------------

/** Columns the global filter searches: the data columns, minus those opting out. */
function globalColumns<T>(columns: readonly ColumnDef<T>[]): ColumnDef<T>[] {
    return columns.filter((col) => !isSpecialColumnKey(col.accessorKey));
}

export interface RowFilters<T> {
    columns: readonly ColumnDef<T>[];
    /** The search text as typed; matching is case-insensitive. */
    globalFilter: string;
    globalFilterFn?: GlobalFilterFn<T> | null;
    columnFilters: Readonly<Record<string, unknown>>;
    advancedFilter?: FilterGroup | null;
}

/** A row predicate for the global and per-column filters (flat and tree filtering share it), or `null` for none. */
export function buildFilterMatchers<T>(f: RowFilters<T>): { global: ((row: T) => boolean) | null; columns: ((row: T) => boolean) | null } {
    const needle = f.globalFilter.toLowerCase();
    const dataColumns = globalColumns(f.columns);
    let global: ((row: T) => boolean) | null = null;
    if (needle) {
        const fn = f.globalFilterFn;
        const searchable = dataColumns.filter((col) => col.enableGlobalFilter !== false);
        global = fn
            ? (row) => fn(row, needle, dataColumns)
            : (row) => searchable.some((col) => lower(getCellValue(row, col.accessorKey, col)).includes(needle));
    }

    const byKey = indexColumns(f.columns);
    const active = Object.keys(f.columnFilters).flatMap((key) => {
        const value = f.columnFilters[key];
        const column = byKey.get(key);
        return isFilterValueEmpty(value) || !column?.enableFiltering ? [] : [{ key, value, column }];
    });
    const columns =
        active.length === 0
            ? null
            : (row: T) =>
                  active.every(({ key, value, column }) =>
                      column.filterFn ? column.filterFn(row, value) : textIncludes(getCellValue(row, key, column), value),
                  );
    return { global, columns };
}

function advancedMatcher<T>(columns: readonly ColumnDef<T>[], group: FilterGroup | null | undefined): ((row: T) => boolean) | null {
    if (!group || group.rules.length === 0) return null;
    const byKey = indexColumns(columns);
    return (row) =>
        evaluateAdvancedFilter(group, (column) => {
            const col = byKey.get(column);
            return getCellValue(row, col?.accessorKey ?? column, col);
        });
}

/** Global, then per-column, then advanced filter. Returns `rows` itself when nothing filters. */
export function filterRows<T>(rows: T[], f: RowFilters<T>): T[] {
    const { global, columns } = buildFilterMatchers(f);
    const advanced = advancedMatcher(f.columns, f.advancedFilter);
    const tests = [global, columns, advanced].filter((t): t is (row: T) => boolean => t !== null);
    return tests.length === 0 ? rows : rows.filter((row) => tests.every((test) => test(row)));
}

// ---- sorting ---------------------------------------------------------------------------------------------------

/**
 * The sorts in force: the multi-sort chain when `multi`, else the single sort. Entries without a column or direction
 * are dropped.
 */
export function activeSorts(multi: boolean, sortState: SortState, multiSortState: readonly SortState[]): SortState[] {
    if (multi) return multiSortState.filter(sortCounts);
    return sortCounts(sortState) ? [sortState] : [];
}

/** A sort entry counts when it names a column and a direction (the rule of `activeSorts`). */
function sortCounts(sort: SortState): boolean {
    return !!sort.column && !!sort.direction;
}

/** The column a sort step orders by, or undefined when the step is skipped. The one rule of `buildSortComparator` and `sortReordersRows`. */
function sortStepColumn<T>(sort: SortState, byKey: ReadonlyMap<string, ColumnDef<T>>): ColumnDef<T> | undefined {
    return sortCounts(sort) ? byKey.get(sort.column) : undefined;
}

/** Whether the table sorts rows itself: local sorting, and in tree mode only with sub-row sorting. The gate the tree and the diagnostics share (the flat path's is plain `localSorting`). */
export function localSortApplies(localSorting: boolean, tree: boolean, subRowSorting: boolean): boolean {
    return localSorting && (!tree || subRowSorting);
}

/**
 * Whether the table itself reorders the rows by a sort: `localSortApplies`, and at least one step `buildSortComparator`
 * would not skip (`sortStepColumn`'s rule).
 */
export function sortReordersRows<T>({ multi, sortState, multiSortState, columns, localSorting, tree, subRowSorting }: {
    multi: boolean;
    sortState: SortState;
    multiSortState: readonly SortState[];
    columns: readonly ColumnDef<T>[];
    localSorting: boolean;
    tree: boolean;
    subRowSorting: boolean;
}): boolean {
    if (!localSortApplies(localSorting, tree, subRowSorting)) return false;
    // `sortStepColumn`'s rule (a counting step on a known column), without building the column index.
    const applies = (sort: SortState): boolean => sortCounts(sort) && columns.some((column) => String(column.accessorKey) === sort.column);
    return multi ? multiSortState.some(applies) : applies(sortState);
}

function compareValues(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    // Mixed types compare with the language's own relational rules, as in Angular; a null sorts first.
    if ((a as number) < (b as number)) return -1;
    return (a as number) > (b as number) ? 1 : 0;
}

/** The comparator for a sort chain; a sort on an unknown column or with no direction is skipped. */
export function buildSortComparator<T>(sorts: readonly SortState[], columns: readonly ColumnDef<T>[]): (a: T, b: T) => number {
    const byKey = indexColumns(columns);
    const steps = sorts.flatMap((sort) => {
        const column = sortStepColumn(sort, byKey);
        return column ? [{ column, sign: sort.direction === 'asc' ? 1 : -1 }] : [];
    });
    return (a, b) => {
        for (const { column, sign } of steps) {
            const result = column.sortFn
                ? column.sortFn(a, b)
                : compareValues(getCellValue(a, column.accessorKey, column), getCellValue(b, column.accessorKey, column));
            if (result !== 0) return sign * result;
        }
        return 0;
    };
}

/** A sorted copy (the sort is stable). With no sorts, a plain copy. */
export function sortRows<T>(rows: readonly T[], sorts: readonly SortState[], columns: readonly ColumnDef<T>[]): T[] {
    const copy = [...rows];
    return sorts.length === 0 ? copy : copy.sort(buildSortComparator(sorts, columns));
}

/** `aria-sort` for a header, or `null` for non-sortable columns. */
export function ariaSortOf<T>(column: ColumnDef<T>, direction: SortDirection): 'ascending' | 'descending' | 'none' | null {
    if (isSpecialColumnKey(column.accessorKey) || column.enableSorting === false) return null;
    if (direction === 'asc') return 'ascending';
    return direction === 'desc' ? 'descending' : 'none';
}

/**
 * The next multi-sort chain after a header interaction: `multi` (shift-click) appends to the chain, otherwise the
 * chain is replaced. The chain is trimmed to the newest `maxColumns` (at least 1). Also returns the primary sort.
 */
export function nextSortChain(
    chain: readonly SortState[],
    column: string,
    direction: SortDirection,
    multi: boolean,
    maxColumns: number,
): { chain: SortState[]; primary: SortState } {
    const base = multi ? chain.filter((sort) => sort.column !== column) : [];
    const next = direction ? [...base, { column, direction }] : base;
    const trimmed = next.slice(-Math.max(1, maxColumns));
    return { chain: trimmed, primary: trimmed[0] ?? { column: '', direction: null } };
}

// ---- paging ----------------------------------------------------------------------------------------------------

/** The current page of `rows`. */
export function slicePage<R>(rows: readonly R[], { pageIndex, pageSize }: PaginationState): R[] {
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
}

/**
 * Whether the table slices rows into pages itself: only while a pager can reach the pages. With the pager hidden, or a
 * virtual list rendering every row, a slice would leave rows no control can reach.
 */
export function pagesLocally(localPagination: boolean, showPagination: boolean, virtualActive: boolean): boolean {
    return localPagination && showPagination && !virtualActive;
}

// ---- memoised pipeline -----------------------------------------------------------------------------------------

export interface QueryInput<T> extends RowFilters<T> {
    data: T[];
    localFiltering: boolean;
    localSorting: boolean;
    sorts: readonly SortState[];
}

export interface QueryOutput<T> {
    filtered: T[];
    sorted: T[];
}

/** Remembers the last call's arguments by identity; a call with identical arguments returns the stored result. */
export function memoLast<A extends readonly unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    let last: { args: A; result: R } | null = null;
    return (...args) => {
        if (last?.args.length === args.length && last.args.every((arg, i) => Object.is(arg, args[i]))) return last.result;
        const result = fn(...args);
        last = { args, result };
        return result;
    };
}

const NO_SORTS: readonly SortState[] = [];

/**
 * A stateful pipeline: `filtered` recomputes only when the data or a filter input changes identity, `sorted` only when
 * `filtered` or the sorts do, so changing the sort never re-runs the filters. Treat `data`, `columns` and the filter
 * objects as immutable (replace to update).
 */
export function createQueryPipeline<T>(): (input: QueryInput<T>) => QueryOutput<T> {
    const filter = memoLast(
        (data: T[], columns: readonly ColumnDef<T>[], globalFilter: string, fn: GlobalFilterFn<T> | null | undefined,
         columnFilters: Readonly<Record<string, unknown>>, advanced: FilterGroup | null | undefined) =>
            filterRows(data, { columns, globalFilter, globalFilterFn: fn, columnFilters, advancedFilter: advanced }),
    );
    // activeSorts() builds a fresh array per call, so the chain is compared by value and the last equal one is reused.
    let lastSorts: readonly SortState[] = NO_SORTS;
    const stableSorts = (sorts: readonly SortState[]): readonly SortState[] => {
        const same = sorts.length === lastSorts.length && sorts.every((s, i) => s.column === lastSorts[i]?.column && s.direction === lastSorts[i]?.direction);
        if (!same) lastSorts = sorts;
        return lastSorts;
    };
    const sort = memoLast((rows: T[], sorts: readonly SortState[], columns: readonly ColumnDef<T>[]) => sortRows(rows, sorts, columns));
    return (i) => {
        const filtered = i.localFiltering
            ? filter(i.data, i.columns, i.globalFilter, i.globalFilterFn, i.columnFilters, i.advancedFilter)
            : i.data;
        return { filtered, sorted: sort(filtered, stableSorts(i.localSorting ? i.sorts : NO_SORTS), i.columns) };
    };
}

/** Back to page 0 when not there: the model change, then `page-change` through `emit` (the ONE page-reset rule of every filter write). */
export function resetPageOf<T>(model: ModelStore<T>, emit: (page: PaginationState) => void): void {
    const page = model.get('paginationState');
    if (page.pageIndex === 0) return;
    const next = { ...page, pageIndex: 0 };
    model.set('paginationState', next);
    emit(next);
}

/**
 * Replaces the advanced filter tree (`null` clears it), a no-op when it is already that (undefined and null are the same "no filter"). The model change and
 * the page reset are ONE batch, so `page-change` fires before the model's `advanced-filter-change`. Used by the query service and by the element while no
 * query service exists (before the first connect, detached), so both orders are the same.
 */
export function changeAdvancedFilterOf<T>(model: ModelStore<T>, emit: (page: PaginationState) => void, group: FilterGroup | null): void {
    if ((model.get('advancedFilter') ?? null) === (group ?? null)) return;
    model.batch(() => {
        model.set('advancedFilter', group);
        resetPageOf(model, emit);
    });
}
