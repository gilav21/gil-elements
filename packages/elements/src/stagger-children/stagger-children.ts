import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './stagger-children.css?inline';

export type StaggerDirection = 'up' | 'down' | 'left' | 'right';

const OFFSETS: Record<StaggerDirection, { x: number; y: number }> = {
    up: { x: 0, y: 20 },
    down: { x: 0, y: -20 },
    left: { x: 20, y: 0 },
    right: { x: -20, y: 0 },
};

/**
 * Reveals its children one after another when it scrolls into view: each fades in, travels 20px into place and
 * deblurs. Only the element's direct children are animated, so a layout wrapper inside would make the whole group a
 * single item. The run happens once; call `play()` to replay it, for instance after the children change. Under
 * `prefers-reduced-motion: reduce`, or without `IntersectionObserver`, the children are simply shown.
 *
 * @attr {number} delay - Milliseconds to wait after it scrolls into view before the first child starts (default 0).
 * @attr {number} duration - Milliseconds each child takes (default 400).
 * @attr {'up' | 'down' | 'left' | 'right'} direction - The way the children travel towards: `up` starts them 20px low (default). Fixed offset, not RTL-aware.
 * @attr {number} stagger-delay - Milliseconds added between consecutive children (default 80); 0 reveals them all at once.
 * @slot - The children to reveal.
 */
export class GeStaggerChildren extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        delay: { type: Number },
        duration: { type: Number },
        direction: { reflect: true },
        staggerDelay: { attribute: 'stagger-delay', type: Number },
    };

    declare delay: number;
    declare duration: number;
    declare direction: StaggerDirection;
    declare staggerDelay: number;
    private observer: IntersectionObserver | null = null;
    private frame: number | null = null;
    private animations: Animation[] = [];

    constructor() {
        super();
        this.delay = 0;
        this.duration = 400;
        this.direction = 'up';
        this.staggerDelay = 80;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'stagger-children';
        this.arm();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // A frame still pending would create an observer after this teardown, with nothing left to disconnect it.
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.observer?.disconnect();
        this.observer = null;
        for (const animation of this.animations) animation.cancel();
        this.animations = [];
    }

    private arm(): void {
        if (prefersReducedMotion() || typeof globalThis.IntersectionObserver !== 'function') return;
        this.setOpacity('0');
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.observer = new IntersectionObserver(
                (entries) => {
                    if (!entries[0]?.isIntersecting) return;
                    this.run();
                    this.observer?.disconnect();
                },
                { threshold: 0.1 },
            );
            this.observer.observe(this);
        });
    }

    /** Replays the cascade: hides the children, cancels what is in flight and starts again. Under reduced motion every child is shown at once. */
    play(): void {
        for (const animation of this.animations) animation.cancel();
        this.animations = [];
        if (prefersReducedMotion()) {
            this.setOpacity('1');
            return;
        }
        this.setOpacity('0');
        this.run();
    }

    private setOpacity(value: string): void {
        for (const child of this.children) (child as HTMLElement).style.opacity = value;
    }

    private run(): void {
        const { x, y } = OFFSETS[this.direction] ?? OFFSETS.up;
        [...this.children].forEach((child, index) => {
            const animation = child.animate(
                [
                    { opacity: 0, transform: `translate(${x}px, ${y}px)`, filter: 'blur(4px)' },
                    { opacity: 1, transform: 'translate(0, 0)', filter: 'blur(0)' },
                ],
                { duration: this.duration, delay: this.delay + index * this.staggerDelay, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
            );
            this.animations.push(animation);
        });
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
