import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { GePopover } from '../popover/popover.js';
import { applyMask } from '../input-mask/input-mask.js';
import type { InputGroupVariant } from '../input-group/input-group.js';
import css from './phone-input.css?inline';
import { DEFAULT_COUNTRIES, type PhoneCountry } from './phone-input.data.js';
import { resolvePhoneInputLocale, type PhoneInputLocale } from './phone-input.locales.js';

export type { PhoneCountry } from './phone-input.data.js';
export type PhoneInputVariant = InputGroupVariant;

const CHEVRON = html`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>`;

export function buildE164(dialCode: string, typed: string): string {
    const digits = typed.replaceAll(/\D/g, '');
    return digits ? `${dialCode}${digits}` : '';
}

/** The digits as the mask shows them; nothing typed shows nothing, not the mask's leading literal. */
function masked(raw: string, mask: string): string {
    return raw === '' ? '' : applyMask(raw, mask);
}

function findCountryByLongestDialCode(value: string, countries: readonly PhoneCountry[]): PhoneCountry | undefined {
    let best: PhoneCountry | undefined;
    for (const country of countries) {
        if (value.startsWith(country.dialCode) && country.dialCode.length > (best?.dialCode.length ?? 0)) best = country;
    }
    return best;
}

/** Splits `+15551234567` into a country (by the longest dial code that prefixes it) and the digits after it. */
export function parseE164(value: string, countries: readonly PhoneCountry[], current: PhoneCountry): { country: PhoneCountry; national: string } {
    if (!value.startsWith('+')) return { country: current, national: value };
    const match = findCountryByLongestDialCode(value, countries);
    if (!match) return { country: current, national: value };
    // A number under the current country's own dial code keeps that country: +1 is the US and Canada alike.
    if (match.dialCode === current.dialCode) return { country: current, national: value.slice(current.dialCode.length) };
    return { country: match, national: value.slice(match.dialCode.length) };
}

/**
 * An international phone number: a country picker (flag and dial code, in a searchable popover) beside a masked number field,
 * in one bordered row. The mask follows the chosen country, so characters that do not fit the format cannot be typed.
 *
 * `value` is E.164 (`+15551234567`), or empty. Setting it picks the country from the dial code. Choosing another country
 * clears the number, since digits typed under the old dial code are not valid under the new one, and pins the choice so later
 * `default-country` changes no longer override it.
 *
 * It is a `ge-popover` itself, so `open`, `show()` and `hide()` work as they do there. It takes part in forms: the E.164 value is
 * submitted under `name`.
 *
 * @fires input - Each time the user edits the number or picks a country.
 * @fires change - When the user's edit is committed: the number field loses focus after typing, or a country is picked.
 * @fires open-change - The country list opened or closed by the user; `detail` is the new state.
 * @attr {string} value - The number as E.164; empty for none.
 * @attr {string} default-country - ISO 3166-1 alpha-2 code of the initially selected country. Defaults to `US`.
 * @attr {string} placeholder - Overrides the country's example number.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Disables the country picker and the number field.
 * @attr {string} name - Field name; with it the E.164 value is submitted with the surrounding form.
 * @attr {string} locale - Locale id or object for the picker's wording; defaults to the page's `lang`, then `en`.
 * @prop {PhoneCountry[]} countries - `{ code, name, flag, dialCode, mask, placeholder? }` entries for the list. Defaults to 35 countries.
 * @prop {PhoneCountry} selectedCountry - The country in use (read-only).
 * @prop {string} nationalNumber - The digits typed after the dial code (read-only).
 */
export class GePhoneInput extends GePopover {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        ...GePopover.properties,
        value: { reflect: true },
        defaultCountry: { attribute: 'default-country' },
        placeholder: {},
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        locale: {},
        countries: { attribute: false },
        country: { state: true },
        national: { state: true },
        search: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare value: string | null;
    declare defaultCountry: string;
    declare placeholder: string | undefined;
    declare variant: PhoneInputVariant;
    declare disabled: boolean;
    declare name: string;
    declare locale: string | PhoneInputLocale;
    declare countries: PhoneCountry[];
    declare fieldsetDisabled: boolean;
    declare private country: PhoneCountry;
    /** The number as shown in the field, mask literals included. */
    declare private national: string;
    declare private search: string;

    private readonly internals?: ElementInternals;
    private defaultValue: string | null = null;
    private userPickedCountry = false;
    private emitted: string | null = null;

