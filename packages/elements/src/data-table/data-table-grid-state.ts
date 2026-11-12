/**
 * Per-cell and per-row render state of waves 5 and 6, composed ONCE here from the services (joint step 0), so the renderer
 * (`data-table-grid-rows.ts`) never changes again when a wave lands: it writes the attributes below for whatever these answer.
 * Both functions return a shared frozen object in every common case (no range, no flash, no drag, no editor), so a plain grid, a
 * grid in range mode with no range allocate nothing per cell. `data-editable` is not part of this state: the renderer writes it from the column layout.
 *
 * Attributes written from `CellFlags` (always in the template; an unset one leaves no attribute): `data-in-range`, `data-range-edge`,
 * `data-fill-preview`, `data-flash`, `aria-selected` (range mode only), `data-editing` (and `data-editable`, written by the renderer from the column). From `RowFlags`: `draggable`,
 * `data-draggable`, `data-dragging` and the drop-edge child `div[data-slot=data-table-drop-edge][data-edge]`.
 *
 * The lead owns this file: a wave implements its service, not this composition.
 */
import { cellSelectedBy, rangeModeOn, rangeSelectionDrawn } from './data-table-range.js';
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
    readonly editing: boolean;
}

export interface RowFlags {
    readonly draggable: boolean;
    readonly dragging: boolean;
    readonly dropEdge?: 'top' | 'bottom' | 'on';
}

const cell = (selected: 'true' | 'false' | undefined): CellFlags => Object.freeze({ inRange: false, fillPreview: false, selected, editing: false });
export const NO_CELL_FLAGS: CellFlags = cell(undefined);
/** In range mode a cell outside any range still says `aria-selected="false"`. */
export const OUT_OF_RANGE_FLAGS: CellFlags = cell('false');
/** In range mode a cell that is selected by the focus or its selected row (no range in it) says `aria-selected="true"`. */
const SELECTED_FLAGS: CellFlags = cell('true');
export const NO_ROW_FLAGS: RowFlags = Object.freeze({ draggable: false, dragging: false });
export const DRAGGABLE_ROW_FLAGS: RowFlags = Object.freeze({ draggable: true, dragging: false });

export interface StateView {
    /** `enable-cell-range-selection` with the range part active: data cells carry `aria-selected` and the grid is `aria-multiselectable`. */
    rangeSelectable: boolean;
    /**
     * `cellState` can say something now (range mode, flash, an open editor; an editable column alone does not count: the renderer writes `data-editable` itself).
     * While neither this nor `rowStateActive` is true the renderer binds the shared frozen `NO_CELL_FLAGS` / `NO_ROW_FLAGS` in the one template and never calls
     * `cellState` / `rowState`: a plain grid pays no function call per cell, and the template (so the DOM) never changes when they flip. Rows that are only
     * draggable do not make the renderer ask every cell.
     */
    cellStateActive: boolean;
    /** `rowState` can say something now (draggable rows). */
    rowStateActive: boolean;
    /** `rowId` is the row's id; `selected` is the row's selection (the renderer read it once for the row, so no lookup per cell). */
    cellState(rowIndex: number, columnKey: string, rowId: string, selected: boolean): CellFlags;
    /** `rowId` and `disabled` are what the renderer already read for the row (`dataRow` reads each once): plain arguments, no per-row object. */
    rowState(rowIndex: number, rowId: string, disabled: boolean): RowFlags;
}

/** The keys of the columns that opted out of flash, per `columns` array: a render with the same columns builds the set once. */
const NO_KEYS: ReadonlySet<string> = new Set();
const flashOffCache = new WeakMap<readonly object[], ReadonlySet<string>>();
function flashOffKeys(columns: readonly { accessorKey: unknown; enableCellFlash?: boolean }[]): ReadonlySet<string> {
    let keys = flashOffCache.get(columns);
    if (!keys) flashOffCache.set(columns, (keys = new Set(columns.filter((c) => c.enableCellFlash === false).map((c) => String(c.accessorKey)))));
    return keys;
}

/** What `stateView` answers while nothing can be flagged (no range mode, flash, open editor, draggable rows): the renderer never calls its closures. */
const IDLE_STATE: StateView = Object.freeze({ cellStateActive: false, rowStateActive: false, rangeSelectable: false, cellState: () => NO_CELL_FLAGS, rowState: () => NO_ROW_FLAGS });

