/** The context-menu addon without a DOM: the built column menu, slot registration, the touch-hold arbitration and the anchoring maths. */
import { describe, expect, it, vi } from 'vitest';
import type { ContextMenuItem } from '../../../context-menu/context-menu.js';
import { AddonSet, type DataTableAddonHost } from '../../data-table-addon-kit.js';
import { DOM_PROTOCOL } from '../../data-table-host.js';
import { DATA_TABLE_LOCALES } from '../../data-table.locales.js';
import type { CellActionSlot, HeaderActionSlot } from '../../data-table-providers.js';
import type { ColumnDef, SortDirection } from '../../data-table.types.js';
import { contextMenuAddon } from './context-menu.js';
import { buildColumnMenuItems, type ColumnMenuServices, type ContextMenuLabels } from './context-menu-items.js';
import { anchorLeft, buttonAnchor, CELL_SELECTOR, COLUMN, isMenuKey, keyboardAnchor, rangeTakesHold, ROW_INDEX, ROW_SELECTOR } from './context-menu-gesture.js';

type Row = { id: string; name: string };

function services({ sort = null as SortDirection, pin = undefined as 'left' | 'right' | undefined, visible = ['name', 'age'] } = {}) {
    const calls: unknown[][] = [];
    const record =
        (name: string) =>
        (...args: unknown[]): void =>
            void calls.push([name, ...args]);
    const value: ColumnMenuServices<Row> = {
        query: { sortDirection: () => sort, changeSort: record('changeSort') },
        columns: { pinOf: () => pin, setPin: record('setPin'), setVisible: record('setVisible'), showAll: record('showAll'), navigableKeys: () => visible },
    };
    return { value, calls };
}

const EN = DATA_TABLE_LOCALES.en;
const LABELS: ContextMenuLabels = EN;
const NAME: ColumnDef<Row> = { accessorKey: 'name', header: 'Name' };
const labelsOf = (items: ContextMenuItem[]): string[] => items.map((i) => (i.type === 'separator' ? '---' : `${i.label}${i.disabled ? ' (off)' : ''}`));
const click = (items: ContextMenuItem[], label: string): void => {
    const item = items.find((i) => i.label === label);
    if (!item) throw new Error(`no item "${label}" in ${labelsOf(items).join(', ')}`);
    item.click?.(item);
};

describe('buildColumnMenuItems', () => {
    it('unsorted and unpinned: both sorts, no clear, both pins, no unpin, hide and show all', () => {
        expect(labelsOf(buildColumnMenuItems(NAME, services().value, LABELS))).toEqual([
            'Sort Ascending', 'Sort Descending', '---', 'Pin Left', 'Pin Right', '---', 'Hide Column', 'Show All Columns',
        ]);
    });

    it.each([
        ['asc', ['Sort Ascending (off)', 'Sort Descending', 'Clear Sort']],
        ['desc', ['Sort Ascending', 'Sort Descending (off)', 'Clear Sort']],
    ] as const)('sorted %s: the current direction is disabled and Clear Sort is offered', (sort, expected) => {
        expect(labelsOf(buildColumnMenuItems(NAME, services({ sort }).value, LABELS)).slice(0, 3)).toEqual(expected);
    });

    it('wires the sort items to changeSort, Clear Sort with null', () => {
        const { value, calls } = services({ sort: 'asc' });
        const items = buildColumnMenuItems(NAME, value, LABELS);
        click(items, 'Sort Descending');
        click(items, 'Clear Sort');
        expect(calls).toEqual([['changeSort', 'name', 'desc'], ['changeSort', 'name', null]]);
        const unsorted = services();
        click(buildColumnMenuItems(NAME, unsorted.value, LABELS), 'Sort Ascending');
        expect(unsorted.calls).toEqual([['changeSort', 'name', 'asc']]);
    });

    it.each([
        ['left', ['Pin Right', 'Unpin']],
        ['right', ['Pin Left', 'Unpin']],
    ] as const)('pinned %s: the other pin and Unpin', (pin, expected) => {
        const items = buildColumnMenuItems(NAME, services({ pin }).value, LABELS);
        expect(labelsOf(items).slice(3, 5)).toEqual(expected);
    });

    it('reads the definition pin when no runtime pin is set (Angular getColumnPin ?? col.pin)', () => {
        expect(labelsOf(buildColumnMenuItems({ ...NAME, pin: 'left' }, services().value, LABELS))).toContain('Unpin');
    });

    it('wires the pin items to setPin, Unpin with undefined', () => {
        const left = services({ pin: 'left' });
        const items = buildColumnMenuItems(NAME, left.value, LABELS);
        click(items, 'Pin Right');
        click(items, 'Unpin');
        expect(left.calls).toEqual([['setPin', 'name', 'right'], ['setPin', 'name', undefined]]);
        const none = services();
        click(buildColumnMenuItems(NAME, none.value, LABELS), 'Pin Left');
        expect(none.calls).toEqual([['setPin', 'name', 'left']]);
    });

    it('wires hide and show all', () => {
        const { value, calls } = services();
        const items = buildColumnMenuItems(NAME, value, LABELS);
        click(items, 'Hide Column');
        click(items, 'Show All Columns');
        expect(calls).toEqual([['setVisible', 'name', false], ['showAll']]);
    });

    it('omits the sort items for enableSorting: false and the hide item for enableHiding: false', () => {
        expect(labelsOf(buildColumnMenuItems({ ...NAME, enableSorting: false }, services().value, LABELS))).toEqual(['Pin Left', 'Pin Right', '---', 'Hide Column', 'Show All Columns']);
        expect(labelsOf(buildColumnMenuItems({ ...NAME, enableHiding: false }, services().value, LABELS))).not.toContain('Hide Column');
    });

    it('omits the hide item on the last visible data column (the table refuses it, wave 4 D12), not on another', () => {
        expect(labelsOf(buildColumnMenuItems(NAME, services({ visible: ['name'] }).value, LABELS))).not.toContain('Hide Column');
        expect(labelsOf(buildColumnMenuItems(NAME, services({ visible: ['name', 'age'] }).value, LABELS))).toContain('Hide Column');
    });

    it('takes its labels from the locale it is given', () => {
        const he = { ...LABELS, sortAscending: 'מיון עולה', pinLeft: 'הצמד לשמאל', showAllColumns: 'הצג הכל' };
        expect(labelsOf(buildColumnMenuItems(NAME, services().value, he))).toEqual(expect.arrayContaining(['מיון עולה', 'הצמד לשמאל', 'הצג הכל']));
    });
});

