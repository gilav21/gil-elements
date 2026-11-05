import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './dock-item.css?inline';

/**
 * One icon of a dock. Put a `ge-dock-icon` (and optionally a `ge-dock-label`) inside it. The enclosing dock
 * rewrites its width as the pointer moves; the label shows while the item is hovered.
 *
 * @slot - `ge-dock-icon`, `ge-dock-label`, or a link or button laid over the item.
 * @attr {boolean} active - Shows the small "running" dot under the icon. Presentational only.
 * @csspart base - The square box that holds the icon.
 */
export class GeDockItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        active: { type: Boolean, reflect: true },
        bouncing: { type: Boolean, reflect: true },
    };

    declare active: boolean;
    declare bouncing: boolean;
    private bounceTimer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        super();
        this.active = false;
        this.bouncing = false;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.bounceTimer);
    }

    /** Plays the 750ms macOS-style bounce, e.g. to acknowledge a launch. Ignored while one is already running. */
    startBounce(): void {
        if (this.bouncing) return;
        this.bouncing = true;
        this.bounceTimer = setTimeout(() => {
            this.bouncing = false;
        }, 750);
    }

    /** Sets the item's width in px; the dock calls this on every animation frame of a hover. */
    updateWidth(width: number): void {
        this.style.setProperty('--ge-dock-width', `${width}px`);
    }

    /** The item's centre in viewport coordinates along `axis`: `'x'` for a horizontal dock, `'y'` for a vertical one. It reflects the current size, so sample it at rest. */
    getCenter(axis: 'x' | 'y' = 'x'): number {
        const bounds = this.getBoundingClientRect();
        return axis === 'y' ? bounds.y + bounds.height / 2 : bounds.x + bounds.width / 2;
    }

    protected override render() {
        return html`<div part="base" class="item" data-slot="dock-item"><slot></slot>${this.active ? html`<div class="dot"></div>` : nothing}</div>`;
    }
}
