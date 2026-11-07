import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './shine-border.css?inline';

/**
 * Wraps its content in a rim of colour that turns around it. The element shrinks to its content, so give it a `width`
 * to make it wider. The content sits on the page background, inside a rim `border-width` pixels thick, and takes the
 * same `border-radius`, so set that to match the card you wrap. Under `prefers-reduced-motion: reduce` the rim is painted
 * once at 0° and never turns.
 *
 * @attr {number} duration - Seconds for one full turn (default 3). Read on every frame, so it can be changed live.
 * @attr {number} border-width - Rim thickness in pixels (default 2); it eats into the box rather than growing it.
 * @attr {number} border-radius - Outer corner radius in pixels (default 8).
 * @prop {string[]} colors - Stops of the conic gradient (default `#A07CFE`, `#FE8FB5`, `#FFBE7B`). The first and last meet, so repeat the first at the end to hide the seam.
 * @slot - The content inside the rim.
 * @csspart rim - The gradient wrapper.
 * @csspart content - The surface the content sits on.
 */
export class GeShineBorder extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        colors: { attribute: false },
        duration: { type: Number },
        borderWidth: { attribute: 'border-width', type: Number },
        borderRadius: { attribute: 'border-radius', type: Number },
    };

    declare colors: string[];
    declare duration: number;
    declare borderWidth: number;
    declare borderRadius: number;
    private frame: number | null = null;
    private startedAt = 0;

    constructor() {
        super();
        this.colors = ['#A07CFE', '#FE8FB5', '#FFBE7B'];
        this.duration = 3;
        this.borderWidth = 2;
        this.borderRadius = 8;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'shine-border';
        if (this.hasUpdated) this.begin();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    protected override firstUpdated(): void {
        this.begin();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('colors') || changed.has('borderWidth') || changed.has('borderRadius')) this.paint(this.currentAngle());
    }

    private begin(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.paint(0);
        if (prefersReducedMotion()) return;
        this.startedAt = performance.now();
        const tick = (): void => {
            this.paint(this.currentAngle());
            this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
    }

    private currentAngle(): number {
        if (this.frame === null) return 0;
        const durationMs = this.duration * 1000;
        return (((performance.now() - this.startedAt) % durationMs) / durationMs) * 360;
    }

    private paint(angle: number): void {
        const rim = this.renderRoot.querySelector<HTMLElement>('.rim');
        if (!rim) return;
        rim.style.background = `conic-gradient(from ${angle}deg, ${this.colors.join(', ')})`;
        rim.style.padding = `${this.borderWidth}px`;
        rim.style.borderRadius = `${this.borderRadius}px`;
    }

    protected override render() {
        return html`<div class="rim" part="rim"><div class="content" part="content"><slot></slot></div></div>`;
    }
}
