/**
 * The context-menu addon on a real `ge-data-table` (spec A.4): real right clicks (CDP), real keys (`userEvent`), real touch (CDP touch
 * emulation), the ⋮ buttons, the built column menu's actions, axe, RTL, and the teardown. The Angular spec drives fake events on a hand-built
 * DOM; here every case runs on the table itself.
 */
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ContextMenuHost } from '../../../context-menu/context-menu.js';
import type { GeDataTable } from '../../data-table.js';
import { axProps, axTree, cellAt, headCell, mountTable, q, qa, SAMPLE_ROWS, send, settle, type SampleRow } from '../../data-table-fixtures.js';
import { emulateTouch, frames, mouseDrag, parkMouse, press, scrollGrid, touchDrag, touchLongPress, touchTap, withRtl, withTheme } from '../../data-table-input-fixtures.js';
import type { RowActionContext } from '../../data-table.types.js';
import { ownCellAt } from './context-menu-gesture.js';
import { contextMenuAddon, type ContextMenuItem, type ContextMenuOptions } from './define.js';

// ---- input ---------------------------------------------------------------------------------------------------------------------

/** The test frame's point as the top page's CDP input sees it. */
function toTop(x: number, y: number): { x: number; y: number } {
    const frame = window.frameElement;
    if (!frame) return { x, y };
    const rect = frame.getBoundingClientRect();
    const scale = rect.width / (window.innerWidth || 1);
    return { x: rect.left + x * scale, y: rect.top + y * scale };
}

/** A real right click at the element's centre (or at an offset from its top-left corner). */
async function rightClick(el: Element, at?: { dx: number; dy: number }): Promise<{ x: number; y: number }> {
    const rect = el.getBoundingClientRect();
    const point = at ? { x: rect.left + at.dx, y: rect.top + at.dy } : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const top = toTop(point.x, point.y);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...top });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...top, button: 'right', buttons: 2, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...top, button: 'right', buttons: 0, clickCount: 1 });
    await frames(2);
    return point;
}

/**
 * Records every `contextmenu` that reaches `window` unclaimed (the browser would show its own menu for it) and then prevents it, so a
 * headed run shows no native menu. A gesture the addon takes never gets there (it stops the event).
 */
function nativeMenus(): { readonly reached: Element[]; stop(): void } {
    const reached: Element[] = [];
    const listener = (event: Event): void => {
        if (!event.defaultPrevented) reached.push(event.target as Element);
        event.preventDefault();
    };
    window.addEventListener('contextmenu', listener);
    return { reached, stop: () => window.removeEventListener('contextmenu', listener) };
}

// ---- the table and its menus ---------------------------------------------------------------------------------------------------

type Menu = ContextMenuHost & HTMLElement;

const ROW_ITEMS = (context: RowActionContext<SampleRow>): ContextMenuItem[] => [{ label: `Edit ${context.row.name}` }, { label: 'Delete' }];

