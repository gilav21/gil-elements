import { html, isServer, LitElement, nothing, type PropertyDeclaration, type PropertyValues, type TemplateResult } from 'lit';
import '../checkbox/define.js';
import '../icon/define.js';
import '../input/define.js';
import '../popover/define.js';
import '../skeleton/define.js';
import { adoptSheet } from '../shared/adopt-sheet.js';
import { THEME_ATTRIBUTE, type ThemeName } from '../shared/theme-presets.js';
import { computeGridAria } from './data-table-aria.js';
import { createCellWriter } from './data-table-cell-write.js';
import { columnCssVars } from './data-table-columns.js';
import { ColumnsController } from './data-table-columns-controller.js';
import { type AssembledControllers, assembleControllers, type DataTableControllerFactories } from './data-table-controllers.js';
import type { DataTableEventMap } from './data-table-events.js';
import { FooterController } from './data-table-footer-controller.js';
import { FormattingController } from './data-table-formatting-controller.js';
import { renderGrid, renderSkeleton, type GridView } from './data-table-grid.js';
import { type CellAddress, type DataTableCoreHost, type DataTableTopic, requireProvider } from './data-table-host.js';
import { LoadingController } from './data-table-loading-controller.js';
import { MODEL_KEYS, ModelStore, type ModelValues } from './data-table-model.js';
import type { DataTableConfig, DataTableProviders } from './data-table-providers.js';
import { QueryController } from './data-table-query-controller.js';
import { activeSorts, memoLast } from './data-table-query.js';
import { Disposables, HandlerChain, TopicBus } from './data-table-registry.js';
import { type DataTableLocale, interpolate, resolveDataTableLocale, withEnglishFallback } from './data-table.locales.js';
import type { ColumnDef, DataTableLoadingTrigger, DataTableQuery, PaginationState } from './data-table.types.js';
import { defaultGetRowId } from './data-table.utils.js';
import './sub/data-table-column-header.js';
import './sub/data-table-pager.js';
import css from './data-table.css?inline';

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
}

type Kind = 'prop' | 'flag' | 'on' | 'number' | 'text' | 'tri' | 'list';

