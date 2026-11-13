/**
 * What a context gesture landed on, whether the range selection takes a touch hold, and where an anchored menu opens. Pure (DOM reads only
 * through the elements it is given), so it is tested without a table.
 *
 * The attribute names are the table's DOM protocol (`DOM_PROTOCOL` in `data-table-host.ts`): an addon may not import that module for real
 * (it would put the core on the addon's entry), so they are repeated here and a node test keeps the two equal.
 */
import type { CellInteractionService } from '../../data-table-providers.js';

export const ROW_INDEX = 'data-row-index';
export const COLUMN = 'data-column';
/** A data row (not one of its cells; group headers, detail, empty, footer and spacer rows carry no index). */
export const ROW_SELECTOR = `[${ROW_INDEX}]:not([${COLUMN}])`;
export const CELL_SELECTOR = `[${COLUMN}][${ROW_INDEX}]`;
/** A data column's header (the trailing border filler is `role="presentation"`). */
export const HEADER_SELECTOR = '[data-slot="table-head"][role="columnheader"]';

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

/**
 * Whether the table's range selection will take the touch hold that begins on `cell` (both modes): with range selection on and no
 * editor open, a hold on a data cell that is not selected starts a range; every other hold (a header, a table-owned column, a selected
 * cell, a row's padding) is free to open the menu. Decided at `touchstart`: by the time the hold fires the range may already sit on the cell.
 */
export function rangeTakesHold(interaction: Pick<CellInteractionService, 'isCellSelected' | 'rangeSelectionEnabled' | 'editingCell'> | undefined, cell: CellAddress | null): boolean {
    if (!interaction?.rangeSelectionEnabled?.() || interaction.editingCell?.()) return false;
    return cell !== null && !TABLE_OWNED_COLUMNS.has(cell.columnKey) && !interaction.isCellSelected(cell.rowIndex, cell.columnKey);
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
