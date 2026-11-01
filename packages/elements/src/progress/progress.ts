import { html, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import css from './progress.css?inline';

/**
 * A progress bar.
 *
 * The visual fill is hidden from assistive technology; a visually hidden native `<progress>` carries the
 * value, so give the bar an accessible name with `aria-label` or `aria-labelledby` when no label sits beside it.
 * The fill is clamped to 0-100%, while the native element still reports out-of-range values as given.
 *
 * @attr {number} value - Current progress, in the same units as `max`. Defaults to 0.
 * @attr {number} max - Upper bound of `value`. Defaults to 100.
 * @attr {string} aria-label - Accessible name for the bar.
 * @attr {string} aria-labelledby - Id of an element in the host's tree that names the bar.
 * @attr {string} locale - BCP 47 tag for the spoken percentage. Defaults to the page language.
 * @csspart track - The trough.
 * @csspart fill - The filled part.
 */
export class GeProgress extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { type: Number },
        max: { type: Number },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        locale: {},
    };

    declare value: number;
    declare max: number;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare locale: string;

    private readonly native = createRef<HTMLProgressElement>();

    constructor() {
        super();
        this.value = 0;
        this.max = 100;
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.locale = '';
    }

    /** The fill width, clamped to 0-100. */
    get percentage(): number {
        return Math.min(100, Math.max(0, (this.value / this.max) * 100));
    }

    protected override updated(changed: PropertyValues<this>): void {
        const native = this.native.value;
        if (native && changed.has('ariaLabelledby')) native.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
    }

    protected override render() {
        const text = new Intl.NumberFormat(this.locale || document.documentElement.lang || undefined, { style: 'percent', maximumFractionDigits: 0 }).format(
            this.percentage / 100,
        );
        return html`<div class="track" part="track" data-slot="progress">
            <progress
                ${ref(this.native)}
                .value=${this.value}
                .max=${this.max}
                aria-valuetext=${text}
                aria-label=${ifDefined(this.ariaLabel ?? undefined)}
            ></progress>
            <div class="fill" part="fill" style="width:${this.percentage}%" aria-hidden="true"></div>
        </div>`;
    }
}
