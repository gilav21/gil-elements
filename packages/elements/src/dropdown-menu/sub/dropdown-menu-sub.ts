import { GeMenuSub } from '../../shared/menu-parts.js';
import { DROPDOWN_MENU_REGISTER } from '../dropdown-menu.js';

/** A nested menu: put a `ge-dropdown-menu-sub-trigger` and a `ge-dropdown-menu-sub-content` inside it. */
export class GeDropdownMenuSub extends GeMenuSub {
    protected override readonly rootEvent = DROPDOWN_MENU_REGISTER;
}
