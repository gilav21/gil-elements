import { html, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import css from './number-ticker-digit.css?inline';

const DIGIT = /^\d$/;

/**
 * One character of a `ge-number-ticker`, in a cell 0.6em wide and 1em high. A digit that replaces a digit rolls over with a
 * vertical slide from the previous one; every other change (to or from a separator, decimal point or minus sign) is swapped
 * at once. The first value sets the starting state without animating.
 *
 * @attr {string} digit - The character to show.
 */
export class GeNumberTickerDigit extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        digit: { type: String },
        previous: { state: true },
    };

    declare digit: string;
    declare previous: string;

    private readonly column = createRef<HTMLElement>();
    private lastValue = '';
    private initialized = false;
    private animation: Animation | null = null;
    private rollFrom: string | null = null;

    constructor() {
        super();
        this.digit = '';
        this.previous = '';
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (!changed.has('digit')) return;
        const current = this.digit;
        if (!this.initialized) {
            this.initialized = true;
            this.lastValue = current;
            this.previous = current;
            return;
        }
        if (current === this.lastValue) return;
        // A roll still running is cut short: it shows its destination, which is what the next roll starts from.
        this.animation?.cancel();
        this.animation = null;
        if (DIGIT.test(current) && DIGIT.test(this.lastValue)) {
            this.previous = this.lastValue;
            this.rollFrom = this.lastValue;
        } else {
            this.previous = current;
        }
        this.lastValue = current;
    }

    protected override render() {
        if (!DIGIT.test(this.digit)) return html`<span class="cell">${this.digit}</span>`;
        return html`<div ${ref(this.column)} class="column" data-slot="number-ticker-digit-column"><span class="cell">${this.previous}</span><span class="cell">${this.digit}</span></div>`;
    }

    protected override updated(): void {
        if (this.rollFrom === null) return;
        this.rollFrom = null;
        const column = this.column.value;
        if (!column) return;
        const current = this.digit;
        const animation = column.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-50%)' }], { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
        this.animation = animation;
        animation.onfinish = () => {
            if (this.animation !== animation) return;
            this.animation = null;
            this.previous = current;
            animation.cancel();
        };
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.animation?.cancel();
        this.animation = null;
    }

    /** True when the cell shows something other than a plain digit. */
    protected get isDigit(): boolean {
        return DIGIT.test(this.digit);
    }
}
