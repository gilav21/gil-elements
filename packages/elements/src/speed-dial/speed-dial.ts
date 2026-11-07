import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './speed-dial.css?inline';

export const SPEED_DIAL_REGISTER = 'ge-speed-dial-register';

export type SpeedDialType = 'linear' | 'circle' | 'semi-circle' | 'quarter-circle';
export type SpeedDialDirection = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

/** A part that re-renders when the dial opens, closes or is reconfigured. */
export interface SpeedDialPart extends HTMLElement {
    requestUpdate(): void;
}

/** What the parts of a speed dial need from it. */
export interface SpeedDialHost extends HTMLElement {
    readonly open: boolean;
    readonly type: SpeedDialType;
    readonly direction: SpeedDialDirection;
    readonly radius: number;
    readonly transitionDelay: number;
    /** Where `showAt` put the menu, in viewport coordinates, or `null` when it is anchored to the trigger. */
    readonly contextPosition: { x: number; y: number } | null;
    readonly isRepositioning: boolean;
    toggle(): void;
    show(): void;
    showAt(x: number, y: number): void;
    hide(): void;
    register(part: SpeedDialPart): void;
    unregister(part: SpeedDialPart): void;
}

/**
 * A floating action button with a pop-up menu of actions. Put a `ge-speed-dial-trigger` and a `ge-speed-dial-menu`
 * of `ge-speed-dial-item`s inside it. The menu fans out in a line or along an arc, and can also open at the pointer
 * (see `ge-speed-dial-context-trigger`). A click outside closes it.
 *
 * @slot - The trigger, menu, optional mask and context trigger.
 * @attr {'linear' | 'circle' | 'semi-circle' | 'quarter-circle'} type - The layout of the open menu.
 * @attr {string} direction - Where the menu opens: `up`, `down`, `left`, `right` for linear and semi-circle, the four diagonals for quarter-circle; ignored by circle.
 * @attr {number} radius - Distance in px from the trigger centre to each item on an arc.
 * @attr {number} transition-delay - Per-item stagger in ms.
 * @attr {boolean} disabled - Blocks `toggle`, `show` and `showAt`; `hide` still works.
 * @fires visible-change - On every `show`, `showAt` and `hide`; `detail` is the new state. `hide` also runs for each click outside, so `false` can repeat.
 * @fires shown - After the menu opens.
 * @fires hidden - On every `hide`.
 */
export class GeSpeedDial extends UiElement implements SpeedDialHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        type: { reflect: true },
        direction: { reflect: true },
        radius: { type: Number },
        transitionDelay: { type: Number, attribute: 'transition-delay' },
        disabled: { type: Boolean, reflect: true },
        open: { state: true },
        contextPosition: { state: true },
        isRepositioning: { state: true },
    };

    declare type: SpeedDialType;
    declare direction: SpeedDialDirection;
    declare radius: number;
    declare transitionDelay: number;
    declare disabled: boolean;
    declare open: boolean;
    declare contextPosition: { x: number; y: number } | null;
    declare isRepositioning: boolean;

    private readonly parts = new Set<SpeedDialPart>();
    private repositionTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        super();
        this.type = 'linear';
        this.direction = 'up';
        this.radius = 80;
        this.transitionDelay = 80;
        this.disabled = false;
        this.open = false;
        this.contextPosition = null;
        this.isRepositioning = false;
        adoptChildren<SpeedDialHost, SpeedDialPart>(this, SPEED_DIAL_REGISTER, (part) => this.register(part));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        clearTimeout(this.repositionTimer);
    }

    register(part: SpeedDialPart): void {
        this.parts.add(part);
    }

    unregister(part: SpeedDialPart): void {
        this.parts.delete(part);
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (!event.composedPath().includes(this)) this.hide();
    };

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    /** Opens when closed and closes when open. A no-op while `disabled`. */
    toggle(): void {
        if (this.disabled) return;
        if (this.open) this.hide();
        else this.show();
    }

    /** Opens the menu anchored to the trigger, clearing any position left by `showAt`. A no-op while `disabled`. */
    show(): void {
        if (this.disabled) return;
        this.contextPosition = null;
        this.open = true;
        this.emit('visible-change', true);
        this.emit('shown');
    }

    /**
     * Opens the menu at a viewport point instead of at the trigger. The point is clamped so the whole menu stays on
     * screen, and opening is deferred one task (closed, repositioned, re-opened) so the items jump to the new origin
     * instead of animating across the screen. A no-op while `disabled`.
     */
    showAt(x: number, y: number): void {
        if (this.disabled) return;
        const clamped = this.clamp(x, y);
        this.open = false;
        this.isRepositioning = true;
        this.contextPosition = clamped;
        clearTimeout(this.repositionTimer);
        this.repositionTimer = setTimeout(() => {
            this.isRepositioning = false;
            this.open = true;
            this.emit('visible-change', true);
            this.emit('shown');
        }, 0);
    }

    private clamp(x: number, y: number): { x: number; y: number } {
        const reach = this.radius + 24;
        const vw = globalThis.innerWidth;
        const vh = globalThis.innerHeight;
        if (this.type !== 'linear') {
            return {
                x: Math.max(reach + 8, Math.min(x, vw - reach - 8)),
                y: Math.max(reach + 8, Math.min(y, vh - reach - 8)),
            };
        }
        let [cx, cy] = [x, y];
        if (this.direction.includes('right')) cx = Math.min(cx, vw - reach - 8);
        if (this.direction.includes('left')) cx = Math.max(cx, reach + 8);
        if (this.direction.includes('down')) cy = Math.min(cy, vh - reach - 8);
        if (this.direction.includes('up')) cy = Math.max(cy, reach + 8);
        return { x: cx, y: cy };
    }

    /** Closes the menu. Not gated by `disabled`, and it runs for every click outside the dial. */
    hide(): void {
        this.open = false;
        this.emit('visible-change', false);
        this.emit('hidden');
    }

    protected override willUpdate(changed: PropertyValues<GeSpeedDial>): void {
        if (changed.has('open')) this.dataset.state = this.open ? 'open' : 'closed';
        this.dataset.slot = 'speed-dial';
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
