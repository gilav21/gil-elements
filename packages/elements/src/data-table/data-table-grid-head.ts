/** The header row of the grid and the view of the columns it reads. Package C (columns) owns this file. */
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { sortAriaLabel } from './data-table-cells.js';
import { cellVarsStyle, columnCssVars, isReorderable, pxOf } from './data-table-columns.js';
import type { GridView } from './data-table-grid.js';
import { columnParts, columnSpacer } from './data-table-grid-window.js';
import { specialHead } from './data-table-grid-special.js';
import { requireProvider } from './data-table-host.js';
import { activeSorts, ariaSortOf } from './data-table-query.js';
import type { DataTableViewHost } from './data-table-view.js';
import { columnMinWidthPx } from './data-table-virtual.js';
import { interpolate } from './data-table.locales.js';
import type { EnhancedColumnDef, SortDirection } from './data-table.types.js';
import { isSpecialColumnKey, specialSlotOf } from './data-table.utils.js';

export interface ColumnsView<T> {
    columns: readonly EnhancedColumnDef<T>[];
    hasFlexible: boolean;
    resizable: boolean;
    /** `enable-column-reorder`: data headers can be dragged, and moved with Alt+Shift+Arrow. */
    reorderable: boolean;
    /** The inline custom properties of `[data-slot=table]`: `--ge-dt-col-N`, `--ge-dt-colmin-N`, `--ge-dt-pin-N`. */
    vars: string;
    sortDirection(key: string): SortDirection;
    sortIndex(key: string): number | null;
    onSortRequest(columnKey: string, event: CustomEvent<{ direction: SortDirection; multi: boolean }>): void;
}

export function columnsView<T>(host: DataTableViewHost<T>): ColumnsView<T> {
    const query = requireProvider(host, 'query');
    const columns = requireProvider(host, 'columns').enhancedColumns();
    const { config, model } = host;
    const sorts = activeSorts(config.enableMultiSort, model.get('sortState'), model.get('multiSortState'));
    return {
        columns,
        hasFlexible: columns.some((c) => c._width === 'auto'),
        resizable: config.enableColumnResize,
        reorderable: config.enableColumnReorder,
        vars: columnCssVars(columns),
        sortDirection: (key) => query.sortDirection(key),
        sortIndex: (key) => {
            const index = sorts.findIndex((s) => s.column === key);
            return config.enableMultiSort && index !== -1 ? index : null;
        },
        onSortRequest: (key, event) => {
            event.stopPropagation();
            query.changeSort(key, event.detail.direction, event.detail.multi);
        },
    };
}

/** Keys that move a reorderable header, for `aria-keyshortcuts` on its sort button. */
const REORDER_KEYS = 'Alt+Shift+ArrowLeft Alt+Shift+ArrowRight';

function headContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const special = specialHead(v, c);
    if (special !== undefined) return special;
    const key = String(c.accessorKey);
    if (c.headerRenderer) return c.headerRenderer({ column: c });
    if (c.enableSorting === false) return html`<div data-slot="data-table-head-controls"><span>${c.header}</span></div>`;
    const direction = v.sortDirection(key);
    const index = v.sortIndex(key);
    return html`<div data-slot="data-table-head-controls"><ge-data-table-column-header .title=${c.header} .column=${key} .direction=${direction} .sortIndex=${index} .shortcuts=${v.reorderable && isReorderable(c) ? REORDER_KEYS : ''} .label=${sortAriaLabel(c.header, direction, index, v.locale)} @sort-request=${(e: CustomEvent<{ direction: SortDirection; multi: boolean }>) => v.onSortRequest(key, e)}></ge-data-table-column-header></div>`;
}

/** A separator's `aria-valuemax` defaults to 100 and clamps the value; a column has no real maximum. */
const MAX_WIDTH = 10000;

/** The focusable separator that resizes a column: drag, double click, or arrow keys (APG window splitter). */
function resizeHandle<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const width = pxOf(c._width);
    return html`<div data-slot="data-table-resize-handle" role="separator" aria-orientation="vertical" tabindex="0" aria-label=${interpolate(v.locale.resizeColumn, { column: c.header })}
        aria-description=${v.locale.resizeColumnDescription} aria-valuemin=${Math.round(columnMinWidthPx(c))} aria-valuemax=${MAX_WIDTH} aria-valuenow=${width === null ? nothing : Math.round(width)}><div data-slot="data-table-resize-line" aria-hidden="true"></div></div>`;
}

function headCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number): TemplateResult {
    const key = String(c.accessorKey);
    const draggable = v.reorderable && isReorderable(c);
    return html`<div data-slot="table-head" role="columnheader" aria-colindex=${v.aria.colIndex(n) ?? nothing} aria-sort=${ariaSortOf(c, v.sortDirection(key)) ?? nothing}
        data-column-id=${key} data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? specialSlotOf(c) : nothing}
        data-border ?data-resizable=${v.resizable} ?data-draggable=${draggable} aria-description=${draggable ? v.locale.reorderColumnHint : nothing} style=${cellVarsStyle(c, n)}>
        <div data-slot="data-table-head-content"><div data-slot="data-table-head-main">${headContent(v, c)}</div></div>
        ${v.resizable && key !== '_selection' ? resizeHandle(v, c) : nothing}
    </div>`;
}

/** The cells of the header row, then the filler that stretches the row when no column is flexible. */
export function renderHeadCells<T>(v: GridView<T>): TemplateResult {
    // package B: window (only the windowed middle columns are drawn, at their absolute position)
    return html`${repeat(columnParts(v.columns, v.body.window), (p) => ('spacer' in p ? `s:${p.spacer}` : String(p.column.accessorKey)), (p) => ('spacer' in p ? columnSpacer(p.spacer) : headCell(v, p.column, p.n)))}${v.hasFlexible ? nothing : html`<div data-slot="table-head" role="presentation" data-border></div>`}`;
}
