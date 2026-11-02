import { findParent } from '../../shared/compound.js';
import { GeMenuSub } from '../../shared/menu-parts.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';

/**
 * A nested menu: put a `ge-context-menu-sub-trigger` and a `ge-context-menu-sub-content` inside it. Its panel is in
 * the top layer, so closing the menu around it has to close it too.
 */
export class GeContextMenuSub extends GeMenuSub {
    private root?: ContextMenuHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.root = findParent<ContextMenuHost, GeContextMenuSub>(this, CONTEXT_MENU_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.root?.unregister(this);
        this.root = undefined;
    }

    protected override updated(): void {
        super.updated();
        if (this.root && !this.root.open && this.open) this.closeNow();
    }
}
