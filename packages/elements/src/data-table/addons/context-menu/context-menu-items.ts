/**
 * The built column menu (Angular `buildColumnMenuItems`, context-menu.directive.ts 306-350): sort, pin, hide and show all. Pure: it reads
 * the services it is given and the items call them back, so it is tested without a table.
 */
import type { ContextMenuItem } from '../../../context-menu/context-menu.js';
import type { DataTableLocale } from '../../data-table.locales.js';
import type { ColumnsService, QueryService } from '../../data-table-providers.js';
import type { ColumnDef } from '../../data-table.types.js';

/** The table's locale keys the addon shows; `ContextMenuOptions.locale` overrides any of them. */
export type ContextMenuLabels = Pick<
    DataTableLocale,
    'sortAscending' | 'sortDescending' | 'clearSort' | 'pinLeft' | 'pinRight' | 'unpin' | 'hideColumn' | 'showAllColumns' | 'rowActions' | 'columnMenu'
>;

export interface ColumnMenuServices<T> {
    readonly query: Pick<QueryService<T>, 'sortDirection' | 'changeSort'>;
    readonly columns: Pick<ColumnsService<T>, 'pinOf' | 'setPin' | 'setVisible' | 'showAll' | 'navigableKeys'>;
}

const SEPARATOR: ContextMenuItem = { type: 'separator' };

/** Sort / pin / visibility items for a column's header menu. */
export function buildColumnMenuItems<T>(column: ColumnDef<T>, services: ColumnMenuServices<T>, labels: ContextMenuLabels): ContextMenuItem[] {
    const key = String(column.accessorKey);
    return [...sortItems(key, column, services, labels), ...pinItems(key, column, services, labels), ...visibilityItems(key, column, services, labels)];
}

function sortItems<T>(key: string, column: ColumnDef<T>, { query }: ColumnMenuServices<T>, t: ContextMenuLabels): ContextMenuItem[] {
    if (column.enableSorting === false) return [];
    const current = query.sortDirection(key);
    const items: ContextMenuItem[] = [
        { label: t.sortAscending, disabled: current === 'asc', click: () => query.changeSort(key, 'asc') },
        { label: t.sortDescending, disabled: current === 'desc', click: () => query.changeSort(key, 'desc') },
    ];
    if (current) items.push({ label: t.clearSort, click: () => query.changeSort(key, null) });
    return [...items, SEPARATOR];
}

function pinItems<T>(key: string, column: ColumnDef<T>, { columns }: ColumnMenuServices<T>, t: ContextMenuLabels): ContextMenuItem[] {
    // The resolved pin (a runtime pin, else the definition's), as Angular's `getColumnPin(key) ?? col.pin`.
    const pin = columns.pinOf(key) ?? column.pin;
    const items: ContextMenuItem[] = [];
    if (pin !== 'left') items.push({ label: t.pinLeft, click: () => columns.setPin(key, 'left') });
    if (pin !== 'right') items.push({ label: t.pinRight, click: () => columns.setPin(key, 'right') });
    if (pin) items.push({ label: t.unpin, click: () => columns.setPin(key, undefined) });
    return [...items, SEPARATOR];
}

function visibilityItems<T>(key: string, column: ColumnDef<T>, { columns }: ColumnMenuServices<T>, t: ContextMenuLabels): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];
    // The table refuses to hide its last visible data column (wave 4 D12), so the item is not offered there.
    const visible = columns.navigableKeys();
    const last = visible.length <= 1 && visible.includes(key);
    if (column.enableHiding !== false && !last) items.push({ label: t.hideColumn, click: () => columns.setVisible(key, false) });
    items.push({ label: t.showAllColumns, click: () => columns.showAll() });
    return items;
}
