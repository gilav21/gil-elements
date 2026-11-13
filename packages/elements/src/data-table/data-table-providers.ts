/**
 * The settings controllers read and the services they offer each other. A controller never imports another controller:
 * it `provide`s a service under a key here, and the ones that need it ask the host for that key (see
 * `data-table-registry.ts` for who provides and needs what).
 */
import type { AiProvider } from '../shared/ai.js';
import type { SlotRegistry } from '../shared/registry.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { NormalizedRange } from './data-table-range.js';
import type {
    BodyWindow,
    CellEditError,
    CellFlashDirection,
    CellRange,
    ColumnDef,
    DataTableAiFillOptions,
    DataTableColumnState,
    DataTableViewState,
    DataTableDisplayRow,
    DataTableExportOptions,
    DataTableExportQuery,
    DataTableLoadingTrigger,
    DataTableLoadingVisibility,
    DataTableQuery,
    EditingCell,
    EnhancedColumnDef,
    FilterGroup,
    FlattenedTreeRow,
    PaginationState,
    RangeAggregateStats,
    RangeChartPayload,
    ResolvedCellFormatting,
    RowActionContext,
    RowDragPosition,
    RowReorderEvent,
    SortDirection,
    SubRowFilterMode,
    SubRowSelectionMode,
    VirtualAutoThreshold,
    VirtualRenderRange,
} from './data-table.types.js';
import type { GlobalFilterFn } from './data-table-query.js';
import type { TreeIndex } from './data-table-tree.js';

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
    /** A veto on a drop: false refuses the target (no indicator, no drop). Undefined allows every drop. */
    readonly rowDragAllowDrop: ((dragRow: T, targetRow: T, position: RowDragPosition) => boolean) | undefined;
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
    /** The filtered, sorted top-level rows of the tree, their children filtered and sorted with them (tree mode; empty otherwise): the whole tree the table draws, whatever is collapsed or paged. */
    treeRoots(): readonly T[];
    /** The tree rows of the page as drawn (tree mode). */
    treeRows(): readonly FlattenedTreeRow<T>[];
    /** Id -> node, parent, children and descendants; rebuilt only when `data`, `getRowId` or `getChildren` change. */
    treeIndex(): TreeIndex;
    /** Every group of the sorted rows across pages, in insertion order (copy reads it; collapsed groups included). */
    groupRows(): readonly { readonly groupKey: string; readonly rows: readonly T[] }[];
    /** What the virtual window slices: the sorted rows (flat) or the visible tree rows (tree), never the paged list. */
    rowWindowSource(): readonly T[] | readonly FlattenedTreeRow<T>[];
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
    /** Header row plus cells as strings, the view copy and export share. `onlyVisible: false` includes the hidden data columns. */
    exportData(options?: DataTableExportOptions, rows?: readonly T[]): string[][];
    /** Wave 7: the global text the toolbar box shows: the typed text while it waits on `filterDebounce`, else the model value. */
    globalText(): string;
    /** Wave 7: `data` as given, unfiltered and unsorted (Angular `getRawRows`). */
    rawRows(): readonly T[];
    /** Wave 7: the row's id (`getRowId`). */
    rowId(row: T): string;
    /**
     * Wave 7 (spec D5; the NL filter and the AI use it). A given `globalFilter` replaces the global text; a given `columnFilters` REPLACES the whole
     * column-filter record (columns it leaves out are cleared); an omitted key leaves that part untouched. A part equal to the current value is not
     * written; what changed is written in ONE model batch with the page reset to 0. `filter-change` fires when the global text changed, and the result
     * is announced: through the global path when the global text changed to a NON-empty value, else as the overall filter result. A `globalFilter` key drops a typed global
     * text still waiting on the debounce, and a `columnFilters` key every floating column write still waiting, whatever their values.
     */
    applyFilters(spec: { readonly globalFilter?: string; readonly columnFilters?: Readonly<Record<string, unknown>> }): void;
    sortDirection(columnKey: string | keyof T): SortDirection;
    /** A header activation: updates the sort models and fires `sort-change` / `multi-sort-change`. */
    changeSort(columnKey: string | keyof T, direction: SortDirection, multi?: boolean): void;
    /** A pager activation: clamps the page to the data, updates the model and fires `page-change`. */
    changePage(state: PaginationState): void;
    /** The global filter input: waits out `filterDebounce`, resets to page 0, fires `filter-change`, announces the count. */
    changeGlobalFilter(value: string): void;
    /**
     * Wave 5 (filters, package A implements): sets `columnFilters[key]` to `value` as given (`null` stays a key), resets to page 0 and
     * marks the `filtering` trigger, in one model batch; fires only the model event `column-filters-change`.
     */
    changeColumnFilter(columnKey: string | keyof T, value: unknown): void;
    /** Wave 5: replaces the advanced filter tree (`null` clears it) and returns to page 0, in one model batch; fires `advanced-filter-change`. */
    changeAdvancedFilter(group: FilterGroup | null): void;
    /** Wave 5: the number of rows the filters let through, read when an announcement fires; undefined for server filtering without `total`. */
    filteredCount(): number | undefined;
    /**
     * wave5: a restored view state changed the filters (written outside the query service's own change paths). Call it ONCE, right AFTER the write:
     * the restore is the latest filter change, so every older announcement says nothing (the filter UI's for the restore's own write too), and it is
     * announced ONCE: as a global filter when `globalChanged` and the new global text is not empty, else the overall count (or that every filter
     * is cleared).
     */
    filtersRestored(globalChanged: boolean): void;
    /**
     * wave5: the column / advanced filter result announcement. Local filtering: 500 ms after the call, the number of matching rows, or that every
     * filter is cleared; a newer call or filter change replaces a waiting one (one timer slot, the latest change speaks). Server filtering: nothing
     * (the rows held are not the matches). No numbering and no waiting for a server answer.
     */
    announceFilters(): void;
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
    /** Wave 6 (flash, package C implements): the direction a cell is flashing now, or undefined. */
    flash?(rowId: string, columnKey: string): CellFlashDirection | undefined;
    /** Some cell is flashing now: a cheap question the renderer asks once per render, so `enable-cell-flash` alone (nothing flashing) costs no per-cell work. */
    anyFlashing?(): boolean;
}

