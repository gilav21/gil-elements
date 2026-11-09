import { describe, expect, it } from 'vitest';
import type { ColumnDef } from './data-table.types.js';
import { DEFAULT_REJECTION_MESSAGE, createCellWriter } from './data-table-cell-write.js';

interface Row {
    id: string;
    name: string;
    qty: number;
}

function setup(options: { history?: boolean; validator?: ColumnDef<Row>['editValidator'] } = {}) {
    let data: Row[] = [
        { id: 'a', name: 'Ann', qty: 1 },
        { id: 'b', name: 'Bob', qty: 2 },
    ];
    const events: [string, unknown][] = [];
    const columns: ColumnDef<Row>[] = [
        { accessorKey: 'name', header: 'Name', valueSetter: (r, v) => ({ ...r, name: String(v) }), editValidator: options.validator },
        { accessorKey: 'qty', header: 'Qty', valueSetter: (r, v) => ({ ...r, qty: Number(v) }) },
        { accessorKey: 'id', header: 'Id' },
    ];
    const writer = createCellWriter<Row>({
        getData: () => data,
        setData: (next) => {
            data = next;
        },
        getRowId: (r) => r.id,
        columnByKey: (key) => columns.find((c) => String(c.accessorKey) === key),
        rowAt: (i) => data[i],
        cellValue: (row, column) => row[column.accessorKey as keyof Row],
        historyEnabled: () => options.history ?? true,
        emit: (name, detail) => events.push([name, detail]),
    });
    return {
        writer,
        events,
        data: () => data,
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

    it('uses the default message for a validator that says false, and stays quiet with report: false', () => {
        const { writer, events } = setup({ validator: () => false });
        expect(writer.writeCell({ rowIndex: 0, columnKey: 'name' }, 'x', { report: false })).toMatchObject({ message: DEFAULT_REJECTION_MESSAGE });
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

        expect(writer.undo()).toBe(true);
        expect(data().map((r) => r.qty)).toEqual([1, 2]);
        expect(writer.canUndo).toBe(false);
        expect(writer.canRedo).toBe(true);

        expect(writer.redo()).toBe(true);
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
        expect(writer.undo()).toBe(false);
        expect(writer.redo()).toBe(false);
    });
});
