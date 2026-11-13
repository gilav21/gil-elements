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
import { onContextGesture, TOUCH_CONTROLS, type ContextGesture } from '../../../shared/touch.js';
import { inheritThemeTokens } from '../../../shared/theme-presets.js';
import { defineAddon } from '../../data-table-addon-kit.js';
import type { ColumnDef, RowActionContext } from '../../data-table.types.js';
import { buildColumnMenuItems, type ContextMenuLabels } from './context-menu-items.js';
import {
    anchorLeft,
    buttonAnchor,
    CELL_SELECTOR,
    cellAddress,
    ownCellAt,
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

    /** The built menu of `kind`; undefined (and a warning) while `ge-context-menu` is not defined: nothing opens then. */
    const menuOf = (kind: 'row' | 'column'): BuiltMenu | undefined => {
        const existing = built[kind];
        if (existing) return existing;
        if (!customElements.get(MENU_TAG)) {
            warnOnce(`[ge-data-table] the context-menu addon needs <${MENU_TAG}>: import its define module (or the addon's).`);
            return undefined;
        }
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

    const boundMenu = (): ContextMenuHost | undefined => {
        const menu = options.menu;
        if (!menu) return undefined;
        let found: Element | ContextMenuHost | null = null;
        try {
            found = typeof menu === 'string' ? (root.getRootNode() as Document | ShadowRoot).querySelector(menu) : menu;
        } catch (error) {
            // An invalid selector is no bound menu (the built menus keep working); said once per table.
            if (!badSelectorWarned.has(root)) {
                badSelectorWarned.add(root);
                console.warn(`[ge-data-table] the context-menu addon's menu selector "${String(menu)}" is invalid; no bound menu is used:`, error);
            }
        }
        return found && typeof (found as Partial<ContextMenuHost>).show === 'function' ? (found as ContextMenuHost) : undefined;
    };

    /** Opens `menu` at `anchor` and closes the addon's other open menus; right-to-left, its right edge goes there, which needs the panel's width (known after a frame). */
    let frame = 0;
    life.add(() => frame && cancelAnimationFrame(frame));
    const showAt = (menu: ContextMenuHost, anchor: MenuAnchor, data: unknown): void => {
        cancelAnimationFrame(frame);
        for (const other of [built.row, built.column, boundMenu()]) if (other && other !== menu && other.open) other.close();
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

    /** The built row menu's items for `context`, or undefined when it has none to show (no items, a disabled row, no menu element). */
    const rowMenuFor = (context: RowActionContext<unknown>): { menu: BuiltMenu; items: ContextMenuItem[] } | undefined => {
        if (host.provider('selection')?.isDisabled(context.row)) return undefined; // a disabled row has no actions (the core draws it no ⋮ either)
        const items = options.rowActions?.(context) ?? [];
        const menu = items.length > 0 ? menuOf('row') : undefined;
        return menu ? { menu, items } : undefined;
    };

    const showRowMenu = ({ menu, items }: { menu: BuiltMenu; items: ContextMenuItem[] }, anchor: MenuAnchor, context: RowActionContext<unknown>): void => {
        prepare(menu);
        menu.items = items;
        showAt(menu, anchor, context);
        openRowId = host.provider('query')?.rowId(context.row) ?? null;
        host.requestRender();
    };

    const openColumnMenu = (anchor: MenuAnchor, column: ColumnDef<unknown>): void => {
        const query = host.provider('query');
        const columns = host.provider('columns');
        const menu = menuOf('column');
        if (!query || !columns || !menu) return;
        prepare(menu);
        menu.items = buildColumnMenuItems(column, { query, columns }, labels());
        const key = String(column.accessorKey);
        showAt(menu, anchor, { columnKey: key, column });
        openColumnKey = key;
        host.requestRender();
        host.emit('column-menu-open', column);
    };

    // ---- the ⋮ buttons ----------------------------------------------------------------------------------------------------------
    /**
     * The ⋮ button of the open menu a press began on. That press's click closes the menu (outside click) before the button hears it, so the
     * button only learns it was a toggle from here: it then leaves the menu closed.
     */
    let toggled: Element | null = null;
    if (options.rowActions || options.columnMenu) {
        life.listen<PointerEvent>(
            root,
            'pointerdown',
            (event) => {
                const button = event.target instanceof Element ? event.target.closest(`button[data-action-id="${SLOT_ID}"]`) : null;
                toggled = button?.getAttribute('aria-expanded') === 'true' ? button : null;
            },
            true,
        );
        // A press released off its ⋮ (or cancelled) clicks no ⋮, and a key makes no press: neither may leave the mark for a later click (a keyboard activation).
        const release = (event: Event): void => {
            if (!(toggled && event.target instanceof Node && toggled.contains(event.target))) toggled = null;
        };
        life.listen(root, 'pointerup', release, true);
        life.listen(root, 'pointercancel', () => (toggled = null), true);
        life.listen(root, 'keydown', () => (toggled = null), true);
    }
    const wasOpen = (event: Event): boolean => {
        const button = buttonOf(event);
        const hit = button !== null && button === toggled;
        toggled = null;
        return hit;
    };

    if (options.rowActions) {
        life.add(
            host.registerCellAction({
                id: SLOT_ID,
                ariaLabel: options.locale?.rowActions,
                haspopup: 'menu',
                expanded: (context) => openRowId !== null && host.provider('query')?.rowId(context.row) === openRowId,
                onClick: (event, context) => {
                    if (wasOpen(event)) return;
                    const prepared = rowMenuFor(context);
                    if (!prepared) return;
                    showRowMenu(prepared, buttonAnchor(buttonOf(event)?.getBoundingClientRect(), 'row', rtl(), pointOfEvent(event)), context);
                    host.emit('row-menu-open', context);
                },
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
                onClick: (event, column) => {
                    if (!wasOpen(event)) openColumnMenu(buttonAnchor(buttonOf(event)?.getBoundingClientRect(), 'column', rtl(), pointOfEvent(event)), column);
                },
            }),
        );
    }

    // ---- the gestures -------------------------------------------------------------------------------------------------------------
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
            if (!target) return void (rangeHold = false);
            // The range's own test (`lazy/range.ts` `onLongPress`): a control anywhere on the path inside the table keeps the hold from the range.
            const onControl = event.composedPath().some((node) => node instanceof Element && node !== root && root.contains(node) && node.matches(TOUCH_CONTROLS));
            const keys = host.provider('columns')?.navigableKeys() ?? [];
            rangeHold = rangeTakesHold(host.provider('interaction'), cellAddress(ownClosest(root, target, CELL_SELECTOR)), keys, onControl);
        },
        { passive: true },
    );
    life.listen<KeyboardEvent>(root, 'keydown', (event) => (keyboardAt = isMenuKey(event) ? performance.now() : Number.NEGATIVE_INFINITY), true);
    life.listen(root, 'pointerdown', () => (keyboardAt = Number.NEGATIVE_INFINITY), true);

    /** The keyboard made the gesture (read once: it spends the keydown mark). */
    const byKeyboard = (gesture: ContextGesture): boolean => {
        const keyboard = !gesture.viaTouch && (performance.now() - keyboardAt < KEYBOARD_ORIGIN_MS || (gesture.clientX === 0 && gesture.clientY === 0));
        keyboardAt = Number.NEGATIVE_INFINITY;
        return keyboard;
    };
    /** Where the gesture's menu opens: under the element it is about when the keyboard made it, else at the pointer. */
    const anchorOf = (gesture: ContextGesture, keyboard: boolean, element: Element): MenuAnchor =>
        keyboard ? keyboardAnchor(element.getBoundingClientRect(), rtl()) : { x: gesture.clientX, y: gesture.clientY, alignEnd: false };

    /**
     * Runs `open` once the scroll a focus move may have caused is reported: a context menu closes on scroll, and a cell revealed by the focus
     * scrolls the grid. Scroll events are dispatched in the next frame's rendering steps, before its animation-frame callbacks.
     */
    let pending = 0;
    life.add(() => pending && cancelAnimationFrame(pending));
    const afterScroll = (open: () => void): void => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => {
            pending = 0;
            open();
        });
    };

    const onGesture = (gesture: ContextGesture): boolean => {
        if (options.disabled) return false;
        const menu = boundMenu();
        // Both modes: a touch hold the range selection takes (an unselected data cell while range selection is on) opens no menu.
        if (gesture.viaTouch && rangeHold) return false;
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
        const keyboard = byKeyboard(gesture);
        const node = query.renderedTreeRowAt(index);
        const base = query.rowContext(row, index);
        const context = node ? { ...base, depth: node.depth, isLeaf: node.isLeaf, parentRow: node.parentRow, isExpanded: node.isExpanded } : base;
        const rowMenu = menu ? undefined : rowMenuFor(context);
        if (!menu && !rowMenu) return false;
        // The event fires at the gesture (as Angular's, while its source event is still being dispatched); only the menu's show waits below.
        if (rowMenu) host.emit('row-menu-open', context);
        else host.emit('row-context-menu', { row, index, event: gesture.source, depth: node?.depth, isLeaf: node?.isLeaf, parentRow: node?.parentRow });
        const open = (): void => {
            // The anchor is measured now: the focus move may have scrolled the grid (and redrawn the cell).
            const redrawn = cell ? ownCellAt(root, cell) : null;
            const at = [cellEl, redrawn, rowEl].find((el) => el?.isConnected) ?? rowEl;
            const anchor = anchorOf(gesture, keyboard, at);
            if (rowMenu) showRowMenu(rowMenu, anchor, context);
            else if (menu) showAt(menu, anchor, node ? { ...node, row } : row);
        };
        // Both modes move the grid focus to the cell (Angular only in custom mode); the table's own columns keep it where it is. The menu opens after
        // the scroll that focus may cause, which would close it.
        if (cell && !TABLE_OWNED_COLUMNS.has(cell.columnKey) && interaction) {
            interaction.focusCell(cell.rowIndex, cell.columnKey);
            afterScroll(open);
        } else open();
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
        showAt(menu, anchorOf(gesture, byKeyboard(gesture), header), column);
        return true;
    };

    life.add(onContextGesture(root, onGesture));
});

/** The ⋮ button a click came from. */
function buttonOf(event: Event): Element | null {
    const target = event.currentTarget instanceof Element ? event.currentTarget : event.target;
    return target instanceof Element ? target.closest('button') : null;
}

const pointOfEvent = (event: Event): { x: number; y: number } => ({ x: (event as MouseEvent).clientX ?? 0, y: (event as MouseEvent).clientY ?? 0 });

/** Tables whose invalid `menu` selector was already reported. */
const badSelectorWarned = new WeakSet<Element>();

let warned = false;
function warnOnce(message: string): void {
    if (warned) return;
    warned = true;
    console.warn(message);
}