/** The filter UI's read-outs (wave 5, provided by the `filter-ui` controller under `filters`). */
export interface FilterService<T> {
    /** The column's filter is set: `!isFilterValueEmpty(value)`. */
    isActive(columnKey: string): boolean;
    /** The column draws a control in the floating filter row. */
    hasFloating(column: ColumnDef<T>): boolean;
    hasAnyFloating(): boolean;
    /** The number of conditions in the advanced filter (the toolbar badge). */
    advancedCount(): number;
    /** Wave 7: drops every floating column write still waiting on its debounce (`applyFilters` with `columnFilters`). */
    dropPending?(): void;
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
    /** `navigableKeys()` plus `_selection` and `_expander`: what the arrow keys traverse (not `_actions`, which holds buttons). */
    focusableKeys(): readonly string[];
    pinOf(columnKey: string): 'left' | 'right' | undefined;
    setPin(columnKey: string, pin: 'left' | 'right' | undefined): void;
    setVisible(columnKey: string | keyof T, visible: boolean): void;
    showAll(): void;
    /** Pins the width a drag is showing right now (px), so an incidental render keeps it; `null` ends the drag. */
    liveWidth(columnKey: string, px: number | null): void;
    getState(): DataTableColumnState[];
    /** Merges saved column state in one model batch (widths, visibility, order) plus pins. */
    applyState(states: readonly DataTableColumnState[] | null | undefined): void;
    /** Everything a saved view covers: sort, filters, pagination and the column state, as one token (package C implements it). */
    getViewState(): DataTableViewState | null;
    /** Restores a saved view in ONE model batch; false (and nothing changed) when the token is refused. */
    applyViewState(state: DataTableViewState | null | undefined): boolean;
    /** Moves a column to a visible position among the reorderable ones (bounded; no event, only `columnOrder`). */
    move(columnKey: string, targetIndex: number): void;
}

