import { describe, expect, it } from 'vitest';
import type { ColumnDef } from './data-table.types.js';
import { createCellWriter } from './data-table-cell-write.js';

interface Row {
    id: string;
    name: string;
    qty: number;
}

function setup(options: { history?: boolean; rejectionMessage?: () => string; validator?: ColumnDef<Row>['editValidator']; rows?: Row[]; rowAt?: (i: number, data: Row[]) => Row | undefined } = {}) {
    let data: Row[] = options.rows ?? [
        { id: 'a', name: 'Ann', qty: 1 },
        { id: 'b', name: 'Bob', qty: 2 },
    ];
    let setCalls = 0;
    let idCalls = 0;
    let batchDepth = 0;
    let batchedSets = 0;
    const events: [string, unknown][] = [];
    const columns: ColumnDef<Row>[] = [
        { accessorKey: 'name', header: 'Name', valueSetter: (r, v) => ({ ...r, name: String(v) }), editValidator: options.validator },
        { accessorKey: 'qty', header: 'Qty', valueSetter: (r, v) => ({ ...r, qty: Number(v) }) },
        { accessorKey: 'id', header: 'Id' },
    ];
    const writer = createCellWriter<Row>({
        getData: () => data,
        setData: (next) => {
            setCalls++;
            if (batchDepth === 0) batchedSets++;
            data = next;
        },
        batch: (fn) => {
            batchDepth++;
            try {
                return fn();
            } finally {
                batchDepth--;
            }
        },
        getRowId: (r) => {
            idCalls++;
            return r.id;
        },
        columnByKey: (key) => columns.find((c) => String(c.accessorKey) === key),
        rowAt: (i) => (options.rowAt ? options.rowAt(i, data) : data[i]),
        cellValue: (row, column) => row[column.accessorKey as keyof Row],
        historyEnabled: () => options.history ?? true,
        rejectionMessage: options.rejectionMessage ?? (() => 'Invalid value'),
        emit: (name, detail) => events.push([name, detail]),
    });
    return {
        writer,
        events,
        data: () => data,
        counts: () => ({ setCalls, idCalls, batchedSets }),
        drop: (id: string) => {
            data = data.filter((r) => r.id !== id);
        },
        reverse: () => {
            data = [...data].reverse();
        },
    };
}

describe('writeCell', () => {
    it('validates, runs the value setter and publishes a NEW array and row without touching the old ones', () => {
        const { writer, data } = setup();
        const before = data();
        const row = before[0];
        const result = writer.writeCell({ rowIndex: 0, columnKey: 'name' }, 'Zed');

        expect(result).toMatchObject({ status: 'written', oldValue: 'Ann' });
        expect(data()[0]).toEqual({ id: 'a', name: 'Zed', qty: 1 });
        expect(data()).not.toBe(before);
        expect(row).toEqual({ id: 'a', name: 'Ann', qty: 1 });
    });

    it('rejects through the validator, reports edit-error, and leaves the data alone', () => {
        const { writer, events, data } = setup({ validator: (v) => (v === '' ? 'Required' : true) });
        const result = writer.writeCell({ rowIndex: 1, columnKey: 'name' }, '');

        expect(result).toMatchObject({ status: 'rejected', message: 'Required' });
        expect(data()[1]?.name).toBe('Bob');
        expect(events).toEqual([['edit-error', expect.objectContaining({ value: '', rowIndex: 1, message: 'Required' })]]);
    });

    it('takes the default message from the port, so the table can pass the message of its locale', () => {
        const { writer } = setup({ validator: () => false, rejectionMessage: () => 'Nope' });
        expect(writer.writeCell({ rowIndex: 0, columnKey: 'name' }, 'x', { report: false })).toMatchObject({ message: 'Nope' });
    });

    it('uses the default message for a validator that says false, and stays quiet with report: false', () => {
        const { writer, events } = setup({ validator: () => false });
        expect(writer.writeCell({ rowIndex: 0, columnKey: 'name' }, 'x', { report: false })).toMatchObject({ message: 'Invalid value' });
        expect(events).toEqual([]);
    });

    it('fires cell-edit before the write when asked, and only then', () => {
        const { writer, events } = setup();
        writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 5);
        expect(events).toEqual([]);
        writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 6, { emitEdit: true });
        expect(events).toEqual([['cell-edit', expect.objectContaining({ oldValue: 5, newValue: 6, rowIndex: 0 })]]);
    });

    it.each([
        ['an unknown column', { rowIndex: 0, columnKey: 'nope' }],
        ['a row that is gone', { rowIndex: 9, columnKey: 'name' }],
        ['a column without a value setter', { rowIndex: 0, columnKey: 'id' }],
    ])('skips %s', (_name, target) => {
        const { writer, data } = setup();
        const before = data();
        expect(writer.writeCell(target, 'x')).toEqual({ status: 'skipped' });
        expect(data()).toBe(before);
    });
});

