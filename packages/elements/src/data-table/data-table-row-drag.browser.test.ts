import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { makeRows, mountTable, q, qa, type SampleRow, send, settle } from './data-table-fixtures.js';
import { emulateTouch, nativeDrag, parkMouse, press, scrollGrid, syntheticDrag } from './data-table-input-fixtures.js';
import type { RowReorderEvent } from './data-table.types.js';

type Table = GeDataTable<SampleRow>;

afterEach(async () => {
    await parkMouse();
    await emulateTouch(false);
    await send('Emulation.setEmulatedMedia', { features: [] });
});

const VIEWPORT = '[data-slot="data-table-viewport"]';
const rowEl = (t: Element, i: number): HTMLElement => q(t, `[data-slot="table-body"] > [data-slot="table-row"][data-kind="data"][data-row-index="${i}"]`);
const rowById = (t: Element, id: string): HTMLElement | null => t.querySelector<HTMLElement>(`[data-slot="table-row"][data-kind="data"][data-row-id="${id}"]`);
const cellOf = (row: Element): HTMLElement => row.querySelector<HTMLElement>('[data-slot="table-cell"][data-column="name"]')!;
const edge = (t: Element): HTMLElement | null => t.querySelector<HTMLElement>('[data-slot="data-table-drop-edge"]');
const ids = (t: Table): string[] => (t.data as SampleRow[]).map((r) => r.id);
const at = (row: Element, rel: number): { x: number; y: number } => {
    const r = row.getBoundingClientRect();
    return { x: r.left + 20, y: r.top + r.height * rel };
};

/** A table with row drag on, once its lazy drag part handles drags (rows draggable). */
async function mountDrag(props: Record<string, unknown> = {}, box?: { width: number; height: number }): Promise<Table> {
    const table = (await mountTable<SampleRow>({ enableRowDrag: true, data: makeRows(6), ...props }, {}, box)) as Table;
    await vi.waitFor(() => expect(table.provider('rowDrag')?.active()).toBe(true));
    await settle(table);
    return table;
}

function record(table: Table) {
    const reorders: RowReorderEvent<SampleRow>[] = [];
    let dataChanges = 0;
    table.addEventListener('row-reorder', (e) => reorders.push((e as CustomEvent<RowReorderEvent<SampleRow>>).detail));
    table.addEventListener('data-change', () => dataChanges++);
    return { reorders, dataChanges: () => dataChanges };
}

/** dragstart on row `from`, a dragover at `rel` of row `to` (held: a synthetic drag can be paused there); returns whether the target accepted it. */
async function dragOver(table: Table, from: number, to: number, rel: number): Promise<boolean> {
    syntheticDrag(cellOf(rowEl(table, from)), 'dragstart');
    await settle(table);
    const over = syntheticDrag(cellOf(rowEl(table, to)), 'dragover', at(rowEl(table, to), rel));
    await settle(table);
    return over.defaultPrevented;
}

/** The rest of a synthetic drag: the drop on row `to` at `rel`, then the dragend. */
async function drop(table: Table, to: number, rel: number): Promise<void> {
    syntheticDrag(cellOf(rowEl(table, to)), 'drop', at(rowEl(table, to), rel));
    syntheticDrag(q(table, VIEWPORT), 'dragend');
    await settle(table);
}