/** The point a pointer gesture opened `menu` at; CDP input lands on whole pixels, so within one. */
function expectAt(menu: Menu, point: { x: number; y: number }): void {
    expect(Math.abs(menu.x - point.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(menu.y - point.y)).toBeLessThanOrEqual(1);
}

async function mount(options: ContextMenuOptions<SampleRow>, props: Record<string, unknown> = {}): Promise<GeDataTable<SampleRow>> {
    const table = await mountTable(props);
    table.use(contextMenuAddon as never, options);
    await settle(table);
    return table;
}

/** The menu the addon built for `kind` (in <body>), if any. */
const builtMenu = (kind: 'row' | 'column'): Menu | null => document.querySelector<Menu>(`body > ge-context-menu[data-table-menu="${kind}"]`);
const itemsOf = (menu: Element): HTMLElement[] => [...(menu.shadowRoot?.querySelectorAll<HTMLElement>('ge-context-menu-item') ?? [])];
const labelsOf = (menu: Element): string[] => itemsOf(menu).map((i) => `${i.textContent?.trim()}${i.hasAttribute('disabled') ? ' (off)' : ''}`);
/** The element that has focus, through shadow roots. */
function deepActive(): Element | null {
    let at: Element | null = document.activeElement;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
    return at;
}
/** Waits until the open menu's first enabled item has focus (the panel moves it there two frames after opening). */
const focusedItem = async (menu: Element): Promise<HTMLElement> => {
    await vi.waitFor(() => expect(itemsOf(menu)).toContain(focusedMenuItem()));
    return focusedMenuItem() as HTMLElement;
};
const focusedMenuItem = (): Element | null => deepActive()?.closest('ge-context-menu-item') ?? null;
const rowButton = (table: Element, row: number): HTMLButtonElement => cellAt(table, row, '_actions')!.querySelector<HTMLButtonElement>('button[data-action-id="context-menu"]')!;
const headButton = (table: Element, key: string): HTMLButtonElement => headCell(table, key).querySelector<HTMLButtonElement>('button[data-action-id="context-menu"]')!;
const events = (table: Element, name: string): CustomEvent[] => {
    const heard: CustomEvent[] = [];
    table.addEventListener(name, (event) => heard.push(event as CustomEvent));
    return heard;
};
/** A consumer's own `ge-context-menu` (custom mode). */
function ownMenu(id = 'own-menu'): Menu {
    const menu = document.createElement('ge-context-menu') as Menu;
    menu.id = id;
    (menu as unknown as { items: ContextMenuItem[] }).items = [{ label: 'Own A' }, { label: 'Own B' }];
    document.body.append(menu);
    return menu;
}

const leftovers: Element[] = [];
beforeEach(async () => {
    await parkMouse();
});
afterEach(async () => {
    for (const el of leftovers.splice(0)) el.remove();
    for (const menu of document.querySelectorAll('body > ge-context-menu')) menu.remove();
    await send('Emulation.setEmulatedMedia', { features: [] });
    withTheme('light');
    await parkMouse(); // a menu or a table may have been left under the pointer (memory: pointer leaks across files)
});

// ---- 1. right click ----------------------------------------------------------------------------------------------------------

describe('right click on a row', () => {
    it('simple mode: opens the built menu at the pointer with the row, emits row-menu-open once, Escape returns focus to the cell', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        const opened = events(table, 'row-menu-open');
        const native = nativeMenus();
        try {
            const point = await rightClick(cellAt(table, 1, 'name')!);
            const menu = builtMenu('row')!;
            expect(menu.open).toBe(true);
            expectAt(menu, point);
            expect(labelsOf(menu)).toEqual(['Edit Alice', 'Delete']);
            expect(opened).toHaveLength(1);
            expect((opened[0]!.detail as RowActionContext<SampleRow>).row).toBe(SAMPLE_ROWS[1]);
            expect(opened[0]!.detail.index).toBe(1);
            expect(native.reached).toEqual([]);
            await focusedItem(menu);
            await press('{Escape}');
            expect(menu.open).toBe(false);
            expect(deepActive()).toBe(cellAt(table, 1, 'name'));
        } finally {
            native.stop();
        }
    });

    it('custom mode: opens the bound menu with the row as its data, emits row-context-menu once, and focuses the cell', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu });
        const heard = events(table, 'row-context-menu');
        const point = await rightClick(cellAt(table, 2, 'age')!);
        expect(menu.open).toBe(true);
        expectAt(menu, point);
        expect((menu as unknown as { data: unknown }).data).toBe(SAMPLE_ROWS[2]);
        expect(heard).toHaveLength(1);
        expect(heard[0]!.detail).toMatchObject({ row: SAMPLE_ROWS[2], index: 2 });
        expect((heard[0]!.detail.event as Event).type).toBe('contextmenu');
        expect(builtMenu('row')).toBeNull();
        await focusedItem(menu);
        await press('{Escape}');
        expect(deepActive()).toBe(cellAt(table, 2, 'age'));
    });

    it('a selector menu is resolved at open time, so a menu swapped in later is the one that opens', async () => {
        const table = await mount({ menu: '#swap-menu' });
        const native = nativeMenus();
        try {
            await rightClick(cellAt(table, 0, 'name')!);
            expect(native.reached).toHaveLength(1); // no such menu yet: the browser's
            const menu = ownMenu('swap-menu');
            leftovers.push(menu);
            await rightClick(cellAt(table, 0, 'name')!);
            expect(menu.open).toBe(true);
            expect(native.reached).toHaveLength(1);
        } finally {
            native.stop();
        }
    });

    it('disabled hands the gesture back to the browser, and turning it off at run time takes it again', async () => {
        const table = await mount({ rowActions: ROW_ITEMS, disabled: true });
        const native = nativeMenus();
        try {
            await rightClick(cellAt(table, 0, 'name')!);
            expect(native.reached).toHaveLength(1);
            expect(builtMenu('row')?.open ?? false).toBe(false);
            table.use(contextMenuAddon as never, { rowActions: ROW_ITEMS, disabled: false });
            await rightClick(cellAt(table, 0, 'name')!);
            expect(builtMenu('row')!.open).toBe(true);
            expect(native.reached).toHaveLength(1);
        } finally {
            native.stop();
        }
    });

    it('rowActions returning no item leaves the gesture to the browser', async () => {
        const table = await mount({ rowActions: () => [] });
        const native = nativeMenus();
        try {
            await rightClick(cellAt(table, 0, 'name')!);
            expect(native.reached).toHaveLength(1);
            expect(builtMenu('row')).toBeNull();
        } finally {
            native.stop();
        }
    });
});

// ---- 2. where a gesture opens nothing ----------------------------------------------------------------------------------------

