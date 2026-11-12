/**
 * The fill planner, through the real cell writer (`createCellWriter`), as the range part runs it. Ports of the Angular fill specs
 * (cmp spec "fill handle (B1)" and the history block that fills), plus the cases Angular gets wrong (AB3: rows resolved before the first write).
 */
import { describe, expect, it, vi } from 'vitest';
import { createCellWriter } from './data-table-cell-write.js';
import { buildFillValues } from './data-table-fill.js';
import { fillOutcome, type FillOutcome, planFill, repeatFirst } from './data-table-fill-apply.js';
import { fillSourceRange, normalizeCellRange } from './data-table-range.js';
import type { CellRange, ColumnDef } from './data-table.types.js';
import { getCellValue } from './data-table.utils.js';

interface FillRow {
    id: string;
    n: number;
    label: string;
}

const COLUMNS: ColumnDef<FillRow>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'n', header: 'N', valueSetter: (row, v) => ({ ...row, n: v as number }) },
    { accessorKey: 'label', header: 'Label', valueSetter: (row, v) => ({ ...row, label: v as string }) },
];
const KEYS = COLUMNS.map((c) => String(c.accessorKey));

function table(rows: FillRow[], { history = false, sortBy, validator }: { history?: boolean; sortBy?: keyof FillRow; validator?: (value: unknown) => boolean | string } = {}) {
    let data = rows;
    const columns = COLUMNS.map((c) => (validator && c.accessorKey === 'n' ? { ...c, editValidator: validator } : c));
    const drawn = (): FillRow[] => (sortBy ? [...data].sort((a, b) => (a[sortBy] < b[sortBy] ? -1 : a[sortBy] > b[sortBy] ? 1 : 0)) : data);
    const events: { name: string; detail: unknown }[] = [];
    const setData = vi.fn((next: FillRow[]) => void (data = next));
    const writer = createCellWriter<FillRow>({
        getData: () => data,
        setData,
        batch: (fn) => fn(),
        getRowId: (row) => row.id,
        columnByKey: (key) => columns.find((c) => c.accessorKey === key),
        rowAt: (i) => drawn()[i],
        cellValue: (row, column) => getCellValue(row, column.accessorKey, column),
        historyEnabled: () => history,
        rejectionMessage: () => 'Invalid value',
        emit: (name, detail) => void events.push({ name, detail }),
    });
    /** `fillDownTo` as the range part does it: the source from the range or the focused cell, one command, one write. */
    const fillDownTo = (source: { range?: CellRange | null; focused?: { rowIndex: number; columnKey: string } | null }, target: number, series = buildFillValues): FillOutcome | null => {
        const from = fillSourceRange(normalizeCellRange(source.range ?? null, KEYS), source.focused ?? null, KEYS);
        if (!from) return null;
        const plan = planFill<FillRow>({
            source: from,
            target,
            keys: KEYS,
            rowCount: drawn().length,
            rowAt: (i) => drawn()[i],
            column: (key) => columns.find((c) => c.accessorKey === key),
            value: (row, column) => getCellValue(row, column.accessorKey, column),
            series,
        });
        return plan && fillOutcome(plan, writer.runAsCommand(() => writer.writeCells(plan.requests)));
    };
    return { data: () => data, drawn, writer, events, setData, fillDownTo };
}

const rows = (): FillRow[] => [
    { id: '1', n: 1, label: 'Item 1' },
    { id: '2', n: 2, label: 'Item 2' },
    { id: '3', n: 0, label: '' },
    { id: '4', n: 0, label: '' },
];
const range = (startRow: number, startCol: string, endRow: number, endCol: string): CellRange => ({ startRow, startCol, endRow, endCol });

describe('fill (ports of the Angular fill specs)', () => {
    it('fills a numeric series down from a selected range', () => {
        const t = table(rows());
        t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3);
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 3, 4]);
    });

    it('reports the filled rows and columns (fill-series)', () => {
        const t = table(rows());
        expect(t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3)?.event).toEqual({ source: { minRow: 0, maxRow: 1 }, filled: { startRow: 2, endRow: 3 }, columnKeys: ['n'] });
    });

    it('is a no-op when the target row is not below the source', () => {
        const t = table(rows());
        expect(t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 1)).toBeNull();
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 0, 0]);
        expect(t.setData).not.toHaveBeenCalled();
    });

    it('falls back to the focused cell as a 1x1 source when no range is selected (a single value repeats)', () => {
        const t = table(rows());
        t.fillDownTo({ focused: { rowIndex: 0, columnKey: 'n' } }, 2);
        expect(t.data().map((r) => r.n)).toEqual([1, 1, 1, 0]);
    });

    it('writes nothing and reports nothing when the column has no valueSetter', () => {
        const t = table(rows());
        expect(t.fillDownTo({ range: range(0, 'id', 1, 'id') }, 3)).toBeNull();
        expect(t.setData).not.toHaveBeenCalled();
    });

    it('skips rows past the end of the data when the target overruns it (and reports the rows it covered)', () => {
        const t = table(rows());
        const outcome = t.fillDownTo({ range: range(0, 'n', 0, 'n') }, 10);
        expect(t.data().map((r) => r.n)).toEqual([1, 1, 1, 1]);
        expect(outcome?.event.filled).toEqual({ startRow: 1, endRow: 3 });
        expect(outcome?.range).toEqual(range(0, 'n', 3, 'n'));
    });

    it('is a no-op when the focused cell column is not navigable', () => {
        const t = table(rows());
        expect(t.fillDownTo({ focused: { rowIndex: 0, columnKey: 'not-a-real-column' } }, 3)).toBeNull();
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 0, 0]);
    });

    it('fills several columns, each by its own series, and skips the one without a setter', () => {
        const t = table(rows());
        const outcome = t.fillDownTo({ range: range(0, 'id', 1, 'label') }, 3);
        expect(t.data().map((r) => [r.id, r.n, r.label])).toEqual([
            ['1', 1, 'Item 1'],
            ['2', 2, 'Item 2'],
            ['3', 3, 'Item 3'],
            ['4', 4, 'Item 4'],
        ]);
        expect(outcome?.event.columnKeys).toEqual(['n', 'label']);
        expect(outcome?.range).toEqual(range(0, 'id', 3, 'label'));
    });
});

