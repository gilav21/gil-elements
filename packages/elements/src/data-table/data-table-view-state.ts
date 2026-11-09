/**
 * Column layout and saved-view state as pure reducers, plus the server-mode query shape.
 *
 * `applyColumnState` and `applyViewState` return the NEXT state in one step; the element then writes every model from
 * it and fires its change events once. A restored page must be written together with the filters and must not be
 * reset by the "filter changed, go to page 0" rule, which belongs to user-initiated filter edits only.
 */
import {
    DATA_TABLE_VIEW_STATE_VERSION,
    type ColumnDef,
    type DataTableColumnState,
    type DataTableExportQuery,
    type DataTableQuery,
    type DataTableViewState,
    type FilterGroup,
    type PaginationState,
    type SortState,
} from './data-table.types.js';

type Pin = 'left' | 'right' | undefined;

/** The per-column overrides a user builds up at runtime, keyed by `accessorKey`. */
export interface ColumnLayout {
    widths: Readonly<Record<string, string>>;
    visibility: Readonly<Record<string, boolean>>;
    /** An own entry (even `undefined`) overrides the column definition's `pin`. */
    pins: Readonly<Record<string, Pin>>;
    /** Column keys in drawn order; empty means definition order. */
    order: readonly string[];
}

export const EMPTY_LAYOUT: ColumnLayout = { widths: {}, visibility: {}, pins: {}, order: [] };

