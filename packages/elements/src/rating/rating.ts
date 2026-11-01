import { html, svg, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { stepFrom } from '../shared/numeric-step.js';
import { isTouchDevice } from '../shared/touch.js';
import css from './rating.css?inline';

export type RatingSize = 'sm' | 'md' | 'lg';
export type RatingPrecision = 0.5 | 1;
type StarFill = 'full' | 'half' | 'empty';

const STAR = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2';

/**
 * A star rating.
 *
 * Mouse previews the rating on hover and commits on click; clicking the current value clears it to 0.
 * A finger can slide across the row. A visually hidden range input carries focus and the arrow keys,
 * so assistive technology sees a slider.
 *
 * @fires rating-change - When the user commits a rating (click, touch end or key); `detail` is the new value. Never fires on hover.
 * @fires input - Alongside `rating-change`, as a native control does.
 * @fires change - Alongside `rating-change`, as a native control does.
 * @attr {number} value - Committed rating, `0` for none.
 * @attr {number} max - Number of stars. Defaults to `5`.
 * @attr {0.5 | 1} precision - Smallest step: whole stars (default) or half stars.
 * @attr {boolean} readonly - Display only: full opacity, but no pointer or key handling.
 * @attr {boolean} disabled - Blocks interaction and dims the stars.
 * @attr {'sm' | 'md' | 'lg'} size - Star size: 16, 20 (default) or 24px.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name of the group. Defaults to `Rating`.
 * @attr {string} rate-label - Template for each star's name; `{n}` and `{total}` are replaced. Defaults to `Rate {n} out of {total}`.
 * @csspart star - Each star button.
 */
export class GeRating extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        value: { type: Number, reflect: true },
        max: { type: Number },
        precision: { type: Number },
        readonly: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
        size: { reflect: true },
        name: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        rateLabel: { attribute: 'rate-label' },
        hover: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare value: number;
    declare max: number;
    declare precision: RatingPrecision;
    declare readonly: boolean;
    declare disabled: boolean;
    declare size: RatingSize;
    declare name: string;
    declare ariaLabel: string | null;
    declare rateLabel: string;
    declare hover: number | null;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;
    private defaultValue?: number;

    constructor() {
        super();
        this.value = 0;
        this.max = 5;
        this.precision = 1;
        this.readonly = false;
        this.disabled = false;
        this.size = 'md';
        this.name = '';
        this.ariaLabel = null;
        this.rateLabel = 'Rate {n} out of {total}';
        this.hover = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    private get locked(): boolean {
        return this.isDisabled || this.readonly;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(String(this.value));
    }

    private get rtl(): boolean {
        return getComputedStyle(this).direction === 'rtl';
    }

    private get shown(): number {
        return this.hover ?? this.value;
    }

    private fillOf(starValue: number): StarFill {
        const current = this.shown;
        if (current >= starValue) return 'full';
        if (this.precision === 0.5 && current >= starValue - 0.5) return 'half';
        return 'empty';
    }

    /** The value under a pointer inside the star at `index`; the half is mirrored under right-to-left text. */
    private valueAt(clientX: number, star: Element, index: number): number {
        if (this.precision !== 0.5) return index + 1;
        const rect = star.getBoundingClientRect();
        const x = clientX - rect.left;
        const firstHalf = this.rtl ? x > rect.width / 2 : x < rect.width / 2;
        return index + (firstHalf ? 0.5 : 1);
    }

    private commit(next: number): void {
        this.value = next;
        this.dispatchEvent(new CustomEvent('rating-change', { detail: next, bubbles: true, composed: true }));
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /** Re-picking the current value is the clear gesture. */
    private pick(next: number): void {
        this.commit(this.value === next ? 0 : next);
    }

    private starAt(event: Event): { star: Element; index: number } | undefined {
        const star = (event.currentTarget as Element | null)?.closest('.star');
        if (!star) return undefined;
        return { star, index: Number((star as HTMLElement).dataset.index) };
    }

    private readonly onHover = (event: MouseEvent) => {
        if (isTouchDevice() || this.locked) return;
        const hit = this.starAt(event);
        if (hit) this.hover = this.valueAt(event.clientX, hit.star, hit.index);
    };

    private readonly onLeave = () => {
        if (!isTouchDevice()) this.hover = null;
    };

    private readonly onClick = (event: MouseEvent) => {
        if (this.locked) return;
        const hit = this.starAt(event);
        if (hit) this.pick(this.valueAt(event.clientX, hit.star, hit.index));
    };

    private readonly onTouchStart = (event: TouchEvent) => {
        if (this.locked) return;
        // Suppresses the synthetic mouse events that would commit a second time.
        event.preventDefault();
        const hit = this.starAt(event);
        if (hit) this.hover = hit.index + 1;
    };

    private readonly onTouchMove = (event: TouchEvent) => {
        if (this.locked) return;
        event.preventDefault();
        const touch = event.touches[0];
        if (!touch) return;
        const point = this.nearestStar(touch.clientX);
        if (point) this.hover = point;
    };

    private readonly onTouchEnd = (event: TouchEvent) => {
        if (this.locked) return;
        event.preventDefault();
        const previewed = this.hover;
        this.hover = null;
        if (previewed !== null) this.pick(previewed);
    };

    /** The star nearest a finger's X, so a drag keeps working past the star it started on. */
    private nearestStar(clientX: number): number | undefined {
        const stars = [...this.renderRoot.querySelectorAll('.star')];
        let best = -1;
        let bestDistance = Infinity;
        for (const [index, star] of stars.entries()) {
            const rect = star.getBoundingClientRect();
            const distance = Math.abs(clientX - (rect.left + rect.width / 2));
            if (distance < bestDistance) {
                bestDistance = distance;
                best = index;
            }
        }
        const nearest = stars[best];
        return nearest ? this.valueAt(clientX, nearest, best) : undefined;
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (this.locked) return;
        const next = this.keyTarget(event.key);
        if (next === undefined) return;
        event.preventDefault();
        this.commit(next);
    };

    private keyTarget(key: string): number | undefined {
        const grid = { min: 0, max: this.max, step: this.precision };
        const forward = this.rtl ? 'ArrowLeft' : 'ArrowRight';
        const backward = this.rtl ? 'ArrowRight' : 'ArrowLeft';
        if (key === forward || key === 'ArrowUp') return stepFrom(this.value, 1, 1, grid);
        if (key === backward || key === 'ArrowDown') return stepFrom(this.value, -1, 1, grid);
        if (key === 'Home') return 0;
        if (key === 'End') return this.max;
        return undefined;
    }

    private glyph(fill: StarFill, index: number) {
        if (fill === 'full') return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" aria-hidden="true"><polygon points=${STAR}></polygon></svg>`;
        if (fill === 'empty') return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" aria-hidden="true"><polygon points=${STAR}></polygon></svg>`;
        const [from, to] = this.rtl ? ['transparent', 'currentColor'] : ['currentColor', 'transparent'];
        return svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <defs><linearGradient id=${`half-${index}`}><stop offset="50%" stop-color=${from}></stop><stop offset="50%" stop-color=${to}></stop></linearGradient></defs>
            <polygon points=${STAR} fill=${`url(#half-${index})`}></polygon>
        </svg>`;
    }

    private starLabel(n: number): string {
        return this.rateLabel.replace('{n}', String(n)).replace('{total}', String(this.max));
    }

    protected override render() {
        const stars = Array.from({ length: this.max }, (...[, i]) => i);
        const rowClass = ['row', this.isDisabled ? 'disabled' : '', this.readonly ? 'readonly' : '', this.locked ? '' : 'interactive'].filter(Boolean).join(' ');
        return html`<div
            class=${rowClass}
            data-slot="rating"
            @mouseleave=${this.onLeave}
            @touchmove=${this.onTouchMove}
            @touchend=${this.onTouchEnd}
        >
            <input
                type="range"
                class="range"
                min="0"
                max=${this.max}
                step=${this.precision}
                .value=${String(this.value)}
                ?disabled=${this.locked}
                aria-label=${this.ariaLabel ?? 'Rating'}
                @keydown=${this.onKeydown}
            />
            ${stars.map((index) => {
                const fill = this.fillOf(index + 1);
                return html`<button
                    type="button"
                    part="star"
                    data-index=${index}
                    class=${fill === 'empty' ? 'star empty' : 'star lit'}
                    aria-label=${this.starLabel(index + 1)}
                    ?disabled=${this.locked}
                    @mousemove=${this.onHover}
                    @click=${this.onClick}
                    @touchstart=${this.onTouchStart}
                >
                    ${this.glyph(fill, index)}
                </button>`;
            })}
        </div>`;
    }
}
