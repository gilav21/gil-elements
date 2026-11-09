/**
 * The table's two-way states (one per Angular `model()`), as a store with no DOM and no framework.
 *
 * Semantics, "property wins when set, event always fires":
 * - A consumer writing the element property goes through `assign`: the value is replaced and nothing is emitted, so
 *   there is no echo to filter out and a framework that re-renders with the same value stays quiet. Whatever was
 *   written last is what the table shows, so the property always wins over an earlier internal change.
 * - A change the table itself makes (header click, pager, resize, undo) goes through `set`: the value is replaced AND
 *   the typed event fires, whether or not anyone is listening, because the consumer cannot tell otherwise. A consumer
 *   that wants to veto it writes the property back from the handler (the controlled-input flow); the store needs no
 *   "controlled" mode for that.
 * - Setting a value that is identical (`Object.is`) to the held one is a no-op: no event, no notification. The table
 *   treats these values as immutable, so a new object means a change.
 * - Changes inside `batch` / `apply` are collected and flushed once at the end: one event per prop that ended up
 *   different from where the batch started (a prop set to X then back is silent), in the fixed `MODEL_KEYS` order,
 *   then a single `onFlush`. This is what makes applying a saved view one `query` event instead of five.
 */
import type { FilterGroup, PaginationState, SortState } from './data-table.types.js';
import type { DataTableModelEvents } from './data-table-events.js';

export interface ModelValues<T> {
    data: T[];
    rowSelection: Record<string, boolean>;
    expandedRows: Record<string, boolean>;
    subRowExpandedRows: Record<string, boolean>;
    collapsedGroups: Record<string, boolean>;
    globalFilter: string;
    columnFilters: Record<string, unknown>;
    advancedFilter: FilterGroup | null;
    sortState: SortState;
    multiSortState: SortState[];
    paginationState: PaginationState;
    columnWidths: Record<string, string>;
    columnVisibility: Record<string, boolean>;
    columnOrder: string[];
}

export type ModelKey = keyof ModelValues<unknown>;

/** Flush order. `data` first, `paginationState` last, so a listener sees the page after the filters that would reset it. */
export const MODEL_KEYS = [
    'data',
    'rowSelection',
    'expandedRows',
    'subRowExpandedRows',
    'collapsedGroups',
    'globalFilter',
    'columnFilters',
    'advancedFilter',
    'sortState',
    'multiSortState',
    'columnWidths',
    'columnVisibility',
    'columnOrder',
    'paginationState',
] as const satisfies readonly ModelKey[];

export type ModelEventName = keyof DataTableModelEvents<unknown>;

export const MODEL_EVENTS = {
    data: 'data-change',
    rowSelection: 'row-selection-change',
    expandedRows: 'expanded-rows-change',
    subRowExpandedRows: 'sub-row-expanded-rows-change',
    collapsedGroups: 'collapsed-groups-change',
    globalFilter: 'global-filter-change',
    columnFilters: 'column-filters-change',
    advancedFilter: 'advanced-filter-change',
    sortState: 'sort-state-change',
    multiSortState: 'multi-sort-state-change',
    paginationState: 'pagination-state-change',
    columnWidths: 'column-widths-change',
    columnVisibility: 'column-visibility-change',
    columnOrder: 'column-order-change',
} as const satisfies Record<ModelKey, ModelEventName>;

/** Fresh defaults (Angular's): never shared between tables, so one table's object is never another's. */
export function modelDefaults<T>(): ModelValues<T> {
    return {
        data: [],
        rowSelection: {},
        expandedRows: {},
        subRowExpandedRows: {},
        collapsedGroups: {},
        globalFilter: '',
        columnFilters: {},
        advancedFilter: null,
        sortState: { column: '', direction: null },
        multiSortState: [],
        paginationState: { pageIndex: 0, pageSize: 10 },
        columnWidths: {},
        columnVisibility: {},
        columnOrder: [],
    };
}

/** Where a notification came from: a consumer's property write, or a change the table made. */
export type ModelOrigin = 'property' | 'internal';

/** The typed event emitter the element supplies: its `dispatchEvent` of a `CustomEvent`. */
export type ModelEmit<T> = <E extends ModelEventName>(name: E, detail: DataTableModelEvents<T>[E]) => void;