/** Every input: how it maps to an attribute, and its default. `on` is a flag that defaults to true (`attr="false"` turns it off). */
const INPUTS: Readonly<Record<string, readonly [Kind, unknown]>> = {
    columns: ['prop', []],
    getRowId: ['prop', defaultGetRowId],
    globalFilterFn: ['prop', undefined],
    getChildren: ['prop', (row: unknown) => (row as { children?: unknown[] } | null)?.children],
    setChildren: ['prop', (row: unknown, children: unknown[]) => ({ ...(row as object), children })],
    aiProvider: ['prop', undefined],
    loadingVisibility: ['prop', undefined],
    disabledRowIds: ['prop', undefined],
    isRowDisabled: ['prop', undefined],
    renderEmpty: ['prop', undefined],
    renderLoader: ['prop', undefined],
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
 * @attr {string} locale - Language id of the table's text. `en` is built in; others register with `registerDataTableLocale`.
 * @attr {string} theme - Colour preset name.
 */
export class GeDataTable<T = unknown> extends LitElement implements DataTableCoreHost<T> {
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
        emit: (...event) => this.emit(event[0], event[1] as never),
    });
    private built: AssembledControllers | null = null;
    private assembled: AssembledControllers | null = null;
    private releaseStyles: (() => void) | null = null;
    private observer: MutationObserver | null = null;
    private frame = 0;
    private afterTasks: (() => void)[] = [];
    private announcement = '';
    private flip = false;
    private dirManaged = false;
    private readonly localeOf = memoLast((input: string | DataTableLocale | undefined) => withEnglishFallback(resolveDataTableLocale(input)));

    constructor() {
        super();
        // A model state written before the element upgraded is an own property that would shadow the accessor: take it back.
        const early = MODEL_KEYS.filter((key) => Object.hasOwn(this, key)).map((key) => [key, (this as Record<string, unknown>)[key]] as const);
        for (const [key] of early) delete (this as Record<string, unknown>)[key];
        Object.assign(this, Object.fromEntries(Object.entries(INPUTS).map(([name, [, value]]) => [name, value])));
        this.store.onFlush(() => this.requestUpdate());
        for (const [key, value] of early) Object.assign(this, { [key]: value });
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
        return this.localeOf(this.locale);
    }

    cellAt(rowIndex: number, columnKey: string): HTMLElement | null {
        return this.querySelector(`[data-slot="table-cell"][data-row-index="${rowIndex}"][data-column="${CSS.escape(columnKey)}"]`);
    }

    rowAt(rowIndex: number): HTMLElement | null {
        return this.querySelector(`[data-slot="table-row"][data-row-index="${rowIndex}"]`);
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
        const factories: DataTableControllerFactories<T> = {
            columns: (host) => new ColumnsController(host),
            query: (host) => new QueryController(host),
            loading: (host) => new LoadingController(host),
            formatting: (host) => new FormattingController(host),
            footer: (host) => new FooterController(host),
        };
        // Built once and kept across reconnects, so what a controller holds (runtime pins, the loading trigger) survives.
        this.built ??= assembleControllers(this, factories);
        this.built.attachAll();
        this.assembled = this.built;
        this.observer = new MutationObserver(() => {
            this.harvest();
            this.requestUpdate();
        });
        this.observer.observe(this, { childList: true });
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

    private rendering = false;

    protected override update(changed: PropertyValues): void {
        this.rendering = true;
        try {
            super.update(changed);
        } finally {
            this.rendering = false;
        }
    }

    private syncHost(): void {
        const flags: [string, boolean][] = [
            ['data-row-borders', this.showRowBorders],
            ['data-column-borders', this.showColumnBorders],
            ['data-range-selection', this.enableCellRangeSelection],
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
        if (changed.has('locale')) this.topics.emit('locale');
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

    private view(): { grid: GridView<T>; vars: string } {
        const columns = requireProvider(this, 'columns').enhancedColumns();
        const query = requireProvider(this, 'query');
        const footer = this.provider('footer');
        const rows = query.renderedRows();
        const sorts = activeSorts(this.enableMultiSort, this.store.get('sortState'), this.store.get('multiSortState'));
        const showFooter = footer?.visible() ?? false;
        const empty = rows.length === 0 ? (this.renderEmpty?.() ?? this.slotted.get('empty')) : undefined;
        const focus = this.provider('interaction')?.focusedCell() ?? null;
        const selection = this.store.get('rowSelection');
        const grid: GridView<T> = {
            locale: this.resolvedLocale,
            columns,
            hasFlexible: columns.some((c) => c._width === 'auto'),
            rows,
            // A rendered empty state is one real row (with a spanning cell), so it counts and the footer follows it.
            aria: computeGridAria({ tree: this.enableSubRows || !!this.groupBy, headerRows: 1, totalDataRows: rows.length || 1, columnCount: columns.length, footerRows: showFooter ? 1 : 0 }),
            selectable: this.enableRowSelection,
            resizable: this.enableColumnResize,
            selection,
            expanded: this.store.get('expandedRows'),
            getRowId: (row) => this.getRowId(row),
            isDisabled: (row) => this.isRowDisabled?.(row) === true || this.isIdDisabled(this.getRowId(row)),
            formatting: this.provider('formatting'),
            footer: { visible: showFooter, values: footer?.values() ?? new Map(), rows: query.sortedData() },
            sortDirection: (key) => query.sortDirection(key),
            sortIndex: (key) => {
                const index = sorts.findIndex((s) => s.column === key);
                return this.enableMultiSort && index !== -1 ? index : null;
            },
            onSortRequest: (key, event) => {
                event.stopPropagation();
                query.changeSort(key, event.detail.direction, event.detail.multi);
            },
            focusedCell: focus as CellAddress | null,
            empty,
        };
        return { grid, vars: columnCssVars(columns) };
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

    protected override render(): unknown {
        if (isServer) return nothing;
        const locale = this.resolvedLocale;
        if (this.skeleton) return renderSkeleton(this.skeletonRows, locale.loading);
        const { grid, vars } = this.view();
        const query = requireProvider(this, 'query');
        const focused = grid.focusedCell !== null;
        return html`<output data-slot="data-table-announcer" aria-live="polite" aria-atomic="true">${this.announcement}</output>
            ${this.showToolbar ? this.renderToolbar(locale) : nothing}
            <div data-slot="data-table-viewport" tabindex=${focused ? '-1' : '0'} @keydown=${(event: KeyboardEvent) => void this.keyHandlers.run(event)}>
                ${this.renderOverlays(locale)}${renderGrid(grid, vars)}
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
