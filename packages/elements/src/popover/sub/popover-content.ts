import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { type Align, type Side, clippingRect, flippedSide, flippedSideByRoom, horizontalNudge, verticalNudge } from '../../shared/anchor.js';
import { findParent } from '../../shared/compound.js';
import { deepActive } from '../../shared/overlay.js';
import { POPOVER_REGISTER, type PopoverHost } from '../popover.js';
import css from './popover-content.css?inline';

type Strategy = 'absolute' | 'fixed';

interface Placement {
    side: Side;
    nudge: number;
    /** Only a fixed panel is moved along y: an absolute one stays against its host. */
    nudgeY: number;
}

/**
 * The panel. It draws nothing until the popover is open.
 *
 * With `strategy="absolute"` (the default) the panel sits inside the popover's own box, which is simplest but an
 * ancestor with `overflow: hidden` can clip it. `strategy="fixed"` promotes it to the browser's top layer, so it
 * stays above dialogs and any `z-index`.
 *
 * @slot - The panel's content.
 * @attr {string} side - Edge of the trigger to open from: `top`, `right`, `bottom` (default) or `left`. A preference: `top` and `bottom` flip when there is no room.
 * @attr {string} align - Alignment along that edge: `start`, `center` (default) or `end`.
 * @attr {number} side-offset - Gap in pixels between the trigger and the panel. Defaults to 4.
 * @attr {boolean} no-collisions - Pins the panel to `side` and `align` and accepts clipping.
 * @attr {boolean} no-restore-focus - Does not return focus to the trigger on close.
 * @attr {string} strategy - `absolute` (default) or `fixed`.
 * @csspart panel - The panel.
 * @cssprop --popover-offset - The gap to the trigger. `side-offset` supplies it; set it on the `panel` part (`ge-popover-content::part(panel)`) to override that. It is not inherited, so a value on an ancestor reaches no other popover.
 * @cssprop --trigger-width - The trigger's width, set on the open panel so it can match it (`width: var(--trigger-width)`).
 * @cssprop --density-popover - Spacing multiplier for this component; falls back to `--density`.
 */
