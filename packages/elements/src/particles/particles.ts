import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './particles.css?inline';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
const NO_POINTER = -1000;

/**
 * A field of drifting dots joined by faint lines, drawn on a canvas that fills the element. The element is absolutely
 * positioned over its nearest positioned ancestor, so put it in a `position: relative` box and stack your content
 * above it. Under `prefers-reduced-motion: reduce` nothing is drawn.
 *
 * Every pair of particles is tested for a line each frame, so cost grows with the square of `count`: keep it modest on large surfaces.
 * Particles are seeded once, when the element first has an area; later resizes scale the existing field instead of reseeding it.
 *
 * @attr {number} count - Particles seeded across the field. Defaults to 50.
 * @attr {string} color - Colour of dots and lines. `currentColor` (default) and any `var(...)` resolve once against the element's `color`; a literal CSS colour is used as is.
 * @attr {number} speed - Maximum initial velocity in px per frame on each axis; every particle gets a random value in `±speed / 2`. Defaults to 0.5.
 * @attr {number} connect-distance - Distance in px within which two particles are joined, fading out towards it; 0 draws dots only. Defaults to 120.
 * @attr {boolean} mouse-interaction - The pointer repels nearby particles. On by default (`="false"` turns it off). While on, the element captures pointer events, which can block clicks on content behind it; it has no effect on touch-only devices.
 */
export class GeParticles extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        count: { type: Number, reflect: true },
        color: { type: String, reflect: true },
        speed: { type: Number, reflect: true },
        connectDistance: { type: Number, attribute: 'connect-distance', reflect: true },
        mouseInteraction: { attribute: 'mouse-interaction', converter: defaultTrue, reflect: true },
    };

    declare count: number;
    declare color: string;
    declare speed: number;
    declare connectDistance: number;
    declare mouseInteraction: boolean;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private particles: Particle[] = [];
    /** Size the particles are currently laid out in; 0 until the canvas first has an area. */
    private fieldWidth = 0;
    private fieldHeight = 0;
    private frameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private pointerX = NO_POINTER;
    private pointerY = NO_POINTER;
    private resolvedColor = '#888888';

    constructor() {
        super();
        this.count = 50;
        this.color = 'currentColor';
        this.speed = 0.5;
        this.connectDistance = 120;
        this.mouseInteraction = true;
    }

    protected override render() {
        return html`<canvas part="canvas" data-slot="particles"></canvas>`;
    }

    protected override firstUpdated(): void {
        this.start();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('mousemove', this.track, { passive: true });
        this.addEventListener('mouseleave', this.forget);
        if (this.hasUpdated) this.start();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('mousemove', this.track);
        this.removeEventListener('mouseleave', this.forget);
        this.stop();
    }

    private start(): void {
        if (prefersReducedMotion() || this.frameId !== null) return;
        this.canvas = this.renderRoot.querySelector('canvas');
        this.ctx = this.canvas?.getContext('2d') ?? null;
        if (!this.canvas || !this.ctx) return;

        this.resolveColor();
        this.syncCanvasSize();
        this.layout();
        this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { this.syncCanvasSize(); this.layout(); }) : null;
        this.resizeObserver?.observe(this);
        this.frameId = requestAnimationFrame(this.frame);
    }

    private stop(): void {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }

    private readonly track = (event: MouseEvent): void => {
        if (!this.mouseInteraction) return;
        const rect = this.getBoundingClientRect();
        this.pointerX = event.clientX - rect.left;
        this.pointerY = event.clientY - rect.top;
    };

    private readonly forget = (): void => {
        this.pointerX = NO_POINTER;
        this.pointerY = NO_POINTER;
    };

    private resolveColor(): void {
        const raw = this.color;
        this.resolvedColor = raw === 'currentColor' || raw.includes('var(') ? getComputedStyle(this).color || '#888888' : raw;
    }

    /** Mirrors the element's size onto the canvas, zero included: a skipped zero would leave the browser's 300x150 default. */
    private syncCanvasSize(): void {
        if (!this.canvas) return;
        this.canvas.width = this.clientWidth;
        this.canvas.height = this.clientHeight;
    }

    /** Seeds the field the first time the canvas has an area and scales it on every later resize, so a shrink cannot strand particles outside the edges. A zero size leaves the layout alone. */
    private layout(): void {
        if (!this.canvas) return;
        const { width, height } = this.canvas;
        if (width === 0 || height === 0) return;
        if (this.fieldWidth === 0) {
            this.seed(width, height);
        } else {
            const sx = width / this.fieldWidth;
            const sy = height / this.fieldHeight;
            for (const p of this.particles) {
                p.x *= sx;
                p.y *= sy;
            }
        }
        this.fieldWidth = width;
        this.fieldHeight = height;
    }

    private seed(width: number, height: number): void {
        this.particles = Array.from({ length: Math.max(0, this.count) }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * this.speed,
            vy: (Math.random() - 0.5) * this.speed,
            radius: 1 + Math.random() * 2,
        }));
    }

    private readonly frame = (): void => {
        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;
        const { width, height } = canvas;
        if (width > 0 && height > 0) {
            ctx.clearRect(0, 0, width, height);
            this.moveAndDraw(ctx, width, height);
            this.drawLinks(ctx);
            ctx.globalAlpha = 1;
        }
        this.frameId = requestAnimationFrame(this.frame);
    };

    private moveAndDraw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const repel = this.mouseInteraction && this.pointerX > -999;
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            if (repel) {
                const dx = this.pointerX - p.x;
                const dy = this.pointerY - p.y;
                if (Math.hypot(dx, dy) < 100) {
                    p.vx -= dx * 0.002;
                    p.vy -= dy * 0.002;
                }
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.resolvedColor;
            ctx.globalAlpha = 0.6;
            ctx.fill();
        }
    }

    private drawLinks(ctx: CanvasRenderingContext2D): void {
        const reach = this.connectDistance;
        if (reach <= 0) return;
        const { particles } = this;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i]!;
                const b = particles[j]!;
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist >= reach) continue;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = this.resolvedColor;
                ctx.globalAlpha = 0.3 * (1 - dist / reach);
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }
}
