import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { PointerPress } from './data-table-cell-session.js';
import { hasPosition } from './data-table-cell-interaction-controller.js';
import { cellAt, makeColumns, makeRows, mountTable, SAMPLE_COLUMNS, SAMPLE_ROWS, settle } from './data-table-fixtures.js';
import { frames, mouseDrag, parkMouse, scrollGrid } from './data-table-input-fixtures.js';
import { KEY_PRIORITY } from './data-table-registry.js';
import { EditSession } from './data-table-edit-session.js';
import { RangeSession } from './data-table-range-session.js';
import type { GeDataTable } from './data-table.js';

type Handler = (event: PointerEvent, at: unknown, press: PointerPress) => boolean | void;
const proto = RangeSession.prototype as unknown as { onPointerDown?: Handler };

afterEach(async () => {
    delete proto.onPointerDown;
    await parkMouse();
});

/** The edit session of step 0 never opens an editor: say that one is open in this cell, the way wave 5's session will answer. */
function openEditorAt(table: GeDataTable, rowIndex: number, columnKey: string): void {
    // The `interaction` provider IS the object the controller asks (`this.service`), so overriding its answer is what wave 5's session will do.
    (table.provider('interaction') as { editingCell(): unknown }).editingCell = () => ({ rowIndex, columnKey });
}

async function shiftClick(el: Element, table: GeDataTable): Promise<void> {
    await userEvent.keyboard('{Shift>}');
    try {
        await userEvent.click(el);
    } finally {
        await userEvent.keyboard('{/Shift}');
    }
    await settle(table);
}

describe('a press is offered to the sessions before the controller moves the focus', () => {
    it('gives a session the roving cell as it was before the press, so a shift+click can extend from it', async () => {
        const seen: PointerPress[] = [];
        proto.onPointerDown = (event, _at, press) => {
            if (event.shiftKey) seen.push(press);
        };
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        await shiftClick(cellAt(table, 3, 'age')!, table);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.anchor).toEqual({ rowIndex: 0, columnKey: 'name' });
        // not claimed: the controller then focused the pressed cell, after the session had seen the old one
        expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'age' });
    });

    it('gives the pointerup of a press the SAME anchor as its pointerdown, although the unclaimed pointerdown already moved the focus', async () => {
        const events: [string, unknown][] = [];
        proto.onPointerDown = (_event, _at, press) => void events.push(['down', press.anchor]);
        (proto as { onPointerUp?: Handler }).onPointerUp = (_event, _at, press) => void events.push(['up', press.anchor]);
        try {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            await userEvent.click(cellAt(table, 3, 'age')!);
            await settle(table);
            const origin = { rowIndex: 0, columnKey: 'name' };
            expect(events).toEqual([
                ['down', origin],
                ['up', origin],
            ]);
            expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'age' });
        } finally {
            delete (proto as { onPointerUp?: Handler }).onPointerUp;
        }
    });

    it('leaves no anchor behind when a press is released outside the table: a later press with the same pointer id sees the roving cell it started from', async () => {
        const ups: unknown[] = [];
        (proto as { onPointerUp?: Handler }).onPointerUp = (_event, _at, press) => void ups.push(press.anchor);
        try {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            const outside = { x: window.innerWidth - 4, y: window.innerHeight - 4 };
            // press on a cell, released outside the table: that press is over, its anchor ({0,name}) must not survive it
            await mouseDrag(cellAt(table, 3, 'age')!, outside, { steps: 3 });
            expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'age' });
            expect(ups).toEqual([]);
            // press outside, released on a cell: no pointerdown of this table is behind it, so it does nothing (no stale anchor, no made-up one)
            await mouseDrag(outside, cellAt(table, 1, 'name')!, { steps: 3 });
            expect(ups).toEqual([]);
        } finally {
            delete (proto as { onPointerUp?: Handler }).onPointerUp;
        }
    });

    it('tells the session that claimed a press when it ends without a pointerup on the table: a release outside, and a pointercancel', async () => {
        const events: [string, unknown][] = [];
        const hooks = proto as { onPointerUp?: Handler; onPointerCancel?: (event: PointerEvent, press: PointerPress) => void };
        proto.onPointerDown = () => true;
        hooks.onPointerUp = (_event, _at, press) => void events.push(['up', press.anchor]);
        hooks.onPointerCancel = (event, press) => void events.push(['cancel', press.anchor, event.type] as never);
        try {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            const outside = { x: window.innerWidth - 4, y: window.innerHeight - 4 };
            // released outside the table: cancel (the page-level pointerup), with the anchor of that press
            await mouseDrag(cellAt(table, 3, 'age')!, outside, { steps: 3 });
            expect(events).toEqual([['cancel', { rowIndex: 0, columnKey: 'name' }, 'pointerup']]);
            // released on the table: onPointerUp, and no cancel
            events.length = 0;
            await userEvent.click(cellAt(table, 2, 'name')!);
            expect(events.map((e) => e[0])).toEqual(['up']);
            // a pointercancel from the browser
            events.length = 0;
            const cell = cellAt(table, 1, 'name')!;
            cell.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, bubbles: true, composed: true, button: 0 }));
            cell.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 9, bubbles: true, composed: true }));
            expect(events.map((e) => e[0])).toEqual(['cancel']);
            // an unclaimed press tells nobody
            events.length = 0;
            delete proto.onPointerDown;
            await mouseDrag(cellAt(table, 3, 'age')!, outside, { steps: 3 });
            expect(events).toEqual([]);
        } finally {
            delete hooks.onPointerUp;
            delete hooks.onPointerCancel;
        }
    });

    it('is not "pointer down" any more once the press is released outside the table: the next focus on the viewport reaches the roving cell', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const outside = { x: window.innerWidth - 4, y: window.innerHeight - 4 };
        await mouseDrag(cellAt(table, 2, 'age')!, outside, { steps: 3 });
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        viewport.focus(); // what a Tab into the grid does when no cell is the tab stop
        await frames(2);
        const active = document.activeElement as HTMLElement;
        expect(active.matches('[data-slot="table-cell"]')).toBe(true);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });

    it('does not move the focus when a session claims the press: the session moves it', async () => {
        proto.onPointerDown = () => true;
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        await userEvent.click(cellAt(table, 3, 'age')!);
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });

    it('gives the session a null anchor when nothing was focused', async () => {
        const anchors: unknown[] = [];
        proto.onPointerDown = (_event, _at, press) => void anchors.push(press.anchor);
        const table = await mountTable();
        await userEvent.click(cellAt(table, 1, 'name')!);
        await settle(table);
        expect(anchors).toEqual([null]);
    });
});

type Hooks = { onPointerDown?: Handler; onPointerUp?: Handler; onPointerCancel?: (event: PointerEvent | null, press: PointerPress) => void };
const hooks = RangeSession.prototype as unknown as Hooks;
const editHooks = EditSession.prototype as unknown as Hooks;
/** A pointer event; `over` puts it at the centre of that element (a touch's pointerup is hit-tested by its coordinates). */
const pointer = (type: string, pointerId: number, init: PointerEventInit & { over?: Element } = {}): PointerEvent => {
    const { over, ...rest } = init;
    const rect = over?.getBoundingClientRect();
    const at = rect ? { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 } : {};
    return new PointerEvent(type, { pointerId, bubbles: true, composed: true, button: 0, pointerType: 'mouse', ...at, ...rest });
};

describe('the press contract: one press per pointer, routed to its claimant', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('keeps the anchor of a claimed press that moved the focus itself: its claimant gets the ORIGINAL anchor', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const ups: unknown[] = [];
        hooks.onPointerDown = () => {
            table.focusCell(3, 'age'); // the claimant moves the focus in its own pointerdown (a shift+click starting a range)
            return true;
        };
        hooks.onPointerUp = (_event, _at, press) => void ups.push(press.anchor);
        const cell = cellAt(table, 3, 'age')!;
        cell.dispatchEvent(pointer('pointerdown', 31));
        expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'age' });
        cell.dispatchEvent(pointer('pointerup', 31));
        expect(ups).toEqual([{ rowIndex: 0, columnKey: 'name' }]);
    });

    it('is multi-touch safe: another pointer tapping elsewhere neither overwrites nor ends the claimed press', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const log: string[] = [];
        hooks.onPointerDown = (event) => event.pointerId === 41;
        hooks.onPointerUp = (event) => void log.push(`up:${event.pointerId}`);
        hooks.onPointerCancel = (event, press) => void log.push(`cancel:${event?.pointerId}:${press.anchor?.rowIndex}`);
        const a = cellAt(table, 1, 'name')!;
        const b = cellAt(table, 2, 'age')!;
        a.dispatchEvent(pointer('pointerdown', 41)); // claimed
        b.dispatchEvent(pointer('pointerdown', 42, { pointerType: 'touch' })); // unclaimed, a second finger
        b.dispatchEvent(pointer('pointerup', 42, { pointerType: 'touch', over: b })); // its tap ends ONLY its own press (offered to the sessions: unclaimed)
        expect(log).toEqual(['up:42']);
        // A is released outside the table: its press is still there and its claimant is told
        document.body.dispatchEvent(pointer('pointerup', 41));
        await frames(1); // a release outside is closed after the dispatch (the document hears it before the table's root)
        expect(log).toEqual(['up:42', 'cancel:41:0']);
    });

    it('routes a claimed press only to its claimant: its pointerup reaches no other session and the controller does not move the focus', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const edit = vi.fn();
        hooks.onPointerDown = () => true; // the range shell claims, and answers nothing from its pointerup
        hooks.onPointerUp = () => undefined;
        editHooks.onPointerUp = (...args) => void edit(...args);
        const cell = cellAt(table, 2, 'age')!;
        cell.dispatchEvent(pointer('pointerdown', 51, { pointerType: 'touch' }));
        cell.dispatchEvent(pointer('pointerup', 51, { pointerType: 'touch', over: cell }));
        expect(edit).not.toHaveBeenCalled();
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' }); // not even the touch tap focus
    });

    it('does nothing for a pointerup or cancel of a pointer whose pointerdown it never saw', async () => {
        const table = await mountTable();
        const calls: string[] = [];
        hooks.onPointerUp = () => void calls.push('range-up');
        editHooks.onPointerUp = () => void calls.push('edit-up');
        hooks.onPointerCancel = () => void calls.push('cancel');
        cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerup', 61));
        cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointercancel', 62));
        expect(calls).toEqual([]);
        expect(table.focusedCell).toBeNull();
    });

    it('closes a press that starts in the table and is released over a NESTED table (a detail row): the claimant is told, nobody is "down"', async () => {
        const nested = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(nested, { columns: [{ accessorKey: 'name', header: 'Name' }], data: [{ name: 'inner' }], showToolbar: false, showPagination: false });
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? nested : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        await settle(nested);
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = () => void log.push('up');
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        table.focusCell(1, 'name');
        await settle(table);
        cellAt(table, 1, 'age')!.dispatchEvent(pointer('pointerdown', 101));
        const inner = nested.querySelector('[data-slot="table-cell"]')!;
        inner.dispatchEvent(pointer('pointerup', 101));
        // not an up on THIS table's cells: the outer press ends as a cancel for its claimant (the nested table has no press of its own for this pointer)
        expect(log).toEqual(['cancel:pointerup']);
        table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus();
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
    });

    it('leaves a press alone that an inner widget stopped (round 30 supersedes round 10): a touch tap on a cell whose content stops pointerdown focuses nothing', async () => {
        const widget = document.createElement('span');
        widget.textContent = 'widget';
        widget.style.cssText = 'display:inline-block;width:100px;height:20px';
        widget.addEventListener('pointerdown', (event) => event.stopPropagation());
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 1 ? widget : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        widget.dispatchEvent(pointer('pointerdown', 111, { pointerType: 'touch' }));
        widget.dispatchEvent(pointer('pointerup', 111, { pointerType: 'touch', over: widget }));
        await settle(table);
        expect(table.focusedCell).toBeNull(); // the widget's own press: stopPropagation on pointerdown means the grid leaves it alone, any pointer type
    });

    it('ends a press that is still open when its pointer goes down again (a lost pointerup): the claimant is told first', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = (event) => {
            log.push(`down:${event.pointerId}`);
            return true;
        };
        hooks.onPointerCancel = (event, press) => void log.push(`cancel:${event === null ? 'no event' : event.type}:${press.anchor === null}`);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 81));
        cell.dispatchEvent(pointer('pointerdown', 81)); // no pointerup in between
        // the old press ended without an event of its own (the new pointerdown is not its end), like at detach and window blur
        expect(log).toEqual(['down:81', 'cancel:no event:true', 'down:81']);
    });

    it('is not hidden by a consumer cell that stops propagation: the claimant still gets its pointerup and no press or "pointer down" is left', async () => {
        const table = await mountTable();
        const ups: number[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (event) => void ups.push(event.pointerId);
        const cell = cellAt(table, 1, 'name')!;
        cell.addEventListener('pointerup', (event) => event.stopPropagation()); // bubble phase, a consumer's handler
        cell.addEventListener('pointercancel', (event) => event.stopPropagation());
        cell.dispatchEvent(pointer('pointerdown', 91));
        cell.dispatchEvent(pointer('pointerup', 91));
        expect(ups).toEqual([91]);
        // the pointer is no longer down: focus on the viewport reaches a cell
        table.focusCell(0, 'name');
        await settle(table);
        table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus();
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
        // a cancel that is stopped is heard too
        const cancels: unknown[] = [];
        hooks.onPointerCancel = (event) => void cancels.push(event?.type);
        cell.dispatchEvent(pointer('pointerdown', 92));
        cell.dispatchEvent(pointer('pointercancel', 92));
        expect(cancels).toEqual(['pointercancel']);
    });

    it('tells the claimants when the window loses focus mid-press, and nobody is "down" afterwards', async () => {
        const table = await mountTable();
        const log: unknown[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event) => void log.push(event);
        cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerdown', 95));
        window.dispatchEvent(new Event('blur'));
        expect(log).toEqual([null]);
    });

    it('detaches completely although a claimant throws while its press is cancelled: the error is reported, the sessions still detach', async () => {
        const table = await mountTable();
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const detach = vi.spyOn(RangeSession.prototype, 'detach');
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = () => {
            throw new Error('claimant failed');
        };
        try {
            cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerdown', 99));
            expect(() => table.remove()).not.toThrow();
            expect(detach).toHaveBeenCalledTimes(1);
            expect(error).toHaveBeenCalledTimes(1);
            expect(table.provider('range')).toBeUndefined(); // the services were unprovided: the controller's teardown ran
        } finally {
            detach.mockRestore();
            error.mockRestore();
        }
    });

    it('cancels an open claimed press for its claimant BEFORE the sessions detach when the table is removed mid-press', async () => {
        const table = await mountTable();
        const order: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event, press) => void order.push(`cancel:${event === null}:${press.anchor === null}`);
        const detach = vi.spyOn(RangeSession.prototype, 'detach').mockImplementation(() => void order.push('detach'));
        try {
            cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerdown', 71));
            table.remove();
            expect(order).toEqual(['cancel:true:true', 'detach']);
        } finally {
            detach.mockRestore();
        }
    });
});