/** One typed cell of the store, for a controller that works on a single state. */
export interface ModelProp<V> {
    get(): V;
    /** A change the table makes: replaces the value and fires the event. */
    set(value: V): void;
    /** Runs on every actual change from either origin, after the store flushed. Returns the unsubscribe. */
    subscribe(fn: (value: V, origin: ModelOrigin) => void): () => void;
}

export class ModelStore<T> {
    private values: ModelValues<T>;
    private readonly listeners = new Map<ModelKey, Set<(value: never, origin: ModelOrigin) => void>>();
    private readonly flushListeners = new Set<() => void>();
    /** The value each touched prop had when the current batch began, and how it changed since. */
    private pending: Map<ModelKey, { start: unknown; internal: boolean }> | null = null;
    private depth = 0;

    constructor(private readonly emit: ModelEmit<T>, initial: Partial<ModelValues<T>> = {}) {
        this.values = { ...modelDefaults<T>(), ...initial };
    }

    get<K extends ModelKey>(key: K): ModelValues<T>[K] {
        return this.values[key];
    }

    /** A change the table makes: replaces the value, fires the event at the end of the batch. */
    set<K extends ModelKey>(key: K, value: ModelValues<T>[K]): void {
        this.write(key, value, 'internal');
    }

    /** A consumer's property write: replaces the value, fires no event, still notifies subscribers. */
    assign<K extends ModelKey>(key: K, value: ModelValues<T>[K]): void {
        this.write(key, value, 'property');
    }

    /** Several writes, one flush: nothing is emitted until the outermost batch ends. Nested batches join the outer one. */
    batch<R>(fn: () => R): R {
        this.depth++;
        try {
            return fn();
        } finally {
            if (--this.depth === 0) this.flush();
        }
    }

    /** Internal changes for many props at once (a restored view); keys with an `undefined` value are left alone. */
    apply(patch: Partial<ModelValues<T>>): void {
        this.batch(() => {
            for (const key of MODEL_KEYS) {
                if (Object.hasOwn(patch, key) && patch[key] !== undefined) this.set(key, patch[key] as never);
            }
        });
    }

    prop<K extends ModelKey>(key: K): ModelProp<ModelValues<T>[K]> {
        return {
            get: () => this.values[key],
            set: (value) => this.set(key, value),
            subscribe: (fn) => this.subscribe(key, fn),
        };
    }

    subscribe<K extends ModelKey>(key: K, fn: (value: ModelValues<T>[K], origin: ModelOrigin) => void): () => void {
        const set = this.listeners.get(key) ?? new Set();
        set.add(fn as (value: never, origin: ModelOrigin) => void);
        this.listeners.set(key, set);
        return () => {
            set.delete(fn as (value: never, origin: ModelOrigin) => void);
        };
    }

    /** Runs once after each flush that changed something, after the events; the `query` event is emitted from here. */
    onFlush(fn: () => void): () => void {
        this.flushListeners.add(fn);
        return () => {
            this.flushListeners.delete(fn);
        };
    }

    private write<K extends ModelKey>(key: K, value: ModelValues<T>[K], origin: ModelOrigin): void {
        if (Object.is(this.values[key], value)) {
            // The consumer confirming a value the table just set in this batch still takes ownership of it: no echo.
            const held = this.pending?.get(key);
            if (held && origin === 'property') held.internal = false;
            return;
        }
        this.batch(() => {
            const pending = (this.pending ??= new Map());
            const entry = pending.get(key) ?? { start: this.values[key], internal: false };
            // A property write after an internal change supersedes it: the consumer's value is final and nothing is announced.
            entry.internal = origin === 'internal';
            pending.set(key, entry);
            this.values = { ...this.values, [key]: value };
        });
    }

    private flush(): void {
        const pending = this.pending;
        this.pending = null;
        if (!pending) return;
        let changed = false;
        for (const key of MODEL_KEYS) {
            const entry = pending.get(key);
            if (!entry || Object.is(entry.start, this.values[key])) continue;
            changed = true;
            const origin: ModelOrigin = entry.internal ? 'internal' : 'property';
            if (origin === 'internal') this.emit(MODEL_EVENTS[key], this.values[key] as never);
            for (const fn of [...(this.listeners.get(key) ?? [])]) fn(this.values[key] as never, origin);
        }
        if (changed) for (const fn of [...this.flushListeners]) fn();
    }
}