/** Row selection: the one writer of `rowSelection` (always a new object, so `row-selection-change` fires once per command). */
export interface SelectionService<T> {
    isSelected(id: string): boolean;
    isDisabled(row: T): boolean;
    toggleRow(row: T): void;
    /** The tree checkbox: a plain toggle or a cascade, by `subRowSelectionMode`. */
    toggleRowCascade(row: T): void;
    toggleAll(): void;
    selectRows(rows: readonly T[]): void;
    unselectRows(rows: readonly T[]): void;
    clearSelection(): void;
    selectAll(): void;
    /** The header checkbox over ALL filtered rows of every page, disabled rows excluded. */
    header(): { checked: boolean; indeterminate: boolean; selectableCount: number };
    /** A tree node with some but not all of its descendants selected. */
    isIndeterminate(id: string): boolean;
    /** Wave 7: the rows of `data` (every level in tree mode) whose id is selected; a selected id with no row is not counted. */
    selectedRows(): T[];
}

/** Detail rows, tree expansion and group collapse: the owner of `expandedRows`, `subRowExpandedRows` and `collapsedGroups`. */
export interface ExpansionService<T> {
    isRowExpanded(id: string): boolean;
    toggleRow(row: T): void;
    isAllExpanded(): boolean;
    toggleAll(): void;
    isSubRowExpanded(row: T): boolean;
    toggleSubRow(row: T): void;
    expandSubRow(row: T): void;
    collapseSubRow(row: T): void;
    expandAllSubRows(toDepth?: number): void;
    collapseAllSubRows(): void;
    isGroupCollapsed(key: string): boolean;
    toggleGroup(key: string): void;
    expandAllGroups(): void;
    collapseAllGroups(): void;
}

/** Column width gestures and the measuring that goes with them. */
export interface ResizeService {
    autoSizeColumn(columnKey: string): void;
    autoSizeAllColumns(): void;
    fitColumnsToViewport(): void;
}

/**
 * Focus, range and editor state: one owner, because reconciling them after a render writes all of them together. The edit and
 * range halves live in session files (`data-table-edit-session.ts`, `data-table-range-session.ts`) whose methods are merged
 * into this one object (see `data-table-cell-session.ts`).
 */
export interface CellInteractionService {
    focusedCell(): { rowIndex: number; columnKey: string } | null;
    cellRange(): CellRange | null;
    // The editing methods below (wave 5) are OPTIONAL in the type: a provider of the older shape (a test stub, a consumer's) lacks them, and every
    // caller guards (`?.()`). The sessions still implement them all.
    editingCell?(): EditingCell | null;
    cellEditError?(): CellEditError | null;
    focusCell(rowIndex: number, columnKey: string): void;
    isCellSelected(rowIndex: number, columnKey: string): boolean;
    /** Wave 7: range SELECTION is on and its part is active (what draws `aria-selected`); optional like the editing methods. */
    rangeSelectionEnabled?(): boolean;
    /** Wave 5 (edit session): opens an editor on the cell of a data row; false when none opened (not editable, disabled row, no such row). */
    startEditing?(row: unknown, columnKey: string): boolean;
    /** Wave 5: commits the open editor's draft (validation, write, close); no-op with nothing open. */
    commitEdit?(): void;
    /** Wave 5: drops the open editor's draft without an event. */
    cancelEdit?(): void;
    /** Wave 5: the cell at this drawn index and column holds the open editor. */
    isEditing?(rowIndex: number, columnKey: string): boolean;
    /** Wave 5: the open editor's draft (undefined with none open). */
    editValue?(): unknown;
    setEditValue?(value: unknown): void;
}

