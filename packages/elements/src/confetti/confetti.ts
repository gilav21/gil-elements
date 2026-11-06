import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './confetti.css?inline';

export interface ConfettiOptions {
    /** Number of particles to launch. Default 50. */
    particleCount?: number;
    /** Angle of the burst in degrees; 90 is up. Default 90. */
    angle?: number;
    /** Spread of the burst in degrees. Default 45. */
    spread?: number;
    /** Initial velocity. Default 25. */
    startVelocity?: number;
    /** How quickly particles lose speed; 1 is no decay. Default 0.9. */
    decay?: number;
    /** How fast particles fall. Default 0.05. */
    gravity?: number;
    /** Sideways drift per frame. Default 0. */
    drift?: number;
    /** Frames a particle lasts; controls duration, not speed. Default 800. */
    ticks?: number;
    /** Origin of the burst, x and y as 0 to 1 of the box. Default the centre. */
    origin?: { x: number; y: number };
    /** Particle colours. */
    colors?: string[];
    /** Particle shapes. Default both. */
    shapes?: ('square' | 'circle')[];
    /** Scale factor for particle size. Default 1. */
    scalar?: number;
    /** `z-index` of the canvas. Default 100. */
    zIndex?: number;
    /** Skip the burst under `prefers-reduced-motion: reduce`. Default true. */
    disableForReducedMotion?: boolean;
    /** `side-cannons` fires two bursts from the bottom corners. Default `default`. */
    variant?: 'default' | 'side-cannons';
}

type Shape = 'square' | 'circle';

interface Particle {
    x: number;
    y: number;
    wobble: number;
    wobbleSpeed: number;
    vx: number;
    vy: number;
    angle2D: number;
    tiltAngle: number;
    color: string;
    shape: Shape;
    tick: number;
    totalTicks: number;
    decay: number;
    drift: number;
    wobbleX: number;
    wobbleY: number;
    gravity: number;
    scalar: number;
}

const DEFAULT_COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

/**
 * A burst of confetti over the box it fills, drawn on a canvas that never takes pointer events. The element is the
 * box: `position: relative`, clipping, `display: block`, so give it the size and put your content in it. Call `fire()`,
 * or set `manual-trigger` to fire as it turns on (turn it off and on again for another burst).
 *
 * `0` is not a value for `particleCount`, `spread`, `startVelocity`, `decay`, `gravity`, `ticks` or `scalar`: it
 * falls back to the default, as in the Angular directive. Under `prefers-reduced-motion: reduce` a burst is skipped
 * unless `disableForReducedMotion` is false.
 *
 * @attr {boolean} manual-trigger - Fires a burst each time it turns on.
 * @prop {ConfettiOptions} options - Burst settings: count, spread, colours, physics, variant.
 * @slot - The content under the confetti.
 */
