import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { interpolate } from './data-table.locales.js';
import type { ModelOrigin } from './data-table-model.js';
import type { QueryService } from './data-table-providers.js';
import {
    activeSorts,
    changeAdvancedFilterOf,
    countConditions,
    createQueryPipeline,
    localSortApplies,
    memoLast,
    nextSortChain,
    pagesLocally,
    resetPageOf,
    slicePage,
    type QueryOutput,
} from './data-table-query.js';
import { anyFilterOn, sameFilterValue, sameStructure } from './data-table-filters.js';

/** How long a filter result announcement waits for the edits to settle (D7): ONE value for every filter announcement (all of them are here). */
export const FILTER_ANNOUNCE_MS = 500;
import { buildGroupedDisplayRows, isGroupingActive, partitionIntoGroups, renumberDataRows, type RowGroup } from './data-table-group.js';
import { buildTreeIndex, filterTree, flattenTree, sortTree } from './data-table-tree.js';
import { currentQuery, exportQuery, sameQuery } from './data-table-view-state.js';
import type { ColumnDef, DataTableDisplayRow, DataTableQuery, FlattenedTreeRow, PaginationState, SortDirection, SortState } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey, stringifyValue } from './data-table.utils.js';

/** The memo graph filter -> sort -> page, the server-mode `query` event, and the header and pager gestures. */
export class QueryController<T> {
    private readonly pipeline = createQueryPipeline<T>();
    private unprovide: (() => void) | undefined;
    private unsubscribe: (() => void) | undefined;
    private lastQuery: DataTableQuery | null = null;
    private lastRows: readonly DataTableDisplayRow<T>[] | null = null;
    private cancelFilter: (() => void) | undefined;
    /** The ONE waiting filter announcement (global, column, advanced, a restore): a newer filter change or announcement replaces it. */
    private cancelAnnounce: (() => void) | undefined;
    private unsubscribeFilters: (() => void) | undefined;

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
        const roots = this.sortedTree(filtered, sortKey, config.columns, localSortApplies(config.localSorting, true, config.enableSubRowSorting), config.getChildren, config.setChildren);
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
        const { model } = this.host;
        model.batch(() => {
            model.set('globalFilter', value);
            this.resetPage();
        });
        this.host.emit('filter-change', value);
        this.announceGlobal(value);
    }

    /**
     * Schedules THE filter announcement, replacing a waiting one (the latest filter change speaks, once, after the edits settled).
     */
    private announce(say: () => void): void {
        this.filterChanged();
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            this.cancelAnnounce = undefined;
            say();
        }, FILTER_ANNOUNCE_MS);
    }

    /** The global filter's result announcement (the typed filter, or a restored view state's global text): main's rule, server filtering too. */
    private announceGlobal(value: string): void {
        const { resolvedLocale: locale } = this.host;
        this.announce(() => {
            if (!value.trim()) return this.host.announce(locale.filterClearedAnnouncement);
            // Server filtering: the held rows are not the matches, so use the server's total or say nothing.
            const count = this.host.config.localFiltering ? this.output().filtered.length : this.host.config.total;
            if (count === undefined) return;
            this.host.announce(interpolate(count === 1 ? locale.filterResultAnnouncement : locale.filterResultsAnnouncement, { count, value }));
        });
    }

    /** Drops the global filter write still waiting on `filterDebounce`. */
    private dropPendingGlobal(): void {
        this.cancelFilter?.();
        this.cancelFilter = undefined;
    }

    /** The overall result of the column and advanced filters (also a restored view state): the matching rows, or that every filter is cleared. */
    private announceFilters(): void {
        const { config, model, resolvedLocale: locale } = this.host;
        // Server filtering: the rows held are not the matches and the answer's count is not known here, so a column / advanced filter change
        // announces nothing (it still replaces a waiting announcement).
        if (!config.localFiltering) return this.filterChanged();
        this.announce(() => {
            if (!anyFilterOn(config.columns, model.get('columnFilters'), countConditions(model.get('advancedFilter')), model.get('globalFilter'))) {
                return this.host.announce(locale.filtersClearedAnnouncement);
            }
            const count = this.output().filtered.length;
            this.host.announce(count === 1 ? locale.filteredRowOneAnnouncement : interpolate(locale.filteredRowsAnnouncement, { count }));
        });
    }

    /** A filter change (global, column, advanced, an outside write): the announcement still waiting is for an older change and says nothing. */
    private filterChanged(): void {
        this.cancelAnnounce?.();
        this.cancelAnnounce = undefined;
    }

    private readonly service: QueryService<T> = {
        sortedData: () => this.output().sorted,
        visibleTreeRows: () => this.tree().visible,
        treeRoots: () => this.tree().roots,
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
            // `onlyVisible: false`: every data column as defined, hidden ones included, in definition order (Angular `getExportData`, cmp 4190-4202).
            // A duplicated key counts once, the first column (as drawn: indexColumns).
            const all = (): ColumnDef<T>[] => {
                const seen = new Set<string>();
                return this.host.config.columns.filter((c) => !isSpecialColumnKey(c.accessorKey) && !seen.has(String(c.accessorKey)) && Boolean(seen.add(String(c.accessorKey))));
            };
            const columns = options.onlyVisible === false ? all() : this.visibleDataColumns();
            const body = (rows ?? (options.onlyFiltered === false ? this.host.model.get('data') : this.output().sorted)).map((row) =>
                columns.map((c) => (c.cell ? c.cell(row) : stringifyValue(getCellValue(row, c.accessorKey, c)))),
            );
            return options.includeHeaders === false ? body : [columns.map((c) => c.header), ...body];
        },
        rawRows: () => this.host.model.get('data'),
        rowId: (row) => this.host.config.getRowId(row),
        applyFilters: (spec) => {
            const { globalFilter, columnFilters } = spec;
            const { model } = this.host;
            // The caller sets the global filter explicitly: a typed text still waiting on the debounce is dropped, whether or not the value differs.
            if (Object.hasOwn(spec, 'globalFilter')) {
                this.dropPendingGlobal();
                this.host.requestRender(); // the toolbar box shows the model text again (it still shows the dropped one when the model is unchanged)
            }
            // Only the parts given, and only when they differ (per key for the column filters): an equal spec writes nothing, resets no page, fires nothing.
            const globalChanged = globalFilter !== undefined && globalFilter !== model.get('globalFilter');
            const current = model.get('columnFilters');
            const columnsChanged =
                columnFilters !== undefined &&
                [...new Set([...Object.keys(current), ...Object.keys(columnFilters)])].some(
                    (key) => Object.hasOwn(current, key) !== Object.hasOwn(columnFilters, key) || !sameFilterValue(current[key], columnFilters[key]),
                );
            if (!globalChanged && !columnsChanged) return;
            model.batch(() => {
                if (globalChanged) model.set('globalFilter', globalFilter);
                if (columnsChanged) model.set('columnFilters', { ...columnFilters });
                this.resetPage();
            });
            if (globalChanged) this.host.emit('filter-change', globalFilter);
            this.announceFilters();
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
        // wave 5, package A (filters) added to this file: the column filter write and `filteredCount` below, `announceFilters` / `filtersRestored`
        // and the one announcement slot they share with the global filter (`announce`), and the outside-write watch in `attach` (an outside filter
        // write clears a waiting announcement; an outside global text drops a typed one still waiting).
        // The value is stored as given (`null` stays a key, Angular cmp 3629), with the page reset in ONE batch; the loading controller marks the
        // `filtering` trigger from the `columnFilters` key. The model fires `column-filters-change`; no other event.
        changeColumnFilter: (key, value) => {
            const { model } = this.host;
            const filters = model.get('columnFilters');
            const name = String(key);
            // An equal value (a Clear of an empty panel, the same day again, the same text after a debounce, a fresh copy of the same range) changes
            // nothing: no new object, no page reset, no event, and a waiting announcement stays.
            if (sameFilterValue(Object.hasOwn(filters, name) ? filters[name] : undefined, value)) return;
            model.batch(() => {
                model.set('columnFilters', { ...filters, [name]: value });
                this.resetPage();
            });
        },
        // ONE no-op rule (`changeAdvancedFilterOf`): an unchanged tree is no filter change (the filter UI announces nothing for it).
        changeAdvancedFilter: (group) => changeAdvancedFilterOf(this.host.model, (page) => this.host.emit('page-change', page), group),
        // The filter UI hands over each column / advanced write it hears: the latest one speaks.
        announceFilters: () => this.announceFilters(),
        filtersRestored: (globalChanged) => {
            if (globalChanged) this.dropPendingGlobal(); // the restore replaced the global text: a typed one still waiting would overwrite it
            const global = this.host.model.get('globalFilter');
            // ONE announcement for the restore (it replaces the filter UI's for the batch's own write): a new global text speaks as the global
            // filter does (its count reflects every filter); otherwise (an emptied global text too) the overall count, or that every filter is cleared.
            if (globalChanged && global.trim() !== '') this.announceGlobal(global);
            else this.announceFilters();
        },
        // Server filtering: the held rows are not the matches; the server's `total` (as the consumer gave it).
        filteredCount: () => (this.host.config.localFiltering ? this.output().filtered.length : this.host.config.total),
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
        // wave5: a consumer's own write of a filter (the property) is a filter change too: the announcement still waiting (for an older change)
        // says nothing, and it announces nothing itself. An ECHO (a new object structurally equal to the value held, a framework's two-way binding
        // writing back what the table emitted) is no change at all.
        const { model } = this.host;
        const watch = (key: 'columnFilters' | 'advancedFilter' | 'globalFilter'): (() => void) => {
            let last: unknown = model.get(key);
            return model.subscribe(key, (value: unknown, origin: ModelOrigin) => {
                const echo = sameStructure(last, value);
                last = value;
                if (origin !== 'property' || echo) return;
                // The global text replaced from outside: a typed one still waiting on the debounce would overwrite it, so it is dropped.
                if (key === 'globalFilter') this.dropPendingGlobal();
                this.filterChanged();
            });
        };
        const filterSubscriptions = [watch('columnFilters'), watch('advancedFilter'), watch('globalFilter')];
        this.unsubscribeFilters = () => filterSubscriptions.forEach((undo) => undo());
    }

    detach(): void {
        this.unsubscribe?.();
        this.unsubscribeFilters?.();
        this.unsubscribeFilters = undefined;
        this.filterChanged(); // the waiting announcement goes with the table
        this.unprovide?.();
        this.cancelFilter?.();
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
