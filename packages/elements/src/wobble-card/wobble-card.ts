import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './wobble-card.css?inline';

/**
 * A card that tilts towards the pointer. The tilt grows linearly from the centre to `intensity` degrees at the edges
 * and eases back flat when the pointer leaves. It is only the rounded, clipped, transformed shell: give it a
 * background, padding and shadow yourself. Touch-only devices never tilt it, and neither does
 * `prefers-reduced-motion: reduce`.
 *
 * @attr {number} intensity - Largest tilt in degrees (default 15). Read live; 0 keeps the card flat.
 * @attr {number} perspective - CSS `perspective` distance in pixels (default 1000); smaller exaggerates the tilt.
 * @slot - The card's content.
 */
export class GeWobbleCard extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        intensity: { type: Number },
        perspective: { type: Number },
        rotateX: { state: true },
        rotateY: { state: true },
    };

    declare intensity: number;
    declare perspective: number;
    declare protected rotateX: number;
    declare protected rotateY: number;

    constructor() {
        super();
        this.intensity = 15;
        this.perspective = 1000;
        this.rotateX = 0;
        this.rotateY = 0;
        this.addEventListener('mousemove', this.onMouseMove);
        this.addEventListener('mouseleave', this.onMouseLeave);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'wobble-card';
    }

    private readonly onMouseMove = (event: MouseEvent): void => {
        if (prefersReducedMotion()) return;
        const rect = this.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        this.rotateX = ((event.clientY - rect.top - centerY) / centerY) * -this.intensity;
        this.rotateY = ((event.clientX - rect.left - centerX) / centerX) * this.intensity;
    };

    private readonly onMouseLeave = (): void => {
        this.rotateX = 0;
        this.rotateY = 0;
    };

    protected override updated(): void {
        this.style.transform = `perspective(${this.perspective}px) rotateX(${this.rotateX}deg) rotateY(${this.rotateY}deg)`;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
