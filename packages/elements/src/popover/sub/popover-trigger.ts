import { type PopoverHost, POPOVER_REGISTER } from '../popover.js';
import { GeActivator } from '../../shared/activator.js';

/**
 * Opens and closes the enclosing `ge-popover` when clicked. Plain content becomes a button; a control of your own
 * (a `ge-button`) is left as the one tab stop.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GePopoverTrigger extends GeActivator<PopoverHost> {
    protected readonly registerEvent = POPOVER_REGISTER;
    protected readonly slotName: string = 'popover-trigger';

    protected activate(): void {
        this.parent?.toggle();
    }
}
