import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './collapsible.css?inline';

export const COLLAPSIBLE_REGISTER = 'ge-collapsible-register';

/** A trigger or content element: re-rendered whenever the collapsible's state changes. */
export type CollapsiblePart = HTMLElement & { requestUpdate(): void };

/** The part of the collapsible its trigger and content talk to. */
export interface CollapsibleHost {
    readonly open: boolean;
    readonly disabled: boolean;
    toggle(): void;
    register(part: CollapsiblePart): void;
    unregister(part: CollapsiblePart): void;
}

/**
 * Shows or hides a panel. Put a `ge-collapsible-trigger` and a `ge-collapsible-content` inside; the panel is
 * not rendered at all while closed.
 *
 * @slot - A `ge-collapsible-trigger` and a `ge-collapsible-content`.
 * @fires open-change - After the user, `toggle()`, `show()` or `hide()` changes the state; `detail` is the new state.
 * @attr {boolean} open - Whether the panel is showing. Set it in markup for an initially open collapsible.
 * @attr {boolean} disabled - Blocks opening: `toggle()` and `show()` do nothing. `hide()` still closes it.
 */
export class GeCollapsible extends UiElement implements CollapsibleHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        open: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
    };

    declare open: boolean;
    declare disabled: boolean;

    private readonly parts = new Set<CollapsiblePart>();

    constructor() {
        super();
        this.open = false;
        this.disabled = false;
        adoptChildren<CollapsibleHost, CollapsiblePart>(this, COLLAPSIBLE_REGISTER, (part) => this.register(part));
    }

    register(part: CollapsiblePart): void {
        this.parts.add(part);
        part.requestUpdate();
    }

    unregister(part: CollapsiblePart): void {
        this.parts.delete(part);
    }

    /** Flip the state and announce it. Does nothing while disabled, in either direction. */
    toggle(): void {
        if (this.disabled) return;
        this.set(!this.open);
    }

    /** Open, and announce it even if it was already open. Does nothing while disabled. */
    show(): void {
        if (this.disabled) return;
        this.set(true);
    }

    /** Close, and announce it even if it was already closed. Works while disabled, so a collapsible can always be forced shut. */
    hide(): void {
        this.set(false);
    }

    private set(open: boolean): void {
        this.open = open;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: open, bubbles: true, composed: true }));
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('open') || changed.has('disabled')) this.dataset.state = this.open ? 'open' : 'closed';
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
