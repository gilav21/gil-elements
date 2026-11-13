/**
 * The context-menu addon (Angular `uiDtContextMenu`, addons/context-menu/context-menu.directive.ts). Two modes, chosen by the options:
 *
 * - **Simple:** `rowActions` (and `columnMenu`): the addon adds the ⋮ buttons and builds the menus itself (`row-menu-open`, `column-menu-open`).
 * - **Custom:** `menu`: a right click, the context-menu key (or Shift+F10) or a long press on a row opens YOUR `ge-context-menu` with the row
 *   (or, with `rowsOnly: false`, the header) as its data (`row-context-menu`, `header-context-menu`).
 *
 * With both, the gestures open your menu and the ⋮ buttons the built one; with neither, no gesture is taken. `disabled` hands every gesture
 * back to the browser (the ⋮ buttons are unaffected).
 */
import type { ContextMenuHost, ContextMenuItem } from '../../../context-menu/context-menu.js';
import { onContextGesture, type ContextGesture } from '../../../shared/touch.js';
import { inheritThemeTokens } from '../../../shared/theme-presets.js';
import { defineAddon } from '../../data-table-addon-kit.js';
import type { ColumnDef, RowActionContext } from '../../data-table.types.js';
import { buildColumnMenuItems, type ContextMenuLabels } from './context-menu-items.js';
import {
    anchorLeft,
    buttonAnchor,
    CELL_SELECTOR,
    cellAddress,
    HEADER_SELECTOR,
    indexOf,
    isMenuKey,
    KEYBOARD_ORIGIN_MS,
    keyboardAnchor,
    ownClosest,
    rangeTakesHold,
    ROW_SELECTOR,
    TABLE_OWNED_COLUMNS,
    type MenuAnchor,
} from './context-menu-gesture.js';

export type { ContextMenuItem } from '../../../context-menu/context-menu.js';
export type { ContextMenuLabels } from './context-menu-items.js';

/** Builds the items of a row's menu. Returning no item leaves the gesture to the browser (and the ⋮ button does nothing). */
export type RowActionsFn<T> = (context: RowActionContext<T>) => ContextMenuItem[];

export interface ContextMenuOptions<T = unknown> {
    /** Simple mode: the row menu's items; adds a ⋮ button to every row. */
    rowActions?: RowActionsFn<T>;
    /** Adds a ⋮ button to every data column's header that opens the column menu (sort, pin, hide, show all). */
    columnMenu?: boolean;
    /** Custom mode: your `ge-context-menu`, or a selector resolved against the table's root node each time a gesture opens it. */
    menu?: ContextMenuHost | string | null;
    /** Hands every context gesture on the table back to the browser; the ⋮ buttons are unaffected. */
    disabled?: boolean;
    /** Custom mode: leave the headers alone (default). `false` opens `menu` on a column header too. */
    rowsOnly?: boolean;
    /** Overrides of the table's labels the addon shows. */
    locale?: Partial<ContextMenuLabels>;
}

/** `row-context-menu`: the row a gesture opened the bound menu on (custom mode). */
export interface DataTableRowContextMenuEvent<T = unknown> {
    row: T;
    /** Its drawn index (after filtering, sorting and paging): the row's `data-row-index`. */
    index: number;
    /** The `contextmenu` of a right click or of the keyboard, or the `touchstart` that began a long press. */
    event: MouseEvent | TouchEvent;
    depth?: number;
    isLeaf?: boolean;
    parentRow?: T | null;
}

/** `header-context-menu`: the header a gesture opened the bound menu on (custom mode, `rowsOnly: false`). */
export interface DataTableHeaderContextMenuEvent {
    /** The header's `data-column-id` (null when absent), its trimmed text, and the element. */
    column: { id: string | null; name: string; element: HTMLElement };
    event: MouseEvent | TouchEvent;
}

declare module '../../data-table-events.js' {
    interface DataTableAddonEvents {
        'row-menu-open': RowActionContext<unknown>;
        'column-menu-open': ColumnDef<unknown>;
        'row-context-menu': DataTableRowContextMenuEvent;
        'header-context-menu': DataTableHeaderContextMenuEvent;
    }
}

const SLOT_ID = 'context-menu';
const MENU_TAG = 'ge-context-menu';
const PANEL = 'ge-context-menu-content';

type BuiltMenu = ContextMenuHost & { items: ContextMenuItem[] };

