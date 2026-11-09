/**
 * Public types of `ge-data-table`. No `lit` import; the only runtime code is one constant.
 *
 * Differences from the Angular `ColumnDef`: `TemplateRef` and component-class renderers become renderer functions and
 * custom-element tag names; the deprecated `sticky` flag and the internal `_isTreeExpanderHost` are gone (the table
 * pins its own control columns with `pin: 'left'`).
 */

export type SortDirection = 'asc' | 'desc' | '' | null;

export interface SortState {
    column: string;
    direction: SortDirection;
}

export interface PaginationState {
    pageIndex: number;
    pageSize: number;
}

export interface ColumnResizeEvent {
    columnKey: string;
    oldWidth: string;
    newWidth: string;
}

/**
 * What a renderer function may return. The element hands it to lit's `render()`: a string or number becomes text,
 * a DOM `Node` is inserted as it is, a lit `TemplateResult` is rendered. Typed `unknown` so this file needs no `lit`.
 */
export type CellRenderResult = unknown;

export interface CellContext<T> {
    row: T;
    /** The raw value behind the cell (`accessorFn` / `accessorKey`), before any formatting. */
    value: unknown;
    column: ColumnDef<T>;
    /** The DRAWN row index: after filter, sort, grouping and paging, group headers not counted. */
    rowIndex: number;
}

export interface HeaderContext<T> {
    column: ColumnDef<T>;
}

export interface FooterContext<T> {
    column: ColumnDef<T>;
    /** The rows the footer summarises. */
    rows: readonly T[];
}

export interface FilterContext<T> {
    column: ColumnDef<T>;
    /** The column's current filter value. */
    value: unknown;
    /** Reports a new filter value. */
    setValue: (value: unknown) => void;
}

/** Handlers keyed by DOM event name, added as listeners on a column's custom element. */
export type ComponentOutputs = Record<string, (event: Event) => void>;

/**
 * How a data cell is drawn. At most one applies, in this order of precedence:
 *
 * 1. `component`: a custom-element tag name. The element is created per cell (and reused while the tag is unchanged);
 *    `componentInputs(row)` is assigned as PROPERTIES (never attributes) and `componentOutputs(row)` are added as event
 *    listeners. This is the one way to render a component from any framework: expose it as a custom element (Angular
 *    Elements, Vue `defineCustomElement`, a React wrapper, Svelte or Solid custom elements) and pass its tag.
 * 2. `cellRenderer`: a function returning a {@link CellRenderResult}.
 * 3. `cell`: a function returning plain text.
 *
 * With none, the raw value is stringified. `resolveCellKind` answers which applies. The same
 * hosts apply to `filterComponent`, `editComponent`, `footerComponent` and `floatingFilterComponent`.
 */
export interface CellRendering<T> {
    component?: string;
    componentInputs?: (row: T) => Record<string, unknown>;
    componentOutputs?: (row: T) => ComponentOutputs;
    cellRenderer?: (ctx: CellContext<T>) => CellRenderResult;
    cell?: (row: T) => string;
}

/**
 * An editor element (`editComponent`) must expose a `value` property and report changes with a `change` or
 * `value-change` event. The full contract is defined with the editing controller, from Angular's edit specs.
 */
export interface ColumnDef<T> extends CellRendering<T> {
    accessorKey: keyof T | string;
    accessorFn?: (row: T) => unknown;
    header: string;
    headerRenderer?: (ctx: HeaderContext<T>) => CellRenderResult;
    enableSorting?: boolean;
    sortFn?: (a: T, b: T) => number;
    enableFiltering?: boolean;
    enableGlobalFilter?: boolean;
    filterFn?: (row: T, filterValue: unknown) => boolean;
    /** Custom-element tag name of a custom filter UI; see {@link CellRendering.component} for how it is driven. */
    filterComponent?: string;
    filterComponentInputs?: Record<string, unknown> | (() => Record<string, unknown>);
    filterComponentOutputs?: ComponentOutputs;
    pin?: 'left' | 'right';
    width?: string;
    /**
     * The narrowest the column may be, as a CSS length. A column without a `width` shares the free space but never
     * renders narrower than this, and dragging or auto-fitting never takes it below it either (those read the value
     * as pixels, so give it in `px` when the column is resizable). Defaults to `80px`; a column with an explicit
     * `width` keeps exactly that width.
     */
    minWidth?: string;
    enableHiding?: boolean;
    enableReordering?: boolean;
    treeExpander?: boolean;
    editable?: boolean;
    /** Custom-element tag name of the editor (contract: see the note on {@link ColumnDef}). */
    editComponent?: string;
    editRenderer?: (ctx: CellContext<T>) => CellRenderResult;
    /**
     * Which editor an inline edit opens. `date` uses the library's date picker and writes back in whatever shape the
     * cell already held: an ISO string stays an ISO string.
     */
    editType?: 'text' | 'number' | 'select' | 'checkbox' | 'date';
    editOptions?: { label: string; value: unknown }[];
    valueSetter?: (row: T, newValue: unknown) => T;
    editValidator?: (value: unknown, row: T) => boolean | string;
    footer?: string | ((rows: T[]) => string);
    footerRenderer?: (ctx: FooterContext<T>) => CellRenderResult;
    footerComponent?: string;
    aggregateFn?: AggregateFn;
    floatingFilter?: boolean;
    floatingFilterRenderer?: (ctx: FilterContext<T>) => CellRenderResult;
    floatingFilterComponent?: string;
    enableCellFlash?: boolean;
    /** Conditional formatting: CSS classes applied when a predicate matches the cell value. */
    cellClassRules?: CellClassRule<T>[];
    /** Conditional formatting: inline styles derived from the cell value (e.g. text color). */
    cellStyleRules?: (value: unknown, row: T) => Record<string, string> | undefined;
    /** Heat-map background that interpolates `from` to `to` by where the value sits in `[min, max]`. */
    colorScale?: ColorScale;
    /** Inline horizontal bar whose width is the value's position in `[min, max]` (Excel data bars). */
    dataBar?: DataBar;
    /** Returns an icon to prefix the cell value, or `undefined` for none (Excel icon sets). */
    iconSet?: (value: unknown, row: T) => CellIcon | undefined;
}