describe('row drag: flat drop', () => {
    it('a real (native) drag of row 1 onto row 4 reorders data, fires row-reorder once and one data-change', async () => {
        const table = await mountDrag();
        const seen = record(table);
        expect(rowEl(table, 0).getAttribute('draggable')).toBe('true');
        await nativeDrag(cellOf(rowEl(table, 0)), cellOf(rowEl(table, 3)));
        await settle(table);
        expect(seen.reorders).toHaveLength(1);
        // The drop is at the target's centre: by a pixel it reads as the upper or the lower half.
        const e = seen.reorders[0]!;
        expect(e).toMatchObject(e.position === 'above' ? { fromIndex: 0, toIndex: 2, previousId: 'r2', nextId: 'r3' } : { fromIndex: 0, toIndex: 3, previousId: 'r3', nextId: 'r4' });
        expect(ids(table)[e.toIndex]).toBe('r0');
        expect(seen.dataChanges()).toBe(1);
        expect(edge(table)).toBeNull();
        expect(table.querySelector('[data-dragging]')).toBeNull();
    });

    it('a synthetic drag into the upper half drops above, and the announcement says where', async () => {
        const table = await mountDrag();
        const seen = record(table);
        expect(await dragOver(table, 4, 1, 0.2)).toBe(true);
        expect(edge(table)?.dataset['edge']).toBe('top');
        expect(rowEl(table, 1).hasAttribute('data-drop-target')).toBe(true);
        expect(rowEl(table, 4).hasAttribute('data-dragging')).toBe(true);
        await drop(table, 1, 0.2);
        expect(seen.reorders[0]).toMatchObject({ fromIndex: 4, toIndex: 1, position: 'above', previousId: 'r0', nextId: 'r1' });
        expect(ids(table)).toEqual(['r0', 'r4', 'r1', 'r2', 'r3', 'r5']);
        expect(q(table, '[data-slot="data-table-announcer"]').textContent).toContain('Row moved to position 2 of 6');
    });

    it('localReorder off leaves data alone and still fires row-reorder', async () => {
        const table = await mountDrag({ localReorder: false });
        const seen = record(table);
        await dragOver(table, 0, 3, 0.8);
        await drop(table, 3, 0.8);
        expect(seen.reorders).toHaveLength(1);
        expect(ids(table)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
        expect(seen.dataChanges()).toBe(0);
    });

    it('a drop where the row already is fires nothing', async () => {
        const table = await mountDrag();
        const seen = record(table);
        await dragOver(table, 2, 2, 0.8);
        await drop(table, 2, 0.8);
        await dragOver(table, 2, 1, 0.8); // below the row above it: the same place
        await drop(table, 1, 0.8);
        expect(seen.reorders).toHaveLength(0);
        expect(seen.dataChanges()).toBe(0);
    });

    it('below the last row of a short table the drop lands after the last row (Angular container drag over)', async () => {
        const table = await mountDrag({}, { width: 600, height: 600 });
        const seen = record(table);
        syntheticDrag(cellOf(rowEl(table, 0)), 'dragstart');
        const last = rowEl(table, 5).getBoundingClientRect();
        const viewport = q(table, VIEWPORT);
        const over = syntheticDrag(viewport, 'dragover', { x: last.left + 20, y: last.bottom + 20 });
        await settle(table);
        expect(over.defaultPrevented).toBe(true);
        expect(edge(table)?.dataset['edge']).toBe('bottom');
        syntheticDrag(viewport, 'drop', { x: last.left + 20, y: last.bottom + 20 });
        syntheticDrag(viewport, 'dragend');
        await settle(table);
        expect(seen.reorders[0]).toMatchObject({ fromIndex: 0, toIndex: 5, nextId: null });
        expect(ids(table).at(-1)).toBe('r0');
    });

    it('a disabled row is not draggable and cannot be a target; loading blocks the start', async () => {
        const table = await mountDrag({ disabledRowIds: ['r2'] });
        expect(rowEl(table, 2).hasAttribute('draggable')).toBe(false);
        expect(syntheticDrag(cellOf(rowEl(table, 2)), 'dragstart').defaultPrevented).toBe(true);
        expect(await dragOver(table, 0, 2, 0.8)).toBe(false);
        expect(edge(table)).toBeNull();
        syntheticDrag(q(table, VIEWPORT), 'dragend');

        table.loading = true;
        await settle(table);
        const row = table.querySelector<HTMLElement>('[data-slot="table-row"][data-kind="data"]');
        if (row) {
            expect(row.hasAttribute('draggable')).toBe(false);
            expect(syntheticDrag(row, 'dragstart').defaultPrevented).toBe(true);
        }
        expect(table.provider('rowDrag')?.isDragging()).toBe(false);
    });

    it('rowDragAllowDrop false: no indicator, no drop; one that throws is a veto, reported once', async () => {
        const table = await mountDrag({ rowDragAllowDrop: (_d: SampleRow, target: SampleRow) => target.id !== 'r3' });
        const seen = record(table);
        expect(await dragOver(table, 0, 3, 0.8)).toBe(false);
        expect(edge(table)).toBeNull();
        await drop(table, 3, 0.8);
        expect(seen.reorders).toHaveLength(0);

        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        table.rowDragAllowDrop = () => {
            throw new Error('boom');
        };
        await settle(table);
        expect(await dragOver(table, 0, 4, 0.8)).toBe(false);
        expect(await dragOver(table, 0, 4, 0.8)).toBe(false);
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
        syntheticDrag(q(table, VIEWPORT), 'dragend');
    });
});

describe('row drag: indicators and cleanup', () => {
    it('flat halves draw a 2px line on the top or bottom edge; the dragged row is ghosted', async () => {
        const table = await mountDrag();
        await dragOver(table, 0, 2, 0.25);
        const top = edge(table)!;
        expect(top.dataset['edge']).toBe('top');
        expect(top.getAttribute('aria-hidden')).toBe('true');
        const style = getComputedStyle(top);
        expect(style.height).toBe('2px');
        expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(style.boxShadow).not.toBe('none');
        expect(Math.abs(top.getBoundingClientRect().top - rowEl(table, 2).getBoundingClientRect().top)).toBeLessThanOrEqual(1);
        expect(getComputedStyle(rowEl(table, 0)).opacity).toBe('0.3');
        syntheticDrag(cellOf(rowEl(table, 2)), 'dragover', at(rowEl(table, 2), 0.75));
        await settle(table);
        expect(edge(table)?.dataset['edge']).toBe('bottom');
        syntheticDrag(q(table, VIEWPORT), 'dragend');
        await settle(table);
        expect(edge(table)).toBeNull();
        expect(table.querySelector('[data-dragging]')).toBeNull();
        expect(table.provider('rowDrag')?.dragState()).toBeNull();
    });

    it('Escape ends a held drag (no stuck state), and no page wheel event is ever taken (no wheel listener: AB5)', async () => {
        const table = await mountDrag();
        await dragOver(table, 0, 2, 0.75);
        const during = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
        document.body.dispatchEvent(during);
        expect(during.defaultPrevented).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle(table);
        expect(edge(table)).toBeNull();
        expect(table.provider('rowDrag')?.isDragging()).toBe(false);
        const after = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
        document.body.dispatchEvent(after);
        expect(after.defaultPrevented).toBe(false);
        // a dragover after the drag ended is not accepted
        expect(syntheticDrag(cellOf(rowEl(table, 3)), 'dragover', at(rowEl(table, 3), 0.75)).defaultPrevented).toBe(false);
    });

    it('a drag from another table is ignored', async () => {
        const one = await mountDrag();
        const two = await mountDrag();
        const seen = record(two);
        syntheticDrag(cellOf(rowEl(one, 0)), 'dragstart');
        const over = syntheticDrag(cellOf(rowEl(two, 2)), 'dragover', at(rowEl(two, 2), 0.75));
        expect(over.defaultPrevented).toBe(false);
        syntheticDrag(cellOf(rowEl(two, 2)), 'drop', at(rowEl(two, 2), 0.75));
        syntheticDrag(q(one, VIEWPORT), 'dragend');
        await settle(two);
        expect(seen.reorders).toHaveLength(0);
    });

    it('the grid carries the keyboard hint once, and turning the flag off takes it and the drag away', async () => {
        const table = await mountDrag();
        const grid = q(table, '[data-slot="table"]');
        await vi.waitFor(() => expect(grid.getAttribute('aria-description')).toBe('Alt+Up or Alt+Down arrow moves the focused row'));
        await dragOver(table, 0, 2, 0.75);
        table.enableRowDrag = false;
        await settle(table);
        expect(grid.hasAttribute('aria-description')).toBe(false);
        expect(edge(table)).toBeNull();
        expect(rowEl(table, 0).hasAttribute('draggable')).toBe(false);
    });

    it('leaves no listener on the document or window after a drag, after the flag goes off and after it is removed', async () => {
        const live = new Map<EventListenerOrEventListenerObject, string>();
        const patched = [document, window].map((target) => {
            const { addEventListener: add, removeEventListener: remove } = target;
            target.addEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
                live.set(fn, type);
                add.call(this, type, fn, options);
            } as typeof add;
            target.removeEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
                live.delete(fn);
                remove.call(this, type, fn, options);
            } as typeof remove;
            return () => {
                target.addEventListener = add;
                target.removeEventListener = remove;
            };
        });
        try {
            const table = await mountDrag();
            const idle = [...live.values()].sort();
            await dragOver(table, 0, 2, 0.75);
            expect([...live.values()]).toEqual(expect.arrayContaining(['dragover', 'keydown', 'blur']));
            table.enableRowDrag = false;
            await settle(table);
            expect([...live.values()].sort()).toEqual(idle); // what the drag added is gone; the table's own listeners stay
            table.enableRowDrag = true;
            await vi.waitFor(() => expect(table.provider('rowDrag')?.active()).toBe(true));
            await dragOver(table, 0, 2, 0.75);
            table.remove();
            await table.updateComplete;
        } finally {
            patched.forEach((restore) => restore());
        }
        expect([...live.values()]).toEqual([]);
    });
});

