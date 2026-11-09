/**
 * The settings controllers read and the services they offer each other. A controller never imports another controller:
 * it `provide`s a service under a key here, and the ones that need it ask the host for that key (see
 * `data-table-registry.ts` for who provides and needs what).
 */
import type { AiProvider } from '../shared/ai.js';
import type { SlotRegistry } from '../shared/registry.js';
import type { DataTableLocale } from './data-table.locales.js';
import type {
    CellEditError,
    CellRange,
    ColumnDef,
    DataTableDisplayRow,
    DataTableExportOptions,
    DataTableExportQuery,
    DataTableLoadingTrigger,
    DataTableLoadingVisibility,
    DataTableQuery,
    EditingCell,
    EnhancedColumnDef,
    FlattenedTreeRow,
    PaginationState,
    ResolvedCellFormatting,
    RowActionContext,
    SortDirection,
    SubRowFilterMode,
    SubRowSelectionMode,
    VirtualAutoThreshold,
    VirtualRenderRange,
} from './data-table.types.js';
import type { GlobalFilterFn } from './data-table-query.js';

/** Every Angular input a controller reads, as the live value (never a snapshot). Renderer functions are the element's. */
export interface DataTableConfig<T> {
    readonly columns: readonly ColumnDef<T>[];
    readonly getRowId: (row: T) => string;
    readonly globalFilterFn: GlobalFilterFn<T> | undefined;
    readonly getChildren: (row: T) => T[] | undefined;
    readonly setChildren: (row: T, children: T[]) => T;
    readonly total: number | undefined;
    readonly locale: string | DataTableLocale | undefined;
    readonly aiProvider: AiProvider | undefined;
    readonly loading: boolean;
    readonly loadingVisibility: DataTableLoadingVisibility | undefined;
    readonly localSorting: boolean;
    readonly localPagination: boolean;
    readonly localFiltering: boolean;
    readonly showPagination: boolean;
    readonly showFooter: boolean | 'auto';
    readonly filterDebounce: number;
    readonly enableMultiSort: boolean;
    readonly maxMultiSortColumns: number;
    readonly enableRowSelection: boolean;
    readonly disabledRowIds: ReadonlySet<string> | readonly string[] | undefined;
    readonly enableRowExpansion: boolean;
    readonly enableSubRows: boolean;
    readonly subRowDefaultExpanded: boolean;
    readonly subRowSelectionMode: SubRowSelectionMode;
    readonly subRowFilterMode: SubRowFilterMode;
    readonly enableSubRowSorting: boolean;
    readonly subRowsPaginated: boolean;
    readonly groupBy: string | undefined;
    readonly groupAggregates: boolean;
    readonly enableColumnResize: boolean;
    readonly enableColumnReorder: boolean;
    readonly enableRowDrag: boolean;
    readonly localReorder: boolean;
    readonly rowDragMode: 'flat' | 'tree';
    readonly enableFloatingFilters: boolean;
    readonly enableNlFilter: boolean;
    readonly enableAdvancedFilter: boolean;
    readonly enableCopy: boolean;
    readonly enableCellFlash: boolean;
    readonly cellFlashDuration: number;
    readonly enableCellRangeSelection: boolean;
    readonly enableRangeActions: boolean;
    readonly enableFillHandle: boolean;
    readonly enableClipboardPaste: boolean;
    readonly enableEditHistory: boolean;
    readonly enableVirtualScroll: boolean | 'auto';
    readonly virtualRowHeight: number | undefined;
    readonly virtualRowBuffer: number;
    readonly virtualColumnBuffer: number;
    readonly virtualVariableRowHeight: boolean;
    readonly virtualRecycleComponents: boolean;
    readonly virtualAutoThreshold: VirtualAutoThreshold;
    readonly virtualAutoColumnWidth: number;
}

