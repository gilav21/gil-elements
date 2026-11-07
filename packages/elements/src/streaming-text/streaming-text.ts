import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './streaming-text.css?inline';

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

/**
 * Types text out as it arrives, for a reply that is still streaming in. While each new `text` still starts with the
 * previous one, typing carries on from where it was; a value that does not is a new message and starts again from empty.
 * Newlines and runs of spaces are kept.
 *
 * @fires complete - The shown text has caught up with `text`. Once per typing run, so a stream that keeps appending fires again each time it drains; under `prefers-reduced-motion: reduce` the full text shows and it fires at once.
 * @attr {string} text - The full text so far.
 * @attr {number} speed - Milliseconds between characters. Defaults to 30; read when a run starts, so a change applies to the next run.
 * @attr {boolean} show-cursor - Show a pulsing bar after the text while it types. On by default; `show-cursor="false"` hides it. Decoration only.
 * @csspart base - The text container.
 */
export class GeStreamingText extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        text: { type: String },
        speed: { type: Number },
        showCursor: { attribute: 'show-cursor', converter: defaultTrue },
        shown: { state: true },
        typing: { state: true },
    };

    declare text: string;
    declare speed: number;
    declare showCursor: boolean;
    declare shown: string;
    declare typing: boolean;

    private timer: ReturnType<typeof setInterval> | null = null;
    private lastInput = '';

    constructor() {
        super();
        this.text = '';
        this.speed = 30;
        this.showCursor = true;
        this.shown = '';
        this.typing = false;
    }

    protected override render() {
        return html`<span class="base" part="base" data-slot="streaming-text">${this.shown}</span>${this.showCursor && this.typing ? html`<span class="cursor" aria-hidden="true">|</span>` : nothing}`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('text')) this.follow();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stop();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated && this.shown !== this.text) this.follow();
    }

    private follow(): void {
        // A text that does not extend the last one is a new message.
        if (!this.text.startsWith(this.lastInput)) {
            this.shown = '';
            this.lastInput = '';
        }
        this.lastInput = this.text;
        this.start();
    }

    private start(): void {
        if (this.timer !== null) return;
        if (prefersReducedMotion()) {
            this.shown = this.text;
            this.dispatchEvent(new CustomEvent('complete', { bubbles: true, composed: true }));
            return;
        }
        this.typing = true;
        this.timer = setInterval(() => this.step(), this.speed);
    }

    private step(): void {
        if (this.shown.length < this.text.length) {
            this.shown += this.text.charAt(this.shown.length);
            return;
        }
        this.stop();
        this.dispatchEvent(new CustomEvent('complete', { bubbles: true, composed: true }));
    }

    private stop(): void {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
        this.typing = false;
    }
}