/** A host that records the slots registered on it; `root` is a bare EventTarget (the gestures are a browser test's). */
function fakeHost() {
    const cells = new Set<CellActionSlot>();
    const heads = new Set<HeaderActionSlot>();
    const root = new EventTarget() as unknown as HTMLElement;
    const listened = vi.spyOn(root, 'addEventListener');
    const host = {
        root,
        resolvedLocale: EN,
        subscribe: () => () => undefined,
        registerCellAction: (slot: CellActionSlot) => (cells.add(slot), () => cells.delete(slot)),
        registerHeaderAction: (slot: HeaderActionSlot) => (heads.add(slot), () => heads.delete(slot)),
        provider: () => undefined,
        requestRender: () => undefined,
        emit: () => undefined,
        announce: () => undefined,
        setBusy: () => undefined,
        expose: () => undefined,
    } as unknown as DataTableAddonHost;
    return { host, cells, heads, listened };
}

describe('the slots', () => {
    it('registers the row button for rowActions and the header button for columnMenu, each a menu button with the default label', () => {
        const { host, cells, heads } = fakeHost();
        const teardown = contextMenuAddon.setup(host, { rowActions: () => [], columnMenu: true });
        expect([...cells].map((s) => [s.id, s.haspopup, s.ariaLabel])).toEqual([['context-menu', 'menu', undefined]]);
        expect([...heads].map((s) => [s.id, s.haspopup, s.ariaLabel])).toEqual([['context-menu', 'menu', undefined]]);
        teardown?.();
        expect(cells.size + heads.size).toBe(0);
    });

    it('takes a label override from options.locale', () => {
        const { host, cells, heads } = fakeHost();
        contextMenuAddon.setup(host, { rowActions: () => [], columnMenu: true, locale: { rowActions: 'Acties', columnMenu: 'Menu {column}' } });
        expect([...cells][0]?.ariaLabel).toBe('Acties');
        expect([...heads][0]?.ariaLabel).toBe('Menu {column}');
    });

    it('registers no button and takes no gesture with neither rowActions nor menu (columnMenu alone adds only the header button)', () => {
        const none = fakeHost();
        contextMenuAddon.setup(none.host, {});
        expect(none.cells.size + none.heads.size).toBe(0);
        expect(none.listened).not.toHaveBeenCalled();
        const headerOnly = fakeHost();
        contextMenuAddon.setup(headerOnly.host, { columnMenu: true });
        expect([headerOnly.cells.size, headerOnly.heads.size]).toEqual([0, 1]);
        expect(headerOnly.listened).not.toHaveBeenCalled();
    });

    it('a bound menu alone takes the gestures but adds no button', () => {
        const { host, cells, heads, listened } = fakeHost();
        contextMenuAddon.setup(host, { menu: '#mine' });
        expect(cells.size + heads.size).toBe(0);
        expect(listened.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['contextmenu', 'touchstart', 'keydown']));
    });

    it('follows option changes: the row button goes when rowActions is cleared, the header button when columnMenu turns off', () => {
        const { host, cells, heads } = fakeHost();
        const set = new AddonSet(host, new Map());
        set.start();
        const rowActions = () => [];
        set.use(contextMenuAddon, { rowActions, columnMenu: true });
        expect([cells.size, heads.size]).toEqual([1, 1]);
        set.use(contextMenuAddon, { rowActions });
        expect([cells.size, heads.size]).toEqual([1, 0]);
        set.use(contextMenuAddon, { columnMenu: true });
        expect([cells.size, heads.size]).toEqual([0, 1]);
        set.stop();
        expect([cells.size, heads.size]).toEqual([0, 0]);
    });

    it('draws aria-expanded from its own state: false while no menu is open', () => {
        const { host, cells, heads } = fakeHost();
        contextMenuAddon.setup(host, { rowActions: () => [], columnMenu: true });
        expect([...cells][0]?.expanded?.({ row: { id: 'a' }, index: 0, selected: false })).toBe(false);
        expect([...heads][0]?.expanded?.({ accessorKey: 'name', header: 'Name' })).toBe(false);
    });
});

