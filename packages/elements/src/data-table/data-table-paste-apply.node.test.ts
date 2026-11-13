import { describe, expect, it, vi } from 'vitest';
import { createCellWriter, type CellWriter } from './data-table-cell-write.js';
import { rangeGrid } from './data-table-clipboard-grid.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
const EN_LOCALE = DATA_TABLE_LOCALES.en;
import { pasteAnnouncement, pastedGrid, pasteEvent, planPasteRequests, type PasteSource } from './data-table-paste-apply.js';
import { toClipboardText } from './data-table.spreadsheet.js';
import type { CellsPasteEvent, ColumnDef } from './data-table.types.js';
import { getCellValue } from './data-table.utils.js';

interface FillRow {
    id: string;
    n: number | null | string;
    label: string;
    active?: boolean;
}

// Angular spec "smart paste (B2)": `n` has a setter and a validator (< 100), `label` a setter, `id` none.
const COLUMNS: ColumnDef<FillRow>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'n', header: 'N', valueSetter: (row, v) => ({ ...row, n: v as number }), editValidator: (v) => (v as number) < 100 || 'too big' },
    { accessorKey: 'label', header: 'Label', valueSetter: (row, v) => ({ ...row, label: v as string }) },
];
const blank = (): FillRow[] => [
    { id: '1', n: 0, label: '' },
    { id: '2', n: 0, label: '' },
    { id: '3', n: 0, label: '' },
];

/** A table of `data` drawn in data order through the real cell writer; `paste` runs what the paste part runs. */
function table(initial: FillRow[], columns = COLUMNS, history = true) {
    let data = initial;
    const events: CellsPasteEvent[] = [];
    const errors: unknown[] = [];
    const changes = vi.fn();
    const writer: CellWriter<FillRow> = createCellWriter<FillRow>({
        getData: () => data,
        setData: (next) => {
            data = next;
            changes();
        },
        batch: (fn) => fn(),
        getRowId: (row) => row.id,
        columnByKey: (key) => columns.find((c) => c.accessorKey === key),
        rowAt: (i) => data[i],
        cellValue: (row, column) => getCellValue(row, column.accessorKey, column),
        historyEnabled: () => history,
        rejectionMessage: () => 'invalid',
        emit: (name, detail) => {
            if (name === 'edit-error') errors.push(detail);
        },
    });
    const source = (): PasteSource<FillRow> => ({
        navigableKeys: columns.map((c) => String(c.accessorKey)),
        rowCount: data.length,
        rowAt: (i) => data[i],
        columnByKey: (key) => columns.find((c) => c.accessorKey === key),
        cellValue: (row, column) => getCellValue(row, column.accessorKey, column),
    });
    const paste = (text: string, row: number, key: string): CellsPasteEvent | null => {
        const plan = planPasteRequests(pastedGrid(text), row, key, source());
        if (!plan) return null;
        const results = writer.runAsCommand(() => writer.writeCells(plan.requests));
        const event = pasteEvent(plan, results);
        events.push(event);
        return event;
    };
    return { data: () => data, events, errors, changes, writer, paste, source };
}

describe('paste planning of a huge grid', () => {
    it('plans 200k short lines without overflowing the call stack (no spread of every row into one call)', () => {
        const lines = Array.from({ length: 200_000 }, (_, i) => String(i % 10)).join('\n');
        const grid = pastedGrid(lines);
        expect(grid).toHaveLength(200_000);
        const rows = blank();
        const plan = planPasteRequests(grid, 0, 'n', {
            navigableKeys: COLUMNS.map((c) => String(c.accessorKey)),
            rowCount: rows.length,
            rowAt: (i) => rows[i],
            columnByKey: (key) => COLUMNS.find((c) => c.accessorKey === key),
            cellValue: (row, column) => getCellValue(row, column.accessorKey, column),
        });
        expect(plan?.requests).toHaveLength(3); // only the drawn rows
        expect(plan?.rect).toEqual({ startRow: 0, startCol: 'n', endRow: 2, endCol: 'n' });
    });
});

