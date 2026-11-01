import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import { stepFrom } from '../shared/numeric-step.js';
import css from './number-input.css?inline';

export type NumberInputVariant = 'outline' | 'underline' | 'ghost';

/** `null` for an empty or unparsable field, so "no value" is never confused with 0. */
function parse(raw: string): number | null {
    if (raw.trim() === '') return null;
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
}

/**
 * A number field with stepping.
 *
 * Arrow Up and Down step by `step` (an off-grid value first lands on the next grid point), and so does
 * the mouse wheel while the field has focus. Typing is free; on blur the value is clamped to
 * `min` and `max`. An empty field is `null`, which steps from 0.
 *
 * @fires input - Each time the value changes: typing, stepping or clamping.
 * @fires change - When a change is committed: blur or Enter after typing, a step, or a clamp.
 * @attr {number} value - Current value; absent or empty means no value.
 * @attr {number} min - Lowest value reachable by stepping, and what blur clamps up to.
 * @attr {number} max - Highest value reachable by stepping, and what blur clamps down to.
 * @attr {number} step - Step size. Defaults to `1`.
 * @attr {string} placeholder - Hint shown while empty. Defaults to `0`.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Blocks editing and dims the field.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} locale - BCP 47 tag the browser uses for the decimal separator it accepts. Defaults to the page language.
 * @attr {string} aria-label - Accessible name; forwarded to the inner input.
 * @attr {string} aria-labelledby - Space-separated ids in the host's tree; resolved to elements for the inner input.
 * @csspart input - The native number input.
 * @cssprop --density-input - Height and padding multiplier; falls back to `--density`.
 */
export class GeNumberInput extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        value: {
            reflect: true,
            converter: {
                fromAttribute: (attribute: string | null): number | null => (attribute === null ? null : parse(attribute)),
                toAttribute: (value: number | null): string | null => (value === null ? null : String(value)),
            },
        },
        min: { type: Number },
        max: { type: Number },
        step: { type: Number },
        placeholder: {},
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        locale: {},
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        fieldsetDisabled: { state: true },
    };

    declare value: number | null;
    declare min: number | undefined;
    declare max: number | undefined;
    declare step: number;
    declare placeholder: string;
    declare variant: NumberInputVariant;
    declare disabled: boolean;
    declare name: string;
    declare locale: string;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare fieldsetDisabled: boolean;

    private readonly field = createRef<HTMLInputElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: number | null;

    constructor() {
        super();
        this.value = null;
        this.min = undefined;
        this.max = undefined;
        this.step = 1;
        this.placeholder = '0';
        this.variant = 'outline';
        this.disabled = false;
        this.name = '';
        this.locale = '';
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The native input inside the shadow root. */
    get inner(): HTMLInputElement | undefined {
        return this.field.value;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    /** Step up once, as the Up arrow does. */
    increment(): void {
        this.stepBy(1);
    }

    /** Step down once, as the Down arrow does. */
    decrement(): void {
        this.stepBy(-1);
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value === null ? '' : String(this.value));
    }

    protected override updated(changed: PropertyValues<this>): void {
        const input = this.inner;
        if (!input) return;
        // Rewriting the field while the user is mid-number ("1." or "-") would erase what they typed: only write when the field disagrees.
        if (parse(input.value) !== this.value) input.value = this.value === null ? '' : String(this.value);
        if (changed.has('ariaLabelledby')) input.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
    }

    protected override render() {
        return html`<div class=${this.isDisabled ? 'wrap disabled' : 'wrap'} data-slot="number-input" aria-disabled=${this.isDisabled ? 'true' : nothing} @focusout=${this.onBlur}>
            <input
                ${ref(this.field)}
                part="input"
                data-slot="input"
                type="number"
                placeholder=${this.placeholder}
                lang=${ifDefined(this.locale || undefined)}
                aria-label=${ifDefined(this.ariaLabel ?? undefined)}
                min=${ifDefined(this.min)}
                max=${ifDefined(this.max)}
                step=${this.step}
                ?disabled=${this.isDisabled}
                @input=${this.onInput}
                @change=${this.onChange}
                @keydown=${this.onKeydown}
                @wheel=${this.onWheel}
            />
        </div>`;
    }

    private readonly onInput = (event: Event) => {
        this.value = parse((event.target as HTMLInputElement).value);
    };

    // The native change event is not composed, so it never leaves the shadow root; the host fires its own.
    private readonly onChange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private readonly onBlur = () => {
        const clamped = this.clamp(this.value);
        if (clamped !== this.value) this.commit(clamped);
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        this.stepBy(event.key === 'ArrowUp' ? 1 : -1);
    };

    private readonly onWheel = (event: WheelEvent) => {
        if (this.shadowRoot?.activeElement !== this.inner || event.deltaY === 0) return;
        event.preventDefault();
        this.stepBy(event.deltaY < 0 ? 1 : -1);
    };

    private stepBy(direction: 1 | -1): void {
        if (this.isDisabled) return;
        const next = stepFrom(this.value ?? 0, direction, 1, { min: this.min, max: this.max, step: this.step });
        if (next !== this.value) this.commit(next);
    }

    private clamp(value: number | null): number | null {
        if (value === null) return null;
        const floor = this.min === undefined ? value : Math.max(value, this.min);
        return this.max === undefined ? floor : Math.min(floor, this.max);
    }

    /** Applies a change the user made by stepping or clamping, and announces it. */
    private commit(next: number | null): void {
        this.value = next;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }
}