/** Range selection, the fill handle and the readout (wave 6). Always provided by `cell-interaction`; inert until `enable-cell-range-selection` loads its lazy part. */
export interface RangeService {
    /** The range part is loaded and handles ranges: `aria-selected` and the range flags are drawn only then (the step 0 shell answers false until it loads). */
    active(): boolean;
    /** As made (anchor .. end), absolute rendered row indexes and column keys. */
    range(): CellRange | null;
    normalized(): NormalizedRange | null;
    isInRange(rowIndex: number, columnKey: string): boolean;
    isFillPreview(rowIndex: number, columnKey: string): boolean;
    /** The edges of the range this cell sits on (`top`, `bottom`, `start`, `end`, space-separated; `rangeEdges` in `data-table-range.ts`), '' for an inner cell. */
    edgeOf(rowIndex: number, columnKey: string): string;
    /** Programmatic: no event, clamped like any range. Answers whether the value was ACCEPTED (a refused one, not a range of this table, leaves the old value and answers false). */
    setRange(range: CellRange | null): boolean;
    extendTo(rowIndex: number, columnKey: string): void;
    /** Null unless `enable-range-actions` and at least two cells. */
    stats(): RangeAggregateStats | null;
    chartPayload(): RangeChartPayload | null;
    /** Fires `range-chart-open` when there is a payload. */
    openChart(): void;
    /** False = nothing written. */
    fillDownTo(targetEndRow: number): boolean;
    /** Bottom-right of the range, else the focused cell; null while an editor is open. */
    fillHandleCell(): { rowIndex: number; columnKey: string } | null;
    /** A pointer or touch range / fill drag is running: the edit session's touch tap ignores a `touchend` while true. */
    gestureActive(): boolean;
}

export type ClipboardResult = { status: 'done' | 'empty' | 'denied' | 'unavailable' | 'ignored'; cells?: number; rejected?: number };

/** Copy and paste (wave 6, provided by the `clipboard` controller). */
export interface ClipboardService<T> {
    copy(scope: 'cell' | 'row' | 'selected' | 'range' | 'all', row?: T): Promise<ClipboardResult>;
    /** Reads the async clipboard and pastes at the focused cell. */
    paste(): Promise<ClipboardResult>;
    /** Synchronous, no clipboard access (a native paste event, tests). */
    pasteText(text: string, at?: { rowIndex: number; columnKey: string }): ClipboardResult;
}

export interface RowDragState {
    /** The id of the row being dragged. */
    draggedId: string;
    /** The drawn index of the row under the pointer, or -1. */
    overIndex: number;
    /** The indicator on the target: a line on its top or bottom edge, or a frame for `on` (tree mode); null for none (a refused target). */
    edge: 'top' | 'bottom' | 'on' | null;
}

/** Row drag reorder and its keyboard alternative (wave 6, provided by the `row-drag` controller). */
export interface RowDragService<T> {
    /** The drag part is loaded and handles drags: rows are draggable only then (the step 0 shell answers false). */
    active(): boolean;
    isDragging(): boolean;
    /** What the renderer draws of a drag in progress: the dragged row and the edge indicator on the target; null when no drag runs. */
    dragState(): RowDragState | null;
    /** Moves a row one step among the drawn rows (flat) or its siblings (tree); false when nothing moved. */
    moveRow(row: T, direction: 'up' | 'down'): boolean;
    reorderData(data: readonly T[], event: RowReorderEvent<T>): T[];
}