describe('paste planning and writing', () => {
    it('writes a grid from the start cell across columns and rows, coercing numbers (spec 6838)', () => {
        const t = table(blank());
        t.paste('10\ta\n20\tb', 0, 'n');
        expect(t.data()[0]).toMatchObject({ n: 10, label: 'a' });
        expect(t.data()[1]).toMatchObject({ n: 20, label: 'b' });
        expect(typeof t.data()[0]?.n).toBe('number');
    });

    it('skips columns without a valueSetter and cells past the last row (spec 6846)', () => {
        const t = table(blank());
        const event = t.paste('x\t42\ny\t43', 2, 'id');
        expect(t.data()).toEqual([
            { id: '1', n: 0, label: '' },
            { id: '2', n: 0, label: '' },
            { id: '3', n: 42, label: '' },
        ]);
        expect(event).toMatchObject({ cellsApplied: 1, cellsRejected: 0, rowsAffected: 2, startRow: 2, startColumn: 'id' });
    });

    it('rejects cells failing the editValidator and counts them, one edit-error each (spec 6859)', () => {
        const t = table(blank());
        const event = t.paste('5\n999', 0, 'n');
        expect(t.data().map((r) => r.n)).toEqual([5, 0, 0]);
        expect(event).toMatchObject({ cellsApplied: 1, cellsRejected: 1, rowsAffected: 2 });
        expect(t.errors).toHaveLength(1);
    });

    it('is a no-op when the start column is not navigable, or the text is empty (spec 6867)', () => {
        const t = table(blank());
        expect(t.paste('5', 0, 'not-a-column')).toBeNull();
        expect(t.paste('', 0, 'n')).toBeNull();
        expect(t.events).toEqual([]);
    });

    it('coerces boolean cells from the current value (spec 6874)', () => {
        const cols: ColumnDef<FillRow>[] = [
            { accessorKey: 'id', header: 'ID' },
            { accessorKey: 'active', header: 'Active', valueSetter: (row, v) => ({ ...row, active: v as boolean }) },
        ];
        const t = table([{ id: '1', n: 0, label: '', active: true }], cols);
        t.paste('false', 0, 'active');
        expect(t.data()[0]?.active).toBe(false);
    });

    it('clears a number for a blank cell instead of writing 0, and keeps text that is no number (D9, Angular AB2)', () => {
        const open: ColumnDef<FillRow>[] = [COLUMNS[0] as ColumnDef<FillRow>, { accessorKey: 'n', header: 'N', valueSetter: (row, v) => ({ ...row, n: v as number }) }];
        const t = table([{ id: '1', n: 7, label: '' }, { id: '2', n: 8, label: '' }], open);
        t.paste('\nabc', 0, 'n');
        expect(t.data().map((r) => r.n)).toEqual([null, 'abc']);
    });

    it('drops cells past the last navigable column', () => {
        const t = table(blank());
        const plan = planPasteRequests(pastedGrid('1\tx\textra\tmore'), 0, 'n', t.source());
        expect(plan?.requests.map((r) => r.target.columnKey)).toEqual(['n', 'label']);
        expect(plan?.rect).toEqual({ startRow: 0, startCol: 'n', endRow: 0, endCol: 'label' });
    });

    it('covers the pasted rectangle inside the table: rows and columns trimmed', () => {
        const t = table(blank());
        expect(planPasteRequests(pastedGrid('1\ta\n2\tb\n3\tc\n4\td'), 1, 'n', t.source())?.rect).toEqual({ startRow: 1, startCol: 'n', endRow: 2, endCol: 'label' });
        expect(planPasteRequests(pastedGrid('1'), 5, 'n', t.source())?.rect).toBeNull(); // starts past the rows
    });

    it('resolves every row before the first write: pasting into the sort column writes the rows that were there (Angular AB3)', () => {
        // A "drawn" list sorted by n: every write re-sorts it. The plan reads the rows once, so each value lands on the row it was pasted over.
        let data: FillRow[] = [{ id: 'a', n: 1, label: '' }, { id: 'b', n: 2, label: '' }, { id: 'c', n: 3, label: '' }];
        const drawn = (): FillRow[] => [...data].sort((x, y) => Number(x.n) - Number(y.n));
        const writer = createCellWriter<FillRow>({
            getData: () => data,
            setData: (next) => (data = next),
            batch: (fn) => fn(),
            getRowId: (row) => row.id,
            columnByKey: (key) => COLUMNS.find((c) => c.accessorKey === key),
            rowAt: (i) => drawn()[i],
            cellValue: (row, column) => getCellValue(row, column.accessorKey, column),
            historyEnabled: () => false,
            rejectionMessage: () => 'invalid',
            emit: () => undefined,
        });
        const plan = planPasteRequests(pastedGrid('50\n40\n30'), 0, 'n', { navigableKeys: ['id', 'n', 'label'], rowCount: 3, rowAt: (i) => drawn()[i], columnByKey: (k) => COLUMNS.find((c) => c.accessorKey === k), cellValue: (row, c) => getCellValue(row, c.accessorKey, c) });
        writer.writeCells(plan?.requests ?? []);
        expect(Object.fromEntries(data.map((r) => [r.id, r.n]))).toEqual({ a: 50, b: 40, c: 30 });
    });

    it('is ONE undo step and one data write through the real writer', () => {
        const t = table(blank());
        t.paste('1\ta\n2\tb\n3\tc', 0, 'n');
        expect(t.changes).toHaveBeenCalledTimes(1);
        expect(t.writer.canUndo).toBe(true);
        t.writer.undo();
        expect(t.data()).toEqual(blank());
        expect(t.writer.canUndo).toBe(false);
    });

    it('round-trips a copied range back through paste, formula-guarded cells and a plain -5 included (spec 6918)', () => {
        const labels = ['=total', '- item', '@user', '-12', "'plain apostrophe text", "'=x", '=SUM(A1)', '-5'];
        const rows = labels.map((label, i) => ({ id: String(i + 1), n: i, label }));
        const keys = ['id', 'n', 'label'];
        const grid = rangeGrid({ columns: COLUMNS, navigableKeys: keys, rowAt: (i) => rows[i], focused: null, range: { minRow: 0, maxRow: rows.length - 1, minCol: 1, maxCol: 2 }, drawnRows: () => rows, isSelected: () => false, exportAll: () => [] });
        const text = toClipboardText(grid ?? []);
        expect(text.split('\n').map((line) => line.split('\t')[1])).toEqual(["'=total", "'- item", "'@user", '-12', "'plain apostrophe text", "''=x", "'=SUM(A1)", '-5']);
        const t = table(labels.map((...[, i]) => ({ id: String(i + 1), n: 0, label: '' })));
        t.paste(text, 0, 'n');
        expect(t.data().map((r) => r.label)).toEqual(labels);
        expect(t.data().map((r) => r.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('handles CRLF, a trailing line break and quoted multi-line cells', () => {
        expect(pastedGrid('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
        expect(pastedGrid('"two\nlines"\tx')).toEqual([['two\nlines', 'x']]);
    });
});

describe('the paste announcement', () => {
    it('says how many cells were pasted, and how many were rejected', () => {
        expect(pasteAnnouncement(EN_LOCALE, 1, 0)).toBe('1 cell pasted');
        expect(pasteAnnouncement(EN_LOCALE, 4, 0)).toBe('4 cells pasted');
        expect(pasteAnnouncement(EN_LOCALE, 3, 2)).toBe('3 cells pasted, 2 rejected');
    });
});
