import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeMenuItem } from '../../shared/menu-parts.js';
import { MENUBAR_MENU_REGISTER, type MenubarMenuHost } from './menubar-menu.js';
import css from './menubar-item.css?inline';

/**
 * A row. Activating it (click, Enter or Space) closes the menu and returns focus to its trigger; bind your own
 * `click` listener for the action.
 *
 * @cssprop --density-menu - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeMenubarItem extends GeMenuItem<MenubarMenuHost> {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    protected readonly registerEvent = MENUBAR_MENU_REGISTER;
    protected readonly slotName = 'menubar-item';

    protected closeRoot(root: MenubarMenuHost): void {
        root.closeAfterActivation();
    }
}
