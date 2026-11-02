import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import type { Side } from '../shared/anchor.js';
import css from './tooltip.css?inline';

export const TOOLTIP_REGISTER = 'ge-tooltip-register';

/** How long a tooltip opened by touch stays before it dismisses itself. */
export const TOUCH_AUTO_DISMISS_MS = 2500;

/** What the parts of a tooltip need from it. */
export interface TooltipHost {
    readonly open: boolean;
    readonly side: Side;
    readonly delayDuration: number;
    show(): void;
    hide(): void;
    register(part: TooltipPart): void;
    unregister(part: TooltipPart): void;
}

/** A part that re-renders when the tooltip opens, closes or moves. */
export interface TooltipPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A short label shown beside a trigger on hover, keyboard focus or touch. Put a `ge-tooltip-trigger` and a
 * `ge-tooltip-content` inside it, or set `content` and project only the trigger.
 *
 * It does not flip or shift: near a viewport edge the bubble can clip.
 *
 * @slot - `ge-tooltip-trigger` and, in custom mode, `ge-tooltip-content`.
 * @attr {string} content - Simple mode: the tooltip text. A `ge-tooltip-content` is generated for you.
 * @attr {string} side - Side of the trigger the bubble sits on: `top` (default), `right`, `bottom` or `left`.
 * @attr {number} delay-duration - Hover dwell in milliseconds before it opens. Focus and touch open it at once. Defaults to 200.
 * @attr {boolean} open - Whether the bubble is showing. Hover, focus and touch drive it; `show()` and `hide()` do too.
 */
export class GeTooltip extends UiElement implements TooltipHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        content: {},
        side: { reflect: true },
        delayDuration: { type: Number, attribute: 'delay-duration' },
        open: { type: Boolean, reflect: true },
    };

    declare content: string;
    declare side: Side;
    declare delayDuration: number;
    declare open: boolean;
    private readonly parts = new Set<TooltipPart>();

    constructor() {
        super();
        this.content = '';
        this.side = 'top';
        this.delayDuration = 200;
        this.open = false;
        adoptChildren<TooltipHost, TooltipPart>(this, TOOLTIP_REGISTER, (part) => this.register(part));
    }

    register(part: TooltipPart): void {
        this.parts.add(part);
    }

    unregister(part: TooltipPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.open = true;
    }

    hide(): void {
        this.open = false;
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>${this.content ? html`<ge-tooltip-content>${this.content}</ge-tooltip-content>` : nothing}`;
    }
}
