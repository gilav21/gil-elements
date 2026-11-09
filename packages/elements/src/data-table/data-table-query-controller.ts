import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { interpolate } from './data-table.locales.js';
import type { QueryService } from './data-table-providers.js';
import {
    activeSorts,
    createQueryPipeline,
    memoLast,
    nextSortChain,
    pagesLocally,
    slicePage,
    type QueryOutput,
} from './data-table-query.js';
import { currentQuery, exportQuery, sameQuery } from './data-table-view-state.js';
import type { ColumnDef, DataTableDisplayRow, DataTableQuery, FlattenedTreeRow, PaginationState, SortDirection, SortState } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey, stringifyValue } from './data-table.utils.js';

const FILTER_ANNOUNCE_MS = 500;

/** The memo graph filter -> sort -> page, the server-mode `query` event, and the header and pager gestures. */
export class QueryController<T> {
    private readonly pipeline = createQueryPipeline<T>();
    private unprovide: (() => void) | undefined;
    private unsubscribe: (() => void) | undefined;
    private lastQuery: DataTableQuery | null = null;
    private lastRows: readonly DataTableDisplayRow<T>[] | null = null;
    private cancelFilter: (() => void) | undefined;
    private cancelAnnounce: (() => void) | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private output(): QueryOutput<T> {
        const { config, model } = this.host;
        return this.pipeline({
            data: model.get('data'),
            columns: config.columns,
            globalFilter: model.get('globalFilter'),
            globalFilterFn: config.globalFilterFn,
            columnFilters: model.get('columnFilters'),
            advancedFilter: model.get('advancedFilter'),
            localFiltering: config.localFiltering,
            localSorting: config.localSorting,
            sorts: this.sorts(),
        });
    }

    private sorts(): SortState[] {
        const { config, model } = this.host;
        return activeSorts(config.enableMultiSort, model.get('sortState'), model.get('multiSortState'));
    }

    private readonly rows = memoLast((sorted: T[], page: PaginationState, local: boolean): readonly DataTableDisplayRow<T>[] =>
        (local ? slicePage(sorted, page) : sorted).map((row, index) => ({ kind: 'data', row, index })),
    );

    private displayRows(): readonly DataTableDisplayRow<T>[] {
        const { config, model } = this.host;
        const virtual = this.host.provider('virtual')?.active() ?? false;
        return this.rows(this.output().sorted, model.get('paginationState'), pagesLocally(config.localPagination, config.showPagination, virtual));
    }

    private renderedRows(): readonly T[] {
        return this.displayRows().flatMap((r) => (r.kind === 'data' ? [r.row] : []));
    }

    private totalItems(): number {
        const sorted = this.output().sorted;
        return this.host.config.localPagination ? sorted.length : (this.host.config.total ?? sorted.length);
    }

    private columnLabel(key: string): string {
        return this.host.config.columns.find((c) => String(c.accessorKey) === key)?.header || key;
    }

    private announceSort(key: string, direction: SortDirection): void {
        const locale = this.host.resolvedLocale;
        const column = this.columnLabel(key);
        if (direction === 'asc') this.host.announce(interpolate(locale.sortedAscendingAnnouncement, { column }));
        else if (direction === 'desc') this.host.announce(interpolate(locale.sortedDescendingAnnouncement, { column }));
        else if (this.service.sortDirection(key) !== null) this.host.announce(interpolate(locale.sortRemovedAnnouncement, { column }));
    }

    private resetPage(): void {
        const page = this.host.model.get('paginationState');
        if (page.pageIndex === 0) return;
        const next = { ...page, pageIndex: 0 };
        this.host.model.set('paginationState', next);
        this.host.emit('page-change', next);
    }

