import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { PointerPress } from './data-table-cell-session.js';
import { cellAt, mountTable, settle } from './data-table-fixtures.js';
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
const pointer = (type: string, pointerId: number, init: PointerEventInit = {}): PointerEvent =>
    new PointerEvent(type, { pointerId, bubbles: true, composed: true, button: 0, pointerType: 'mouse', ...init });

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
        b.dispatchEvent(pointer('pointerup', 42, { pointerType: 'touch' })); // its tap ends ONLY its own press (offered to the sessions: unclaimed)
        expect(log).toEqual(['up:42']);
        // A is released outside the table: its press is still there and its claimant is told
        document.body.dispatchEvent(pointer('pointerup', 41));
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
        cell.dispatchEvent(pointer('pointerup', 51, { pointerType: 'touch' }));
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
                { accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? editor : String(value)) },
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
                { accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? editor : String(value)) },
                { accessorKey: 'age', header: 'Age', width: '120px' },
            ],
        });
        openEditorAt(table, 0, 'name');
        await userEvent.click(cellAt(table, 2, 'age')!);
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });
});

