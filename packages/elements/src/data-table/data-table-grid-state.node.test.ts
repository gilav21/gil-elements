import { describe, expect, it } from 'vitest';
import { DRAGGABLE_ROW_FLAGS, EDITABLE_CELL_FLAGS, NO_CELL_FLAGS, NO_ROW_FLAGS, rangeEdges, stateView } from './data-table-grid-state.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { NormalizedRange } from './data-table-range.js';

interface Row {
    id: string;
    disabled?: boolean;
}

/** A host with only what `stateView` reads. */
function fakeHost(options: {
    config?: Record<string, unknown>;
    providers?: Record<string, unknown>;
}): DataTableViewHost<Row> {
    const config = { columns: [], enableCellRangeSelection: false, enableCellFlash: false, enableRowDrag: false, enableFillHandle: false, loading: false, getRowId: (row: Row) => row.id, ...options.config };
    return {
        config,
        provider: (key: string) => options.providers?.[key],
        isDisabled: (row: Row) => row.disabled === true,
    } as unknown as DataTableViewHost<Row>;
}

const row: Row = { id: 'r1' };

describe('rangeEdges', () => {
    const range: NormalizedRange = { minRow: 1, maxRow: 3, minCol: 1, maxCol: 2 };

    it('lists the edges a cell touches and nothing for an inner or outer-free cell', () => {
        expect(rangeEdges(range, 1, 1)).toBe('top start');
        expect(rangeEdges(range, 3, 2)).toBe('bottom end');
        expect(rangeEdges(range, 2, 1)).toBe('start');
        expect(rangeEdges({ ...range, minCol: 1, maxCol: 3 }, 2, 2)).toBe('');
    });

    it('gives a one-cell range all four', () => {
        expect(rangeEdges({ minRow: 2, maxRow: 2, minCol: 0, maxCol: 0 }, 2, 0)).toBe('top bottom start end');
    });
});

describe('stateView with the step-0 services', () => {
    it('answers the shared frozen none object for every cell and row of a plain grid', () => {
        const state = stateView(fakeHost({}));
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
        expect(state.rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
        expect(state.rangeSelectable).toBe(false);
        expect(Object.isFrozen(NO_CELL_FLAGS)).toBe(true);
    });

    it('marks an editable column one shared object, and not a disabled row', () => {
        const state = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] } }));
        expect(state.cellState(0, 'name', row)).toBe(EDITABLE_CELL_FLAGS);
        expect(state.cellState(0, 'other', row)).toBe(NO_CELL_FLAGS);
        expect(state.cellState(0, 'name', { id: 'r2', disabled: true })).toBe(NO_CELL_FLAGS);
    });

    it('marks the cell that holds the open editor', () => {
        const interaction = { editingCell: () => ({ rowIndex: 2, columnKey: 'name' }) };
        const state = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] }, providers: { interaction } }));
        expect(state.cellState(2, 'name', row)).toMatchObject({ editing: true, editable: true });
        expect(state.cellState(1, 'name', row)).toBe(EDITABLE_CELL_FLAGS);
    });

    it('makes every cell carry aria-selected in range mode, true inside the range', () => {
        const range = { normalized: () => ({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }), isInRange: (r: number, c: string) => r <= 1 && ['a', 'b'].includes(c), isFillPreview: () => false };
        const columns = { navigableKeys: () => ['a', 'b', 'c'] };
        const state = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range, columns } }));
        expect(state.rangeSelectable).toBe(true);
        expect(state.cellState(0, 'a', row)).toMatchObject({ inRange: true, selected: 'true', rangeEdge: 'top start' });
        expect(state.cellState(1, 'b', row)).toMatchObject({ inRange: true, rangeEdge: 'bottom end' });
        expect(state.cellState(0, 'c', row)).toMatchObject({ inRange: false, selected: 'false' });
    });

    it('reads the flash of a cell, unless the column opted out', () => {
        const formatting = { flash: (id: string, key: string) => (id === 'r1' && key === 'price' ? ('up' as const) : undefined) };
        const columns = [{ accessorKey: 'price' }, { accessorKey: 'name', enableCellFlash: false }];
        const state = stateView(fakeHost({ config: { enableCellFlash: true, columns }, providers: { formatting } }));
        expect(state.cellState(0, 'price', row)).toMatchObject({ flash: 'up' });
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
    });

    it('marks a draggable row with one shared object, a disabled or loading row not at all', () => {
        const on = stateView(fakeHost({ config: { enableRowDrag: true } }));
        expect(on.rowState(0, 'r1', row)).toBe(DRAGGABLE_ROW_FLAGS);
        expect(on.rowState(0, 'r2', { id: 'r2', disabled: true })).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: true, loading: true } })).rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
    });

    it('marks the dragged row and the edge of the row under the pointer', () => {
        const rowDrag = { dragState: () => ({ draggedId: 'r1', overIndex: 3, edge: 'bottom' as const }) };
        const state = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag } }));
        expect(state.rowState(0, 'r1', row)).toMatchObject({ dragging: true });
        expect(state.rowState(3, 'r4', { id: 'r4' })).toMatchObject({ dragging: false, dropEdge: 'bottom', draggable: true });
        expect(state.rowState(5, 'r6', { id: 'r6' })).toBe(DRAGGABLE_ROW_FLAGS);
    });
});
