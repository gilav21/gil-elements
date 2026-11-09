import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { axProps, axTree, bodyRows, cellAt, makeColumns, makeRows, mountTable, q, roving, send, settle, type SampleRow } from './data-table-fixtures.js';
import { emulateTouch, frames, parkMouse, press, scrollGrid, touchDrag, touchTap, withRtl } from './data-table-input-fixtures.js';

beforeEach(() => parkMouse());
afterEach(async () => {
    await send('Emulation.setEmulatedMedia', { features: [] });
});

const viewportOf = (table: Element): HTMLElement => q(table, '[data-slot="data-table-viewport"]');

interface Mounted {
    table: GeDataTable<SampleRow>;
    before: HTMLButtonElement;
    after: HTMLButtonElement;
}

/** A table in a 600 x 400 box with a button on each side, so Tab can arrive and leave. */
async function mount(props: Record<string, unknown> = {}, columns = 4, rows = 30): Promise<Mounted> {
    const table = await mountTable<SampleRow>({ columns: makeColumns(columns), data: makeRows(rows, { columns }), showPagination: false, showToolbar: false, ...props }, {}, { width: 600, height: 400 });
    const frame = table.parentElement!;
    const tab = (): HTMLButtonElement => {
        const b = document.createElement('button');
        b.style.cssText = 'position:absolute;right:0;top:0;width:8px;height:8px;opacity:0';
        return b;
    };
    const before = tab();
    const after = tab();
    frame.prepend(before);
    frame.append(after);
    return { table, before, after };
}

const at = (table: GeDataTable<SampleRow>) => table.focusedCell;
const cellOf = (table: GeDataTable<SampleRow>, row: number, key: string): HTMLElement => cellAt(table, row, key)!;

describe('the roving tab stop', () => {
    it('Tab enters on the first cell, leaves without a trap, and Shift+Tab comes back to the same cell', async () => {
        const { table, before, after } = await mount();
        before.focus();
        await press('{Tab}');
        expect(document.activeElement).toBe(cellOf(table, 0, 'c0'));
        expect(roving(table)).toEqual([cellOf(table, 0, 'c0')]);
        await press('{ArrowDown}{ArrowDown}{ArrowRight}');
        expect(at(table)).toEqual({ rowIndex: 2, columnKey: 'c1' });
        await press('{Tab}');
        expect(document.activeElement).toBe(after);
        expect(roving(table)).toEqual([cellOf(table, 2, 'c1')]);
        await press('{Shift>}{Tab}{/Shift}');
        expect(document.activeElement).toBe(cellOf(table, 2, 'c1'));
        await press('{Shift>}{Tab}{/Shift}');
        // the header's own controls are tab stops before the first cell
        expect(document.activeElement!.closest('[data-slot="table-head"]')).not.toBeNull();
        void before;
    });

    it('exactly one element of the grid is tabbable at any time', async () => {
        const { table } = await mount();
        expect(roving(table)).toEqual([viewportOf(table)]);
        table.focusCell(3, 'c2');
        await settle(table);
        expect(roving(table)).toEqual([cellOf(table, 3, 'c2')]);
        expect(viewportOf(table).getAttribute('tabindex')).toBe('-1');
        await press('{ArrowDown}{ArrowDown}');
        expect(roving(table)).toEqual([cellOf(table, 5, 'c2')]);
    });

    it('stays one tab stop in a virtual grid scrolled far away from the focused row', async () => {
        const { table } = await mount({ enableVirtualScroll: true, virtualRowHeight: 40 }, 4, 5000);
        table.focusCell(10, 'c0');
        await settle(table);
        const stops: number[] = [];
        const observer = new MutationObserver(() => stops.push(roving(table).length));
        observer.observe(viewportOf(table), { attributes: true, attributeFilter: ['tabindex'], subtree: true });
        await scrollGrid(table, { top: 100000 });
        await settle(table);
        observer.disconnect();
        expect(roving(table).length).toBe(1);
        expect(stops.every((n) => n === 1)).toBe(true);
        expect(roving(table)[0]!.closest('[data-slot="table-row"]')!.hasAttribute('data-retained')).toBe(true);
    });

    it('a cell clicked with the mouse becomes the stop, and a click on the empty body clears it', async () => {
        const { table } = await mount({}, 4, 3);
        const cell = cellOf(table, 1, 'c1');
        const rect = cell.getBoundingClientRect();
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
        cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse', clientX: rect.left + 5, clientY: rect.top + 5 }));
        await settle(table);
        expect(at(table)).toEqual({ rowIndex: 1, columnKey: 'c1' });
        expect(document.activeElement).toBe(cell);
        const stretch = q(table, '[data-kind="spacer"]');
        stretch.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
        await settle(table);
        expect(at(table)).toBeNull();
        expect(roving(table)).toEqual([viewportOf(table)]);
    });
});