describe('sessions that throw', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('reports EVERY error (they are bugs, not noise), each with its own message', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const table = await mountTable();
            let count = 0;
            hooks.onPointerDown = () => {
                throw new Error(`failure ${++count}`);
            };
            await userEvent.click(cellAt(table, 2, 'age')!);
            await userEvent.click(cellAt(table, 1, 'name')!);
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toEqual(['failure 1', 'failure 2']);
        } finally {
            error.mockRestore();
        }
    });

    it('never break a press: a session that throws on pointerdown is reported and does not claim, so the controller focuses the cell', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const table = await mountTable();
            hooks.onPointerDown = () => {
                throw new Error('range failed');
            };
            await userEvent.click(cellAt(table, 2, 'age')!);
            await userEvent.click(cellAt(table, 1, 'name')!);
            expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
            expect(error).toHaveBeenCalledTimes(2); // one per press
        } finally {
            error.mockRestore();
        }
    });

    it('never break a press: a claimant that throws on pointerup is reported, the press is closed and nobody is "down"', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const table = await mountTable();
            hooks.onPointerDown = () => true;
            hooks.onPointerUp = () => {
                throw new Error('claimant failed');
            };
            const cell = cellAt(table, 1, 'name')!;
            cell.dispatchEvent(pointer('pointerdown', 121));
            expect(() => cell.dispatchEvent(pointer('pointerup', 121))).not.toThrow();
            expect(error).toHaveBeenCalledTimes(1);
            // closed: a pointerup of the same id does nothing, and the viewport focus reaches a cell
            table.focusCell(0, 'name');
            await settle(table);
            table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus();
            await frames(2);
            expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
        } finally {
            error.mockRestore();
        }
    });
});

describe('a session that throws while attaching', () => {
    it('is reported, detached at once and left out: the table still mounts, the other session works', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const attach = vi.spyOn(EditSession.prototype, 'attach').mockImplementation(() => {
            throw new Error('edit attach failed');
        });
        const editDetach = vi.spyOn(EditSession.prototype, 'detach');
        const rangeAttach = vi.spyOn(RangeSession.prototype, 'attach');
        try {
            const table = await mountTable();
            expect(error).toHaveBeenCalledTimes(1);
            expect(rangeAttach).toHaveBeenCalledTimes(1); // the session after it attached, and so did every other controller
            expect(table.querySelector('[data-slot="table-row"][data-kind="data"]')).not.toBeNull();
            expect(table.provider('footer')).toBeDefined();
            expect(editDetach).toHaveBeenCalledTimes(1); // right away, to undo what it registered before it threw
            table.remove();
            expect(editDetach).toHaveBeenCalledTimes(1); // and not again at the detach: it is left out
        } finally {
            attach.mockRestore();
            editDetach.mockRestore();
            rangeAttach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a range session whose attach threw', () => {
    it('is withdrawn: the range provider answers neutrally (not active), a cellRange assigned meanwhile is held by the element, nothing throws', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const attach = vi.spyOn(RangeSession.prototype, 'attach').mockImplementation(() => {
            throw new Error('range attach failed');
        });
        try {
            const table = await mountTable({ enableCellRangeSelection: true });
            expect(table.provider('range')!.active()).toBe(false);
            const range = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };
            table.cellRange = range;
            await settle(table);
            expect(table.cellRange).toEqual(range); // held by the element while there is no REAL range service, and handed over at a connect that has one
            expect(table.provider('range')!.isInRange(0, 'name')).toBe(false);
            expect(table.provider('interaction')!.isCellSelected(0, 'name')).toBe(false); // neutral: false, not the focused cell
            // and a reconnect tries the real session again: nothing throws
            attach.mockRestore();
            table.remove();
            document.body.append(table);
            await settle(table);
            expect(table.provider('range')).toBeDefined();
            expect(table.cellRange).toEqual(range); // the held value was handed to the REAL session at that connect
        } finally {
            attach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a failed session is withdrawn: its presses end, its neutral services take over', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('ends the presses it claimed WITHOUT calling it (it just threw), and never calls it again (release, blur, detach)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let fail = false;
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            if (fail) throw new Error('range hostUpdate failed');
        });
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = () => void log.push('up');
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        try {
            const table = await mountTable();
            cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerdown', 241));
            fail = true;
            table.requestUpdate();
            await settle(table);
            expect(log).toEqual([]); // the press ended for the failed claimant, which is not told
            cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerup', 241));
            window.dispatchEvent(new Event('blur'));
            table.remove();
            expect(log).toEqual([]);
        } finally {
            update.mockRestore();
            error.mockRestore();
        }
    });


    it('keeps a cellRange assigned while the range session is failed in the session itself, and it survives a detach and the reconnect', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let fail = false;
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            if (fail) throw new Error('range hostUpdate failed');
        });
        try {
            const table = await mountTable({ enableCellRangeSelection: true });
            fail = true;
            table.requestUpdate();
            await settle(table);
            const second = { startRow: 1, startCol: 'name', endRow: 2, endCol: 'age' };
            table.cellRange = second; // while it is out: held by the element
            expect(table.cellRange).toEqual(second);
            update.mockRestore();
            table.remove();
            document.body.append(table);
            await settle(table);
            expect(table.provider('range')!.range()).toEqual(second); // the session itself holds it now, not only the element
            expect(table.cellRange).toEqual(second);
        } finally {
            update.mockRestore();
            error.mockRestore();
        }
    });

    it('a FAILED range session keeps its VALUE: assign, toggle the range mode off and on and it is dropped like a healthy session\'s; assign, remove, read, reconnect: it is still there', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let fail = false;
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            if (fail) throw new Error('range hostUpdate failed');
        });
        try {
            const table = await mountTable({ enableCellRangeSelection: true });
            const service = table.provider('range')!;
            fail = true;
            table.requestUpdate();
            await settle(table);
            expect(table.querySelector('[data-slot="table-row"][data-kind="data"]')).not.toBeNull(); // the table still renders
            expect(table.provider('range')).toBe(service); // never re-provided over: it is still the session's own service
            expect(service.active()).toBe(false); // the live-part answers are neutral while it is out
            const r = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };
            table.cellRange = r;
            expect(table.cellRange).toEqual(r); // the value works
            await settle(table);
            table.enableCellRangeSelection = false;
            await settle(table);
            table.enableCellRangeSelection = true;
            await settle(table);
            expect(table.cellRange).toBeNull(); // the turn-off rule ran (keepValue): dropped, like a healthy session
            table.cellRange = r;
            table.remove();
            expect(table.cellRange).toEqual(r); // detached: the value is still there
            update.mockRestore();
            document.body.append(table);
            await settle(table);
            expect(table.cellRange).toEqual(r); // and the reconnected session still holds it
            expect(error).toHaveBeenCalledTimes(1);
        } finally {
            update.mockRestore();
            error.mockRestore();
        }
    });

    it('an edit session that fails to attach is replaced by the neutral editing methods, the table works, and a reconnect tries it again', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const attach = vi.spyOn(EditSession.prototype, 'attach').mockImplementation(() => {
            throw new Error('edit attach failed');
        });
        try {
            const table = await mountTable();
            expect(table.provider('interaction')!.editingCell?.()).toBeNull();
            expect(table.provider('interaction')!.startEditing?.(table.data[0]!, 'name')).toBe(false);
            attach.mockRestore();
            table.remove();
            document.body.append(table);
            await settle(table);
            expect(table.querySelector('[data-slot="table-row"][data-kind="data"]')).not.toBeNull();
            expect(error).toHaveBeenCalledTimes(1); // the failure was reported once, and the retry (the real attach) does not fail
        } finally {
            attach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('the neutral services of a failed range session', () => {
    it('answer with typed values (false, \'\', null) and nothing calls the detached session', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const attach = vi.spyOn(RangeSession.prototype, 'attach').mockImplementation(() => {
            throw new Error('range attach failed');
        });
        try {
            const table = await mountTable({ enableCellRangeSelection: true });
            expect(error).toHaveBeenCalledTimes(1);
            const range = table.provider('range')!;
            // typed neutral answers, not null: booleans false, strings '', the rest null
            expect([range.active(), range.isInRange(0, 'name'), range.isFillPreview(0, 'name'), range.gestureActive(), range.fillDownTo(1)]).toEqual([false, false, false, false, false]);
            expect(range.edgeOf(0, 'name')).toBe('');
            expect(table.cellRange).toBeNull();
            expect(() => (table.cellRange = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' })).not.toThrow();
            expect(table.provider('interaction')!.isCellSelected(0, 'name')).toBe(false);
        } finally {
            attach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('an unclaimed press is offered at its pointerup only when it began on a body cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('a click on a cell is offered with startCell and pressed of that cell', async () => {
        const table = await mountTable();
        const seen: PointerPress[] = [];
        hooks.onPointerUp = (_event, _at, press) => void seen.push(press);
        const cell = cellAt(table, 1, 'age')!;
        await userEvent.click(cell);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.startCell).toEqual({ rowIndex: 1, columnKey: 'age' });
        expect(cell.contains(seen[0]!.pressed)).toBe(true);
    });

    it('a drag that began on a resize handle and is released over a body cell is offered to no session', async () => {
        const table = await mountTable({ enableColumnResize: true });
        const ups: unknown[] = [];
        const downs: PointerPress[] = [];
        hooks.onPointerUp = (_event, at) => void ups.push(at);
        hooks.onPointerDown = (_event, _at, press) => void downs.push(press); // seen, not claimed
        const handle = table.querySelector<HTMLElement>('[data-slot="table-head"] [data-slot="data-table-resize-handle"]')!;
        await mouseDrag(handle, cellAt(table, 2, 'age')!, { steps: 3 });
        expect(ups).toEqual([]);
        expect(downs[0]!.startCell).toBeNull(); // it began on the handle
    });
});

describe('a release outside followed at once by a press of the same pointer', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('tells the claimant of the first press about its REAL pointerup, not a null event', async () => {
        const table = await mountTable();
        const cancels: unknown[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event) => void cancels.push(event);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 301));
        const up = pointer('pointerup', 301);
        document.body.dispatchEvent(up); // outside: the deferred close has not run yet
        cell.dispatchEvent(pointer('pointerdown', 301)); // the same pointer presses again in the same task
        expect(cancels).toEqual([up]);
        expect(cancels[0]).toBe(up);
        await frames(2);
        expect(cancels).toHaveLength(1); // and the deferred close finds nothing left for it
        cell.dispatchEvent(pointer('pointerup', 301));
    });
});

describe('a new pointerdown for a pointer whose press was lost', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('also forgets that pointer\'s capture: the next release is located by its target', async () => {
        const table = await mountTable();
        const a = cellAt(table, 0, 'name')!;
        const b = cellAt(table, 2, 'age')!;
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        a.dispatchEvent(pointer('pointerdown', 271));
        a.dispatchEvent(new PointerEvent('gotpointercapture', { pointerId: 271, bubbles: true, composed: true }));
        // the pointerup was lost: the same pointer goes down again, with no capture of its own
        a.dispatchEvent(pointer('pointerdown', 271));
        a.dispatchEvent(pointer('pointerup', 271, { over: b }));
        expect(log).toEqual(['up:{"rowIndex":0,"columnKey":"name"}']);
    });
});

describe('a touch tap acts on the element under the finger', () => {
    it('on a group header row clears the roving focus, as a mouse press there does', async () => {
        const table = await mountTable({ columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 1000 }, showToolbar: false });
        table.focusCell(0, 'c0');
        await settle(table);
        expect(table.focusedCell).not.toBeNull();
        const group = table.querySelector<HTMLElement>('[data-kind="group"]')!;
        group.dispatchEvent(pointer('pointerdown', 251, { pointerType: 'touch', over: group }));
        group.dispatchEvent(pointer('pointerup', 251, { pointerType: 'touch', over: group }));
        await settle(table);
        expect(table.focusedCell).toBeNull();
    });

    describe('with an editor open in another cell', () => {
        async function withEditor() {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            openEditorAt(table, 2, 'age');
            const host = cellAt(table, 2, 'age')!;
            host.style.position = 'relative';
            const editor = document.createElement('div');
            editor.style.cssText = 'position:absolute;inset:0';
            host.append(editor);
            return { table, editor, a: cellAt(table, 1, 'name')! };
        }

        it('does not move the focus off the editor when the finger is released over it (the guard reads the element under the finger)', async () => {
            const { table, editor, a } = await withEditor();
            a.dispatchEvent(pointer('pointerdown', 261, { pointerType: 'touch', over: a }));
            a.dispatchEvent(pointer('pointerup', 261, { pointerType: 'touch', over: editor }));
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        });

        it('leaves the focus alone for a press that started in the editor, wherever it is released (a tap there is the editor\'s)', async () => {
            const { table, editor, a } = await withEditor();
            editor.dispatchEvent(pointer('pointerdown', 262, { pointerType: 'touch', over: editor }));
            editor.dispatchEvent(pointer('pointerup', 262, { pointerType: 'touch', over: editor }));
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
            editor.dispatchEvent(pointer('pointerdown', 263, { pointerType: 'touch', over: editor }));
            editor.dispatchEvent(pointer('pointerup', 263, { pointerType: 'touch', over: a })); // a drag away: nothing either
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        });
    });

    describe('that drifts', () => {
        it('focuses the PRESSED cell when the finger is released a few px into the next row (a tap), and nothing when it is released far away (a drag)', async () => {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            const pressed = cellAt(table, 1, 'name')!;
            const box = pressed.getBoundingClientRect();
            const x = box.left + box.width / 2;
            const tapAt = (id: number, y: number): void => {
                pressed.dispatchEvent(pointer('pointerdown', id, { pointerType: 'touch', over: pressed }));
                pressed.dispatchEvent(pointer('pointerup', id, { pointerType: 'touch', clientX: x, clientY: y })); // implicit capture: the pointerup goes to the pressed cell
            };
            tapAt(281, box.bottom + 4); // 4 px into the next row
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
            table.focusCell(0, 'name');
            await settle(table);
            tapAt(282, box.bottom + 40); // 40 px away
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        });
    });
});

describe('what a session registered before its attach threw', () => {
    it('is removed again (its detach runs at once), so reconnecting the table does not accumulate it', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const handler = vi.fn(() => false);
        let off: (() => void) | undefined;
        const attach = vi.spyOn(EditSession.prototype, 'attach').mockImplementation(function (this: { context: { host: { addKeyHandler(priority: number, fn: () => boolean): () => void } } }) {
            off = this.context.host.addKeyHandler(KEY_PRIORITY.reserved, handler); // registered, then the attach fails
            throw new Error('edit attach failed');
        });
        const detach = vi.spyOn(EditSession.prototype, 'detach').mockImplementation(() => void off?.());
        try {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            await userEvent.keyboard('x');
            expect(handler).not.toHaveBeenCalled();
            // reconnect twice: the handler is registered and removed each time, never left behind
            for (let i = 0; i < 2; i++) {
                table.remove();
                document.body.append(table);
                await settle(table);
            }
            table.focusCell(0, 'name');
            await settle(table);
            await userEvent.keyboard('x');
            expect(handler).not.toHaveBeenCalled();
            expect(detach).toHaveBeenCalledTimes(3); // one per attach that threw
        } finally {
            attach.mockRestore();
            detach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a session failing in two callbacks', () => {
    it('reports a render-time callback once on its own key (renderOverlay), and the session failure once for hostUpdate and keepValue together', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let failHost = false;
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            if (failHost) throw new Error('host');
        });
        const keep = vi.spyOn(RangeSession.prototype, 'keepValue').mockImplementation(() => {
            throw new Error('keep');
        });
        (RangeSession.prototype as unknown as { renderOverlay?: () => unknown }).renderOverlay = () => {
            throw new Error('overlay');
        };
        try {
            const table = await mountTable();
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toContain('overlay');
            failHost = true;
            table.requestUpdate();
            await settle(table); // hostUpdate throws: the session is failed and reported
            table.requestUpdate();
            await settle(table); // now only its keepValue runs (and throws): the same report key as the failure, so nothing new
            table.requestUpdate();
            await settle(table);
            expect(keep.mock.calls.length).toBeGreaterThan(0);
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toEqual(['overlay', 'host']);
        } finally {
            delete (RangeSession.prototype as unknown as { renderOverlay?: unknown }).renderOverlay;
            update.mockRestore();
            keep.mockRestore();
            error.mockRestore();
        }
    });
});

