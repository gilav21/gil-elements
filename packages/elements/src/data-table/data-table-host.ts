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
 * | writeCells, writeCell,          | CellInteraction (commit: writeCell; fill: writeCells), Clipboard (paste:    |
 * | runAsCommand                    | writeCells), Ai (writeCells, no runAsCommand: not undoable). Multi-cell     |
 * |                                 | gestures MUST use writeCells: rows resolved before the first write         |
 * | undo, redo, canUndo, canRedo    | CellInteraction (Ctrl+Z / Y), the public `undoEdit()` / `redoEdit()`        |
 * | provide, provider               | every controller that offers or consumes a service (data-table-providers)   |
 * | topics                          | every controller whose output another reads (see the registry's plan)       |
 * | addKeyHandler                   | CellInteraction (navigation, edit keys), Clipboard (copy/paste), Selection  |
 * | resolvedLocale                  | Aria, Filter UI, Loading, Columns, addons                                   |
 * | disposables                     | all (listeners, timers, observers)                                          |
 * | requestRender, afterRender      | all that draw; Virtual and Resize measure after a paint                     |
 */
import { CONTROLS_SELECTOR, INTERACTIVE_TAGS, NATIVE_CONTROLS, ROLES_SELECTOR } from '../shared/interactive-tags.js';
import type { Disposables, TopicBus } from '../shared/registry.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { DataTableEventMap } from './data-table-events.js';
import type { CellTarget, CellWriteOptions, CellWriteRequest, CellWriteResult, HistoryResult } from './data-table-cell-write.js';
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

/** The event came from this table's own DOM and not from a table nested in one of its rows (a detail row's content). */
export const ownsTarget = (root: Element, target: unknown): boolean => (target as Element | null)?.closest?.('ge-data-table') === root;

/** `target.closest(selector)`, only when the match belongs to THIS table: a table nested in an outer row or cell would otherwise find the OUTER table's row, cell or header above its whole body. */
export const ownClosest = <E extends Element = Element>(root: Element, target: unknown, selector: string): E | null => {
    const match = (target as Element | null)?.closest?.<E>(selector) ?? null;
    return match && ownsTarget(root, match) ? match : null;
};

/** The scroll container of the grid (header, body and footer): the element the grid's key chain listens on. */
export const VIEWPORT = '[data-slot="data-table-viewport"]';

/**
 * The letter a Ctrl/Cmd shortcut names: `key`, case-insensitively (Shift makes it upper case); for a single NON-ASCII character (a non-Latin layout:
 * `ש`, `я`) the physical key decides (`code` `KeyA` -> `a`), as the platform's own shortcuts do. ASCII punctuation (`;` where Dvorak has KeyZ) is its
 * own key. ONE rule for the history keys and the grid's Ctrl/Cmd+A, C and D.
 */
export function shortcutLetter(event: { readonly key: string; readonly code?: string }): string {
    const nonLatin = event.key.length === 1 && event.key.charCodeAt(0) > 0x7f;
    if (!nonLatin) return event.key.toLowerCase();
    const code = event.code ?? '';
    return /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : '';
}

/** A field whose keys are its own (typing, its undo, Enter in it): the grid's key handlers never act on an event from one. */
export const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * What the browser (or a library control) focuses itself: the native controls, `summary`, a link with `href`, any `[tabindex]`, an editable region and
 * the library's interactive tags (a closed root's host stands for its inside). ONE rule for the grid's tap focus and an editor's first control.
 */
export const FOCUSABLE = `button, input, select, textarea, summary, a[href], [tabindex], [contenteditable]:not([contenteditable="false"]), ${INTERACTIVE_TAGS.join(', ')}`;

/**
 * The key belongs to a text field (typing, its undo, Enter or Alt+Shift+Arrow in it), so no grid key handler acts on it: the deepest node of the
 * event's path is one (a field inside a component's shadow root too), or the event's target or that node sits in one of this table's. With
 * `keepsFocus`, also anything inside a `[data-table-keeps-focus]` region of this table (a widget that owns its keys, the header filter panel).
 * ONE rule for the edit session, the column drag and the cell keyboard navigation.
 */
