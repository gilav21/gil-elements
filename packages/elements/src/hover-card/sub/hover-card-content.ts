import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { type Align, clippingRect, flippedSide, horizontalNudge } from '../../shared/anchor.js';
import { findParent } from '../../shared/compound.js';
import { HOVER_CARD_REGISTER, type HoverCardHost } from '../hover-card.js';
import css from './hover-card-content.css?inline';

type CardSide = 'top' | 'bottom';

interface Placement {
    side: CardSide;
    nudge: number;
}

/**
 * The card. It draws nothing until the hover card is open.
 *
 * Simple mode: set `heading` (and optionally `description`) for a title and text above anything you slot. Custom
 * mode: slot the whole body yourself. `heading` is not called `title` because that is a native attribute, which
 * the browser would show as a tooltip over the whole card.
 *
 * Moving the pointer from the trigger onto the card keeps it open. If it would overflow its clipping box it is
 * nudged back in sideways and flipped to the other side.
 *
 * @slot - The card body.
 * @attr {string} side - Preferred side: `bottom` (default) or `top`.
 * @attr {string} align - Alignment against the trigger: `start`, `center` (default) or `end`.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode text under the title; only shown when `heading` is set.
 * @csspart panel - The card.
 * @cssprop --density-popover - Spacing multiplier for the padding; falls back to `--density`.
 */
export class GeHoverCardContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        side: { reflect: true },
        align: { reflect: true },
        heading: {},
        description: {},
        placement: { state: true },
    };

    declare side: CardSide;
    declare align: Align;
    declare heading: string;
    declare description: string;
    declare placement: Placement;
    private card?: HoverCardHost;
    private wasOpen = false;
    private frame = 0;

    constructor() {
        super();
        this.side = 'bottom';
        this.align = 'center';
        this.heading = '';
        this.description = '';
        this.placement = { side: 'bottom', nudge: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.card = findParent<HoverCardHost, GeHoverCardContent>(this, HOVER_CARD_REGISTER);
        this.card?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        cancelAnimationFrame(this.frame);
        this.card?.unregister(this);
        this.card = undefined;
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        const open = this.card?.open ?? false;
        const opened = open && !this.wasOpen;
        this.wasOpen = open;
        if (opened || (open && changed.has('side'))) this.reset();
    }

    private reset(): void {
        this.placement = { side: this.side, nudge: 0 };
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            const panel = this.shadowRoot?.querySelector<HTMLElement>('.panel');
            const anchor = this.closest('ge-hover-card')?.getBoundingClientRect();
            if (!panel || !anchor) return;
            const rect = panel.getBoundingClientRect();
            const bounds = clippingRect(panel);
            const next = { side: flippedSide(this.side, rect, anchor, bounds), nudge: horizontalNudge(rect, bounds) };
            if (next.side !== this.placement.side || next.nudge !== this.placement.nudge) this.placement = next;
        });
    }

    private readonly onEnter = () => this.card?.cancelClose();
    private readonly onLeave = () => this.card?.hide();

    protected override render() {
        if (!this.card?.open) return nothing;
        const { side, nudge } = this.placement;
        return html`<div
            class="panel"
            part="panel"
            data-slot="hover-card-content"
            data-state="open"
            data-side=${side}
            data-align=${this.align}
            style=${nudge === 0 ? nothing : `transform:translateX(${nudge}px)`}
            @mouseenter=${this.onEnter}
            @mouseleave=${this.onLeave}
          >
            ${this.heading ? html`<div class="simple" data-slot="hover-card-simple-content"><h4>${this.heading}</h4>${this.description ? html`<p>${this.description}</p>` : nothing}</div>` : nothing}
            <slot></slot>
          </div>`;
    }
}
