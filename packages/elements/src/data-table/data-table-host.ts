/**
 * What every controller sees of the table. The element implements it; controllers never import the element or each other.
 *
 * Every member earns its place by a controller of the corrected split (docs/data-table-port.md section 8):
 *
 * | member                          | used by                                                                     |
 * |---------------------------------|-----------------------------------------------------------------------------|
 * | config                          | all (live reads of the inputs)                                              |
 * | model                           | Query, Columns, Selection, Expansion, CellInteraction, FilterUi, RowDrag    |
 * | root, cellAt, rowAt, *AddressOf | CellInteraction, Clipboard, Resize, RowDrag, Virtual, Aria, AddonHost       |
 * | emit                            | Query (`query`), Resize, RowDrag, Clipboard, Ai, CellInteraction            |
 * | announce                        | Aria (sort/filter), CellInteraction (edit errors), Clipboard, Ai            |
 * | writeCell, runAsCommand         | CellInteraction (commit), Clipboard (paste), CellInteraction (fill), Ai     |
 * | undo, redo, canUndo, canRedo    | CellInteraction (Ctrl+Z / Y), the public `undoEdit()` / `redoEdit()`        |
 * | provide, provider               | every controller that offers or consumes a service (data-table-providers)   |
 * | topics                          | every controller whose output another reads (see the registry's plan)       |
 * | addKeyHandler                   | CellInteraction (navigation, edit keys), Clipboard (copy/paste), Selection  |
 * | resolvedLocale                  | Aria, Filter UI, Loading, Columns, addons                                   |
 * | disposables                     | all (listeners, timers, observers)                                          |
 * | requestRender, afterRender      | all that draw; Virtual and Resize measure after a paint                     |
 */
import type { Disposables, TopicBus } from '../shared/registry.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { DataTableEventMap } from './data-table-events.js';
import type { CellTarget, CellWriteOptions, CellWriteResult } from './data-table-cell-write.js';
import type { ModelStore } from './data-table-model.js';
import type { DataTableConfig, DataTableProviders } from './data-table-providers.js';

/** What a controller publishes for others to react to; the payload is read from the model or a provider, not carried. */
export type DataTableTopic =
    | 'config' // an input changed
    | 'rows' // the query memo graph recomputed (sorted data, tree rows, display rows)
    | 'columns' // enhanced columns, pin offsets or widths changed
    | 'selection' // row selection or its disabled set
    | 'expansion' // row, sub-row or group expansion
    | 'cell' // focused cell, range or editor
    | 'viewport' // the virtual window or the measured viewport
    | 'loading'
    | 'locale';

/** The DOM is part of the protocol: these attributes are how rendered output is addressed and read back. */
export const DOM_PROTOCOL = {
    rowIndex: 'data-row-index',
    column: 'data-column',
    rowId: 'data-row-id',
    /** Style and test hooks: selectors are `ge-data-table [data-slot='...']`. */
    slot: 'data-slot',
} as const;

export interface CellAddress {
    readonly rowIndex: number;
    readonly columnKey: string;
}

export interface RowAddress {
    readonly rowIndex: number;
    readonly rowId: string | null;
}

/** The minimum of an element `addressOf` needs, so it is testable without a DOM. */
interface AddressableElement {
    closest(selector: string): AddressableElement | null;
    getAttribute(name: string): string | null;
}

/** The cell a pointer or key event landed in, read back from the rendered attributes. Null outside any cell. */
export function cellAddressOf(target: unknown): CellAddress | null {
    const cell = (target as Partial<AddressableElement> | null)?.closest?.(`[${DOM_PROTOCOL.column}][${DOM_PROTOCOL.rowIndex}]`);
    const rowIndex = Number(cell?.getAttribute(DOM_PROTOCOL.rowIndex));
    const columnKey = cell?.getAttribute(DOM_PROTOCOL.column);
    return cell && columnKey != null && Number.isInteger(rowIndex) ? { rowIndex, columnKey } : null;
}

/** The row an event landed in; `rowId` is null for rows drawn without one (group headers). */
export function rowAddressOf(target: unknown): RowAddress | null {
    const row = (target as Partial<AddressableElement> | null)?.closest?.(`[${DOM_PROTOCOL.rowIndex}]:not([${DOM_PROTOCOL.column}])`);
    const rowIndex = Number(row?.getAttribute(DOM_PROTOCOL.rowIndex));
    return row && Number.isInteger(rowIndex) ? { rowIndex, rowId: row.getAttribute(DOM_PROTOCOL.rowId) } : null;
}

export interface DataTableCoreHost<T = unknown> {
    /** Live reads of every input; never cache a value across an event. */
    readonly config: DataTableConfig<T>;
    /** The two-way states. Only the owning controller of a state calls `set` on it; everyone may read and subscribe. */
    readonly model: ModelStore<T>;
    /** The element itself: light DOM, so rows and cells are descendants and `querySelector` finds them. */
    readonly root: HTMLElement;
    cellAt(rowIndex: number, columnKey: string): HTMLElement | null;
    rowAt(rowIndex: number): HTMLElement | null;
    emit<K extends keyof DataTableEventMap<T>>(name: K, detail: DataTableEventMap<T>[K]): void;
    /** Writes to the polite live region; identical consecutive messages are still spoken. */
    announce(message: string): void;
    writeCell(target: CellTarget, value: unknown, options?: CellWriteOptions): CellWriteResult<T>;
    /** Makes every write inside `fn` one undo step (a no-op wrapper while `enableEditHistory` is off). */
    runAsCommand<R>(fn: () => R): R;
    undo(): boolean;
    redo(): boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    /** Plugs a service in; the returned teardown unplugs exactly this one. */
    provide<K extends keyof DataTableProviders<T>>(key: K, provider: DataTableProviders<T>[K]): () => void;
    /** What another controller plugged in under `key`, if anything has yet. */
    provider<K extends keyof DataTableProviders<T>>(key: K): DataTableProviders<T>[K] | undefined;
    readonly topics: TopicBus<DataTableTopic>;
    /** Runs on a grid `keydown` before the default handling; lowest priority first, the first to return true consumes it. */
    addKeyHandler(priority: number, fn: (event: KeyboardEvent) => boolean): () => void;
    readonly resolvedLocale: DataTableLocale;
    readonly disposables: Disposables;
    /** Schedules a render; coalesced by the element. */
    requestRender(): void;
    /** Runs `task` after the next render has painted (focus, measurement). */
    afterRender(task: () => void): void;
}

/** A provider a controller needs at attach time, or a clear error naming the key if the order is wrong. */
export function requireProvider<T, K extends keyof DataTableProviders<T>>(host: DataTableCoreHost<T>, key: K): DataTableProviders<T>[K] {
    const provider = host.provider(key);
    if (provider === undefined) throw new Error(`[ge-data-table] service '${key}' is not provided yet; check the controller order`);
    return provider;
}
