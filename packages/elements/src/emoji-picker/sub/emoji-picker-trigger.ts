import { GePopoverTrigger } from '../../popover/sub/popover-trigger.js';

/**
 * Opens and closes the enclosing `ge-emoji-picker` when clicked. Plain content becomes a button; a control of your own
 * (a `ge-button`) is left as the one tab stop.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GeEmojiPickerTrigger extends GePopoverTrigger {
    protected override readonly slotName = 'emoji-picker-trigger';
}
