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
import { columnMinWidthPx, rootFontPx } from './data-table-virtual.js';
import { interpolate } from './data-table.locales.js';
import type { EnhancedColumnDef, SortDirection } from './data-table.types.js';
import { isSpecialColumnKey, specialSlotOf } from './data-table.utils.js';

export interface ColumnsView<T> {
    columns: readonly EnhancedColumnDef<T>[];
    hasFlexible: boolean;
    resizable: boolean;
    /** The root font size in px: the unit of a `rem` minimum width, as the resize logic reads it. */
    rootFontPx: number;
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
        rootFontPx: config.enableColumnResize ? rootFontPx(host.root) : 16,
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

/** The sort control of a header (the column title, or the consumer's renderer); the tree-host header puts its toggle beside it. */
export function sortControl<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const key = String(c.accessorKey);
    if (c.headerRenderer) return c.headerRenderer({ column: c });
    if (c.enableSorting === false) return html`<span>${c.header}</span>`;
    const direction = v.sortDirection(key);
    const index = v.sortIndex(key);
    return html`<ge-data-table-column-header .title=${c.header} .column=${key} .direction=${direction} .sortIndex=${index} .shortcuts=${v.reorderable && isReorderable(c) ? REORDER_KEYS : ''} .label=${sortAriaLabel(c.header, direction, index, v.locale)} @sort-request=${(e: CustomEvent<{ direction: SortDirection; multi: boolean }>) => v.onSortRequest(key, e)}></ge-data-table-column-header>`;
}

/** A renderer result that draws nothing: Lit's `nothing`, `null`, `undefined` or an empty string. */
export const isEmptyContent = (value: unknown): boolean => value === nothing || value === null || value === undefined || value === '';

function headContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const special = specialHead(v, c);
    if (special !== undefined) return special;
    const control = sortControl(v, c);
    const trigger = v.filters.trigger(c);
    // ONE template always: a header renderer is drawn bare (`data-bare`: the wrapper has no box of its own) until a filter trigger sits beside it. A
    // different template when the trigger appears would rebuild the consumer's header element (a remount). The price: a header renderer's output is
    // inside `div[data-slot=data-table-head-controls][data-bare]` (`display: contents`), so a consumer selector such as `[data-slot=table-head] > x`
    // must be a descendant selector (`[data-slot=table-head] x`).
    return html`<div data-slot="data-table-head-controls" ?data-bare=${!!c.headerRenderer && isEmptyContent(trigger)}>${control}${trigger}</div>`;
}

/** A separator's `aria-valuemax` defaults to 100 and clamps the value; a column has no real maximum. */
const MAX_WIDTH = 10000;

/** The focusable separator that resizes a column: drag, double click, or arrow keys (APG window splitter). */
function resizeHandle<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const width = pxOf(c._width);
    return html`<div data-slot="data-table-resize-handle" role="separator" aria-orientation="vertical" tabindex="0" aria-label=${interpolate(v.locale.resizeColumn, { column: c.header })}
        aria-description=${v.locale.resizeColumnDescription} aria-valuemin=${Math.round(columnMinWidthPx(c, v.rootFontPx))} aria-valuemax=${MAX_WIDTH} aria-valuenow=${width === null ? nothing : Math.round(width)}><div data-slot="data-table-resize-line" aria-hidden="true"></div></div>`;
}

function headCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number): TemplateResult {
    const key = String(c.accessorKey);
    const draggable = v.reorderable && isReorderable(c);
    return html`<div data-slot="table-head" role="columnheader" aria-colindex=${v.aria.colIndex(n)} aria-sort=${ariaSortOf(c, v.sortDirection(key)) ?? nothing}
        data-column-id=${key} data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? specialSlotOf(c) : nothing}
        data-border ?data-resizable=${v.resizable} ?data-draggable=${draggable} aria-description=${draggable ? v.locale.reorderColumnHint : nothing} style=${cellVarsStyle(c, n)}>
        <div data-slot="data-table-head-content"><div data-slot="data-table-head-main">${headContent(v, c)}</div>${v.actions.head(c)}</div>
        ${v.resizable && key !== '_selection' ? resizeHandle(v, c) : nothing}
    </div>`;
}

/** The cells of the header row, then the filler that stretches the row when no column is flexible. */
export function renderHeadCells<T>(v: GridView<T>): TemplateResult {
    // package B: window (only the windowed middle columns are drawn, at their absolute position)
    return html`${repeat(columnParts(v.columns, v.body.window), (p) => ('spacer' in p ? `s:${p.spacer}` : String(p.column.accessorKey)), (p) => ('spacer' in p ? columnSpacer(p.spacer) : headCell(v, p.column, p.n)))}${v.hasFlexible ? nothing : html`<div data-slot="table-head" role="presentation" data-border></div>`}`;
}
