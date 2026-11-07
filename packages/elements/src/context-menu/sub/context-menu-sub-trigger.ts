import { unsafeCSS } from 'lit';
import { GeMenuSubTrigger } from '../../shared/menu-parts.js';

/**
 * The row that opens a submenu: on hover, on Enter and on the forward arrow. A click on it stays inside the menu.
 */
export class GeContextMenuSubTrigger extends GeMenuSubTrigger {
    static override readonly styles = [...GeMenuSubTrigger.styles, unsafeCSS(':host{cursor:default}')];
    protected readonly slotName = 'context-menu-sub-trigger';
    // Hover opens it, and a tap fires the mouse events a hover would.
    protected override readonly tapToggles = false;
}
