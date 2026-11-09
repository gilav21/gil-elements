/**
 * The rows of the body and the view of the row list they read. Package A (rows) owns this file; the tree, group and
 * detail rows join it. A row is drawn from `body.items.slice(window.start, window.end)` and always carries its ABSOLUTE
 * index, so `data-row-index` and `aria-rowindex` stay right when the list is windowed.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { cellText, dataRowOf, styleText } from './data-table-cells.js';
import { resolveCellKind } from './data-table-cell-kind.js';
import { componentCell } from './data-table-component-cell.js';
import { cellVarsStyle } from './data-table-columns.js';
import type { BodyView, GridView } from './data-table-grid.js';
import { specialCell } from './data-table-grid-special.js';
import { requireProvider } from './data-table-host.js';
import { chromeIcon, ensureIconElement } from './data-table-icons.js';
import type { FormattingService } from './data-table-providers.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { ColumnDef, EnhancedColumnDef } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey, specialSlotOf } from './data-table.utils.js';

export interface RowsView<T> {
    /** The body list before windowing: the rows of the page as drawn (the whole sorted or visible list under virtual scroll). */
    source: Pick<BodyView<T>, 'mode' | 'items'>;
    /** Real rows of that list for `aria-rowcount`: group headers and detail rows count, a window does not shrink it. */
    totalRows: number;
    /** `aria-multiselectable`, `aria-selected` and the select column are drawn. */
    selectable: boolean;
    selection: Readonly<Record<string, boolean>>;
    expanded: Readonly<Record<string, boolean>>;
    getRowId(row: T): string;
    isDisabled(row: T): boolean;
    formatting: FormattingService<T> | undefined;
    /** The empty state: a `renderEmpty` result, or the consumer's `empty` slot node. */
    empty: unknown;
}

export function rowsView<T>(host: DataTableViewHost<T>): RowsView<T> {
    // Wave 4 (package B): once a virtual window is active, `items` must be the sorted list of `QueryService.rowWindowSource()`
    // (wrapped as display rows), not the paged slice, so that the window indices and the items are the same list.
    const items = requireProvider(host, 'query').displayRows();
    return {
        source: { mode: 'flat', items },
        totalRows: items.length,
        selectable: host.config.enableRowSelection,
        selection: host.model.get('rowSelection'),
        expanded: host.model.get('expandedRows'),
        getRowId: (row) => host.config.getRowId(row),
        isDisabled: (row) => host.isDisabled(row),
        formatting: host.provider('formatting'),
        empty: items.length === 0 ? (host.renderEmpty?.() ?? host.slottedNodes('empty')) : undefined,
    };
}

function formattedText<T>(v: GridView<T>, c: ColumnDef<T>, row: T): unknown {
    const fmt = v.formatting?.cell(c, row);
    const text = cellText(c, row);
    if (!fmt) return text;
    const icon = fmt.icon;
    return html`<span data-slot="cell-formatted" class=${fmt.class} style=${styleText(fmt.style)}>${fmt.dataBar
        ? html`${fmt.dataBar.track ? html`<span data-slot="cell-data-bar-track" style=${`background-color:${fmt.dataBar.track}`}></span>` : nothing}<span data-slot="cell-data-bar" style=${`width:${fmt.dataBar.width};background-color:${fmt.dataBar.color}`}></span>`
        : nothing}${icon?.name
        ? (ensureIconElement(), html`<ge-icon data-slot="cell-icon" name=${icon.name} size="xs" class=${icon.class ?? ''}></ge-icon>`)
        : icon?.glyph
          ? html`<span data-slot="cell-icon" class=${icon.class ?? ''}>${icon.glyph}</span>`
          : nothing}<span data-slot="cell-text">${text}</span></span>`;
}

function cellContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>, row: T, rowIndex: number): unknown {
    const special = specialCell(v, c, row);
    if (special !== undefined) return special;
    switch (resolveCellKind(c)) {
        case 'tag':
            return componentCell(c.component as string, c.componentInputs?.(row), c.componentOutputs?.(row));
        case 'renderer':
            return c.cellRenderer?.({ row, value: getCellValue(row, c.accessorKey, c), column: c, rowIndex });
        default:
            return formattedText(v, c, row);
    }
}

function bodyCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number, row: T, rowIndex: number): TemplateResult {
    const key = String(c.accessorKey);
    const focused = v.focusedCell?.rowIndex === rowIndex && v.focusedCell.columnKey === key;
    return html`<div data-slot="table-cell" role="gridcell" aria-colindex=${v.aria.colIndex(n) ?? nothing} data-column=${key} data-row-index=${rowIndex}
        data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? specialSlotOf(c) : nothing}
        data-border tabindex=${focused ? '0' : nothing} ?data-focused=${focused} style=${cellVarsStyle(c, n)}>${cellContent(v, c, row, rowIndex)}</div>`;
}

const filler = html`<div data-slot="table-cell" role="presentation" aria-hidden="true" data-border></div>`;

function dataRow<T>(v: GridView<T>, row: T, i: number): TemplateResult {
    const id = v.getRowId(row);
    const selected = v.selection[id] === true;
    const disabled = v.isDisabled(row);
    return html`<div data-slot="table-row" role="row" aria-rowindex=${v.aria.dataRowIndex(i)} aria-selected=${v.selectable ? String(selected) : nothing}
        data-kind="data" data-row-index=${i} data-row-id=${id} data-state=${selected ? 'selected' : nothing} ?data-disabled=${disabled} aria-disabled=${disabled ? 'true' : nothing}>
        ${v.columns.map((c, n) => bodyCell(v, c, n, row, i))}${v.hasFlexible ? nothing : filler}
    </div>`;
}

function emptyRow<T>(v: GridView<T>): TemplateResult {
    return html`<div data-slot="table-row" role="row" data-kind="empty" aria-rowindex=${v.aria.dataRowIndex(0)}>
        <div data-slot="table-cell" role="gridcell" data-kind="empty" aria-colspan=${v.aria.colCount} data-width="full">${v.empty ?? html`<div data-slot="data-table-empty-content">${chromeIcon('circle-off', 'xl')}<p>${v.locale.noResultsLabel}</p></div>`}</div>
    </div>`;
}

/** The decorative last row of the body (Angular's stretching row): `aria-hidden`, never counted. */
function spacerRow<T>(v: GridView<T>): TemplateResult {
    return html`<div data-slot="table-row" data-kind="spacer" aria-hidden="true">${v.columns.map((c, n) => html`<div data-slot="table-cell" data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} style=${cellVarsStyle(c, n)}></div>`)}</div>`;
}

/** The data rows of the window, each with its absolute index. */
function windowRows<T>(v: GridView<T>): { row: T; index: number }[] {
    const { items, window } = v.body;
    return items.slice(window.start, window.end).flatMap((item, offset) => {
        const row = dataRowOf(item);
        return row === undefined ? [] : [{ row, index: window.start + offset }];
    });
}

/** Everything inside `[data-slot=table-body]`: the rows of the window (or the empty state), then the stretching row. */
export function renderRows<T>(v: GridView<T>): TemplateResult {
    return html`${v.body.items.length === 0 ? emptyRow(v) : repeat(windowRows(v), (r) => v.getRowId(r.row), (r) => dataRow(v, r.row, r.index))}${spacerRow(v)}`;
}
