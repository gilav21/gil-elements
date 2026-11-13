import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PastePart } from './lazy/clipboard.js';
import type { GeDataTable } from './data-table.js';
import { cellAt, mountTable, q, settle } from './data-table-fixtures.js';
import { dispatchCopy, dispatchPaste, emulateTouch, type FakeClipboard, fakeClipboard, frames, parkMouse, press, unhandledRejections } from './data-table-input-fixtures.js';
import type { CellsPasteEvent, ColumnDef } from './data-table.types.js';

interface Row {
    id: string;
    name: string;
    qty: number | null;
    ok: boolean;
    note: string;
    group?: string;
}

const ROWS: Row[] = [
    { id: 'a', name: '=SUM(1,2)', qty: 1, ok: true, note: 'x', group: 'g1' },
    { id: 'b', name: 'Bob', qty: 2, ok: false, note: 'y', group: 'g2' },
    { id: 'c', name: 'Cid', qty: 3, ok: true, note: 'z', group: 'g1' },
    { id: 'd', name: 'Dee', qty: 4, ok: false, note: 'w', group: 'g2' },
];
const set = <K extends keyof Row>(key: K) => (row: Row, value: unknown): Row => ({ ...row, [key]: value });
const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name', valueSetter: set('name') },
    { accessorKey: 'qty', header: 'Qty', valueSetter: set('qty'), editValidator: (v) => v === null || (typeof v === 'number' && v < 100) || 'too big' },
    { accessorKey: 'ok', header: 'OK', valueSetter: set('ok') },
    { accessorKey: 'note', header: 'Note' }, // no setter: a paste skips it
];

let clip: FakeClipboard | null = null;
const install = (options: Parameters<typeof fakeClipboard>[0] = {}): FakeClipboard => (clip = fakeClipboard(options));

afterEach(async () => {
    clip?.restore();
    clip = null;
    await parkMouse();
    await emulateTouch(false);
});

async function grid(props: Partial<Record<keyof GeDataTable<Row>, unknown>> = {}): Promise<GeDataTable<Row>> {
    return mountTable<Row>({ columns: COLUMNS, data: ROWS, getRowId: (row: Row) => row.id, ...props });
}

/** Focuses a cell the way a user does, so the keys go to it. */
async function focusCell(table: GeDataTable<Row>, row: number, key: string): Promise<HTMLElement> {
    table.focusCell(row, key);
    await settle(table);
    const cell = cellAt(table, row, key)!;
    expect(document.activeElement).toBe(cell);
    return cell;
}

const announced = (table: Element): string => q(table, '[data-slot="data-table-announcer"]').textContent ?? '';
/** The range part is lazy: wait until it handles ranges. */
async function rangeReady(table: GeDataTable<Row>): Promise<void> {
    for (let i = 0; i < 50 && !table.provider('range')?.active(); i++) await frames(1);
    await settle(table);
    expect(table.provider('range')?.active()).toBe(true);
}
/** The paste part is lazy too. */
async function pasteReady(table: GeDataTable<Row>): Promise<void> {
    await frames(3);
    await settle(table);
}
const until = async (check: () => boolean): Promise<void> => {
    for (let i = 0; i < 50 && !check(); i++) await frames(1);
};

