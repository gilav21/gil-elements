/**
 * `@gilav21/elements/data-table/addons/context-menu`: the addon without side effects. Enable it with `table.use(contextMenuAddon, options)`;
 * the menus it builds are `ge-context-menu` elements, so define that element too (`@gilav21/elements/context-menu/define`), or import this
 * entry's `define` module instead, which does both and makes the id usable in `addons="context-menu"`.
 */
export {
    contextMenuAddon,
    type ContextMenuItem,
    type ContextMenuLabels,
    type ContextMenuOptions,
    type DataTableHeaderContextMenuEvent,
    type DataTableRowContextMenuEvent,
    type RowActionsFn,
} from './context-menu.js';
export { buildColumnMenuItems, type ColumnMenuServices } from './context-menu-items.js';
