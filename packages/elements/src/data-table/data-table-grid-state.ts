/**
 * Per-cell and per-row render state of waves 5 and 6, composed ONCE here from the services (joint step 0), so the renderer
 * (`data-table-grid-rows.ts`) never changes again when a wave lands: it writes the attributes below for whatever these answer.
 * Both functions return a shared frozen object in every common case (no range, no flash, no drag, no editor), so a plain grid, a
 * grid in range mode with no range, and a grid with editable columns allocate nothing per cell.
 *
 * Attributes written from `CellFlags` (always in the template; an unset one leaves no attribute): `data-in-range`, `data-range-edge`,
 * `data-fill-preview`, `data-flash`, `aria-selected` (range mode only), `data-editable`, `data-editing`. From `RowFlags`: `draggable`,
 * `data-draggable`, `data-dragging` and the drop-edge child `div[data-slot=data-table-drop-edge][data-edge]`.
 *
 * The lead owns this file: a wave implements its service, not this composition.
 */
import type { DataTableViewHost } from './data-table-view.js';
import type { CellFlashDirection } from './data-table.types.js';

/** The edges of the range rectangle a cell sits on, as a space-separated list of `top`, `bottom`, `start`, `end`. */
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

const cell = (selected: 'false' | undefined, editable: boolean): CellFlags => Object.freeze({ inRange: false, fillPreview: false, selected, editable, editing: false });
export const NO_CELL_FLAGS: CellFlags = cell(undefined, false);
export const EDITABLE_CELL_FLAGS: CellFlags = cell(undefined, true);
/** In range mode a cell outside any range still says `aria-selected="false"`. */
export const OUT_OF_RANGE_FLAGS: CellFlags = cell('false', false);
export const OUT_OF_RANGE_EDITABLE_FLAGS: CellFlags = cell('false', true);
export const NO_ROW_FLAGS: RowFlags = Object.freeze({ draggable: false, dragging: false });
export const DRAGGABLE_ROW_FLAGS: RowFlags = Object.freeze({ draggable: true, dragging: false });

export interface StateView<T> {
    /** `enable-cell-range-selection`: data cells carry `aria-selected` and the grid is `aria-multiselectable`. */
    rangeSelectable: boolean;
    /** `row` is the row drawn at `rowIndex` (the caller has it; the lookup is not repeated per cell). */
    cellState(rowIndex: number, columnKey: string, row: T): CellFlags;
    rowState(rowIndex: number, rowId: string, row: T): RowFlags;
}

/** The keys of the editable columns and of the columns that opted out of flash, per `columns` array: a render with the same columns builds them once. */
const columnSetCache = new WeakMap<readonly object[], { editable: ReadonlySet<string>; flashOff: ReadonlySet<string> }>();
function columnSets(columns: readonly { accessorKey: unknown; editable?: boolean; enableCellFlash?: boolean }[]) {
    let sets = columnSetCache.get(columns);
    if (!sets) {
        const keys = (pick: (c: (typeof columns)[number]) => boolean): Set<string> => new Set(columns.filter(pick).map((c) => String(c.accessorKey)));
        columnSetCache.set(columns, (sets = { editable: keys((c) => c.editable === true), flashOff: keys((c) => c.enableCellFlash === false) }));
    }
    return sets;
}

export function stateView<T>(host: DataTableViewHost<T>): StateView<T> {
    const { config } = host;
    const range = host.provider('range');
    const interaction = host.provider('interaction');
    const formatting = host.provider('formatting');
    const rowDrag = host.provider('rowDrag');
    const rangeMode = config.enableCellRangeSelection;
    const { editable, flashOff } = columnSets(config.columns);
    const flashable = config.enableCellFlash && formatting !== undefined;
    // Only a drag part that handles drags makes a row draggable (the step 0 shell answers false: no ghost image, text stays selectable).
    const dragOn = config.enableRowDrag && (rowDrag?.active() ?? false);
    const dragging = dragOn ? (rowDrag?.dragState() ?? null) : null;
    // The cells of one row ask for the same id and disabled flag in a row: each is computed once per row.
    let idRow: T | undefined;
    let id = '';
    let disabledRow: T | undefined;
    let disabled = false;
    const idOf = (row: T): string => {
        if (row !== idRow) [idRow, id] = [row, String(config.getRowId(row))]; // ids are strings everywhere (`getRowId` may answer numbers)
        return id;
    };
    const disabledOf = (row: T): boolean => {
        if (row !== disabledRow) [disabledRow, disabled] = [row, host.isDisabled(row)];
        return disabled;
    };
    return {
        rangeSelectable: rangeMode,
        cellState(rowIndex, key, row) {
            const canEdit = editable.has(key) && !disabledOf(row);
            const inRange = rangeMode && (range?.isInRange(rowIndex, key) ?? false);
            const fill = config.enableFillHandle && (range?.isFillPreview(rowIndex, key) ?? false);
            const flash = flashable && !flashOff.has(key) ? formatting.flash(idOf(row), key) : undefined;
            const editing = interaction?.isEditing(rowIndex, key) ?? false;
            if (!inRange && !fill && flash === undefined && !editing) {
                if (rangeMode) return canEdit ? OUT_OF_RANGE_EDITABLE_FLAGS : OUT_OF_RANGE_FLAGS;
                return canEdit ? EDITABLE_CELL_FLAGS : NO_CELL_FLAGS;
            }
            return {
                inRange,
                rangeEdge: inRange ? range?.edgeOf(rowIndex, key) : undefined,
                fillPreview: fill,
                flash,
                selected: rangeMode ? (inRange ? 'true' : 'false') : undefined,
                editable: canEdit,
                editing,
            };
        },
        rowState(rowIndex, rowId, row) {
            if (!dragOn) return NO_ROW_FLAGS;
            const draggable = !disabledOf(row) && !config.loading;
            const isDragged = dragging !== null && dragging.draggedId === String(rowId); // `getRowId` may answer a number
            const edge = dragging !== null && dragging.overIndex === rowIndex ? (dragging.edge ?? undefined) : undefined;
            if (!isDragged && edge === undefined) return draggable ? DRAGGABLE_ROW_FLAGS : NO_ROW_FLAGS;
            return { draggable, dragging: isDragged, dropEdge: edge };
        },
    };
}