export class GePopoverContent extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        side: { reflect: true },
        align: { reflect: true },
        sideOffset: { type: Number, attribute: 'side-offset' },
        noCollisions: { type: Boolean, attribute: 'no-collisions' },
        noRestoreFocus: { type: Boolean, attribute: 'no-restore-focus' },
        strategy: { reflect: true },
        placement: { state: true },
        triggerWidth: { state: true },
    };

    declare side: Side;
    declare align: Align;
    declare sideOffset: number;
    declare noCollisions: boolean;
    declare noRestoreFocus: boolean;
    declare strategy: Strategy;
    declare placement: Placement;
    declare triggerWidth: number | undefined;
    protected owner?: PopoverHost;
    private wasOpen = false;
    private frame = 0;
    private stopTracking?: () => void;

    constructor() {
        super();
        this.side = 'bottom';
        this.align = 'center';
        this.sideOffset = 4;
        this.noCollisions = false;
        this.noRestoreFocus = false;
        this.strategy = 'absolute';
        this.placement = { side: 'bottom', nudge: 0, nudgeY: 0 };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.owner = findParent<PopoverHost, GePopoverContent>(this, POPOVER_REGISTER);
        this.owner?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        cancelAnimationFrame(this.frame);
        this.stopTracking?.();
        this.owner?.unregister(this);
        this.owner = undefined;
    }

    private get panel(): HTMLElement | null {
        return this.shadowRoot?.querySelector<HTMLElement>('.panel') ?? null;
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        const open = this.owner?.open ?? false;
        const opened = open && !this.wasOpen;
        const closed = !open && this.wasOpen;
        this.wasOpen = open;
        if (opened) this.onOpened();
        else if (closed) this.onClosed();
        else if (open && (changed.has('side') || changed.has('align') || changed.has('strategy') || changed.has('sideOffset'))) this.reset();
        else if (open && this.strategy === 'fixed' && changed.has('placement') && (changed.get('placement') as Placement | undefined)?.side !== this.placement.side) this.place();
    }

    private onOpened(): void {
        if (this.strategy === 'fixed') {
            this.panel?.showPopover();
            this.trackAnchor();
        }
        this.reset();
    }

    private onClosed(): void {
        cancelAnimationFrame(this.frame);
        this.stopTracking?.();
        this.stopTracking = undefined;
        // Focus that moved to another control belongs to the user; only reclaim it when it was lost with the panel.
        const active = deepActive(document);
        const lost = !active || active === document.body || this.contains(active);
        if (lost && !this.noRestoreFocus) this.owner?.triggerFocusTarget()?.focus();
    }

    /** Back to the preferred placement, then measured again once layout has settled. */
    private reset(): void {
        this.placement = { side: this.side, nudge: 0, nudgeY: 0 };
        this.place();
    }

    /**
     * Nudges and flips the panel back inside its clipping box. A flip re-renders the panel on the other side, so it is
     * measured again from `updated`; that second pass starts from the side it is on and trims what still overflows.
     */
    private place(): void {
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            const panel = this.panel;
            const anchor = this.owner?.triggerRect();
            if (!panel || !anchor) return;
            this.triggerWidth = anchor.width;
            if (this.noCollisions) return;
            const bounds = this.strategy === 'fixed' ? new DOMRect(0, 0, innerWidth, innerHeight) : clippingRect(panel);
            const rect = panel.getBoundingClientRect();
            const fixed = this.strategy === 'fixed';
            const current = this.placement.side;
            const side = this.nextSide(current, rect, anchor, bounds);
            const next: Placement = {
                side,
                nudge: this.placement.nudge + horizontalNudge(rect, bounds),
                nudgeY: this.placement.nudgeY + (fixed && side === current ? verticalNudge(rect, bounds) : 0),
            };
            if (next.side !== current || next.nudge !== this.placement.nudge || next.nudgeY !== this.placement.nudgeY) this.placement = next;
        });
    }

    /** The side to be on: a top or bottom panel flips when it overflows; a left or right one stays. */
    private nextSide(current: Side, rect: DOMRect, anchor: DOMRect, bounds: DOMRect): Side {
        if (current !== 'top' && current !== 'bottom') return current;
        if (this.strategy === 'fixed') return flippedSideByRoom(current, rect, anchor, bounds, this.sideOffset);
        // Judged from the preferred side every time, since no second pass follows a flip here.
        return flippedSide(this.side as 'top' | 'bottom', rect, anchor, bounds);
    }

    /** A top-layer panel is positioned in viewport coordinates, so it has to follow the trigger when the page moves. */
    private trackAnchor(): void {
        const follow = () => this.reset();
        globalThis.addEventListener('scroll', follow, { capture: true, passive: true });
        globalThis.addEventListener('resize', follow);
        this.stopTracking = () => {
            globalThis.removeEventListener('scroll', follow, { capture: true });
            globalThis.removeEventListener('resize', follow);
        };
    }

    protected override render() {
        if (!this.owner?.open) return nothing;
        const side = this.noCollisions ? this.side : this.placement.side;
        const nudge = this.noCollisions ? 0 : this.placement.nudge;
        const nudgeY = this.noCollisions ? 0 : this.placement.nudgeY;
        return html`<div
            class="panel"
            part="panel"
            popover=${this.strategy === 'fixed' ? 'manual' : nothing}
            data-slot="popover-content"
            data-state="open"
            data-side=${side}
            data-align=${this.align}
            data-strategy=${this.strategy}
            style=${this.panelStyle(side, nudge, nudgeY)}
          >${this.renderPanelBody()}</div>`;
    }

    /** What goes inside the panel; the default is the slotted content. */
    protected renderPanelBody() {
        return html`<slot></slot>`;
    }

    private panelStyle(side: Side, nudge: number, nudgeY: number): string {
        const width = this.triggerWidth ?? this.owner?.triggerRect()?.width;
        const vars = `--_offset:${this.sideOffset}px;` + (width === undefined ? '' : `--trigger-width:${width}px;`);
        const shift = nudge === 0 && nudgeY === 0 ? '' : `transform:translate(${nudge}px,${nudgeY}px);`;
        return vars + shift + (this.strategy === 'fixed' ? this.fixedAnchor(side) : '');
    }

    /** Viewport coordinates the panel hangs from; the CSS `translate` for `data-side` and `data-align` moves it off that point. */
    private fixedAnchor(side: Side): string {
        const anchor = this.owner?.triggerRect();
        if (!anchor) return '';
        const vertical = side === 'top' || side === 'bottom';
        const along = { start: anchor.left, center: anchor.left + anchor.width / 2, end: anchor.right }[this.align];
        const left = vertical ? along : { left: anchor.left, right: anchor.right }[side];
        const top = vertical ? { top: anchor.top, bottom: anchor.bottom }[side] : anchor.top;
        return `left:${left}px;top:${top}px;`;
    }
}
