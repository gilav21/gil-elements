import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import css from './currency-input.css?inline';
import { currencyScale, formatCurrency, formatEditable, parseCurrency, roundToCurrency, toMinorUnits } from './currency-input.format.js';

export type CurrencyInputVariant = 'outline' | 'underline' | 'ghost';

/**
 * An amount of money, written the way the reader's locale writes it.
 *
 * `value` is in major units: `12.34` is twelve dollars thirty-four, `null` is empty. While the field has focus it shows
 * a plain editable number (no symbol, no grouping, the locale's decimal separator) so formatting never moves the caret;
 * on blur it rounds to the currency's own decimals, clamps to `min` and `max`, and shows the full locale formatting.
 * Pasted text such as `€1.234,50` is read back, including Arabic-Indic digits.
 *
 * @fires input - Each time the value changes while typing, and when blur rounds or clamps it.
 * @fires change - When editing ends with a different value than it began with.
 * @attr {number} value - The amount in major units; absent or unreadable means no value.
 * @attr {string} currency - ISO 4217 code. Defaults to `USD`. Sets the symbol and the decimal places (JPY none, KWD three).
 * @attr {string} locale - BCP 47 tag the amount is written in. Defaults to the page language, then `en`.
 * @attr {number} min - Lower bound, applied on blur so typing is never interrupted.
 * @attr {number} max - Upper bound, applied on blur.
 * @attr {string} placeholder - Hint shown while empty.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Blocks editing and dims the field.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name. Defaults to `Amount`.
 * @attr {string} aria-labelledby - Space-separated ids in the host's tree; resolved to elements for the inner input.
 * @csspart input - The text input.
 * @cssprop --density-input - Height and padding multiplier; falls back to `--density`.
 */
export class GeCurrencyInput extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        value: {
            reflect: true,
            converter: {
                fromAttribute: (attribute: string | null): number | null => (attribute === null || attribute.trim() === '' || Number.isNaN(Number(attribute)) ? null : Number(attribute)),
                toAttribute: (value: number | null): string | null => (value === null ? null : String(value)),
            },
        },
        currency: {},
        locale: {},
        min: { type: Number },
        max: { type: Number },
        placeholder: {},
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        fieldsetDisabled: { state: true },
        editing: { state: true },
    };

    declare value: number | null;
    declare currency: string;
    declare locale: string;
    declare min: number | undefined;
    declare max: number | undefined;
    declare placeholder: string;
    declare variant: CurrencyInputVariant;
    declare disabled: boolean;
    declare name: string;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare fieldsetDisabled: boolean;
    /** What the person has typed while the field has focus; `null` at rest. */
    declare editing: string | null;

    private readonly field = createRef<HTMLInputElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: number | null;
    private valueAtFocus: number | null = null;

    constructor() {
        super();
        this.value = null;
        this.currency = 'USD';
        this.locale = '';
        this.min = undefined;
        this.max = undefined;
        this.placeholder = '';
        this.variant = 'outline';
        this.disabled = false;
        this.name = '';
        this.ariaLabel = 'Amount';
        this.ariaLabelledby = null;
        this.fieldsetDisabled = false;
        this.editing = null;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The native input inside the shadow root. */
    get inner(): HTMLInputElement | undefined {
        return this.field.value;
    }

    /** The locale in use: the attribute, else the page language, else `en`. */
    get resolvedLocale(): string {
        return this.locale || document.documentElement.lang || 'en';
    }

    /** Decimal places of the currency: 2 for USD, 0 for JPY, 3 for KWD. */
    get scale(): number {
        return currencyScale(this.resolvedLocale, this.currency);
    }

    /** The amount in cents, sen or fils, as a whole number; `null` when empty. */
    get minorUnits(): number | null {
        return this.value === null ? null : toMinorUnits(this.value, this.resolvedLocale, this.currency);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue ?? null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value === null ? '' : String(this.value));
    }

    protected override updated(changed: PropertyValues<this>): void {
        const input = this.inner;
        if (input && changed.has('ariaLabelledby')) input.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
    }

    private get display(): string {
        if (this.editing !== null) return this.editing;
        return this.value === null ? '' : formatCurrency(this.value, this.resolvedLocale, this.currency);
    }

    protected override render() {
        return html`<div class=${this.isDisabled ? 'wrap disabled' : 'wrap'} data-slot="currency-input" data-variant=${this.variant} aria-disabled=${this.isDisabled ? 'true' : nothing} @focusin=${this.onFocus} @focusout=${this.onBlur}>
            <input
                ${ref(this.field)}
                part="input"
                data-slot="input"
                type="text"
                inputmode="decimal"
                placeholder=${this.placeholder}
                lang=${this.resolvedLocale}
                aria-label=${ifDefined(this.ariaLabel ?? undefined)}
                .value=${live(this.display)}
                ?disabled=${this.isDisabled}
                @input=${this.onInput}
            />
        </div>`;
    }

    private readonly onInput = (event: Event) => {
        const raw = (event.target as HTMLInputElement).value;
        this.editing = raw;
        // The native input event is composed and already reaches listeners on the host, so it is not re-dispatched here.
        this.value = parseCurrency(raw, this.resolvedLocale, this.currency);
    };

    private readonly onFocus = () => {
        this.valueAtFocus = this.value;
        this.editing = this.value === null ? '' : formatEditable(this.value, this.resolvedLocale, this.currency);
    };

    /** Editing is over: round to the currency's scale, clamp, and show the formatted amount. */
    private readonly onBlur = () => {
        this.editing = null;
        if (this.value !== null) {
            const settled = this.clamp(roundToCurrency(this.value, this.resolvedLocale, this.currency));
            if (settled !== this.value) {
                this.value = settled;
                this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            }
        }
        if (this.value !== this.valueAtFocus) this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private clamp(value: number): number {
        const floor = this.min === undefined ? value : Math.max(value, this.min);
        return this.max === undefined ? floor : Math.min(floor, this.max);
    }
}