describe('runAsCommand and undo', () => {
    it('makes a whole gesture one undo step', () => {
        const { writer, data } = setup();
        writer.runAsCommand(() => {
            writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10);
            writer.writeCell({ rowIndex: 1, columnKey: 'qty' }, 20);
        });
        expect(writer.canUndo).toBe(true);

        expect(writer.undo()).toEqual({ done: true, stale: [] });
        expect(data().map((r) => r.qty)).toEqual([1, 2]);
        expect(writer.canUndo).toBe(false);
        expect(writer.canRedo).toBe(true);

        expect(writer.redo()).toEqual({ done: true, stale: [] });
        expect(data().map((r) => r.qty)).toEqual([10, 20]);
    });

    it('does not record a write made outside a command (AI fill is not undoable)', () => {
        const { writer } = setup();
        writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10);
        expect(writer.canUndo).toBe(false);
    });

    it('records nothing while history is off, but still runs the function and returns its value', () => {
        const { writer } = setup({ history: false });
        expect(writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10).status)).toBe('written');
        expect(writer.canUndo).toBe(false);
    });

    it('records no step for a command that wrote nothing, and a new step clears the redo stack', () => {
        const { writer } = setup();
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'id' }, 'x'));
        expect(writer.canUndo).toBe(false);

        writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10));
        writer.undo();
        expect(writer.canRedo).toBe(true);
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 11));
        expect(writer.canRedo).toBe(false);
    });

    it('joins a nested command to the outer one', () => {
        const { writer, data } = setup();
        writer.runAsCommand(() => {
            writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10);
            writer.runAsCommand(() => writer.writeCell({ rowIndex: 1, columnKey: 'qty' }, 20));
        });
        writer.undo();
        expect(data().map((r) => r.qty)).toEqual([1, 2]);
        expect(writer.canUndo).toBe(false);
    });

    it('undoes by row identity after the rows moved, emitting cell-edit and edit-undo', () => {
        const { writer, events, data, reverse } = setup();
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10));
        reverse();
        events.length = 0;

        writer.undo();
        expect(data().map((r) => [r.id, r.qty])).toEqual([['b', 2], ['a', 1]]);
        expect(events.map(([name]) => name)).toEqual(['cell-edit', 'edit-undo']);
    });

    it('has nothing to undo or redo on a fresh table', () => {
        const { writer } = setup();
        expect(writer.undo().done).toBe(false);
        expect(writer.redo().done).toBe(false);
    });
});

