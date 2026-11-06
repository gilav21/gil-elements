import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './text-reveal.css?inline';

/** HTML's collapsible whitespace; a no-break space is deliberately left out so it can join two words. */
const WHITESPACE_RUN = /[ \t\n\r\f]+/;

/**
 * A sentence that blurs in word by word. The text is split at runs of whitespace and every word is its own inline
 * block, so a line break can fall between two words but never inside one; leading, trailing and repeated whitespace
 * make no empty words, and a no-break space keeps its two words together. Plain text only: markup is escaped.
 *
 * @attr {string} text - The sentence to reveal.
 * @attr {number} delay - Milliseconds between consecutive words; word `n` starts at `n * delay`. Each word's own animation runs for a fixed 1s, so a large delay stretches the reveal. Defaults to 50. Under `prefers-reduced-motion: reduce` every word shows at once.
 * @csspart base - The flex-wrapped word container; set text size, alignment or `justify-content` on the host or here.
 */
export class GeTextReveal extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        text: { type: String, reflect: true },
        delay: { type: Number, reflect: true },
    };

    declare text: string;
    declare delay: number;

    constructor() {
        super();
        this.text = '';
        this.delay = 50;
    }

    protected override render() {
        const words = this.text.split(WHITESPACE_RUN).filter((word) => word !== '');
        return html`<div class="base" part="base" data-slot="text-reveal">${words.map(
            (word, index) => html`<span class="word" style="animation-delay: ${index * this.delay}ms">${word}&nbsp;</span>`,
        )}</div>`;
    }
}
