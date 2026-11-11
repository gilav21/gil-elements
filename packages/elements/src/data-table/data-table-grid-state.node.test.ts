import { describe, expect, it, vi } from 'vitest';
import {
    DRAGGABLE_ROW_FLAGS,
    NO_CELL_FLAGS,
    NO_ROW_FLAGS,
    OUT_OF_RANGE_FLAGS,
    type RowInfo,
    stateView,
} from './data-table-grid-state.js';
import type { DataTableViewHost } from './data-table-view.js';

/** A host with only what `stateView` reads. */
function fakeHost(options: { config?: Record<string, unknown>; providers?: Record<string, unknown> }): DataTableViewHost<unknown> {
    const config = { columns: [], enableCellRangeSelection: false, enableCellFlash: false, enableRowDrag: false, enableFillHandle: false, loading: false, ...options.config };
    return { config, provider: (key: string) => options.providers?.[key] } as unknown as DataTableViewHost<unknown>;
}

const row: RowInfo = { id: 'r1', disabled: false };
const info = (id: string, disabled = false): RowInfo => ({ id, disabled });
const dragPart = (state: unknown = null) => ({ active: () => true, dragState: () => state });
const rangeService = (over: Record<string, unknown> = {}) => ({ active: () => true, isInRange: () => false, isFillPreview: () => false, edgeOf: () => '', ...over });

