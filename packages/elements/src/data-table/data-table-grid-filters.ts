/**
 * The header's filter trigger and the floating filter row (wave 5, package A owns this file). `GridView.filters` is called from
 * `headContent` (after the sort control) and from `renderGrid` (the second row of the header rowgroup). The state behind them (which
 * panel is open, the debounced floating input, the lazy panels) is the `filter-ui` controller's: it provides the `filters` service
 * with the extra members of `FilterUiService`, which this view asks for. A `filters` provider of the plain `FilterService` shape
 * (a stub) draws no trigger and no row.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { computeGridAria } from './data-table-aria.js';
import { componentCell } from './data-table-component-cell.js';
import { cellVarsStyle } from './data-table-columns.js';
import { chromeIcon } from './data-table-icons.js';
import { columnParts, columnSpacer } from './data-table-grid-window.js';
import { requireProvider } from './data-table-host.js';
import type { FilterService } from './data-table-providers.js';
import type { DataTableViewHost } from './data-table-view.js';
import { interpolate } from './data-table.locales.js';
import type { BodyWindow, ColumnDef, ComponentOutputs, EnhancedColumnDef } from './data-table.types.js';
import { isSpecialColumnKey, specialSlotOf, stringifyValue } from './data-table.utils.js';

export interface FiltersView<T> {
    /** The filter trigger of a data column's header, drawn after its sort control; `nothing` for none. */
    trigger(column: EnhancedColumnDef<T>): unknown;
    /** The floating filter row (`div[table-row][data-kind=filter][role=row]`), the second row of the header rowgroup; `nothing` for none. */
    row(): unknown;
    /** Header rows drawn above the data: 0 or 1 here, so `headerRows` is `1 + rows` and the first data row is `aria-rowindex` `2 + rows`. */
    rows: number;
}

/** What the `filter-ui` controller adds to `FilterService` for this view: its state and its stable handlers. */
export interface FilterUiService<T> extends FilterService<T> {
    /** The header trigger draws for this column (`enableFiltering` and a panel). */
    hasTrigger(column: ColumnDef<T>): boolean;
    /** The column's panel popover is open (its content is drawn only then). */
    panelOpen(columnKey: string): boolean;
    /** The popover's `open-change` of a column trigger. */
    onPanelToggle(columnKey: string): (event: CustomEvent<boolean>) => void;
    /** Starts loading the lazy panel a column uses (hover and focus of its trigger). */
    prefetch(column: ColumnDef<T>): void;
    /** The properties of the column's filter component: `filterComponentInputs`, then `column` and `value` (the current filter, D2). */
    panelInputs(column: ColumnDef<T>): Record<string, unknown>;
    /** `filterComponentOutputs`, its own `filter-change` composed with the table's (consumer first); stable per column, so listeners are not re-added. */
    panelOutputs(column: ColumnDef<T>): ComponentOutputs;
    /** The floating component's listeners: only the table's `filter-change` (the header panel's outputs are not its own). */
    floatingOutputs(column: ColumnDef<T>): ComponentOutputs;
    /** A stable setter of the column's filter (the floating renderer's `setValue`). */
    setter(columnKey: string): (value: unknown) => void;
    /** The floating text input's `input` handler (debounced by `filterDebounce`, D6). */
    floatingInput(columnKey: string): (event: Event) => void;
}

/** The step 0 view: no trigger, no floating row. A constant, so a render with nothing to filter allocates no view. */
const NO_FILTERS: FiltersView<unknown> = Object.freeze({ trigger: () => nothing, row: () => nothing, rows: 0 });

/** The floating row is the SECOND header row: its `aria-rowindex` from the grid's own aria rule (`headerRowIndex(1)`), not a literal. */
const FLOATING_ROW_INDEX = computeGridAria({ tree: false, headerRows: 2, totalDataRows: 0, columnCount: 0 }).headerRowIndex(1);

const isUiService = <T>(service: FilterService<T> | undefined): service is FilterUiService<T> => typeof (service as Partial<FilterUiService<T>> | undefined)?.panelOpen === 'function';

