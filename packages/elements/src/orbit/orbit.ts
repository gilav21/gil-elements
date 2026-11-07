import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './orbit.css?inline';

/**
 * Carries its content around a circle. The element fills its positioned parent (which must be `position: relative`),
 * is click-through, and turns; the content sits `radius` pixels from the centre and keeps its own pointer events. Put
 * several in one parent with different `radius`, `duration` and `delay` for concentric rings. Under
 * `prefers-reduced-motion: reduce` nothing turns and the content rests at its starting angle.
 *
 * @attr {number} radius - Distance from the centre in pixels (default 100).
 * @attr {number} duration - Seconds per revolution (default 10).
 * @attr {number} delay - Seconds before it starts (default 0).
 * @attr {boolean} reverse - Turns the other way.
 * @slot - What travels around.
 */
export class GeOrbit extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        radius: { type: Number },
        duration: { type: Number },
        delay: { type: Number },
        reverse: { type: Boolean, reflect: true },
    };

    declare radius: number;
    declare duration: number;
    declare delay: number;
    declare reverse: boolean;
    private animation?: Animation;

    constructor() {
        super();
        this.radius = 100;
        this.duration = 10;
        this.delay = 0;
        this.reverse = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'orbit';
        if (this.hasUpdated) this.spin();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.animation?.cancel();
        this.animation = undefined;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('duration') || changed.has('delay') || changed.has('reverse') || this.animation === undefined) this.spin();
    }

    private spin(): void {
        this.animation?.cancel();
        this.animation = undefined;
        if (prefersReducedMotion()) return;
        this.animation = this.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: this.duration * 1000,
            iterations: Infinity,
            easing: 'linear',
            direction: this.reverse ? 'reverse' : 'normal',
            delay: this.delay * 1000,
        });
    }

    protected override render() {
        return html`<div class="item" style="transform:translate(-50%, -50%) translateX(${this.radius}px)"><slot></slot></div>`;
    }
}