export type AggregateFn = 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: unknown[]) => string);

export interface CellClassRule<T> {
    when: (value: unknown, row: T) => boolean;
    class: string;
}

export interface ColorScale {
    min: number;
    max: number;
    /** Color at `min` (CSS color). */
    from: string;
    /** Color at `max` (CSS color). */
    to: string;
}

export interface DataBar {
    min: number;
    max: number;
    color: string;
    /** Track color behind the bar; defaults to transparent. */
    track?: string;
}

export interface CellIcon {
    /** A named icon. Takes precedence over `glyph`. */
    name?: string;
    /** A literal glyph or emoji. Used when `name` is not set. */
    glyph?: string;
    /** Extra CSS classes for the icon (e.g. color). */
    class?: string;
}

/** Resolved, value-aware formatting for a single cell. `null` when the column declares none. */
export interface ResolvedCellFormatting {
    class: string;
    style: Record<string, string>;
    /** `track` is `null` when the column declares no track. */
    dataBar: { width: string; color: string; track: string | null } | null;
    icon: CellIcon | null;
}

/**
 * A column after layout: the resolved width and floor, the pin side (`left` is inline-start, `right` inline-end) and
 * the pin offset as a CSS length (a `calc()` sum of the pinned columns before it, so `10rem` and `20%` stack too).
 */
export interface EnhancedColumnDef<T> extends ColumnDef<T> {
    _pin?: 'left' | 'right';
    _pinOffset?: string;
    _width: string;
    _minWidth: string;
}

export interface CellEditEvent<T> {
    row: T;
    column: ColumnDef<T>;
    oldValue: unknown;
    newValue: unknown;
    rowIndex: number;
}

/** Emitted when an inline cell edit is rejected by the column's `editValidator`. */
export interface CellEditErrorEvent<T> {
    row: T;
    column: ColumnDef<T>;
    /** The rejected value the user attempted to commit. */
    value: unknown;
    rowIndex: number;
    /** The validator's returned string, or a default. */
    message: string;
}

export interface EditingCell {
    rowIndex: number;
    columnKey: string;
}

/** Inline validation error state for the cell currently being edited. */
export interface CellEditError {
    rowIndex: number;
    columnKey: string;
    /** The rejected value; used to suppress duplicate error emissions. */
    value: unknown;
    message: string;
}

export interface DataTableRowEvent<T> {
    row: T;
    index: number;
    event: MouseEvent;
}

export interface DataTableColumnState {
    columnKey: string;
    width?: string;
    visible?: boolean;
    /** `null` is an explicit unpin, which survives JSON where an undefined key would not. */
    pin?: 'left' | 'right' | null;
    order?: number;
}

export type DataTableLoadingTrigger = 'initial' | 'pagination' | 'sorting' | 'filtering';

export interface DataTableLoadingVisibility {
    initial?: boolean;
    pagination?: boolean;
    sorting?: boolean;
    filtering?: boolean;
}

export interface DataTableExportOptions {
    includeHeaders?: boolean;
    onlyVisible?: boolean;
    onlyFiltered?: boolean;
}

/**
 * The query a server-side export provider gets, so it can fetch ALL rows matching what the user sees (filtered and
 * sorted, across every page). No pagination: an export returns the whole result set.
 */
export interface DataTableExportQuery {
    globalFilter: string;
    /** Per-column filter values, keyed by `accessorKey`. */
    columnFilters: Record<string, unknown>;
    sort: SortState;
    /** Full multi-column sort chain (highest priority first); empty when unused. */
    sortStates: SortState[];
}

/** Everything a server needs to answer one page of a data table (server mode: `local-*` set to false). */
export interface DataTableQuery {
    readonly globalFilter: string;
    readonly columnFilters: Record<string, unknown>;
    readonly sort: SortState;
    readonly sortStates: readonly SortState[];
    /** The advanced filter tree, or `null` when the builder is unused. */
    readonly advancedFilter: FilterGroup | null;
    readonly page: PaginationState;
}

