/**
 * Per-cell and per-row render state of waves 5 and 6, composed ONCE here from the services (joint step 0), so the renderer
 * (`data-table-grid-rows.ts`) never changes again when a wave lands: it writes the attributes below for whatever these answer.
 * Both functions return a shared frozen "none" object in the common case, so a plain grid allocates nothing per cell.
 *
 * Attributes written from `CellFlags` (always in the template; an unset one leaves no attribute): `data-in-range`, `data-range-edge`,
 * `data-fill-preview`, `data-flash`, `aria-selected` (range mode only), `data-editable`, `data-editing`. From `RowFlags`: `draggable`,
 * `data-dragging` and the drop-edge child `div[data-slot=data-table-drop-edge][data-edge]`.
 *
 * The lead owns this file: a wave implements its service, not this composition.
 */
import { requireProvider } from './data-table-host.js';
import type { NormalizedRange } from './data-table-range.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { CellFlashDirection } from './data-table.types.js';

/** The edges of the range rectangle a cell sits on, as a space-separated list of `top`, `bottom`, `start`, `end` (`start` is the lower column index). */
export type RangeEdges = string;

export interface CellFlags {
    readonly inRange: boolean;
    readonly rangeEdge?: RangeEdges;
    readonly fillPreview: boolean;
    readonly flash?: CellFlashDirection;
    /** `aria-selected` of a data cell, written in range mode only. */
    readonly selected?: 'true' | 'false';
    readonly editable: boolean;
    readonly editing: boolean;
}

export interface RowFlags {
    readonly draggable: boolean;
    readonly dragging: boolean;
    readonly dropEdge?: 'top' | 'bottom' | 'on';
}

export const NO_CELL_FLAGS: CellFlags = Object.freeze({ inRange: false, fillPreview: false, editable: false, editing: false });
export const EDITABLE_CELL_FLAGS: CellFlags = Object.freeze({ inRange: false, fillPreview: false, editable: true, editing: false });
export const NO_ROW_FLAGS: RowFlags = Object.freeze({ draggable: false, dragging: false });
export const DRAGGABLE_ROW_FLAGS: RowFlags = Object.freeze({ draggable: true, dragging: false });

export interface StateView<T> {
    /** `enable-cell-range-selection`: data cells carry `aria-selected` and the grid is `aria-multiselectable`. */
    rangeSelectable: boolean;
    /** `row` is the row drawn at `rowIndex` (the caller has it; the lookup is not repeated per cell). */
    cellState(rowIndex: number, columnKey: string, row: T): CellFlags;
    rowState(rowIndex: number, rowId: string, row: T): RowFlags;
}

/** The edges of `range` that the cell at (`rowIndex`, `col`) touches: `''` for an inner cell. */
export function rangeEdges(range: NormalizedRange, rowIndex: number, col: number): RangeEdges {
    const edges: string[] = [];
    if (rowIndex === range.minRow) edges.push('top');
    if (rowIndex === range.maxRow) edges.push('bottom');
    if (col === range.minCol) edges.push('start');
    if (col === range.maxCol) edges.push('end');
    return edges.join(' ');
}

export function stateView<T>(host: DataTableViewHost<T>): StateView<T> {
    const { config } = host;
    const range = host.provider('range');
    const interaction = host.provider('interaction');
    const formatting = host.provider('formatting');
    const rowDrag = host.provider('rowDrag');
    const rangeMode = config.enableCellRangeSelection;
    const keys = rangeMode ? requireProvider(host, 'columns').navigableKeys() : [];
    const normalized = rangeMode ? (range?.normalized() ?? null) : null;
    const editingAt = interaction?.editingCell() ?? null;
    const editable = new Set(config.columns.filter((c) => c.editable).map((c) => String(c.accessorKey)));
    const flashable = config.enableCellFlash && formatting !== undefined;
    const flashOff = new Set(config.columns.filter((c) => c.enableCellFlash === false).map((c) => String(c.accessorKey)));
    const dragging = config.enableRowDrag ? (rowDrag?.dragState() ?? null) : null;
    return {
        rangeSelectable: rangeMode,
        cellState(rowIndex, key, row) {
            const canEdit = editable.has(key) && !host.isDisabled(row);
            const inRange = normalized !== null && (range?.isInRange(rowIndex, key) ?? false);
            const fill = config.enableFillHandle && (range?.isFillPreview(rowIndex, key) ?? false);
            const flash = flashable && !flashOff.has(key) ? formatting.flash(config.getRowId(row), key) : undefined;
            const editing = editingAt !== null && editingAt.rowIndex === rowIndex && editingAt.columnKey === key;
            if (!inRange && !fill && flash === undefined && !editing && !rangeMode) return canEdit ? EDITABLE_CELL_FLAGS : NO_CELL_FLAGS;
            return {
                inRange,
                rangeEdge: inRange && normalized ? rangeEdges(normalized, rowIndex, keys.indexOf(key)) : undefined,
                fillPreview: fill,
                flash,
                selected: rangeMode ? (inRange ? 'true' : 'false') : undefined,
                editable: canEdit,
                editing,
            };
        },
        rowState(rowIndex, rowId, row) {
            if (!config.enableRowDrag) return NO_ROW_FLAGS;
            const draggable = !host.isDisabled(row) && !config.loading;
            const isDragged = dragging !== null && dragging.draggedId === rowId;
            const edge = dragging !== null && dragging.overIndex === rowIndex ? (dragging.edge ?? undefined) : undefined;
            if (!isDragged && edge === undefined) return draggable ? DRAGGABLE_ROW_FLAGS : NO_ROW_FLAGS;
            return { draggable, dragging: isDragged, dropEdge: edge };
        },
    };
}
