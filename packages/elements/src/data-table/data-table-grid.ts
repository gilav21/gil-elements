/**
 * The grid markup: plain `div`s with Angular's `data-slot` names inside one ARIA tree. Code sets `data-*` and `aria-*`
 * hooks and custom properties, the stylesheet paints; no class strings are built here (consumer classes only come from
 * `cellClassRules`). Selection, expansion, tree and grouping state are drawn but not yet wired (wave 4).
 */
import { html, nothing, type TemplateResult } from 'lit';
import { chromeIcon, ensureIconElement } from './data-table-icons.js';
import { repeat } from 'lit/directives/repeat.js';
import { type GridAria } from './data-table-aria.js';
import { cellText, sortAriaLabel, styleText } from './data-table-cells.js';
import { resolveCellKind } from './data-table-cell-kind.js';
import { componentCell } from './data-table-component-cell.js';
import { cellVarsStyle } from './data-table-columns.js';
import type { CellAddress } from './data-table-host.js';
import type { FormattingService } from './data-table-providers.js';
import { ariaSortOf } from './data-table-query.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { ColumnDef, EnhancedColumnDef, SortDirection } from './data-table.types.js';
import { getCellValue, isSpecialColumnKey } from './data-table.utils.js';

export interface GridView<T> {
    locale: DataTableLocale;
    columns: readonly EnhancedColumnDef<T>[];
    hasFlexible: boolean;
    /** Data rows of the page in drawn order; `data-row-index` is the position in this list. */
    rows: readonly T[];
    aria: GridAria;
    /** `aria-multiselectable`, `aria-selected` and the select column are drawn. */
    selectable: boolean;
    resizable: boolean;
    selection: Readonly<Record<string, boolean>>;
    expanded: Readonly<Record<string, boolean>>;
    getRowId(row: T): string;
    isDisabled(row: T): boolean;
    formatting: FormattingService<T> | undefined;
    footer: { visible: boolean; values: ReadonlyMap<string, string>; rows: readonly T[] };
    sortDirection(key: string): SortDirection;
    sortIndex(key: string): number | null;
    onSortRequest(columnKey: string, event: CustomEvent<{ direction: SortDirection; multi: boolean }>): void;
    focusedCell: CellAddress | null;
    /** The empty state: a `renderEmpty` result, or the consumer's `empty` slot node. */
    empty: unknown;
}

const slotOf = (column: { accessorKey: PropertyKey }): string => String(column.accessorKey).replace(/^_/, '');

// ---- header ------------------------------------------------------------------------------------------------------

function headContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const key = String(c.accessorKey);
    const { locale } = v;
    if (key === '_selection') {
        const ids = v.rows.map(v.getRowId);
        const selected = ids.filter((id) => v.selection[id] === true).length;
        return html`<ge-checkbox aria-label=${locale.selectAllRows} .checked=${ids.length > 0 && selected === ids.length} .indeterminate=${selected > 0 && selected < ids.length}></ge-checkbox>`;
    }
    if (key === '_expander') {
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle aria-label=${locale.expandAllRows} aria-expanded="false">${chromeIcon('chevrons-down', 'xs')}</button>`;
    }
    if (key === '_actions') return html`<span data-slot="data-table-sr-only">${locale.actions}</span>`;
    if (c.headerRenderer) return c.headerRenderer({ column: c });
    if (c.enableSorting === false) return html`<div data-slot="data-table-head-controls"><span>${c.header}</span></div>`;
    const direction = v.sortDirection(key);
    const index = v.sortIndex(key);
    return html`<div data-slot="data-table-head-controls"><ge-data-table-column-header .title=${c.header} .column=${key} .direction=${direction} .sortIndex=${index} .label=${sortAriaLabel(c.header, direction, index, locale)} @sort-request=${(e: CustomEvent<{ direction: SortDirection; multi: boolean }>) => v.onSortRequest(key, e)}></ge-data-table-column-header></div>`;
}

function headCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number): TemplateResult {
    const key = String(c.accessorKey);
    return html`<div data-slot="table-head" role="columnheader" aria-colindex=${v.aria.colIndex(n) ?? nothing} aria-sort=${ariaSortOf(c, v.sortDirection(key)) ?? nothing}
        data-column-id=${key} data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? slotOf(c) : nothing}
        data-border ?data-resizable=${v.resizable} style=${cellVarsStyle(c, n)}>
        <div data-slot="data-table-head-content"><div data-slot="data-table-head-main">${headContent(v, c)}</div></div>
        ${v.resizable && key !== '_selection' ? html`<div data-slot="data-table-resize-handle" aria-hidden="true"><div data-slot="data-table-resize-line" aria-hidden="true"></div></div>` : nothing}
    </div>`;
}

// ---- body --------------------------------------------------------------------------------------------------------

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
    const key = String(c.accessorKey);
    if (key === '_selection') {
        return html`<ge-checkbox aria-label=${v.locale.selectRow} .checked=${v.selection[v.getRowId(row)] === true} ?disabled=${v.isDisabled(row)}></ge-checkbox>`;
    }
    if (key === '_expander') {
        const open = v.expanded[v.getRowId(row)] === true;
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle aria-label=${open ? v.locale.collapseRow : v.locale.expandRow} aria-expanded=${open ? 'true' : 'false'}>${chromeIcon(open ? 'chevron-up' : 'chevron-down', 'xs')}</button>`;
    }
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
        data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(key) ? slotOf(c) : nothing}
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