export function isTextFieldKey(root: Element, event: Event, { keepsFocus = false }: { keepsFocus?: boolean } = {}): boolean {
    const origin = event.composedPath()[0] as Element | undefined;
    if (origin?.matches?.(TEXT_FIELD)) return true;
    for (const from of [event.target, origin]) {
        if (ownClosest(root, from, TEXT_FIELD) || (keepsFocus && ownClosest(root, from, '[data-table-keeps-focus]'))) return true;
    }
    return false;
}

/** Inside a cell, also any anchor and the ARIA widget roles (the library's own controls are in `CONTROLS_SELECTOR`, from `INTERACTIVE_TAGS`). NOT `[tabindex]`: a component cell sets tabindex for keyboard reasons and stays a cell press (wave 6 range drags start on it); a widget that manages its own focus says so with `data-table-keeps-focus` (the cell itself is never matched: the walk stops at it). */
export const CELL_CONTROLS = `${CONTROLS_SELECTOR}, a, ${ROLES_SELECTOR}`;
/** Inside a shadow root of a consumer component (not this table's own tree): only the real form controls count; its roles, bare anchors (SVG included) and tags are its own business. */
export const SHADOW_CONTROLS = `${NATIVE_CONTROLS.join(', ')}, [contenteditable]:not([contenteditable="false"]), [data-table-keeps-focus]`;
const XHTML = 'http://www.w3.org/1999/xhtml';

/**
 * The control a press inside `cell` landed on: the first element of its composed path below the cell that is one. ONE rule for the pointer press and the
 * double click: `selector` in the table's own tree (`tree`), the real HTML form controls only inside a consumer component's shadow root.
 */
export function controlInPath(path: readonly EventTarget[], stop: Element, tree: Node, selector: string = CELL_CONTROLS): Element | null {
    for (const node of path) {
        if (node === stop) break;
        if (!(node instanceof Element)) continue;
        if (node.getRootNode() === tree ? node.matches(selector) : node.namespaceURI === XHTML && node.matches(SHADOW_CONTROLS)) return node;
    }
    return null;
}

/** `node` is `ancestor` or inside it, across shadow roots (a component's input in its own root, a focused element in a cell widget). */
export function composedContains(ancestor: Node | null | undefined, node: Node | null): boolean {
    if (!ancestor) return false;
    for (let at = node; at; at = at.parentNode ?? (at as ShadowRoot).host ?? null) if (at === ancestor) return true;
    return false;
}

/** The elements of `list` that belong to this table, not to a table nested in one of its rows. */
export const ownElements = <E extends Element>(root: Element, list: Iterable<E>): E[] => [...list].filter((el) => ownsTarget(root, el));

/**
 * A listener for events of this table only: a nested table's events bubble through the outer one's root. THE rule for ownership: `ownEvents` guarantees only that the
 * TARGET is this table's own; an element it then looks UP for (`closest`) may still be the outer table's row, cell or header above the whole nested table, so every
 * such lookup goes through `ownClosest` (never a bare `closest`), behind `ownEvents` or not.
 */
export const ownEvents =
    <E extends Event>(root: Element, listener: (event: E) => void) =>
    (event: E): void => {
        if (ownsTarget(root, event.target)) listener(event);
    };

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
    /** Many cells at once (fill, paste, AI): all rows resolved before the first write, one data write, results in request order. */
    writeCells(requests: readonly CellWriteRequest[], options?: CellWriteOptions): CellWriteResult<T>[];
    writeCell(target: CellTarget, value: unknown, options?: CellWriteOptions): CellWriteResult<T>;
    /** Makes every write inside `fn` one undo step (a no-op wrapper while `enableEditHistory` is off). */
    runAsCommand<R>(fn: () => R): R;
    /** Entries whose row or column is gone come back in `stale`; the rest are applied. */
    undo(): HistoryResult;
    redo(): HistoryResult;
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