/** Own-property read: the keys are column keys from data and saved views, so `constructor` must not find anything. */
function own<V>(record: Readonly<Record<string, V>>, key: string): V | undefined {
    return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** A copy with one entry set; `fromEntries` defines own properties, so a column called `__proto__` stays data. */
function withEntries<V>(record: Readonly<Record<string, V>>, entries: readonly (readonly [string, V])[]): Record<string, V> {
    return Object.fromEntries([...Object.entries(record), ...entries]);
}

/** Keys sorted by their position in `order`; keys missing from it go last, in their own order. */
export function applyKeyOrder(keys: readonly string[], order: readonly string[]): string[] {
    if (order.length === 0) return [...keys];
    const priority = new Map(order.map((key, index) => [key, index]));
    return [...keys].sort((a, b) => {
        const ai = priority.get(a);
        const bi = priority.get(b);
        if (ai === undefined && bi === undefined) return 0;
        if (ai === undefined) return 1;
        return bi === undefined ? -1 : ai - bi;
    });
}

/** The layout of `columns` as a restorable snapshot. `pin` is present (possibly `undefined`) on every entry. */
export function readColumnState<T>(columns: readonly ColumnDef<T>[], layout: ColumnLayout): DataTableColumnState[] {
    const order = new Map(applyKeyOrder(columns.map((c) => String(c.accessorKey)), layout.order).map((key, i) => [key, i]));
    return columns.map((col) => {
        const key = String(col.accessorKey);
        return {
            columnKey: key,
            width: own(layout.widths, key) ?? col.width,
            visible: own(layout.visibility, key) !== false,
            pin: Object.hasOwn(layout.pins, key) ? layout.pins[key] : col.pin,
            order: order.get(key),
        };
    });
}

/**
 * Merges a snapshot into the layout. Columns missing from `states` and fields left out keep their value; an empty
 * list changes nothing. Per field: `visible` applies unless `undefined`; `width` applies unless falsy (so a width
 * override cannot be cleared through state, only by writing the widths directly); `pin` applies whenever the key is
 * PRESENT, `undefined` included, because `readColumnState` emits it for an unpinned column and that must unpin.
 * Order is replaced by the states carrying an `order`, sorted by it.
 */
export function applyColumnState(layout: ColumnLayout, states: readonly DataTableColumnState[] | null | undefined): ColumnLayout {
    if (!states || states.length === 0) return layout;
    const visibility: [string, boolean][] = [];
    const widths: [string, string][] = [];
    const pins: [string, Pin][] = [];
    const ordered: { key: string; order: number }[] = [];
    for (const state of states) {
        const key = String(state.columnKey);
        if (state.visible !== undefined) visibility.push([key, state.visible]);
        if (state.width) widths.push([key, state.width]);
        if ('pin' in state) pins.push([key, state.pin]);
        if (state.order !== undefined) ordered.push({ key, order: state.order });
    }
    return {
        widths: withEntries(layout.widths, widths),
        visibility: withEntries(layout.visibility, visibility),
        pins: withEntries(layout.pins, pins),
        order: ordered.length > 0 ? ordered.sort((a, b) => a.order - b.order).map((e) => e.key) : layout.order,
    };
}

/** Everything a saved view covers. */
export interface ViewModel {
    layout: ColumnLayout;
    sort: SortState;
    sortStates: SortState[];
    columnFilters: Record<string, unknown>;
    advancedFilter: FilterGroup | null;
    globalFilter: string;
    pagination: PaginationState;
}

export function readViewState<T>(columns: readonly ColumnDef<T>[], model: ViewModel): DataTableViewState {
    return {
        version: DATA_TABLE_VIEW_STATE_VERSION,
        columns: readColumnState(columns, model.layout),
        sort: model.sort,
        sortStates: model.sortStates,
        columnFilters: model.columnFilters,
        advancedFilter: model.advancedFilter,
        globalFilter: model.globalFilter,
        pagination: model.pagination,
    };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isSort = (v: unknown): v is SortState => isObject(v) && typeof v['column'] === 'string';

/** Whether a token read from storage has the shape `applyViewState` writes from; a half-restored view is worse than none. */
function isReadableToken(s: DataTableViewState): boolean {
    const page = s.pagination as Partial<PaginationState> | undefined;
    return (
        Array.isArray(s.columns) &&
        isSort(s.sort) &&
        Array.isArray(s.sortStates) &&
        s.sortStates.every(isSort) &&
        isObject(s.columnFilters) &&
        (s.advancedFilter === null || isObject(s.advancedFilter)) &&
        typeof s.globalFilter === 'string' &&
        Number.isInteger(page?.pageIndex) &&
        (page?.pageIndex ?? -1) >= 0 &&
        Number.isInteger(page?.pageSize) &&
        (page?.pageSize ?? 0) > 0
    );
}

/**
 * The model a saved view restores to, or `null` when the token is refused: missing, from another version, or
 * malformed. A refused token changes nothing.
 */
export function applyViewState(model: ViewModel, state: DataTableViewState | null | undefined): ViewModel | null {
    if (state?.version !== DATA_TABLE_VIEW_STATE_VERSION || !isReadableToken(state)) return null;
    return {
        layout: applyColumnState(model.layout, state.columns),
        sort: state.sort,
        sortStates: state.sortStates,
        columnFilters: state.columnFilters,
        advancedFilter: state.advancedFilter,
        globalFilter: state.globalFilter,
        pagination: state.pagination,
    };
}

// ---- the server-mode query -------------------------------------------------------------------------------------

export function currentQuery(m: Pick<ViewModel, 'globalFilter' | 'columnFilters' | 'sort' | 'sortStates' | 'advancedFilter' | 'pagination'>): DataTableQuery {
    return {
        globalFilter: m.globalFilter,
        columnFilters: m.columnFilters,
        sort: m.sort,
        sortStates: m.sortStates,
        advancedFilter: m.advancedFilter,
        page: m.pagination,
    };
}

/** The filter and sort of the view without a page, for a server-side export provider. */
export function exportQuery(m: Pick<ViewModel, 'globalFilter' | 'columnFilters' | 'sort' | 'sortStates'>): DataTableExportQuery {
    return { globalFilter: m.globalFilter, columnFilters: m.columnFilters, sort: m.sort, sortStates: [...m.sortStates] };
}

const sameSort = (a: SortState, b: SortState): boolean => a.column === b.column && a.direction === b.direction;

/**
 * Whether two requests describe the same page of data, so the `query` event fires once per genuine change. Compared
 * field by field (no `JSON.stringify`: filter values are arbitrary). `columnFilters` and `advancedFilter` compare by
 * reference, the page and the sorts by value.
 */
export function sameQuery(a: DataTableQuery, b: DataTableQuery): boolean {
    return (
        a.globalFilter === b.globalFilter &&
        a.columnFilters === b.columnFilters &&
        a.advancedFilter === b.advancedFilter &&
        a.page.pageIndex === b.page.pageIndex &&
        a.page.pageSize === b.page.pageSize &&
        sameSort(a.sort, b.sort) &&
        a.sortStates.length === b.sortStates.length &&
        a.sortStates.every((sort, i) => {
            const other = b.sortStates[i];
            return other !== undefined && sameSort(sort, other);
        })
    );
}
