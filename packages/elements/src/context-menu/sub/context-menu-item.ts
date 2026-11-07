import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { GeMenuItem } from '../../shared/menu-parts.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';
import css from './context-menu-item.css?inline';

/**
 * A row. Activating it (click, Enter or Space) closes the menu; bind your own `click` listener for the action.
 *
 * @attr {string} variant - `default` or `destructive`, which paints the row in the destructive colour.
 */
export class GeContextMenuItem extends GeMenuItem<ContextMenuHost> {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = { ...GeMenuItem.properties, variant: { reflect: true } };
    protected readonly registerEvent = CONTEXT_MENU_REGISTER;
    protected readonly slotName = 'context-menu-item';

    declare variant: 'default' | 'destructive';

    constructor() {
        super();
        this.variant = 'default';
    }

    protected closeRoot(root: ContextMenuHost): void {
        root.close();
    }
}
