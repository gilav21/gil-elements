import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeMenuItem } from '../../shared/menu-parts.js';
import { DROPDOWN_MENU_REGISTER, type DropdownMenuHost } from '../dropdown-menu.js';
import css from './dropdown-menu-item.css?inline';

/**
 * A row. Activating it (click, Enter or Space) closes the menu; bind your own `click` listener for the action.
 *
 * @cssprop --density-menu - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeDropdownMenuItem extends GeMenuItem<DropdownMenuHost> {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    protected readonly registerEvent = DROPDOWN_MENU_REGISTER;
    protected readonly slotName = 'dropdown-item';

    protected closeRoot(root: DropdownMenuHost): void {
        root.hide();
    }
}