describe('writeCells', () => {
    it('resolves every row before the first write, so a re-sorting rendered list cannot misdirect later cells', () => {
        // The rendered list is the data sorted by name descending, recomputed on every call, like the query graph.
        const rows: Row[] = [
            { id: 'a', name: 'Ann', qty: 1 },
            { id: 'b', name: 'Bob', qty: 2 },
            { id: 'c', name: 'Cy', qty: 3 },
        ];
        const { writer, data } = setup({ rows, rowAt: (i, d) => [...d].sort((x, y) => y.name.localeCompare(x.name))[i] });
        // Rendered order: Cy, Bob, Ann. Renaming the first one to 'Aaa' would move it to the end when re-sorted lazily.
        const results = writer.writeCells([
            { target: { rowIndex: 0, columnKey: 'name' }, value: 'Aaa' },
            { target: { rowIndex: 1, columnKey: 'name' }, value: 'Bbb' },
            { target: { rowIndex: 2, columnKey: 'name' }, value: 'Ccc' },
        ]);
        expect(results.map((r) => r.status)).toEqual(['written', 'written', 'written']);
        expect(data().map((r) => [r.id, r.name])).toEqual([['a', 'Ccc'], ['b', 'Bbb'], ['c', 'Aaa']]);
    });

    it('replays a history entry with the row index the edit carried, even when the edit moved the row (sorted by the edited column)', () => {
        const rows: Row[] = [
            { id: 'a', name: 'Ann', qty: 1 },
            { id: 'b', name: 'Bob', qty: 2 },
            { id: 'c', name: 'Cy', qty: 3 },
        ];
        // drawn: Cy, Bob, Ann (descending by name); the cell of Ann is drawn row 2; renamed to Zed it would be drawn row 0
        const { writer, events } = setup({ rows, rowAt: (i, d) => [...d].sort((x, y) => y.name.localeCompare(x.name))[i] });
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 2, columnKey: 'name' }, 'Zed', { emitEdit: true }));
        writer.undo();
        writer.redo();
        const edits = events.filter(([name]) => name === 'cell-edit').map(([, detail]) => (detail as { rowIndex: number }).rowIndex);
        expect(edits).toEqual([2, 2, 2]);
    });

    it('keeps the drawn index in the history entry a replay inside a command makes, so the next undo reports it too', () => {
        const rows: Row[] = [
            { id: 'a', name: 'Ann', qty: 1 },
            { id: 'b', name: 'Bob', qty: 2 },
            { id: 'c', name: 'Cy', qty: 3 },
        ];
        // drawn: Cy, Bob, Ann; Ann (drawn row 2, data index 0) is renamed Zed and would then be drawn first
        const { writer, events } = setup({ rows, rowAt: (i, d) => [...d].sort((x, y) => y.name.localeCompare(x.name))[i] });
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 2, columnKey: 'name' }, 'Zed', { emitEdit: true }));
        writer.runAsCommand(() => writer.undo()); // a replay while a command records: its own entry is made
        writer.undo(); // undoes that undo
        const indexes = events.filter(([name]) => name === 'cell-edit').map(([, detail]) => (detail as { rowIndex: number }).rowIndex);
        expect(indexes).toEqual([2, 2, 2]);
    });

    it('validates each cell, reports each rejection, and still writes the rest in one data write', () => {
        const { writer, events, counts, data } = setup({ validator: (v) => (v === 'bad' ? 'no' : true) });
        const results = writer.writeCells([
            { target: { rowIndex: 0, columnKey: 'name' }, value: 'bad' },
            { target: { rowIndex: 1, columnKey: 'name' }, value: 'good' },
            { target: { rowIndex: 0, columnKey: 'qty' }, value: 7 },
        ]);
        expect(results.map((r) => r.status)).toEqual(['rejected', 'written', 'written']);
        expect(events).toEqual([['edit-error', expect.objectContaining({ message: 'no', rowIndex: 0 })]]);
        expect(counts().setCalls).toBe(1);
        expect(data().map((r) => [r.name, r.qty])).toEqual([['Ann', 7], ['good', 2]]);
    });

    it('applies two cells of the same row on top of each other', () => {
        const { writer, data } = setup();
        writer.writeCells([
            { target: { rowIndex: 0, columnKey: 'name' }, value: 'Z' },
            { target: { rowIndex: 0, columnKey: 'qty' }, value: 9 },
        ]);
        expect(data()[0]).toEqual({ id: 'a', name: 'Z', qty: 9 });
    });

    it('writes 1,000 cells in one command as one data write and one undo step, scanning ids O(rows)', () => {
        const rows = Array.from({ length: 1000 }, (_, i) => ({ id: 'r' + i, name: 'n', qty: i }));
        const { writer, counts, data } = setup({ rows });
        writer.runAsCommand(() => {
            writer.writeCells(rows.map((_, i) => ({ target: { rowIndex: i, columnKey: 'qty' }, value: -i })));
        });
        expect(counts().setCalls).toBe(1);
        expect(counts().batchedSets).toBe(0);
        expect(counts().idCalls).toBeLessThan(5000);
        writer.undo();
        expect(data().map((r) => r.qty)).toEqual(rows.map((r) => r.qty));
        expect(counts().setCalls).toBe(2);
    });

    it('holds a command of several writeCells calls inside one batch with one setData each, not one per cell', () => {
        const { writer, counts } = setup();
        writer.runAsCommand(() => {
            writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 5);
            writer.writeCell({ rowIndex: 1, columnKey: 'qty' }, 6);
        });
        expect(counts().batchedSets).toBe(0);
    });
});

describe('stale history entries', () => {
    it('reports an undo whose row is gone, and applies the other entries of the step', () => {
        const { writer, drop, data, events } = setup();
        writer.runAsCommand(() => {
            writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10);
            writer.writeCell({ rowIndex: 1, columnKey: 'qty' }, 20);
        });
        drop('a');
        events.length = 0;

        expect(writer.undo()).toEqual({ done: true, stale: [{ rowId: 'a', columnKey: 'qty', reason: 'row' }] });
        expect(data().map((r) => [r.id, r.qty])).toEqual([['b', 2]]);
        expect(events.map(([n]) => n)).toEqual(['cell-edit', 'edit-undo']);
    });

    it('reports a redo whose row is gone', () => {
        const { writer, drop } = setup();
        writer.runAsCommand(() => writer.writeCell({ rowIndex: 0, columnKey: 'qty' }, 10));
        writer.undo();
        drop('a');
        expect(writer.redo().stale).toEqual([{ rowId: 'a', columnKey: 'qty', reason: 'row' }]);
    });
});