describe('right click outside a data row', () => {
    it('the header: nothing by default (rowsOnly); the bound menu with the header when rowsOnly is false', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const native = nativeMenus();
        try {
            const table = await mount({ menu });
            await rightClick(headCell(table, 'name'));
            expect(menu.open).toBe(false);
            expect(native.reached).toHaveLength(1);
            table.use(contextMenuAddon as never, { menu, rowsOnly: false });
            const heard = events(table, 'header-context-menu');
            await rightClick(headCell(table, 'age'));
            expect(menu.open).toBe(true);
            expect(heard).toHaveLength(1);
            expect(heard[0]!.detail.column).toMatchObject({ id: 'age', name: 'Age', element: headCell(table, 'age') });
            expect((menu as unknown as { data: unknown }).data).toBe(heard[0]!.detail.column);
            expect(native.reached).toHaveLength(1);
        } finally {
            native.stop();
        }
    });

    it.each([
        ['a group header', { groupBy: 'age' }, '[data-kind="group"]'],
        ['a detail row', { enableRowExpansion: true, expandedRows: { a: true }, renderDetail: () => 'Details of the row' }, '[data-kind="detail"]'],
        ['the footer', { showFooter: true, columns: [{ accessorKey: 'name', header: 'Name', footer: 'Total' }, { accessorKey: 'age', header: 'Age' }] }, '[data-slot="table-footer"] [data-slot="table-row"]'],
        ['the empty row', { data: [] }, '[data-kind="empty"]'],
    ])('%s: opens nothing and the browser keeps its menu', async (_, props, selector) => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu, rowActions: ROW_ITEMS }, props);
        const native = nativeMenus();
        try {
            const target = q(table, selector);
            await rightClick(target, { dx: 12, dy: 8 });
            expect(menu.open).toBe(false);
            expect(builtMenu('row')).toBeNull();
            expect(native.reached).toHaveLength(1);
        } finally {
            native.stop();
        }
    });

    it('a row of a table nested in a detail row belongs to the inner table, not to the outer row', async () => {
        const inner = document.createElement('ge-data-table') as GeDataTable<SampleRow>;
        Object.assign(inner, { columns: [{ accessorKey: 'name', header: 'Inner' }], data: [{ id: 'x', name: 'Inner row', age: 1 }] });
        const outer = await mount({ rowActions: ROW_ITEMS }, { enableRowExpansion: true, expandedRows: { a: true }, renderDetail: () => inner });
        await settle(inner);
        const native = nativeMenus();
        try {
            await rightClick(cellAt(inner, 0, 'name')!);
            expect(builtMenu('row')).toBeNull();
            expect(native.reached).toHaveLength(1);
            await rightClick(cellAt(outer, 1, 'name')!);
            expect(labelsOf(builtMenu('row')!)).toEqual(['Edit Alice', 'Delete']);
        } finally {
            native.stop();
        }
    });
});

// ---- 3. keyboard -------------------------------------------------------------------------------------------------------------

describe('keyboard', () => {
    /** Into the grid (a click on row 0), then down to row 1 of the name column with the arrow key. */
    async function focusCell(table: GeDataTable<SampleRow>): Promise<HTMLElement> {
        await userEvent.click(cellAt(table, 0, 'name')!);
        expect(deepActive()).toBe(cellAt(table, 0, 'name'));
        await press('{ArrowDown}');
        const cell = deepActive() as HTMLElement;
        expect(cell).toBe(cellAt(table, 1, 'name'));
        return cell;
    }

    it.each([
        ['the ContextMenu key', '{ContextMenu}'],
        ['Shift+F10', '{Shift>}{F10}{/Shift}'],
    ])('%s on a cell opens the row menu under the cell, arrows move, Escape returns to the cell', async (_, keys) => {
        const table = await mount({ rowActions: ROW_ITEMS });
        const cell = await focusCell(table);
        await press(keys);
        const menu = builtMenu('row')!;
        expect(menu.open).toBe(true);
        const rect = cell.getBoundingClientRect();
        expect([menu.x, menu.y]).toEqual([rect.left, rect.bottom]);
        expect(labelsOf(menu)).toEqual(['Edit Alice', 'Delete']);
        const first = await focusedItem(menu);
        expect(first).toBe(itemsOf(menu)[0]);
        await press('{ArrowDown}');
        expect(focusedMenuItem()).toBe(itemsOf(menu)[1]);
        await press('{Escape}');
        expect(menu.open).toBe(false);
        expect(deepActive()).toBe(cell);
    });

    it('in RTL the menu opens under the cell with its right edge on the cell\'s right edge', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        await withRtl(table);
        const cell = await focusCell(table);
        await press('{ContextMenu}');
        const menu = builtMenu('row')!;
        const panel = menu.shadowRoot!.querySelector('ge-context-menu-content')!;
        await vi.waitFor(() => expect(Math.round(menu.x + panel.getBoundingClientRect().width)).toBe(Math.round(cell.getBoundingClientRect().right)));
        expect(menu.dir).toBe('rtl');
    });

    it('on a header control (custom mode, rowsOnly false) opens the bound menu with the header, under it', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu, rowsOnly: false, columnMenu: true });
        const heard = events(table, 'header-context-menu');
        const kebab = headButton(table, 'age');
        kebab.focus();
        await press('{ContextMenu}');
        expect(menu.open).toBe(true);
        expect(heard[0]!.detail.column.id).toBe('age');
        const rect = headCell(table, 'age').getBoundingClientRect();
        expect([menu.x, menu.y]).toEqual([rect.left, rect.bottom]);
        await focusedItem(menu);
        await press('{Escape}');
        expect(deepActive()).toBe(kebab);
    });
});