describe('sessions that throw in hostUpdate or renderOverlay', () => {
    it('are reported and skipped for that call: the grid still renders and the other session still updates', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const rangeUpdate = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            throw new Error('range hostUpdate failed');
        });
        (RangeSession.prototype as unknown as { renderOverlay?: () => unknown }).renderOverlay = () => {
            throw new Error('overlay failed');
        };
        try {
            const table = await mountTable();
            expect(table.querySelector('[data-slot="table-row"][data-kind="data"]')).not.toBeNull();
            expect(rangeUpdate).toHaveBeenCalled();
            // the range session failed in its first hostUpdate and is left out from then on: its overlay is not asked afterwards
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toEqual(['range hostUpdate failed']);
            table.requestUpdate();
            await settle(table);
            expect(table.querySelector('[data-slot="table-row"][data-kind="data"]')).not.toBeNull();
        } finally {
            delete (RangeSession.prototype as unknown as { renderOverlay?: unknown }).renderOverlay;
            rangeUpdate.mockRestore();
            error.mockRestore();
        }
    });

    it('are reported ONCE across many renders, and a session whose hostUpdate threw is left out from then on', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            throw new Error('range hostUpdate failed');
        });
        const overlay = vi.fn(() => {
            throw new Error('overlay failed');
        });
        (EditSession.prototype as unknown as { renderOverlay?: () => unknown }).renderOverlay = overlay;
        try {
            const table = await mountTable();
            for (let i = 0; i < 6; i++) {
                table.requestUpdate();
                await settle(table);
            }
            const messages = error.mock.calls.map((call) => String((call[1] as Error).message));
            expect(messages.filter((m) => m === 'range hostUpdate failed')).toHaveLength(1);
            expect(messages.filter((m) => m === 'overlay failed')).toHaveLength(1);
            expect(update).toHaveBeenCalledTimes(1); // skipped after its first failure
            expect(overlay.mock.calls.length).toBeGreaterThan(1); // the overlay is still asked: it may recover
        } finally {
            delete (EditSession.prototype as unknown as { renderOverlay?: unknown }).renderOverlay;
            update.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a press outside the table', () => {
    it('clears the focus guard at once: a pointerdown handler that changes the data does not pull the focus back into the grid', async () => {
        const table = await mountTable();
        const outside = document.createElement('div');
        outside.style.cssText = 'position:fixed;right:0;bottom:0;width:80px;height:40px';
        document.body.append(outside);
        table.focusCell(1, 'name');
        await settle(table);
        const focusins: Element[] = [];
        table.addEventListener('focusin', (event) => void focusins.push(event.target as Element));
        // a consumer handler (registered after the table's own, on the same phase) that changes the table's data while the press is still going on
        const handler = (): void => {
            table.data = [...table.data].reverse();
        };
        document.addEventListener('pointerdown', handler, true);
        try {
            await mouseDrag(outside, outside, { steps: 1 });
            await settle(table);
            await frames(3);
            expect(focusins).toEqual([]);
        } finally {
            document.removeEventListener('pointerdown', handler, true);
            outside.remove();
        }
    });

    it('schedules nothing for a press that is not inside the table (nothing recorded to close); one cheap look for a press of the table\'s own', async () => {
        const table = await mountTable();
        const outside = document.createElement('div');
        outside.style.cssText = 'position:fixed;right:0;bottom:0;width:80px;height:40px';
        document.body.append(outside);
        const timeout = vi.spyOn(table.disposables, 'timeout');
        try {
            await mouseDrag(outside, outside, { steps: 1 }); // `within` is false (nothing focused in the table) and no press of the table is open
            expect(timeout).not.toHaveBeenCalled();
            // a press on the table's own cell: the root handles its release, and the document's look (always scheduled since round 31, an ancestor may stop
            // the event) finds nothing left to close
            await mouseDrag(cellAt(table, 1, 'name')!, cellAt(table, 1, 'name')!, { steps: 1 });
            expect(timeout).toHaveBeenCalledTimes(1);
        } finally {
            timeout.mockRestore();
            outside.remove();
        }
    });
});

describe('a table in a CLOSED shadow root', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    async function mountClosed(): Promise<{ host: HTMLElement; shadow: ShadowRoot; table: GeDataTable }> {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'closed' });
        const table = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, showToolbar: false, showPagination: false });
        shadow.append(table);
        await settle(table);
        return { host, shadow, table };
    }

    it('hears its own releases at the root: a claimant gets onPointerUp, an unclaimed press is offered to the sessions, and a release outside is a cancel', async () => {
        const { host, table } = await mountClosed();
        const log: string[] = [];
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        const cell = cellAt(table, 1, 'age')!;
        // unclaimed: offered at its pointerup
        cell.dispatchEvent(pointer('pointerdown', 181));
        cell.dispatchEvent(pointer('pointerup', 181));
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"age"}']);
        // claimed: onPointerUp
        log.length = 0;
        hooks.onPointerDown = () => true;
        cell.dispatchEvent(pointer('pointerdown', 182));
        cell.dispatchEvent(pointer('pointerup', 182));
        await frames(1); // the document's deferred look finds nothing left open
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"age"}']);
        // released outside: the root never hears it, the document's look cancels it
        log.length = 0;
        cell.dispatchEvent(pointer('pointerdown', 183));
        document.body.dispatchEvent(pointer('pointerup', 183));
        await frames(1);
        expect(log).toEqual(['cancel:pointerup']);
        host.remove();
    });

    it('keeps `within` for a press inside (the document cannot see into a closed shadow root): the DOM focus survives a render that moves the cell', async () => {
        const { host, shadow, table } = await mountClosed();
        table.focusCell(1, 'name');
        await settle(table);
        await mouseDrag(cellAt(table, 1, 'name')!, { dx: 0, dy: 0 }, { steps: 1 }); // a real press and release (the test runner's own click cannot reach into a closed root)
        await settle(table);
        await frames(2); // the document's deferred look at the press has run
        table.data = [...table.data].reverse();
        await settle(table);
        await frames(3);
        expect((shadow.activeElement as HTMLElement | null)?.matches('[data-slot="table-cell"]')).toBe(true);
        host.remove();
    });
});

describe('a captured pointer in an open shadow root', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is located by where it is released: with setPointerCapture on the start cell, a release over another row reports the cell under the pointer', async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const table = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, showToolbar: false, showPagination: false });
        shadow.append(table);
        await settle(table);
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const start = cellAt(table, 0, 'name')!;
        start.addEventListener('pointerdown', (event) => start.setPointerCapture(event.pointerId)); // a gesture capturing the pointer
        await mouseDrag(start, cellAt(table, 2, 'age')!, { steps: 4 });
        expect(log).toEqual(['up:{"rowIndex":2,"columnKey":"age"}']);
        host.remove();
    });
});

describe('a captured pointer inside a consumer component with a CLOSED shadow root', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is located by where it is released: the capture is tracked from gotpointercapture, not asked of the retargeted host', async () => {
        class Grabber extends HTMLElement {
            constructor() {
                super();
                const shadow = this.attachShadow({ mode: 'closed' });
                const button = document.createElement('div');
                button.style.cssText = 'position:absolute;inset:0';
                button.addEventListener('pointerdown', (event) => button.setPointerCapture(event.pointerId));
                shadow.append(button);
            }
        }
        if (!customElements.get('ge-test-grabber')) customElements.define('ge-test-grabber', Grabber);
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const start = cellAt(table, 0, 'name')!;
        start.style.position = 'relative';
        const grabber = document.createElement('ge-test-grabber');
        grabber.style.cssText = 'position:absolute;inset:0;display:block';
        start.append(grabber);
        await mouseDrag(start, cellAt(table, 2, 'age')!, { steps: 4 });
        expect(log).toEqual(['up:{"rowIndex":2,"columnKey":"age"}']);
    });
});

describe('the capture of a pointer is forgotten', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    /** A mouse pointer pressed on `a`, released with its coordinates over `b`: the plain path reports `a`, the hit-test path of a captured pointer `b`. */
    async function releaseAt(table: GeDataTable, id: number, a: Element, b: Element, between?: () => void): Promise<string[]> {
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        a.dispatchEvent(pointer('pointerdown', id));
        between?.();
        a.dispatchEvent(pointer('pointerup', id, { over: b }));
        await frames(1);
        return log;
    }

    it('when the capture is lost to the DOCUMENT (the capturing element was removed mid-gesture): the next release takes the plain path', async () => {
        const table = await mountTable();
        const a = cellAt(table, 0, 'name')!;
        const b = cellAt(table, 2, 'age')!;
        const log = await releaseAt(table, 221, a, b, () => {
            a.dispatchEvent(new PointerEvent('gotpointercapture', { pointerId: 221, bubbles: true, composed: true }));
            document.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 221 })); // removed element: the event goes to the document
        });
        expect(log).toEqual(['up:{"rowIndex":0,"columnKey":"name"}']);
    });

    it('when its press ends: a later press of the same pointer id is not captured', async () => {
        const table = await mountTable();
        const a = cellAt(table, 0, 'name')!;
        const b = cellAt(table, 2, 'age')!;
        const first = await releaseAt(table, 222, a, b, () => a.dispatchEvent(new PointerEvent('gotpointercapture', { pointerId: 222, bubbles: true, composed: true })));
        expect(first).toEqual(['up:{"rowIndex":2,"columnKey":"age"}']); // captured: located by where it is
        const second = await releaseAt(table, 222, a, b); // no lostpointercapture ever came, but the press ended
        expect(second).toEqual(['up:{"rowIndex":0,"columnKey":"name"}']);
    });
});

describe('a release over something that floats out of its cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not the cell that holds it: a popover inside cell (0, name) drawn over another cell gives no cell, and a transparent one gives the cell under it', async () => {
        const table = await mountTable();
        const host = cellAt(table, 0, 'name')!;
        const under = cellAt(table, 2, 'age')!;
        const rect = under.getBoundingClientRect();
        const popover = document.createElement('div');
        popover.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        host.append(popover);
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const tap = (id: number): void => {
            // a CLAIMED gesture that began on the cell and is released over the popover (a press that begins on the popover is the popover's own)
            host.dispatchEvent(pointer('pointerdown', id, { pointerType: 'touch', over: host }));
            host.dispatchEvent(pointer('pointerup', id, { pointerType: 'touch', over: popover }));
        };
        tap(231);
        popover.setAttribute('data-pointer-transparent', '');
        tap(232);
        expect(log).toEqual(['up:null', 'up:{"rowIndex":2,"columnKey":"age"}']);
        popover.remove();
    });
});

describe('a mouse release over an overlay of the table', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('reports the cell below it, as a touch at the same point does', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const target = cellAt(table, 2, 'age')!;
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const rect = target.getBoundingClientRect();
        const cover = document.createElement('div');
        cover.setAttribute('data-pointer-transparent', '');
        cover.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        viewport.append(cover);
        cellAt(table, 0, 'name')!.dispatchEvent(pointer('pointerdown', 211));
        cover.dispatchEvent(pointer('pointerup', 211, { over: cover })); // a mouse, no capture: it is released on the overlay it is over
        expect(log).toEqual(['up:{"rowIndex":2,"columnKey":"age"}']);
        cover.remove();
    });
});

describe('a widget in a cell that carries data-table-keeps-focus', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('keeps its own focus on pointerdown (like a control): the grid does not move the focus and offers nothing to the sessions', async () => {
        const table = await mountTable();
        const offers: string[] = [];
        hooks.onPointerDown = () => void offers.push('down');
        hooks.onPointerUp = () => void offers.push('up');
        const cell = cellAt(table, 1, 'name')!;
        const widget = document.createElement('div'); // a combobox-like widget that is not a native control
        widget.tabIndex = 0;
        widget.setAttribute('data-table-keeps-focus', '');
        widget.textContent = 'combo';
        const inner = document.createElement('span');
        inner.textContent = 'option';
        widget.append(inner);
        cell.append(widget);
        const plain = document.createElement('div');
        plain.textContent = 'plain';
        cell.append(plain);
        await userEvent.click(inner);
        expect(document.activeElement).toBe(widget); // the grid did not pull the focus to the cell
        expect(offers).toEqual([]);
        await userEvent.click(plain); // without the attribute the grid takes the press: it is offered to the sessions
        expect(offers).toEqual(['down', 'up']);
    });
});

describe('a press on a control inside a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is the control\'s own: no offer at down or up, no start cell (a button and a checkbox in a cell)', async () => {
        const table = await mountTable();
        const downs: PointerPress[] = [];
        const ups: unknown[] = [];
        hooks.onPointerDown = (_event, _at, press) => void downs.push(press);
        hooks.onPointerUp = (_event, at) => void ups.push(at);
        const cell = cellAt(table, 1, 'name')!;
        const button = document.createElement('button');
        button.textContent = 'go';
        const checkbox = document.createElement('ge-checkbox');
        cell.append(button, checkbox);
        for (const [id, el] of [[311, button], [312, checkbox]] as const) {
            el.dispatchEvent(pointer('pointerdown', id, { over: el }));
            el.dispatchEvent(pointer('pointerup', id, { over: el }));
        }
        expect(downs).toEqual([]); // not even offered at the pointerdown
        expect(ups).toEqual([]);
        cell.dispatchEvent(pointer('pointerdown', 313, { over: cell })); // the cell itself is still a cell press
        cell.dispatchEvent(pointer('pointerup', 313, { over: cell }));
        expect(downs[0]!.startCell).toEqual({ rowIndex: 1, columnKey: 'name' });
        expect(ups).toHaveLength(1);
    });

    it('is bounded to its cell: an outer widget that keeps its focus and hosts a nested table does not disable the nested table\'s presses', async () => {
        const outer = await mountTable();
        const host = cellAt(outer, 0, 'name')!;
        const widget = document.createElement('div');
        widget.setAttribute('data-table-keeps-focus', '');
        const inner = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(inner, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, showToolbar: false, showPagination: false });
        widget.append(inner);
        host.append(widget);
        await settle(inner);
        const downs: PointerPress[] = [];
        hooks.onPointerDown = (_event, _at, press) => void downs.push(press);
        const target = cellAt(inner, 1, 'age')!;
        target.dispatchEvent(pointer('pointerdown', 321, { over: target }));
        target.dispatchEvent(pointer('pointerup', 321, { over: target }));
        expect(downs).toHaveLength(1); // the inner table's own press (the outer table does not record a nested table's presses)
        expect(downs[0]!.startCell).toEqual({ rowIndex: 1, columnKey: 'age' });
        inner.remove();
    });
});

