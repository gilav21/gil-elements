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
import { rangeModeOn } from './data-table-range.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { CellFlashDirection } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

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

export interface StateView {
    /** `enable-cell-range-selection` with the range part active: data cells carry `aria-selected` and the grid is `aria-multiselectable`. */
    rangeSelectable: boolean;
    /**
     * Some wave 5 or 6 feature can mark a cell or a row now (range mode, flash, editable columns, an open editor, draggable rows). When false the
     * renderer uses the cell and row templates of before step 0 and never calls `cellState` / `rowState`: a plain grid pays nothing per cell.
     */
    stateActive: boolean;
    cellState(rowIndex: number, columnKey: string, row: RowInfo): CellFlags;
    rowState(rowIndex: number, row: RowInfo): RowFlags;
}

/**
 * What the renderer already knows of the drawn row (`dataRow` reads each once): its id as a string (`getRowId` may answer a number) and whether it is
 * disabled. The state functions never ask for them again, so a row costs one `getRowId` and one `isDisabled`, however many cells it has.
 */
export interface RowInfo {
    readonly id: string;
    readonly disabled: boolean;
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

export function stateView<T>(host: DataTableViewHost<T>): StateView {
    const { config } = host;
    const range = host.provider('range');
    const interaction = host.provider('interaction');
    const formatting = host.provider('formatting');
    const rowDrag = host.provider('rowDrag');
    // Range mode is drawn (`aria-selected`, `aria-multiselectable`) only once the range part is loaded and handles ranges: not while it loads,
    // and not after a load that failed (the same rule as `rowDrag.active()` for draggable rows).
    const rangeActive = range?.active() ?? false;
    // What is DRAWN of a range follows range mode (selection OR fill handle: the fill source is visible); what is CLAIMED to assistive technology
    // (`aria-selected`, `aria-multiselectable`) follows the SELECTION flag alone, like `data-range-selection`: a fill-handle-only grid is not multiselectable.
    const rangeMode = rangeModeOn(config) && rangeActive;
    const selectionMode = config.enableCellRangeSelection && rangeActive;
    const { editable, flashOff } = columnSets(config.columns);
    const flashable = config.enableCellFlash && formatting !== undefined;
    // Only a drag part that handles drags makes a row draggable (the step 0 shell answers false: no ghost image, text stays selectable).
    const dragOn = config.enableRowDrag && (rowDrag?.active() ?? false);
    const dragging = dragOn ? (rowDrag?.dragState() ?? null) : null;
    const editingOpen = interaction?.editingCell() != null;
    return {
        stateActive: rangeMode || flashable || editable.size > 0 || editingOpen || dragOn,
        rangeSelectable: selectionMode,
        cellState(rowIndex, key, row) {
            // The special columns (selection, expander, actions) are not cells of the range, of an editor or of a flash.
            if (isSpecialColumnKey(key)) return NO_CELL_FLAGS;
            const canEdit = editable.has(key) && !row.disabled;
            const inRange = rangeMode && (range?.isInRange(rowIndex, key) ?? false);
            const fill = config.enableFillHandle && rangeActive && (range?.isFillPreview(rowIndex, key) ?? false);
            const flash = flashable && !flashOff.has(key) ? formatting.flash(row.id, key) : undefined;
            const editing = editingOpen && (interaction?.isEditing(rowIndex, key) ?? false); // the per-cell question only while an editor is open
            if (!inRange && !fill && flash === undefined && !editing) {
                if (selectionMode) return canEdit ? OUT_OF_RANGE_EDITABLE_FLAGS : OUT_OF_RANGE_FLAGS;
                return canEdit ? EDITABLE_CELL_FLAGS : NO_CELL_FLAGS;
            }
            return {
                inRange,
                rangeEdge: inRange ? range?.edgeOf(rowIndex, key) : undefined,
                fillPreview: fill,
                flash,
                selected: selectionMode ? (inRange ? 'true' : 'false') : undefined,
                editable: canEdit,
                editing,
            };
        },
        rowState(rowIndex, row) {
            if (!dragOn) return NO_ROW_FLAGS;
            const draggable = !row.disabled && !config.loading;
            const isDragged = dragging !== null && dragging.draggedId === row.id;
            const edge = dragging !== null && dragging.overIndex === rowIndex ? (dragging.edge ?? undefined) : undefined;
            if (!isDragged && edge === undefined) return draggable ? DRAGGABLE_ROW_FLAGS : NO_ROW_FLAGS;
            return { draggable, dragging: isDragged, dropEdge: edge };
        },
    };
}