describe('rangeTakesHold (custom mode, decided at touchstart)', () => {
    const interaction = ({ range = true, editing = false, selected = false } = {}) => ({
        rangeSelectionEnabled: () => range,
        editingCell: () => (editing ? { rowIndex: 9, columnKey: 'x' } : null),
        isCellSelected: () => selected,
    });
    const cell = { rowIndex: 1, columnKey: 'name' };

    it.each([
        ['range on, unselected data cell', interaction(), cell, true],
        ['range on, selected data cell', interaction({ selected: true }), cell, false],
        ['range off', interaction({ range: false }), cell, false],
        ['an editor is open', interaction({ editing: true }), cell, false],
        ['a table-owned column (_selection)', interaction(), { rowIndex: 1, columnKey: '_selection' }, false],
        ['a table-owned column (_actions)', interaction(), { rowIndex: 1, columnKey: '_actions' }, false],
        ['no cell (a header, a row padding)', interaction(), null, false],
        ['no interaction service', undefined, cell, false],
    ] as const)('%s', (_, service, at, expected) => {
        expect(rangeTakesHold(service, at)).toBe(expected);
    });

    it('a service of the older shape (no rangeSelectionEnabled) never lets the range take the hold (the stub until wave 6)', () => {
        expect(rangeTakesHold({ isCellSelected: () => false }, cell)).toBe(false);
    });

    it('the answer is the one of the moment it is asked: a later selection of the cell does not change a decision taken before', () => {
        let selected = false;
        const live = { rangeSelectionEnabled: () => true, isCellSelected: () => selected };
        const atTouchStart = rangeTakesHold(live, cell);
        selected = true; // the range handler re-anchored onto the pressed cell before the hold fired
        expect(atTouchStart).toBe(true);
        expect(rangeTakesHold(live, cell)).toBe(false);
    });
});

describe('anchoring', () => {
    const rect = { left: 100, right: 160, bottom: 40 };

    it('keyboard: under the element at its inline start, the right edge in RTL', () => {
        expect(keyboardAnchor(rect, false)).toEqual({ x: 100, y: 40, alignEnd: false });
        expect(keyboardAnchor(rect, true)).toEqual({ x: 160, y: 40, alignEnd: true });
    });

    it('row button: bottom inline end (Angular bottom-right), mirrored in RTL', () => {
        expect(buttonAnchor(rect, 'row', false, { x: 1, y: 2 })).toEqual({ x: 160, y: 40, alignEnd: false });
        expect(buttonAnchor(rect, 'row', true, { x: 1, y: 2 })).toEqual({ x: 100, y: 40, alignEnd: true });
    });

    it('column button: bottom inline start (Angular bottom-left), mirrored in RTL', () => {
        expect(buttonAnchor(rect, 'column', false, { x: 1, y: 2 })).toEqual({ x: 100, y: 40, alignEnd: false });
        expect(buttonAnchor(rect, 'column', true, { x: 1, y: 2 })).toEqual({ x: 160, y: 40, alignEnd: true });
    });

    it('no button rect: the point the event carries, not (0, 0)', () => {
        expect(buttonAnchor(undefined, 'row', false, { x: 30, y: 50 })).toEqual({ x: 30, y: 50, alignEnd: false });
    });

    it('the left edge: the anchor itself, or the anchor minus the menu width when aligned at its end', () => {
        expect(anchorLeft({ x: 160, y: 0, alignEnd: false }, 120)).toBe(160);
        expect(anchorLeft({ x: 160, y: 0, alignEnd: true }, 120)).toBe(40);
    });

    it.each([
        [{ key: 'ContextMenu' }, true],
        [{ key: 'F10', shiftKey: true }, true],
        [{ key: 'F10' }, false],
        [{ key: 'F10', shiftKey: true, ctrlKey: true }, false],
        [{ key: 'ContextMenu', altKey: true }, false],
        [{ key: 'Enter' }, false],
    ])('isMenuKey(%j) = %s', (event, expected) => {
        expect(isMenuKey({ shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...event })).toBe(expected);
    });
});

describe('the DOM protocol', () => {
    it('uses the attribute names of the table (repeated: the addon may not import data-table-host.ts for real)', () => {
        expect(ROW_INDEX).toBe(DOM_PROTOCOL.rowIndex);
        expect(COLUMN).toBe(DOM_PROTOCOL.column);
        expect(ROW_SELECTOR).toBe(`[${DOM_PROTOCOL.rowIndex}]:not([${DOM_PROTOCOL.column}])`);
        expect(CELL_SELECTOR).toBe(`[${DOM_PROTOCOL.column}][${DOM_PROTOCOL.rowIndex}]`);
    });
});