interface TreeNode extends SampleRow {
    children?: TreeNode[];
}
const node = (id: string, children?: TreeNode[]): TreeNode => ({ id, name: id, age: 1, ...(children ? { children } : {}) });
/** Drawn (all open): a 0, a1 1, a1x 2, a1y 3, a2 4, b 5, b1 6, c 7. */
const TREE = (): TreeNode[] => [node('a', [node('a1', [node('a1x'), node('a1y')]), node('a2')]), node('b', [node('b1')]), node('c')];
const mountTree = (props: Record<string, unknown> = {}): Promise<Table> => mountDrag({ data: TREE(), enableSubRows: true, subRowDefaultExpanded: true, rowDragMode: 'tree', ...props });
const kids = (t: Table, ...path: string[]): string[] => {
    let level = t.data as TreeNode[];
    for (const id of path) level = level.find((n) => n.id === id)?.children ?? [];
    return level.map((n) => n.id);
};

describe('row drag: tree', () => {
    it('quarters: top, on (a frame), bottom', async () => {
        const table = await mountTree();
        await dragOver(table, 7, 4, 0.1);
        expect(edge(table)?.dataset['edge']).toBe('top');
        syntheticDrag(cellOf(rowEl(table, 4)), 'dragover', at(rowEl(table, 4), 0.5));
        await settle(table);
        const on = edge(table)!;
        expect(on.dataset['edge']).toBe('on');
        expect(getComputedStyle(on).borderTopWidth).toBe('2px');
        syntheticDrag(cellOf(rowEl(table, 4)), 'dragover', at(rowEl(table, 4), 0.9));
        await settle(table);
        expect(edge(table)?.dataset['edge']).toBe('bottom');
        syntheticDrag(q(table, VIEWPORT), 'dragend');
    });

    it('a drop "on" makes a child (parentId); above / below move among siblings three levels deep', async () => {
        const table = await mountTree();
        const seen = record(table);
        await dragOver(table, 5, 4, 0.5); // b on a2
        await drop(table, 4, 0.5);
        expect(seen.reorders[0]).toMatchObject({ position: 'on', parentId: 'a2' });
        expect(kids(table, 'a', 'a2')).toEqual(['b']);
        expect(kids(table)).toEqual(['a', 'c']);

        const again = await mountTree();
        await dragOver(again, 7, 1, 0.1); // c above a1
        await drop(again, 1, 0.1);
        expect(kids(again, 'a')).toEqual(['c', 'a1', 'a2']);

        const third = await mountTree();
        await dragOver(third, 2, 6, 0.9); // a1x below b1
        await drop(third, 6, 0.9);
        expect(kids(third, 'a', 'a1')).toEqual(['a1y']);
        expect(kids(third, 'b')).toEqual(['b1', 'a1x']);
    });

    it('refuses a drop onto the node itself or one of its descendants: nothing is lost (AB7)', async () => {
        const table = await mountTree();
        const seen = record(table);
        const before = table.data;
        for (const [target, rel] of [[0, 0.5], [1, 0.5], [2, 0.5], [3, 0.9], [4, 0.1]] as const) {
            expect(await dragOver(table, 0, target, rel)).toBe(false);
            expect(edge(table)).toBeNull();
            await drop(table, target, rel);
        }
        expect(seen.reorders).toHaveLength(0);
        expect(table.data).toBe(before);
        // and through the public reorderData, which a consumer may call with any event
        const data = table.data as TreeNode[];
        const a = data[0]!;
        expect(table.reorderData(data, { row: a, targetRow: a.children![0]!.children![0]!, position: 'on', previousId: null, nextId: null, fromIndex: 0, toIndex: 2 })).toBe(data);
    });

    it('a flat drag in a tree table is refused across depths and never nests', async () => {
        const table = await mountTree({ rowDragMode: 'flat' });
        const seen = record(table);
        expect(await dragOver(table, 0, 1, 0.8)).toBe(false); // a (depth 0) over a1 (depth 1)
        expect(edge(table)).toBeNull();
        syntheticDrag(q(table, VIEWPORT), 'dragend');
        expect(await dragOver(table, 7, 5, 0.6)).toBe(true); // c over b, where tree mode would nest: below, not on
        expect(edge(table)?.dataset['edge']).toBe('bottom');
        await drop(table, 5, 0.6);
        expect(seen.reorders[0]?.position).toBe('below');
        expect(kids(table)).toEqual(['a', 'b', 'c']);
    });
});

