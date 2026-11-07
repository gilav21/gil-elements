import { html, unsafeCSS } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './gradient-text.css?inline';

export type GradientDirection = 'to right' | 'to left' | 'to bottom' | 'to top';

/**
 * Text painted with a gradient that sweeps back and forth. The glyphs are transparent and the gradient shows through them,
 * so a text colour has no effect; the gradient is sized to 200% so it can be panned.
 *
 * @attr {string} direction - Axis of the gradient: `to right` (default), `to left`, `to bottom` or `to top`. The sweep always pans horizontally, so a vertical gradient shimmers rather than scrolls.
 * @attr {number} speed - Seconds for one back-and-forth sweep, read on every frame so changing it retimes the sweep. Defaults to 3. Under `prefers-reduced-motion: reduce` the gradient stays still.
 * @prop {string[]} colors - Gradient stops in order, as any CSS colours, spread evenly; at least two to blend. Defaults to a coral, teal, blue, green set.
 * @csspart text - The element that carries the gradient.
 */
export class GeGradientText extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        colors: { attribute: false },
        speed: { type: Number },
        direction: { type: String },
    };

    declare colors: string[];
    declare speed: number;
    declare direction: GradientDirection;

    private readonly text = createRef<HTMLElement>();
    private frame: number | null = null;
    private startedAt = 0;

    constructor() {
        super();
        this.colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
        this.speed = 3;
        this.direction = 'to right';
    }

    protected override render() {
        return html`<span ${ref(this.text)} class="text" part="text" data-slot="gradient-text" style=${`background-image:linear-gradient(${this.direction}, ${this.colors.join(', ')})`}><slot></slot></span>`;
    }

    protected override firstUpdated(): void {
        this.start();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated) this.start();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
    }

    private start(): void {
        if (this.frame !== null || prefersReducedMotion()) return;
        this.startedAt = performance.now();
        this.frame = requestAnimationFrame(this.sweep);
    }

    private readonly sweep = (): void => {
        const duration = this.speed * 1000;
        const progress = ((performance.now() - this.startedAt) % duration) / duration;
        const position = Math.sin(progress * Math.PI * 2) * 50 + 50;
        const text = this.text.value;
        if (text) text.style.backgroundPosition = `${position}% 50%`;
        this.frame = requestAnimationFrame(this.sweep);
    };
}