describe('the merged interaction service delegates to the sessions', () => {
    it('hears a method a session replaces after attach (no snapshot), and a failed session is answered by its neutral service, then restored', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const attach = vi.spyOn(EditSession.prototype, 'attach').mockImplementation(function (this: { service: { editingCell: () => unknown } }) {
            this.service.editingCell = () => ({ rowIndex: 7, columnKey: 'q' }); // replaced when the session attaches (or when its lazy part loads)
        });
        try {
            const table = await mountTable();
            expect(table.provider('interaction')!.editingCell?.()).toEqual({ rowIndex: 7, columnKey: 'q' });
            // a reconnect (the controller attaches again) does not put a stale snapshot back
            table.remove();
            document.body.append(table);
            await settle(table);
            expect(table.provider('interaction')!.editingCell?.()).toEqual({ rowIndex: 7, columnKey: 'q' });
        } finally {
            attach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('the merged interaction service is a plain object', () => {
    it('has only the keys the sessions declare: not thenable (`then` is absent, a Promise of it settles), unknown keys are undefined, and each method keeps its identity across reads', async () => {
        const table = await mountTable();
        const service = table.provider('interaction') as unknown as Record<string, unknown>;
        expect('then' in service).toBe(false);
        expect(service['then']).toBeUndefined();
        expect(service['toJSON']).toBeUndefined();
        expect(service['notAMethod']).toBeUndefined();
        expect(service['asymmetricMatch']).toBeUndefined();
        await expect(Promise.resolve(service)).resolves.toBe(service); // it settles: it is not a thenable
        expect(service['editingCell']).toBe(service['editingCell']); // one stable function per method
        expect(Object.keys(service)).toEqual(expect.arrayContaining(['focusedCell', 'focusCell', 'cellRange', 'isCellSelected', 'editingCell', 'startEditing']));
        expect({ ...service }['startEditing']).toBe(service['startEditing']);
    });
});

describe('a primary-button rule', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('a right or middle press is not offered to the sessions (and so is not offered at its release); the left one is', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = (event) => void log.push(`down:${event.button}`);
        hooks.onPointerUp = (event) => void log.push(`up:${event.button}`);
        const cell = cellAt(table, 1, 'name')!;
        for (const [id, button] of [[371, 2], [372, 1], [373, 0]] as const) {
            cell.dispatchEvent(pointer('pointerdown', id, { button, over: cell }));
            cell.dispatchEvent(pointer('pointerup', id, { button, over: cell }));
        }
        expect(log).toEqual(['down:0', 'up:0']);
    });
});

describe('the document\'s look at a release the root heard', () => {
    it('is cancelled by the root\'s own end of the press (at most one timer per pointer, and none left to run)', async () => {
        const table = await mountTable();
        const cancels: ReturnType<typeof vi.fn>[] = [];
        const real = table.disposables.timeout.bind(table.disposables);
        const timeout = vi.spyOn(table.disposables, 'timeout').mockImplementation(((fn: () => void, ms: number) => {
            const cancel = vi.fn(real(fn, ms));
            cancels.push(cancel);
            return cancel;
        }) as never);
        try {
            const cell = cellAt(table, 1, 'name')!;
            const down = pointer('pointerdown', 481, { over: cell });
            const up = pointer('pointerup', 481, { over: cell });
            cell.dispatchEvent(down);
            cell.dispatchEvent(up);
            expect(timeout).toHaveBeenCalledTimes(1);
            expect(cancels[0]).toHaveBeenCalledTimes(1); // the root heard it in the same dispatch: the look was cancelled
        } finally {
            timeout.mockRestore();
        }
    });
});

describe('a press whose release was lost', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is closed by a later press of the same pointer OUTSIDE the table: the claimant is cancelled once and Tab into the grid focuses a cell', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 471, { over: cell })); // its pointerup never arrives
        document.body.dispatchEvent(pointer('pointerdown', 471)); // the same pointer presses OUTSIDE the table
        expect(log).toEqual(['cancel:null']);
        table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus(); // Tab in: not "a pointer is down" any more
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
        expect(log).toEqual(['cancel:null']);
    });
});

describe('contenteditable="false" inside a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not a control: a press on it is a cell press, while a real contenteditable is the control\'s own', async () => {
        const table = await mountTable();
        const downs: string[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const fixed = document.createElement('div');
        fixed.setAttribute('contenteditable', 'false');
        fixed.textContent = 'fixed';
        const live = document.createElement('div');
        live.setAttribute('contenteditable', 'true');
        live.textContent = 'live';
        cell.append(fixed, live);
        fixed.dispatchEvent(pointer('pointerdown', 491, { over: fixed }));
        expect(downs).toEqual(['down']);
        live.dispatchEvent(pointer('pointerdown', 492, { over: live }));
        expect(downs).toEqual(['down']); // the editable one is a control: not offered
    });
});

describe('a touch tap while a renderer replaces the DOM, in the open editor\'s cell', () => {
    it('does not move the focus off the editor (the same guard, by address)', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        openEditorAt(table, 1, 'age');
        const cell = cellAt(table, 1, 'age')!;
        const box = cell.getBoundingClientRect();
        const x = box.left + 10;
        const y = box.top + 5;
        cell.dispatchEvent(pointer('pointerdown', 495, { pointerType: 'touch', clientX: x, clientY: y }));
        const clone = cell.cloneNode(true) as HTMLElement;
        cell.replaceWith(clone);
        clone.dispatchEvent(pointer('pointerup', 495, { pointerType: 'touch', clientX: x + 2, clientY: y }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a release an ancestor stops in the capture phase', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('still closes the press: the document looks after the dispatch whatever the path says (the claimant is told, "a pointer is down" ends)', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = () => void log.push('up');
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        const stop = (event: Event): void => event.stopPropagation();
        document.body.addEventListener('pointerup', stop, true); // an ancestor of the table, capture phase: the root never hears the pointerup
        try {
            const cell = cellAt(table, 1, 'name')!;
            const down = pointer('pointerdown', 441, { over: cell });
            const up = pointer('pointerup', 441, { over: cell });
            cell.dispatchEvent(down);
            cell.dispatchEvent(up);
            await frames(2);
            expect(log).toEqual(['cancel:pointerup']);
            // a later press of the same pointer is not treated as a lost one
            cell.dispatchEvent(pointer('pointerdown', 441, { over: cell }));
            expect(log).toEqual(['cancel:pointerup']);
        } finally {
            document.body.removeEventListener('pointerup', stop, true);
        }
    });
});

describe('a session whose onPointerDown ends the press', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('that claims it as the window blurs gets exactly one onPointerCancel (the end path found no claimant yet)', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => {
            window.dispatchEvent(new Event('blur')); // ends every open press, this one included
            return true;
        };
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        hooks.onPointerUp = () => void log.push('up');
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 451, { over: cell }));
        cell.dispatchEvent(pointer('pointerup', 451, { over: cell }));
        expect(log).toEqual(['cancel:null']);
    });

    it('that DETACHES the table and claims it gets exactly one onPointerCancel, delivered BEFORE its own detach', async () => {
        const table = await mountTable();
        const log: string[] = [];
        const detach = vi.spyOn(RangeSession.prototype, 'detach').mockImplementation(() => void log.push('detach'));
        hooks.onPointerDown = () => {
            table.remove(); // the table is detached inside the handler
            return true;
        };
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        hooks.onPointerUp = () => void log.push('up');
        try {
            const cell = cellAt(table, 1, 'name')!;
            cell.dispatchEvent(pointer('pointerdown', 461, { over: cell }));
            expect(log).toEqual(['cancel:null', 'detach']);
        } finally {
            detach.mockRestore();
        }
    });

    it('that detaches and re-attaches the table inside the handler: the NEW attachment never sees the stale press', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => {
            log.push('down');
            table.remove();
            document.body.append(table); // attached again, inside the same handler
            return true;
        };
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        hooks.onPointerUp = () => void log.push('up');
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 462, { over: cell }));
        await settle(table);
        cellAt(table, 1, 'name')!.dispatchEvent(pointer('pointerup', 462, { over: cellAt(table, 1, 'name')! }));
        expect(log).toEqual(['down', 'cancel:null']); // one cancel (from the detach), no stale up
    });
});

describe('a touch tap while a renderer replaces the DOM', () => {
    it('focuses the start cell: the pressed node is gone at the release, its address is not', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const cell = cellAt(table, 1, 'age')!;
        const box = cell.getBoundingClientRect();
        const x = box.left + 10;
        const y = box.top + 5;
        cell.dispatchEvent(pointer('pointerdown', 461, { pointerType: 'touch', clientX: x, clientY: y }));
        const clone = cell.cloneNode(true) as HTMLElement; // the renderer swaps the cell between the down and the up
        cell.replaceWith(clone);
        clone.dispatchEvent(pointer('pointerup', 461, { pointerType: 'touch', clientX: x + 2, clientY: y }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'age' });
    });
});

describe('a press on the cell itself', () => {
    it('measures no geometry at the pointerdown: the cell is not floating, so its rect is not read (and a control or overlay is decided before any geometry)', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        openEditorAt(table, 1, 'name'); // a press in the open editor's cell moves no focus: only the recording is measured
        const onCell = pointer('pointerdown', 431, { over: cell }); // built before the spy: the helper itself measures `over`
        const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        try {
            cell.dispatchEvent(onCell);
            expect(spy).not.toHaveBeenCalled();
            const button = document.createElement('button');
            cell.append(button);
            spy.mockClear();
            button.dispatchEvent(pointer('pointerdown', 432, { clientX: 5, clientY: 5 })); // a control: decided before any geometry
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});


describe('the plain rule: a press point outside the cell\'s box is not that cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('allows 1 px at a fractional edge: a press on content at the FLOORED coordinate of a cell whose left edge is fractional is the cell\'s own press', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const child = document.createElement('span');
        cell.append(child);
        const downs: unknown[] = [];
        hooks.onPointerDown = (_event, at) => (downs.push(at), true);
        const real = cell.getBoundingClientRect();
        const left = Math.floor(real.left) + 0.6; // the integer pointer coordinate is 0.6 px left of the edge
        const box = new DOMRect(left, real.top, real.width, real.height);
        const event = pointer('pointerdown', 641, { clientX: Math.floor(left), clientY: real.top + real.height / 2 });
        const spy = vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(box);
        try {
            child.dispatchEvent(event);
        } finally {
            spy.mockRestore();
        }
        expect(downs).toEqual([{ rowIndex: 1, columnKey: 'name' }]);
        document.dispatchEvent(pointer('pointerup', 641, { clientX: Math.floor(left), clientY: real.top + real.height / 2 }));
    });

    it('reads no computed style at all, and a press on the cell itself reads no rect', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const child = document.createElement('span');
        child.textContent = 'text';
        cell.append(child);
        const onChild = pointer('pointerdown', 395, { over: child });
        const outside = pointer('pointerdown', 396, { clientX: 5, clientY: 5 });
        const onCell = pointer('pointerdown', 397, { over: cell });
        const style = vi.spyOn(window, 'getComputedStyle');
        const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        try {
            child.dispatchEvent(onChild);
            child.dispatchEvent(outside);
            expect(style).not.toHaveBeenCalled();
            rect.mockClear();
            openEditorAt(table, 1, 'name'); // the press on the cell then moves no focus
            cell.dispatchEvent(onCell);
            expect(rect).not.toHaveBeenCalled();
        } finally {
            style.mockRestore();
            rect.mockRestore();
        }
    });

    it('a translated (not positioned) menu item that sits outside the cell\'s box is not a cell press; the same item inside the box is', async () => {
        const table = await mountTable();
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const item = document.createElement('span');
        item.textContent = 'item';
        item.style.cssText = 'display:inline-block;transform:translate(0, 400px)'; // moved away by a transform: no `position` at all
        cell.append(item);
        const box = item.getBoundingClientRect(); // where the item really is now
        item.dispatchEvent(pointer('pointerdown', 381, { clientX: box.left + 2, clientY: box.top + 2 }));
        expect(downs).toEqual([]);
        item.style.transform = '';
        const inBox = item.getBoundingClientRect();
        item.dispatchEvent(pointer('pointerdown', 382, { clientX: inBox.left + 2, clientY: inBox.top + 2 }));
        expect(downs).toEqual(['down']);
    });
});

describe('a widget in a cell that stops pointerdown', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('keeps its focus and is not offered (the offer and the focus move run in the bubble phase), at the pointerdown and at the release', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const offers: string[] = [];
        hooks.onPointerDown = () => void offers.push('down');
        hooks.onPointerUp = () => void offers.push('up');
        const cell = cellAt(table, 1, 'age')!;
        const widget = document.createElement('div');
        widget.textContent = 'widget';
        widget.addEventListener('pointerdown', (event) => event.stopPropagation());
        cell.append(widget);
        widget.dispatchEvent(pointer('pointerdown', 401, { over: widget }));
        widget.dispatchEvent(pointer('pointerup', 401, { over: widget }));
        await settle(table);
        expect(offers).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        // a normal press on the cell itself is still offered and focuses
        cell.dispatchEvent(pointer('pointerdown', 402, { over: cell }));
        cell.dispatchEvent(pointer('pointerup', 402, { over: cell }));
        await settle(table);
        expect(offers).toEqual(['down', 'up']);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'age' });
    });

    it('is left alone for a touch too: a tap on a widget that stops pointerdown keeps the focus where it was (any pointer type)', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const cell = cellAt(table, 2, 'name')!;
        const widget = document.createElement('div');
        widget.textContent = 'widget';
        widget.addEventListener('pointerdown', (event) => event.stopPropagation());
        cell.append(widget);
        widget.dispatchEvent(pointer('pointerdown', 403, { pointerType: 'touch', over: widget }));
        widget.dispatchEvent(pointer('pointerup', 403, { pointerType: 'touch', over: widget }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a touch drag along a cell that spans the row', () => {
    it('in the stretch (spacer) cell is no tap: 200 px along it keeps the focus', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const filler = table.querySelector<HTMLElement>('[data-kind="data"] > [data-slot="table-cell"][role="presentation"]');
        expect(filler).not.toBeNull();
        const box = filler!.getBoundingClientRect();
        const y = box.top + box.height / 2;
        filler!.dispatchEvent(pointer('pointerdown', 411, { pointerType: 'touch', clientX: box.left + 20, clientY: y }));
        filler!.dispatchEvent(pointer('pointerup', 411, { pointerType: 'touch', clientX: Math.min(box.right - 1, box.left + 220), clientY: y }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a table inside a data-pointer-transparent wrapper', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not an overlay itself: its cells take presses and a claimed press is released as an up (the look-through is bounded to the table)', async () => {
        const table = await mountTable();
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-pointer-transparent', '');
        document.body.append(wrapper);
        wrapper.append(table);
        await settle(table);
        const log: string[] = [];
        hooks.onPointerDown = () => (log.push('down'), true);
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const a = cellAt(table, 1, 'name')!;
        a.dispatchEvent(pointer('pointerdown', 421, { over: a }));
        a.dispatchEvent(pointer('pointerup', 421, { over: a }));
        expect(log).toEqual(['down', 'up:{"rowIndex":1,"columnKey":"name"}']);
        a.dispatchEvent(pointer('pointerdown', 422, { pointerType: 'touch', over: a }));
        a.dispatchEvent(pointer('pointerup', 422, { pointerType: 'touch', over: a })); // a touch is located by the hit test
        expect(log.slice(2)).toEqual(['down', 'up:{"rowIndex":1,"columnKey":"name"}']);
        wrapper.remove();
    });
});

describe('InteractionContext.hasOpenEditor', () => {
    it('is false for a missing editingCell answer (undefined), true only for a cell: `!= null`, like the state view', async () => {
        let context: { hasOpenEditor(): boolean } | undefined;
        const attach = vi.spyOn(EditSession.prototype, 'attach').mockImplementation(function (this: { context: { hasOpenEditor(): boolean } }) {
            context = this.context;
        });
        try {
            const table = await mountTable();
            const service = table.provider('interaction') as unknown as { editingCell: () => unknown };
            service.editingCell = () => undefined;
            expect(context!.hasOpenEditor()).toBe(false);
            service.editingCell = () => null;
            expect(context!.hasOpenEditor()).toBe(false);
            service.editingCell = () => ({ rowIndex: 0, columnKey: 'name' });
            expect(context!.hasOpenEditor()).toBe(true);
        } finally {
            attach.mockRestore();
        }
    });
});


describe('a touch tap on a popover that floats out of its cell', () => {
    it('focuses no cell (not the one that holds it) and leaves the popover focused', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const host = cellAt(table, 1, 'name')!;
        const under = cellAt(table, 3, 'age')!.getBoundingClientRect();
        const popover = document.createElement('div');
        popover.tabIndex = -1; // focusable by script, not a control by the rules
        popover.style.cssText = `position:fixed;left:${under.left}px;top:${under.top}px;width:${under.width}px;height:${under.height}px;z-index:50`;
        host.append(popover);
        popover.dispatchEvent(pointer('pointerdown', 391, { pointerType: 'touch', over: popover }));
        popover.dispatchEvent(pointer('pointerup', 391, { pointerType: 'touch', over: popover }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' }); // neither the cell that holds the popover nor the one under it
        popover.remove();
    });
});

describe('an anchor used as a button inside a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is a control too: `<a role="button" tabindex="0">` gets no offer and no start cell', async () => {
        const table = await mountTable();
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const anchor = document.createElement('a'); // no href: not a native link
        anchor.setAttribute('role', 'button');
        anchor.tabIndex = 0;
        anchor.textContent = 'open';
        cell.append(anchor);
        anchor.dispatchEvent(pointer('pointerdown', 351, { over: anchor }));
        anchor.dispatchEvent(pointer('pointerup', 351, { over: anchor }));
        expect(downs).toEqual([]);
    });

    it('and so is any anchor inside a cell, with or without href', async () => {
        const table = await mountTable();
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const bare = document.createElement('a'); // no href, no role, no tabindex
        bare.textContent = 'bare';
        const link = document.createElement('a');
        link.href = '#x';
        link.textContent = 'link';
        cell.append(bare, link);
        for (const [id, el] of [[352, bare], [353, link]] as const) {
            el.dispatchEvent(pointer('pointerdown', id, { over: el }));
            el.dispatchEvent(pointer('pointerup', id, { over: el }));
        }
        expect(downs).toEqual([]);
    });
});

describe('the open editor is ONE answer everywhere', () => {
    it('a provider a consumer wrapped is respected: data-editing is drawn on its cell AND a press inside it does not move the focus', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const real = table.provider('interaction')!;
        table.provide('interaction', { ...real, editingCell: () => ({ rowIndex: 1, columnKey: 'name' }) });
        table.requestUpdate();
        await settle(table);
        const cell = cellAt(table, 1, 'name')!;
        expect(cell.hasAttribute('data-editing')).toBe(true);
        cell.dispatchEvent(pointer('pointerdown', 371, { over: cell }));
        cell.dispatchEvent(pointer('pointerup', 371, { over: cell }));
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        const other = cellAt(table, 2, 'age')!;
        other.dispatchEvent(pointer('pointerdown', 372, { over: other }));
        other.dispatchEvent(pointer('pointerup', 372, { over: other }));
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' }); // another cell still takes the focus
    });
});

describe('a touch tap on a widget that stops pointerup', () => {
    it('keeps the widget\'s own focus (as on main): no tap focus; the same tap on a plain span focuses the cell', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const stopper = document.createElement('span');
        stopper.addEventListener('pointerup', (event) => event.stopPropagation());
        const plain = document.createElement('span');
        cell.append(stopper, plain);
        const tap = (id: number, el: Element): void => {
            el.dispatchEvent(pointer('pointerdown', id, { pointerType: 'touch', over: el }));
            el.dispatchEvent(pointer('pointerup', id, { pointerType: 'touch', over: el }));
        };
        tap(381, stopper);
        expect(table.focusedCell).toBeNull();
        tap(382, plain);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
    });
});

