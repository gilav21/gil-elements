import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../../shared/compound.js';

export const DROPDOWN_SUB_REGISTER = 'ge-dropdown-menu-sub-register';

/** What the trigger and content of a submenu need from it. */
export interface DropdownSubHost {
    readonly open: boolean;
    enter(): void;
    leave(): void;
    focusTrigger(): void;
    focusContent(): void;
    register(part: DropdownSubPart): void;
    unregister(part: DropdownSubPart): void;
}

/** A part of a submenu; the trigger and the content re-render when it opens or closes. */
export interface DropdownSubPart extends HTMLElement {
    requestUpdate(): void;
    focusFirst?(): void;
}

/**
 * A nested menu. It holds the submenu's open state; put a `ge-dropdown-menu-sub-trigger` and a
 * `ge-dropdown-menu-sub-content` inside it.
 *
 * @slot - The trigger row and the content.
 */
export class GeDropdownMenuSub extends UiElement implements DropdownSubHost {
    static override styles = [UiElement.styles, unsafeCSS(':host{position:relative;display:block;width:100%}')];
    static override properties = {
        open: { state: true },
    };

    declare open: boolean;
    private readonly parts = new Set<DropdownSubPart>();
    private timer?: ReturnType<typeof setTimeout>;

    constructor() {
        super();
        this.open = false;
        adoptChildren<DropdownSubHost, DropdownSubPart>(this, DROPDOWN_SUB_REGISTER, (part) => this.register(part));
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.timer);
    }

    register(part: DropdownSubPart): void {
        this.parts.add(part);
    }

    unregister(part: DropdownSubPart): void {
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

    focusTrigger(): void {
        setTimeout(() => this.querySelector<HTMLElement>(':scope > ge-dropdown-menu-sub-trigger')?.focus());
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