// ---- 4. touch ----------------------------------------------------------------------------------------------------------------

describe('touch', () => {
    // Touch first, then measure: `(pointer: coarse)` grows the ⋮ buttons and with them the rows, so a point taken before would land on another row.
    beforeEach(async () => {
        await emulateTouch(true);
    });
    afterEach(async () => {
        await emulateTouch(false);
    });

    it('a long press on a row opens the menu once and emits once; a pan opens nothing', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        const opened = events(table, 'row-menu-open');
        await touchLongPress(cellAt(table, 2, 'name')!, 700);
        await frames(2);
        const menu = builtMenu('row')!;
        expect(menu.open).toBe(true);
        expect(labelsOf(menu)).toEqual(['Edit Bob', 'Delete']);
        expect(opened).toHaveLength(1);
        menu.close();
        await settle(table);
        await touchDrag(cellAt(table, 1, 'name')!, { dx: 0, dy: 60 }, { steps: 6 });
        await new Promise((resolve) => setTimeout(resolve, 600));
        expect(menu.open).toBe(false);
        expect(opened).toHaveLength(1);
    });

    it('the finger lift after a long press that opened the menu is not a tap: focus stays in the menu', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        // Android sends no compatibility mouse events after a long press; Chromium's touch emulation does (a mousedown that focuses the
        // cell natively). Cancelling them at the touchend models that platform, so what is left is the table's own tap handling (pointerup).
        const noCompatMouse = (event: Event): void => event.preventDefault();
        window.addEventListener('touchend', noCompatMouse, { passive: false });
        try {
            await touchLongPress(cellAt(table, 1, 'name')!, 700);
            const menu = builtMenu('row')!;
            expect(menu.open).toBe(true);
            await focusedItem(menu);
            await frames(4);
            expect(itemsOf(menu)).toContain(focusedMenuItem());
            expect(menu.open).toBe(true);
        } finally {
            window.removeEventListener('touchend', noCompatMouse);
        }
    });

    // The range part keeps no 1x1 range (a single-cell hold is plain focus), so "inside the range" needs a range of two cells or more.
    const RANGE = { startRow: 1, startCol: 'name', endRow: 2, endCol: 'age' };

    it('simple mode with range selection on: a hold inside the range opens the built menu, a hold outside it is the range\'s', async () => {
        const table = await mount({ rowActions: ROW_ITEMS }, { enableCellRangeSelection: true });
        (table as unknown as { cellRange: unknown }).cellRange = RANGE;
        await settle(table);
        const opened = events(table, 'row-menu-open');
        await touchLongPress(cellAt(table, 2, 'age')!, 700);
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
        expect(opened).toHaveLength(1);
        builtMenu('row')!.close();
        await settle(table);
        await touchLongPress(cellAt(table, 3, 'name')!, 700);
        await frames(2);
        expect(builtMenu('row')!.open).toBe(false);
        expect(opened).toHaveLength(1);
    });

    it('range and row selection on: a hold on a selected ROW\'s cell outside the range is the range\'s (no menu)', async () => {
        const table = await mount({ rowActions: ROW_ITEMS }, { enableRowSelection: true, enableCellRangeSelection: true, rowSelection: { c: true } });
        const opened = events(table, 'row-menu-open');
        await touchLongPress(cellAt(table, 2, 'name')!, 700);
        await frames(2);
        expect(builtMenu('row')?.open ?? false).toBe(false);
        expect(opened).toHaveLength(0);
    });

    it('range selection on: a hold on a link in a cell is not the range\'s, it opens the menu', async () => {
        const columns = [{ accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: (ctx: { row: SampleRow }) => Object.assign(document.createElement('a'), { textContent: ctx.row.name }) }, { accessorKey: 'age', header: 'Age' }];
        const table = await mount({ rowActions: ROW_ITEMS }, { enableCellRangeSelection: true, columns });
        const opened = events(table, 'row-menu-open');
        await touchLongPress(cellAt(table, 1, 'name')!.querySelector('a')!, 700);
        await frames(2);
        // The hold opened the menu and started no range. (Chromium's emulation then sends the held link a click with no touchend before it,
        // so the release-click guard of shared/touch is not armed and that click closes the menu: a spec follow-up, not this arbitration.)
        expect(opened).toHaveLength(1);
        expect((table as unknown as { cellRange: unknown }).cellRange ?? null).toBeNull();
    });

    it('custom mode with range selection on: a hold inside the range opens the bound menu, a hold outside it is the range\'s', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu }, { enableCellRangeSelection: true });
        (table as unknown as { cellRange: unknown }).cellRange = RANGE;
        await settle(table);
        const heard = events(table, 'row-context-menu');
        await touchLongPress(cellAt(table, 1, 'name')!, 700);
        await frames(2);
        expect(menu.open).toBe(true);
        expect(heard).toHaveLength(1);
        menu.close();
        await settle(table);
        await touchLongPress(cellAt(table, 3, 'age')!, 700);
        await frames(2);
        expect(menu.open).toBe(false);
        expect(heard).toHaveLength(1);
    });
});

