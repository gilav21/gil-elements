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

const isItem = (node: unknown): node is HTMLElement => node instanceof HTMLElement && node.localName === 'ge-navigation-menu-item';
const isContent = (node: unknown): node is HTMLElement => node instanceof HTMLElement && node.localName === 'ge-navigation-menu-content';

/** What takes focus in a panel: the links, plain anchors and buttons, in document order. */
function focusableIn(content: Element | null): HTMLElement[] {
    return content ? [...content.querySelectorAll<HTMLElement>('ge-navigation-menu-link, a[href], button')] : [];
}

/** Focuses the trigger of an item, or its lone link. */
function focusEntry(item: HTMLElement): void {
    item.querySelector<HTMLElement>('ge-navigation-menu-trigger, ge-navigation-menu-link')?.focus();
}

/**
 * A row of links, some of which open a dropdown. Hovering an item opens it and leaving closes it after 150ms, so the
 * pointer can cross the gap into the panel; a click or tap on a trigger toggles it (the only way in on touch), and a
 * click outside the menu closes it. Only one item is open at a time. Activating a link does not close the panel.
 *
 * Keyboard: Tab goes through the entries in order and into an open panel; focus landing elsewhere closes the panel.
 * Left and Right (mirrored in right-to-left text), Home and End move along the bar, carrying an open panel with
 * them; Down opens a trigger's panel and focuses its first link; the arrow keys, Home and End walk the links in a
 * panel; Escape closes it and returns focus to the trigger.
 *
 * Put a `ge-navigation-menu-list` inside it, or set `items` to have the list built for you.
 *
 * @slot - A `ge-navigation-menu-list`.
 * @cssprop --density-menu - Size multiplier for triggers, links and panels; falls back to `--density`.
 */
export class GeNavigationMenu extends UiElement implements NavigationMenuHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = { items: { attribute: false } };

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
        this.addEventListener('keydown', this.onKeydown);
        this.addEventListener('focusin', this.onFocusin);
        this.addEventListener('focusout', this.onFocusout);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        this.removeEventListener('keydown', this.onKeydown);
        this.removeEventListener('focusin', this.onFocusin);
        this.removeEventListener('focusout', this.onFocusout);
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

    // Focus is the other way in: the open panel follows it. Landing on a different item closes the open one, and
    // leaving the menu closes the panel, so Tab never strands an open panel behind the focus.
    private readonly onFocusin = (event: FocusEvent) => {
        const item = event.composedPath().find(isItem);
        if (this.active && item !== this.active) this.setActive(undefined);
    };

    private readonly onFocusout = (event: FocusEvent) => {
        const to = event.relatedTarget as Node | null;
        if (this.active && to && !this.contains(to)) this.setActive(undefined);
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const path = event.composedPath() as HTMLElement[];
        const item = path.find(isItem);
        if (!item || event.altKey || event.ctrlKey || event.metaKey) return;
        const content = path.find(isContent);
        const rtl = getComputedStyle(this).direction === 'rtl';
        if (event.key === 'Escape') this.escape(event, item, content);
        else if (content) this.moveInContent(event, content, path, rtl);
        else this.moveInBar(event, item, rtl);
    };

    /** Closes the open panel; when focus was inside it, it goes back to the trigger that opened it. */
    private escape(event: KeyboardEvent, item: HTMLElement, content: HTMLElement | undefined): void {
        if (!this.active) return;
        event.preventDefault();
        this.setActive(undefined);
        if (content) focusEntry(item);
    }

    /** Left and right (mirrored in right-to-left text) and Home and End walk the top-level entries; Down opens a trigger's panel. */
    private moveInBar(event: KeyboardEvent, item: HTMLElement, rtl: boolean): void {
        const entries = this.entries();
        const at = entries.indexOf(item);
        const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
        const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
        let target: HTMLElement | undefined;
        if (event.key === forward) target = entries[(at + 1) % entries.length];
        else if (event.key === backward) target = entries[(at - 1 + entries.length) % entries.length];
        else if (event.key === 'Home') target = entries[0];
        else if (event.key === 'End') target = entries.at(-1);
        else if (event.key === 'ArrowDown' && item.querySelector('ge-navigation-menu-content')) return this.openAndFocus(event, item);
        else return;
        event.preventDefault();
        if (!target) return;
        const wasOpen = this.active !== undefined;
        focusEntry(target);
        // Moving along the bar while a panel is open carries the open panel to the next trigger, as in a menu bar.
        if (wasOpen && target.querySelector('ge-navigation-menu-content')) this.openAndFocus(undefined, target, false);
    }

    private openAndFocus(event: KeyboardEvent | undefined, item: HTMLElement, focusPanel = true): void {
        event?.preventDefault();
        this.setActive(item);
        // After the panel has been shown: a hidden panel cannot take focus.
        if (focusPanel) setTimeout(() => focusableIn(item.querySelector('ge-navigation-menu-content'))[0]?.focus());
    }

    /** Arrows step through the panel's links in order and wrap, so a grid of links is reachable with any of them. */
    private moveInContent(event: KeyboardEvent, content: HTMLElement, path: HTMLElement[], rtl: boolean): void {
        const links = focusableIn(content);
        const at = links.findIndex((link) => path.includes(link));
        const next = rtl ? 'ArrowLeft' : 'ArrowRight';
        const previous = rtl ? 'ArrowRight' : 'ArrowLeft';
        let to: number;
        if (event.key === 'ArrowDown' || event.key === next) to = (at + 1) % links.length;
        else if (event.key === 'ArrowUp' || event.key === previous) to = (at - 1 + links.length) % links.length;
        else if (event.key === 'Home') to = 0;
        else if (event.key === 'End') to = links.length - 1;
        else return;
        event.preventDefault();
        links[to]?.focus();
    }

    /** The top-level items, whichever way the list was built. */
    private entries(): HTMLElement[] {
        const list = this.querySelector('ge-navigation-menu-list') ?? this.shadowRoot?.querySelector('ge-navigation-menu-list');
        return [...(list?.children ?? [])].filter((child): child is HTMLElement => isItem(child));
    }

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
