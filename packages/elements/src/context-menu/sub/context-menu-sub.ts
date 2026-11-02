import { GeMenuSub } from '../../shared/menu-parts.js';
import { CONTEXT_MENU_REGISTER } from '../context-menu.js';

/**
 * A nested menu: put a `ge-context-menu-sub-trigger` and a `ge-context-menu-sub-content` inside it. Its panel is in
 * the top layer, so closing the menu around it has to close it too.
 */
export class GeContextMenuSub extends GeMenuSub {
    protected override readonly rootEvent = CONTEXT_MENU_REGISTER;
}
