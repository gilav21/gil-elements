import { GeDialog } from '../dialog/dialog.js';

export type DrawerDirection = 'top' | 'bottom' | 'left' | 'right';

/**
 * A panel that slides in from an edge of the screen, like a sheet but with rounded corners and, from the top
 * and bottom, a drag-handle bar. It holds the open state and the edge; put a `ge-drawer-trigger` and a
 * `ge-drawer-content` inside it. Page scroll is locked while it is open, and Escape closes the innermost one.
 *
 * @slot - `ge-drawer-trigger` and `ge-drawer-content`.
 * @attr {boolean} open - Whether the drawer is showing.
 * @attr {'top' | 'bottom' | 'left' | 'right'} direction - The edge it slides in from; set it here, not on the content. Defaults to bottom; left and right follow the text direction.
 * @fires open-change - When the user opens or closes it; `detail` is the new state.
 */
export class GeDrawer extends GeDialog {
    static override properties = {
        ...GeDialog.properties,
        direction: { reflect: true },
    };

    declare direction: DrawerDirection;

    constructor() {
        super();
        this.direction = 'bottom';
    }
}
