import { GeDialog } from '../dialog/dialog.js';

/**
 * A panel that slides in from an edge of the screen. It holds the open state; put a `ge-sheet-trigger` and a
 * `ge-sheet-content` inside it. Page scroll is locked while it is open, and Escape closes the innermost one.
 *
 * @slot - `ge-sheet-trigger` and `ge-sheet-content`.
 * @attr {boolean} open - Whether the sheet is showing.
 * @fires open-change - When the user opens or closes it; `detail` is the new state.
 */
export class GeSheet extends GeDialog {}
