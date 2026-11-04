import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../shared/compound.js';
import { ModalFocus, trapTab } from '../shared/overlay.js';
import { SIDEBAR_REGISTER, type SidebarCollapseMode, type SidebarHost, type SidebarSide, type SidebarVariant } from './sidebar.types.js';
import css from './sidebar.css?inline';

/** `collapsible` is on unless the attribute says `false`, because a bare boolean attribute cannot default to true. */
const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false' };

/**
 * The panel. On a wide page it is a sticky column that collapses to a 60px icon rail (or to nothing); on a page
 * narrower than 768px it is a drawer opened by the trigger, with a scrim, Escape to close, a focus trap, and focus
 * handed back on close. Put it inside a `ge-sidebar-provider`.
 *
 * @slot - `ge-sidebar-header`, `-content`, `-footer` and `-rail`.
 * @attr {'left' | 'right'} side - The edge it sits on; also the way the drawer slides off-screen.
 * @attr {'sidebar' | 'floating' | 'inset'} variant - Desktop look: flush with a border, a detached shadowed card, or a detached card with no border or shadow. The drawer ignores it.
 * @attr {boolean} collapsible - Whether the desktop rail may collapse. On unless set to `false`, which pins it open.
 * @attr {'icon' | 'hidden'} collapse-mode - What collapsing looks like: a 60px rail of icons (default) or zero width.
 */
export class GeSidebar extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        side: { reflect: true },
        variant: { reflect: true },
        collapsible: { converter: defaultTrue, reflect: true },
        collapseMode: { attribute: 'collapse-mode', reflect: true },
    };

    declare side: SidebarSide;
    declare variant: SidebarVariant;
    declare collapsible: boolean;
    declare collapseMode: SidebarCollapseMode;

    private provider?: SidebarHost;
    private readonly modal = new ModalFocus();
    private drawerOpen = false;

    constructor() {
        super();
        this.side = 'left';
        this.variant = 'sidebar';
        this.collapsible = true;
        this.collapseMode = 'icon';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sidebar-root';
        this.provider = findParent<SidebarHost, GeSidebar>(this, SIDEBAR_REGISTER);
        this.provider?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.provider?.unregister(this);
        this.provider = undefined;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('collapsible')) this.provider?.setCollapsible(this.collapsible);
    }

    protected override updated(): void {
        const provider = this.provider;
        const open = !!provider && provider.isMobile && provider.isOpen;
        if (open === this.drawerOpen) return;
        this.drawerOpen = open;
        const aside = this.shadowRoot?.querySelector<HTMLElement>('aside');
        if (!aside) return;
        if (open) void this.modal.enter(aside);
        else this.modal.leave();
    }

    private get drawerIsOpen(): boolean {
        return !!this.provider && this.provider.isMobile && this.provider.isOpen;
    }

    private readonly onKeydown = (event: KeyboardEvent): void => {
        if (!this.drawerIsOpen) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            this.provider?.close();
        } else if (event.key === 'Tab') {
            const aside = event.currentTarget as HTMLElement;
            trapTab(event, aside, aside);
        }
    };

    private readonly onScrimKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.provider?.close();
        }
    };

    protected override render() {
        const provider = this.provider;
        const mobile = provider?.isMobile ?? false;
        const open = provider?.isOpen ?? true;
        const collapsed = !mobile && (provider?.isCollapsed ?? false);
        return html`${mobile && open
                ? html`<div class="scrim" role="button" tabindex="0" aria-label="Close sidebar" @click=${() => provider?.close()} @keydown=${this.onScrimKeydown}></div>`
                : nothing}
            <aside
                data-slot="sidebar"
                data-state=${open ? 'open' : 'closed'}
                data-side=${this.side}
                data-variant=${this.variant}
                data-collapsible=${this.collapsible ? this.collapseMode : 'none'}
                data-collapse-mode=${this.collapseMode}
                ?data-mobile=${mobile}
                ?data-collapsed=${collapsed}
                tabindex="-1"
                @keydown=${this.onKeydown}
            >
                <slot></slot>
            </aside>`;
    }
}
