import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './number-ticker.css?inline';

const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;

/**
 * A number that counts to its value, each digit rolling like an odometer. Every change of `value` restarts the tween from
 * whatever is on screen, so rapid updates chase the latest value instead of queueing; the first run counts up from 0.
 * Text takes the theme's foreground colour; set `color` on it for anything else.
 *
 * @attr {number} value - The number to count to.
 * @attr {string} direction - `up` or `down`. Accepted for parity and has no effect: the count always eases from what is showing to `value`.
 * @attr {number} delay - Seconds to wait before a count starts, on every change of `value`. Defaults to 0.
 * @attr {number} duration - Seconds a count takes, eased out so most of the movement comes first. Defaults to 1. Under `prefers-reduced-motion: reduce` the value snaps.
 * @attr {number} decimal-places - Decimals shown, always: the width does not jitter mid-count. Defaults to 0.
 * @attr {string} locale - BCP-47 tag for the digits' grouping and decimal separator; defaults to the page's `lang`, then `en`.
 */
export class GeNumberTicker extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { type: Number },
        direction: { type: String },
        delay: { type: Number },
        duration: { type: Number },
        decimalPlaces: { type: Number, attribute: 'decimal-places' },
        locale: { type: String },
        text: { state: true },
    };

    declare value: number;
    declare direction: 'up' | 'down';
    declare delay: number;
    declare duration: number;
    declare decimalPlaces: number;
    declare locale: string;
    declare text: string;

    private frame: number | null = null;
    private delayTimer: ReturnType<typeof setTimeout> | null = null;
    private startedAt: number | null = null;
    private from = 0;
    private to = 0;
    private current = 0;

    constructor() {
        super();
        this.value = 0;
        this.direction = 'up';
        this.delay = 0;
        this.duration = 1;
        this.decimalPlaces = 0;
        this.locale = '';
        this.text = '0';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        // Digits always read left to right, whatever the page does.
        if (!this.hasAttribute('dir')) this.setAttribute('dir', 'ltr');
        if (this.hasUpdated) this.run();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.halt();
    }

    protected override render() {
        return html`${this.text.split('').map((char) => html`<ge-number-ticker-digit digit=${char}></ge-number-ticker-digit>`)}`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('value') || changed.has('delay')) this.run();
        else if (changed.has('decimalPlaces') || changed.has('locale')) this.text = this.format(this.current);
    }

    private format(number: number): string {
        const options = { minimumFractionDigits: this.decimalPlaces, maximumFractionDigits: this.decimalPlaces };
        const tag = this.locale || (globalThis.document?.documentElement.lang ?? '') || 'en';
        try {
            return new Intl.NumberFormat(tag, options).format(number);
        } catch {
            return new Intl.NumberFormat('en', options).format(number);
        }
    }

    private halt(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        if (this.delayTimer !== null) clearTimeout(this.delayTimer);
        this.frame = null;
        this.delayTimer = null;
    }

    private run(): void {
        this.halt();
        this.to = this.value;
        this.from = this.current;
        if (prefersReducedMotion()) {
            this.current = this.value;
            this.from = this.value;
            this.text = this.format(this.value);
            return;
        }
        this.delayTimer = setTimeout(() => {
            this.delayTimer = null;
            this.startedAt = null;
            this.frame = requestAnimationFrame(this.tick);
        }, this.delay * 1000);
    }

    private readonly tick = (timestamp: number): void => {
        this.startedAt ??= timestamp;
        const progress = Math.min((timestamp - this.startedAt) / (this.duration * 1000), 1);
        this.current = this.from + (this.to - this.from) * easeOutCubic(progress);
        if (progress < 1) {
            this.text = this.format(this.current);
            this.frame = requestAnimationFrame(this.tick);
            return;
        }
        this.frame = null;
        this.current = this.to;
        this.from = this.to;
        this.text = this.format(this.to);
    };
}