    constructor() {
        super();
        this.value = null;
        this.defaultCountry = 'US';
        this.placeholder = undefined;
        this.variant = 'outline';
        this.disabled = false;
        this.name = '';
        this.locale = '';
        this.countries = DEFAULT_COUNTRIES;
        this.fieldsetDisabled = false;
        this.country = DEFAULT_COUNTRIES[0]!;
        this.national = '';
        this.search = '';
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The country currently selected. */
    get selectedCountry(): PhoneCountry {
        return this.country;
    }

    /** The digits typed after the dial code, without the mask's literals. */
    get nationalNumber(): string {
        return this.national.replaceAll(/\D/g, '');
    }

    private get text(): PhoneInputLocale {
        return resolvePhoneInputLocale(this.locale);
    }

    private get filtered(): PhoneCountry[] {
        const query = this.search.toLowerCase();
        if (!query) return this.countries;
        return this.countries.filter((country) => country.name.toLowerCase().includes(query) || country.dialCode.includes(query));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'phone-input';
        this.defaultValue = this.value;
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    override show(): void {
        if (!this.isDisabled) super.show();
    }

    override toggle(): void {
        if (this.open) this.hide();
        else this.show();
    }

    private get triggerPart(): HTMLElement | null {
        return this.renderRoot.querySelector<HTMLElement>('ge-popover-trigger');
    }

    override triggerRect(): DOMRect | null {
        return this.triggerPart?.shadowRoot?.querySelector('[part="base"]')?.getBoundingClientRect() ?? null;
    }

    override triggerFocusTarget(): HTMLElement | null {
        return this.triggerPart?.querySelector<HTMLElement>('button') ?? null;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (!this.userPickedCountry && (changed.has('defaultCountry') || changed.has('countries'))) {
            this.country = this.countries.find((country) => country.code === this.defaultCountry) ?? this.countries[0] ?? DEFAULT_COUNTRIES[0]!;
            this.national = masked(this.nationalNumber, this.country.mask);
        }
        // A value the user's own typing produced is already what is on screen.
        if (changed.has('value') && this.value !== this.emitted) this.applyExternalValue(this.value ?? '');
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        super.updated(changed);
        this.internals?.setFormValue(this.value ?? '');
    }

    private applyExternalValue(value: string): void {
        if (!value) {
            this.national = '';
            return;
        }
        const { country, national } = parseE164(value, this.countries, this.country);
        this.country = country;
        this.national = masked(national, country.mask);
    }

    protected override render() {
        const text = this.text;
        const country = this.country;
        return html`<ge-input-group variant=${this.variant} ?disabled=${this.isDisabled} dir=${text.rtl ? 'rtl' : nothing} data-slot="phone-input-group">
            <ge-input-group-addon>
                <ge-popover-trigger>
                    <button type="button" class="trigger" part="trigger" ?disabled=${this.isDisabled} aria-expanded=${this.open ? 'true' : 'false'} aria-haspopup="listbox" aria-label=${`${country.name} ${country.dialCode}`}>
                        <span>${country.flag}</span>
                        <span class="dial">${country.dialCode}</span>
                        ${CHEVRON}
                    </button>
                </ge-popover-trigger>
                <ge-popover-content strategy="fixed" align="start">
                    <div dir=${text.rtl ? 'rtl' : nothing}>
                        <div class="search">
                            <input type="text" .value=${this.search} placeholder=${text.searchCountryPlaceholder} aria-label=${text.searchCountryPlaceholder} @input=${this.onSearch} />
                        </div>
                        <div class="list">
                            ${repeat(
                                this.filtered,
                                (item) => item.code,
                                (item) => html`<button type="button" class=${item.code === country.code ? 'row selected' : 'row'} @click=${() => this.pick(item)}>
                                    <span class="flag">${item.flag}</span>
                                    <span class="name">${item.name}</span>
                                    <span class="code">${item.dialCode}</span>
                                </button>`,
                            )}
                            ${this.filtered.length === 0 ? html`<p class="empty">${text.noCountryFound}</p>` : nothing}
                        </div>
                    </div>
                </ge-popover-content>
            </ge-input-group-addon>
            <ge-input-mask mask=${country.mask}>
                <ge-input-group-input type="tel" .value=${this.national} placeholder=${this.placeholder ?? country.placeholder ?? country.mask} ?disabled=${this.isDisabled} aria-label=${`${country.name} number`} @input=${this.onNumberInput} @change=${this.onNumberChange}></ge-input-group-input>
            </ge-input-mask>
        </ge-input-group>`;
    }

    private readonly onSearch = (event: Event) => {
        this.search = (event.target as HTMLInputElement).value;
    };

    private readonly onNumberInput = (event: Event) => {
        this.national = (event.target as HTMLInputElement & { value: string }).value;
        this.publish();
    };

    private readonly onNumberChange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private pick(country: PhoneCountry): void {
        this.userPickedCountry = true;
        this.country = country;
        this.search = '';
        this.national = '';
        this.publish();
        this.dispatchEvent(new Event('change', { bubbles: true }));
        this.hide();
    }

    /** The one path a user edit takes: rebuild the E.164 string and announce it. */
    private publish(): void {
        const e164 = buildE164(this.country.dialCode, this.national);
        this.emitted = e164;
        this.value = e164;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
}
