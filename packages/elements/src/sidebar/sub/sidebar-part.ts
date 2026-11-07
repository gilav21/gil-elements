import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SIDEBAR_REGISTER, type SidebarHost } from '../sidebar.types.js';

/** Base of every sidebar part: finds its provider, re-renders with it, and knows whether the rail is collapsed. */
export abstract class GeSidebarPart extends UiElement {
    protected provider?: SidebarHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.provider = findParent<SidebarHost, GeSidebarPart>(this, SIDEBAR_REGISTER);
        this.provider?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.provider?.unregister(this);
        this.provider = undefined;
    }

    /** The desktop rail is collapsed; on mobile the drawer always shows its full labels. */
    protected get collapsedState(): boolean {
        return !!this.provider && this.provider.isCollapsed && !this.provider.isMobile;
    }
}