describe('a tap left pending by a stopped pointerup', () => {
    const controllerOf = (table: GeDataTable): Record<string, unknown> =>
        (table as unknown as { assembled: { controllers: Record<string, unknown>[] } }).assembled.controllers.find((c) => 'tapPending' in c)!;
    const tap = (el: Element, id: number): void => {
        el.dispatchEvent(pointer('pointerdown', id, { pointerType: 'touch', over: el }));
        el.dispatchEvent(pointer('pointerup', id, { pointerType: 'touch', over: el }));
    };

    it('is dropped at the next pointerdown and at detach (no event or press outlives it)', async () => {
        const table = await mountTable();
        const controller = controllerOf(table); // the controller outlives the detach
        const cell = cellAt(table, 1, 'name')!;
        const stopper = document.createElement('span');
        stopper.addEventListener('pointerup', (event) => event.stopPropagation());
        cell.append(stopper);
        tap(stopper, 481);
        expect(controller['tapPending']).not.toBeNull();
        stopper.dispatchEvent(pointer('pointerdown', 482, { pointerType: 'touch', over: stopper }));
        expect(controller['tapPending']).toBeNull();
        stopper.dispatchEvent(pointer('pointerup', 482, { pointerType: 'touch', over: stopper }));
        expect(controller['tapPending']).not.toBeNull();
        table.remove();
        expect(controller['tapPending']).toBeNull();
    });
});

describe('a release a window-level capture listener swallowed', () => {
    it('is closed by the next move of that mouse with no button down: Tab into the grid focuses a cell; a key never closes a press (Shift during a drag)', async () => {
        const table = await mountTable();
        const swallow = (event: Event): void => event.stopImmediatePropagation();
        window.addEventListener('pointerup', swallow, true);
        const outside = document.createElement('button');
        document.body.append(outside);
        try {
            const cell = cellAt(table, 1, 'name')!;
            cell.dispatchEvent(pointer('pointerdown', 491, { over: cell }));
            cell.dispatchEvent(pointer('pointerup', 491, { over: cell })); // swallowed: nothing hears it
        } finally {
            window.removeEventListener('pointerup', swallow, true);
        }
        outside.focus();
        outside.dispatchEvent(pointer('pointermove', 491, { buttons: 0 })); // the mouse moves with no button down: its release was lost
        outside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
        table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus(); // what the Tab does
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
        outside.remove();
    });
});

describe('the viewport focus a touch tap causes AFTER its pointerup', () => {
    it('is the tap\'s own (no hand-off to the first cell); the same focus 1 s later (a Tab) goes to the roving cell', async () => {
        const table = await mountTable();
        table.focusCell(2, 'age');
        await settle(table);
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const cell = cellAt(table, 1, 'name')!;
        const button = document.createElement('span'); // a plain element: a tap on a control takes its own focus (and is no "viewport tap")
        cell.append(button);
        button.dispatchEvent(pointer('pointerdown', 591, { pointerType: 'touch', over: button }));
        button.dispatchEvent(pointer('pointerup', 591, { pointerType: 'touch', over: button })); // the press ends
        (document.activeElement as HTMLElement).blur();
        viewport.focus(); // what the browser does for the tap, just after the pointerup
        await frames(2);
        expect(document.activeElement).toBe(viewport); // not handed to a cell (it used to jump to the first / roving cell)
        viewport.blur();
        await new Promise((resolve) => setTimeout(resolve, 700));
        viewport.focus(); // a Tab, much later
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
    });
});

describe('a release with no coordinates', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not hit-tested: a coordinate-less touch tap on a span in a cell focuses the cell, and a claimed coordinate-less mouse press gets that cell at its release', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const span = document.createElement('span');
        cell.append(span);
        const bare = (type: string, pointerType: string, id: number): PointerEvent => new PointerEvent(type, { bubbles: true, composed: true, button: 0, pointerId: id, pointerType });
        span.dispatchEvent(bare('pointerdown', 'touch', 601));
        span.dispatchEvent(bare('pointerup', 'touch', 601));
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
        table.focusCell(0, 'name');
        await settle(table);
        const ups: unknown[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void ups.push(at);
        span.dispatchEvent(bare('pointerdown', 'mouse', 602));
        span.dispatchEvent(bare('pointerup', 'mouse', 602));
        expect(ups).toEqual([{ rowIndex: 1, columnKey: 'name' }]);
    });
});

describe('a MOUSE release that was swallowed with no move since', () => {
    it('does not make the Tab in a pointer arrival: 700 ms later the viewport focus goes to a cell; during a fresh press it does not', async () => {
        const table = await mountTable();
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const cell = cellAt(table, 1, 'name')!;
        const swallow = (event: Event): void => event.stopImmediatePropagation();
        window.addEventListener('pointerup', swallow, true);
        try {
            cell.dispatchEvent(pointer('pointerdown', 561, { over: cell, buttons: 1 }));
            viewport.focus(); // the press's own viewport focus: fresh
            await frames(2);
            expect(document.activeElement).toBe(viewport);
            cell.dispatchEvent(pointer('pointerup', 561, { over: cell })); // swallowed: the press stays open, silent
        } finally {
            window.removeEventListener('pointerup', swallow, true);
        }
        (document.activeElement as HTMLElement).blur();
        await new Promise((resolve) => setTimeout(resolve, 700));
        viewport.focus(); // what a Tab does
        await frames(2);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
    });
});

describe('the document listeners of an open press', () => {
    it('exist only while a press is open: a pointermove or keydown with no press never calls into the controller', async () => {
        const table = await mountTable();
        const controller = (table as unknown as { assembled: { controllers: Record<string, unknown>[] } }).assembled.controllers.find((c) => 'tapPending' in c)!;
        const spy = vi.spyOn(controller as unknown as { closeStale(now: number): void }, 'closeStale');
        const fire = (buttons: number): void => {
            document.body.dispatchEvent(pointer('pointermove', 571, { buttons }));
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true }));
        };
        fire(0);
        expect(spy).not.toHaveBeenCalled();
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 571, { over: cell, buttons: 1 }));
        fire(1);
        expect(spy).toHaveBeenCalled(); // watched while the press is open
        spy.mockClear();
        cell.dispatchEvent(pointer('pointerup', 571, { over: cell }));
        fire(0);
        expect(spy).not.toHaveBeenCalled(); // and not after it ended
    });
});

describe('a press that is still held', () => {
    it('keeps "a pointer is down" through a key (Shift during a drag) and through a move with the button down: the viewport focus is not a Tab arrival', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 495, { over: cell, buttons: 1 }));
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true }));
        document.body.dispatchEvent(pointer('pointermove', 495, { buttons: 1 }));
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        viewport.focus();
        await frames(2);
        expect(document.activeElement).toBe(viewport); // not handed to a cell: a pointer is down
        document.dispatchEvent(pointer('pointerup', 495, { over: cell }));
    });
});

describe('a tap left pending by a stopped pointerup (after the dispatch)', () => {
    it('is dropped right after the dispatch: no event is kept alive', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const stopper = document.createElement('span');
        stopper.addEventListener('pointerup', (event) => event.stopPropagation());
        cell.append(stopper);
        const controller = (table as unknown as { assembled: { controllers: Record<string, unknown>[] } }).assembled.controllers.find((c) => 'tapPending' in c)!;
        stopper.dispatchEvent(pointer('pointerdown', 496, { pointerType: 'touch', over: stopper }));
        stopper.dispatchEvent(pointer('pointerup', 496, { pointerType: 'touch', over: stopper }));
        expect(controller['tapPending']).not.toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(controller['tapPending']).toBeNull();
    });
});

describe('the library\'s own controls and ARIA widgets in a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('are the control\'s own: a press on ge-select, ge-switch, a role=switch div or a role=combobox gets no offer and moves no focus', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const made = [document.createElement('ge-select'), document.createElement('ge-switch'), document.createElement('div'), document.createElement('span')];
        made[2]!.setAttribute('role', 'switch');
        made[3]!.setAttribute('role', 'combobox');
        cell.append(...made);
        made.forEach((el, i) => {
            el.dispatchEvent(pointer('pointerdown', 500 + i, { over: cell }));
            el.dispatchEvent(pointer('pointerup', 500 + i, { over: cell }));
        });
        expect(downs).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a release nothing needs the location of', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not located: an unclaimed mouse press makes no geometry read at its release when no session defines onPointerUp (and does when one does)', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const child = document.createElement('span');
        cell.append(child);
        const box = cell.getBoundingClientRect();
        const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
        try {
            for (const withUp of [false, true]) {
                if (withUp) hooks.onPointerUp = () => undefined;
                const id = withUp ? 511 : 510;
                const at = { clientX: box.left + 3, clientY: box.top + 3 }; // inside the cell
                const down = pointer('pointerdown', id, at);
                const up = pointer('pointerup', id, at);
                child.dispatchEvent(down);
                spy.mockClear();
                child.dispatchEvent(up);
                if (withUp) expect(spy).toHaveBeenCalled();
                else expect(spy).not.toHaveBeenCalled();
            }
        } finally {
            spy.mockRestore();
        }
    });

    it('is not located: an unclaimed TOUCH press that began on a header (nothing to focus or clear) makes no hit test; one on the body outside any cell does', async () => {
        const table = await mountTable();
        const head = table.querySelector<HTMLElement>('[data-slot="table-head"]')!;
        const body = table.querySelector<HTMLElement>('[data-slot="table-body"]')!;
        const filler = document.createElement('div');
        body.append(filler);
        const spy = vi.spyOn(Document.prototype, 'elementsFromPoint');
        try {
            const tap = (el: Element, id: number): void => {
                const box = el.getBoundingClientRect();
                const at = { pointerType: 'touch', clientX: box.left + 3, clientY: box.top + 3 };
                el.dispatchEvent(pointer('pointerdown', id, at));
                el.dispatchEvent(pointer('pointerup', id, at));
            };
            tap(head, 520);
            expect(spy).not.toHaveBeenCalled();
            tap(filler, 521);
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('a press on the body outside any cell whose element a renderer replaced', () => {
    it('clears the focus like the connected path does (mouse)', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        expect(table.focusedCell).not.toBeNull();
        const body = table.querySelector<HTMLElement>('[data-slot="table-body"]')!;
        const filler = document.createElement('div');
        body.append(filler);
        const down = pointer('pointerdown', 391, { over: filler });
        filler.addEventListener('pointerdown', () => filler.remove()); // the renderer replaces the pressed element during the dispatch
        filler.dispatchEvent(down);
        expect(table.focusedCell).toBeNull();
        document.dispatchEvent(pointer('pointerup', 391, { over: body }));
    });
});

describe('a component cell with a tabindex', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is a cell press, not a control: its root (or a span inside it) with tabindex=0 is offered and focuses the cell; `data-table-keeps-focus` is the opt-out', async () => {
        const table = await mountTable();
        const downs: unknown[] = [];
        hooks.onPointerDown = (_event, at) => void downs.push(at);
        const cell = cellAt(table, 1, 'name')!;
        const root = document.createElement('div'); // a component's root, tabbable for its own keyboard reasons
        root.tabIndex = 0;
        const inner = document.createElement('span');
        root.append(inner);
        cell.append(root);
        inner.dispatchEvent(pointer('pointerdown', 361, { over: inner }));
        inner.dispatchEvent(pointer('pointerup', 361, { over: inner }));
        expect(downs).toEqual([{ rowIndex: 1, columnKey: 'name' }]);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
        root.setAttribute('data-table-keeps-focus', '');
        inner.dispatchEvent(pointer('pointerdown', 362, { over: inner }));
        inner.dispatchEvent(pointer('pointerup', 362, { over: inner }));
        expect(downs).toHaveLength(1);
    });
});