// ---- 5. the ⋮ buttons --------------------------------------------------------------------------------------------------------

describe('the ⋮ buttons', () => {
    it('the row button opens the built menu at its bottom-right corner, the header button the column menu at its bottom-left', async () => {
        const table = await mount({ rowActions: ROW_ITEMS, columnMenu: true });
        const rowOpened = events(table, 'row-menu-open');
        const columnOpened = events(table, 'column-menu-open');
        const kebab = rowButton(table, 3);
        await userEvent.click(kebab);
        await frames(2);
        const rowMenu = builtMenu('row')!;
        const rect = kebab.getBoundingClientRect();
        expect([rowMenu.x, rowMenu.y]).toEqual([rect.right, rect.bottom]);
        expect(labelsOf(rowMenu)).toEqual(['Edit Dave', 'Delete']);
        expect(rowOpened[0]!.detail.row).toBe(SAMPLE_ROWS[3]);
        await focusedItem(rowMenu);
        await press('{Escape}');
        expect(deepActive()).toBe(rowButton(table, 3));

        const head = headButton(table, 'name');
        await userEvent.click(head);
        await frames(2);
        const columnMenu = builtMenu('column')!;
        const headRect = head.getBoundingClientRect();
        expect([columnMenu.x, columnMenu.y]).toEqual([headRect.left, headRect.bottom]);
        expect(columnOpened[0]!.detail.accessorKey).toBe('name');
        expect(labelsOf(columnMenu)).toEqual(['Sort Ascending', 'Sort Descending', 'Pin Left', 'Pin Right', 'Hide Column', 'Show All Columns']);
        await focusedItem(columnMenu);
        await press('{Escape}');
        expect(deepActive()).toBe(headButton(table, 'name'));
    });

    it('in RTL the row menu opens with its right edge at the button\'s left edge', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        await withRtl(table);
        const kebab = rowButton(table, 0);
        await userEvent.click(kebab);
        const menu = builtMenu('row')!;
        const panel = menu.shadowRoot!.querySelector('ge-context-menu-content')!;
        await vi.waitFor(() => expect(Math.round(menu.x + panel.getBoundingClientRect().width)).toBe(Math.round(kebab.getBoundingClientRect().left)));
    });

    it('are labelled menu buttons, aria-expanded follows the menu, row buttons are out of the tab order and header buttons in it', async () => {
        const table = await mount({ rowActions: ROW_ITEMS, columnMenu: true });
        const kebab = rowButton(table, 0);
        expect(kebab.getAttribute('aria-haspopup')).toBe('menu');
        expect(kebab.getAttribute('aria-expanded')).toBe('false');
        expect(kebab.tabIndex).toBe(-1);
        expect(headButton(table, 'name').tabIndex).toBe(0);
        const nodes = await axTree();
        const named = (name: string) => nodes.filter((n) => n.role?.value === 'button' && n.name?.value === name);
        expect(named('Row actions')).toHaveLength(SAMPLE_ROWS.length);
        expect(named('Column menu for Name')).toHaveLength(1);
        expect(axProps(named('Row actions')[0])['hasPopup']).toBe('menu');

        await userEvent.click(kebab);
        await settle(table);
        expect(rowButton(table, 0).getAttribute('aria-expanded')).toBe('true');
        expect(rowButton(table, 1).getAttribute('aria-expanded')).toBe('false');
        await focusedItem(builtMenu('row')!);
        await press('{Escape}');
        await settle(table);
        expect(rowButton(table, 0).getAttribute('aria-expanded')).toBe('false');

        await userEvent.click(headButton(table, 'age'));
        await settle(table);
        expect(headButton(table, 'age').getAttribute('aria-expanded')).toBe('true');
        expect(headButton(table, 'name').getAttribute('aria-expanded')).toBe('false');
        builtMenu('column')!.close();
        await settle(table);
        await vi.waitFor(() => expect(headButton(table, 'age').getAttribute('aria-expanded')).toBe('false'));
    });

    it('with both a bound menu and rowActions, the gestures open the bound menu and the button the built one', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu, rowActions: ROW_ITEMS });
        await rightClick(cellAt(table, 0, 'name')!);
        expect(menu.open).toBe(true);
        expect(builtMenu('row')).toBeNull();
        menu.close();
        await userEvent.click(rowButton(table, 0));
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
    });

    it('a scroll closes an open menu, and aria-expanded follows', async () => {
        const table = await mountTable({ data: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}`, age: i })) }, {}, { width: 500, height: 240 });
        table.use(contextMenuAddon as never, { rowActions: ROW_ITEMS });
        await settle(table);
        await userEvent.click(rowButton(table, 0));
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
        await scrollGrid(table, { top: 200 });
        expect(builtMenu('row')!.open).toBe(false);
        await scrollGrid(table, { top: 0 });
        await vi.waitFor(() => expect(rowButton(table, 0).getAttribute('aria-expanded')).toBe('false'));
    });
});

// ---- 6. the column menu's actions --------------------------------------------------------------------------------------------

describe('the column menu', () => {
    async function choose(table: GeDataTable<SampleRow>, key: string, label: string): Promise<void> {
        await userEvent.click(headButton(table, key));
        await frames(2);
        const item = itemsOf(builtMenu('column')!).find((i) => i.textContent?.trim() === label);
        expect(item, label).toBeDefined();
        await userEvent.click(item!);
        await settle(table);
    }

    it('sorts, and the current direction is disabled when it opens again', async () => {
        const table = await mount({ columnMenu: true });
        await choose(table, 'name', 'Sort Ascending');
        expect(qa(table, '[data-slot="table-cell"][data-column="name"]').map((c) => c.textContent?.trim())).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
        await userEvent.click(headButton(table, 'name'));
        await frames(2);
        expect(labelsOf(builtMenu('column')!).slice(0, 3)).toEqual(['Sort Ascending (off)', 'Sort Descending', 'Clear Sort']);
    });

    it('pins left, hides, and shows all again', async () => {
        const table = await mount({ columnMenu: true });
        await choose(table, 'age', 'Pin Left');
        expect(headCell(table, 'age').dataset['pinned']).toBe('left');
        await choose(table, 'age', 'Hide Column');
        expect(table.querySelector('[data-slot="table-head"][data-column-id="age"]')).toBeNull();
        // the last visible data column offers no hide
        await userEvent.click(headButton(table, 'name'));
        await frames(2);
        expect(labelsOf(builtMenu('column')!)).not.toContain('Hide Column');
        await userEvent.click(itemsOf(builtMenu('column')!).find((i) => i.textContent?.trim() === 'Show All Columns')!);
        await settle(table);
        expect(headCell(table, 'age')).toBeTruthy();
    });
});

// ---- review fixes (PR #79) ---------------------------------------------------------------------------------------------------

describe('menu lifecycle', () => {
    it('a column defined pinned and then unpinned offers Pin Left again, not Unpin', async () => {
        const table = await mount({ columnMenu: true }, { columns: [{ accessorKey: 'name', header: 'Name', width: '200px', pin: 'left' }, { accessorKey: 'age', header: 'Age' }] });
        await userEvent.click(headButton(table, 'name'));
        await frames(2);
        await userEvent.click(itemsOf(builtMenu('column')!).find((i) => i.textContent?.trim() === 'Unpin')!);
        await settle(table);
        expect(headCell(table, 'name').dataset['pinned']).toBeUndefined();
        await userEvent.click(headButton(table, 'name'));
        await frames(2);
        const labels = labelsOf(builtMenu('column')!);
        expect(labels).toContain('Pin Left');
        expect(labels).not.toContain('Unpin');
    });

    it('a right click on a partly clipped row opens a menu that stays open (the focus scroll does not close it)', async () => {
        const table = await mountTable({ data: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}`, age: i })) }, {}, { width: 500, height: 240 });
        table.use(contextMenuAddon as never, { rowActions: ROW_ITEMS });
        await settle(table);
        await scrollGrid(table, { top: 25 }); // half a row: the row at the bottom edge is cut
        const viewport = q(table, '[data-slot="data-table-viewport"]').getBoundingClientRect();
        const clipped = [...table.querySelectorAll<HTMLElement>('[data-slot="table-cell"][data-column="name"]')].find((c) => {
            const r = c.getBoundingClientRect();
            return r.top < viewport.bottom - 8 && r.bottom > viewport.bottom;
        });
        expect(clipped, `a row cut by the bottom edge ${JSON.stringify(viewport)} ${[...table.querySelectorAll<HTMLElement>('[data-slot="table-cell"][data-column="name"]')].map((c) => `${c.getBoundingClientRect().top}-${c.getBoundingClientRect().bottom}`).join(' ')}`).toBeTruthy();
        const scrolled = new Promise<void>((resolve) => q(table, '[data-slot="data-table-viewport"]').addEventListener('scroll', () => resolve(), { once: true }));
        await rightClick(clipped!, { dx: 20, dy: 4 });
        await Promise.race([scrolled, frames(4)]);
        await frames(3);
        expect(builtMenu('row')!.open).toBe(true);
    });

    it('the ⋮ of the open menu closes it and leaves it closed (row and header)', async () => {
        const table = await mount({ rowActions: ROW_ITEMS, columnMenu: true });
        await userEvent.click(rowButton(table, 1));
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
        await userEvent.click(rowButton(table, 1));
        await frames(3);
        expect(builtMenu('row')!.open).toBe(false);
        await settle(table);
        expect(rowButton(table, 1).getAttribute('aria-expanded')).toBe('false');

        await userEvent.click(headButton(table, 'age'));
        await frames(2);
        expect(builtMenu('column')!.open).toBe(true);
        await userEvent.click(headButton(table, 'age'));
        await frames(3);
        expect(builtMenu('column')!.open).toBe(false);
        // and the next click opens it again
        await userEvent.click(headButton(table, 'age'));
        await frames(2);
        expect(builtMenu('column')!.open).toBe(true);
    });

    it('opening a menu closes the addon\'s other open menu', async () => {
        const table = await mount({ rowActions: ROW_ITEMS, columnMenu: true });
        // the age column's menu opens at its ⋮ (the right end of the table), clear of the name cells
        await userEvent.click(headButton(table, 'age'));
        await frames(2);
        expect(builtMenu('column')!.open).toBe(true);
        await rightClick(cellAt(table, 2, 'name')!, { dx: 10, dy: 8 });
        expect(builtMenu('row')!.open).toBe(true);
        expect(builtMenu('column')!.open).toBe(false);
    });

    it('a disabled row has no row menu: no ⋮, and its right click is the browser\'s', async () => {
        const table = await mount({ rowActions: ROW_ITEMS }, { enableRowSelection: true, disabledRowIds: ['b'] });
        expect(cellAt(table, 1, '_actions')!.querySelector('button[data-action-id="context-menu"]')).toBeNull();
        const native = nativeMenus();
        try {
            await rightClick(cellAt(table, 1, 'name')!);
            expect(builtMenu('row')?.open ?? false).toBe(false);
            expect(native.reached).toHaveLength(1);
            await rightClick(cellAt(table, 0, 'name')!);
            expect(builtMenu('row')!.open).toBe(true);
        } finally {
            native.stop();
        }
    });
});

