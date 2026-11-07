export const SIDEBAR_REGISTER = 'ge-sidebar-register';
export type SidebarVariant = 'sidebar' | 'floating' | 'inset';
export type SidebarSide = 'left' | 'right';
export type SidebarCollapseMode = 'icon' | 'hidden';

/** A part of the sidebar: re-rendered whenever the provider's state changes. */
export type SidebarPartElement = HTMLElement & { requestUpdate(): void };

/** What the sidebar and its parts need from their provider. */
export interface SidebarHost extends HTMLElement {
    readonly isOpen: boolean;
    readonly isCollapsed: boolean;
    readonly isMobile: boolean;
    readonly collapsible: boolean;
    toggle(): void;
    setCollapsed(collapsed: boolean): void;
    open(): void;
    close(): void;
    setCollapsible(collapsible: boolean): void;
    register(part: SidebarPartElement): void;
    unregister(part: SidebarPartElement): void;
}
