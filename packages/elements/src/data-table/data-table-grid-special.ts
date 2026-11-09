/**
 * The content of the special columns (`_selection`, `_expander`, `_actions`), in the header and in the rows. Package A
 * (rows) owns this file; the tree-host cell and header content join it. Both functions answer `undefined` for a column
 * that is not special, so the caller falls through to the ordinary content.
 */
import { html } from 'lit';
import type { GridView } from './data-table-grid.js';
import { dataRowOf } from './data-table-cells.js';
import { chromeIcon } from './data-table-icons.js';
import type { EnhancedColumnDef } from './data-table.types.js';

/** The data rows of the page, in drawn order. */
function pageRows<T>(v: GridView<T>): T[] {
    return v.body.items.flatMap((item) => {
        const row = dataRowOf(item);
        return row === undefined ? [] : [row];
    });
}

export function specialHead<T>(v: GridView<T>, c: EnhancedColumnDef<T>): unknown {
    const key = String(c.accessorKey);
    const { locale } = v;
    if (key === '_selection') {
        const ids = pageRows(v).map(v.getRowId);
        const selected = ids.filter((id) => v.selection[id] === true).length;
        return html`<ge-checkbox aria-label=${locale.selectAllRows} .checked=${ids.length > 0 && selected === ids.length} .indeterminate=${selected > 0 && selected < ids.length}></ge-checkbox>`;
    }
    if (key === '_expander') {
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle aria-label=${locale.expandAllRows} aria-expanded="false">${chromeIcon('chevrons-down', 'xs')}</button>`;
    }
    if (key === '_actions') return html`<span data-slot="data-table-sr-only">${locale.actions}</span>`;
    return undefined;
}

export function specialCell<T>(v: GridView<T>, c: EnhancedColumnDef<T>, row: T): unknown {
    const key = String(c.accessorKey);
    if (key === '_selection') {
        return html`<ge-checkbox aria-label=${v.locale.selectRow} .checked=${v.selection[v.getRowId(row)] === true} ?disabled=${v.isDisabled(row)}></ge-checkbox>`;
    }
    if (key === '_expander') {
        const open = v.expanded[v.getRowId(row)] === true;
        return html`<button type="button" data-slot="data-table-icon-button" data-size="md" data-toggle aria-label=${open ? v.locale.collapseRow : v.locale.expandRow} aria-expanded=${open ? 'true' : 'false'}>${chromeIcon(open ? 'chevron-up' : 'chevron-down', 'xs')}</button>`;
    }
    return undefined;
}