describe('final review fixes (PR #79)', () => {
    it('an invalid menu selector is no bound menu: warned once, and the built menu still answers the gestures', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const table = await mount({ menu: '##not a selector', rowActions: ROW_ITEMS });
            await rightClick(cellAt(table, 0, 'name')!);
            expect(builtMenu('row')!.open).toBe(true);
            await press('{Escape}');
            await rightClick(cellAt(table, 1, 'name')!);
            expect(builtMenu('row')!.open).toBe(true);
            expect(warn.mock.calls.filter((c) => String(c[0]).includes('selector'))).toHaveLength(1);
        } finally {
            warn.mockRestore();
        }
    });

    it('a press dragged off the open ⋮ leaves no toggle mark: a later keyboard activation of that ⋮ opens the menu', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        await userEvent.click(rowButton(table, 1));
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
        await mouseDrag(rowButton(table, 1), cellAt(table, 3, 'name')!, { steps: 4 });
        await frames(2);
        expect(builtMenu('row')!.open).toBe(false);
        rowButton(table, 1).focus();
        await press('{Enter}');
        await frames(2);
        expect(builtMenu('row')!.open).toBe(true);
    });

    it.each([
        ['simple', 'row-menu-open', {}],
        ['custom', 'row-context-menu', { menu: 'own' }],
    ] as const)('%s mode emits %s at the gesture, synchronously, once per gesture', async (_, name, extra) => {
        const options: ContextMenuOptions<SampleRow> = { rowActions: ROW_ITEMS };
        if (extra.menu) {
            const menu = ownMenu();
            leftovers.push(menu);
            options.menu = menu;
        }
        const table = await mount(options);
        const heard = events(table, name);
        const gesture = (cell: Element): boolean => cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: 30, clientY: 30 }));
        expect(gesture(cellAt(table, 0, 'name')!)).toBe(false); // taken: the browser's menu is prevented
        expect(gesture(cellAt(table, 2, 'name')!)).toBe(false);
        expect(heard).toHaveLength(2); // both, before any frame
        await frames(2);
        expect(heard).toHaveLength(2);
    });
});