/** The query memo graph's outputs, by name, plus the rendered-row lookups every row-addressing feature shares. Lazy and memoised. */
export interface QueryService<T> {
    /** Filtered and sorted rows across every page: what export reads and what the virtual window slices (flat mode). */
    sortedData(): readonly T[];
    /** What the virtual window slices in tree mode: the visible nodes of the page, flattened. */
    visibleTreeRows(): readonly FlattenedTreeRow<T>[];
    /** The page as drawn, with group headers; data rows carry their rendered index. */
    displayRows(): readonly DataTableDisplayRow<T>[];
    /** The data rows of the page in drawn order: `data-row-index` addresses this list. */
    renderedRows(): readonly T[];
    totalItems(): number;
    currentQuery(): DataTableQuery;
    exportQuery(): DataTableExportQuery;
    renderedRowAt(index: number): T | undefined;
    renderedTreeRowAt(index: number): FlattenedTreeRow<T> | undefined;
    rowContext(row: T, index: number): RowActionContext<T>;
    cellValue(row: T, key: string | keyof T, column?: ColumnDef<T>): unknown;
    /** Header row plus cells as strings, the view copy and export share. */
    exportData(options?: DataTableExportOptions, rows?: readonly T[]): string[][];
    sortDirection(columnKey: string | keyof T): SortDirection;
    /** A header activation: updates the sort models and fires `sort-change` / `multi-sort-change`. */
    changeSort(columnKey: string | keyof T, direction: SortDirection, multi?: boolean): void;
    /** A pager activation: clamps the page to the data, updates the model and fires `page-change`. */
    changePage(state: PaginationState): void;
    /** The global filter input: waits out `filterDebounce`, resets to page 0, fires `filter-change`, announces the count. */
    changeGlobalFilter(value: string): void;
}

/** Which user action the busy overlay stands for; `loadingVisibility` can silence it per trigger. */
export interface LoadingService {
    trigger(): DataTableLoadingTrigger;
    setTrigger(trigger: DataTableLoadingTrigger): void;
    /** `loading` is on and the current trigger is not silenced. */
    visible(): boolean;
}

/** Value-aware conditional formatting of one cell; `null` when its column declares none. */
export interface FormattingService<T> {
    cell(column: ColumnDef<T>, row: T): ResolvedCellFormatting | null;
}

export interface FooterService {
    /** Whether the footer row draws. */
    visible(): boolean;
    /** Footer text by column key (`footer` or the aggregate). */
    values(): ReadonlyMap<string, string>;
}

export interface ColumnsService<T> {
    /** Resolved, ordered columns including the special ones (`_selection`, `_expander`, `_actions`). */
    enhancedColumns(): readonly EnhancedColumnDef<T>[];
    /** Column keys keyboard navigation and range selection move across, in drawn order. */
    navigableKeys(): readonly string[];
    pinOf(columnKey: string): 'left' | 'right' | undefined;
    setPin(columnKey: string, pin: 'left' | 'right' | undefined): void;
    setVisible(columnKey: string | keyof T, visible: boolean): void;
    showAll(): void;
}

/** Focus, range and editor state: one owner, because reconciling them after a render writes all of them together. */
export interface CellInteractionService {
    focusedCell(): { rowIndex: number; columnKey: string } | null;
    cellRange(): CellRange | null;
    editingCell(): EditingCell | null;
    cellEditError(): CellEditError | null;
    focusCell(rowIndex: number, columnKey: string): void;
    isCellSelected(rowIndex: number, columnKey: string): boolean;
}

export interface VirtualService {
    active(): boolean;
    /** Rows and columns currently drawn. */
    renderRange(): VirtualRenderRange;
    scrollToRow(index: number): void;
    scrollToColumn(columnKey: string): void;
}

export interface CellActionSlot<T = unknown> {
    /** Stable id (the registering addon's id, e.g. `context-menu`). */
    readonly id: string;
    /** Inline SVG markup. */
    readonly icon?: string;
    readonly ariaLabel?: string;
    readonly onClick: (event: Event, context: RowActionContext<T>) => void;
}

export interface HeaderActionSlot<T = unknown> {
    readonly id: string;
    readonly icon?: string;
    readonly ariaLabel?: string;
    readonly onClick: (event: Event, column: ColumnDef<T>) => void;
}

/** What addons register and the element draws; provided by the AddonHostController. */
export interface AddonsService<T> {
    readonly cellActions: SlotRegistry<CellActionSlot<T>>;
    readonly headerActions: SlotRegistry<HeaderActionSlot<T>>;
    /** The busy-overlay label, or null when idle. */
    busyLabel(): string | null;
    setBusy(label: string | null): void;
}

export interface DataTableProviders<T = unknown> {
    query: QueryService<T>;
    columns: ColumnsService<T>;
    interaction: CellInteractionService;
    virtual: VirtualService;
    addons: AddonsService<T>;
    loading: LoadingService;
    formatting: FormattingService<T>;
    footer: FooterService;
}