export class GeConfetti extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        manualTrigger: { type: Boolean, attribute: 'manual-trigger', reflect: true },
        options: { attribute: false },
    };

    declare manualTrigger: boolean;
    declare options: ConfettiOptions;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private particles: Particle[] = [];
    private frameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;

    constructor() {
        super();
        this.manualTrigger = false;
        this.options = {};
    }

    protected override render() {
        return html`<canvas part="canvas" style="z-index: ${this.options.zIndex ?? 100}"></canvas><slot></slot>`;
    }

    protected override firstUpdated(): void {
        this.canvas = this.renderRoot.querySelector('canvas');
        this.ctx = this.canvas?.getContext('2d') ?? null;
        this.resizeCanvas(this.getBoundingClientRect());
        this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
            for (const entry of entries) this.resizeCanvas(entry.contentRect);
        }) : null;
        this.resizeObserver?.observe(this);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('manualTrigger') && this.manualTrigger && changed.get('manualTrigger') !== undefined) this.fire();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.particles = [];
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated && !this.resizeObserver) this.firstUpdated();
    }

    /** Launches a burst with the current `options`. */
    fire(): void {
        if (!this.canvas || !this.ctx) return;
        const options = this.options;
        if (prefersReducedMotion() && (options.disableForReducedMotion ?? true)) return;
        if ((options.variant ?? 'default') === 'side-cannons') {
            this.launch({ ...options, origin: { x: 0, y: 1 }, angle: 60, spread: 55 });
            this.launch({ ...options, origin: { x: 1, y: 1 }, angle: 120, spread: 55 });
        } else {
            this.launch(options);
        }
        this.frameId ??= requestAnimationFrame(this.frame);
    }

    private resizeCanvas(rect: { width: number; height: number }): void {
        if (!this.canvas) return;
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    private launch(options: ConfettiOptions): void {
        const canvas = this.canvas;
        if (!canvas) return;
        const origin = options.origin ?? { x: 0.5, y: 0.5 };
        const settings = {
            angle: options.angle ?? 90,
            spread: options.spread || 45,
            startVelocity: options.startVelocity || 25,
            decay: options.decay || 0.9,
            gravity: options.gravity || 0.05,
            drift: options.drift ?? 0,
            ticks: options.ticks || 800,
            colors: options.colors ?? DEFAULT_COLORS,
            shapes: options.shapes ?? (['square', 'circle'] as Shape[]),
            scalar: options.scalar || 1,
        };
        for (let i = 0; i < (options.particleCount || 50); i++) {
            this.particles.push(this.particle(origin.x * canvas.width, origin.y * canvas.height, settings));
        }
    }

    private particle(x: number, y: number, s: { angle: number; spread: number; startVelocity: number; decay: number; gravity: number; drift: number; ticks: number; colors: string[]; shapes: Shape[]; scalar: number }): Particle {
        const angle = (s.angle * Math.PI) / 180 + (Math.random() - 0.5) * ((s.spread * Math.PI) / 180);
        const speed = s.startVelocity * 0.5 + Math.random() * s.startVelocity;
        return {
            x,
            y,
            wobble: Math.random() * 10,
            wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
            vx: speed * Math.cos(angle),
            vy: speed * -Math.sin(angle),
            angle2D: -angle + Math.PI / 2,
            tiltAngle: Math.random() * Math.PI,
            color: s.colors[Math.floor(Math.random() * s.colors.length)]!,
            shape: s.shapes[Math.floor(Math.random() * s.shapes.length)]!,
            tick: 0,
            totalTicks: s.ticks,
            decay: s.decay,
            drift: s.drift,
            wobbleX: 0,
            wobbleY: 0,
            gravity: s.gravity * 3,
            scalar: s.scalar,
        };
    }

    private readonly frame = (): void => {
        const { ctx, canvas } = this;
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.particles = this.particles.filter((p) => {
            this.advance(p);
            const opacity = 1 - p.tick / p.totalTicks;
            if (opacity <= 0 || p.y > canvas.height + 100) return false;
            this.draw(ctx, p, opacity);
            return true;
        });
        if (this.particles.length > 0) {
            this.frameId = requestAnimationFrame(this.frame);
        } else {
            this.frameId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    private advance(p: Particle): void {
        p.tick++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx = (p.vx + p.drift) * p.decay;
        p.vy = (p.vy + p.gravity) * p.decay;
        p.wobble += p.wobbleSpeed;
        p.wobbleX = p.x + 10 * p.scalar * Math.cos(p.wobble);
        p.wobbleY = p.y + 10 * p.scalar * Math.sin(p.wobble);
        p.tiltAngle += 0.1;
    }

    private draw(ctx: CanvasRenderingContext2D, p: Particle, opacity: number): void {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        if (p.shape === 'circle') {
            ctx.ellipse(p.x, p.y, Math.abs(p.wobbleX - p.x) * 0.6, Math.abs(p.wobbleY - p.y) * 0.6, 0, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle2D);
            ctx.scale(Math.cos(p.wobble), 1);
            ctx.fillRect(-5 * p.scalar, -5 * p.scalar, 10 * p.scalar, 10 * p.scalar);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
}
