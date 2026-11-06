import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './morphing-text.css?inline';

/**
 * Cycles through phrases, each blurring out as the next blurs in. The element is sized to its longest phrase, so the
 * text around it never reflows mid-cycle. It takes the font of its surroundings: set `font-size` and `font-weight` on
 * it. With none or one phrase, or under `prefers-reduced-motion: reduce`, nothing morphs.
 *
 * @attr {number} interval - Milliseconds for a full swap cycle (default 3000). The timer ticks every half of it, and the blur lasts `min(interval / 3, 500)` ms. Changing it restarts the cycle.
 * @prop {string[]} texts - The phrases, in order; the list wraps.
 * @csspart text - Each of the two layers that trade places.
 */
export class GeMorphingText extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        texts: { attribute: false },
        interval: { type: Number },
        index: { state: true },
        visible: { state: true },
    };

    declare texts: string[];
    declare interval: number;
    declare protected index: number;
    declare protected visible: boolean;
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        this.texts = [];
        this.interval = 3000;
        this.index = 0;
        this.visible = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'morphing-text';
        if (this.hasUpdated) this.restart();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stop();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('texts') || changed.has('interval')) this.restart();
    }

    private stop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
    }

    private restart(): void {
        this.stop();
        this.index = 0;
        this.visible = true;
        if (prefersReducedMotion() || this.texts.length <= 1) return;
        this.timer = setInterval(() => {
            this.visible = !this.visible;
            if (this.visible) this.index = (this.index + 1) % this.texts.length;
        }, this.interval / 2);
    }

    protected override render() {
        const texts = this.texts;
        const current = texts.length > 0 ? (texts[this.index % texts.length] ?? '') : '';
        const next = texts.length > 0 ? (texts[(this.index + 1) % texts.length] ?? '') : '';
        const longest = texts.reduce((best, text) => (text.length > best.length ? text : best), '');
        const duration = `${Math.min(this.interval / 3, 500)}ms`;
        return html`<span class="text" part="text" data-visible=${this.visible ? 'true' : 'false'} style="transition-duration:${duration}">${current}</span
            ><span class="text" part="text" data-visible=${this.visible ? 'false' : 'true'} style="transition-duration:${duration}">${next}</span
            ><span class="size">${longest}</span>`;
    }
}
