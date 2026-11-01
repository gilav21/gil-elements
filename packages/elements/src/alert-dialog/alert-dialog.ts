import { GeDialog } from '../dialog/dialog.js';

/**
 * A modal that asks for a decision and can only be closed by choosing: the overlay does not dismiss it (Escape
 * still does). It holds the open state; put a `ge-alert-dialog-trigger` and a `ge-alert-dialog-content` inside it.
 *
 * @slot - `ge-alert-dialog-trigger` and `ge-alert-dialog-content`.
 * @attr {boolean} open - Whether the dialog is showing.
 * @fires open-change - When the user opens or closes it; `detail` is the new state.
 */
export class GeAlertDialog extends GeDialog {}