describe('moving with the keyboard', () => {
    it('arrows move one cell and stop at the edges', async () => {
        const { table } = await mount({}, 3, 4);
        table.focusCell(0, 'c0');
        await settle(table);
        await press('{ArrowUp}{ArrowLeft}');
        expect(at(table)).toEqual({ rowIndex: 0, columnKey: 'c0' });
        await press('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowDown}');
        expect(at(table)).toEqual({ rowIndex: 1, columnKey: 'c2' });
        expect(document.activeElement).toBe(cellOf(table, 1, 'c2'));
        await press('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
        expect(at(table)).toEqual({ rowIndex: 3, columnKey: 'c2' });
    });

    it('Left and Right swap in right-to-left', async () => {
        const { table } = await mount({}, 3, 4);
        await withRtl(table);
        table.focusCell(0, 'c0');
        await settle(table);
        await press('{ArrowLeft}');
        expect(at(table)!.columnKey).toBe('c1');
        await press('{ArrowRight}{ArrowRight}');
        expect(at(table)!.columnKey).toBe('c0');
    });

    it('Home, End, Ctrl+Home and Ctrl+End', async () => {
        const { table } = await mount({}, 4, 30);
        table.focusCell(5, 'c1');
        await settle(table);
        await press('{End}');
        expect(at(table)).toEqual({ rowIndex: 5, columnKey: 'c3' });
        await press('{Home}');
        expect(at(table)).toEqual({ rowIndex: 5, columnKey: 'c0' });
        await press('{Control>}{End}{/Control}');
        expect(at(table)).toEqual({ rowIndex: 29, columnKey: 'c3' });
        await press('{Control>}{Home}{/Control}');
        expect(at(table)).toEqual({ rowIndex: 0, columnKey: 'c0' });
    });

    it('PageDown moves by the rows that fit the viewport, and every move keeps the cell in view', async () => {
        const { table } = await mount({}, 4, 100);
        table.focusCell(0, 'c0');
        await settle(table);
        const view = viewportOf(table);
        const head = q(table, '[data-slot="table-header"]').getBoundingClientRect().height;
        const rowHeight = bodyRows(table)[0]!.getBoundingClientRect().height;
        const page = Math.floor((view.clientHeight - head) / rowHeight);
        await press('{PageDown}');
        expect(at(table)!.rowIndex).toBe(page);
        for (const key of ['{PageDown}', '{PageDown}', '{ArrowDown}', '{PageUp}', '{ArrowUp}']) {
            await press(key);
            await frames(1);
            const cell = cellOf(table, at(table)!.rowIndex, 'c0').getBoundingClientRect();
            const box = view.getBoundingClientRect();
            const header = q(table, '[data-slot="table-header"]').getBoundingClientRect();
            expect(cell.top).toBeGreaterThanOrEqual(header.bottom - 1);
            expect(cell.bottom).toBeLessThanOrEqual(box.bottom + 1);
        }
    });

    it('a cell is never left under the pinned column when moving sideways', async () => {
        const { table } = await mount({}, 12, 5);
        const cols = makeColumns(12, { pinLeft: 1 });
        table.columns = cols;
        await settle(table);
        table.focusCell(0, 'c0');
        await settle(table);
        for (let i = 0; i < 9; i++) await press('{ArrowRight}');
        await frames(1);
        const pinned = cellOf(table, 0, 'c0').getBoundingClientRect();
        const cell = cellOf(table, 0, at(table)!.columnKey).getBoundingClientRect();
        expect(cell.left).toBeGreaterThanOrEqual(pinned.right - 1);
        expect(cell.right).toBeLessThanOrEqual(viewportOf(table).getBoundingClientRect().right + 1);
    });

    it('arrows skip disabled rows, and PageDown can land on one', async () => {
        const { table } = await mount({ disabledRowIds: ['r2', 'r3', 'r8'] }, 3, 30);
        table.focusCell(1, 'c0');
        await settle(table);
        await press('{ArrowDown}');
        expect(at(table)!.rowIndex).toBe(4);
        await press('{ArrowUp}');
        expect(at(table)!.rowIndex).toBe(1);
        table.focusCell(0, 'c0');
        await settle(table);
        const view = viewportOf(table);
        const head = q(table, '[data-slot="table-header"]').getBoundingClientRect().height;
        const page = Math.floor((view.clientHeight - head) / bodyRows(table)[0]!.getBoundingClientRect().height);
        expect(page).toBeGreaterThan(3);
        await press('{PageDown}');
        expect(at(table)!.rowIndex).toBe(page);
    });

    it('ignores keys typed into an input and keys with Alt', async () => {
        const { table } = await mount({}, 3, 4);
        table.focusCell(1, 'c1');
        await settle(table);
        await press('{Alt>}{ArrowDown}{/Alt}');
        expect(at(table)).toEqual({ rowIndex: 1, columnKey: 'c1' });
        const input = document.createElement('input');
        cellOf(table, 1, 'c1').append(input);
        input.focus();
        await press('{ArrowDown}');
        expect(at(table)).toEqual({ rowIndex: 1, columnKey: 'c1' });
    });
});

describe('focus follows the data', () => {
    it('stays at the same screen position after a sort, with DOM focus on the cell there', async () => {
        const { table } = await mount({}, 4, 12);
        table.focusCell(2, 'c0');
        await settle(table);
        table.sortState = { column: 'age', direction: 'desc' } as never;
        table.requestUpdate();
        await settle(table);
        await frames(2);
        expect(at(table)).toEqual({ rowIndex: 2, columnKey: 'c0' });
        expect(document.activeElement).toBe(cellOf(table, 2, 'c0'));
        expect(roving(table)).toEqual([cellOf(table, 2, 'c0')]);
    });

    it('survives an empty list while a page loads, and is clamped when the list shrinks', async () => {
        const { table } = await mount({}, 3, 10);
        table.focusCell(7, 'c1');
        await settle(table);
        table.data = [];
        await settle(table);
        expect(at(table)).toEqual({ rowIndex: 7, columnKey: 'c1' });
        table.data = makeRows(10, { columns: 3 });
        await settle(table);
        expect(at(table)).toEqual({ rowIndex: 7, columnKey: 'c1' });
        expect(document.activeElement).toBe(cellOf(table, 7, 'c1'));
        table.data = makeRows(4, { columns: 3 });
        await settle(table);
        await frames(2);
        expect(at(table)).toEqual({ rowIndex: 3, columnKey: 'c1' });
        expect(document.activeElement).toBe(cellOf(table, 3, 'c1'));
    });

    it('follows a hidden column to the nearest one', async () => {
        const { table } = await mount({}, 4, 4);
        table.focusCell(1, 'c1');
        await settle(table);
        table.columnVisibility = { c1: false };
        await settle(table);
        await frames(2);
        expect(at(table)!.columnKey).toBe('c2');
    });
});

describe('groups and the drawn order', () => {
    it('ArrowDown crosses a group header, and Ctrl+End is the last drawn row of a collapsed last group', async () => {
        const { table } = await mount({ groupBy: 'group', data: makeRows(6, { columns: 3, groups: 3 }), collapsedGroups: { g2: true } }, 3, 6);
        const drawn = bodyRows(table).length;
        expect(drawn).toBe(4);
        table.focusCell(1, 'c0');
        await settle(table);
        await press('{ArrowDown}');
        expect(at(table)!.rowIndex).toBe(2);
        await press('{Control>}{End}{/Control}');
        expect(at(table)!.rowIndex).toBe(drawn - 1);
    });
});

describe('what assistive technology sees', () => {
    it('lists the focused cell as a focused gridcell in its row', async () => {
        const { table } = await mount({}, 3, 5);
        table.focusCell(2, 'c1');
        await settle(table);
        const nodes = await axTree();
        const focused = nodes.filter((n) => axProps(n)['focused'] === true);
        expect(focused.map((n) => n.role?.value)).toContain('gridcell');
        expect(cellOf(table, 2, 'c1').closest('[data-slot="table-row"]')!.getAttribute('aria-rowindex')).toBe('4');
    });
});

describe('touch and forced colours', () => {
    it('a tap focuses a cell, a vertical swipe scrolls without focusing', async () => {
        const { table } = await mount({}, 4, 60);
        await emulateTouch(true);
        await touchDrag(cellOf(table, 3, 'c1'), { dx: 0, dy: -150 });
        await frames(2);
        expect(viewportOf(table).scrollTop).toBeGreaterThan(20);
        expect(at(table)).toBeNull();
        await touchTap(cellOf(table, 8, 'c1'));
        await settle(table);
        expect(at(table)!.columnKey).toBe('c1');
        expect(document.activeElement).toBe(cellOf(table, at(table)!.rowIndex, 'c1'));
    });

    it('draws the focus ring as an outline in forced-colors mode', async () => {
        const { table } = await mount({}, 3, 5);
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
        table.focusCell(1, 'c1');
        await settle(table);
        const style = getComputedStyle(cellOf(table, 1, 'c1'));
        expect(style.outlineStyle).toBe('solid');
        expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
    });
});

describe('listeners', () => {
    it('leaves none behind on the document or the window after remove()', async () => {
        const added: [string, EventListenerOrEventListenerObject][] = [];
        const targets = [document, window] as const;
        const originals = targets.map((t) => [t.addEventListener, t.removeEventListener] as const);
        targets.forEach((t) => {
            const add = t.addEventListener.bind(t);
            const remove = t.removeEventListener.bind(t);
            t.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: unknown) => {
                added.push([type, fn]);
                add(type, fn, o as never);
            }) as never;
            t.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, o?: unknown) => {
                const i = added.findIndex(([t2, f]) => t2 === type && f === fn);
                if (i !== -1) added.splice(i, 1);
                remove(type, fn, o as never);
            }) as never;
        });
        try {
            const { table } = await mount({}, 3, 5);
            table.focusCell(1, 'c1');
            await settle(table);
            table.parentElement!.remove();
            await frames(2);
        } finally {
            targets.forEach((t, i) => {
                t.addEventListener = originals[i]![0] as never;
                t.removeEventListener = originals[i]![1] as never;
            });
        }
        expect(added.map(([type]) => type)).toEqual([]);
    });
});