export interface VirtualService {
    active(): boolean;
    /** Rows and columns currently drawn. */
    renderRange(): VirtualRenderRange;
    /** What the body renders now; `0..items.length` and no padding while virtual scroll is off. */
    window(): BodyWindow;
    scrollToRow(index: number): void;
    scrollToColumn(columnKey: string): void;
    scrollToCell(rowIndex: number, columnKey: string): void;
    /** The minimal scroll that brings a cell inside the viewport, clear of the sticky header, footer and pinned columns. */
    reveal(rowIndex: number, columnKey?: string): void;
    /** Keeps rows drawn outside the window for `owner` (`focus`, `edit`); an empty list releases them. */
    retain(owner: string, rows: readonly number[]): void;
    /** Re-reads the viewport, the row heights and the column widths, then recomputes what is drawn. */
    measure(): void;
}

/**
 * A button the core draws in every enabled data row's `_actions` cell (`[data-action-id]`). Like every in-cell control it is `tabindex="-1"` only
 * while a roving cell exists (one tab stop per grid: the keyboard path is then the context-menu key); without one it stays in the tab order.
 * Clicking it calls `onClick` with the row's context.
 */
export interface CellActionSlot<T = unknown> {
    /** Stable id (the registering addon's id, e.g. `context-menu`). */
    readonly id: string;
    /** What the button shows: anything lit renders (an `svg` template, a Node); the default is the kebab glyph. Never parsed as markup. */
    readonly icon?: unknown;
    /** Default: the locale's `rowActions`. */
    readonly ariaLabel?: string;
    /** Drawn as `aria-haspopup`. */
    readonly haspopup?: 'menu';
    /** Drawn as `aria-expanded` (absent: no attribute); read at each render, for this row. */
    readonly expanded?: (context: RowActionContext<T>) => boolean;
    readonly onClick: (event: Event, context: RowActionContext<T>) => void;
}

/** A button the core draws in every data column's header, after its controls (in the tab order). */
export interface HeaderActionSlot<T = unknown> {
    readonly id: string;
    readonly icon?: unknown;
    /** `{column}` is the column header. Default: the locale's `columnMenu`. */
    readonly ariaLabel?: string;
    readonly haspopup?: 'menu';
    /** Drawn as `aria-expanded` (absent: no attribute); read at each render, for this column. */
    readonly expanded?: (column: ColumnDef<T>) => boolean;
    readonly onClick: (event: Event, column: ColumnDef<T>) => void;
}

/** What addons register and the element draws; provided by the AddonHostController. */
export interface AddonsService<T> {
    readonly cellActions: SlotRegistry<CellActionSlot<T>>;
    readonly headerActions: SlotRegistry<HeaderActionSlot<T>>;
    /** The busy-overlay label: the most recent one while any owner is busy, or null when idle. */
    busyLabel(): string | null;
    /** Sets or (`null`) clears the label of `owner` (an addon id; default `''`). */
    setBusy(label: string | null, owner?: string): void;
    /** Clears every owner's label. */
    clearBusy(): void;
}

/** Wave 7 (AI, package D implements; the `ai` controller provides it): the natural-language filter and the AI column fill, reached through the element's methods. */
export interface AiService {
    /** Runs the NL filter box's text (Enter in the box). */
    runAiFilter(): Promise<void>;
    applyNaturalLanguageFilter(query: string): Promise<void>;
    aiFillColumn(columnKey: string, prompt: string, options?: DataTableAiFillOptions): Promise<void>;
    /** Aborts the running AI request, if any. */
    cancelAi(): void;
    /** An AI fill is running: the table draws `aria-busy`. */
    busy?(): boolean;
}

export interface DataTableProviders<T = unknown> {
    ai: AiService;
    query: QueryService<T>;
    columns: ColumnsService<T>;
    interaction: CellInteractionService;
    range: RangeService;
    clipboard: ClipboardService<T>;
    rowDrag: RowDragService<T>;
    filters: FilterService<T>;
    virtual: VirtualService;
    selection: SelectionService<T>;
    expansion: ExpansionService<T>;
    resize: ResizeService;
    addons: AddonsService<T>;
    loading: LoadingService;
    formatting: FormattingService<T>;
    footer: FooterService;
}
