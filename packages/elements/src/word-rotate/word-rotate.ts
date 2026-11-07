import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './word-rotate.css?inline';

/**
 * Cycles through words, each sliding up out of view as the next rises into its place. Every word is stacked in the same
 * box, so the element has no size of its own: give it a width and height (it clips what falls outside). With none or one
 * word, or under `prefers-reduced-motion: reduce`, nothing rotates.
 *
 * @attr {number} duration - Milliseconds each word stays before the next comes in. Defaults to 2000. Changing it, or the words, restarts the timer from the first word's turn.
 * @prop {string[]} words - The words, in order; the first is showing at the start and the list wraps.
 * @csspart word - Each stacked word.
 */
export class GeWordRotate extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        words: { attribute: false },
        duration: { type: Number },
        current: { state: true },
    };

    declare words: string[];
    declare duration: number;
    declare current: number;

    private timer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        this.words = [];
        this.duration = 2000;
        this.current = 0;
    }

    protected override render() {
        const count = this.words.length;
        return html`${this.words.map((word, index) => {
            const position = index === this.current ? 'current' : index === (this.current - 1 + count) % count ? 'previous' : 'next';
            return html`<span class="word" part="word" data-position=${position}>${word}</span>`;
        })}`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('words') || changed.has('duration')) this.restart();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stop();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated) this.restart();
    }

    private stop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
    }

    private restart(): void {
        this.stop();
        if (this.current >= this.words.length) this.current = 0;
        if (prefersReducedMotion() || this.words.length <= 1) return;
        this.timer = setInterval(() => {
            this.current = (this.current + 1) % this.words.length;
        }, this.duration);
    }
}
