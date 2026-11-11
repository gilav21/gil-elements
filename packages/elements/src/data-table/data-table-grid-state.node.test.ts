import { describe, expect, it, vi } from 'vitest';
import {
    DRAGGABLE_ROW_FLAGS,
    EDITABLE_CELL_FLAGS,
    NO_CELL_FLAGS,
    NO_ROW_FLAGS,
    OUT_OF_RANGE_EDITABLE_FLAGS,
    OUT_OF_RANGE_FLAGS,
    stateView,
} from './data-table-grid-state.js';
import { type NormalizedRange, rangeEdges } from './data-table-range.js';
import type { DataTableViewHost } from './data-table-view.js';

interface Row {
    id: string;
    disabled?: boolean;
}

/** A host with only what `stateView` reads. */
function fakeHost(options: { config?: Record<string, unknown>; providers?: Record<string, unknown>; isDisabled?: (row: Row) => boolean }): DataTableViewHost<Row> {
    const config = { columns: [], enableCellRangeSelection: false, enableCellFlash: false, enableRowDrag: false, enableFillHandle: false, loading: false, getRowId: (row: Row) => row.id, ...options.config };
    return {
        config,
        provider: (key: string) => options.providers?.[key],
        isDisabled: options.isDisabled ?? ((row: Row) => row.disabled === true),
    } as unknown as DataTableViewHost<Row>;
}

const row: Row = { id: 'r1' };
const dragPart = (state: unknown = null) => ({ active: () => true, dragState: () => state });

