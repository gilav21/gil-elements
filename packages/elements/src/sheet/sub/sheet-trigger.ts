import { GeDialogTrigger } from '../../dialog/sub/dialog-trigger.js';

/**
 * Opens and closes the enclosing `ge-sheet` when clicked. Plain content becomes a button; a control of your own
 * (a `ge-button`) is left as the one tab stop.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GeSheetTrigger extends GeDialogTrigger {}
