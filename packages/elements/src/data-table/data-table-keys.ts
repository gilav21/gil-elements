/**
 * Keyboard navigation of the grid as pure maths: which cell a key moves to. Replaces Angular's `computeNextCell`.
 *
 * Rows are DRAWN data indices (`data-row-index`: group headers and detail rows do not count, collapsed groups have no
 * rows), so crossing a group boundary is just the next index. Columns are positions in the focusable list. Tab is not a
 * navigation key (it would trap keyboard focus in the grid); the roving tabindex lets it leave.
 */

export interface NavigationState {
    /** The focused cell: a drawn row index and a position in the focusable column list. */
    row: number;
    col: number;
    rowCount: number;
    colCount: number;
    /** A row arrows step over (`isRowDisabled` / `disabledRowIds`); PageUp, PageDown, Home and End still land on it. */
    isDisabled(row: number): boolean;
    /** Rows one PageUp / PageDown moves; at least 1. */
    pageSize: number;
    /** Inline direction is right-to-left: ArrowLeft and ArrowRight swap. */
    rtl: boolean;
    /** Ctrl, or Meta on macOS. */
    ctrl: boolean;
}

export interface CellTarget {
    row: number;
    col: number;
}

/** The keys `nextFocus` answers for. */
export const NAVIGATION_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);

/** The nearest row in `direction` that is not disabled, or the current one when there is none. */
function stepRow(from: number, direction: 1 | -1, rowCount: number, isDisabled: (row: number) => boolean): number {
    for (let next = from + direction; next >= 0 && next < rowCount; next += direction) if (!isDisabled(next)) return next;
    return from;
}

const clamp = (value: number, max: number): number => Math.min(Math.max(0, value), Math.max(0, max));

/**
 * Where `key` moves the focus, or null for a key that is not navigation. An edge does not wrap: the target is the cell
 * itself. Nothing to move to (no rows or no columns) is also null.
 */
export function nextFocus(key: string, s: NavigationState): CellTarget | null {
    if (!NAVIGATION_KEYS.has(key) || s.rowCount <= 0 || s.colCount <= 0) return null;
    const row = clamp(s.row, s.rowCount - 1);
    const col = clamp(s.col, s.colCount - 1);
    const lastRow = s.rowCount - 1;
    const lastCol = s.colCount - 1;
    const page = Number.isFinite(s.pageSize) && s.pageSize > 1 ? Math.floor(s.pageSize) : 1;
    const sideways = (step: number): CellTarget => ({ row, col: clamp(col + step, lastCol) });
    switch (key) {
        case 'ArrowUp':
            return { row: stepRow(row, -1, s.rowCount, s.isDisabled), col };
        case 'ArrowDown':
            return { row: stepRow(row, 1, s.rowCount, s.isDisabled), col };
        case 'ArrowLeft':
            return sideways(s.rtl ? 1 : -1);
        case 'ArrowRight':
            return sideways(s.rtl ? -1 : 1);
        case 'Home':
            return { row: s.ctrl ? 0 : row, col: 0 };
        case 'End':
            return { row: s.ctrl ? lastRow : row, col: lastCol };
        case 'PageUp':
            return { row: clamp(row - page, lastRow), col };
        default:
            return { row: clamp(row + page, lastRow), col };
    }
}

/** Rows a page key moves: how many whole rows fit the visible body, never fewer than one. */
export function pageRows(visibleHeight: number, rowHeight: number): number {
    return rowHeight > 0 && visibleHeight > 0 ? Math.max(1, Math.floor(visibleHeight / rowHeight)) : 1;
}

/**
 * The column to keep when the focused one has left the layout (hidden, removed): the one now at its old position,
 * else the last. `-1` when there are no columns.
 */
export function nearestColumn(keys: readonly string[], key: string, lastIndex: number): number {
    const at = keys.indexOf(key);
    if (at !== -1) return at;
    return keys.length === 0 ? -1 : Math.min(Math.max(0, lastIndex), keys.length - 1);
}
