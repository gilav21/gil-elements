/**
 * Keyboard range extension as pure maths (wave 6, package A): Shift+Arrow / Home / End / PageUp / PageDown move the END of the range, the anchor
 * (and the DOM focus) stays where the range began (Angular and Excel: the focus is the anchor). Beyond Angular, which extends a range by mouse only
 * (spec 0.3 #1, D3). It reuses `nextFocus`, with no disabled rows: a range ignores them (a selection of cells, not a row move).
 */
import { nextFocus } from './data-table-keys.js';
import type { CellRange } from './data-table.types.js';

export interface RangeKeyState {
    /** Drawn data rows. */
    rowCount: number;
    /** The navigable (data) column keys, in drawn order: the columns a range spans. */
    keys: readonly string[];
    pageSize: number;
    rtl: boolean;
    /** Ctrl, or Meta on macOS (Home / End then go to the first / last row too). */
    ctrl: boolean;
}

/**
 * The range after a Shift+navigation `key`: from `range` when there is one (its start is the anchor, its end moves), else from the focused cell
 * (a new range anchored there). `null` when the end comes back onto the anchor (a 1x1 range is plain focus, as after a click); `undefined` when the
 * key does not apply (no anchor, an anchor or end that is not a data column, a key that is not navigation, nothing to move across).
 */
export function extendRange(range: CellRange | null, focused: { rowIndex: number; columnKey: string } | null, key: string, s: RangeKeyState): CellRange | null | undefined {
    const anchor = range ? { row: range.startRow, col: range.startCol } : focused && { row: focused.rowIndex, col: focused.columnKey };
    const end = range ? { row: range.endRow, col: range.endCol } : anchor;
    if (!anchor || !end || !s.keys.includes(anchor.col)) return undefined;
    const col = s.keys.indexOf(end.col);
    if (col < 0) return undefined;
    const next = nextFocus(key, { row: end.row, col, rowCount: s.rowCount, colCount: s.keys.length, isDisabled: () => false, pageSize: s.pageSize, rtl: s.rtl, ctrl: s.ctrl });
    const endCol = next ? s.keys[next.col] : undefined;
    if (!next || endCol === undefined) return undefined;
    if (next.row === anchor.row && endCol === anchor.col) return null;
    return { startRow: anchor.row, startCol: anchor.col, endRow: next.row, endCol };
}

/** Ctrl/Cmd+A: every drawn row by every data column; null when there is nothing to select. */
export function selectAllRange(rowCount: number, keys: readonly string[]): CellRange | null {
    const first = keys[0];
    const last = keys.at(-1);
    if (rowCount <= 0 || first === undefined || last === undefined) return null;
    return { startRow: 0, startCol: first, endRow: rowCount - 1, endCol: last };
}