describe('a press on a popover that floats out of its cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is the popover\'s own at the pointerdown too: no offer, no start cell, and the focus is not moved out of it', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const host = cellAt(table, 0, 'name')!;
        const under = cellAt(table, 2, 'age')!.getBoundingClientRect();
        const popover = document.createElement('div');
        popover.style.cssText = `position:fixed;left:${under.left}px;top:${under.top}px;width:${under.width}px;height:${under.height}px;z-index:50`;
        host.append(popover);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        for (const [id, pointerType] of [[361, 'mouse'], [362, 'touch']] as const) {
            popover.dispatchEvent(pointer('pointerdown', id, { pointerType, over: popover }));
            popover.dispatchEvent(pointer('pointerup', id, { pointerType, over: popover }));
        }
        await settle(table);
        expect(downs).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' }); // not moved to the cell that holds the popover (nor to the one under it)
        popover.remove();
    });
});

describe('a mouse release over a popover that floats out of its cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('reports the same as a touch there: not the cell that holds it', async () => {
        const table = await mountTable();
        const host = cellAt(table, 0, 'name')!;
        const under = cellAt(table, 2, 'age')!.getBoundingClientRect();
        const popover = document.createElement('div');
        popover.style.cssText = `position:fixed;left:${under.left}px;top:${under.top}px;width:${under.width}px;height:${under.height}px;z-index:50`;
        host.append(popover);
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        for (const [id, pointerType] of [[331, 'mouse'], [332, 'touch']] as const) {
            host.dispatchEvent(pointer('pointerdown', id, { pointerType, over: host })); // a claimed gesture that began on the cell
            (pointerType === 'mouse' ? popover : host).dispatchEvent(pointer('pointerup', id, { pointerType, over: popover })); // a touch is delivered to the pressed element
        }
        expect(log).toEqual(['up:null', 'up:null']);
        popover.remove();
    });
});

describe('a touch tap that began outside any cell', () => {
    it('is measured from where it went down: a 300 px drag over the empty body is no tap and keeps the focus', async () => {
        const table = await mountTable({ columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 1000 }, showToolbar: false }, {}, { width: 900, height: 600 });
        table.focusCell(0, 'c0');
        await settle(table);
        const group = table.querySelector<HTMLElement>('[data-kind="group"]')!;
        const box = group.getBoundingClientRect();
        const y = box.top + box.height / 2;
        group.dispatchEvent(pointer('pointerdown', 341, { pointerType: 'touch', clientX: box.left + 100, clientY: y }));
        group.dispatchEvent(pointer('pointerup', 341, { pointerType: 'touch', clientX: box.left + 400, clientY: y })); // 300 px along the row
        await settle(table);
        expect(table.focusedCell).not.toBeNull();
        group.dispatchEvent(pointer('pointerdown', 342, { pointerType: 'touch', clientX: box.left + 100, clientY: y }));
        group.dispatchEvent(pointer('pointerup', 342, { pointerType: 'touch', clientX: box.left + 103, clientY: y })); // a tap
        await settle(table);
        expect(table.focusedCell).toBeNull();
    });
});

describe('a touch tap on a cell', () => {
    it('focuses it with the step-0 sessions (none defines onPointerUp)', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 2, 'age')!;
        cell.dispatchEvent(pointer('pointerdown', 294, { pointerType: 'touch', over: cell }));
        cell.dispatchEvent(pointer('pointerup', 294, { pointerType: 'touch', over: cell }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });
});

describe('a nested table inside an OUTER detail row', () => {
    it('clears its own focus when its group row is pressed (mouse and touch): the outer detail row above it is not its detail row', async () => {
        const inner = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(inner, { columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 2 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false });
        const table = await mountTable({
            columns: makeColumns(3),
            data: makeRows(3, { columns: 3 }),
            enableRowExpansion: true,
            expandedRows: { r0: true },
            renderDetail: () => inner,
            paginationState: { pageIndex: 0, pageSize: 100 },
            showToolbar: false,
        });
        await settle(inner);
        const group = inner.querySelector<HTMLElement>('[data-kind="group"]')!;
        expect(group.closest('[data-kind="detail"]')).not.toBeNull(); // the outer detail row is above the whole inner table
        for (const [id, type] of [[581, 'mouse'], [582, 'touch']] as const) {
            inner.focusCell(0, 'c0');
            await settle(inner);
            expect(inner.focusedCell).not.toBeNull();
            group.dispatchEvent(pointer('pointerdown', id, { pointerType: type, over: group }));
            group.dispatchEvent(pointer('pointerup', id, { pointerType: type, over: group }));
            await settle(inner);
            expect(inner.focusedCell, type).toBeNull();
        }
        expect(table.focusedCell).toBeNull();
    });
});

describe('a pointerdown with no coordinates', () => {
    it('is a press on the cell it lands on (a synthetic event, or a fireEvent of a test library): it is not taken for floating out of the cell', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const span = document.createElement('span');
        cell.append(span);
        span.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0, pointerId: 583, pointerType: 'mouse' }));
        document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: true, button: 0, pointerId: 583, pointerType: 'mouse' }));
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
    });
});

describe('a nested table in an outer cell with the same column key', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('does not take the OUTER cell for its own: a press on its header has no start cell and focuses nothing; a press on its body cell is measured against its own cells', async () => {
        const nested = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(nested, { columns: [{ accessorKey: 'name', header: 'Name' }], data: [{ name: 'inner' }], showToolbar: false, showPagination: false });
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '300px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? nested : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        await settle(nested);
        const starts: unknown[] = [];
        hooks.onPointerDown = (_event, at, press) => void starts.push({ at, start: press.startCell });
        const head = nested.querySelector<HTMLElement>('[data-slot="table-head"]')!;
        const box = head.getBoundingClientRect();
        head.dispatchEvent(pointer('pointerdown', 531, { clientX: box.left + 3, clientY: box.top + 3 }));
        head.dispatchEvent(pointer('pointerup', 531, { clientX: box.left + 3, clientY: box.top + 3 }));
        expect(starts).toEqual([{ at: null, start: null }]); // offered, with no cell: the OUTER cell (row 0, name) is not this table's
        expect(nested.focusedCell).toBeNull();
        const inner = nested.querySelector<HTMLElement>('[data-slot="table-body"] [data-slot="table-cell"]')!;
        const innerBox = inner.getBoundingClientRect();
        inner.dispatchEvent(pointer('pointerdown', 532, { clientX: innerBox.left + 3, clientY: innerBox.top + 3 }));
        inner.dispatchEvent(pointer('pointerup', 532, { clientX: innerBox.left + 3, clientY: innerBox.top + 3 }));
        expect(nested.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        expect(table.focusedCell).toBeNull(); // the outer table never saw the inner presses
    });
});

describe('a TOUCH press whose release was swallowed', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });
    const presses = (table: GeDataTable): Map<number, unknown> =>
        (table as unknown as { assembled: { controllers: Record<string, unknown>[] } }).assembled.controllers.find((c) => 'presses' in c)!['presses'] as Map<number, unknown>;
    const at = (type: string, id: number, over: Element, stamp?: number): PointerEvent => {
        const event = pointer(type, id, { pointerType: 'touch', over });
        if (stamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: stamp });
        return event;
    };

const swallowed = (table: GeDataTable, claimed: boolean): { key: (stamp: number) => KeyboardEvent; cell: HTMLElement } => {
        if (claimed) hooks.onPointerDown = () => true;
        const cell = cellAt(table, 1, 'name')!;
        const swallow = (event: Event): void => event.stopImmediatePropagation();
        window.addEventListener('pointerup', swallow, true);
        try {
            cell.dispatchEvent(at('pointerdown', 541, cell, 1000));
            cell.dispatchEvent(at('pointerup', 541, cell, 1100));
        } finally {
            window.removeEventListener('pointerup', swallow, true);
        }
        return {
            cell,
            key: (stamp) => {
                const event = new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true });
                Object.defineProperty(event, 'timeStamp', { value: stamp });
                return event;
            },
        };
    };

    it('an UNCLAIMED one is closed after 2 s of silence by the next key', async () => {
        const table = await mountTable();
        const { key } = swallowed(table, false);
        expect(presses(table).size).toBe(1);
        document.body.dispatchEvent(key(2500)); // 1.5 s after its last event: still held
        expect(presses(table).size).toBe(1);
        document.body.dispatchEvent(key(3200)); // 2.2 s: lost
        expect(presses(table).size).toBe(0);
    });

    it('a CLAIMED one (a long-press gesture of a session) is never closed by silence: not by a key, not by a second finger', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        const { key, cell } = swallowed(table, true);
        document.body.dispatchEvent(key(4000)); // 3 s of stillness
        cell.dispatchEvent(at('pointerdown', 546, cell, 5000)); // a second finger
        expect(presses(table).has(541)).toBe(true);
        expect(log).toEqual([]);
        document.dispatchEvent(pointer('pointerup', 546, { pointerType: 'touch', over: cell }));
        presses(table).clear();
    });

    it('Tab in after more than 2 s of real silence focuses a cell (the stale press is closed by the viewport focus)', async () => {
        const table = await mountTable();
        const swallow = (event: Event): void => event.stopImmediatePropagation();
        window.addEventListener('pointerup', swallow, true);
        const cell = cellAt(table, 1, 'name')!;
        try {
            cell.dispatchEvent(pointer('pointerdown', 542, { pointerType: 'touch', over: cell }));
            cell.dispatchEvent(pointer('pointerup', 542, { pointerType: 'touch', over: cell }));
        } finally {
            window.removeEventListener('pointerup', swallow, true);
        }
        expect(presses(table).size).toBe(1);
        await new Promise((resolve) => setTimeout(resolve, 2100));
        table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!.focus();
        await frames(2);
        expect(presses(table).size).toBe(0);
        expect((document.activeElement as HTMLElement).matches('[data-slot="table-cell"]')).toBe(true);
    });

    it('is NOT closed while its moves keep it fresh, nor is a held mouse press by a Shift', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(at('pointerdown', 543, cell, 1000));
        const move = pointer('pointermove', 543, { pointerType: 'touch', buttons: 1 });
        Object.defineProperty(move, 'timeStamp', { value: 2900 });
        document.body.dispatchEvent(move);
        const key = new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true });
        Object.defineProperty(key, 'timeStamp', { value: 3900 }); // 1 s after the last move
        document.body.dispatchEvent(key);
        expect(presses(table).size).toBe(1);
        cell.dispatchEvent(pointer('pointerdown', 544, { over: cell, buttons: 1 })); // a held mouse press
        const late = new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true });
        Object.defineProperty(late, 'timeStamp', { value: 99999 });
        document.body.dispatchEvent(late);
        expect(presses(table).has(544)).toBe(true); // only touch presses go stale by silence; a mouse is closed by a move with no button
        document.dispatchEvent(pointer('pointerup', 543, { pointerType: 'touch', over: cell }));
        document.dispatchEvent(pointer('pointerup', 544, { over: cell }));
    });
});

describe('a label in a cell', () => {
    it('a styling <label> wrapper is a cell press (focuses the cell); an input inside a label is still the control\'s own', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const cell = cellAt(table, 1, 'name')!;
        const label = document.createElement('label');
        label.textContent = 'text';
        const wrapped = document.createElement('label');
        const input = document.createElement('input');
        wrapped.append(input);
        cell.append(label, wrapped);
        input.dispatchEvent(pointer('pointerdown', 610, { over: cell }));
        input.dispatchEvent(pointer('pointerup', 610, { over: cell }));
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' }); // the control's own: no focus move
        label.dispatchEvent(pointer('pointerdown', 611, { over: cell }));
        label.dispatchEvent(pointer('pointerup', 611, { over: cell }));
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
    });
});

describe('a summary and a media control in a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('are the control\'s own: no offer, no focus move', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const cell = cellAt(table, 1, 'name')!;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'more';
        details.append(summary);
        const video = document.createElement('video');
        video.setAttribute('controls', '');
        const audio = document.createElement('audio');
        audio.setAttribute('controls', '');
        cell.append(details, video, audio);
        [summary, video, audio].forEach((el, i) => {
            el.dispatchEvent(pointer('pointerdown', 550 + i, { over: cell }));
            el.dispatchEvent(pointer('pointerup', 550 + i, { over: cell }));
        });
        expect(downs).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a press in a NESTED table outside its own cells', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('on its header text is a cell-table press like in a non-nested table: the outer cell above the whole table is not "its cell", and the climb stops at its own root', async () => {
        const nested = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(nested, { columns: [{ accessorKey: 'name', header: 'Name' }], data: [{ name: 'inner' }], showToolbar: false, showPagination: false });
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '300px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? nested : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        await settle(nested);
        const downs: PointerPress[] = [];
        hooks.onPointerDown = (_event, _at, press) => void downs.push(press);
        // the nested table's header cell: a press there is outside the nested table's DATA cells
        const head = nested.querySelector<HTMLElement>('[data-slot="table-head"]')!;
        const text = head.querySelector<HTMLElement>('*') ?? head;
        const box = head.getBoundingClientRect();
        text.dispatchEvent(pointer('pointerdown', 511, { clientX: box.left + 3, clientY: box.top + 3 }));
        expect(downs).toHaveLength(1); // offered, not bypassed as a "control" (the outer cell's tabindex / the viewport above the nested root)
        expect(table).toBeDefined();
    });
});

describe('a renderer that replaces its content in its own pointerdown', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is still the cell\'s press: the mouse press is offered and focuses, and a touch tap focuses (the target left the DOM during the dispatch)', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'age')!;
        const child = document.createElement('span');
        child.textContent = 'x';
        cell.append(child);
        child.addEventListener('pointerdown', () => child.remove()); // a renderer swaps its content in its own handler (bubble, before the root's)
        const offers: string[] = [];
        hooks.onPointerDown = () => void offers.push('down');
        child.dispatchEvent(pointer('pointerdown', 521, { over: cell }));
        cell.dispatchEvent(pointer('pointerup', 521, { over: cell }));
        await settle(table);
        expect(offers).toEqual(['down']);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'age' });
        table.focusCell(0, 'name');
        await settle(table);
        const second = document.createElement('span');
        second.textContent = 'y';
        cellAt(table, 2, 'age')!.append(second);
        second.addEventListener('pointerdown', () => second.remove());
        second.dispatchEvent(pointer('pointerdown', 522, { pointerType: 'touch', over: cellAt(table, 2, 'age')! }));
        cellAt(table, 2, 'age')!.dispatchEvent(pointer('pointerup', 522, { pointerType: 'touch', over: cellAt(table, 2, 'age')! }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });
});

describe('the press object a session receives', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is ONE frozen object for the whole press: the same identity at its pointerdown and its pointerup', async () => {
        const table = await mountTable();
        const seen: PointerPress[] = [];
        hooks.onPointerDown = (_event, _at, press) => (seen.push(press), true);
        hooks.onPointerUp = (_event, _at, press) => void seen.push(press);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 531, { over: cell }));
        cell.dispatchEvent(pointer('pointerup', 531, { over: cell }));
        expect(seen).toHaveLength(2);
        expect(seen[1]).toBe(seen[0]);
        expect(Object.isFrozen(seen[0])).toBe(true);
    });
});

describe('a session that ends the press in onPointerDown and does not claim', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is the last one offered: a LATER session never sees a press that is already over', async () => {
        const table = await mountTable();
        const calls: string[] = [];
        hooks.onPointerDown = () => {
            calls.push('range');
            table.remove(); // ends the press, does not claim
            return false;
        };
        editHooks.onPointerDown = () => void calls.push('edit');
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 561, { over: cell }));
        expect(calls).toEqual(['range']);
    });
});

