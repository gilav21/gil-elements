import { type PopoverHost, POPOVER_REGISTER } from '../popover.js';
import { GeActivator } from '../../shared/activator.js';

/**
 * Closes the enclosing `ge-popover` when clicked. Put it around a button that does nothing else; a click on
 * anything inside it closes the popover.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GePopoverClose extends GeActivator<PopoverHost> {
    protected readonly registerEvent = POPOVER_REGISTER;
    protected readonly slotName = 'popover-close';

    protected activate(): void {
        this.parent?.hide();
    }
}
