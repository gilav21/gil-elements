import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './magnetic.css?inline';

/**
 * Pulls whatever it wraps towards the pointer while the pointer is over it and near its centre, then eases it back.
 * The element itself moves, so it is `display: inline-block` (a transform does nothing to an inline box). The distance
 * is measured from the element's current, already moved, centre. Under `prefers-reduced-motion: reduce` it stays put.
 *
 * @attr {number} strength - How far it moves towards the pointer, as a fraction of the distance between them. Defaults to 0.3.
 * @attr {number} radius - Pointer distance in px, from the element's centre, within which it is pulled. Defaults to 200.
 * @attr {number} smoothing - Easing time in milliseconds for the movement. Defaults to 150.
 * @slot - The content that moves.
 */
export class GeMagnetic extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        strength: { type: Number, reflect: true },
        radius: { type: Number, reflect: true },
        smoothing: { type: Number, reflect: true },
    };

    declare strength: number;
    declare radius: number;
    declare smoothing: number;

    constructor() {
        super();
        this.strength = 0.3;
        this.radius = 200;
        this.smoothing = 150;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('mousemove', this.follow, { passive: true });
        this.addEventListener('mouseleave', this.release);
        this.style.transform = 'translate(0px, 0px)';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('mousemove', this.follow);
        this.removeEventListener('mouseleave', this.release);
    }

    protected override updated(): void {
        this.style.transition = `transform ${this.smoothing}ms ease-out`;
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    private readonly follow = (event: MouseEvent): void => {
        if (prefersReducedMotion()) return;
        const rect = this.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        this.style.transform = Math.hypot(dx, dy) < this.radius ? `translate(${dx * this.strength}px, ${dy * this.strength}px)` : 'translate(0px, 0px)';
    };

    private readonly release = (): void => {
        this.style.transform = 'translate(0px, 0px)';
    };
}