describe('final review 2 (PR #79)', () => {
    it('a special column\'s header is no column header for the bound menu: its right click is the browser\'s', async () => {
        const menu = ownMenu();
        leftovers.push(menu);
        const table = await mount({ menu, rowsOnly: false }, { enableRowSelection: true });
        const heard = events(table, 'header-context-menu');
        const native = nativeMenus();
        try {
            await rightClick(headCell(table, '_selection'), { dx: 4, dy: 4 });
            expect(menu.open).toBe(false);
            expect(heard).toHaveLength(0);
            expect(native.reached).toHaveLength(1);
            await rightClick(headCell(table, 'name'));
            expect(heard).toHaveLength(1);
        } finally {
            native.stop();
        }
    });

    it('the redrawn-cell lookup finds this table\'s cell, not the same address in a table nested in a detail row', async () => {
        const inner = document.createElement('ge-data-table') as GeDataTable<SampleRow>;
        Object.assign(inner, { columns: [{ accessorKey: 'name', header: 'Inner' }], data: [{ id: 'x', name: 'X', age: 1 }, { id: 'y', name: 'Y', age: 2 }] });
        const outer = await mount({ rowActions: ROW_ITEMS }, { enableRowExpansion: true, expandedRows: { a: true }, renderDetail: () => inner });
        await settle(inner);
        // the inner table's row 1 comes first in document order, before the outer row 1
        const outerCell = qa(outer, '[data-row-index="1"][data-column="name"]').find((c) => c.closest('ge-data-table') === outer);
        expect(outer.querySelector('[data-row-index="1"][data-column="name"]')).toBe(cellAt(inner, 1, 'name')); // an unscoped lookup finds the inner cell
        expect(outerCell).toBeTruthy();
        expect(ownCellAt(outer, { rowIndex: 1, columnKey: 'name' })).toBe(outerCell);
    });
});