export const contextMenuAddon = defineAddon<ContextMenuOptions, unknown>('context-menu', ({ host, options, life }) => {
    const root = host.root;
    const labels = (): ContextMenuLabels => ({ ...host.resolvedLocale, ...options.locale });
    const rtl = (): boolean => getComputedStyle(root).direction === 'rtl';

    // ---- the built menus: one per kind, created at the first open, appended to <body> (lit owns the table's children) ----------------
    const built: Partial<Record<'row' | 'column', BuiltMenu>> = {};
    /** What the open built menus are open for, so the ⋮ buttons draw `aria-expanded`. */
    let openRowId: string | null = null;
    let openColumnKey: string | null = null;

    const menuOf = (kind: 'row' | 'column'): BuiltMenu => {
        const existing = built[kind];
        if (existing) return existing;
        if (!customElements.get(MENU_TAG)) warnOnce(`[ge-data-table] the context-menu addon needs <${MENU_TAG}>: import its define module (or the addon's).`);
        const menu = document.createElement(MENU_TAG) as unknown as BuiltMenu;
        menu.dataset['tableMenu'] = kind;
        document.body.append(menu);
        // `open` is reflected: its fall back to false is the close, however it happened (Escape, an outside click, a scroll, an item).
        const watcher = new MutationObserver(() => {
            if (menu.open) return;
            if (kind === 'row') openRowId = null;
            else openColumnKey = null;
            host.requestRender();
        });
        watcher.observe(menu, { attributes: true, attributeFilter: ['open'] });
        life.add(() => {
            watcher.disconnect();
            menu.remove();
            delete built[kind];
        });
        built[kind] = menu;
        return menu;
    };

    /** Opens `menu` at `anchor`; right-to-left, its right edge goes there, which needs the panel's width (known after a frame). */
    let frame = 0;
    life.add(() => frame && cancelAnimationFrame(frame));
    const showAt = (menu: ContextMenuHost, anchor: MenuAnchor, data: unknown): void => {
        cancelAnimationFrame(frame);
        menu.show(anchor.x, anchor.y, data);
        if (!anchor.alignEnd) return;
        frame = requestAnimationFrame(() => {
            const panel = menu.querySelector(PANEL) ?? menu.shadowRoot?.querySelector(PANEL);
            if (menu.open && panel) menu.show(anchorLeft(anchor, panel.getBoundingClientRect().width), anchor.y, data);
        });
    };

    const prepare = (menu: BuiltMenu): void => {
        menu.dir = rtl() ? 'rtl' : 'ltr';
        inheritThemeTokens(root, menu); // reused across opens: re-applied each time, the theme may have changed
    };

    const openRowMenu = (anchor: MenuAnchor, context: RowActionContext<unknown>): boolean => {
        const items = options.rowActions?.(context) ?? [];
        if (items.length === 0) return false;
        const menu = menuOf('row');
        prepare(menu);
        menu.items = items;
        openRowId = host.provider('query')?.rowId(context.row) ?? null;
        showAt(menu, anchor, context);
        host.requestRender();
        host.emit('row-menu-open', context);
        return true;
    };

    const openColumnMenu = (anchor: MenuAnchor, column: ColumnDef<unknown>): void => {
        const query = host.provider('query');
        const columns = host.provider('columns');
        if (!query || !columns) return;
        const menu = menuOf('column');
        prepare(menu);
        menu.items = buildColumnMenuItems(column, { query, columns }, labels());
        openColumnKey = String(column.accessorKey);
        showAt(menu, anchor, { columnKey: openColumnKey, column });
        host.requestRender();
        host.emit('column-menu-open', column);
    };

    // ---- the ⋮ buttons ----------------------------------------------------------------------------------------------------------
    if (options.rowActions) {
        life.add(
            host.registerCellAction({
                id: SLOT_ID,
                ariaLabel: options.locale?.rowActions,
                haspopup: 'menu',
                expanded: (context) => openRowId !== null && host.provider('query')?.rowId(context.row) === openRowId,
                onClick: (event, context) => void openRowMenu(buttonAnchor(buttonRect(event), 'row', rtl(), pointOfEvent(event)), context),
            }),
        );
    }
    if (options.columnMenu) {
        life.add(
            host.registerHeaderAction({
                id: SLOT_ID,
                ariaLabel: options.locale?.columnMenu,
                haspopup: 'menu',
                expanded: (column) => openColumnKey === String(column.accessorKey),
                onClick: (event, column) => openColumnMenu(buttonAnchor(buttonRect(event), 'column', rtl(), pointOfEvent(event)), column),
            }),
        );
    }

    // ---- the gestures -------------------------------------------------------------------------------------------------------------
    const boundMenu = (): ContextMenuHost | undefined => {
        const menu = options.menu;
        if (!menu) return undefined;
        const found = typeof menu === 'string' ? (root.getRootNode() as Document | ShadowRoot).querySelector(menu) : menu;
        return found && typeof (found as Partial<ContextMenuHost>).show === 'function' ? (found as ContextMenuHost) : undefined;
    };
    if (!options.menu && !options.rowActions) return; // neither mode: no gesture is taken

    /** Set by the hold's `touchstart` (see `rangeTakesHold`); read when the hold fires. */
    let rangeHold = false;
    /** The last ContextMenu / Shift+F10 keydown on the table: its `contextmenu` follows (at the keyup on Windows). */
    let keyboardAt = Number.NEGATIVE_INFINITY;

    life.listen<TouchEvent>(
        root,
        'touchstart',
        (event) => {
            const target = event.target instanceof Element ? event.target : null;
            rangeHold = !!boundMenu() && !!target && rangeTakesHold(host.provider('interaction'), cellAddress(ownClosest(root, target, CELL_SELECTOR)));
        },
        { passive: true },
    );
    life.listen<KeyboardEvent>(root, 'keydown', (event) => (keyboardAt = isMenuKey(event) ? performance.now() : Number.NEGATIVE_INFINITY), true);
    life.listen(root, 'pointerdown', () => (keyboardAt = Number.NEGATIVE_INFINITY), true);

    /** Where the gesture's menu opens: under the element it is about when the keyboard made it, else at the pointer. */
    const anchorOf = (gesture: ContextGesture, element: Element): MenuAnchor => {
        const keyboard = !gesture.viaTouch && (performance.now() - keyboardAt < KEYBOARD_ORIGIN_MS || (gesture.clientX === 0 && gesture.clientY === 0));
        keyboardAt = Number.NEGATIVE_INFINITY;
        return keyboard ? keyboardAnchor(element.getBoundingClientRect(), rtl()) : { x: gesture.clientX, y: gesture.clientY, alignEnd: false };
    };

    const onGesture = (gesture: ContextGesture): boolean => {
        if (options.disabled) return false;
        const menu = boundMenu();
        if (menu && gesture.viaTouch && rangeHold) return false;
        const rowEl = ownClosest(root, gesture.target, ROW_SELECTOR);
        if (rowEl) return openForRow(gesture, rowEl, menu);
        return menu ? openForHeader(gesture, menu) : false;
    };

    const openForRow = (gesture: ContextGesture, rowEl: HTMLElement, menu: ContextMenuHost | undefined): boolean => {
        const query = host.provider('query');
        const index = indexOf(rowEl);
        const row = index === null ? undefined : query?.renderedRowAt(index);
        if (!query || index === null || row === undefined) return false;
        const cellEl = ownClosest(root, gesture.target, CELL_SELECTOR);
        const cell = cellAddress(cellEl);
        const interaction = host.provider('interaction');
        const editing = interaction?.editingCell?.();
        // A right click in the open editor is the browser's (copy, paste, spelling).
        if (cell && editing && editing.rowIndex === cell.rowIndex && editing.columnKey === cell.columnKey) return false;
        const anchor = anchorOf(gesture, cellEl ?? rowEl);
        const node = query.renderedTreeRowAt(index);
        if (!menu) {
            const base = query.rowContext(row, index);
            const context = node ? { ...base, depth: node.depth, isLeaf: node.isLeaf, parentRow: node.parentRow, isExpanded: node.isExpanded } : base;
            if (!openRowMenu(anchor, context)) return false;
        }
        // Both modes move the grid focus to the cell (Angular only in custom mode); the table's own columns keep it where it is.
        if (cell && !TABLE_OWNED_COLUMNS.has(cell.columnKey)) interaction?.focusCell(cell.rowIndex, cell.columnKey);
        if (!menu) return true;
        host.emit('row-context-menu', { row, index, event: gesture.source, depth: node?.depth, isLeaf: node?.isLeaf, parentRow: node?.parentRow });
        showAt(menu, anchor, node ? { ...node, row } : row);
        return true;
    };

    const openForHeader = (gesture: ContextGesture, menu: ContextMenuHost): boolean => {
        if (options.rowsOnly !== false) return false;
        const header = ownClosest(root, gesture.target, HEADER_SELECTOR);
        if (!header) return false;
        const id = header.dataset['columnId'] ?? null;
        // The header text is drawn inside the column header's shadow root, where `textContent` does not see it: the definition's header is the name.
        const definition = host.provider('columns')?.enhancedColumns().find((c) => String(c.accessorKey) === id);
        const column = { id, name: definition?.header ?? header.textContent?.trim() ?? '', element: header };
        host.emit('header-context-menu', { column, event: gesture.source });
        showAt(menu, anchorOf(gesture, header), column);
        return true;
    };

    life.add(onContextGesture(root, onGesture));
});

/** The rect of the ⋮ button the click came from. */
function buttonRect(event: Event): DOMRect | undefined {
    const target = event.currentTarget instanceof Element ? event.currentTarget : event.target;
    const button = target instanceof Element ? target.closest('button') : null;
    return button?.getBoundingClientRect();
}

const pointOfEvent = (event: Event): { x: number; y: number } => ({ x: (event as MouseEvent).clientX ?? 0, y: (event as MouseEvent).clientY ?? 0 });

let warned = false;
function warnOnce(message: string): void {
    if (warned) return;
    warned = true;
    console.warn(message);
}
