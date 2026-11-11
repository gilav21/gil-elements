import { describe, expect, it, vi } from 'vitest';
import type { GridView } from './data-table-grid.js';
import { renderRows } from './data-table-grid-rows.js';
import type { RowFlags } from './data-table-grid-state.js';
import { NO_CELL_FLAGS, NO_ROW_FLAGS } from './data-table-grid-state.js';
import type { EnhancedColumnDef } from './data-table.types.js';

interface Row {
    id: string;
    a: string;
    b: string;
}

const rows: Row[] = Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, a: `a${i}`, b: `b${i}` }));
const columns = ['a', 'b'].map((accessorKey) => ({ accessorKey, header: accessorKey, _width: '100px', _minWidth: '50px' })) as unknown as EnhancedColumnDef<Row>[];

/** The parts of a `GridView` the body rows read, with counters on the two wave state functions. */
function view(cellStateActive: boolean, rowStateActive = cellStateActive) {
    const cellState = vi.fn(() => NO_CELL_FLAGS);
    const rowState = vi.fn((): RowFlags => NO_ROW_FLAGS);
    const getRowId = vi.fn((row: Row) => row.id);
    const isDisabled = vi.fn(() => false);
    const v = {
        columns,
        hasFlexible: true,
        body: { mode: 'flat', items: rows.map((row, index) => ({ kind: 'data', row, index })), window: { start: 0, end: rows.length, padStart: 0, padEnd: 0, colStart: 0, colEnd: columns.length, colPadStart: 0, colPadEnd: 0, retained: [] } },
        aria: { colIndex: (n: number) => n + 1, dataRowIndex: (n: number) => n + 2, colCount: 2 },
        selection: {},
        expanded: {},
        openDetails: [],
        detail: false,
        selectable: false,
        focusedCell: null,
        treeHost: null,
        formatting: undefined,
        renderFullWidth: undefined,
        getRowId,
        isDisabled,
        stateActive: cellStateActive || rowStateActive,
        cellStateActive,
        rowStateActive,
        cellState,
        rowState,
        locale: {},
        uid: '1',
        roving: true,
    } as unknown as GridView<Row>;
    return { v, cellState, rowState, getRowId, isDisabled };
}

describe('an editor that draws nothing', () => {
    it('is the answer of the editor: a null from the editor view is drawn as it is, the plain content is not rendered in its place', () => {
        const cellRenderer = vi.fn(({ value }: { value: unknown }) => `plain ${String(value)}`);
        const cols = columns.map((c) => ({ ...c, cellRenderer })) as unknown as EnhancedColumnDef<Row>[];
        const { v } = view(true);
        const edit = { cell: vi.fn(() => null) };
        const editingFirst = vi.fn((rowIndex: number, key: string) => ({ ...NO_CELL_FLAGS, editing: rowIndex === 0 && key === 'a' }));
        const result = renderRows({ ...v, columns: cols, edit, cellState: editingFirst } as unknown as GridView<Row>);
        expect(result).toBeDefined();
        expect(edit.cell).toHaveBeenCalledTimes(1);
        // 4 rows x 2 cells, the plain renderer runs for every cell but the one whose editor answered null
        expect(cellRenderer).toHaveBeenCalledTimes(rows.length * cols.length - 1);
    });
});

describe('the body rows and the wave 5 and 6 state', () => {
    it('make no cellState or rowState call for a plain grid (nothing is active)', () => {
        const { v, cellState, rowState } = view(false);
        renderRows(v);
        expect(cellState).not.toHaveBeenCalled();
        expect(rowState).not.toHaveBeenCalled();
    });

    it('call rowState once per row and cellState once per cell when a feature is active, with the row facts the renderer read', () => {
        const { v, cellState, rowState } = view(true);
        renderRows(v);
        expect(rowState).toHaveBeenCalledTimes(rows.length);
        expect(cellState).toHaveBeenCalledTimes(rows.length * columns.length);
        expect(cellState).toHaveBeenCalledWith(0, 'a', { id: 'r0', disabled: false });
        expect(rowState).toHaveBeenCalledWith(1, { id: 'r1', disabled: false });
    });

    it('ask a row for its state but no cell when only the rows are active (draggable rows), and no row when only the cells are', () => {
        const drag = view(false, true);
        renderRows(drag.v);
        expect(drag.cellState).not.toHaveBeenCalled();
        expect(drag.rowState).toHaveBeenCalledTimes(rows.length);
        const cells = view(true, false);
        renderRows(cells.v);
        expect(cells.rowState).not.toHaveBeenCalled();
        expect(cells.cellState).toHaveBeenCalledTimes(rows.length * columns.length);
    });

    it('read getRowId and isDisabled no more often with a feature active than without (the state functions never ask again)', () => {
        const plain = view(false);
        const active = view(true);
        renderRows(plain.v);
        renderRows(active.v);
        expect(active.getRowId.mock.calls.length).toBe(plain.getRowId.mock.calls.length);
        expect(active.isDisabled.mock.calls.length).toBe(plain.isDisabled.mock.calls.length);
    });
});
