/**
 * The buttons addons contribute (wave 7): one per `CellActionSlot` in each enabled data row's `_actions` cell, one per
 * `HeaderActionSlot` in each data column's header. The core only draws them and calls the slot's `onClick`; what they open is the addon's.
 */
import { html, nothing } from 'lit';
import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { chromeIcon } from './data-table-icons.js';
import { interpolate } from './data-table.locales.js';
import type { ColumnDef } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

export interface ActionsView<T> {
    /** The row's buttons; undefined while no addon registered one, so a consumer's own `_actions` column draws its content as before. `roving`: see `tabStop`. */
    cell(row: T, rowIndex: number, disabled: boolean, roving: boolean): unknown;
    /** The consumer defined its own `_actions` column: its content is drawn, then the buttons. */
    readonly consumerColumn: boolean;
    /** The header's buttons; nothing for the table's own columns. */
    head(column: ColumnDef<T>): unknown;
}

export function actionsView<T>(host: DataTableCoreHost<T>): ActionsView<T> {
    const addons = host.provider('addons');
    const cells = addons?.cellActions.slots ?? [];
    const heads = addons?.headerActions.slots ?? [];
    if (cells.length === 0 && heads.length === 0) return { cell: () => undefined, head: () => nothing, consumerColumn: false };
    const locale = host.resolvedLocale;
    return {
        consumerColumn: host.config.columns.some((c) => c.accessorKey === '_actions'),
        // Row buttons follow the rule of every in-cell control: out of the tab order while a roving cell exists (one tab stop per grid; the keyboard
        // reaches a row's actions through the context-menu key), in it otherwise.
        cell: (row, rowIndex, disabled, roving) => {
            if (cells.length === 0) return undefined;
            if (disabled) return nothing;
            const context = () => requireProvider(host, 'query').rowContext(row, rowIndex);
            return cells.map(
                (slot) =>
                    html`<button type="button" data-slot="data-table-icon-button" data-size="lg" data-action-id=${slot.id} aria-label=${slot.ariaLabel ?? locale.rowActions} aria-haspopup=${slot.haspopup ?? nothing}
                        aria-expanded=${slot.expanded ? String(slot.expanded(context())) : nothing} tabindex=${roving ? '-1' : nothing} @click=${(event: Event) => slot.onClick(event, context())}>${slot.icon ?? chromeIcon('more-vertical')}</button>`,
            );
        },
        head: (column) =>
            isSpecialColumnKey(column.accessorKey)
                ? nothing
                : heads.map(
                      (slot) =>
                          html`<button type="button" data-slot="data-table-header-action" data-action-id=${slot.id} aria-label=${interpolate(slot.ariaLabel ?? locale.columnMenu, { column: column.header })} aria-haspopup=${slot.haspopup ?? nothing}
                              aria-expanded=${slot.expanded ? String(slot.expanded(column)) : nothing} @click=${(event: Event) => slot.onClick(event, column)}>${slot.icon ?? chromeIcon('more-vertical', 'xs')}</button>`,
                  ),
    };
}