describe('rangeEdges', () => {
    const range: NormalizedRange = { minRow: 1, maxRow: 3, minCol: 1, maxCol: 2 };

    it('lists the edges a cell touches and nothing for an inner cell', () => {
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
        const interaction = { isEditing: (rowIndex: number, columnKey: string) => rowIndex === 2 && columnKey === 'name' };
        const state = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] }, providers: { interaction } }));
        expect(state.cellState(2, 'name', row)).toMatchObject({ editing: true, editable: true });
        expect(state.cellState(1, 'name', row)).toBe(EDITABLE_CELL_FLAGS);
    });

    it('makes every cell carry aria-selected in range mode, true inside the range, with the edges the service answers', () => {
        const range = {
            isInRange: (r: number, c: string) => r <= 1 && ['a', 'b'].includes(c),
            isFillPreview: () => false,
            edgeOf: (r: number, c: string) => (r === 0 && c === 'a' ? 'top start' : 'bottom end'),
        };
        const state = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range } }));
        expect(state.rangeSelectable).toBe(true);
        expect(state.cellState(0, 'a', row)).toMatchObject({ inRange: true, selected: 'true', rangeEdge: 'top start' });
        expect(state.cellState(1, 'b', row)).toMatchObject({ inRange: true, rangeEdge: 'bottom end' });
        expect(state.cellState(0, 'c', row)).toBe(OUT_OF_RANGE_FLAGS);
    });

    it('allocates nothing in range mode while no range exists: shared frozen objects for every cell, editable or not', () => {
        const range = { isInRange: () => false, isFillPreview: () => false, edgeOf: () => '' };
        const state = stateView(fakeHost({ config: { enableCellRangeSelection: true, columns: [{ accessorKey: 'name', editable: true }] }, providers: { range } }));
        expect(state.cellState(0, 'other', row)).toBe(OUT_OF_RANGE_FLAGS);
        expect(state.cellState(0, 'name', row)).toBe(OUT_OF_RANGE_EDITABLE_FLAGS);
        expect(state.cellState(5, 'other', { id: 'r9' })).toBe(OUT_OF_RANGE_FLAGS);
        expect(Object.isFrozen(OUT_OF_RANGE_FLAGS) && Object.isFrozen(OUT_OF_RANGE_EDITABLE_FLAGS)).toBe(true);
    });

    it('reads the flash of a cell, unless the column opted out', () => {
        const formatting = { flash: (id: string, key: string) => (id === 'r1' && key === 'price' ? ('up' as const) : undefined) };
        const columns = [{ accessorKey: 'price' }, { accessorKey: 'name', enableCellFlash: false }];
        const state = stateView(fakeHost({ config: { enableCellFlash: true, columns }, providers: { formatting } }));
        expect(state.cellState(0, 'price', row)).toMatchObject({ flash: 'up' });
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
    });

    it('passes the row id to the flash service as a string, whatever getRowId answers', () => {
        const flash = vi.fn((id: string, key: string) => (id === '7' && key === 'price' ? ('down' as const) : undefined));
        const state = stateView(fakeHost({ config: { enableCellFlash: true, columns: [{ accessorKey: 'price' }], getRowId: () => 7 }, providers: { formatting: { flash } } }));
        expect(state.cellState(0, 'price', row)).toMatchObject({ flash: 'down' });
        expect(flash).toHaveBeenCalledWith('7', 'price');
    });

    it('builds the editable and flash-off key sets once per columns array, not per render', () => {
        const columns = [{ accessorKey: 'a', editable: true }, { accessorKey: 'b', enableCellFlash: false }];
        const filter = vi.spyOn(columns, 'filter');
        const host = fakeHost({ config: { columns, enableCellFlash: true }, providers: { formatting: { flash: () => undefined } } });
        for (let render = 0; render < 5; render++) stateView(host).cellState(0, 'a', row);
        expect(filter).toHaveBeenCalledTimes(2);
        const replaced = [...columns];
        stateView(fakeHost({ config: { columns: replaced } })).cellState(0, 'a', row);
        expect(stateView(fakeHost({ config: { columns: replaced } })).cellState(0, 'a', row)).toBe(EDITABLE_CELL_FLAGS);
    });

    it('asks for the id and the disabled flag of a row once, however many cells and the row state ask', () => {
        const getRowId = vi.fn((r: Row) => r.id);
        const isDisabled = vi.fn(() => false);
        const formatting = { flash: () => undefined };
        const columns = [{ accessorKey: 'a', editable: true }, { accessorKey: 'b', editable: true }, { accessorKey: 'c', editable: true }];
        const state = stateView(fakeHost({ config: { enableCellFlash: true, enableRowDrag: true, columns, getRowId }, providers: { formatting, rowDrag: dragPart() }, isDisabled }));
        state.rowState(0, 'r1', row);
        for (const key of ['a', 'b', 'c']) state.cellState(0, key, row);
        expect(getRowId).toHaveBeenCalledTimes(1);
        expect(isDisabled).toHaveBeenCalledTimes(1);
        state.cellState(1, 'a', { id: 'r2' });
        expect(getRowId).toHaveBeenCalledTimes(2);
        expect(isDisabled).toHaveBeenCalledTimes(2);
    });

    it('does not make a row draggable until the drag part says it handles drags', () => {
        const inert = { active: () => false, dragState: () => ({ draggedId: 'r1', overIndex: 0, edge: 'top' as const }) };
        expect(stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: inert } })).rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: true } })).rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: false }, providers: { rowDrag: dragPart() } })).rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
    });

    it('marks a draggable row with one shared object, a disabled or loading row not at all', () => {
        const on = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart() } }));
        expect(on.rowState(0, 'r1', row)).toBe(DRAGGABLE_ROW_FLAGS);
        expect(on.rowState(0, 'r2', { id: 'r2', disabled: true })).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: true, loading: true }, providers: { rowDrag: dragPart() } })).rowState(0, 'r1', row)).toBe(NO_ROW_FLAGS);
    });

    it('finds the dragged row when getRowId answers numbers', () => {
        const state = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart({ draggedId: '7', overIndex: -1, edge: null }) } }));
        expect(state.rowState(0, 7 as unknown as string, { id: '7' })).toMatchObject({ dragging: true });
        expect(state.rowState(1, 8 as unknown as string, { id: '8' })).toBe(DRAGGABLE_ROW_FLAGS);
    });

    it('marks a disabled target row (or any row while loading) that shows an edge, so its edge can be positioned', () => {
        const rowDrag = dragPart({ draggedId: 'r1', overIndex: 2, edge: 'top' });
        const disabled = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag } })).rowState(2, 'r3', { id: 'r3', disabled: true });
        expect(disabled).toEqual({ draggable: false, dragging: false, dropEdge: 'top' });
        const loading = stateView(fakeHost({ config: { enableRowDrag: true, loading: true }, providers: { rowDrag } })).rowState(2, 'r3', { id: 'r3' });
        expect(loading).toMatchObject({ draggable: false, dropEdge: 'top' });
    });

    it('marks the dragged row and the edge of the row under the pointer', () => {
        const rowDrag = dragPart({ draggedId: 'r1', overIndex: 3, edge: 'bottom' });
        const state = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag } }));
        expect(state.rowState(0, 'r1', row)).toMatchObject({ dragging: true });
        expect(state.rowState(3, 'r4', { id: 'r4' })).toMatchObject({ dragging: false, dropEdge: 'bottom', draggable: true });
        expect(state.rowState(5, 'r6', { id: 'r6' })).toBe(DRAGGABLE_ROW_FLAGS);
    });
});