describe('a session whose keepValue throws inside its hostUpdate', () => {
    it('is reported ONCE in that update (its value rules do not run a second time in the broken loop)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const table = await mountTable({ enableCellRangeSelection: true });
        error.mockClear();
        const keep = vi.spyOn(RangeSession.prototype, 'keepValue').mockImplementation(() => {
            throw new Error('keepValue failed');
        });
        try {
            table.requestUpdate();
            await settle(table);
            expect(keep).toHaveBeenCalledTimes(1); // in its hostUpdate only
            expect(error).toHaveBeenCalledTimes(1);
        } finally {
            keep.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a session whose keepValue keeps throwing after it failed in its hostUpdate', () => {
    it('is reported ONCE across several updates (the failure and the broken loop share one report)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const table = await mountTable({ enableCellRangeSelection: true });
        error.mockClear();
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            throw new Error('hostUpdate failed');
        });
        const keep = vi.spyOn(RangeSession.prototype, 'keepValue').mockImplementation(() => {
            throw new Error('keepValue failed');
        });
        try {
            for (let i = 0; i < 4; i++) {
                table.requestUpdate();
                await settle(table);
            }
            expect(keep.mock.calls.length).toBeGreaterThan(1); // the broken loop did run it
            expect(error).toHaveBeenCalledTimes(1);
        } finally {
            update.mockRestore();
            keep.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a session that fails again after a reconnect', () => {
    it('is reported again: each attach period reports its first failure', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        let message = 'one';
        let failing = true;
        const update = vi.spyOn(RangeSession.prototype, 'hostUpdate').mockImplementation(() => {
            if (failing) throw new Error(message);
        });
        try {
            const table = await mountTable();
            const parent = table.parentElement!;
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toEqual(['one']);
            table.remove(); // detach: the failure is forgotten
            message = 'two';
            parent.append(table); // attach again, and the session fails again, differently
            await settle(table);
            expect(error.mock.calls.map((call) => String((call[1] as Error).message))).toEqual(['one', 'two']);
            failing = false;
        } finally {
            update.mockRestore();
            error.mockRestore();
        }
    });
});

describe('two pointerdowns of the same pointer that only the root hears', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('end the first press (one cancel, no event) and leave ONE watcher pair: no overwritten press, no leaked listeners', async () => {
        // A table in a shadow root, and NON-composed synthetic events: they never leave the shadow tree, so the document does not hear them.
        const host = document.createElement('div');
        document.body.append(host);
        const frame = document.createElement('div');
        frame.style.cssText = 'width:600px;height:400px;';
        host.attachShadow({ mode: 'open' }).append(frame);
        const table = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS });
        frame.append(table);
        const added: string[] = [];
        const removed: string[] = [];
        const add = vi.spyOn(Document.prototype, 'addEventListener').mockImplementation(function (this: Document, type: string, ...rest: unknown[]) {
            if (type === 'pointermove' || type === 'keydown') added.push(type);
            return EventTarget.prototype.addEventListener.call(this, type, ...(rest as [EventListenerOrEventListenerObject, AddEventListenerOptions]));
        });
        const remove = vi.spyOn(Document.prototype, 'removeEventListener').mockImplementation(function (this: Document, type: string, ...rest: unknown[]) {
            if (type === 'pointermove' || type === 'keydown') removed.push(type);
            return EventTarget.prototype.removeEventListener.call(this, type, ...(rest as [EventListenerOrEventListenerObject, EventListenerOptions]));
        });
        try {
            await settle(table);
            const log: string[] = [];
            hooks.onPointerDown = () => true;
            hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
            const cell = cellAt(table, 1, 'name')!;
            const down = (): PointerEvent => new PointerEvent('pointerdown', { bubbles: true, composed: false, button: 0, pointerId: 651, pointerType: 'mouse', clientX: 30, clientY: 30 });
            added.length = 0;
            removed.length = 0;
            cell.dispatchEvent(down());
            cell.dispatchEvent(down()); // the same pointer again, its release never came
            expect(log).toEqual(['cancel:null']);
            const net = (): number => added.filter((type) => type === 'pointermove').length - removed.filter((type) => type === 'pointermove').length;
            expect(net()).toBe(1); // the first press's pair went with it: ONE pair is watching
            cell.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, composed: false, button: 0, pointerId: 651, pointerType: 'mouse', clientX: 30, clientY: 30 }));
            expect(net()).toBe(0); // the last press takes the last pair away: nothing leaked
        } finally {
            add.mockRestore();
            remove.mockRestore();
            host.remove();
        }
    });
});

describe('a table inside a contenteditable region', () => {
    it('keeps its navigation keys (the editable ancestor outside the table is not a text field of the grid); a real input inside a cell still keeps its keys', async () => {
        const region = document.createElement('div');
        region.setAttribute('contenteditable', 'true');
        document.body.append(region);
        const table = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS });
        region.append(table);
        try {
            await settle(table);
            table.focusCell(0, 'name');
            await settle(table);
            const cell = cellAt(table, 0, 'name')!;
            cell.focus();
            // The key event is dispatched ON the cell (a real browser may retarget keys in an editing host to the host itself; this is the event that reaches the grid).
            const key = (el: Element, name: string): void => void el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, composed: true, cancelable: true }));
            key(cell, 'ArrowDown');
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
            // a text input inside a cell keeps its own keys: ArrowDown there does not move the roving cell
            const input = document.createElement('input');
            cellAt(table, 1, 'name')!.append(input);
            input.focus();
            key(input, 'ArrowDown');
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
        } finally {
            region.remove();
        }
    });
});

describe('a control in a draggable header', () => {
    it('keeps its own press: a ge-slider (a library control) or a role=slider element does not start a column drag; plain header text does', async () => {
        const table = await mountTable({ enableColumnReorder: true });
        const head = table.querySelector<HTMLElement>('[data-slot="table-head"][data-draggable]');
        if (!head) throw new Error('no draggable header in this setup');
        const box = head.getBoundingClientRect();
        const slider = document.createElement('ge-slider');
        const aria = document.createElement('div');
        aria.setAttribute('role', 'slider');
        head.append(slider, aria);
        const dragged = (el: Element): boolean => {
            el.dispatchEvent(pointer('pointerdown', 661, { clientX: box.left + 3, clientY: box.top + 3 }));
            document.dispatchEvent(pointer('pointermove', 661, { clientX: box.left + 40, clientY: box.top + 3, buttons: 1 }));
            const started = table.querySelector('[data-dragging], [data-table-dragging]') !== null;
            document.dispatchEvent(pointer('pointerup', 661, { clientX: box.left + 40, clientY: box.top + 3 }));
            return started;
        };
        expect(dragged(slider)).toBe(false);
        expect(dragged(aria)).toBe(false);
        expect(dragged(head)).toBe(true); // the positive control: a press on the header itself drags
    });
});

describe('controls seen through the composed path', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('a consumer component (in no list) with an OPEN shadow root: a press on its inner input is the control\'s own; a plain inner span is a cell press', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const host = document.createElement('x-consumer-widget');
        const root = host.attachShadow({ mode: 'open' });
        const input = document.createElement('input');
        const span = document.createElement('span');
        root.append(input, span);
        cellAt(table, 1, 'name')!.append(host);
        input.dispatchEvent(pointer('pointerdown', 641, { over: host }));
        input.dispatchEvent(pointer('pointerup', 641, { over: host }));
        expect(downs).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        span.dispatchEvent(pointer('pointerdown', 642, { over: host }));
        span.dispatchEvent(pointer('pointerup', 642, { over: host }));
        expect(downs).toEqual(['down']); // not a control: a cell press
    });

    it('inside the shadow root of a consumer widget only real form controls count: an SVG anchor and a role=option wrapper are a cell press', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const host = document.createElement('x-consumer-widget');
        const root = host.attachShadow({ mode: 'open' });
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
        const wrapper = document.createElement('div');
        wrapper.setAttribute('role', 'option');
        const inner = document.createElement('span');
        wrapper.append(inner);
        svg.append(anchor);
        root.append(svg, wrapper);
        cellAt(table, 1, 'name')!.append(host);
        for (const [id, el] of [[644, anchor], [645, inner]] as const) {
            el.dispatchEvent(pointer('pointerdown', id, { over: host }));
            el.dispatchEvent(pointer('pointerup', id, { over: host }));
        }
        expect(downs).toEqual(['down', 'down']); // both are cell presses
    });

    it('a library control with a CLOSED shadow root still counts (the path stops at its host, which is in the list)', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const downs: unknown[] = [];
        hooks.onPointerDown = () => void downs.push('down');
        const host = document.createElement('ge-signature-pad');
        const inner = document.createElement('div');
        host.attachShadow({ mode: 'closed' }).append(inner);
        cellAt(table, 1, 'name')!.append(host);
        inner.dispatchEvent(pointer('pointerdown', 643, { over: host }));
        inner.dispatchEvent(pointer('pointerup', 643, { over: host }));
        expect(downs).toEqual([]);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
    });
});

describe('a CLAIMED touch press whose release was swallowed', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is ended by the next PRIMARY touch (no other finger is down): the claimant gets one cancel; a second, non-primary finger during a held press ends nothing', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event === null ? 'null' : event.type}`);
        const cell = cellAt(table, 1, 'name')!;
        const other = cellAt(table, 2, 'age')!;
        cell.dispatchEvent(pointer('pointerdown', 631, { pointerType: 'touch', over: cell, isPrimary: true }));
        // a second finger of the gesture (not primary): the held press goes on
        other.dispatchEvent(pointer('pointerdown', 632, { pointerType: 'touch', over: other, isPrimary: false }));
        expect(log).toEqual([]);
        other.dispatchEvent(pointer('pointerup', 632, { pointerType: 'touch', over: other, isPrimary: false }));
        expect(log).toEqual(['cancel:pointerup']); // only the second finger's own end (it has no onPointerUp: its release is a cancel); the first press is still open
        // the first finger's release was swallowed; a new gesture starts with a primary touch elsewhere
        document.body.dispatchEvent(pointer('pointerdown', 633, { pointerType: 'touch', isPrimary: true }));
        expect(log).toEqual(['cancel:pointerup', 'cancel:null']); // the first press: one cancel, no event
        document.body.dispatchEvent(pointer('pointerup', 633, { pointerType: 'touch', isPrimary: true }));
    });
});

describe('the viewport focus after a touch press', () => {
    const setup = async (props: Record<string, unknown> = {}) => {
        const table = await mountTable(props);
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        // Focus the viewport right after a press (what the browser does), reporting whether it was handed to a cell (a Tab arrival).
        const focusViewport = async (): Promise<boolean> => {
            (document.activeElement as HTMLElement).blur();
            viewport.focus();
            await frames(2);
            const handed = (document.activeElement as HTMLElement).matches('[data-slot="table-cell"]');
            (document.activeElement as HTMLElement).blur();
            return handed;
        };
        const tap = (el: Element, id: number, up = 'pointerup'): void => {
            const box = el.getBoundingClientRect();
            const at = { pointerType: 'touch', clientX: box.left + 3, clientY: box.top + 3 };
            el.dispatchEvent(pointer('pointerdown', id, at));
            el.dispatchEvent(pointer(up, id, at));
        };
        return { table, focusViewport, tap };
    };

    it('after a scroll (pointercancel) is a Tab arrival: it goes to the roving cell', async () => {
        const { table, focusViewport, tap } = await setup();
        tap(cellAt(table, 1, 'name')!, 621, 'pointercancel');
        expect(await focusViewport()).toBe(true);
    });

    it('after a tap on a header CONTROL (the select-all checkbox) is a Tab arrival: the control took its own focus, so it goes to the roving cell', async () => {
        const { table, focusViewport, tap } = await setup({ enableRowSelection: true });
        const sort = table.querySelector<HTMLElement>('[data-slot="table-head"] ge-checkbox')!;
        expect(sort).not.toBeNull();
        tap(sort, 624);
        expect(await focusViewport()).toBe(true);
    });

    it('after a tap on a header or on the footer belongs to that tap (both are inside the viewport): no jump to a cell', async () => {
        const { table, focusViewport, tap } = await setup({ columns: [{ accessorKey: 'name', header: 'Name', width: '200px', sortable: false, footer: 'Total' }, { accessorKey: 'age', header: 'Age', width: '120px' }] });
        tap(table.querySelector<HTMLElement>('[data-slot="table-head"]')!, 622);
        expect(await focusViewport()).toBe(false);
        const footer = table.querySelector<HTMLElement>('[data-slot="table-footer"]')!;
        expect(footer).not.toBeNull();
        tap(footer, 623);
        expect(await focusViewport()).toBe(false);
    });
});
describe('hasPosition', () => {
    it('is false only for an UNTRUSTED event with all-zero coordinates: a real (trusted) press at (0, 0) has a position', () => {
        const at = (isTrusted: boolean, clientX = 0, clientY = 0, screenX = 0, screenY = 0) => ({ isTrusted, clientX, clientY, screenX, screenY });
        expect(hasPosition(at(false))).toBe(false); // new PointerEvent('pointerdown'), fireEvent
        expect(hasPosition(at(true))).toBe(true); // a real press in the corner of the page
        expect(hasPosition(at(false, 5))).toBe(true);
        expect(hasPosition(at(false, 0, 0, 0, 7))).toBe(true);
        expect(hasPosition(new PointerEvent('pointerdown'))).toBe(false); // untrusted, no position
    });
});

