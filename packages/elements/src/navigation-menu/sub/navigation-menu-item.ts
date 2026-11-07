import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { isTouchDevice } from '../../shared/touch.js';
import { NAVIGATION_MENU_REGISTER, type NavigationMenuHost } from '../navigation-menu.js';

export const NAVIGATION_MENU_ITEM_REGISTER = 'ge-navigation-menu-item-register';

/** A part that re-renders when the item opens or closes. */
export type ItemPart = HTMLElement & { requestUpdate(): void };

/** What the parts of one item need from it. */
export interface NavigationMenuItemHost {
    readonly open: boolean;
    toggle(): void;
}

/**
 * One entry of the list: a trigger with its content, or a lone link. It is the box the content is placed against,
 * and it carries the hover handling: entering opens it, leaving closes after a grace period.
 *
 * @slot - A `ge-navigation-menu-trigger` and `ge-navigation-menu-content`, or a `ge-navigation-menu-link`.
 */
export class GeNavigationMenuItem extends UiElement implements NavigationMenuItemHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(':host{position:relative;display:block}')];

    private menu?: NavigationMenuHost;
    private readonly parts = new Set<ItemPart>();

    constructor() {
        super();
        adoptChildren<NavigationMenuItemHost, ItemPart>(this, NAVIGATION_MENU_ITEM_REGISTER, (part) => this.parts.add(part));
    }

    get open(): boolean {
        return this.menu?.isActive(this) ?? false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'none');
        this.dataset.slot = 'navigation-menu-item';
        this.menu = findParent<NavigationMenuHost, GeNavigationMenuItem>(this, NAVIGATION_MENU_REGISTER);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('mouseleave', this.onLeave);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('mouseleave', this.onLeave);
        this.menu = undefined;
    }

    toggle(): void {
        this.menu?.setActive(this.open ? undefined : this);
    }

    private readonly onEnter = () => {
        if (isTouchDevice()) return;
        this.menu?.setActive(this);
    };

    private readonly onLeave = () => {
        // A panel the keyboard is working in stays open when the pointer drifts away.
        if (!isTouchDevice() && !this.matches(':focus-within')) this.menu?.scheduleClose();
    };

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
