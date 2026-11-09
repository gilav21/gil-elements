/**
 * The content of the special columns (`_selection`, `_expander`, `_actions`) and of the tree-host column, in the header
 * and in the rows. Package A (rows) owns this file. `specialHead` / `specialCell` answer `undefined` for a column that is
 * not special, so the caller falls through to the ordinary content. Buttons carry `data-action`; the controllers listen
 * once on the element and find them by it.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { sortAriaLabel } from './data-table-cells.js';
import type { GridView } from './data-table-grid.js';
import { chromeIcon } from './data-table-icons.js';
import type { SortDirection, EnhancedColumnDef, FlattenedTreeRow } from './data-table.types.js';

/** The id of a row's detail row; a row id may hold spaces, which an id attribute and `aria-controls` cannot. */
export const detailId = (uid: string, rowId: string): string => `ge-dt-${uid}-detail-${encodeURIComponent(rowId)}`;

/** In-cell controls leave the tab order when a roving cell exists: the grid has one tab stop, the keyboard reaches them through the cell. */
const tabStop = (roving: boolean): string | typeof nothing => (roving ? '-1' : nothing);

function sortControl<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const key = String(c.accessorKey);
    if (c.headerRenderer) return c.headerRenderer({ column: c });
    if (c.enableSorting === false) return html`<span>${c.header}</span>`;
    const direction = v.sortDirection(key);
    const index = v.sortIndex(key);
    return html`<ge-data-table-column-header .title=${c.header} .column=${key} .direction=${direction} .sortIndex=${index} .label=${sortAriaLabel(c.header, direction, index, v.locale)} @sort-request=${(e: CustomEvent<{ direction: SortDirection; multi: boolean }>) => v.onSortRequest(key, e)}></ge-data-table-column-header>`;
}

export function specialHead<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const key = String(c.accessorKey);
    const { locale } = v;
    if (key === '_selection') {
        const { checked, indeterminate } = v.selectionHeader;
        return html`<ge-checkbox aria-label=${locale.selectAllRows} .checked=${checked} .indeterminate=${indeterminate} tabindex=${tabStop(v.roving)}></ge-checkbox>`;
    }
    if (key === '_expander') {
        const all = v.allExpanded;
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle data-action="detail-all" aria-label=${all ? locale.collapseAllRows : locale.expandAllRows} aria-expanded=${all ? 'true' : 'false'} tabindex=${tabStop(v.roving)}>${chromeIcon('chevrons-down', 'xs')}</button>`;
    }
    if (key === '_actions') return html`<span data-slot="data-table-sr-only">${locale.actions}</span>`;
    if (key === v.treeHost) {
        const all = v.allSubRowsExpanded;
        return html`<div data-slot="data-table-head-controls"><button type="button" data-slot="data-table-icon-button" data-toggle data-action="tree-all" aria-label=${all ? locale.collapseAllSubRows : locale.expandAllSubRows} aria-expanded=${all ? 'true' : 'false'} tabindex=${tabStop(v.roving)}>${chromeIcon('chevrons-down', 'xs')}</button>${sortControl(v, c)}</div>`;
    }
    return undefined;
}

export function specialCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, row: T): unknown {
    const key = String(c.accessorKey);
    if (key === '_selection') {
        const id = v.getRowId(row);
        return html`<ge-checkbox aria-label=${v.locale.selectRow} .checked=${v.selection[id] === true} .indeterminate=${v.isIndeterminate(id)} ?disabled=${v.isDisabled(row)} tabindex=${tabStop(v.roving)}></ge-checkbox>`;
    }
    if (key === '_expander') {
        const id = v.getRowId(row);
        const open = v.expanded[id] === true;
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle data-action="detail" aria-label=${open ? v.locale.collapseRow : v.locale.expandRow} aria-expanded=${open ? 'true' : 'false'} aria-controls=${open ? detailId(v.uid, id) : nothing} tabindex=${tabStop(v.roving)}>${chromeIcon(open ? 'chevron-up' : 'chevron-down', 'xs')}</button>`;
    }
    return undefined;
}

/** The tree-host cell: indentation (from the row's `--ge-dt-depth`), the toggle or a leaf spacer, then the ordinary content. */
export function treeHostCell<T>(v: GridView<T>, node: FlattenedTreeRow<T>, content: unknown): TemplateResult {
    const toggle = node.isLeaf
        ? html`<span data-slot="data-table-tree-leaf"></span>`
        : html`<button type="button" data-slot="data-table-icon-button" data-toggle data-action="tree" aria-label=${node.isExpanded ? v.locale.collapseSubRows : v.locale.expandSubRows} aria-expanded=${node.isExpanded ? 'true' : 'false'} tabindex=${tabStop(v.roving)}>${chromeIcon('chevron-right', 'xs')}</button>`;
    return html`<div data-slot="data-table-tree-cell">${toggle}<span data-slot="data-table-text">${content}</span></div>`;
}