export function stateView<T>(host: DataTableViewHost<T>, rangeActiveNow?: boolean): StateView {
    const { config } = host;
    const range = host.provider('range');
    const interaction = host.provider('interaction');
    const formatting = host.provider('formatting');
    const rowDrag = host.provider('rowDrag');
    // Range mode is drawn (`aria-selected`, `aria-multiselectable`) only once the range part is loaded and handles ranges: not while it loads,
    // and not after a load that failed (the same rule as `rowDrag.active()` for draggable rows).
    const rangeActive = rangeActiveNow ?? range?.active() ?? false; // once per update: the element reads the part in `syncHost` and passes it in
    // What is DRAWN of a range follows range mode (selection OR fill handle: the fill source is visible); what is CLAIMED to assistive technology
    // (`aria-selected`, `aria-multiselectable`) follows the SELECTION flag alone, like `data-range-selection`: a fill-handle-only grid is not multiselectable.
    const rangeMode = rangeModeOn(config) && rangeActive;
    const selectionMode = rangeSelectionDrawn(config, rangeActive);
    // Flash costs per-cell work only while some cell is actually flashing (`enable-cell-flash` alone, with nothing flashing, does not).
    const flashable = config.enableCellFlash && formatting?.flash !== undefined && (formatting.anyFlashing?.() ?? true); // no `flash` (an older-shaped service): nothing is drawn; a missing `anyFlashing` cannot say "nothing flashes": every cell is asked
    const flashOff = flashable ? flashOffKeys(config.columns) : NO_KEYS; // only built while something flashes
    // Only a drag part that handles drags makes a row draggable (the step 0 shell answers false: no ghost image, text stays selectable).
    const dragOn = config.enableRowDrag && (rowDrag?.active() ?? false);
    const dragging = dragOn ? (rowDrag?.dragState() ?? null) : null;
    const editingAt = interaction?.editingCell?.() ?? null; // ONE answer to "which cell holds the editor": its address, the same the pointer guard (`isEditorCell`) reads
    const editingOpen = editingAt !== null;
    // aria-selected (selection mode): THE selection predicate `interaction.isCellSelected` answers (`cellSelectedBy`: a selected row, else the range, else the focused cell).
    const rangeNow = selectionMode ? (range?.range() ?? null) : null;
    const focusedNow = selectionMode ? (interaction?.focusedCell?.() ?? null) : null;
    const rowSelectable = config.enableRowSelection;
    const cellStateActive = rangeMode || flashable || editingOpen;
    if (!cellStateActive && !dragOn) return IDLE_STATE; // the plain grid (selection mode implies range mode, so it is covered): one shared frozen view, no closures per render
    return {
        cellStateActive,
        rowStateActive: dragOn,
        rangeSelectable: selectionMode,
        cellState(rowIndex, key, rowId, rowSelected) {
            // The special columns (selection, expander, actions) are not cells of the range, of an editor or of a flash.
            if (isSpecialColumnKey(key)) return NO_CELL_FLAGS;
            const inRange = rangeMode && (range?.isInRange(rowIndex, key) ?? false);
            const fill = config.enableFillHandle && rangeActive && (range?.isFillPreview(rowIndex, key) ?? false);
            const flash = flashable && !flashOff.has(key) ? formatting?.flash?.(rowId, key) : undefined;
            const editing = editingAt !== null && editingAt.rowIndex === rowIndex && editingAt.columnKey === key;
            const selected = selectionMode && cellSelectedBy(rangeNow, inRange, focusedNow, rowIndex, key, rowSelectable && rowSelected);
            if (!inRange && !fill && flash === undefined && !editing) {
                if (!selectionMode) return NO_CELL_FLAGS;
                return selected ? SELECTED_FLAGS : OUT_OF_RANGE_FLAGS;
            }
            return {
                inRange,
                rangeEdge: inRange ? range?.edgeOf(rowIndex, key) : undefined,
                fillPreview: fill,
                flash,
                selected: selectionMode ? (selected ? 'true' : 'false') : undefined,
                editing,
            };
        },
        rowState(rowIndex, rowId, disabled) {
            if (!dragOn) return NO_ROW_FLAGS;
            const draggable = !disabled && !config.loading;
            const isDragged = dragging !== null && dragging.draggedId === rowId;
            const edge = dragging !== null && dragging.overIndex === rowIndex ? (dragging.edge ?? undefined) : undefined;
            if (!isDragged && edge === undefined) return draggable ? DRAGGABLE_ROW_FLAGS : NO_ROW_FLAGS;
            return { draggable, dragging: isDragged, dropEdge: edge };
        },
    };
}
