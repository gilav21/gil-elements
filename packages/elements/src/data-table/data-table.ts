import { html, isServer, LitElement, nothing, type PropertyDeclaration, type PropertyValues, type TemplateResult } from 'lit';
import '../checkbox/define.js';
import '../input/define.js';
import '../popover/define.js';
import '../skeleton/define.js';
import { adoptSheet } from '../shared/adopt-sheet.js';
import { THEME_ATTRIBUTE, type ThemeName } from '../shared/theme-presets.js';
import { createCellWriter, type HistoryResult } from './data-table-cell-write.js';
import { type AssembledControllers, assembleControllers } from './data-table-controllers.js';
import type { DataTableEventMap } from './data-table-events.js';
import { createFactories } from './data-table-factories.js';
import { rangeModeOn, rangeSelectionDrawn, sanitizeCellRange, warnBadRange } from './data-table-range.js';
import { renderGrid, renderSkeleton } from './data-table-grid.js';
import { resetIconElement } from './data-table-icons.js';
import { neutralRowDrag } from './data-table-row-drag-controller.js';
import { type CellAddress, type DataTableCoreHost, type DataTableTopic, ownElements, ownsTarget, requireProvider } from './data-table-host.js';
import { MODEL_KEYS, ModelStore, type ModelValues } from './data-table-model.js';
import type { ClipboardResult, DataTableConfig, DataTableProviders, RowDragService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';
import { Disposables, HandlerChain, TopicBus } from './data-table-registry.js';
import { buildView, type DataTableViewHost } from './data-table-view.js';
import { type DataTableLocale, dataTableLocaleVersion, interpolate, onDataTableLocaleChange, resolveDataTableLocale } from './data-table.locales.js';
import type {
    CellEditError,
    CellRange,
    ColumnDef,
    DataTableColumnState,
    DataTableLoadingTrigger,
    DataTableQuery,
    DataTableViewState,
    EditingCell,
    PaginationState,
    RowReorderEvent,
} from './data-table.types.js';
import { defaultGetRowId } from './data-table.utils.js';
import './sub/data-table-column-header.js';
import './sub/data-table-pager.js';
import { css } from './data-table-styles.js';
import { warnOnce, warnOncePer } from './data-table-warn.js';

/** State the element reads out of its services and does not accept back (Angular: signals). */
const READ_ONLY_STATE = ['editingCell', 'cellEditError'] as const;
const ignoreReadOnly = (name: string): void => warnOnce(`read-only:${name}`, `[ge-data-table] ${name} is read-only: the assignment was ignored.`);

type Mutable<O> = { -readonly [K in keyof O]: O[K] };

/** Inputs the table has besides the controllers' `DataTableConfig`. */
interface DataTableExtraInputs<T> {
    showToolbar: boolean;
    showColumnVisibilityToggle: boolean;
    showRowBorders: boolean;
    showColumnBorders: boolean;
    skeleton: boolean;
    skeletonRows: number;
    pageSizeOptions: number[];
    showPageSizeSelector: boolean;
    subRowIndentSize: number;
    theme: ThemeName | undefined;
    isRowDisabled: ((row: T) => boolean) | undefined;
    /** Draws the empty state; a string, a Node or a lit template. */
    renderEmpty: (() => unknown) | undefined;
    /** Draws the loading overlay's content for the trigger that caused it. */
    renderLoader: ((trigger: DataTableLoadingTrigger) => unknown) | undefined;
    /** Draws the detail row of an expanded row (`enable-row-expansion`). */
    renderDetail: ((row: T) => unknown) | undefined;
    /** Draws a row that spans every column in place of its cells. */
    renderFullWidth: ((row: T) => unknown) | undefined;
}

type Kind = 'prop' | 'flag' | 'on' | 'number' | 'text' | 'tri' | 'list';

/** Every input: how it maps to an attribute, and its default. `on` is a flag that defaults to true (`attr="false"` turns it off). */
const INPUTS: Readonly<Record<string, readonly [Kind, unknown]>> = {
    columns: ['prop', []],
    getRowId: ['prop', defaultGetRowId],
    globalFilterFn: ['prop', undefined],
    rowDragAllowDrop: ['prop', undefined],
    getChildren: ['prop', (row: unknown) => (row as { children?: unknown[] } | null)?.children],
    setChildren: ['prop', (row: unknown, children: unknown[]) => ({ ...(row as object), children })],
    aiProvider: ['prop', undefined],
    loadingVisibility: ['prop', undefined],
    disabledRowIds: ['prop', undefined],
    isRowDisabled: ['prop', undefined],
    renderEmpty: ['prop', undefined],
    renderLoader: ['prop', undefined],
    renderDetail: ['prop', undefined],
    renderFullWidth: ['prop', undefined],
    virtualAutoThreshold: ['prop', { rows: 500, columns: 20 }],
    showToolbar: ['on', true],
    showColumnVisibilityToggle: ['on', true],
    showPagination: ['on', true],
    showRowBorders: ['on', true],
    showColumnBorders: ['on', true],
    showPageSizeSelector: ['on', true],
    localSorting: ['on', true],
    localPagination: ['on', true],
    localFiltering: ['on', true],
    enableSubRowSorting: ['on', true],
    groupAggregates: ['on', true],
    localReorder: ['on', true],
    enableNlFilter: ['on', true],
    enableCopy: ['on', true],
    loading: ['flag', false],
    skeleton: ['flag', false],
    enableMultiSort: ['flag', false],
    enableRowSelection: ['flag', false],
    enableRowExpansion: ['flag', false],
    enableSubRows: ['flag', false],
    subRowDefaultExpanded: ['flag', false],
    subRowsPaginated: ['flag', false],
    enableColumnResize: ['flag', false],
    enableColumnReorder: ['flag', false],
    enableRowDrag: ['flag', false],
    enableFloatingFilters: ['flag', false],
    enableAdvancedFilter: ['flag', false],
    enableCellFlash: ['flag', false],
    enableCellRangeSelection: ['flag', false],
    enableRangeActions: ['flag', false],
    enableFillHandle: ['flag', false],
    enableClipboardPaste: ['flag', false],
    enableEditHistory: ['flag', false],
    virtualVariableRowHeight: ['flag', false],
    virtualRecycleComponents: ['flag', false],
    skeletonRows: ['number', 5],
    maxMultiSortColumns: ['number', 3],
    filterDebounce: ['number', 0],
    cellFlashDuration: ['number', 500],
    virtualRowBuffer: ['number', 5],
    virtualColumnBuffer: ['number', 3],
    virtualAutoColumnWidth: ['number', 150],
    subRowIndentSize: ['number', 20],
    total: ['number', undefined],
    virtualRowHeight: ['number', undefined],
    locale: ['text', undefined],
    theme: ['text', undefined],
    groupBy: ['text', undefined],
    subRowSelectionMode: ['text', 'self'],
    subRowFilterMode: ['text', 'includeParentOnChildMatch'],
    rowDragMode: ['text', 'flat'],
    showFooter: ['tri', 'auto'],
    enableVirtualScroll: ['tri', false],
    pageSizeOptions: ['list', [10, 20, 30, 40, 50]],
};

const kebab = (name: string): string => name.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const triState = { fromAttribute: (value: string | null) => (value === 'true' || value === '' ? true : value === 'false' ? false : 'auto') };
const sizeList = { fromAttribute: (value: string | null) => (value ?? '').split(/[\s,]+/).map(Number).filter((n) => n > 0) };

function declarationOf(name: string, kind: Kind): PropertyDeclaration {
    const attribute = kebab(name);
    switch (kind) {
        case 'prop':
            return { attribute: false };
        case 'flag':
            return { type: Boolean, attribute };
        case 'on':
            return { attribute, converter: { fromAttribute: (value: string | null) => value !== 'false' } };
        case 'number':
            return { type: Number, attribute };
        case 'tri':
            return { attribute, converter: triState };
        case 'list':
            return { attribute, converter: sizeList };
        default:
            return { attribute, reflect: name === 'theme' };
    }
}

const PROPERTIES = Object.fromEntries(Object.entries(INPUTS).map(([name, [kind]]) => [name, declarationOf(name, kind)]));

const SLOT_NAMES: ReadonlySet<string> = new Set(['toolbar-start', 'toolbar-end', 'empty', 'loading', 'footer']);

// The model states are properties too (`data`, `rowSelection`, ...): a write replaces the held value and fires no event.
export interface GeDataTable<T = unknown> extends Mutable<DataTableConfig<T>>, DataTableExtraInputs<T>, ModelValues<T> {}

/**
 * A data table: columns, rows, a sticky header, footer aggregates, sorting and paging, pinned columns, borders, RTL and
 * the full grid ARIA. LIGHT DOM: the grid is rendered inside the element itself so one ARIA tree holds the rows and the
 * consumer's own cell content, and the stylesheet (one cascade layer, adopted once per document) is scoped under
 * `ge-data-table`. Children with `slot="toolbar-start" | "toolbar-end" | "empty" | "loading" | "footer"` are moved into
 * place once and kept as the same nodes.
 *
 * Read-only so far: selection, expansion, tree, grouping, virtual scroll, keyboard navigation, resize, filters and editing
 * are the next waves; the markup and the controller seams for them are already in place.
 *
 * @fires sort-change - A header sort: `{ column, direction }`. Also with `local-sorting` off.
 * @fires multi-sort-change - The ordered sort chain after a multi-sort change.
 * @fires page-change - The new `{ pageIndex, pageSize }`.
 * @fires filter-change - The global filter text.
 * @fires query - The whole server request, once per change; not for the initial state.
 * @fires data-change - and one `*-change` per two-way state (`row-selection-change`, `sort-state-change`, ...), when the table itself moves it.
 * @attr {string} locale - Language id of the table's text. `en` is built in; others register with `registerDataTableLocale`. A dictionary object is remembered per object: replace it to change it, do not mutate it.
 * @attr {string} theme - Colour preset name.
 */
export class GeDataTable<T = unknown> extends LitElement implements DataTableViewHost<T> {
    static override readonly properties = PROPERTIES;

    private readonly store: ModelStore<T> = new ModelStore<T>((name, detail) => this.dispatch(name, detail));
    readonly topics = new TopicBus<DataTableTopic>();
    readonly disposables = new Disposables();
    private readonly providers = new Map<string, unknown>();
    private readonly keyHandlers = new HandlerChain<[KeyboardEvent]>();
    private readonly slotted = new Map<string, Node[]>();
    private readonly writer = createCellWriter<T>({
        getData: () => this.store.get('data'),
        setData: (next) => this.store.set('data', next),
        batch: (fn) => this.store.batch(fn),
        getRowId: (row) => this.getRowId(row),
        columnByKey: (key) => this.columns.find((c) => String(c.accessorKey) === key),
        rowAt: (index) => this.provider('query')?.renderedRowAt(index),
        cellValue: (row, column) => this.provider('query')?.cellValue(row, column.accessorKey, column),
        historyEnabled: () => this.enableEditHistory,
        rejectionMessage: () => this.resolvedLocale.invalidValue,
        emit: (...event) => this.emit(event[0], event[1] as never),
    });
    /** A `cellRange` assigned before the first connect, until the range session adopts it (no controller is assembled before the first connect). */
    private earlyRange: CellRange | null | undefined;
    private built: AssembledControllers | null = null;
    private assembled: AssembledControllers | null = null;
    private releaseStyles: (() => void) | null = null;
    private observer: MutationObserver | null = null;
    private frame = 0;
    private afterTasks: (() => void)[] = [];
    private announcement = '';
    private flip = false;
    private dirManaged = false;
    // The registry's version and the page language are part of the key: a dictionary registered later, or a `lang` that changes, resolves again.
    private lastLocale: DataTableLocale | null = null;
    private readonly localeOf = memoLast((input: string | DataTableLocale | undefined, _version: number, pageLang: string) => resolveDataTableLocale(input, pageLang));

    constructor() {
        super();
        // A model state written before the element upgraded is an own property that would shadow the accessor: take it back.
        const early = MODEL_KEYS.filter((key) => Object.hasOwn(this, key)).map((key) => [key, (this as Record<string, unknown>)[key]] as const);
        for (const [key] of early) delete (this as Record<string, unknown>)[key];
        // The `cellRange` accessor is reclaimed the same way: a range assigned before the upgrade goes through the setter.
        const rangeBefore = Object.hasOwn(this, 'cellRange') ? { value: (this as Record<string, unknown>)['cellRange'] as CellRange | null } : undefined;
        if (rangeBefore) delete (this as Record<string, unknown>)['cellRange'];
        // A read-only accessor assigned before the upgrade would shadow its getter as an own property for ever: drop it.
        for (const name of READ_ONLY_STATE) {
            if (Object.hasOwn(this, name)) {
                delete (this as Record<string, unknown>)[name];
                ignoreReadOnly(name);
            }
        }
        Object.assign(this, Object.fromEntries(Object.entries(INPUTS).map(([name, [, value]]) => [name, value])));
        this.store.onFlush(() => this.requestUpdate());
        for (const [key, value] of early) Object.assign(this, { [key]: value });
        if (rangeBefore) this.cellRange = rangeBefore.value;
    }

    /** No controllers, no services: nothing can render, so a property written while detached waits for the next connect. */
    protected override shouldUpdate(): boolean {
        return isServer || this.assembled !== null;
    }

    // ---- the host contract ------------------------------------------------------------------------------------

    get config(): DataTableConfig<T> {
        return this;
    }

    get model(): ModelStore<T> {
        return this.store;
    }

    get root(): HTMLElement {
        return this;
    }

    get resolvedLocale(): DataTableLocale {
        return this.localeOf(this.locale, dataTableLocaleVersion(), this.ownerDocument.documentElement.lang);
    }

    cellAt(rowIndex: number, columnKey: string): HTMLElement | null {
        return this.own(`[data-slot="table-cell"][data-row-index="${rowIndex}"][data-column="${CSS.escape(columnKey)}"]`);
    }

    rowAt(rowIndex: number): HTMLElement | null {
        return this.own(`[data-slot="table-row"][data-row-index="${rowIndex}"]`);
    }

    /** The first match that is this table's own: one in a table nested in a detail row can come first in document order. */
    private own(selector: string): HTMLElement | null {
        const first = this.querySelector<HTMLElement>(selector);
        return first === null || ownsTarget(this, first) ? first : (ownElements(this, this.querySelectorAll<HTMLElement>(selector))[0] ?? null);
    }

    emit<K extends keyof DataTableEventMap<T>>(name: K, detail: DataTableEventMap<T>[K]): void {
        this.dispatch(name, detail);
    }

    private dispatch(name: string, detail: unknown): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    announce(message: string): void {
        this.flip = !this.flip;
        // An identical message is still spoken: the text differs by an invisible character every other time.
        this.announcement = this.flip ? message : `${message}​`;
        this.requestUpdate();
    }

    writeCells: DataTableCoreHost<T>['writeCells'] = (requests, options) => this.writer.writeCells(requests, options);
    writeCell: DataTableCoreHost<T>['writeCell'] = (target, value, options) => this.writer.writeCell(target, value, options);
    runAsCommand: DataTableCoreHost<T>['runAsCommand'] = (fn) => this.writer.runAsCommand(fn);
    undo: DataTableCoreHost<T>['undo'] = () => this.writer.undo();
    redo: DataTableCoreHost<T>['redo'] = () => this.writer.redo();

    get canUndo(): boolean {
        return this.writer.canUndo;
    }

    get canRedo(): boolean {
        return this.writer.canRedo;
    }

    provide<K extends keyof DataTableProviders<T>>(key: K, provider: DataTableProviders<T>[K]): () => void {
        this.providers.set(key, provider);
        return () => {
            if (this.providers.get(key) === provider) this.providers.delete(key);
        };
    }

    provider<K extends keyof DataTableProviders<T>>(key: K): DataTableProviders<T>[K] | undefined {
        return this.providers.get(key) as DataTableProviders<T>[K] | undefined;
    }

    /**
     * Adds a handler to the grid's `keydown` chain; lower priorities run first and the first handler that returns true consumes the event. The grid's own
     * priorities are the exported `KEY_PRIORITY` table (PUBLIC API: its numbers are fixed, so a consumer's handler keeps its place; place yours relative
     * to it, e.g. `KEY_PRIORITY.range - 1`). Returns the function that removes it.
     */
    addKeyHandler(priority: number, fn: (event: KeyboardEvent) => boolean): () => void {
        return this.keyHandlers.add(priority, fn);
    }

    requestRender(): void {
        this.requestUpdate();
    }

    afterRender(task: () => void): void {
        this.afterTasks.push(task);
        this.requestUpdate();
    }

    // ---- public methods ---------------------------------------------------------------------------------------

    /** Declares what the current `loading` spell is for, so `loading-visibility` can silence the overlay per trigger. */
    setLoadingTrigger(trigger: DataTableLoadingTrigger): void {
        this.provider('loading')?.setTrigger(trigger);
    }

    /** The whole server request the table is asking for now (what the `query` event carries). */
    currentQuery(): DataTableQuery {
        return requireProvider(this, 'query').currentQuery();
    }

    pinColumn(columnKey: string, pin: 'left' | 'right' | undefined): void {
        requireProvider(this, 'columns').setPin(columnKey, pin);
    }

    showAllColumns(): void {
        requireProvider(this, 'columns').showAll();
    }

    // Thin delegations to the services; each does nothing until the controller that provides the service is part of the plan.

    selectRows(rows: readonly T[]): void {
        this.provider('selection')?.selectRows(rows);
    }

    unselectRows(rows: readonly T[]): void {
        this.provider('selection')?.unselectRows(rows);
    }

    clearSelection(): void {
        this.provider('selection')?.clearSelection();
    }

    selectAll(): void {
        this.provider('selection')?.selectAll();
    }

    toggleRow(row: T): void {
        this.provider('selection')?.toggleRow(row);
    }

    toggleAll(): void {
        this.provider('selection')?.toggleAll();
    }

    /** The rows of `data` (in tree mode, of every level) whose id is selected. A selected id with no row any more is kept in `rowSelection` and not counted here. */
    get selectedRows(): T[] {
        const selection = this.store.get('rowSelection');
        if (this.config.enableSubRows) return [...requireProvider(this, 'query').treeIndex().nodes].filter(([id]) => selection[id] === true).map(([, node]) => node as T);
        return this.store.get('data').filter((row) => selection[this.getRowId(row)] === true);
    }

    expandAllGroups(): void {
        this.provider('expansion')?.expandAllGroups();
    }

    collapseAllGroups(): void {
        this.provider('expansion')?.collapseAllGroups();
    }

    expandAllSubRows(toDepth?: number): void {
        this.provider('expansion')?.expandAllSubRows(toDepth);
    }

    collapseAllSubRows(): void {
        this.provider('expansion')?.collapseAllSubRows();
    }

    scrollToRow(index: number): void {
        this.provider('virtual')?.scrollToRow(index);
    }

    scrollToColumn(columnKey: string): void {
        this.provider('virtual')?.scrollToColumn(columnKey);
    }

    scrollToCell(rowIndex: number, columnKey: string): void {
        this.provider('virtual')?.scrollToCell(rowIndex, columnKey);
    }

    /** The saved-view token (sort, filters, pagination, column state), or null before the table is set up. */
    getViewState(): DataTableViewState | null {
        return this.provider('columns')?.getViewState() ?? null;
    }

    /** Restores a saved view in one step; false when the token is refused. */
    applyViewState(state: DataTableViewState | null | undefined): boolean {
        return this.provider('columns')?.applyViewState(state) ?? false;
    }

    /** Re-measures the viewport, rows and columns, and draws again. */
    refresh(): void {
        this.provider('virtual')?.measure();
        this.requestUpdate();
    }

    /** The cell that holds the roving tab stop, as `{ rowIndex, columnKey }` (the drawn row index), or null. */
    get focusedCell(): CellAddress | null {
        return this.provider('interaction')?.focusedCell() ?? null;
    }

    focusCell(rowIndex: number, columnKey: string): void {
        this.provider('interaction')?.focusCell(rowIndex, columnKey);
    }

    autoSizeColumn(columnKey: string): void {
        this.provider('resize')?.autoSizeColumn(columnKey);
    }

    autoSizeAllColumns(): void {
        this.provider('resize')?.autoSizeAllColumns();
    }

    fitColumnsToViewport(): void {
        this.provider('resize')?.fitColumnsToViewport();
    }

    moveColumn(columnKey: string, targetIndex: number): void {
        this.provider('columns')?.move(columnKey, targetIndex);
    }

    getColumnState(): DataTableColumnState[] {
        return this.provider('columns')?.getState() ?? [];
    }

    applyColumnState(states: readonly DataTableColumnState[] | null | undefined): void {
        this.provider('columns')?.applyState(states);
    }

    // ---- editing and history (wave 5) -------------------------------------------------------------------------

    /** Opens an editor on the cell of `row` and column `columnKey`; false when none opened (not editable, a disabled row, no such row). */
    startEditing(row: T, columnKey: string): boolean {
        return this.provider('interaction')?.startEditing?.(row, columnKey) ?? false;
    }

    /** Commits the open editor's draft; does nothing with none open. */
    commitEdit(): void {
        this.provider('interaction')?.commitEdit?.();
    }

    /** Drops the open editor's draft without an event. */
    cancelEdit(): void {
        this.provider('interaction')?.cancelEdit?.();
    }

    /**
     * Undoes the last edit step (needs `enable-edit-history`); `stale` lists the entries whose row or column is gone. Angular's public name (cmp 4966); the
     * element's `undo` / `redo` fields are the `DataTableCoreHost` members the controllers call (Ctrl+Z), not a second public API: use these.
     */
    undoEdit(): HistoryResult {
        return this.undo();
    }

    /** Redoes the last undone edit step; Angular's public name (cmp 4979). */
    redoEdit(): HistoryResult {
        return this.redo();
    }

    /** An editor is open. Kept for parity (Angular's `isEditingCell()`, cmp 5749); it is `editingCell !== null`. */
    isEditingCell(): boolean {
        return this.editingCell !== null;
    }

    /** The cell whose editor is open, or null. */
    get editingCell(): EditingCell | null {
        return this.provider('interaction')?.editingCell?.() ?? null;
    }

    /** Read-only (Angular exposes it as a signal): a property binding or an assignment is ignored with a one-time warning, it does not throw. */
    set editingCell(_value: EditingCell | null) {
        ignoreReadOnly('editingCell');
    }

    /** The validation error shown on the open editor, or null. */
    get cellEditError(): CellEditError | null {
        return this.provider('interaction')?.cellEditError?.() ?? null;
    }

    /** Read-only, like `editingCell`. */
    set cellEditError(_value: CellEditError | null) {
        ignoreReadOnly('cellEditError');
    }

    /** Clears the advanced filter tree (the column and global filters stay). */
    clearAdvancedFilter(): void {
        // The query controller writes the model with the page reset; with no query provider (before the first connect, or detached) the value is written
        // directly (no page to reset without a query), so it is cleared when the table attaches.
        const query = this.provider('query');
        if (query) query.changeAdvancedFilter(null);
        else this.model.set('advancedFilter', null);
    }

    // ---- range, fill, clipboard and row drag (wave 6) ---------------------------------------------------------

    /**
     * The selected cell range (rendered row index, column key), or null. Assigning it selects programmatically and fires no event. A
     * value assigned before the table is attached waits for the range service.
     */
    get cellRange(): CellRange | null {
        const service = this.serviceOf('range'); // the range session's own (the controllers are built at the first connect and kept; a FAILED session keeps its value)
        if (service) return service.range();
        return this.earlyRange !== undefined && rangeModeOn(this) ? this.earlyRange : null;
    }

    set cellRange(range: CellRange | null) {
        const service = this.serviceOf('range');
        if (service) {
            service.setRange(range); // the session checks the value and asks for the render
            return;
        }
        // No range service yet: before the first connect nothing is assembled (a custom plan without the cell-interaction controller never has one, and
        // then it stays a held value only). The value waits here, checked by the same rules (rows are not known yet), and the range session adopts it
        // right after the first attach.
        const next = sanitizeCellRange(range, 0, []); // the columns are looked up by the session at its next update
        if (next === undefined) warnBadRange(range);
        else this.earlyRange = next;
    }

    /**
     * How an element method reaches a service, by what it needs. VALUE-holding services (the range VALUE `cellRange`, row-drag `reorderData`, pure on data)
     * use `serviceOf(key)`: the controller's own (`services`, which outlives a disconnect: the controllers are built once and kept), so
     * a detached table keeps its value and answers pure questions. Everything that needs the LIVE grid (focus, editing, the clipboard's reads of the
     * query and columns, `fillDownTo`, the queries) uses `provider(key)`, which is cleared at disconnect: such a call is inert or null while detached
     * (as on main) instead of reaching controller code that requires providers that are gone. `serviceOf` is undefined before the first connect (and for a
     * service no controller of a custom plan provides); the range VALUE is never withdrawn, not even when the range session failed.
     */
    private serviceOf<K extends keyof DataTableProviders>(key: K): DataTableProviders[K] | undefined {
        return this.built?.service(key);
    }

    /** Fills the range's source rows down to `targetEndRow`; false when nothing was written (or range / fill are off). */
    fillDownTo(targetEndRow: number): boolean {
        return this.provider('range')?.fillDownTo(targetEndRow) ?? false;
    }

    /** Fires `range-chart-open` with the selected range as a chart payload, when there is one. */
    openRangeChart(): void {
        this.provider('range')?.openChart();
    }

    /** The `copy*ToClipboard` methods resolve to what happened: `status` is `done`, `empty`, `denied` (the browser refused), `unavailable` (no clipboard) or `ignored` (the feature is off). */
    private copyToClipboard(scope: 'cell' | 'row' | 'selected' | 'range' | 'all', row?: T): Promise<ClipboardResult> {
        return this.provider('clipboard')?.copy(scope, row) ?? Promise.resolve({ status: 'unavailable' });
    }

    copyCellToClipboard(): Promise<ClipboardResult> {
        return this.copyToClipboard('cell');
    }

    copyRowToClipboard(row: T): Promise<ClipboardResult> {
        return this.copyToClipboard('row', row);
    }

    copySelectedToClipboard(): Promise<ClipboardResult> {
        return this.copyToClipboard('selected');
    }

    copyCellRangeToClipboard(): Promise<ClipboardResult> {
        return this.copyToClipboard('range');
    }

    copyAllToClipboard(): Promise<ClipboardResult> {
        return this.copyToClipboard('all');
    }

    /** `data` with the dragged row moved as `event` says (flat or tree), without touching the table; a copy of `data` when row drag is not set up. */
    reorderData(data: readonly T[], event: RowReorderEvent<T>): T[] {
        return this.rowDrag().reorderData(data, event);
    }

    /** The row-drag service: the controller's, which outlives a disconnect; the neutral one (its only copy fallback) before the controllers exist. */
    private rowDrag(): RowDragService<T> {
        return (this.serviceOf('rowDrag') as RowDragService<T> | undefined) ?? neutralRowDrag<T>();
    }

    /** Moves a row one step up or down (the keyboard and button alternative to dragging); false when nothing moved (and while the table is detached). */
    moveRow(row: T, direction: 'up' | 'down'): boolean {
        return this.provider('rowDrag')?.moveRow(row, direction) ?? false; // needs the live grid (drawn rows, emits row-reorder): inert while detached
    }

    // ---- lifecycle --------------------------------------------------------------------------------------------

    protected override createRenderRoot(): HTMLElement {
        const root = document.createElement('div');
        root.setAttribute('data-slot', 'data-table-root');
        this.append(root);
        return root;
    }

    override connectedCallback(): void {
        this.harvest();
        super.connectedCallback();
        if (isServer) return;
        const tree = this.getRootNode();
        this.releaseStyles = adoptSheet(tree instanceof ShadowRoot ? tree : this.ownerDocument, 'ge-data-table', css);
        // Built once and kept across reconnects, so what a controller holds (runtime pins, the loading trigger, the range) survives.
        this.built ??= assembleControllers(this, createFactories<T>());
        const built = this.built;
        built.attachAll();
        this.handOverEarlyRange();
        resetIconElement(); // a failed `ge-icon` load is retried at an attach
        this.lastLocale = this.resolvedLocale;
        this.assembled = built;
        this.observer = new MutationObserver(() => {
            this.harvest();
            this.requestUpdate();
        });
        this.observer.observe(this, { childList: true });
        // The language the table draws can change under it: a dictionary registered later, or (with no `locale` set) the page's `lang`.
        // A registration or a `lang` that leaves this table's dictionary as it is (an id it does not use) draws nothing.
        const redrawIfChanged = (): void => (this.resolvedLocale !== this.lastLocale ? this.requestUpdate() : undefined);
        const langObserver = new MutationObserver(redrawIfChanged); // also with a `locale` set: one that names no dictionary follows the page
        langObserver.observe(this.ownerDocument.documentElement, { attributes: true, attributeFilter: ['lang'] });
        this.disposables.add(onDataTableLocaleChange(redrawIfChanged));
        this.disposables.add(() => langObserver.disconnect());
        this.requestUpdate();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = null;
        try {
            this.assembled?.detachAll();
        } finally {
            this.assembled = null;
            this.providers.clear();
            cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.disposables.dispose();
            this.releaseStyles?.();
            this.releaseStyles = null;
        }
    }

    /** Moves the consumer's slotted children out of the light DOM; render puts the same nodes back in the right place. */
    private harvest(): void {
        for (const child of [...this.children]) {
            const slot = child.getAttribute('slot');
            if (slot === null || !SLOT_NAMES.has(slot) || child === this.renderRoot) continue;
            this.slotted.set(slot, [...(this.slotted.get(slot) ?? []), child]);
            child.remove();
            // The consumer still holds this node: its own `remove()` must retire it, not leave it to reappear at the next render.
            Object.defineProperty(child, 'remove', {
                configurable: true,
                value: () => {
                    // Lit clears a template part with `remove()` too; that is a re-render, not the consumer letting go.
                    if (!this.rendering) this.unharvest(child);
                    Element.prototype.remove.call(child);
                },
            });
        }
    }

    private isHarvested(node: Node): boolean {
        return [...this.slotted.values()].some((list) => list.includes(node));
    }

    /** Forgets a harvested node (the consumer removed or replaced it); true when it was one. */
    private unharvest(node: Node): boolean {
        let found = false;
        for (const [name, list] of this.slotted) {
            const rest = list.filter((n) => n !== node);
            if (rest.length === list.length) continue;
            found = true;
            if (rest.length > 0) this.slotted.set(name, rest);
            else this.slotted.delete(name);
        }
        if (found) this.requestUpdate();
        return found;
    }

    // Harvested nodes live in the render root, but the consumer still thinks they are children of the element:
    // its `parent.removeChild(node)` and friends must work, as they do for a node of a real slot.
    override removeChild<N extends Node>(child: N): N {
        if (!this.unharvest(child)) return super.removeChild(child);
        child.parentNode?.removeChild(child);
        return child;
    }

    override replaceChild<N extends Node>(node: Node, child: N): N {
        if (!this.unharvest(child)) return super.replaceChild(node, child);
        child.parentNode?.removeChild(child);
        this.append(node);
        return child;
    }

    override insertBefore<N extends Node>(node: N, child: Node | null): N {
        return super.insertBefore(node, child !== null && this.isHarvested(child) ? null : child);
    }

    /**
     * A `cellRange` held here (assigned before the first connect) goes to the range session right after the first `attachAll()` (never from an update:
     * that would request a render while rendering). With no range service at all (a custom plan) it stays a held value.
     */
    private handOverEarlyRange(): void {
        const range = this.serviceOf('range');
        if (this.earlyRange !== undefined && range) {
            range.setRange(this.earlyRange);
            this.earlyRange = undefined;
        }
    }

    private rendering = false;

    protected override update(changed: PropertyValues): void {
        this.rendering = true;
        try {
            super.update(changed);
        } finally {
            this.rendering = false;
        }
    }

    /** Whether the range part handles ranges, read ONCE per update (`syncHost`, before the render) so the part is asked once; passed to the view, not public API. */
    private rangeActive = false;

    private syncHost(): void {
        this.rangeActive = this.provider('range')?.active() ?? false;
        const flags: [string, boolean][] = [
            ['data-row-borders', this.showRowBorders],
            ['data-column-borders', this.showColumnBorders],
            // user-select: none on the viewport only while range selection is actually handled (the range service is active), like aria-selected
            ['data-range-selection', rangeSelectionDrawn(this, this.rangeActive)],
            ['aria-busy', this.skeleton || (this.provider('loading')?.visible() ?? false)],
        ];
        for (const [name, on] of flags) {
            if (on) this.setAttribute(name, name === 'aria-busy' ? 'true' : '');
            else this.removeAttribute(name);
        }
        if (this.theme) this.setAttribute(THEME_ATTRIBUTE, this.theme);
        else this.removeAttribute(THEME_ATTRIBUTE);
        const wantsRtl = this.resolvedLocale.rtl === true;
        if (this.dirManaged && !wantsRtl) {
            this.removeAttribute('dir');
            this.dirManaged = false;
        } else if (!this.dirManaged && wantsRtl && !this.hasAttribute('dir')) {
            this.setAttribute('dir', 'rtl');
            this.dirManaged = true;
        }
        this.style.setProperty('--ge-dt-indent', `${this.subRowIndentSize}px`);
        if (this.virtualRowHeight) this.style.setProperty('--ge-dt-row-height', `${this.virtualRowHeight}px`);
        else this.style.removeProperty('--ge-dt-row-height');
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (isServer) return;
        // The locale topic follows the resolved dictionary: a new `locale`, a dictionary registered later, a changed page language.
        const resolved = this.resolvedLocale;
        // `lastLocale` is what the controllers read when they attached (or last heard): on a plain first render nothing differs and nothing
        // is announced, so an addon is not built twice; a `locale` set after the attach but before the first render does differ.
        if ((this.hasUpdated && changed.has('locale')) || resolved !== this.lastLocale) this.topics.emit('locale');
        this.lastLocale = resolved;
        if ([...changed.keys()].some((key) => Object.hasOwn(INPUTS, key as string))) this.topics.emit('config');
        for (const controller of this.assembled?.controllers ?? []) controller.hostUpdate?.();
        this.syncHost();
    }

    protected override updated(): void {
        // One frame runs every task queued by then (also those of an update that came while it was pending); none is dropped.
        if (this.afterTasks.length === 0 || this.frame !== 0) return;
        this.frame = requestAnimationFrame(() => {
            this.frame = 0;
            for (const task of this.afterTasks.splice(0)) task();
        });
    }

    // ---- rendering --------------------------------------------------------------------------------------------

    private nodes(name: string): Node[] | typeof nothing {
        return this.slotted.get(name) ?? nothing;
    }

    /** @internal Part of the view contract (`DataTableViewHost`), not of the element's public API. */
    isDisabled(row: T): boolean {
        return this.isRowDisabled?.(row) === true || this.isIdDisabled(this.getRowId(row));
    }

    /** @internal Part of the view contract (`DataTableViewHost`), not of the element's public API. */
    slottedNodes(name: string): readonly Node[] | undefined {
        return this.slotted.get(name);
    }

    private isIdDisabled(id: string): boolean {
        const ids = this.disabledRowIds;
        return ids === undefined ? false : 'has' in ids ? ids.has(id) : ids.includes(id);
    }

    private renderToolbar(locale: DataTableLocale): TemplateResult {
        const query = requireProvider(this, 'query');
        const hideable = this.columns.filter((c: ColumnDef<T>) => c.enableHiding !== false && c.accessorKey !== '_selection');
        const visibility = this.store.get('columnVisibility');
        return html`<div data-slot="data-table-toolbar">
            <div data-slot="data-table-toolbar-start">
                <div data-slot="data-table-filter"><ge-input placeholder=${locale.filterPlaceholder} aria-label=${locale.filterPlaceholder} .value=${this.store.get('globalFilter')}
                    @input=${(event: Event) => query.changeGlobalFilter((event.currentTarget as HTMLInputElement).value)}></ge-input></div>
                ${this.renderParts('renderToolbar')}
                ${this.nodes('toolbar-start')}
            </div>
            <div data-slot="data-table-toolbar-end">
                ${this.nodes('toolbar-end')}
                ${this.showColumnVisibilityToggle && hideable.length > 0
                    ? html`<ge-popover>
                          <ge-popover-trigger><button type="button" data-slot="data-table-columns-trigger" aria-label=${locale.toggleColumns}>${locale.columnsLabel}</button></ge-popover-trigger>
                          <ge-popover-content data-slot="data-table-columns-panel">
                              ${hideable.map((c: ColumnDef<T>) => {
                                  const key = String(c.accessorKey);
                                  return html`<div data-slot="data-table-columns-item">
                                      <ge-checkbox .checked=${!(Object.hasOwn(visibility, key) && visibility[key] === false)} aria-label=${interpolate(locale.toggleColumnAriaLabel, { column: c.header })}
                                          @change=${(event: Event) => requireProvider(this, 'columns').setVisible(key, (event.currentTarget as HTMLInputElement).checked)}></ge-checkbox>
                                      <span>${c.header}</span>
                                  </div>`;
                              })}
                              <button type="button" data-slot="data-table-columns-item" data-kind="show-all" @click=${() => requireProvider(this, 'columns').showAll()}>${locale.showAllColumns}</button>
                          </ge-popover-content>
                      </ge-popover>`
                    : nothing}
            </div>
        </div>`;
    }

    private renderOverlays(locale: DataTableLocale): unknown {
        const loading = this.provider('loading');
        const busy = this.provider('addons')?.busyLabel() ?? null;
        const box = (label: string) => html`<div data-slot="data-table-loader-box"><span data-slot="data-table-spinner"></span><span>${label}</span></div>`;
        return html`${loading?.visible()
            ? html`<div data-slot="data-table-loader" role="status">${this.renderLoader?.(loading.trigger()) ?? this.slotted.get('loading') ?? box(locale.loading)}</div>`
            : nothing}${busy === null ? nothing : html`<div data-slot="data-table-loader" data-kind="busy" role="status">${box(busy)}</div>`}`;
    }

    /** What each controller draws in the toolbar or over the grid: one that throws is reported once (per controller and slot) and draws nothing, never a broken render. */
    private renderParts(slot: 'renderToolbar' | 'renderOverlay'): unknown[] {
        return (this.assembled?.controllers ?? []).map((controller, index) => {
            try {
                return controller[slot]?.();
            } catch (error) {
                warnOncePer(this, `controller-${index}-${slot}`, `[ge-data-table] a controller threw in ${slot}:`, error);
                return undefined;
            }
        });
    }

    protected override render(): unknown {
        if (isServer) return nothing;
        const locale = this.resolvedLocale;
        if (this.skeleton) return renderSkeleton(this.skeletonRows, locale.loading);
        const grid = buildView(this, this.rangeActive);
        const query = requireProvider(this, 'query');
        return html`<output data-slot="data-table-announcer" aria-live="polite" aria-atomic="true">${this.announcement}</output>
            ${this.showToolbar ? this.renderToolbar(locale) : nothing}
            <div data-slot="data-table-viewport" tabindex=${grid.viewportTabbable ? '0' : '-1'} @keydown=${(event: KeyboardEvent) => ownsTarget(this, event.target) && void this.keyHandlers.run(event)}>
                ${this.renderOverlays(locale)}${renderGrid(grid)}${this.renderParts('renderOverlay')}
            </div>
            ${this.slotted.has('footer') ? html`<div data-slot="data-table-footer-slot">${this.nodes('footer')}</div>` : nothing}
            ${this.showPagination
                ? html`<ge-data-table-pager .total=${query.totalItems()} .state=${this.store.get('paginationState') as PaginationState} .pageSizeOptions=${this.pageSizeOptions} .showPageSizeSelector=${this.showPageSizeSelector}
                      .rowsPerPageLabel=${locale.rowsPerPageLabel} .pageLabel=${locale.pageLabel} .ofLabel=${locale.ofLabel} .firstLabel=${locale.goToFirstPage} .previousLabel=${locale.goToPreviousPage}
                      .nextLabel=${locale.goToNextPage} .lastLabel=${locale.goToLastPage} @pagination-change=${(event: CustomEvent<PaginationState>) => query.changePage(event.detail)}></ge-data-table-pager>`
                : nothing}`;
    }
}

for (const key of MODEL_KEYS) {
    Object.defineProperty(GeDataTable.prototype, key, {
        configurable: true,
        get(this: GeDataTable) {
            return this.model.get(key);
        },
        set(this: GeDataTable, value: never) {
            this.model.assign(key, value);
            this.requestUpdate();
        },
    });
}