describe('a column-resize drag released over the body', () => {
    it('is not located: an unclaimed mouse press with no start cell makes no hit test at its release', async () => {
        const table = await mountTable({ enableColumnResize: true });
        const handle = table.querySelector<HTMLElement>('[data-slot="table-head"] [data-slot="data-table-resize-handle"]')!;
        const target = cellAt(table, 2, 'age')!;
        const spy = vi.spyOn(Document.prototype, 'elementsFromPoint');
        try {
            await mouseDrag(handle, target, { steps: 3 });
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('a release of a press that is not offered', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is not located: a touch tap on an in-cell checkbox (a control) makes no hit test', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const box = document.createElement('input');
        box.type = 'checkbox';
        cell.append(box);
        const down = pointer('pointerdown', 551, { pointerType: 'touch', over: box });
        const up = pointer('pointerup', 551, { pointerType: 'touch', over: box });
        const spy = vi.spyOn(Document.prototype, 'elementsFromPoint');
        try {
            box.dispatchEvent(down);
            box.dispatchEvent(up);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('one release path for every press', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('a mouse release is located by its path target: no hit test (the cheap check)', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const down = pointer('pointerdown', 501, { over: cell });
        const up = pointer('pointerup', 501, { over: cell });
        const spy = vi.spyOn(Document.prototype, 'elementsFromPoint');
        try {
            cell.dispatchEvent(down);
            cell.dispatchEvent(up);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it('a touch tap released over a FOREIGN element on top of the cell focuses nothing, with or without a session that defines onPointerUp (same result)', async () => {
        for (const withUp of [false, true]) {
            const table = await mountTable();
            table.focusCell(0, 'name');
            await settle(table);
            if (withUp) hooks.onPointerUp = () => undefined;
            const cell = cellAt(table, 2, 'age')!;
            const box = cell.getBoundingClientRect();
            const foreign = document.createElement('div'); // not part of the table, drawn over the cell
            foreign.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;z-index:9999`;
            document.body.append(foreign);
            cell.dispatchEvent(pointer('pointerdown', withUp ? 503 : 502, { pointerType: 'touch', over: cell }));
            cell.dispatchEvent(pointer('pointerup', withUp ? 503 : 502, { pointerType: 'touch', over: foreign })); // the touch pointerup goes to the pressed cell, the finger is over the foreign element
            await settle(table);
            expect(table.focusedCell, `withUp=${withUp}`).toEqual({ rowIndex: 0, columnKey: 'name' });
            foreign.remove();
            table.remove();
        }
    });
});

describe('a press that begins on an overlay of the table', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    async function readoutButton(table: GeDataTable): Promise<HTMLButtonElement> {
        const cell = cellAt(table, 1, 'name')!;
        const rect = cell.getBoundingClientRect();
        const button = document.createElement('button');
        button.setAttribute('data-pointer-transparent', ''); // an interactive overlay (a readout button) over a cell
        button.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        table.querySelector('[data-slot="data-table-viewport"]')!.append(button);
        return button;
    }

    it('is the overlay\'s: a touch tap and a mouse click on it focus no cell and offer nothing to the sessions (no start cell)', async () => {
        const table = await mountTable();
        const offers: unknown[] = [];
        hooks.onPointerUp = (_event, at) => void offers.push(at);
        const downs: PointerPress[] = [];
        hooks.onPointerDown = (_event, at, press) => void downs.push(press);
        const button = await readoutButton(table);
        for (const [id, pointerType] of [[281, 'touch'], [282, 'mouse']] as const) {
            button.dispatchEvent(pointer('pointerdown', id, { pointerType, over: button }));
            button.dispatchEvent(pointer('pointerup', id, { pointerType, over: button }));
        }
        await settle(table);
        expect(table.focusedCell).toBeNull();
        expect(offers).toEqual([]);
        expect(downs).toEqual([]); // the readout's button is a control: its press is not offered either
        button.remove();
    });

    async function fillHandleLike(table: GeDataTable): Promise<HTMLElement> {
        const cell = cellAt(table, 1, 'name')!;
        const rect = cell.getBoundingClientRect();
        const handle = document.createElement('div'); // not a control: a transparent overlay like the fill handle
        handle.setAttribute('data-pointer-transparent', '');
        handle.style.cssText = `position:fixed;left:${rect.right - 8}px;top:${rect.bottom - 8}px;width:10px;height:10px;z-index:50`;
        table.querySelector('[data-slot="data-table-viewport"]')!.append(handle);
        return handle;
    }

    it('is OFFERED when it is not a control (the fill handle): a session can claim it (pressed = the overlay, at and start cell null) and gets its pointerup with the cell under the release', async () => {
        const table = await mountTable();
        const handle = await fillHandleLike(table);
        const log: string[] = [];
        const seen: PointerPress[] = [];
        hooks.onPointerDown = (_event, at, press) => {
            seen.push(press);
            log.push(`down:${JSON.stringify(at)}`);
            return press.pressed === handle; // a session recognises its own overlay by `pressed`
        };
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const target = cellAt(table, 2, 'age')!;
        handle.dispatchEvent(pointer('pointerdown', 541, { pointerType: 'touch', over: handle }));
        handle.dispatchEvent(pointer('pointerup', 541, { pointerType: 'touch', over: target })); // a touch pointerup goes to the pressed overlay; the finger is over the cell
        expect(log).toEqual(['down:null', 'up:{"rowIndex":2,"columnKey":"age"}']);
        expect(seen[0]!.startCell).toBeNull();
        handle.remove();
    });

    it('does nothing when UNclaimed: no focus move, no tap focus, no pointerup offer', async () => {
        const table = await mountTable();
        table.focusCell(0, 'name');
        await settle(table);
        const handle = await fillHandleLike(table);
        const log: string[] = [];
        hooks.onPointerDown = () => void log.push('down'); // offered, does not claim
        hooks.onPointerUp = () => void log.push('up');
        for (const [id, pointerType] of [[542, 'mouse'], [543, 'touch']] as const) {
            handle.dispatchEvent(pointer('pointerdown', id, { pointerType, over: handle }));
            handle.dispatchEvent(pointer('pointerup', id, { pointerType, over: handle }));
        }
        await settle(table);
        expect(log).toEqual(['down', 'down']); // offered at the pointerdowns, never at a pointerup
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' });
        handle.remove();
    });

    it('still lets a CLAIMED gesture that began on a cell be released over the transparent overlay: the cell under it', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const button = await readoutButton(table);
        const start = cellAt(table, 0, 'name')!;
        start.dispatchEvent(pointer('pointerdown', 283, { pointerType: 'touch', over: start }));
        start.dispatchEvent(pointer('pointerup', 283, { pointerType: 'touch', over: button }));
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"name"}']);
        button.remove();
    });
});

describe('a touch tap on a cell covered by an overlay of the table', () => {
    it('is the overlay\'s (the last row under a sticky readout is not focused by a tap on the readout)', async () => {
        const table = await mountTable();
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const last = cellAt(table, table.data.length - 1, 'name')!;
        const rect = last.getBoundingClientRect();
        const readout = document.createElement('div');
        readout.setAttribute('data-slot', 'range-actions');
        readout.setAttribute('data-pointer-transparent', ''); // every overlay marks itself: the controller keeps no list of wave slots
        readout.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        viewport.append(readout);
        // the tap lands on the readout (its pointerdown, and the pointerup delivered to it by the implicit capture), over the last cell
        readout.dispatchEvent(pointer('pointerdown', 191, { pointerType: 'touch', over: readout }));
        readout.dispatchEvent(pointer('pointerup', 191, { pointerType: 'touch', over: readout }));
        await settle(table);
        expect(table.focusedCell).toBeNull();
        readout.remove();
    });

    it('any element marked data-pointer-transparent is the same', async () => {
        const table = await mountTable();
        const cell = cellAt(table, 1, 'name')!;
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const rect = cell.getBoundingClientRect();
        const cover = document.createElement('div');
        cover.setAttribute('data-pointer-transparent', '');
        cover.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        viewport.append(cover);
        cover.dispatchEvent(pointer('pointerdown', 192, { pointerType: 'touch', over: cover }));
        cover.dispatchEvent(pointer('pointerup', 192, { pointerType: 'touch', over: cover }));
        await settle(table);
        expect(table.focusedCell).toBeNull();
        cover.remove();
    });

    it('stops at the first element of the table that is not an overlay: a tap on the sticky header with rows scrolled under it focuses no body cell, and a tap on a popover of the table keeps the focus in the popover', async () => {
        const table = await mountTable({ data: makeRows(60), showPagination: false, showToolbar: false }, {}, { width: 600, height: 220 });
        await scrollGrid(table, { top: 400 });
        await settle(table);
        const header = table.querySelector<HTMLElement>('[data-slot="table-head"]')!;
        const headRect = header.getBoundingClientRect();
        // a body cell really is under the sticky header at that point (the rows scrolled under it)
        const under = document.elementsFromPoint(headRect.left + 10, headRect.top + headRect.height / 2);
        expect(under.some((el) => el.closest('[data-slot="table-cell"]') !== null)).toBe(true);
        header.dispatchEvent(pointer('pointerdown', 201, { pointerType: 'touch', over: header }));
        header.dispatchEvent(pointer('pointerup', 201, { pointerType: 'touch', over: header }));
        await settle(table);
        expect(table.focusedCell).toBeNull();
        // an in-table popover over a body cell: the tap is the popover's, the focus stays in it
        const target = table.querySelector<HTMLElement>('[data-slot="table-body"] [data-slot="table-cell"]')!;
        const rect = target.getBoundingClientRect();
        const popover = document.createElement('button');
        popover.textContent = 'menu item';
        popover.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        table.append(popover);
        popover.focus();
        popover.dispatchEvent(pointer('pointerdown', 202, { pointerType: 'touch', over: popover }));
        popover.dispatchEvent(pointer('pointerup', 202, { pointerType: 'touch', over: popover }));
        await settle(table);
        expect(document.activeElement).toBe(popover);
        expect(table.focusedCell).toBeNull();
        popover.remove();
    });
});

describe('a touch release is decided by where the finger is, not by the pressed element', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is a cancel for the claimant when the finger is released outside the table, and a pointerup with the cell under the finger when it is released on another cell', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        const a = cellAt(table, 1, 'name')!;
        const b = cellAt(table, 2, 'age')!;
        // a touch delivers its pointerup to the PRESSED element (implicit capture), here A, whatever is under the finger
        a.dispatchEvent(pointer('pointerdown', 171, { pointerType: 'touch' }));
        a.dispatchEvent(pointer('pointerup', 171, { pointerType: 'touch', clientX: window.innerWidth - 3, clientY: window.innerHeight - 3 }));
        expect(log).toEqual(['cancel:pointerup']);
        log.length = 0;
        a.dispatchEvent(pointer('pointerdown', 172, { pointerType: 'touch' }));
        a.dispatchEvent(pointer('pointerup', 172, { pointerType: 'touch', over: b }));
        expect(log).toEqual(['up:{"rowIndex":2,"columnKey":"age"}']);
    });

    it('keeps the mouse as it was: a mouse release without capture is read from its own target', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 173));
        cell.dispatchEvent(pointer('pointerup', 173)); // coordinates 0,0: not used for a mouse
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"name"}']);
    });
});

describe('a consumer component with its own shadow root in a cell', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    class ShadowBadge extends HTMLElement {
        constructor() {
            super();
            this.style.cssText = 'display:block;width:120px;height:24px';
            const root = this.attachShadow({ mode: 'open' });
            root.innerHTML = '<span style="display:block;width:100%;height:100%">badge text</span>';
        }
    }
    if (!customElements.get('x-shadow-badge')) customElements.define('x-shadow-badge', ShadowBadge);

    const mountWithBadge = async (): Promise<{ table: GeDataTable; badge: HTMLElement }> => {
        const badge = new ShadowBadge();
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 1 ? badge : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        return { table, badge };
    };

    it('focuses the cell when the text inside the component is clicked: the press target is the component, in the tree of the cell', async () => {
        const { table, badge } = await mountWithBadge();
        await userEvent.click(badge);
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
    });

    it('ends a claimed press released on the text inside the component as a pointerup, with the cell address', async () => {
        const { table, badge } = await mountWithBadge();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        hooks.onPointerCancel = () => void log.push('cancel');
        const inner = badge.shadowRoot!.querySelector('span')!;
        inner.dispatchEvent(pointer('pointerdown', 151, { over: inner }));
        inner.dispatchEvent(pointer('pointerup', 151, { over: inner }));
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"name"}']);
    });
});

describe('a claimant that has no onPointerUp', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    it('is told by onPointerCancel when its press is released on the table: every claimant gets exactly one end callback', async () => {
        const table = await mountTable();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        const cell = cellAt(table, 1, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 161));
        cell.dispatchEvent(pointer('pointerup', 161));
        expect(log).toEqual(['cancel:pointerup']);
    });
});

describe('a session that throws while detaching', () => {
    it('does not stop the rest of the detach: the other sessions detach, the services and listeners are removed, the error is reported once', async () => {
        const table = await mountTable();
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const editDetach = vi.spyOn(EditSession.prototype, 'detach').mockImplementation(() => {
            throw new Error('edit detach failed');
        });
        const rangeDetach = vi.spyOn(RangeSession.prototype, 'detach');
        try {
            expect(() => table.remove()).not.toThrow();
            expect(editDetach).toHaveBeenCalledTimes(1);
            expect(rangeDetach).toHaveBeenCalledTimes(1); // after the edit session, which threw
            expect(error).toHaveBeenCalledTimes(1);
            expect(table.provider('interaction')).toBeUndefined(); // the teardown ran: services and listeners are gone
            expect(table.provider('range')).toBeUndefined();
        } finally {
            editDetach.mockRestore();
            rangeDetach.mockRestore();
            error.mockRestore();
        }
    });
});

describe('a table inside the shadow root of another component', () => {
    afterEach(() => {
        for (const target of [hooks, editHooks]) for (const key of ['onPointerDown', 'onPointerUp', 'onPointerCancel'] as const) delete target[key];
    });

    async function mountInShadow(): Promise<{ host: HTMLElement; table: GeDataTable }> {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const table = document.createElement('ge-data-table') as GeDataTable;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, showToolbar: false, showPagination: false });
        shadow.append(table);
        await settle(table);
        return { host, table };
    }

    it('ends a claimed press released on its own cells as a pointerup (the document sees the target retargeted to the host), and a release outside as a cancel', async () => {
        const { host, table } = await mountInShadow();
        const log: string[] = [];
        hooks.onPointerDown = () => true;
        hooks.onPointerUp = (_event, at) => void log.push(`up:${JSON.stringify(at)}`);
        hooks.onPointerCancel = (event) => void log.push(`cancel:${event?.type}`);
        const cell = cellAt(table, 1, 'age')!;
        cell.dispatchEvent(pointer('pointerdown', 131));
        cell.dispatchEvent(pointer('pointerup', 131));
        expect(log).toEqual(['up:{"rowIndex":1,"columnKey":"age"}']);
        log.length = 0;
        cell.dispatchEvent(pointer('pointerdown', 132));
        document.body.dispatchEvent(pointer('pointerup', 132));
        await frames(1);
        expect(log).toEqual(['cancel:pointerup']);
        host.remove();
    });

    it('does not count a press inside the table as a press outside: a render that moves the focused cell keeps the DOM focus', async () => {
        const { host, table } = await mountInShadow();
        const shadow = host.shadowRoot!;
        table.focusCell(1, 'name');
        await settle(table);
        await userEvent.click(cellAt(table, 1, 'name')!); // a press inside: the document sees its target retargeted to the host
        await settle(table);
        expect((shadow.activeElement as HTMLElement | null)?.matches('[data-slot="table-cell"]')).toBe(true);
        table.data = [...table.data].reverse(); // the focused cell's row moves in the DOM
        await settle(table);
        await frames(3);
        expect((shadow.activeElement as HTMLElement | null)?.matches('[data-slot="table-cell"]')).toBe(true);
        host.remove();
    });

    it('focuses the cell of a touch tap', async () => {
        const { host, table } = await mountInShadow();
        const cell = cellAt(table, 2, 'name')!;
        cell.dispatchEvent(pointer('pointerdown', 141, { pointerType: 'touch' }));
        cell.dispatchEvent(pointer('pointerup', 141, { pointerType: 'touch', over: cell }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'name' });
        host.remove();
    });
});

describe('a press inside the open editor', () => {
    /** An editor that is a custom element with a shadow root: its input is retargeted to the host, which the control list does not know. */
    class ShadowEditor extends HTMLElement {
        readonly input = document.createElement('input');
        constructor() {
            super();
            this.style.cssText = 'display:block;width:150px;height:28px';
            this.attachShadow({ mode: 'open' }).append(this.input);
            this.input.style.cssText = 'width:100%;height:100%;box-sizing:border-box';
        }
    }
    if (!customElements.get('x-shadow-editor')) customElements.define('x-shadow-editor', ShadowEditor);

    it('never moves the focus or the DOM focus to the cell: the editor does not blur (and so does not commit)', async () => {
        const editor = new ShadowEditor();
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '200px', editable: true, cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? editor : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        openEditorAt(table, 0, 'name');
        const blur = vi.fn();
        editor.input.addEventListener('blur', blur);
        editor.input.focus();
        await frames(2);
        expect(editor.shadowRoot!.activeElement).toBe(editor.input);

        await userEvent.click(editor);
        await settle(table);

        expect(blur).not.toHaveBeenCalled();
        expect(editor.shadowRoot!.activeElement).toBe(editor.input);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'name' }); // adopted when the editor took focus, not moved by the press
    });

    it('still focuses a cell that is pressed outside the editor cell', async () => {
        const editor = new ShadowEditor();
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', width: '200px', editable: true, cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? editor : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        openEditorAt(table, 0, 'name');
        await userEvent.click(cellAt(table, 2, 'age')!);
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });
});