    private applyGlobalFilter(value: string): void {
        const { model, resolvedLocale: locale } = this.host;
        model.batch(() => {
            model.set('globalFilter', value);
            this.resetPage();
        });
        this.host.emit('filter-change', value);
        this.cancelAnnounce?.();
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            if (!value.trim()) return this.host.announce(locale.filterClearedAnnouncement);
            const count = this.output().filtered.length;
            this.host.announce(interpolate(count === 1 ? locale.filterResultAnnouncement : locale.filterResultsAnnouncement, { count, value }));
        }, FILTER_ANNOUNCE_MS);
    }

    private readonly service: QueryService<T> = {
        sortedData: () => this.output().sorted,
        visibleTreeRows: (): readonly FlattenedTreeRow<T>[] => [],
        displayRows: () => this.displayRows(),
        renderedRows: () => this.renderedRows(),
        totalItems: () => this.totalItems(),
        currentQuery: () => this.currentQuery(),
        exportQuery: () => {
            const { model } = this.host;
            return exportQuery({ globalFilter: model.get('globalFilter'), columnFilters: model.get('columnFilters'), sort: model.get('sortState'), sortStates: model.get('multiSortState') });
        },
        renderedRowAt: (index) => this.renderedRows()[index],
        renderedTreeRowAt: () => undefined,
        rowContext: (row, index) => {
            const selection = this.host.model.get('rowSelection');
            const id = this.host.config.getRowId(row);
            return { row, index, selected: Object.hasOwn(selection, id) && selection[id] === true };
        },
        cellValue: (row, key, column) => getCellValue(row, key, column),
        exportData: (options = {}, rows) => {
            const columns = this.visibleDataColumns();
            const body = (rows ?? (options.onlyFiltered === false ? this.host.model.get('data') : this.output().sorted)).map((row) =>
                columns.map((c) => (c.cell ? c.cell(row) : stringifyValue(getCellValue(row, c.accessorKey, c)))),
            );
            return options.includeHeaders === false ? body : [columns.map((c) => c.header), ...body];
        },
        sortDirection: (key) => this.sorts().find((s) => s.column === String(key))?.direction ?? null,
        changeSort: (key, direction, multi = false) => {
            const { config, model } = this.host;
            const column = String(key);
            this.announceSort(column, direction);
            model.batch(() => {
                if (config.enableMultiSort && multi) {
                    const { chain, primary } = nextSortChain(model.get('multiSortState'), column, direction, true, config.maxMultiSortColumns);
                    model.set('multiSortState', chain);
                    model.set('sortState', primary);
                    this.host.emit('multi-sort-change', chain);
                    this.host.emit('sort-change', primary);
                } else {
                    const next: SortState = { column, direction };
                    model.set('sortState', next);
                    this.host.emit('sort-change', next);
                    if (config.enableMultiSort) {
                        const chain = direction ? [next] : [];
                        model.set('multiSortState', chain);
                        this.host.emit('multi-sort-change', chain);
                    }
                }
                this.resetPage();
            });
        },
        changePage: (state) => {
            const pageSize = state.pageSize > 0 ? state.pageSize : this.host.model.get('paginationState').pageSize;
            const lastPage = Math.max(0, Math.ceil(this.totalItems() / pageSize) - 1);
            const next = { pageIndex: Math.min(lastPage, Math.max(0, state.pageIndex)), pageSize };
            this.host.model.set('paginationState', next);
            this.host.emit('page-change', next);
        },
        changeGlobalFilter: (value) => {
            this.cancelFilter?.();
            const debounce = this.host.config.filterDebounce;
            if (debounce > 0) this.cancelFilter = this.host.disposables.timeout(() => this.applyGlobalFilter(value), debounce);
            else this.applyGlobalFilter(value);
        },
    };

    private visibleDataColumns(): ColumnDef<T>[] {
        const columns = requireProvider(this.host, 'columns');
        return columns.enhancedColumns().filter((c) => !isSpecialColumnKey(c.accessorKey));
    }

    private currentQuery(): DataTableQuery {
        const { model } = this.host;
        return currentQuery({
            globalFilter: model.get('globalFilter'),
            columnFilters: model.get('columnFilters'),
            sort: model.get('sortState'),
            sortStates: model.get('multiSortState'),
            advancedFilter: model.get('advancedFilter'),
            pagination: model.get('paginationState'),
        });
    }

    attach(): void {
        this.unprovide = this.host.provide('query', this.service);
        this.lastQuery = this.currentQuery();
        // The server-mode request: once per genuine change, never for the initial state, one event for a whole batch.
        this.unsubscribe = this.host.model.onFlush(() => {
            const next = this.currentQuery();
            if (this.lastQuery && sameQuery(this.lastQuery, next)) return;
            this.lastQuery = next;
            this.host.emit('query', next);
        });
    }

    detach(): void {
        this.unsubscribe?.();
        this.unprovide?.();
        this.cancelFilter?.();
        this.cancelAnnounce?.();
        this.lastRows = null;
    }

    hostUpdate(): void {
        const next = this.displayRows();
        if (next !== this.lastRows) {
            this.lastRows = next;
            this.host.topics.emit('rows');
        }
    }
}
