/**
 * Every event `ge-data-table` dispatches, as DOM event name -> `detail` type. Names are the Angular outputs in kebab-case.
 * Two families: interaction events (fired when the user, or a method such as `undoEdit()`, causes something) and the
 * model events (fired when an internal change moves a two-way state, see `data-table-model.ts`). A consumer writing a
 * property fires neither, so there is no echo to filter out.
 */
import type {
    CellEditErrorEvent,
    CellEditEvent,
    CellsPasteEvent,
    ColumnResizeEvent,
    DataTableQuery,
    FillSeriesEvent,
    FilterGroup,
    PaginationState,
    RangeChartPayload,
    RowReorderEvent,
    SortState,
} from './data-table.types.js';
import type { NlFilterSpec } from './data-table-ai.js';

export interface NlFilterEventDetail {
    query: string;
    spec: NlFilterSpec;
}

export interface DataTableInteractionEvents<T> {
    /** The new single sort after a header activation (direction `null` = cleared). Fires with `localSorting` off too. */
    'sort-change': SortState;
    /** The whole ordered sort chain after a multi-sort change. */
    'multi-sort-change': SortState[];
    'page-change': PaginationState;
    /** The raw global filter text (after `filterDebounce`). */
    'filter-change': string;
    /** The complete server request, once per change; not fired for the initial state. */
    query: DataTableQuery;
    'cell-edit': CellEditEvent<T>;
    'edit-error': CellEditErrorEvent<T>;
    'row-reorder': RowReorderEvent<T>;
    'range-chart-open': RangeChartPayload;
    'fill-series': FillSeriesEvent;
    'cells-paste': CellsPasteEvent;
    'edit-undo': undefined;
    'edit-redo': undefined;
    'column-resize': ColumnResizeEvent;
    'nl-filter': NlFilterEventDetail;
    /** `count`: cells written. Wave 7 adds the cells the validator `rejected`, the rows `skipped` (gone or not writable), and `failed` / `error` for a run a provider error stopped. */
    'ai-fill-complete': { columnKey: string; count: number; rejected?: number; skipped?: number; failed?: boolean; error?: unknown };
    /** Wave 7: an AI fill's progress, at most every 250 ms. */
    'ai-fill-progress': { columnKey: string; done: number; total: number };
}

/** One per `model()` of the Angular component; the detail is the new value. */
export interface DataTableModelEvents<T> {
    'data-change': T[];
    'row-selection-change': Record<string, boolean>;
    'expanded-rows-change': Record<string, boolean>;
    'sub-row-expanded-rows-change': Record<string, boolean>;
    'collapsed-groups-change': Record<string, boolean>;
    'global-filter-change': string;
    'column-filters-change': Record<string, unknown>;
    'advanced-filter-change': FilterGroup | null;
    'sort-state-change': SortState;
    'multi-sort-state-change': SortState[];
    'pagination-state-change': PaginationState;
    'column-widths-change': Record<string, string>;
    'column-visibility-change': Record<string, boolean>;
    'column-order-change': string[];
}

/**
 * The events addons fire through `host.emit(name, detail)`, as name -> `detail` type. Empty in the core: each addon adds its own
 * by declaration merging (`declare module '.../data-table-events.js' { interface DataTableAddonEvents { 'row-menu-open': ... } }`).
 */
export interface DataTableAddonEvents {}

export type DataTableEventMap<T = unknown> = DataTableInteractionEvents<T> & DataTableModelEvents<T>;

export type DataTableEventName = keyof DataTableEventMap;