describe('row drag: virtual scroll', () => {
    it('keeps the dragged row drawn after a scroll away, auto-scrolls near the top edge, and lands on the right row', async () => {
        const table = await mountDrag({ data: makeRows(10_000), enableVirtualScroll: true }, { width: 600, height: 400 });
        const seen = record(table);
        const viewport = q(table, VIEWPORT);
        await scrollGrid(viewport, { top: 200 });
        const first = Number(qa(table, '[data-slot="table-body"] > [data-kind="data"]:not([data-retained])')[0]!.dataset['rowIndex']);
        syntheticDrag(cellOf(rowEl(table, first + 2)), 'dragstart');
        await settle(table);
        await scrollGrid(viewport, { top: 6000 });
        const dragged = rowById(table, `r${first + 2}`);
        expect(dragged).not.toBeNull();
        expect(dragged!.hasAttribute('data-retained')).toBe(true);

        const box = viewport.getBoundingClientRect();
        const top = viewport.scrollTop;
        const end = performance.now() + 300;
        while (performance.now() < end) {
            syntheticDrag(viewport, 'dragover', { x: box.left + 100, y: box.top + 10 });
            await new Promise((r) => setTimeout(r, 30));
        }
        expect(viewport.scrollTop).toBeLessThan(top);
        syntheticDrag(viewport, 'dragover', { x: box.left + 100, y: box.top + box.height / 2 }); // away from the edge: the scrolling stops
        await settle(table);
        await new Promise((r) => setTimeout(r, 50));
        const target = qa(table, '[data-slot="table-body"] > [data-kind="data"]:not([data-retained])')[3]!;
        const to = Number(target.dataset['rowIndex']);
        syntheticDrag(cellOf(target), 'dragover', at(target, 0.75));
        syntheticDrag(cellOf(target), 'drop', at(target, 0.75));
        syntheticDrag(viewport, 'dragend');
        await settle(table);
        expect(seen.reorders[0]).toMatchObject({ fromIndex: first + 2, toIndex: to });
        expect(ids(table)[to]).toBe(`r${first + 2}`);
        expect(table.querySelector('[data-retained][data-dragging]')).toBeNull();
    });

    it('a dragend after the window moved still clears the state', async () => {
        const table = await mountDrag({ data: makeRows(10_000), enableVirtualScroll: true }, { width: 600, height: 400 });
        syntheticDrag(cellOf(rowEl(table, 1)), 'dragstart');
        await settle(table);
        await scrollGrid(q(table, VIEWPORT), { top: 8000 });
        rowById(table, 'r1')!.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
        await settle(table);
        expect(table.provider('rowDrag')?.isDragging()).toBe(false);
        expect(rowById(table, 'r1')).toBeNull(); // released: no longer retained
    });
});

