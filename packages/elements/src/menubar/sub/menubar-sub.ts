import { GeMenuSub } from '../../shared/menu-parts.js';
import { MENUBAR_MENU_REGISTER } from './menubar-menu.js';

/** A nested menu: put a `ge-menubar-sub-trigger` and a `ge-menubar-sub-content` inside it. */
export class GeMenubarSub extends GeMenuSub {
    protected override readonly rootEvent = MENUBAR_MENU_REGISTER;
}
