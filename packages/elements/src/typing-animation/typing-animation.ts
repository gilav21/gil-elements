import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './typing-animation.css?inline';

type TypingState = 'typing' | 'pausing' | 'deleting' | 'waiting';

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };
/** The fixed gap between deleting one phrase and typing the next. */
const GAP_MS = 300;

/**
 * Types phrases out one character at a time, holds each, deletes it and goes on to the next. The typing is decoration: it
 * is hidden from assistive technology, which is given every phrase at once instead (an animation that starts empty would
 * otherwise leave a heading with no text, and announcing each keystroke would be unusable).
 *
 * @fires complete - The last phrase has been typed. Only happens with `loop="false"`; never for a looping run, nor under `prefers-reduced-motion: reduce`, where the first phrase is shown at once and nothing runs.
 * @attr {number} type-speed - Milliseconds between characters while typing. Defaults to 50; read for every character, so it can change live.
 * @attr {number} delete-speed - Milliseconds between characters while deleting. Defaults to 30.
 * @attr {number} pause-duration - Milliseconds a finished phrase stays before it is deleted. Defaults to 1500; a fixed 300ms gap follows the deletion.
 * @attr {boolean} loop - Go back to the first phrase after the last. On by default; `loop="false"` stops with the last phrase on screen.
 * @attr {boolean} cursor - Show the caret. On by default; it blinks while the run is idle between phrases and stays solid while characters move.
 * @prop {string[]} strings - The phrases, in order. Read afresh on every step, so the list may change mid-run; the run starts once it has at least one.
 * @csspart base - The inline wrapper of text and caret.
 * @csspart caret - The caret.
 */
export class GeTypingAnimation extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        strings: { attribute: false },
        typeSpeed: { type: Number, attribute: 'type-speed' },
        deleteSpeed: { type: Number, attribute: 'delete-speed' },
        pauseDuration: { type: Number, attribute: 'pause-duration' },
        loop: { converter: defaultTrue },
        cursor: { converter: defaultTrue },
        shown: { state: true },
        phase: { state: true },
    };

    declare strings: string[];
    declare typeSpeed: number;
    declare deleteSpeed: number;
    declare pauseDuration: number;
    declare loop: boolean;
    declare cursor: boolean;
    declare shown: string;
    declare phase: TypingState;

    private started = false;
    private stringIndex = 0;
    private charIndex = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super();
        this.strings = [];
        this.typeSpeed = 50;
        this.deleteSpeed = 30;
        this.pauseDuration = 1500;
        this.loop = true;
        this.cursor = true;
        this.shown = '';
        this.phase = 'typing';
    }

    protected override render() {
        // No whitespace between the parts: inline, it would show as a space before the caret.
        return html`<span class="base" part="base" data-slot="typing-animation"><span class="sr-only">${this.strings.join(', ')}</span><span aria-hidden="true">${this.shown}</span>${this.cursor ? html`<span class="caret" part="caret" aria-hidden="true" ?data-blink=${this.phase === 'pausing' || this.phase === 'waiting'}></span>` : nothing}</span>`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('strings') && !this.started) this.begin();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stop();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        // Re-attached after the run was stopped by a disconnect: pick it up where it was.
        if (this.hasUpdated && this.started && !prefersReducedMotion()) this.tick();
    }

    private begin(): void {
        if (this.strings.length === 0) return;
        this.started = true;
        if (prefersReducedMotion()) {
            this.shown = this.strings[0] ?? '';
            return;
        }
        this.tick();
    }

    private stop(): void {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
    }

    private later(ms: number): void {
        this.timer = setTimeout(() => this.tick(), ms);
    }

    private tick(): void {
        this.stop();
        const phrases = this.strings;
        const current = phrases[this.stringIndex];
        // The list was emptied (or shortened past the phrase being typed) mid-run: there is nothing to type.
        if (current === undefined) return;

        switch (this.phase) {
            case 'typing':
                this.type(current, phrases.length);
                break;
            case 'pausing':
                this.phase = 'deleting';
                this.tick();
                break;
            case 'deleting':
                this.erase(current, phrases.length);
                break;
            case 'waiting':
                this.phase = 'typing';
                this.tick();
                break;
        }
    }

    private type(current: string, count: number): void {
        if (this.charIndex < current.length) {
            this.charIndex++;
            this.shown = current.slice(0, this.charIndex);
            this.later(this.typeSpeed);
            return;
        }
        if (!this.loop && this.stringIndex === count - 1) {
            this.dispatchEvent(new CustomEvent('complete', { bubbles: true, composed: true }));
            return;
        }
        this.phase = 'pausing';
        this.later(this.pauseDuration);
    }

    private erase(current: string, count: number): void {
        if (this.charIndex > 0) {
            this.charIndex--;
            this.shown = current.slice(0, this.charIndex);
            this.later(this.deleteSpeed);
            return;
        }
        this.stringIndex = (this.stringIndex + 1) % count;
        this.phase = 'waiting';
        this.later(GAP_MS);
    }
}