describe('copy', () => {
    it('Ctrl+C with no range copies the focused cell, formula-guarded, and announces it', async () => {
        const fake = install();
        const table = await grid();
        await focusCell(table, 0, 'name');
        await press('{Control>}c{/Control}');
        await until(() => fake.writes.length > 0);
        expect(fake.writes).toEqual(["'=SUM(1,2)"]);
        await settle(table);
        expect(announced(table)).toContain('1 cell copied');
    });

    it('Ctrl+C on a range writes exactly that rectangle in drawn column order, numbers plain (needs the range part)', async () => {
        const fake = install();
        const table = await grid({ enableCellRangeSelection: true });
        await rangeReady(table);
        await focusCell(table, 1, 'qty');
        table.cellRange = { startRow: 2, startCol: 'ok', endRow: 0, endCol: 'name' };
        await settle(table);
        await press('{Control>}c{/Control}');
        await until(() => fake.writes.length > 0);
        expect(fake.writes).toEqual(["'=SUM(1,2)\t1\ttrue\nBob\t2\tfalse\nCid\t3\ttrue"]);
        expect(announced(table)).toContain('9 cells copied');
    });

    it('copies the selected rows with a header, in the drawn (grouped) order, when no cell is focused', async () => {
        const fake = install();
        const table = await grid({ enableRowSelection: true, groupBy: 'group', rowSelection: { a: true, b: true, c: true } });
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        // nothing focused: the keydown reaches the grid through its viewport
        viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true }));
        await until(() => fake.writes.length > 0);
        expect(fake.writes[0]?.split('\n')).toEqual(['Name\tQty\tOK\tNote', "'=SUM(1,2)\t1\ttrue\tx", 'Cid\t3\ttrue\tz', 'Bob\t2\tfalse\ty']);
    });

    it('writes nothing with enable-copy off, and leaves a copy inside a text field of a cell to the browser', async () => {
        const fake = install();
        const off = await grid({ enableCopy: false });
        await focusCell(off, 0, 'name');
        await press('{Control>}c{/Control}');
        await frames(2);
        expect(fake.writes).toEqual([]);

        const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', cellRenderer: (row: Row) => html`<input data-test-input .value=${row.name} />` }, COLUMNS[1] as ColumnDef<Row>];
        const table = await grid({ columns });
        const input = table.querySelector<HTMLInputElement>('[data-test-input]')!;
        input.focus();
        input.select();
        await press('{Control>}c{/Control}');
        await frames(2);
        expect(fake.writes).toEqual([]);
    });

    it('leaves Ctrl+C and the native copy to the browser while text is selected in the table', async () => {
        const fake = install();
        const table = await grid();
        const cell = await focusCell(table, 1, 'name');
        // a text selection inside the table (a cell's text): the user copies that text, not the grid
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        const text = document.createRange();
        text.selectNodeContents(cell);
        selection.addRange(text);
        expect(selection.isCollapsed).toBe(false);
        const key = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true });
        cell.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(false);
        const copy = dispatchCopy(cell);
        expect(copy.notPrevented).toBe(true);
        expect(copy.data.getData('text/plain')).toBe('');
        await frames(2);
        expect(fake.writes).toEqual([]);
        // with the selection gone the grid copies the focused cell again
        selection.removeAllRanges();
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true }));
        await until(() => fake.writes.length > 0);
        expect(fake.writes).toEqual(['Bob']);
    });

    it('catches a refused write: no unhandled rejection, the failure is announced, the promise resolves denied', async () => {
        install({ denyWrite: true });
        const rejections = unhandledRejections();
        try {
            const table = await grid();
            await focusCell(table, 1, 'name');
            await press('{Control>}c{/Control}');
            await frames(3);
            await settle(table);
            expect(announced(table)).toContain('Could not copy to the clipboard');
            await expect(table.copyAllToClipboard()).resolves.toEqual({ status: 'denied' });
            await frames(2);
            expect(rejections.reasons).toEqual([]);
        } finally {
            rejections.stop();
        }
    });

    it('without navigator.clipboard the key is not consumed and the native copy event does the job', async () => {
        install({ missing: true });
        const table = await grid();
        const cell = await focusCell(table, 1, 'name');
        const key = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true });
        cell.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(false);
        const { data, notPrevented } = dispatchCopy(cell);
        expect(notPrevented).toBe(false);
        expect(data.getData('text/plain')).toBe('Bob');
        await expect(table.copyCellToClipboard()).resolves.toEqual({ status: 'unavailable' });
    });

    it('answers a native copy aimed outside the table while one of its cells holds the focus (the browser menu, a body target)', async () => {
        install({ missing: true });
        const table = await grid();
        await focusCell(table, 1, 'name');
        const outside = dispatchCopy(document.body);
        expect(outside.notPrevented).toBe(false);
        expect(outside.data.getData('text/plain')).toBe('Bob');
        // with the focus outside the table, a copy elsewhere is not the table's
        const button = document.createElement('button');
        document.body.append(button);
        button.focus();
        const away = dispatchCopy(document.body);
        expect(away.notPrevented).toBe(true);
        button.remove();
    });

    it('leaves Ctrl/Cmd+C to a header control or the readout button (only a body cell, or the grid itself, copies)', async () => {
        const fake = install();
        const table = await grid({ enableCellRangeSelection: true, enableRangeActions: true });
        await rangeReady(table);
        await focusCell(table, 1, 'name');
        table.cellRange = { startRow: 0, startCol: 'qty', endRow: 1, endCol: 'qty' };
        await settle(table);
        // the header's sort button lives in the column header's shadow root: a key there reaches the grid with the column header as its target
        for (const control of [table.querySelector<HTMLElement>('[data-slot="table-head"] ge-data-table-column-header'), table.querySelector<HTMLElement>('[data-slot="range-chart"]')]) {
            expect(control).not.toBeNull();
            const key = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true });
            control!.dispatchEvent(key);
            expect(key.defaultPrevented).toBe(false);
        }
        await frames(2);
        expect(fake.writes).toEqual([]);
    });

    it('copies the selected rows of the tree the table draws: a filtered-out child is not copied, a matching child is (includeParentOnChildMatch)', async () => {
        const fake = install();
        type Node = Row & { children?: Node[] };
        const tree: Node[] = [
            { id: 'p', name: 'Parent', qty: 1, ok: true, note: 'p', children: [
                { id: 'k', name: 'Match', qty: 2, ok: false, note: 'k' },
                { id: 'x', name: 'Other', qty: 3, ok: true, note: 'x' },
            ] },
        ];
        const table = await mountTable<Node>({
            columns: COLUMNS as ColumnDef<Node>[],
            data: tree,
            getRowId: (row: Node) => row.id,
            enableSubRows: true,
            subRowDefaultExpanded: true,
            subRowFilterMode: 'includeParentOnChildMatch',
            globalFilter: 'Match',
            enableRowSelection: true,
            rowSelection: { k: true, x: true },
        });
        await expect(table.copySelectedToClipboard()).resolves.toEqual({ status: 'done', cells: 4 });
        expect(fake.text.split('\n')).toEqual(['Name\tQty\tOK\tNote', 'Match\t2\tfalse\tk']);
    });

    it('copies the selected rows of the WHOLE tree in the drawn order: children included, under a collapsed parent and on another page too', async () => {
        const fake = install();
        type Node = Row & { children?: Node[] };
        const tree: Node[] = [
            { id: 'p', name: 'Parent', qty: 1, ok: true, note: 'p', children: [{ id: 'k', name: 'Kid', qty: 2, ok: false, note: 'k' }] },
            { id: 'q', name: 'Other', qty: 3, ok: true, note: 'q', children: [{ id: 'h', name: 'Hidden', qty: 4, ok: true, note: 'h' }] },
            { id: 'z', name: 'Last', qty: 5, ok: false, note: 'z' },
        ];
        const table = await mountTable<Node>({
            columns: COLUMNS as ColumnDef<Node>[],
            data: tree,
            getRowId: (row: Node) => row.id,
            enableSubRows: true,
            subRowExpandedRows: { p: true }, // q stays collapsed: h is not drawn
            enableRowSelection: true,
            rowSelection: { k: true, h: true, z: true },
            paginationState: { pageIndex: 0, pageSize: 1 }, // z is on page 3
        });
        await expect(table.copySelectedToClipboard()).resolves.toEqual({ status: 'done', cells: 12 }); // the data cells: the header line is not counted
        expect(fake.text.split('\n')).toEqual(['Name\tQty\tOK\tNote', 'Kid\t2\tfalse\tk', 'Hidden\t4\ttrue\th', 'Last\t5\tfalse\tz']);
    });

    it('answers empty for copyAll with no data row (no header-only clipboard)', async () => {
        const fake = install();
        const table = await grid({ data: [] });
        await expect(table.copyAllToClipboard()).resolves.toEqual({ status: 'empty' });
        expect(fake.writes).toEqual([]);
    });

    it('a stale text selection elsewhere does not stop the grid copy; one over the focused cell does', async () => {
        const fake = install();
        const table = await grid();
        const focused = await focusCell(table, 1, 'name');
        const selection = document.getSelection()!;
        const select = (node: Node): void => {
            selection.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(node);
            selection.addRange(range);
        };
        select(cellAt(table, 3, 'note')!); // another cell
        focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true }));
        await until(() => fake.writes.length > 0);
        expect(fake.writes).toEqual(['Bob']);
        select(focused); // the focused cell itself
        const key = new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true, composed: true });
        focused.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(false);
        selection.removeAllRanges();
    });

    it('the public copy methods write what the scopes say and resolve to the result', async () => {
        const fake = install();
        const table = await grid({ enableRowSelection: true, rowSelection: { d: true }, paginationState: { pageIndex: 0, pageSize: 2 } });
        await expect(table.copyAllToClipboard()).resolves.toEqual({ status: 'done', cells: 16 }); // 4 rows x 4 columns: the header line is not counted
        await settle(table);
        expect(announced(table)).toContain('16 cells copied');
        expect(fake.text.split('\n')).toHaveLength(5); // header + every row, paging ignored
        await expect(table.copySelectedToClipboard()).resolves.toEqual({ status: 'done', cells: 4 }); // a row of another page (its data cells)
        expect(fake.text).toBe('Name\tQty\tOK\tNote\nDee\t4\tfalse\tw');
        await expect(table.copyRowToClipboard(ROWS[1] as Row)).resolves.toEqual({ status: 'done', cells: 4 });
        expect(fake.text).toBe('Bob\t2\tfalse\ty');
        await expect(table.copyCellToClipboard()).resolves.toEqual({ status: 'empty' }); // nothing focused
        await expect(table.copyCellRangeToClipboard()).resolves.toEqual({ status: 'empty' }); // no range
        table.enableCopy = false;
        await settle(table);
        await expect(table.copyAllToClipboard()).resolves.toEqual({ status: 'ignored' });
    });
});