/** What a server answers a {@link DataTableQuery} with. `total` counts matching rows across EVERY page. */
export interface DataTableResult<T> {
    readonly rows: readonly T[];
    readonly total: number;
}

/** The schema version {@link DataTableViewState} is written at. */
export const DATA_TABLE_VIEW_STATE_VERSION = 1;

/**
 * Everything needed to restore a saved view: layout, sort, filters and page. Versioned because the consumer persists
 * it (localStorage, a preferences row), so it outlives the build that wrote it.
 */
export interface DataTableViewState {
    readonly version: number;
    readonly columns: DataTableColumnState[];
    readonly sort: SortState;
    readonly sortStates: SortState[];
    readonly columnFilters: Record<string, unknown>;
    readonly advancedFilter: FilterGroup | null;
    readonly globalFilter: string;
    readonly pagination: PaginationState;
}

export type FilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'isEmpty'
    | 'isNotEmpty';

/** A single leaf condition in an advanced-filter tree. */
export interface FilterCondition {
    type: 'condition';
    column: string;
    operator: FilterOperator;
    value?: unknown;
}

/** An AND/OR group of conditions and nested groups. */
export interface FilterGroup {
    type: 'group';
    combinator: 'and' | 'or';
    rules: FilterRule[];
}

export type FilterRule = FilterCondition | FilterGroup;

export type SubRowSelectionMode = 'self' | 'descendants' | 'filteredDescendants';

export type SubRowFilterMode = 'includeChildren' | 'excludeChildren' | 'includeParentOnChildMatch';

export interface SubRowContext<T> {
    row: T;
    parentRow: T | null;
    parentId: string | null;
    depth: number;
    path: string[];
    isLeaf: boolean;
    childCount: number;
}

export interface FlattenedTreeRow<T> {
    row: T;
    depth: number;
    parentId: string | null;
    parentRow: T | null;
    path: string[];
    isLeaf: boolean;
    childCount: number;
    isExpanded: boolean;
}

export interface RowActionContext<T> {
    row: T;
    index: number;
    selected: boolean;
    depth?: number;
    isLeaf?: boolean;
    parentRow?: T | null;
    isExpanded?: boolean;
}

export type CellFlashDirection = 'up' | 'down' | 'changed';

export interface CellRange {
    startRow: number;
    startCol: string;
    endRow: number;
    endCol: string;
}

/** Live aggregate readout for the currently selected cell range. */
export interface RangeAggregateStats {
    /** Total cells in the range. */
    count: number;
    /** How many of those cells held a finite number. */
    numericCount: number;
    sum: string;
    avg: string;
    min: string;
    max: string;
}

/** One numeric column of a range, as a chart series. */
export interface RangeChartSeries {
    name: string;
    values: number[];
}

/** The selected range reshaped for charting: row labels plus one series per numeric column. */
export interface RangeChartPayload {
    categories: string[];
    series: RangeChartSeries[];
}

/** Emitted after a clipboard grid is pasted into cells. */
export interface CellsPasteEvent {
    startRow: number;
    startColumn: string;
    /** Rows the paste spanned (some may have been out of range). */
    rowsAffected: number;
    cellsApplied: number;
    /** Cells rejected by a column's `editValidator`. */
    cellsRejected: number;
}

/** Emitted after an Excel-style fill-handle drag applies values to new rows. */
export interface FillSeriesEvent {
    source: { minRow: number; maxRow: number };
    /** Rows that received filled values (inclusive). */
    filled: { startRow: number; endRow: number };
    /** Column keys that were filled (only those with a `valueSetter`). */
    columnKeys: string[];
}

export type RowDragPosition = 'above' | 'below' | 'on';

export interface RowReorderEvent<T> {
    row: T;
    targetRow: T;
    position: RowDragPosition;
    previousId: string | null;
    nextId: string | null;
    parentId?: string | null;
    fromIndex: number;
    toIndex: number;
}

export interface VirtualRenderRange {
    rowStart: number;
    rowEnd: number;
    colStart: number;
    colEnd: number;
}

export interface VirtualAutoThreshold {
    rows: number;
    columns: number;
}

export interface VirtualScrollState2D {
    rowStart: number;
    rowEnd: number;
    columnStart: number;
    columnEnd: number;
    totalRows: number;
    totalColumns: number;
    scrollTop: number;
    scrollLeft: number;
}

export interface GroupRow {
    kind: 'group';
    groupKey: string;
    groupValue: unknown;
    count: number;
    aggregates: Map<string, string>;
    collapsed: boolean;
}

/**
 * A row of the grouped display list: a group header, or a data row carrying the rendered index every callback, event
 * and addon uses for it (`data-row-index`). Headers take no index, and the numbering restarts on each page.
 */
export type DataTableDisplayRow<T> = GroupRow | { kind: 'data'; row: T; index: number };