describe('core tap focus (lead-approved)', () => {
    beforeEach(async () => {
        await emulateTouch(true);
    });
    afterEach(async () => {
        await emulateTouch(false);
    });

    it('focus that moved to a non-menu element outside the table during the press does not stop the tap: the tapped cell gets focus', async () => {
        const table = await mount({ rowActions: ROW_ITEMS });
        const trigger = document.createElement('button');
        trigger.textContent = 'trigger';
        document.body.prepend(trigger);
        leftovers.push(trigger);
        // an overlay outside hands focus back to its trigger while the finger is down
        const handBack = (): void => trigger.focus();
        const cell = cellAt(table, 2, 'name')!;
        cell.addEventListener('touchstart', handBack, { passive: true });
        // no compatibility mouse events (their mousedown would focus the cell natively): the table's tap is what is tested
        const noCompatMouse = (event: Event): void => event.preventDefault();
        window.addEventListener('touchend', noCompatMouse, { passive: false });
        try {
            await touchTap(cell);
            await frames(2);
            expect(deepActive()).toBe(cellAt(table, 2, 'name'));
        } finally {
            cell.removeEventListener('touchstart', handBack);
            window.removeEventListener('touchend', noCompatMouse);
        }
    });
});

// ---- 7. axe ------------------------------------------------------------------------------------------------------------------

describe('axe', () => {
    const violations = async (el: Element): Promise<string[]> => (await axe.run(el)).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

    it.each(['light', 'dark'])('passes with the ⋮ column, the open row menu and the open column menu (%s)', async (mode) => {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        withTheme(mode);
        const table = await mount({ rowActions: ROW_ITEMS, columnMenu: true });
        expect(await violations(table)).toEqual([]);
        await userEvent.click(rowButton(table, 0));
        await focusedItem(builtMenu('row')!);
        expect(await violations(builtMenu('row')!)).toEqual([]);
        await press('{Escape}');
        await userEvent.click(headButton(table, 'name'));
        await focusedItem(builtMenu('column')!);
        expect(await violations(builtMenu('column')!)).toEqual([]);
        await press('{Escape}');
    });
});

// ---- 8. teardown -------------------------------------------------------------------------------------------------------------

describe('teardown', () => {
    it('removing the table removes its open menus and every listener it added to document or window', async () => {
        const added = new Map<string, number>();
        const keyOf = (target: string, type: string, listener: unknown, options: unknown): string => {
            const capture = typeof options === 'boolean' ? options : !!(options as AddEventListenerOptions | undefined)?.capture;
            const id = (listener as { __id?: number }).__id ?? ((listener as { __id?: number }).__id = added.size + Math.random());
            return `${target}:${type}:${capture}:${id}`;
        };
        const watch = (target: EventTarget, name: string) => {
            const add = vi.spyOn(target, 'addEventListener').mockImplementation(function (this: EventTarget, type, listener, options) {
                if (listener) added.set(keyOf(name, type, listener, options), (added.get(keyOf(name, type, listener, options)) ?? 0) + 1);
                return EventTarget.prototype.addEventListener.call(this, type, listener, options);
            });
            const remove = vi.spyOn(target, 'removeEventListener').mockImplementation(function (this: EventTarget, type, listener, options) {
                if (listener) added.delete(keyOf(name, type, listener, options));
                return EventTarget.prototype.removeEventListener.call(this, type, listener, options);
            });
            return () => {
                add.mockRestore();
                remove.mockRestore();
            };
        };
        const table = await mountTable();
        const unwatch = [watch(document, 'document'), watch(window, 'window')];
        try {
            table.use(contextMenuAddon as never, { rowActions: ROW_ITEMS, columnMenu: true });
            await settle(table);
            await userEvent.click(headButton(table, 'name'));
            await frames(2);
            await press('{Escape}');
            await rightClick(cellAt(table, 0, 'name')!);
            expect(builtMenu('row')!.open).toBe(true);
            expect(builtMenu('column')).not.toBeNull();
            table.remove();
            await frames(2);
            expect(document.querySelectorAll('body > ge-context-menu')).toHaveLength(0);
            expect([...added.keys()]).toEqual([]);
        } finally {
            for (const stop of unwatch) stop();
        }
    });

    it('two tables keep separate menus, and removing one leaves the other\'s working', async () => {
        const first = await mount({ rowActions: () => [{ label: 'First' }] });
        const second = await mount({ rowActions: () => [{ label: 'Second' }] });
        await rightClick(cellAt(first, 0, 'name')!);
        await rightClick(cellAt(second, 0, 'name')!);
        const menus = [...document.querySelectorAll('body > ge-context-menu[data-table-menu="row"]')];
        expect(menus).toHaveLength(2);
        expect(menus.map(labelsOf)).toEqual([['First'], ['Second']]);
        first.remove();
        expect(document.querySelectorAll('body > ge-context-menu[data-table-menu="row"]')).toHaveLength(1);
        await rightClick(cellAt(second, 1, 'name')!);
        expect(builtMenu('row')!.open).toBe(true);
        expect(labelsOf(builtMenu('row')!)).toEqual(['Second']);
    });
});
