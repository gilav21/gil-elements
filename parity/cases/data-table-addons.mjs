// Wave 7 addons of shadcn-angular's data-table, against its own markup. The file is package A's (context menu); packages D (AI) and E
// (range chart) append their cases in their marked regions below.
import { cellStyle, elTable, refTable, ROWS, rewrite } from './data-table.mjs';
import { ref as button } from '../lib/button-ref.mjs';

const W = 'width:100%;';
const items = [];

// ---- A: context menu ---------------------------------------------------------------------------------------------------------
// The `_actions` column (data-table.component.html 168-181: a ghost icon `ui-button` per cell-action slot, 50px column, html 2437) with
// the addon's row ⋮ button, and the header ⋮ buttons (html 714-726: transparent until the header is hovered, so a static render shows
// none on either side). Then the built column menu (context-menu.directive.ts 306-350), which Angular renders through the menu's own
// `items` template (context-menu.component.ts 52-83: label only, no icon, so the directive's `icon` fields never show).

const ACTIONS = { accessorKey: '_actions', header: '', width: '50px' };
const COLS = [{ accessorKey: 'name', header: 'Name', width: '160px' }, { accessorKey: 'role', header: 'Role', width: '140px' }];
const KEBAB = '<ui-icon name="more-vertical" size="sm"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-more-vertical" data-slot="icon"><path d="M12 5h.01" /><path d="M12 12h.01" /><path d="M12 19h.01" /></svg></ui-icon>';
const rowKebab = button('ghost', 'icon', KEBAB, { extra: 'h-8 w-8 pointer-coarse:size-11' });

function actionsRef(rows) {
    // refTable draws every column with a sort header and the value; the `_actions` column has an sr-only label and the button instead.
    let html = refTableWith([...COLS, ACTIONS], rows);
    html = rewrite(html, /(data-column-id="_actions"[^>]*>)[\s\S]*?(<\/ui-table-head>)/, '$1<div class="flex items-center w-full h-full"><div class="flex-1 min-w-0"><span class="sr-only">Actions</span></div></div>$2', 'actions head');
    return rewrite(html, /(data-column="_actions"[^>]*>)[^<]*(<\/ui-table-cell>)/g, `$1${rowKebab}$2`, 'actions cells', rows.length);
}
const refTableWith = (columns, rows) => refTable({ columns, rows, style: (c) => cellStyle(c.width) });

const ACTION_ROWS = ROWS.slice(0, 3).map(({ id, name, role }) => ({ id, name, role }));
const actionsEl = () =>
    elTable({ columns: COLS, rows: ACTION_ROWS, attrs: `show-footer="false" addons="context-menu" data-row-actions='["Edit","Delete"]'`, props: { addonOptions: { 'context-menu': { columnMenu: true } } } });

// All columns fixed: the right border blends one colour level differently at the clipped rounded corner (transparent cells over the page
// versus Angular's opaque ones), 8 pixels in dark; the same allowance as data-table.mjs `all-fixed-widths`.
items.push({ id: 'actions-column', threshold: 0.08, wrap: W, ref: actionsRef(ACTION_ROWS), el: actionsEl() });

// The built column menu, opened at a fixed point. The element side is a `ge-context-menu` with the items the addon builds for that
// column state (pinned by context-menu.node.test.ts, "buildColumnMenuItems"): this case is the menu's look, the browser test its wiring.
const PANEL = 'min-w-[8rem] outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[calc(100vw-16px)] max-h-[calc(100vh-16px)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95';
const ITEM = 'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus:bg-accent focus:text-accent-foreground';
const rItem = ({ label, disabled = false }, focused) =>
    `<ui-context-menu-item class="${ITEM}${disabled ? ' pointer-events-none opacity-50' : ''}${focused ? ' bg-accent text-accent-foreground' : ''}" data-slot="context-menu-item" role="menuitem" tabindex="-1"${disabled ? ' data-disabled="true" aria-disabled="true"' : ''}>${label}</ui-context-menu-item>`;
const rSep = '<ui-context-menu-separator class="block -mx-1 my-1 h-px bg-border" data-slot="context-menu-separator"></ui-context-menu-separator>';
const AREA = 'width:360px;height:320px;position:relative;border:1px dashed var(--border)';

function menuRef(menu, x, y) {
    const firstEnabled = menu.findIndex((i) => i.type !== 'separator' && !i.disabled);
    const body = menu.map((item, i) => (item.type === 'separator' ? rSep : rItem(item, i === firstEnabled))).join('');
    return `<div style="${AREA}"><ui-context-menu class="contents" data-slot="context-menu"><ui-context-menu-content class="contents"><div class="absolute ${PANEL}" style="left:${x}px;top:${y}px" role="menu" tabindex="-1" data-state="open" data-slot="context-menu-content">${body}</div></ui-context-menu-content></ui-context-menu></div>`;
}
const esc = (value) => JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
const menuEl = (menu) => `<div style="${AREA}"><ge-context-menu data-props='${esc({ items: menu })}'></ge-context-menu></div>`;

const SEP = { type: 'separator' };
const COLUMN_MENUS = {
    // unsorted, unpinned
    'column-menu': [{ label: 'Sort Ascending' }, { label: 'Sort Descending' }, SEP, { label: 'Pin Left' }, { label: 'Pin Right' }, SEP, { label: 'Hide Column' }, { label: 'Show All Columns' }],
    // sorted ascending and pinned left: the current direction disabled, Clear Sort and Unpin offered
    'column-menu-sorted-pinned': [{ label: 'Sort Ascending', disabled: true }, { label: 'Sort Descending' }, { label: 'Clear Sort' }, SEP, { label: 'Pin Right' }, { label: 'Unpin' }, SEP, { label: 'Hide Column' }, { label: 'Show All Columns' }],
};
for (const [id, menu] of Object.entries(COLUMN_MENUS)) items.push({ id, ref: menuRef(menu, 40, 24), el: menuEl(menu), show: '40,24' });

// ---- D: AI (package D appends its cases here) --------------------------------------------------------------------------------

// ---- E: range chart (package E appends its cases here) -----------------------------------------------------------------------

export default { name: 'data-table-addons', isolated: true, width: 700, items };
