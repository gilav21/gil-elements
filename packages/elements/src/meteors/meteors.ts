import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './meteors.css?inline';

interface Meteor {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    headSize: number;
    trailLength: number;
    opacity: number;
    maxOpacity: number;
    fadeIn: boolean;
}

export type MeteorSpeed = 'slow' | 'medium' | 'fast';
const SPEED: Record<MeteorSpeed, number> = { slow: 0.5, medium: 1, fast: 2 };

/**
 * Shooting stars streaking across a canvas that fills the element. It is absolutely placed over its nearest positioned
 * ancestor and click-through, so put it in a `position: relative` box and stack your content above it. Each meteor that
 * leaves the box is respawned at once, so `count` is a steady population. Under `prefers-reduced-motion: reduce`
 * nothing is drawn.
 *
 * @attr {number} count - Meteors alive at once (default 20). Changing it starts a fresh sky.
 * @attr {'slow' | 'medium' | 'fast'} speed - Velocity multiplier of each new meteor: 0.5, 1 or 2 (default `medium`).
 * @attr {string} color - Any CSS colour, `white` by default. It is resolved once against the element, so a `var(...)` token it inherits works. Trail and glow are alpha gradients of it.
 */
export class GeMeteors extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        count: { type: Number, reflect: true },
        speed: { reflect: true },
        color: { reflect: true },
    };

    declare count: number;
    declare speed: MeteorSpeed;
    declare color: string;

    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private meteors: Meteor[] = [];
    private frameId: number | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private rgb = { r: 255, g: 255, b: 255 };

    constructor() {
        super();
        this.count = 20;
        this.speed = 'medium';
        this.color = 'white';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'meteors';
        if (this.hasUpdated) this.start();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stop();
    }

    protected override render() {
        return html`<canvas part="canvas"></canvas>`;
    }

    protected override firstUpdated(): void {
        this.start();
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (this.frameId === null) return;
        if (changed.has('color')) this.resolveColor();
        if (changed.has('count') && changed.get('count') !== undefined) this.populate();
    }

    private start(): void {
        if (prefersReducedMotion() || this.frameId !== null) return;
        this.canvas = this.renderRoot.querySelector('canvas');
        this.ctx = this.canvas?.getContext('2d') ?? null;
        if (!this.canvas || !this.ctx) return;
        this.resolveColor();
        this.syncCanvasSize();
        this.populate();
        this.resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
            this.syncCanvasSize();
            if (this.meteors.length === 0) this.populate();
        }) : null;
        this.resizeObserver?.observe(this);
        this.frameId = requestAnimationFrame(this.frame);
    }

    private stop(): void {
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
    }

    private resolveColor(): void {
        if (this.color === 'white') {
            this.rgb = { r: 255, g: 255, b: 255 };
            return;
        }
        const probe = document.createElement('div');
        probe.style.color = this.color;
        this.renderRoot.append(probe);
        const computed = getComputedStyle(probe).color;
        probe.remove();
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
        if (match) this.rgb = { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
    }

    private syncCanvasSize(): void {
        if (!this.canvas) return;
        const { clientWidth: width, clientHeight: height } = this;
        if (width > 0 && height > 0) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    private populate(): void {
        this.meteors = Array.from({ length: Math.max(0, this.count) }, () => this.spawn(true));
    }

    /** A meteor entering from the top edge (or, one time in three, the right edge); `scattered` puts it somewhere along its path already, so the sky is full from the first frame. */
    private spawn(scattered: boolean): Meteor {
        const width = this.canvas?.width ?? 800;
        const height = this.canvas?.height ?? 400;
        const multiplier = SPEED[this.speed] ?? 1;
        const angle = Math.PI * 0.78 + (Math.random() - 0.5) * 0.7;
        const velocity = (1 + Math.random() * 3) * multiplier;
        let x: number;
        let y: number;
        if (Math.random() > 0.3) {
            x = Math.random() * width * 1.4 - width * 0.1;
            y = -10 - Math.random() * 80;
        } else {
            x = width + 10 + Math.random() * 60;
            y = Math.random() * height * 0.5;
        }
        const meteor: Meteor = {
            x,
            y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            angle,
            headSize: 0.5 + Math.random() * 3.5,
            trailLength: 30 + Math.random() * 200,
            opacity: 0,
            maxOpacity: 0.5 + Math.random() * 0.5,
            fadeIn: true,
        };
        if (scattered) {
            const steps = (Math.max(width, height) * 1.2 * Math.random()) / velocity;
            meteor.x += meteor.vx * steps;
            meteor.y += meteor.vy * steps;
            meteor.opacity = meteor.maxOpacity;
            meteor.fadeIn = false;
        }
        return meteor;
    }

    private outOfBounds(meteor: Meteor): boolean {
        const width = this.canvas?.width ?? 800;
        const height = this.canvas?.height ?? 400;
        return meteor.x < -250 || meteor.x > width + 250 || meteor.y > height + 250 || meteor.y < -250;
    }

    private draw(ctx: CanvasRenderingContext2D, meteor: Meteor): void {
        const { r, g, b } = this.rgb;
        const opacity = meteor.opacity;
        const tailX = meteor.x - Math.cos(meteor.angle) * meteor.trailLength;
        const tailY = meteor.y - Math.sin(meteor.angle) * meteor.trailLength;

        const trail = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
        trail.addColorStop(0, `rgba(${r},${g},${b},${opacity * 0.9})`);
        trail.addColorStop(0.15, `rgba(${r},${g},${b},${opacity * 0.5})`);
        trail.addColorStop(0.5, `rgba(${r},${g},${b},${opacity * 0.15})`);
        trail.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = trail;
        ctx.lineWidth = meteor.headSize * 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        const glowRadius = meteor.headSize * 5;
        const glow = ctx.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, glowRadius);
        glow.addColorStop(0, `rgba(${r},${g},${b},${opacity * 0.8})`);
        glow.addColorStop(0.15, `rgba(${r},${g},${b},${opacity * 0.3})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(meteor.x, meteor.y, meteor.headSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
        ctx.fill();
    }

    private readonly frame = (): void => {
        if (!this.canvas || !this.ctx) return;
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        if (width === 0 || height === 0) {
            this.frameId = requestAnimationFrame(this.frame);
            return;
        }
        ctx.clearRect(0, 0, width, height);
        this.meteors.forEach((meteor, index) => {
            meteor.x += meteor.vx;
            meteor.y += meteor.vy;
            if (meteor.fadeIn) {
                meteor.opacity = Math.min(meteor.opacity + 0.04, meteor.maxOpacity);
                if (meteor.opacity >= meteor.maxOpacity) meteor.fadeIn = false;
            }
            if (this.outOfBounds(meteor)) {
                this.meteors[index] = this.spawn(false);
                return;
            }
            if (meteor.opacity > 0) this.draw(ctx, meteor);
        });
        this.frameId = requestAnimationFrame(this.frame);
    };
}
