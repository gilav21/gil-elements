import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { PointerPress } from './data-table-cell-session.js';
import { cellAt, mountTable, SAMPLE_COLUMNS, SAMPLE_ROWS, settle } from './data-table-fixtures.js';
import { frames, mouseDrag, parkMouse } from './data-table-input-fixtures.js';
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
        expect(seen).toEqual([{ anchor: { rowIndex: 0, columnKey: 'name' } }]);
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

    it('records a press an inner widget tried to hide: a touch tap on a cell whose content stops pointerdown still focuses it', async () => {
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
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
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
    it('is reported and left out: the table still mounts, the other session works, and the broken one is not detached', async () => {
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
            table.remove();
            expect(editDetach).not.toHaveBeenCalled();
        } finally {
            attach.mockRestore();
            editDetach.mockRestore();
            rangeAttach.mockRestore();
            error.mockRestore();
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

describe('a touch tap on a cell covered by an overlay of the table', () => {
    it('focuses the cell below the overlay (the range readout and the fill handle are looked through): the last row under the sticky readout', async () => {
        const table = await mountTable();
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        const last = cellAt(table, table.data.length - 1, 'name')!;
        const rect = last.getBoundingClientRect();
        const readout = document.createElement('div');
        readout.setAttribute('data-slot', 'range-actions');
        readout.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:50`;
        viewport.append(readout);
        // the tap lands on the readout (its pointerdown, and the pointerup delivered to it by the implicit capture), over the last cell
        readout.dispatchEvent(pointer('pointerdown', 191, { pointerType: 'touch', over: readout }));
        readout.dispatchEvent(pointer('pointerup', 191, { pointerType: 'touch', over: readout }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: table.data.length - 1, columnKey: 'name' });
        readout.remove();
    });

    it('looks through an element marked data-pointer-transparent too, and falls back to the pressed cell for an unclaimed tap when no cell is under the finger', async () => {
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
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'name' });
        cover.remove();
        // no cell under the finger (the point is over the empty header corner area): the pressed cell is focused
        const other = cellAt(table, 2, 'age')!;
        other.dispatchEvent(pointer('pointerdown', 193, { pointerType: 'touch' }));
        const header = table.querySelector<HTMLElement>('[data-slot="table-head"]')!;
        other.dispatchEvent(pointer('pointerup', 193, { pointerType: 'touch', over: header }));
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
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
        inner.dispatchEvent(pointer('pointerdown', 151));
        inner.dispatchEvent(pointer('pointerup', 151));
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

