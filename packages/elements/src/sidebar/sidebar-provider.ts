import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { SIDEBAR_REGISTER, type SidebarHost, type SidebarPartElement } from './sidebar.types.js';
import css from './sidebar-provider.css?inline';

/** Default key used when persistence is on and no `storage-key` is given. */
export const SIDEBAR_STORAGE_KEY = 'ge-sidebar:collapsed';
/** Below this width the sidebar is a drawer instead of a rail. */
const MOBILE_BREAKPOINT = 768;

/** Persistence is on unless the attribute says `false`, because a bare boolean attribute cannot default to true. */
const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false' };

/**
 * Holds the state every part of a sidebar shares: whether the mobile drawer is open, whether the desktop rail is
 * collapsed, and whether the page is narrow enough to use the drawer. Put the `ge-sidebar` and the `ge-sidebar-inset`
 * inside it.
 *
 * The collapsed flag is remembered in `localStorage` (read once, written on every change; every failure is
 * swallowed so the sidebar still renders with site data blocked).
 *
 * @slot - The sidebar and the page content next to it.
 * @attr {boolean} persist-collapsed - Whether the collapsed flag is remembered. On unless set to `false`.
 * @attr {string} storage-key - Where it is remembered. Defaults to `ge-sidebar:collapsed`.
 */
export class GeSidebarProvider extends UiElement implements SidebarHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        persistCollapsed: { attribute: 'persist-collapsed', converter: defaultTrue },
        storageKey: { attribute: 'storage-key' },
        isOpen: { state: true },
        isCollapsed: { state: true },
        isMobile: { state: true },
        collapsible: { state: true },
    };

    declare persistCollapsed: boolean;
    declare storageKey: string;
    /** Whether the mobile drawer is open. Only observable on mobile. */
    declare isOpen: boolean;
    /** Whether the desktop rail is collapsed. */
    declare isCollapsed: boolean;
    declare isMobile: boolean;
    /** Mirrors the sidebar's `collapsible`: while false the rail never collapses. */
    declare collapsible: boolean;

    private readonly parts = new Set<SidebarPartElement>();
    private seeded: string | null | undefined;

    constructor() {
        super();
        this.persistCollapsed = true;
        this.storageKey = SIDEBAR_STORAGE_KEY;
        this.isOpen = true;
        this.isCollapsed = false;
        this.isMobile = false;
        this.collapsible = true;
        adoptChildren<SidebarHost, SidebarPartElement>(this, SIDEBAR_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'sidebar-provider';
        this.checkMobile();
        globalThis.addEventListener('resize', this.checkMobile);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        globalThis.removeEventListener('resize', this.checkMobile);
    }

    register(part: SidebarPartElement): void {
        this.parts.add(part);
        part.requestUpdate();
    }

    unregister(part: SidebarPartElement): void {
        this.parts.delete(part);
    }

    /** On mobile opens or closes the drawer; on desktop collapses or expands the rail unless `collapsible` is false. */
    toggle(): void {
        if (this.isMobile) {
            this.isOpen = !this.isOpen;
            return;
        }
        if (!this.collapsible) return;
        this.setCollapsed(!this.isCollapsed);
    }

    /** Collapses or expands the desktop rail and remembers it. */
    setCollapsed(collapsed: boolean): void {
        this.isCollapsed = collapsed;
        this.persist();
    }

    open(): void {
        this.isOpen = true;
    }

    close(): void {
        this.isOpen = false;
    }

    setCollapsible(collapsible: boolean): void {
        this.collapsible = collapsible;
        if (!collapsible) this.isCollapsed = false;
    }

    private readonly checkMobile = (): void => {
        const mobile = globalThis.innerWidth < MOBILE_BREAKPOINT;
        // Only crossing into mobile dismisses an open drawer. A resize that stays narrow (a phone's address bar
        // sliding away fires one) must not close a drawer the user just opened. Leaving mobile reopens nothing.
        if (mobile && !this.isMobile) this.isOpen = false;
        this.isMobile = mobile;
    };

    protected override willUpdate(changed: PropertyValues<this>): void {
        const key = this.persistCollapsed ? this.storageKey : null;
        if (this.seeded !== undefined && !changed.has('persistCollapsed') && !changed.has('storageKey')) return;
        this.seeded = key;
        if (key === null) return;
        if (storedCollapsed(key)) this.isCollapsed = true;
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    private persist(): void {
        if (!this.persistCollapsed) return;
        try {
            globalThis.localStorage?.setItem(this.storageKey, String(this.isCollapsed));
        } catch {
            // Storage unavailable (private window, blocked site data, quota): the preference is simply not remembered.
        }
    }

    protected override render() {
        return html`<div class="provider" data-slot="sidebar-provider" data-state=${this.isOpen ? 'open' : 'closed'} data-collapsed=${String(this.isCollapsed)}><slot></slot></div>`;
    }
}

/** Whether the remembered flag is exactly `true`; anything else (absent, `false`, a stray value, unreadable storage) leaves the rail expanded. */
function storedCollapsed(key: string): boolean {
    try {
        return globalThis.localStorage?.getItem(key) === 'true';
    } catch {
        // Reading `localStorage` can itself throw when site data is blocked.
        return false;
    }
}