describe('fill: one write, one undo step', () => {
    it('writes every cell with ONE setData and is ONE undo step (redo restores it)', () => {
        const t = table(rows(), { history: true });
        t.fillDownTo({ range: range(0, 'n', 1, 'label') }, 3);
        expect(t.setData).toHaveBeenCalledTimes(1);
        expect(t.writer.canUndo).toBe(true);
        t.writer.undo();
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 0, 0]);
        expect(t.data().map((r) => r.label)).toEqual(['Item 1', 'Item 2', '', '']);
        expect(t.writer.canUndo).toBe(false);
        t.writer.redo();
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 3, 4]);
    });

    it('records no history while it is off', () => {
        const t = table(rows());
        t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3);
        expect(t.writer.canUndo).toBe(false);
    });

    it('resolves every target row before the first write: filling the column the table is sorted by lands on the rows that were drawn (AB3)', () => {
        // drawn order by n: 0 (c), 0 (d), 5 (a), 9 (b); filling n from the first drawn row down would re-sort after every write in Angular
        const data = [
            { id: 'a', n: 5, label: 'a' },
            { id: 'b', n: 9, label: 'b' },
            { id: 'c', n: 0, label: 'c' },
            { id: 'd', n: 0, label: 'd' },
        ];
        const t = table(data, { sortBy: 'n' });
        expect(t.drawn().map((r) => r.id)).toEqual(['c', 'd', 'a', 'b']);
        t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3, repeatFirst);
        // every row drawn below the source at the time of the fill got the value: d, a and b, each once
        expect(Object.fromEntries(t.data().map((r) => [r.id, r.n]))).toEqual({ a: 0, b: 0, c: 0, d: 0 });
        expect(t.setData).toHaveBeenCalledTimes(1);
    });

    it('counts a validator rejection: an edit-error per rejected cell, the rest written, the column reported while one cell was written', () => {
        const t = table(rows(), { validator: (v) => (v === 4 ? 'too big' : true) });
        const outcome = t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3);
        expect(t.data().map((r) => r.n)).toEqual([1, 2, 3, 0]);
        expect(t.events.filter((e) => e.name === 'edit-error')).toHaveLength(1);
        expect(t.events.filter((e) => e.name === 'cell-edit')).toHaveLength(0); // a fill does not emit cell-edit (parity)
        expect(outcome?.event.columnKeys).toEqual(['n']);
    });

    it('reports nothing when every cell was rejected', () => {
        const t = table(rows(), { validator: () => false });
        expect(t.fillDownTo({ range: range(0, 'n', 1, 'n') }, 3)).toBeNull();
        expect(t.events.filter((e) => e.name === 'edit-error')).toHaveLength(2);
    });
});

describe('Ctrl+D (repeatFirst)', () => {
    it('copies the first row of the range into the rest of it, a plain repeat and not a series', () => {
        const t = table(rows());
        const outcome = t.fillDownTo({ range: range(0, 'n', 0, 'label') }, 3, repeatFirst);
        expect(t.data().map((r) => [r.n, r.label])).toEqual([
            [1, 'Item 1'],
            [1, 'Item 1'],
            [1, 'Item 1'],
            [1, 'Item 1'],
        ]);
        expect(outcome?.rows).toBe(3);
    });

    it('repeatFirst repeats the first value', () => {
        expect(repeatFirst([7, 8], 3)).toEqual([7, 7, 7]);
        expect(repeatFirst([], 2)).toEqual([undefined, undefined]);
    });
});

describe('planFill', () => {
    it('answers null with no drawn row below the source', () => {
        const plan = planFill<FillRow>({ source: { minRow: 3, maxRow: 3, minCol: 1, maxCol: 1 }, target: 5, keys: KEYS, rowCount: 4, rowAt: () => undefined, column: () => COLUMNS[1], value: () => 1, series: buildFillValues });
        expect(plan).toBeNull();
    });

    it('builds one request per cell below the source, in column then row order', () => {
        const data = rows();
        const plan = planFill<FillRow>({
            source: { minRow: 0, maxRow: 0, minCol: 1, maxCol: 2 },
            target: 2,
            keys: KEYS,
            rowCount: 4,
            rowAt: (i) => data[i],
            column: (key) => COLUMNS.find((c) => c.accessorKey === key),
            value: (row, column) => getCellValue(row, column.accessorKey, column),
            series: buildFillValues,
        });
        expect(plan?.requests.map((r) => `${r.target.rowIndex}:${r.target.columnKey}=${String(r.value)}`)).toEqual(['1:n=1', '2:n=1', '1:label=Item 2', '2:label=Item 3']);
    });
});
