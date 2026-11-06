import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './flip-text.css?inline';

/**
 * Text whose characters flip in one after another: each turns up from edge-on while it sharpens out of a blur. The
 * characters are flex items, so the text does not wrap; keep it short, or let the `base` part wrap. Splitting is by UTF-16
 * code unit, so emoji and other astral characters are torn apart; stick to BMP text. A space is shown as a no-break space.
 *
 * @attr {string} text - The text to animate.
 * @attr {number} delay - Milliseconds between consecutive characters; character `n` starts at `n * delay`. Defaults to 50.
 * @attr {number} duration - Milliseconds for one character's flip. Defaults to 500.
 * @csspart base - The inline-flex row of characters.
 */
export class GeFlipText extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        text: { type: String },
        delay: { type: Number },
        duration: { type: Number },
    };

    declare text: string;
    declare delay: number;
    declare duration: number;

    constructor() {
        super();
        this.text = '';
        this.delay = 50;
        this.duration = 500;
    }

    protected override render() {
        return html`<span class="base" part="base" data-slot="flip-text">${this.text.split('').map(
            (char, index) => html`<span class="char" style="animation-delay: ${index * this.delay}ms; animation-duration: ${this.duration}ms">${char === ' ' ? '\u00A0' : char}</span>`,
        )}</span>`;
    }

    /**
     * Plays the flip again. The CSS animation runs once as the characters are inserted, so this cancels what is running and
     * drives the same keyframes by hand. Under `prefers-reduced-motion: reduce` the characters are just left visible.
     */
    playAnimation(): void {
        const reduced = prefersReducedMotion();
        const characters = this.shadowRoot?.querySelectorAll<HTMLElement>('.char') ?? [];
        characters.forEach((char, index) => {
            for (const running of char.getAnimations()) running.cancel();
            if (reduced) {
                char.style.opacity = '1';
                return;
            }
            char.style.opacity = '0';
            char.animate(
                [
                    { opacity: 0, transform: 'rotateX(90deg)', filter: 'blur(4px)' },
                    { opacity: 1, transform: 'rotateX(0deg)', filter: 'blur(0)' },
                ],
                { duration: this.duration, delay: index * this.delay, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
            );
        });
    }
}