// ---- footer ------------------------------------------------------------------------------------------------------

function footerContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const text = v.footer.values.get(String(c.accessorKey)) ?? '';
    if (c.footerComponent) return componentCell(c.footerComponent, { column: c, rows: v.footer.rows, value: text });
    if (c.footerRenderer) return c.footerRenderer({ column: c, rows: v.footer.rows });
    return text;
}

function footer<T>(v: GridView<T>): unknown {
    if (!v.footer.visible) return nothing;
    return html`<div data-slot="table-footer" role="rowgroup"><div data-slot="table-row" role="row" aria-rowindex=${v.aria.footerRowIndex()}>
        ${v.columns.map((c, n) => html`<div data-slot="table-cell" role="gridcell" aria-colindex=${v.aria.colIndex(n) ?? nothing} data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(c.accessorKey) ? slotOf(c) : nothing} style=${cellVarsStyle(c, n)}>${footerContent(v, c)}</div>`)}${v.hasFlexible ? nothing : html`<div data-slot="table-cell" role="presentation" aria-hidden="true"></div>`}
    </div></div>`;
}

// ---- the grid ----------------------------------------------------------------------------------------------------

export function renderGrid<T>(v: GridView<T>, vars: string): TemplateResult {
    return html`<div data-slot="table" role=${v.aria.role} aria-rowcount=${v.aria.rowCount} aria-colcount=${v.aria.colCount} aria-multiselectable=${v.selectable ? 'true' : nothing} style=${vars}>
        <div data-slot="table-header" role="rowgroup"><div data-slot="table-row" role="row" aria-rowindex=${v.aria.headerRowIndex(0)}>
            ${v.columns.map((c, n) => headCell(v, c, n))}${v.hasFlexible ? nothing : html`<div data-slot="table-head" role="presentation" data-border></div>`}
        </div></div>
        <div data-slot="table-body" role="rowgroup">
            ${v.rows.length === 0 ? emptyRow(v) : repeat(v.rows, v.getRowId, (row, i) => dataRow(v, row, i))}${spacerRow(v)}
        </div>
        ${footer(v)}
    </div>`;
}

/** The first-paint placeholder, standing in for the whole shell (as in Angular). */
export function renderSkeleton(rows: number, label: string): TemplateResult {
    return html`<div data-slot="data-table-skeleton" role="status"><span data-slot="data-table-sr-only">${label}</span>
        <ge-skeleton data-kind="bar" aria-hidden="true"></ge-skeleton>${Array.from({ length: Math.max(0, rows) }, () => html`<ge-skeleton data-kind="row" aria-hidden="true"></ge-skeleton>`)}<ge-skeleton data-kind="bar" aria-hidden="true"></ge-skeleton>
    </div>`;
}