describe('stateView with the step-0 services', () => {
    it('is not active for a plain grid, so the renderer calls neither cellState nor rowState; every feature that can mark a cell or a row makes it active', () => {
        expect(stateView(fakeHost({})).stateActive).toBe(false);
        const range = rangeService();
        const noInteraction = { editingCell: () => null };
        expect(stateView(fakeHost({ providers: { range, interaction: noInteraction } })).stateActive).toBe(false); // services alone, no flag
        expect(stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range } })).stateActive).toBe(true);
        expect(stateView(fakeHost({ config: { enableFillHandle: true }, providers: { range } })).stateActive).toBe(true);
        expect(stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range: rangeService({ active: () => false }) } })).stateActive).toBe(false); // flag, part not active
        // flash is a dynamic state only while something is flashing: the flag alone (nothing flashing) leaves the grid inactive, so no per-cell work
        expect(stateView(fakeHost({ config: { enableCellFlash: true }, providers: { formatting: { flash: () => undefined, anyFlashing: () => false } } })).stateActive).toBe(false);
        expect(stateView(fakeHost({ config: { enableCellFlash: true }, providers: { formatting: { flash: () => undefined, anyFlashing: () => true } } })).stateActive).toBe(true);
        // an editable column alone is not a dynamic state: the renderer writes data-editable from the column, so the grid stays inactive
        expect(stateView(fakeHost({ config: { columns: [{ accessorKey: 'a', editable: true }] } })).stateActive).toBe(false);
        expect(stateView(fakeHost({ providers: { interaction: { editingCell: () => ({ rowIndex: 0, columnKey: 'a' }) } } })).stateActive).toBe(true);
        expect(stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart() } })).stateActive).toBe(true);
        expect(stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: { active: () => false, dragState: () => null } } })).stateActive).toBe(false);
    });

    it('splits the activity: draggable rows make the rows active but not the cells; range, flash and an open editor make the cells active but not the rows', () => {
        const drag = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart() } }));
        expect([drag.cellStateActive, drag.rowStateActive, drag.stateActive]).toEqual([false, true, true]);
        const range = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range: rangeService() } }));
        expect([range.cellStateActive, range.rowStateActive, range.stateActive]).toEqual([true, false, true]);
        const plain = stateView(fakeHost({}));
        expect([plain.cellStateActive, plain.rowStateActive, plain.stateActive]).toEqual([false, false, false]);
    });

    it('answers the shared frozen none object for every cell and row of a plain grid', () => {
        const state = stateView(fakeHost({}));
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
        expect(state.rowState(0, row)).toBe(NO_ROW_FLAGS);
        expect(state.rangeSelectable).toBe(false);
        expect(Object.isFrozen(NO_CELL_FLAGS)).toBe(true);
    });

    it('gives an editable column no flags of its own: the renderer writes data-editable from the column, and the grid is not active for it', () => {
        const state = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] } }));
        expect(state.stateActive).toBe(false);
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
        expect(state.cellState(0, 'name', info('r2', true))).toBe(NO_CELL_FLAGS);
    });

    it('asks the per-cell editing question only while an editor is open', () => {
        const isEditing = vi.fn(() => false);
        const closed = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] }, providers: { interaction: { editingCell: () => null, isEditing } } }));
        for (const key of ['name', 'other']) closed.cellState(0, key, row);
        expect(isEditing).not.toHaveBeenCalled();
        const open = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] }, providers: { interaction: { editingCell: () => ({ rowIndex: 0, columnKey: 'name' }), isEditing } } }));
        open.cellState(0, 'name', row);
        expect(isEditing).toHaveBeenCalledTimes(1);
    });

    it('marks the cell that holds the open editor', () => {
        const interaction = { editingCell: () => ({ rowIndex: 2, columnKey: 'name' }), isEditing: (rowIndex: number, columnKey: string) => rowIndex === 2 && columnKey === 'name' };
        const state = stateView(fakeHost({ config: { columns: [{ accessorKey: 'name', editable: true }] }, providers: { interaction } }));
        expect(state.stateActive).toBe(true); // an editor is open: a dynamic state
        expect(state.cellState(2, 'name', row)).toMatchObject({ editing: true });
        expect(state.cellState(1, 'name', row)).toBe(NO_CELL_FLAGS);
    });

    it('never asks for the row id or the disabled flag: the renderer reads them once per row and passes them', () => {
        const getRowId = vi.fn(() => 'x');
        const isDisabled = vi.fn(() => false);
        const formatting = { flash: vi.fn(), anyFlashing: () => true };
        const columns = [{ accessorKey: 'a', editable: true }, { accessorKey: 'b', editable: true }];
        const host = { ...fakeHost({ config: { enableCellFlash: true, enableRowDrag: true, columns, getRowId }, providers: { formatting, rowDrag: dragPart() } }), isDisabled };
        const state = stateView(host as DataTableViewHost<unknown>);
        state.rowState(0, row);
        for (const key of ['a', 'b']) state.cellState(0, key, row);
        expect(getRowId).not.toHaveBeenCalled();
        expect(isDisabled).not.toHaveBeenCalled();
        expect(formatting.flash).toHaveBeenCalledWith('r1', 'a');
    });

    describe('range mode', () => {
        it('is drawn only once the range part is active: no aria-selected, no aria-multiselectable while it loads or after a failed load', () => {
            const inactive = rangeService({ active: () => false });
            const state = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range: inactive } }));
            expect(state.rangeSelectable).toBe(false);
            expect(state.cellState(0, 'a', row)).toBe(NO_CELL_FLAGS);
            expect(stateView(fakeHost({ config: { enableCellRangeSelection: true } })).rangeSelectable).toBe(false);
        });

        it('makes every data cell carry aria-selected when active, true inside the range, with the edges the service answers', () => {
            const range = rangeService({
                isInRange: (r: number, c: string) => r <= 1 && ['a', 'b'].includes(c),
                edgeOf: (r: number, c: string) => (r === 0 && c === 'a' ? 'top start' : 'bottom end'),
            });
            const state = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range } }));
            expect(state.rangeSelectable).toBe(true);
            expect(state.cellState(0, 'a', row)).toMatchObject({ inRange: true, selected: 'true', rangeEdge: 'top start' });
            expect(state.cellState(1, 'b', row)).toMatchObject({ inRange: true, rangeEdge: 'bottom end' });
            expect(state.cellState(0, 'c', row)).toBe(OUT_OF_RANGE_FLAGS);
        });

        it('draws the range with the fill handle alone (the fill source is visible) but claims no selection to assistive technology', () => {
            const range = rangeService({ isInRange: (r: number) => r === 0, edgeOf: () => 'top' });
            const state = stateView(fakeHost({ config: { enableCellRangeSelection: false, enableFillHandle: true }, providers: { range } }));
            expect(state.stateActive).toBe(true);
            expect(state.rangeSelectable).toBe(false); // no aria-multiselectable
            const inside = state.cellState(0, 'a', row);
            expect(inside).toMatchObject({ inRange: true, rangeEdge: 'top' });
            expect(inside.selected).toBeUndefined(); // no aria-selected
            expect(state.cellState(1, 'a', row)).toBe(NO_CELL_FLAGS);
            // selection on: both the drawing and the ARIA
            const selecting = stateView(fakeHost({ config: { enableCellRangeSelection: true, enableFillHandle: true }, providers: { range } }));
            expect(selecting.rangeSelectable).toBe(true);
            expect(selecting.cellState(0, 'a', row)).toMatchObject({ inRange: true, selected: 'true' });
            expect(selecting.cellState(1, 'a', row)).toBe(OUT_OF_RANGE_FLAGS);
            // neither flag: nothing, whatever the service says
            expect(stateView(fakeHost({ providers: { range } })).cellState(0, 'a', row)).toBe(NO_CELL_FLAGS);
        });

        it('leaves the special columns (selection, expander, actions) out of it', () => {
            const state = stateView(fakeHost({ config: { enableCellRangeSelection: true }, providers: { range: rangeService({ isInRange: () => true }) } }));
            for (const key of ['_selection', '_expander', '_actions']) expect(state.cellState(0, key, row)).toBe(NO_CELL_FLAGS);
        });

        it('allocates nothing without a range: one shared frozen object for every cell', () => {
            const state = stateView(fakeHost({ config: { enableCellRangeSelection: true, columns: [{ accessorKey: 'name', editable: true }] }, providers: { range: rangeService() } }));
            expect(state.cellState(0, 'other', row)).toBe(OUT_OF_RANGE_FLAGS);
            expect(state.cellState(0, 'name', row)).toBe(OUT_OF_RANGE_FLAGS);
            expect(state.cellState(5, 'other', info('r9'))).toBe(OUT_OF_RANGE_FLAGS);
            expect(Object.isFrozen(OUT_OF_RANGE_FLAGS)).toBe(true);
        });
    });

    it('shows a fill preview only while the range service is active (the fill handle flag alone is not enough)', () => {
        const preview = { isFillPreview: () => true, isInRange: () => false, edgeOf: () => '' };
        const inactive = stateView(fakeHost({ config: { enableFillHandle: true }, providers: { range: { ...preview, active: () => false } } }));
        expect(inactive.cellState(0, 'a', row)).toBe(NO_CELL_FLAGS);
        const active = stateView(fakeHost({ config: { enableFillHandle: true }, providers: { range: { ...preview, active: () => true } } }));
        expect(active.cellState(0, 'a', row)).toMatchObject({ fillPreview: true });
        // fill handle off: never, whatever the service says
        expect(stateView(fakeHost({ providers: { range: { ...preview, active: () => true } } })).cellState(0, 'a', row)).toBe(NO_CELL_FLAGS);
    });

    it('makes no per-cell flash call while nothing is flashing, with enable-cell-flash on', () => {
        const flash = vi.fn();
        const state = stateView(fakeHost({ config: { enableCellFlash: true }, providers: { formatting: { flash, anyFlashing: () => false } } }));
        expect(state.stateActive).toBe(false);
        state.cellState(0, 'a', row);
        expect(flash).not.toHaveBeenCalled();
    });

    it('reads the flash of a cell, unless the column opted out', () => {
        const formatting = { flash: (id: string, key: string) => (id === 'r1' && key === 'price' ? ('up' as const) : undefined), anyFlashing: () => true };
        const columns = [{ accessorKey: 'price' }, { accessorKey: 'name', enableCellFlash: false }];
        const state = stateView(fakeHost({ config: { enableCellFlash: true, columns }, providers: { formatting } }));
        expect(state.cellState(0, 'price', row)).toMatchObject({ flash: 'up' });
        expect(state.cellState(0, 'name', row)).toBe(NO_CELL_FLAGS);
    });

    it('builds no flash-off key set at all while nothing flashes (flash off, or enable-cell-flash with nothing flashing)', () => {
        const columns = [{ accessorKey: 'a' }, { accessorKey: 'b', enableCellFlash: false }];
        const filter = vi.spyOn(columns, 'filter');
        stateView(fakeHost({ config: { columns } })).cellState(0, 'a', row);
        stateView(fakeHost({ config: { columns, enableCellFlash: true }, providers: { formatting: { flash: () => undefined, anyFlashing: () => false } } })).cellState(0, 'a', row);
        expect(filter).not.toHaveBeenCalled();
    });

    it('builds the flash-off key set once per columns array, not per render', () => {
        const columns = [{ accessorKey: 'a' }, { accessorKey: 'b', enableCellFlash: false }];
        const filter = vi.spyOn(columns, 'filter');
        const host = fakeHost({ config: { columns, enableCellFlash: true }, providers: { formatting: { flash: () => undefined, anyFlashing: () => true } } });
        for (let render = 0; render < 5; render++) stateView(host).cellState(0, 'a', row);
        expect(filter).toHaveBeenCalledTimes(1);
    });

    it('does not make a row draggable until the drag part says it handles drags', () => {
        const inert = { active: () => false, dragState: () => ({ draggedId: 'r1', overIndex: 0, edge: 'top' as const }) };
        expect(stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: inert } })).rowState(0, row)).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: true } })).rowState(0, row)).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: false }, providers: { rowDrag: dragPart() } })).rowState(0, row)).toBe(NO_ROW_FLAGS);
    });

    it('marks a draggable row with one shared object, a disabled or loading row not at all', () => {
        const on = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart() } }));
        expect(on.rowState(0, row)).toBe(DRAGGABLE_ROW_FLAGS);
        expect(on.rowState(0, info('r2', true))).toBe(NO_ROW_FLAGS);
        expect(stateView(fakeHost({ config: { enableRowDrag: true, loading: true }, providers: { rowDrag: dragPart() } })).rowState(0, row)).toBe(NO_ROW_FLAGS);
    });

    it('finds the dragged row by its string id (the renderer stringifies what getRowId answers)', () => {
        const state = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag: dragPart({ draggedId: '7', overIndex: -1, edge: null }) } }));
        expect(state.rowState(0, info('7'))).toMatchObject({ dragging: true });
        expect(state.rowState(1, info('8'))).toBe(DRAGGABLE_ROW_FLAGS);
    });

    it('marks a disabled target row (or any row while loading) that shows an edge, so its edge can be positioned', () => {
        const rowDrag = dragPart({ draggedId: 'r1', overIndex: 2, edge: 'top' });
        const disabled = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag } })).rowState(2, info('r3', true));
        expect(disabled).toEqual({ draggable: false, dragging: false, dropEdge: 'top' });
        const loading = stateView(fakeHost({ config: { enableRowDrag: true, loading: true }, providers: { rowDrag } })).rowState(2, info('r3'));
        expect(loading).toMatchObject({ draggable: false, dropEdge: 'top' });
    });

    it('marks the dragged row and the edge of the row under the pointer', () => {
        const rowDrag = dragPart({ draggedId: 'r1', overIndex: 3, edge: 'bottom' });
        const state = stateView(fakeHost({ config: { enableRowDrag: true }, providers: { rowDrag } }));
        expect(state.rowState(0, row)).toMatchObject({ dragging: true });
        expect(state.rowState(3, info('r4'))).toMatchObject({ dragging: false, dropEdge: 'bottom', draggable: true });
        expect(state.rowState(5, info('r6'))).toBe(DRAGGABLE_ROW_FLAGS);
    });
});