describe('paste', () => {
    it('a real Ctrl+V is left to the browser: not prevented, no clipboard read (its native paste event carries the text, no permission prompt)', async () => {
        const fake = install({ text: '5' });
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        const cell = await focusCell(table, 0, 'qty');
        const seen: { prevented: boolean }[] = [];
        const onKey = (event: KeyboardEvent): void => void seen.push({ prevented: event.defaultPrevented });
        document.addEventListener('keydown', onKey); // bubble on the document: after the grid's handlers
        let natives = 0;
        const onPaste = (): void => void natives++;
        document.addEventListener('paste', onPaste, true);
        try {
            await press('{Control>}v{/Control}');
        } finally {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('paste', onPaste, true);
        }
        expect(seen.at(-1)?.prevented).toBe(false);
        expect(fake.reads.count).toBe(0);
        expect(natives).toBe(1); // Chromium fires the native paste on the focused cell
        expect(document.activeElement).toBe(cell);
    });

    it('a native paste of a 3x3 grid: coercion by type, cells past the end dropped, a column without setter skipped, one cells-paste and one data-change', async () => {
        const fake = install();
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        const cell = await focusCell(table, 1, 'name');
        const pastes: CellsPasteEvent[] = [];
        const changes: unknown[] = [];
        const errors: unknown[] = [];
        table.addEventListener('cells-paste', (e) => pastes.push((e as CustomEvent<CellsPasteEvent>).detail));
        table.addEventListener('data-change', (e) => changes.push((e as CustomEvent).detail));
        table.addEventListener('edit-error', (e) => errors.push((e as CustomEvent).detail));
        expect(dispatchPaste(cell, 'Zed\t7\tfalse\nYan\t\tTRUE\nXu\t999\tnope\nextra\t1\t1')).toBe(false); // taken (prevented)
        await until(() => pastes.length > 0);
        expect(fake.reads.count).toBe(0);
        const data = table.data as Row[];
        expect(data.map((r) => [r.name, r.qty, r.ok])).toEqual([
            ['=SUM(1,2)', 1, true],
            ['Zed', 7, false],
            ['Yan', null, true], // a blank cell clears a number
            ['Xu', 4, false], // 999 refused by the validator; 'nope' is not 'true'
        ]);
        expect(pastes).toEqual([{ startRow: 1, startColumn: 'name', rowsAffected: 4, cellsApplied: 8, cellsRejected: 1 }]);
        expect(changes).toHaveLength(1);
        expect(errors).toHaveLength(1);
        await settle(table);
        expect(announced(table)).toContain('8 cells pasted, 1 rejected');
    });

    it('the copy -> paste round trip restores formula-guarded text', async () => {
        const fake = install();
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        await focusCell(table, 0, 'name');
        await press('{Control>}c{/Control}');
        await until(() => fake.writes.length > 0);
        expect(fake.text).toBe("'=SUM(1,2)");
        const target = await focusCell(table, 1, 'name');
        dispatchPaste(target, fake.text);
        await until(() => (table.data as Row[])[1]?.name !== 'Bob');
        expect((table.data as Row[])[1]?.name).toBe('=SUM(1,2)');
    });

    it('applies a native paste that arrives while the paste part is still loading, once it has loaded', async () => {
        const table = await grid();
        const cell = await focusCell(table, 2, 'qty');
        table.enableClipboardPaste = true; // the part loads at the next update: the paste below comes first
        expect(dispatchPaste(cell, '33')).toBe(false);
        expect((table.data as Row[])[2]?.qty).toBe(3);
        await until(() => (table.data as Row[])[2]?.qty === 33);
        expect((table.data as Row[])[2]?.qty).toBe(33);
    });

    it('selects the pasted rectangle (needs the range part)', async () => {
        const table = await grid({ enableClipboardPaste: true, enableCellRangeSelection: true });
        await pasteReady(table);
        await rangeReady(table);
        const cell = await focusCell(table, 0, 'qty');
        dispatchPaste(cell, '1\ttrue\n2\tfalse');
        await until(() => table.cellRange !== null);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'qty', endRow: 1, endCol: 'ok' });
    });

    it('reads nothing while the paste part is not loaded, and pastes into the focused ROW even when a sort moved it during the read', async () => {
        const fake = install({ text: '77' });
        const failing = vi.spyOn(PastePart.prototype, 'attach').mockImplementation(() => {
            throw new Error('no part');
        });
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const broken = await grid({ enableClipboardPaste: true });
            await pasteReady(broken);
            await focusCell(broken, 0, 'qty');
            await expect(broken.provider('clipboard')!.paste()).resolves.toEqual({ status: 'ignored' });
            expect(fake.reads.count).toBe(0); // no clipboard read (no permission prompt) for a paste that cannot happen
        } finally {
            failing.mockRestore();
            errors.mockRestore();
        }
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        await focusCell(table, 1, 'qty'); // Bob
        const pasting = table.provider('clipboard')!.paste();
        table.data = [...(table.data as Row[])].reverse(); // during the read: Bob is now drawn at index 2
        await settle(table);
        await expect(pasting).resolves.toMatchObject({ status: 'done', cells: 1 });
        const byId = Object.fromEntries((table.data as Row[]).map((r) => [r.id, r.qty]));
        expect(byId).toEqual({ a: 1, b: 77, c: 3, d: 4 });
    });

    it('pastes from the TOP-LEFT of the range, whichever corner it was made from', async () => {
        const table = await grid({ enableClipboardPaste: true, enableCellRangeSelection: true });
        await pasteReady(table);
        await rangeReady(table);
        const cell = await focusCell(table, 3, 'ok');
        table.cellRange = { startRow: 3, startCol: 'ok', endRow: 2, endCol: 'name' }; // made from the bottom-right
        await settle(table);
        dispatchPaste(cell, 'P\t5\ttrue\nQ\t6\tfalse');
        await until(() => (table.data as Row[])[2]?.name === 'P');
        expect((table.data as Row[]).map((r) => [r.name, r.qty, r.ok])).toEqual([
            ['=SUM(1,2)', 1, true],
            ['Bob', 2, false],
            ['P', 5, true],
            ['Q', 6, false],
        ]);
    });

    it('writes nothing when an editor opened while the clipboard was being read', async () => {
        const fake = install({ text: '42' });
        let release: (value: string) => void = () => undefined;
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve(), readText: () => new Promise<string>((resolve) => (release = resolve)) }, configurable: true });
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        await focusCell(table, 1, 'qty');
        const pasting = table.provider('clipboard')!.paste();
        (table.provider('interaction') as { editingCell(): unknown }).editingCell = () => ({ rowIndex: 0, columnKey: 'name' }); // an editor opens meanwhile
        release('42');
        await expect(pasting).resolves.toEqual({ status: 'ignored' });
        expect((table.data as Row[])[1]?.qty).toBe(2);
        void fake;
    });

    it('a paste that writes no cell (every value refused, or only columns without a setter) emits no cells-paste and keeps the range', async () => {
        const table = await grid({ enableClipboardPaste: true, enableCellRangeSelection: true });
        await pasteReady(table);
        await rangeReady(table);
        const range = { startRow: 2, startCol: 'name', endRow: 3, endCol: 'qty' };
        table.cellRange = range;
        await settle(table);
        const pastes: CellsPasteEvent[] = [];
        table.addEventListener('cells-paste', (e) => pastes.push((e as CustomEvent<CellsPasteEvent>).detail));
        const service = table.provider('clipboard')!;
        // 500 and 600 are refused by the qty validator
        expect(service.pasteText('500\n600', { rowIndex: 0, columnKey: 'qty' })).toEqual({ status: 'done', cells: 0, rejected: 2 });
        // the note column has no valueSetter
        expect(service.pasteText('a\tb', { rowIndex: 0, columnKey: 'note' })).toEqual({ status: 'done', cells: 0, rejected: 0 });
        await settle(table);
        expect(pastes).toEqual([]);
        expect(table.cellRange).toEqual(range);
        expect(announced(table)).toContain('0 cells pasted, 2 rejected');
    });

    it('a refused read changes nothing: announced, no cells-paste, no unhandled rejection', async () => {
        install({ denyRead: true });
        const rejections = unhandledRejections();
        try {
            const table = await grid({ enableClipboardPaste: true });
            await pasteReady(table);
            await focusCell(table, 0, 'qty');
            let pastes = 0;
            table.addEventListener('cells-paste', () => pastes++);
            await expect(table.provider('clipboard')!.paste()).resolves.toEqual({ status: 'denied' }); // the programmatic read
            await settle(table);
            expect(announced(table)).toContain('Could not read the clipboard');
            expect(pastes).toBe(0);
            expect(table.data).toBe(ROWS);
            expect(rejections.reasons).toEqual([]);
        } finally {
            rejections.stop();
        }
    });

    it('without navigator.clipboard the key is not consumed and the native paste event pastes', async () => {
        install({ missing: true });
        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        const cell = await focusCell(table, 2, 'qty');
        const key = new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true, composed: true });
        cell.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(false);
        expect(dispatchPaste(cell, '42')).toBe(false);
        expect((table.data as Row[])[2]?.qty).toBe(42);
    });

    it('leaves a native paste alone with paste off, with nothing focused, or while an editor is open', async () => {
        const off = await grid();
        const offCell = await focusCell(off, 0, 'qty');
        expect(dispatchPaste(offCell, '5')).toBe(true);
        expect((off.data as Row[])[0]?.qty).toBe(1);

        const table = await grid({ enableClipboardPaste: true });
        await pasteReady(table);
        expect(dispatchPaste(q(table, '[data-slot="data-table-viewport"]'), '5')).toBe(true); // no target cell
        const cell = await focusCell(table, 0, 'qty');
        (table.provider('interaction') as { editingCell(): unknown }).editingCell = () => ({ rowIndex: 0, columnKey: 'qty' });
        expect(dispatchPaste(cell, '5')).toBe(true);
        expect((table.data as Row[])[0]?.qty).toBe(1);
    });

    it('a native paste or copy aimed outside the table is not the OUTER table\'s while a table nested in its detail row holds the focus', async () => {
        install({ missing: true });
        const inner = document.createElement('ge-data-table') as GeDataTable<Row>;
        Object.assign(inner, { columns: COLUMNS, data: ROWS, getRowId: (row: Row) => row.id, enableCopy: false, showToolbar: false, showPagination: false });
        const outer = await grid({ enableClipboardPaste: true, enableRowExpansion: true, expandedRows: { a: true }, renderDetail: () => inner });
        await pasteReady(outer);
        await settle(inner);
        outer.focusCell(1, 'qty'); // the outer table had a focused cell...
        await settle(outer);
        inner.focusCell(0, 'name'); // ...but the focus is now in the nested table
        await settle(inner);
        const copy = dispatchCopy(document.body);
        expect(copy.notPrevented).toBe(true);
        expect(dispatchPaste(document.body, '9')).toBe(true);
        expect((outer.data as Row[])[1]?.qty).toBe(2);
    });
});
