import { html, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, findParent } from './compound.js';
import { activateAsClick, blockDisabledActivation, isRtl } from './menu.js';
import { isTouchDevice } from './touch.js';
import subTriggerCss from './menu-sub-trigger.css?inline';

/**
 * The parts every menu (dropdown, context menu, menubar) builds its rows from. A menu's own elements extend these,
 * name the event their root listens for, and bring their own styles; the keyboard and pointer behaviour is shared.
 */

export const MENU_SUB_REGISTER = 'ge-menu-sub-register';

/** What the trigger and content of a submenu need from it. */
export interface MenuSubHost {
    readonly open: boolean;
    enter(): void;
    leave(): void;
    focusTrigger(): void;
    focusContent(): void;
    register(part: MenuSubPart): void;
    unregister(part: MenuSubPart): void;
}

/** A part of a submenu; the trigger and the content re-render when it opens or closes. */
export interface MenuSubPart extends HTMLElement {
    requestUpdate(): void;
    focusFirst?(): void;
}

/**
 * A nested menu. It holds the submenu's open state; put a sub-trigger and a sub-content inside it.
 *
 * @slot - The trigger row and the content.
 */
export class GeMenuSub extends UiElement implements MenuSubHost {
    static override styles = [UiElement.styles, unsafeCSS(':host{position:relative;display:block;width:100%}')];
    static override properties = {
        open: { state: true },
    };

    declare open: boolean;
    private readonly parts = new Set<MenuSubPart>();
    private timer?: ReturnType<typeof setTimeout>;

    constructor() {
        super();
        this.open = false;
        adoptChildren<MenuSubHost, MenuSubPart>(this, MENU_SUB_REGISTER, (part) => this.register(part));
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.timer);
    }

    register(part: MenuSubPart): void {
        this.parts.add(part);
    }

    unregister(part: MenuSubPart): void {
        this.parts.delete(part);
    }

    /** Opens, and cancels a pending close, which is what lets the pointer cross the gap between row and panel. */
    enter(): void {
        clearTimeout(this.timer);
        this.open = true;
    }

    /** Closes after 100 ms, so a later `enter` can cancel it. */
    leave(): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => (this.open = false), 100);
    }

    /** Closes now, for when the menu around it closes. */
    closeNow(): void {
        clearTimeout(this.timer);
        this.open = false;
    }

    focusTrigger(): void {
        setTimeout(() => this.querySelector<HTMLElement>(':scope > [aria-haspopup="true"]')?.focus());
    }

    /** One tick: the panel has not been shown yet when this is called alongside `enter`. */
    focusContent(): void {
        setTimeout(() => [...this.parts].find((part) => part.focusFirst)?.focusFirst?.());
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}

const CHEVRON = svg`<path d="m9 18 6-6-6-6" />`;

/**
 * The row that opens a submenu: on hover, on a tap (touch), on Enter and on the forward arrow (Right, or Left in
 * right-to-left text), which also moves focus into it.
 *
 * @slot - The label.
 * @attr {boolean} disabled - Dims the row and stops hover, tap and keys from opening the submenu.
 * @attr {boolean} inset - Indents the label to line up with rows that carry an icon.
 */
export abstract class GeMenuSubTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(subTriggerCss)];
    static override properties = {
        disabled: { type: Boolean, reflect: true },
        inset: { type: Boolean, reflect: true },
    };

    declare disabled: boolean;
    declare inset: boolean;
    protected sub?: MenuSubHost;
    protected abstract readonly slotName: string;
    /** Whether a tap opens and closes it; where hover cannot happen it must. */
    protected readonly tapToggles: boolean = true;

    constructor() {
        super();
        this.disabled = false;
        this.inset = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menuitem');
        this.setAttribute('aria-haspopup', 'true');
        this.tabIndex = -1;
        this.dataset.slot = this.slotName;
        this.sub = findParent<MenuSubHost, GeMenuSubTrigger>(this, MENU_SUB_REGISTER);
        this.sub?.register(this);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('mouseleave', this.onLeave);
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.sub?.unregister(this);
        this.sub = undefined;
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('mouseleave', this.onLeave);
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKeydown);
    }

    private readonly onEnter = () => {
        if (!this.disabled && !(this.tapToggles && isTouchDevice())) this.sub?.enter();
    };

    private readonly onLeave = () => {
        if (!(this.tapToggles && isTouchDevice())) this.sub?.leave();
    };

    // With a mouse a click would immediately close the submenu that hover just opened, so only touch toggles.
    private readonly onClick = (event: Event) => {
        if (!this.tapToggles) {
            event.stopPropagation();
            return;
        }
        if (this.disabled || !isTouchDevice() || !this.sub) return;
        if (this.sub.open) this.sub.leave();
        else this.sub.enter();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (this.disabled || event.target !== this) return;
        const forward = isRtl(this) ? 'ArrowLeft' : 'ArrowRight';
        if (event.key !== forward && event.key !== 'Enter') return;
        event.preventDefault();
        this.sub?.enter();
        this.sub?.focusContent();
    };

    protected override updated(): void {
        this.toggleAttribute('data-disabled', this.disabled);
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
        this.setAttribute('aria-expanded', String(this.sub?.open ?? false));
    }

    protected override render() {
        return html`<slot></slot><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CHEVRON}</svg>`;
    }
}

/**
 * A row. Activating it (click, Enter or Space) closes the menu; bind your own `click` listener for the action. A key
 * activation is a real click, so that listener runs once for pointer and keyboard alike, and never while disabled.
 *
 * @slot - The label.
 * @attr {boolean} disabled - Dims the row, blocks activation and removes it from the arrow-key ring.
 * @attr {boolean} inset - Indents the label to line up with rows that carry an icon.
 * @attr {string} shortcut - Hint text on the right, such as `⌘K`. Decorative: it binds no key.
 */
export abstract class GeMenuItem<Root> extends UiElement {
    static override properties = {
        disabled: { type: Boolean, reflect: true },
        inset: { type: Boolean, reflect: true },
        shortcut: {},
    };

    declare disabled: boolean;
    declare inset: boolean;
    declare shortcut: string;
    protected abstract readonly registerEvent: string;
    protected abstract readonly slotName: string;
    protected root?: Root;
    private unblock?: () => void;

    /** Closes the menu this row belongs to. */
    protected abstract closeRoot(root: Root): void;

    constructor() {
        super();
        this.disabled = false;
        this.inset = false;
        this.shortcut = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menuitem');
        this.tabIndex = -1;
        this.dataset.slot = this.slotName;
        this.root = findParent<Root, GeMenuItem<Root>>(this, this.registerEvent);
        this.unblock = blockDisabledActivation(this, () => this.disabled);
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unblock?.();
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKeydown);
        this.root = undefined;
    }

    // A disabled row never gets here: the capture guard stops its click first.
    private readonly onClick = () => {
        if (this.root) this.closeRoot(this.root);
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') activateAsClick(event, this, this.disabled);
    };

    protected override updated(): void {
        this.toggleAttribute('data-disabled', this.disabled);
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    protected override render() {
        return html`<slot></slot>${this.shortcut ? html`<span class="shortcut" part="shortcut">${this.shortcut}</span>` : ''}`;
    }
}
