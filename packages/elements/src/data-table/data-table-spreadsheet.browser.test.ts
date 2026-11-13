/**
 * Waves 5 and 6 together (spec E.2 "Integration"): fill and paste with the wave 5 history keys, paste and validation against the editor's own state,
 * the editor against fill and paste, range / copy / paste in a grouped table, row drag with the sort warning, and range selection with row selection,
 * a tree and detail rows. The wave 4 integration file is not edited.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { cellAt, makeRows, mountTable, qa, type SampleRow, settle } from './data-table-fixtures.js';
import { editColumns, startEditingAt } from './data-table-edit-fixtures.js';
import { dispatchPaste, emulateTouch, type FakeClipboard, fakeClipboard, frames, parkMouse, press } from './data-table-input-fixtures.js';
import { ROW_DRAG_SORT_WARNING } from './data-table-config-check.js';
import type { CellEditErrorEvent } from './data-table.types.js';

type Table = GeDataTable<SampleRow>;

let clip: FakeClipboard | null = null;
afterEach(async () => {
    clip?.restore();
    clip = null;
    await parkMouse();
    await emulateTouch(false);
});

const ages = (table: Table): number[] => (table.data as SampleRow[]).map((r) => r.age);
const names = (table: Table): string[] => (table.data as SampleRow[]).map((r) => r.name);

async function ready(table: Table): Promise<Table> {
    for (let i = 0; i < 60 && !(table.provider('range')?.active() ?? true); i++) await frames(1);
    await frames(3);
    await settle(table);
    return table;
}

async function focusAt(table: Table, row: number, key: string): Promise<HTMLElement> {
    table.focusCell(row, key);
    await settle(table);
    return cellAt(table, row, key)!;
}

describe('fill and paste with the history keys', () => {
    it('a fill is one undo step and one redo step (Ctrl+Z, Ctrl+Y)', async () => {
        const table = await ready((await mountTable<SampleRow>({ columns: editColumns(), data: makeRows(5), enableCellRangeSelection: true, enableFillHandle: true, enableEditHistory: true })) as Table);
        expect(ages(table)).toEqual([0, 1, 2, 3, 4]);
        table.cellRange = { startRow: 0, startCol: 'age', endRow: 3, endCol: 'age' };
        await focusAt(table, 0, 'age');
        await press('{Control>}d{/Control}'); // the first row copied down the range
        await settle(table);
        expect(ages(table)).toEqual([0, 0, 0, 0, 4]);
        await press('{Control>}z{/Control}');
        await settle(table);
        expect(ages(table)).toEqual([0, 1, 2, 3, 4]);
        expect(table.canUndo).toBe(false);
        await press('{Control>}y{/Control}');
        await settle(table);
        expect(ages(table)).toEqual([0, 0, 0, 0, 4]);
        expect(table.canRedo).toBe(false);
    });

    it('a paste is one undo step and one redo step', async () => {
        const table = await ready((await mountTable<SampleRow>({ columns: editColumns(), data: makeRows(4), enableClipboardPaste: true, enableEditHistory: true })) as Table);
        const cell = await focusAt(table, 1, 'name');
        dispatchPaste(cell, 'A\t10\nB\t11');
        await settle(table);
        expect(names(table)).toEqual(['n0', 'A', 'B', 'n3']);
        expect(ages(table)).toEqual([0, 10, 11, 3]);
        await press('{Control>}z{/Control}');
        await settle(table);
        expect(names(table)).toEqual(['n0', 'n1', 'n2', 'n3']);
        expect(ages(table)).toEqual([0, 1, 2, 3]);
        await press('{Control>}y{/Control}');
        await settle(table);
        expect(names(table)).toEqual(['n0', 'A', 'B', 'n3']);
    });
});

describe('paste and the editor', () => {
    it('a paste into a validated column reports through edit-error only: the editor\'s error state and editing cell are left alone', async () => {
        const columns = editColumns({ age: { editValidator: (value) => (typeof value === 'number' && value < 100) || 'too big' } });
        const table = await ready((await mountTable<SampleRow>({ columns, data: makeRows(3), enableClipboardPaste: true })) as Table);
        const errors: CellEditErrorEvent<SampleRow>[] = [];
        table.addEventListener('edit-error', (e) => errors.push((e as CustomEvent<CellEditErrorEvent<SampleRow>>).detail));
        const cell = await focusAt(table, 0, 'age');
        dispatchPaste(cell, '5\n500');
        await settle(table);
        expect(ages(table)).toEqual([5, 1, 2]);
        expect(errors.map((e) => [e.rowIndex, e.message])).toEqual([[1, 'too big']]);
        expect(table.cellEditError).toBeNull();
        expect(table.editingCell).toBeNull();
        expect(table.querySelector('[data-slot="cell-edit-error"]')).toBeNull();
    });

    it('a native paste and Ctrl+D do nothing while an editor is open, and the fill handle is hidden', async () => {
        const table = await ready(
            (await mountTable<SampleRow>({ columns: editColumns(), data: makeRows(4), enableClipboardPaste: true, enableCellRangeSelection: true, enableFillHandle: true })) as Table,
        );
        table.cellRange = { startRow: 0, startCol: 'age', endRow: 2, endCol: 'age' };
        await settle(table);
        expect(await startEditingAt(table, 3, 'name')).toBe(true);
        await frames(2);
        expect(table.querySelector('[data-slot="fill-handle"]')).toBeNull();
        expect(dispatchPaste(cellAt(table, 0, 'age')!, '77')).toBe(true); // not taken
        cellAt(table, 0, 'age')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true, composed: true }));
        await settle(table);
        expect(ages(table)).toEqual([0, 1, 2, 3]);
        expect(table.editingCell).toEqual({ rowIndex: 3, columnKey: 'name' });
    });
});

describe('a grouped table', () => {
    const GROUPED = (): SampleRow[] => makeRows(6, { groups: 2 }); // g0: r0 r2 r4, g1: r1 r3 r5
    const columns = editColumns({}, [{ accessorKey: 'group', header: 'Group' }]);

    it('copies a range across a group boundary in the drawn order, and pastes into the drawn rows (group headers are no rows)', async () => {
        clip = fakeClipboard();
        const table = await ready((await mountTable<SampleRow>({ columns, data: GROUPED(), groupBy: 'group', enableCellRangeSelection: true, enableClipboardPaste: true })) as Table);
        // drawn rows: g0 [r0 r2 r4] g1 [r1 r3 r5] -> rendered indexes 0..5
        const cell = await focusAt(table, 2, 'name');
        table.cellRange = { startRow: 2, startCol: 'name', endRow: 3, endCol: 'age' }; // r4 and r1, across the two groups
        await settle(table);
        await press('{Control>}c{/Control}');
        await vi.waitFor(() => expect(clip!.writes).toEqual(['n4\t4\nn1\t1']));
        dispatchPaste(cell, 'X\t40\nY\t41');
        await settle(table);
        const byId = Object.fromEntries((table.data as SampleRow[]).map((r) => [r.id, [r.name, r.age]]));
        expect(byId['r4']).toEqual(['X', 40]);
        expect(byId['r1']).toEqual(['Y', 41]);
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'name', endRow: 3, endCol: 'age' });
    });
});

describe('row drag with a sort', () => {
    it('warns once that a local reorder does not show while the table sorts its rows', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            await mountTable<SampleRow>({ data: makeRows(4), enableRowDrag: true, localReorder: true, sortState: { column: 'name', direction: 'asc' } });
            await frames(2);
            expect(warn.mock.calls.filter((call) => call[0] === ROW_DRAG_SORT_WARNING)).toHaveLength(1);
        } finally {
            warn.mockRestore();
        }
    });
});

describe('range selection with row selection, a tree and detail rows', () => {
    it('draws the range on data cells only (not the selection column, not a detail row) and copies the drawn tree rows', async () => {
        clip = fakeClipboard();
        const tree = makeRows(2, { children: 2 }); // r0 [r0-c0 r0-c1] r1 [r1-c0 r1-c1]
        const detail = (): HTMLElement => Object.assign(document.createElement('div'), { textContent: 'detail' });
        const table = await ready(
            (await mountTable<SampleRow>({
                data: tree,
                enableSubRows: true,
                subRowDefaultExpanded: true,
                enableRowSelection: true,
                rowSelection: { r0: true },
                enableRowExpansion: true,
                expandedRows: { 'r0-c0': true },
                renderDetail: detail,
                enableCellRangeSelection: true,
            })) as Table,
        );
        await focusAt(table, 0, 'name');
        await press('{Shift>}{ArrowDown}{ArrowDown}{ArrowRight}{/Shift}');
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: 2, endCol: 'age' });
        const marked = qa(table, '[data-in-range]').map((c) => `${c.dataset['rowIndex']}:${c.dataset['column']}`);
        expect(marked.sort()).toEqual(['0:age', '0:name', '1:age', '1:name', '2:age', '2:name']);
        expect(table.querySelector('[data-kind="detail"] [data-in-range]')).toBeNull();
        expect(table.querySelector('[data-column="_selection"][aria-selected]')).toBeNull();
        // a cell of the selected row outside the range is still selected for assistive technology
        expect(cellAt(table, 0, 'name')!.getAttribute('aria-selected')).toBe('true');
        await press('{Control>}c{/Control}');
        await vi.waitFor(() => expect(clip!.writes).toEqual([expectedTreeCopy(tree)]));
    });
});

/** The first three drawn rows of the expanded tree (r0, r0-c0, r0-c1), name and age. */
function expectedTreeCopy(tree: SampleRow[]): string {
    const root = tree[0]!;
    const kids = root['children'] as SampleRow[];
    return [root, kids[0]!, kids[1]!].map((r) => `${r.name}\t${r.age}`).join('\n');
}