export function filtersView<T>(host: DataTableViewHost<T>): FiltersView<T> {
    const service = host.provider('filters');
    if (!isUiService(service)) return NO_FILTERS as FiltersView<T>;
    const { config, resolvedLocale: locale } = host;
    const floating = config.enableFloatingFilters && service.hasAnyFloating();
    const anyTrigger = config.columns.some((c) => service.hasTrigger(c));
    if (!floating && !anyTrigger) return NO_FILTERS as FiltersView<T>;
    const filters = host.model.get('columnFilters');
    const valueOf = (key: string): unknown => (Object.hasOwn(filters, key) ? filters[key] : undefined);

    const trigger = (c: EnhancedColumnDef<T>): unknown => {
        if (!service.hasTrigger(c)) return nothing;
        const key = String(c.accessorKey);
        const active = service.isActive(key);
        const open = service.panelOpen(key);
        const prefetch = (): void => service.prefetch(c);
        // The panel sits inside the head cell (DOM-wise): `data-table-keeps-focus` makes every press in it the panel's own, so the column drag
        // (its OWN_PRESS already matches the attribute) never starts from a panel, whatever controls a consumer's panel holds.
        return html`<ge-popover close-on-scroll @open-change=${service.onPanelToggle(key)}>
            <ge-popover-trigger><button type="button" data-slot="data-table-filter-trigger" ?data-active=${active} aria-label=${interpolate(active ? locale.filterColumnActive : locale.filterColumn, { column: c.header })}
                @pointerenter=${prefetch} @focus=${prefetch}>${chromeIcon('filter', 'sm', undefined, active)}</button></ge-popover-trigger>
            <ge-popover-content data-slot="data-table-filter-panel" data-table-keeps-focus strategy="fixed" align="end">${open && c.filterComponent ? componentCell(c.filterComponent, service.panelInputs(c), service.panelOutputs(c)) : nothing}</ge-popover-content>
        </ge-popover>`;
    };

    if (!floating) return { trigger, row: () => nothing, rows: 0 };

    const control = (c: EnhancedColumnDef<T>): unknown => {
        const key = String(c.accessorKey);
        // Its own contract only (`column`, `value`, `filter-change`): the header panel's `filterComponentInputs` / `Outputs` are that panel's, not its.
        if (c.floatingFilterComponent) return componentCell(c.floatingFilterComponent, { column: c, value: valueOf(key) }, service.floatingOutputs(c));
        if (c.floatingFilterRenderer) return c.floatingFilterRenderer({ column: c, value: valueOf(key), setValue: service.setter(key) });
        return html`<ge-input placeholder=${c.header} aria-label=${interpolate(locale.filterColumn, { column: c.header })} .value=${stringifyValue(valueOf(key))} @input=${service.floatingInput(key)}></ge-input>`;
    };

    const cell = (c: EnhancedColumnDef<T>, n: number): TemplateResult => {
        const has = service.hasFloating(c);
        return html`<div data-slot="table-head" role=${has ? 'columnheader' : 'presentation'} aria-colindex=${has ? n + 1 : nothing} data-width=${c._width === 'auto' ? 'auto' : 'fixed'}
            data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(c.accessorKey) ? specialSlotOf(c) : nothing} style=${cellVarsStyle(c, n)}>${has ? control(c) : nothing}</div>`;
    };

    const row = (): TemplateResult => {
        const columns = requireProvider(host, 'columns').enhancedColumns();
        const window: BodyWindow = host.provider('virtual')?.window() ?? { start: 0, end: 0, padStart: 0, padEnd: 0, colPadStart: 0, colPadEnd: 0, colStart: 0, colEnd: columns.length, retained: [] };
        const flexible = columns.some((c) => c._width === 'auto');
        return html`<div data-slot="table-row" role="row" data-kind="filter" aria-rowindex=${FLOATING_ROW_INDEX}>${columnParts(columns, window).map((p) => ('spacer' in p ? columnSpacer(p.spacer) : cell(p.column, p.n)))}${flexible ? nothing : html`<div data-slot="table-head" role="presentation"></div>`}</div>`; // no column borders: Angular's floating cells have none (html 763)
    };

    return { trigger, row, rows: 1 };
}
