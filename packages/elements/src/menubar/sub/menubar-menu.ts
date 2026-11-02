import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from '../../shared/compound.js';
import { registerLayer } from '../../shared/overlay.js';
import { MENUBAR_REGISTER, type MenubarHost, type MenubarMenuRef } from '../menubar.js';
import css from './menubar-menu.css?inline';

export const MENUBAR_MENU_REGISTER = 'ge-menubar-menu-register';

/** A part of a menu; it re-renders when the menu opens or closes. */
export interface MenubarPart extends HTMLElement {
    requestUpdate(): void;
    focusFirst?(): void;
}

/** What the parts of one menu need from it. */
export interface MenubarMenuHost {
    readonly open: boolean;
    /** Whether any menu in the bar is open. */
    readonly barIsOpen: boolean;
    show(): void;
    toggle(): void;
    hide(): void;
    /** Closes and returns focus to the trigger, for Escape. */
    closeAndFocusTrigger(): void;
    /** Closes after an item was activated; focus returns to the trigger once the key event is over. */
    closeAfterActivation(): void;
    /** Moves to the menu before (`-1`) or after (`1`) this one in the bar. */
    focusAdjacent(step: 1 | -1): void;
    /** The bar's step for a left or right arrow key. */
    stepFor(key: string): 1 | -1 | undefined;
    /** Moves focus to the first enabled item, once the panel has been shown. */
    focusFirstItem(): void;
    register(part: MenubarPart): void;
    unregister(part: MenubarPart): void;
}

/**
 * One menu in the bar: a `ge-menubar-trigger` and the `ge-menubar-content` it opens. It is open while the bar's
 * active menu is this one.
 *
 * @slot - `ge-menubar-trigger` and `ge-menubar-content`.
 */
export class GeMenubarMenu extends UiElement implements MenubarMenuRef, MenubarMenuHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private bar?: MenubarHost;
    private readonly parts = new Set<MenubarPart>();
    private release?: () => void;

    constructor() {
        super();
        adoptChildren<MenubarMenuHost, MenubarPart>(this, MENUBAR_MENU_REGISTER, (part) => this.register(part));
    }

    get open(): boolean {
        return !!this.bar && this.bar.active === this;
    }

    get barIsOpen(): boolean {
        return !!this.bar?.active;
    }

    get trigger(): HTMLElement | null {
        return this.querySelector<HTMLElement>(':scope > ge-menubar-trigger');
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'menubar-menu';
        this.bar = findParent<MenubarHost, GeMenubarMenu>(this, MENUBAR_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.release?.();
        this.release = undefined;
        this.bar?.unregister(this);
        this.bar = undefined;
    }

    register(part: MenubarPart): void {
        this.parts.add(part);
    }

    unregister(part: MenubarPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.bar?.setActive(this);
    }

    hide(): void {
        if (this.open) this.bar?.setActive(undefined);
    }

    toggle(): void {
        if (this.open) this.hide();
        else this.show();
    }

    closeAndFocusTrigger(): void {
        this.trigger?.focus();
        this.hide();
    }

    closeAfterActivation(): void {
        this.closeAndFocusTrigger();
    }

    focusFirstItem(): void {
        setTimeout(() => [...this.parts].find((part) => part.focusFirst)?.focusFirst?.());
    }

    focusAdjacent(step: 1 | -1): void {
        this.bar?.focusAdjacent(this, step);
    }

    stepFor(key: string): 1 | -1 | undefined {
        return this.bar?.stepFor(key);
    }

    protected override updated(): void {
        const open = this.open;
        if (open && !this.release) this.release = registerLayer({ modal: false, dismiss: () => this.closeAndFocusTrigger() });
        else if (!open) {
            this.release?.();
            this.release = undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
