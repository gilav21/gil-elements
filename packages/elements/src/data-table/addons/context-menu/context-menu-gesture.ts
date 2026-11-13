/**
 * What a context gesture landed on, whether the range selection takes a touch hold, and where an anchored menu opens. Pure (DOM reads only
 * through the elements it is given), so it is tested without a table.
 *
 * The attribute names are the table's DOM protocol (`DOM_PROTOCOL` in `data-table-host.ts`): an addon may not import that module for real
 * (it would put the core on the addon's entry), so they are repeated here and a node test keeps the two equal.
 */
import type { CellInteractionService } from '../../data-table-providers.js';
import type { CellRange } from '../../data-table.types.js';

export const ROW_INDEX = 'data-row-index';
export const COLUMN = 'data-column';
/** A data row (not one of its cells; group headers, detail, empty, footer and spacer rows carry no index). */
export const ROW_SELECTOR = `[${ROW_INDEX}]:not([${COLUMN}])`;
export const CELL_SELECTOR = `[${COLUMN}][${ROW_INDEX}]`;
/** A data column's header: not a special column's (`_selection`, `_expander`, `_actions` carry `data-special`), and the trailing border filler is `role="presentation"`. */
export const HEADER_SELECTOR = '[data-slot="table-head"][role="columnheader"]:not([data-special])';

/** This table's drawn cell at `address` (not a cell of a table nested in one of its rows), or null. */
export function ownCellAt(root: Element, address: CellAddress): HTMLElement | null {
    const selector = `[${ROW_INDEX}="${address.rowIndex}"][${COLUMN}="${CSS.escape(address.columnKey)}"]`;
    return [...root.querySelectorAll<HTMLElement>(selector)].find((el) => el.closest('ge-data-table') === root) ?? null;
}

/** Columns the table adds itself; a gesture on one of them does not move the grid focus, and a hold on one is never the range's. */
export const TABLE_OWNED_COLUMNS: ReadonlySet<string> = new Set(['_selection', '_expander', '_actions']);

export interface CellAddress {
    readonly rowIndex: number;
    readonly columnKey: string;
}

/** `target.closest(selector)`, only when the match is THIS table's (not an outer table's row above a table nested in a detail row). */
export function ownClosest(root: Element, target: Element, selector: string): HTMLElement | null {
    const match = target.closest<HTMLElement>(selector);
    return match && match.closest('ge-data-table') === root ? match : null;
}

/** The drawn index a row or cell element carries; null when it carries none. */
export function indexOf(element: Element): number | null {
    const index = Number(element.getAttribute(ROW_INDEX) ?? Number.NaN);
    return Number.isInteger(index) ? index : null;
}

export function cellAddress(cell: Element | null): CellAddress | null {
    if (!cell) return null;
    const rowIndex = indexOf(cell);
    const columnKey = cell.getAttribute(COLUMN);
    return rowIndex === null || columnKey === null ? null : { rowIndex, columnKey };
}

/** `cell` lies inside `range` (column order = the navigable keys): the maths of the core's `normalizeCellRange` / `isCellInRange`, which an addon may not import. */
export function inCellRange(range: CellRange | null, navigableKeys: readonly string[], cell: CellAddress): boolean {
    if (!range) return false;
    const a = navigableKeys.indexOf(range.startCol);
    const b = navigableKeys.indexOf(range.endCol);
    const col = navigableKeys.indexOf(cell.columnKey);
    if (a < 0 || b < 0 || col < 0) return false;
    return cell.rowIndex >= Math.min(range.startRow, range.endRow) && cell.rowIndex <= Math.max(range.startRow, range.endRow) && col >= Math.min(a, b) && col <= Math.max(a, b);
}

/**
 * Whether the table's range selection will take the touch hold that begins on `cell` (both modes), as the range part's long press decides it
 * (`lazy/range.ts` `onLongPress`): with range selection on and no editor open, a hold on a data cell that is NOT inside the current range and
 * not on a control (`onControl`: the press landed on one of the range's `TOUCH_CONTROLS`) starts a range; every other hold (a header, a
 * table-owned column, a cell inside the range, a control, a row's padding) is free to open the menu. Decided at `touchstart`: by the time the
 * hold fires the range may already sit on the cell.
 */
export function rangeTakesHold(
    interaction: Pick<CellInteractionService, 'cellRange' | 'rangeSelectionEnabled' | 'editingCell'> | undefined,
    cell: CellAddress | null,
    navigableKeys: readonly string[],
    onControl: boolean,
): boolean {
    if (onControl || !interaction?.rangeSelectionEnabled?.() || interaction.editingCell?.()) return false;
    return cell !== null && !TABLE_OWNED_COLUMNS.has(cell.columnKey) && !inCellRange(interaction.cellRange(), navigableKeys, cell);
}

/** Where an anchored menu opens: `x` is its left edge, or its right edge when `alignEnd` (right-to-left). */
export interface MenuAnchor {
    readonly x: number;
    readonly y: number;
    readonly alignEnd: boolean;
}

type Rect = Pick<DOMRect, 'left' | 'right' | 'bottom'>;

/** A menu opened from the keyboard sits under the focused cell (or header), at its inline start: browsers place a key-made `contextmenu` differently. */
export function keyboardAnchor(rect: Rect, rtl: boolean): MenuAnchor {
    return { x: rtl ? rect.right : rect.left, y: rect.bottom, alignEnd: rtl };
}

/**
 * A menu opened from a kebab: the row menu at the button's bottom inline end, the column menu at its bottom inline start (Angular's
 * bottom-right and bottom-left, mirrored in RTL). Without a button rect it opens at the point the event carries, not at (0, 0).
 */
export function buttonAnchor(rect: Rect | undefined, kind: 'row' | 'column', rtl: boolean, fallback: { readonly x: number; readonly y: number }): MenuAnchor {
    if (!rect) return { x: fallback.x, y: fallback.y, alignEnd: rtl };
    const atEnd = kind === 'row';
    const x = atEnd !== rtl ? rect.right : rect.left;
    return { x, y: rect.bottom, alignEnd: rtl };
}

/** The left edge to open a menu `width` wide at. */
export const anchorLeft = (anchor: MenuAnchor, width: number): number => (anchor.alignEnd ? anchor.x - width : anchor.x);

/** How long after a ContextMenu / Shift+F10 keydown its `contextmenu` still counts as key-made (Windows raises it at the keyup). */
export const KEYBOARD_ORIGIN_MS = 1000;

export const isMenuKey = (event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>): boolean =>
    !event.ctrlKey && !event.altKey && !event.metaKey && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey));
