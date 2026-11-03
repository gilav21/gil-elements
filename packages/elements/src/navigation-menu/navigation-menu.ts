import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './navigation-menu.css?inline';

export const NAVIGATION_MENU_REGISTER = 'ge-navigation-menu-register';

/** A link inside a dropdown of the data-driven `items`. */
export interface NavigationMenuChild {
    title: string;
    description?: string;
    href: string;
}

/** A top-level entry of the data-driven `items`: a link, or a trigger with a dropdown of `children`. */
export interface NavigationMenuEntry {
    label: string;
    href?: string;
    children?: NavigationMenuChild[];
}

/** What an item needs from the menu it belongs to. */
export interface NavigationMenuHost {
    isActive(item: HTMLElement): boolean;
    setActive(item: HTMLElement | undefined): void;
    scheduleClose(): void;
}

/**
 * A row of links, some of which open a dropdown. Hovering an item opens it and leaving closes it after 150ms, so the
 * pointer can cross the gap into the panel; a click or tap on a trigger toggles it (the only way in on touch), and a
 * click outside the menu closes it. Only one item is open at a time. As in shadcn-angular there is no Escape
 * handling, and activating a link does not close the panel.
 *
 * Put a `ge-navigation-menu-list` inside it, or set `items` to have the list built for you.
 *
 * @slot - A `ge-navigation-menu-list`.
 * @cssprop --density-menu - Size multiplier for triggers, links and panels; falls back to `--density`.
 */
export class GeNavigationMenu extends UiElement implements NavigationMenuHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { items: { attribute: false } };

    declare items: NavigationMenuEntry[];
    private active?: HTMLElement;
    private timer?: ReturnType<typeof setTimeout>;
    private readonly parts = new Set<HTMLElement & { requestUpdate(): void }>();

    constructor() {
        super();
        this.items = [];
        adoptChildren<NavigationMenuHost, HTMLElement & { requestUpdate(): void }>(this, NAVIGATION_MENU_REGISTER, (part) => this.parts.add(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'navigation');
        this.dataset.slot = 'navigation-menu';
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        clearTimeout(this.timer);
    }

    isActive(item: HTMLElement): boolean {
        return this.active === item;
    }

    /** Opens `item`, or closes everything when `undefined`; a pending close is cancelled. */
    setActive(item: HTMLElement | undefined): void {
        clearTimeout(this.timer);
        this.active = item;
        for (const part of this.parts) part.requestUpdate();
    }

    scheduleClose(): void {
        this.timer = setTimeout(() => this.setActive(undefined), 150);
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (this.active && !event.composedPath().includes(this)) this.setActive(undefined);
    };

    private entry(entry: NavigationMenuEntry): TemplateResult {
        if (!entry.children || entry.children.length === 0) {
            return html`<ge-navigation-menu-item
                ><ge-navigation-menu-link href=${entry.href || '#'}><span class="label">${entry.label}</span></ge-navigation-menu-link></ge-navigation-menu-item
            >`;
        }
        return html`<ge-navigation-menu-item>
            <ge-navigation-menu-trigger>${entry.label}</ge-navigation-menu-trigger>
            <ge-navigation-menu-content>
                <ul class="grid">
                    ${entry.children.map(
                        (child) => html`<li>
                            <ge-navigation-menu-link href=${child.href}>
                                <div class="title">${child.title}</div>
                                ${child.description ? html`<p class="description">${child.description}</p>` : nothing}
                            </ge-navigation-menu-link>
                        </li>`,
                    )}
                </ul>
            </ge-navigation-menu-content>
        </ge-navigation-menu-item>`;
    }

    protected override render() {
        const custom = this.querySelector(':scope > ge-navigation-menu-list') !== null || this.items.length === 0;
        if (custom) return html`<slot></slot>`;
        return html`<ge-navigation-menu-list>${this.items.map((entry) => this.entry(entry))}</ge-navigation-menu-list>`;
    }
}
