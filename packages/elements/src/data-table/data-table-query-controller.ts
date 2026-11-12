import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { interpolate } from './data-table.locales.js';
import type { QueryService } from './data-table-providers.js';
import {
    activeSorts,
    changeAdvancedFilterOf,
    createQueryPipeline,
    memoLast,
    nextSortChain,
    pagesLocally,
    resetPageOf,
    slicePage,
    type QueryOutput,
} from './data-table-query.js';
import { buildGroupedDisplayRows, isGroupingActive, partitionIntoGroups, renumberDataRows, type RowGroup } from './data-table-group.js';
import { buildTreeIndex, filterTree, flattenTree, sortTree } from './data-table-tree.js';
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

    private readonly indexOf = memoLast(buildTreeIndex<T>);

    private readonly rows = memoLast((sorted: T[], page: PaginationState, local: boolean): readonly DataTableDisplayRow<T>[] =>
        (local ? slicePage(sorted, page) : sorted).map((row, index) => ({ kind: 'data', row, index })),
    );

    // ---- tree mode: filter -> sort -> flatten -> page, each stage remembered on the identity of its inputs ----------

    private readonly filteredTree = memoLast(
        (data: T[], columns: readonly ColumnDef<T>[], globalFilter: string, fn: DataTableCoreHost<T>['config']['globalFilterFn'], columnFilters: Record<string, unknown>,
         mode: DataTableCoreHost<T>['config']['subRowFilterMode'], local: boolean, getChildren: DataTableCoreHost<T>['config']['getChildren'], setChildren: DataTableCoreHost<T>['config']['setChildren']): T[] =>
            local ? filterTree(data, { columns, globalFilter, globalFilterFn: fn, columnFilters, mode, getChildren, setChildren }) : data,
    );

    /** The sorts are read inside, so `sortKey` (their value as a string) is what tells the memo they changed. */
    private readonly sortedTree = memoLast(
        (rows: T[], _sortKey: string, columns: readonly ColumnDef<T>[], enabled: boolean, getChildren: DataTableCoreHost<T>['config']['getChildren'], setChildren: DataTableCoreHost<T>['config']['setChildren']): T[] => {
            const sorts = this.sorts();
            return enabled && sorts.length > 0 ? sortTree(rows, sorts, columns, getChildren, setChildren) : rows;
        },
    );

    private readonly visibleTree = memoLast(
        (roots: T[], expanded: Record<string, boolean>, getId: (row: T) => string, getChildren: DataTableCoreHost<T>['config']['getChildren'], defaultExpandedDepth: number): readonly FlattenedTreeRow<T>[] =>
            flattenTree(roots, { getId, getChildren, expanded, defaultExpandedDepth }),
    );

    /**
     * The page of tree rows: the visible list sliced as it is (`subRowsPaginated`), or the rows of the roots on the page,
     * each with its expanded descendants. Sibling counts stay those of the whole tree either way.
     */
    private readonly pagedTree = memoLast(
        (visible: readonly FlattenedTreeRow<T>[], roots: T[], page: PaginationState, local: boolean, paginated: boolean, getId: (row: T) => string): readonly FlattenedTreeRow<T>[] => {
            if (!local) return visible;
            if (paginated) return slicePage(visible, page);
            const onPage = new Set(slicePage(roots, page).map(getId));
            return visible.filter((r) => onPage.has(r.path[0] as string));
        },
    );

    private readonly treeDisplay = memoLast((rows: readonly FlattenedTreeRow<T>[]): readonly DataTableDisplayRow<T>[] => rows.map((r, index) => ({ kind: 'data', row: r.row, index })));

    private virtualActive(): boolean {
        return this.host.provider('virtual')?.active() ?? false;
    }

    private pagesLocally(): boolean {
        const { config } = this.host;
        return pagesLocally(config.localPagination, config.showPagination, this.virtualActive());
    }

    /** Every stage of the tree; empty outside tree mode. `roots` are the filtered, sorted top-level rows. */
    private tree(): { roots: T[]; visible: readonly FlattenedTreeRow<T>[]; page: readonly FlattenedTreeRow<T>[] } {
        const { config, model } = this.host;
        if (!config.enableSubRows) return { roots: [], visible: [], page: [] };
        const filtered = this.filteredTree(model.get('data'), config.columns, model.get('globalFilter'), config.globalFilterFn, model.get('columnFilters'), config.subRowFilterMode, config.localFiltering, config.getChildren, config.setChildren);
        const sortKey = this.sorts().map((s) => `${s.column}:${s.direction}`).join('|');
        const roots = this.sortedTree(filtered, sortKey, config.columns, config.localSorting && config.enableSubRowSorting, config.getChildren, config.setChildren);
        const visible = this.visibleTree(roots, model.get('subRowExpandedRows'), config.getRowId, config.getChildren, config.subRowDefaultExpanded ? -1 : 0);
        return { roots, visible, page: this.pagedTree(visible, roots, model.get('paginationState'), this.pagesLocally(), config.subRowsPaginated, config.getRowId) };
    }

    // ---- grouping: partition -> header rows -> page --------------------------------------------------------------

    private readonly partition = memoLast((sorted: T[], key: string, columns: readonly ColumnDef<T>[]): RowGroup<T>[] => {
        const column = columns.find((c) => String(c.accessorKey) === key);
        return partitionIntoGroups(sorted, (row) => getCellValue(row, key, column));
    });

    private readonly grouped = memoLast((groups: RowGroup<T>[], collapsed: Record<string, boolean>, columns: readonly ColumnDef<T>[], withAggregates: boolean) =>
        buildGroupedDisplayRows(groups, collapsed, columns, withAggregates),
    );

    private readonly groupedPage = memoLast((grouped: readonly DataTableDisplayRow<T>[], page: PaginationState, local: boolean): readonly DataTableDisplayRow<T>[] =>
        local ? renumberDataRows(slicePage(grouped, page)) : grouped,
    );

    private groupingOn(): boolean {
        const { config } = this.host;
        return isGroupingActive(config.groupBy, config.enableSubRows, this.virtualActive());
    }

    private groups(): RowGroup<T>[] {
        const { config } = this.host;
        return this.groupingOn() && config.groupBy ? this.partition(this.output().sorted, config.groupBy, config.columns) : [];
    }

    private groupedRows(): readonly DataTableDisplayRow<T>[] {
        const { config, model } = this.host;
        return this.grouped(this.groups(), model.get('collapsedGroups'), config.columns, config.groupAggregates);
    }

    private displayRows(): readonly DataTableDisplayRow<T>[] {
        const { config, model } = this.host;
        const page = model.get('paginationState');
        if (config.enableSubRows) return this.treeDisplay(this.tree().page);
        if (this.groupingOn()) return this.groupedPage(this.groupedRows(), page, this.pagesLocally());
        return this.rows(this.output().sorted, page, this.pagesLocally());
    }

    private readonly dataRowsOf = memoLast((display: readonly DataTableDisplayRow<T>[]): readonly T[] => display.flatMap((r) => (r.kind === 'data' ? [r.row] : [])));

    /** The drawn data rows; one list per display list, since keys, clicks and selection ask for it often. */
    private renderedRows(): readonly T[] {
        return this.dataRowsOf(this.displayRows());
    }

    /** The rows the pager counts: grouped display rows (headers included), roots or visible tree rows, or the sorted rows. */
    private totalItems(): number {
        const { config } = this.host;
        const all = (count: number): number => (config.localPagination ? count : (config.total ?? count));
        if (config.enableSubRows) {
            const tree = this.tree();
            return all(config.subRowsPaginated ? tree.visible.length : tree.roots.length);
        }
        return all(this.groupingOn() ? this.groupedRows().length : this.output().sorted.length);
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

    /** A page past the end (the data shrank, or the page size grew) goes back to the last page, announced like any page change. */
    private clampPage(): void {
        const page = this.host.model.get('paginationState');
        const { config } = this.host;
        // Server rows with no known total say nothing about how many pages there are.
        if (!config.showPagination || (!config.localPagination && config.total === undefined) || page.pageSize <= 0 || page.pageIndex === 0) return;
        if (page.pageIndex > Math.max(0, Math.ceil(this.totalItems() / page.pageSize) - 1)) this.service.changePage(page);
    }

    private resetPage(): void {
        resetPageOf(this.host.model, (page) => this.host.emit('page-change', page));
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
            // Server filtering: the held rows are not the matches, so use the server's total or say nothing.
            const count = this.host.config.localFiltering ? this.output().filtered.length : this.host.config.total;
            if (count === undefined) return;
            this.host.announce(interpolate(count === 1 ? locale.filterResultAnnouncement : locale.filterResultsAnnouncement, { count, value }));
        }, FILTER_ANNOUNCE_MS);
    }

    private readonly service: QueryService<T> = {
        sortedData: () => this.output().sorted,
        visibleTreeRows: () => this.tree().visible,
        treeRows: () => this.tree().page,
        treeIndex: () => this.indexOf(this.host.model.get('data'), this.host.config.getRowId, this.host.config.getChildren),
        groupRows: () => this.groups(),
        rowWindowSource: () => (this.host.config.enableSubRows ? this.tree().visible : this.output().sorted),
        displayRows: () => this.displayRows(),
        renderedRows: () => this.renderedRows(),
        totalItems: () => this.totalItems(),
        currentQuery: () => this.currentQuery(),
        exportQuery: () => {
            const { model } = this.host;
            return exportQuery({ globalFilter: model.get('globalFilter'), columnFilters: model.get('columnFilters'), sort: model.get('sortState'), sortStates: model.get('multiSortState') });
        },
        renderedRowAt: (index) => this.renderedRows()[index],
        renderedTreeRowAt: (index) => this.tree().page[index],
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
        // wave 5, package A (filters) implements the column filter and the count; joint step 0 leaves them inert. They are the only part of this file wave 5
        // edits. The ADVANCED filter is real already (the `advancedFilter` model key filters the rows): wave 5 A builds on it (announcement, builder UI).
        changeColumnFilter: () => undefined,
        changeAdvancedFilter: (group) => changeAdvancedFilterOf(this.host.model, (page) => this.host.emit('page-change', page), group),
        filteredCount: () => undefined,
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
        this.clampPage();
        const next = this.displayRows();
        if (next !== this.lastRows) {
            this.lastRows = next;
            this.host.topics.emit('rows');
        }
    }
}
