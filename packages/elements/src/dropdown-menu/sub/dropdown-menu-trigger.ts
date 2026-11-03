import { DROPDOWN_MENU_REGISTER, type DropdownMenuHost } from '../dropdown-menu.js';
import { GeActivator } from '../../shared/activator.js';

/**
 * Opens and closes the enclosing `ge-dropdown-menu` when clicked. ArrowDown opens it too. Plain content becomes a
 * button; a control of your own (a `ge-button`) is left as the one tab stop.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GeDropdownMenuTrigger extends GeActivator<DropdownMenuHost> {
    protected readonly registerEvent = DROPDOWN_MENU_REGISTER;
    protected readonly slotName = 'dropdown-trigger';

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('keydown', this.onArrow);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this.onArrow);
    }

    protected activate(): void {
        this.parent?.toggle();
    }

    private readonly onArrow = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown') return;
        event.preventDefault();
        this.parent?.show();
    };
}
