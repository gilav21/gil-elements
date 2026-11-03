import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import { isRtl } from '../shared/menu.js';
import css from './menubar.css?inline';

export const MENUBAR_REGISTER = 'ge-menubar-register';

/** What a menu needs from the bar it sits in. */
export interface MenubarHost {
    /** The one menu that is open, if any. */
    readonly active: MenubarMenuRef | undefined;
    setActive(menu: MenubarMenuRef | undefined): void;
    /** Moves to the menu `step` places from `from` (wrapping), focuses its trigger, and opens it when a menu is open. */
    focusAdjacent(from: MenubarMenuRef, step: 1 | -1): void;
    /** The step a left or right arrow means in the bar's text direction. */
    stepFor(key: string): 1 | -1 | undefined;
    register(menu: MenubarMenuRef): void;
    unregister(menu: MenubarMenuRef): void;
}

/** What the bar needs from a menu. */
export interface MenubarMenuRef extends HTMLElement {
    readonly trigger: HTMLElement | null;
    requestUpdate(): void;
}

/**
 * A horizontal bar of menus, like the menu bar of a desktop app. Only one menu is open at a time; once one is open,
 * hovering another trigger or pressing Left or Right switches to it. A click outside the bar closes the open menu.
 *
 * @slot - `ge-menubar-menu` elements.
 * @cssprop --density-menu - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeMenubar extends UiElement implements MenubarHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        active: { state: true },
    };

    declare active: MenubarMenuRef | undefined;
    private readonly menus = new Set<MenubarMenuRef>();

    constructor() {
        super();
        this.active = undefined;
        adoptChildren<MenubarHost, MenubarMenuRef>(this, MENUBAR_REGISTER, (menu) => this.register(menu));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menubar');
        this.dataset.slot = 'menubar';
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
    }

    register(menu: MenubarMenuRef): void {
        this.menus.add(menu);
    }

    unregister(menu: MenubarMenuRef): void {
        this.menus.delete(menu);
        if (this.active === menu) this.active = undefined;
    }

    setActive(menu: MenubarMenuRef | undefined): void {
        this.active = menu;
    }

    stepFor(key: string): 1 | -1 | undefined {
        if (key !== 'ArrowLeft' && key !== 'ArrowRight') return undefined;
        const forward = isRtl(this) ? 'ArrowLeft' : 'ArrowRight';
        return key === forward ? 1 : -1;
    }

    focusAdjacent(from: MenubarMenuRef, step: 1 | -1): void {
        const menus = [...this.menus].sort(byDocumentOrder);
        const index = menus.indexOf(from);
        if (index === -1) return;
        const target = menus[(index + step + menus.length) % menus.length]?.trigger;
        target?.focus();
        // A click rather than setActive: the trigger owns what opening means.
        if (this.active) target?.click();
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (this.active && !event.composedPath().includes(this)) this.active = undefined;
    };

    protected override updated(): void {
        for (const menu of this.menus) menu.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
