/**
 * The grid shell: plain `div`s with Angular's `data-slot` names inside one ARIA tree. Code sets `data-*` and `aria-*`
 * hooks and custom properties, the stylesheet paints; no class strings are built here (consumer classes only come from
 * `cellClassRules`). The shell is the lead's; the head, the rows and the window are drawn by files of their own
 * (`data-table-grid-head.ts`, `-rows.ts`, `-special.ts`) and described by their own view interfaces, which `GridView` joins.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { type GridAria } from './data-table-aria.js';
import { componentCell } from './data-table-component-cell.js';
import { cellVarsStyle } from './data-table-columns.js';
import type { EditView } from './data-table-grid-edit.js';
import type { FiltersView } from './data-table-grid-filters.js';
import { columnParts, columnSpacer } from './data-table-grid-window.js';
import { renderHeadCells, type ColumnsView } from './data-table-grid-head.js';
import type { StateView } from './data-table-grid-state.js';
import { renderRows, type RowsView } from './data-table-grid-rows.js';
import type { WindowView } from './data-table-grid-window.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { BodyWindow, DataTableDisplayRow, EnhancedColumnDef, FlattenedTreeRow } from './data-table.types.js';
import { isSpecialColumnKey, specialSlotOf } from './data-table.utils.js';

/** The body list the rows are drawn from, and which part of it. */
export interface BodyView<T> {
    mode: 'flat' | 'tree' | 'group';
    items: readonly DataTableDisplayRow<T>[] | readonly FlattenedTreeRow<T>[];
    window: BodyWindow;
}

export interface GridView<T> extends ColumnsView<T>, Omit<RowsView<T>, 'source' | 'totalRows'>, Omit<WindowView, 'window'>, StateView<T> {
    locale: DataTableLocale;
    aria: GridAria;
    body: BodyView<T>;
    /** Wave 5 (filters, package A): the header trigger and the floating filter row. */
    filters: FiltersView<T>;
    /** Wave 5 (editing, package B): the cell editor. */
    edit: EditView<T>;
    footer: { visible: boolean; values: ReadonlyMap<string, string>; rows: readonly T[] };
}

// ---- footer ------------------------------------------------------------------------------------------------------

function footerContent<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const text = v.footer.values.get(String(c.accessorKey)) ?? '';
    if (c.footerComponent) return componentCell(c.footerComponent, { column: c, rows: v.footer.rows, value: text });
    if (c.footerRenderer) return c.footerRenderer({ column: c, rows: v.footer.rows });
    return text;
}

function footerCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, n: number): TemplateResult {
    return html`<div data-slot="table-cell" role="gridcell" aria-colindex=${v.aria.colIndex(n)} data-width=${c._width === 'auto' ? 'auto' : 'fixed'} data-pinned=${c._pin ?? nothing} data-special=${isSpecialColumnKey(c.accessorKey) ? specialSlotOf(c) : nothing} style=${cellVarsStyle(c, n)}>${footerContent(v, c)}</div>`;
}

// package B: window (footer cells follow the windowed columns)
function footer<T>(v: GridView<T>): unknown {
    if (!v.footer.visible) return nothing;
    return html`<div data-slot="table-footer" role="rowgroup"><div data-slot="table-row" role="row" aria-rowindex=${v.aria.footerRowIndex()}>
        ${columnParts(v.columns, v.body.window).map((p) => ('spacer' in p ? columnSpacer(p.spacer) : footerCell(v, p.column, p.n)))}${v.hasFlexible ? nothing : html`<div data-slot="table-cell" role="presentation" aria-hidden="true"></div>`}
    </div></div>`;
}

// ---- the grid ----------------------------------------------------------------------------------------------------

/** One custom property, only when it is not zero, so an unwindowed grid carries no extra style. */
const padding = (name: string, px: number): string => (px > 0 ? `${name}:${px}px;` : '');

export function renderGrid<T>(v: GridView<T>): TemplateResult {
    const { window } = v.body;
    const tableStyle = `${v.vars}${padding('--ge-dt-pad-start', window.colPadStart)}${padding('--ge-dt-pad-end', window.colPadEnd)}`;
    const bodyStyle = `${padding('--ge-dt-pad-top', window.padStart)}${padding('--ge-dt-pad-bottom', window.padEnd)}`;
    return html`<div data-slot="table" role=${v.aria.role} aria-rowcount=${v.aria.rowCount} aria-colcount=${v.aria.colCount} aria-multiselectable=${v.selectable || v.rangeSelectable ? 'true' : nothing} style=${tableStyle}>
        <div data-slot="table-header" role="rowgroup"><div data-slot="table-row" role="row" aria-rowindex=${v.aria.headerRowIndex(0)}>
            ${renderHeadCells(v)}
        </div>${v.filters.row()}</div>
        <div data-slot="table-body" role="rowgroup" style=${bodyStyle || nothing}>
            ${renderRows(v)}
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
