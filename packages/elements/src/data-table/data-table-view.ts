/**
 * Builds the `GridView` the renderer draws, from three package-owned views: `rowsView` (rows: A), `windowView`
 * (window and focus: B) and `columnsView` (columns: C). This file is the lead's; a package changes its own view
 * function and the interface next to it, and the shape of `GridView` follows.
 */
import { computeGridAria } from './data-table-aria.js';
import type { GridView } from './data-table-grid.js';
import { actionsView } from './data-table-grid-actions.js';
import { editView } from './data-table-grid-edit.js';
import { filtersView } from './data-table-grid-filters.js';
import { columnsView } from './data-table-grid-head.js';
import { rowsView } from './data-table-grid-rows.js';
import { stateView } from './data-table-grid-state.js';
import { windowView } from './data-table-grid-window.js';
import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import type { DataTableDisplayRow, FlattenedTreeRow } from './data-table.types.js';

/** The data row of a body item (a display row or a flattened tree row), or undefined for a group header. */
export const dataRowOf = <T>(item: DataTableDisplayRow<T> | FlattenedTreeRow<T>): T | undefined => ('kind' in item ? (item.kind === 'data' ? item.row : undefined) : item.row);

/** What the view functions read of the element beyond the core host. */
export interface DataTableViewHost<T> extends DataTableCoreHost<T> {
    /** Draws the empty state; a string, a Node or a lit template. */
    readonly renderEmpty: (() => unknown) | undefined;
    /** Draws the content of a row's detail row (`enable-row-expansion`). */
    readonly renderDetail: ((row: T) => unknown) | undefined;
    /** Draws a row that spans every column instead of its cells. */
    readonly renderFullWidth: ((row: T) => unknown) | undefined;
    /** `isRowDisabled` or `disabledRowIds` says so. */
    isDisabled(row: T): boolean;
    /** The consumer's children of a named slot, as the table holds them. */
    slottedNodes(name: string): readonly Node[] | undefined;
}

export function buildView<T>(host: DataTableViewHost<T>, rangeActive?: boolean): GridView<T> {
    const footer = host.provider('footer');
    const columns = columnsView(host);
    const win = windowView(host);
    const { source, totalRows, ...rows } = rowsView(host);
    const filters = filtersView(host);
    const showFooter = footer?.visible() ?? false;
    return {
        ...columns,
        ...rows,
        ...stateView(host, rangeActive),
        filters,
        edit: editView(host),
        actions: actionsView(host),
        focusedCell: win.focusedCell,
        viewportTabbable: win.viewportTabbable,
        locale: host.resolvedLocale,
        body: { ...source, window: win.window },
        // A rendered empty state is one real row (with a spanning cell), so it counts and the footer follows it.
        aria: computeGridAria({
            tree: source.mode !== 'flat', // a treegrid only while group headers or tree nodes are drawn (grouping is off under virtual scroll)
            headerRows: 1 + filters.rows, // the floating filter row is a second header row (wave 5)
            totalDataRows: totalRows || 1,
            columnCount: columns.columns.length,
            footerRows: showFooter ? 1 : 0,
        }),
        // The footer rows are the sorted rows; without a footer nobody reads them, so the flat pipeline is not asked.
        footer: { visible: showFooter, values: footer?.values() ?? new Map(), rows: showFooter ? requireProvider(host, 'query').sortedData() : [] },
    };
}
