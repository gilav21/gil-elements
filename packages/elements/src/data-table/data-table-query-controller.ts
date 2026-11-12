import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { interpolate } from './data-table.locales.js';
import type { QueryService } from './data-table-providers.js';
import {
    activeSorts,
    changeAdvancedFilterOf,
    createQueryPipeline,
    localSortApplies,
    memoLast,
    nextSortChain,
    pagesLocally,
    resetPageOf,
    slicePage,
    type QueryOutput,
} from './data-table-query.js';
import { sameFilterValue } from './data-table-filters.js';
import { buildGroupedDisplayRows, isGroupingActive, partitionIntoGroups, renumberDataRows, type RowGroup } from './data-table-group.js';
import { buildTreeIndex, filterTree, flattenTree, sortTree } from './data-table-tree.js';
import { currentQuery, exportQuery, sameQuery } from './data-table-view-state.js';
import type { ColumnDef, DataTableDisplayRow, DataTableQuery, FlattenedTreeRow, PaginationState, SortDirection, SortState } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey, stringifyValue } from './data-table.utils.js';

const FILTER_ANNOUNCE_MS = 500;
/** Server mode: how long the count waits for a query's answer it can see (new `data`, a changed `total`) before it trusts the `total` in hand. */
const ANSWER_WAIT_MS = 2000;

/** The memo graph filter -> sort -> page, the server-mode `query` event, and the header and pager gestures. */
export class QueryController<T> {
    private readonly pipeline = createQueryPipeline<T>();
    private unprovide: (() => void) | undefined;
    private unsubscribe: (() => void) | undefined;
    private lastQuery: DataTableQuery | null = null;
    private lastRows: readonly DataTableDisplayRow<T>[] | null = null;
    private cancelFilter: (() => void) | undefined;
    private cancelAnnounce: (() => void) | undefined;
    // wave5: server filtering waits for the answer before it counts (see `filteredCount`, `whenCounted`)
    /** A `query` was sent (server mode) and its rows have not arrived: `config.total` is still the previous answer's. */
    private awaitingRows = false;
    /** The announcement waiting for those rows (one: a newer filter replaces it). */
    private onRows: (() => void) | null = null;
    private unsubscribeData: (() => void) | undefined;
    /** `config.total` when the last query was sent: a different one is its answer. */
    private totalAtQuery: number | undefined;
    private cancelAnswerWait: (() => void) | undefined;

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
        const { model, resolvedLocale: locale } = this.host;
        model.batch(() => {
            model.set('globalFilter', value);
            this.resetPage();
        });
        this.host.emit('filter-change', value);
        this.cancelAnnounce?.();
        this.onRows = null; // a newer filter (also clearing it) drops an announcement still waiting for the previous one's answer
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            if (!value.trim()) return this.host.announce(locale.filterClearedAnnouncement);
            // ONE rule with the column and advanced filter announcement: `filteredCount` (server filtering: the total of the ANSWER, so wait for it).
            this.whenCounted((count) => this.host.announce(interpolate(count === 1 ? locale.filterResultAnnouncement : locale.filterResultsAnnouncement, { count, value })));
        }, FILTER_ANNOUNCE_MS);
    }

    /**
     * Calls `say` with the filtered count: now, or (server filtering, the request still unanswered) once the answer's rows arrive. No count
     * (server filtering without `total`) says nothing. A newer call replaces a waiting one.
     */
    private whenCounted(say: (count: number) => void): void {
        this.onRows = null;
        const now = (): void => {
            const count = this.service.filteredCount();
            if (count !== undefined) say(count);
        };
        if (this.host.config.localFiltering || !this.awaitingRows) now();
        else this.onRows = now;
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
        // wave 5, package A (filters): the column filter write and the count. They are the only part of this file wave 5 edits.
        // The value is stored as given (`null` stays a key, Angular cmp 3629), with the page reset in ONE batch; the loading controller marks the
        // `filtering` trigger from the `columnFilters` key. The model fires `column-filters-change`; no other event.
        changeColumnFilter: (key, value) => {
            const { model } = this.host;
            const filters = model.get('columnFilters');
            const name = String(key);
            // An equal value (a Clear of an empty panel, the same day again, the same text after a debounce) changes nothing: no new object, no page reset, no event.
            if (sameFilterValue(Object.hasOwn(filters, name) ? filters[name] : undefined, value)) return;
            this.onRows = null; // a newer filter drops an announcement still waiting for the previous one's answer
            model.batch(() => {
                model.set('columnFilters', { ...model.get('columnFilters'), [String(key)]: value });
                this.resetPage();
            });
        },
        changeAdvancedFilter: (group) => {
            this.onRows = null;
            changeAdvancedFilterOf(this.host.model, (page) => this.host.emit('page-change', page), group);
        },
        whenCounted: (say) => this.whenCounted(say),
        // Server filtering: the held rows are not the matches, so the server's `total`, but only once the ANSWER to the last query arrived (the next
        // `data` from outside): before that, `total` is the previous answer's and `undefined` says "not known yet".
        filteredCount: () => (this.host.config.localFiltering ? this.output().filtered.length : this.awaitingRows ? undefined : this.host.config.total),
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
            // Only server filtering waits for an answer: a local table counts its own rows (no timer, no extra render after a local sort).
            if (!this.host.config.localFiltering) {
                this.awaitingRows = true;
                this.totalAtQuery = this.host.config.total;
                this.cancelAnswerWait?.();
                // The fallback: a consumer that answers in a way the table cannot see (rows mutated in place, the same total) is taken as answered.
                this.cancelAnswerWait = this.host.disposables.timeout(() => this.answered(), ANSWER_WAIT_MS);
            }
            this.host.emit('query', next);
        });
        // The answer's rows (a `data` set from outside) end the wait; `total` is read a tick later, so a consumer may set it after `data`.
        this.unsubscribeData = this.host.model.subscribe('data', (_, origin) => {
            if (origin !== 'internal') this.answered();
        });
    }

    /**
     * The answer to the last query is in (its `data`, a changed `total`, or the `ANSWER_WAIT_MS` fallback): `filteredCount` answers the total
     * again, a waiting announcement is spoken a tick later (the consumer may set `total` after `data`), and the table renders, so a controller
     * that waits for the count in its own update sees it.
     *
     * KNOWN LIMITATION: the table cannot tell an answer from any other `data` the consumer assigns, so in server mode ANY outside `data`
     * assignment ends the wait (an unrelated push, a live update, between the query and its answer, ends it early and the count spoken is
     * that moment's `total`).
     */
    private answered(): void {
        if (!this.awaitingRows) return;
        this.awaitingRows = false;
        this.cancelAnswerWait?.();
        this.cancelAnswerWait = undefined;
        const waiting = this.onRows;
        this.onRows = null;
        if (waiting) this.host.disposables.timeout(waiting, 0);
        this.host.requestRender();
    }

    detach(): void {
        this.unsubscribe?.();
        this.unsubscribeData?.();
        this.cancelAnswerWait?.();
        this.cancelAnswerWait = undefined;
        this.onRows = null;
        this.awaitingRows = false;
        this.unprovide?.();
        this.cancelFilter?.();
        this.cancelAnnounce?.();
        this.lastRows = null;
    }

    hostUpdate(): void {
        // A changed `total` is an answer too (rows mutated in place keep the same `data` array).
        if (this.awaitingRows && this.host.config.total !== this.totalAtQuery) this.answered();
        this.clampPage();
        const next = this.displayRows();
        if (next !== this.lastRows) {
            this.lastRows = next;
            this.host.topics.emit('rows');
        }
    }
}