describe('row drag: touch', () => {
    it('a dragstart that follows a touch press is cancelled; one after a mouse press is not', async () => {
        const table = await mountDrag();
        const cell = cellOf(rowEl(table, 1));
        const { x, y } = at(rowEl(table, 1), 0.5);
        const pointer = (type: string, pointerType: string): boolean => cell.dispatchEvent(new PointerEvent(type, { pointerType, pointerId: 7, isPrimary: true, bubbles: true, composed: true, clientX: x, clientY: y }));
        pointer('pointerdown', 'touch');
        expect(syntheticDrag(cell, 'dragstart').defaultPrevented).toBe(true);
        pointer('pointerup', 'touch');
        pointer('pointerdown', 'mouse');
        expect(syntheticDrag(cell, 'dragstart').defaultPrevented).toBe(false);
        pointer('pointerup', 'mouse');
        syntheticDrag(q(table, VIEWPORT), 'dragend');
    });
});

describe('row drag: keyboard (Alt+ArrowUp / Alt+ArrowDown) and moveRow', () => {
    const focus = async (table: Table, row: number): Promise<void> => {
        table.provider('interaction')!.focusCell(row, 'name');
        await settle(table);
    };

    it('moves the focused row, the focus follows, and the move is announced', async () => {
        const table = await mountDrag();
        const seen = record(table);
        await focus(table, 1);
        await press('{Alt>}{ArrowDown}{/Alt}');
        await settle(table);
        expect(ids(table)).toEqual(['r0', 'r2', 'r1', 'r3', 'r4', 'r5']);
        expect(seen.reorders[0]).toMatchObject({ fromIndex: 1, toIndex: 2, position: 'below' });
        await vi.waitFor(() => expect(document.activeElement).toBe(cellOf(rowEl(table, 2))));
        expect(q(table, '[data-slot="data-table-announcer"]').textContent).toContain('Row moved to position 3 of 6');
        await press('{Alt>}{ArrowUp}{/Alt}');
        await settle(table);
        expect(ids(table)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4', 'r5']);
        await vi.waitFor(() => expect(document.activeElement).toBe(cellOf(rowEl(table, 1))));
    });

    it('is a no-op at the ends, skips disabled rows and honours the veto', async () => {
        const table = await mountDrag({ disabledRowIds: ['r2'] });
        const seen = record(table);
        await focus(table, 0);
        await press('{Alt>}{ArrowUp}{/Alt}');
        expect(seen.reorders).toHaveLength(0);
        await focus(table, 1);
        await press('{Alt>}{ArrowDown}{/Alt}');
        await settle(table);
        expect(ids(table)).toEqual(['r0', 'r2', 'r3', 'r1', 'r4', 'r5']);
        table.rowDragAllowDrop = () => false;
        await settle(table);
        await focus(table, 0);
        await press('{Alt>}{ArrowDown}{/Alt}');
        expect(seen.reorders).toHaveLength(1);
        // without Alt the arrow is plain navigation (it steps over the disabled r2 at index 1)
        await press('{ArrowDown}');
        expect(document.activeElement).toBe(cellOf(rowEl(table, 2)));
        expect(seen.reorders).toHaveLength(1);
    });

    it('tree: only among siblings', async () => {
        const table = await mountTree();
        await focus(table, 4); // a2
        await press('{Alt>}{ArrowUp}{/Alt}');
        await settle(table);
        expect(kids(table, 'a')).toEqual(['a2', 'a1']);
        await focus(table, 1); // now a2 again is at 1; a1x / a1y are deeper
        await press('{Alt>}{ArrowUp}{/Alt}');
        expect(kids(table, 'a')).toEqual(['a2', 'a1']);
    });

    it('moveRow() does the same, and is false when nothing moved or the table is detached', async () => {
        const table = await mountDrag();
        const rows = table.data as SampleRow[];
        expect(table.moveRow(rows[0]!, 'down')).toBe(true);
        await settle(table);
        expect(ids(table)).toEqual(['r1', 'r0', 'r2', 'r3', 'r4', 'r5']);
        expect(table.moveRow((table.data as SampleRow[])[0]!, 'up')).toBe(false);
        table.remove();
        expect(table.moveRow((table.data as SampleRow[])[2]!, 'up')).toBe(false);
        // reorderData is pure and works while detached
        const moved = table.reorderData(table.data as SampleRow[], { row: rows[5]!, targetRow: rows[0]!, position: 'above', previousId: null, nextId: 'r1', fromIndex: 5, toIndex: 0 });
        expect(moved.map((r) => r.id)).toEqual(['r5', 'r1', 'r0', 'r2', 'r3', 'r4']);
    });
});

describe('cell flash', () => {
    const flashOf = (t: Element, id: string, key: string): string | null => t.querySelector(`[data-row-id="${id}"] [data-column="${key}"]`)?.getAttribute('data-flash') ?? null;
    const update = async (table: Table, change: (rows: SampleRow[]) => void): Promise<void> => {
        const next = structuredClone(table.data as SampleRow[]);
        change(next);
        table.data = next;
        await settle(table);
    };

    it('marks up / down / changed on exactly the changed cells and clears them after cell-flash-duration', async () => {
        const table = (await mountTable<SampleRow>({ data: makeRows(5), enableCellFlash: true, cellFlashDuration: 150 })) as Table;
        await update(table, (rows) => {
            rows[0]!.age = 40;
            rows[1]!.age = 0;
            rows[2]!.name = 'renamed';
        });
        expect(flashOf(table, 'r0', 'age')).toBe('up');
        expect(flashOf(table, 'r1', 'age')).toBe('down');
        expect(flashOf(table, 'r2', 'name')).toBe('changed');
        expect(qa(table, '[data-flash]')).toHaveLength(3);
        await vi.waitFor(() => expect(qa(table, '[data-flash]')).toHaveLength(0), { timeout: 1000, interval: 20 });
    });

    it('a second update before the first expires keeps the first cell flashing to its own deadline (AB4)', async () => {
        const table = (await mountTable<SampleRow>({ data: makeRows(5), enableCellFlash: true, cellFlashDuration: 400 })) as Table;
        await update(table, (rows) => (rows[0]!.age = 40));
        await new Promise((r) => setTimeout(r, 200));
        await update(table, (rows) => (rows[1]!.age = 40));
        expect(flashOf(table, 'r0', 'age')).toBe('up');
        expect(flashOf(table, 'r1', 'age')).toBe('up');
        await vi.waitFor(() => expect(flashOf(table, 'r0', 'age')).toBeNull(), { timeout: 1000, interval: 20 });
        expect(flashOf(table, 'r1', 'age')).toBe('up');
        await vi.waitFor(() => expect(flashOf(table, 'r1', 'age')).toBeNull(), { timeout: 1000, interval: 20 });
    });

    it('flashes nothing with enable-cell-flash off or on a column with enableCellFlash: false', async () => {
        const off = (await mountTable<SampleRow>({ data: makeRows(3), cellFlashDuration: 1000 })) as Table;
        await update(off, (rows) => (rows[0]!.age = 40));
        expect(qa(off, '[data-flash]')).toHaveLength(0);
        const optOut = (await mountTable<SampleRow>({
            data: makeRows(3),
            enableCellFlash: true,
            cellFlashDuration: 1000,
            columns: [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'age', header: 'Age', enableCellFlash: false }],
        })) as Table;
        await update(optOut, (rows) => {
            rows[0]!.age = 40;
            rows[0]!.name = 'x';
        });
        expect(flashOf(optOut, 'r0', 'age')).toBeNull();
        expect(flashOf(optOut, 'r0', 'name')).toBe('changed');
    });

    it('a row that changed while it was not drawn does not flash when it is scrolled into view', async () => {
        const table = (await mountTable<SampleRow>({ data: makeRows(2000), enableVirtualScroll: true, enableCellFlash: true, cellFlashDuration: 2000 }, {}, { width: 600, height: 400 })) as Table;
        await update(table, (rows) => (rows[1500]!.age = 99));
        await scrollGrid(q(table, VIEWPORT), { top: 1500 * 40 });
        await settle(table);
        expect(rowById(table, 'r1500')).not.toBeNull();
        expect(qa(table, '[data-flash]')).toHaveLength(0);
    });

    it('animates the tint normally; under reduced motion the tint and the marker stay without animation', async () => {
        const table = (await mountTable<SampleRow>({ data: makeRows(3), enableCellFlash: true, cellFlashDuration: 3000 })) as Table;
        await update(table, (rows) => (rows[0]!.age = 40));
        const cell = table.querySelector<HTMLElement>('[data-row-id="r0"] [data-column="age"]')!;
        expect(getComputedStyle(cell).animationName).toBe('ge-dt-flash');
        expect(getComputedStyle(cell).animationDuration).toBe('3s');
        const marker = getComputedStyle(cell, '::before');
        expect(marker.borderLeftWidth).toBe('2px');
        expect(marker.borderLeftStyle).toBe('solid');
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        expect(getComputedStyle(cell).animationName).toBe('none');
        expect(getComputedStyle(cell).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(cell, '::before').borderLeftWidth).toBe('2px');
    });
});
