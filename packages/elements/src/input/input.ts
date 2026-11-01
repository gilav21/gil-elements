import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import css from './input.css?inline';

export type InputVariant = 'outline' | 'underline' | 'ghost';

const X = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg>`;
const RING = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`;

let nextId = 0;

/**
 * A text input.
 *
 * The native `<input>` lives in the shadow root, so everything the browser normally does for an
 * input (typing, selection, IME, autofill, the keyboard) stays native. What cannot cross the shadow
 * boundary is an ID reference, so `aria-labelledby` and `aria-describedby` on the host are resolved
 * to elements here and handed to the inner input, which is how a `ge-label` names it.
 *
 * @fires input - On every edit; the native event, which already crosses the shadow boundary.
 * @fires change - When an edit is committed (blur or Enter), re-fired from the host because the native one does not leave the shadow root.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - Current text.
 * @attr {string} type - Native input type: `text`, `email`, `password`, ... Defaults to `text`.
 * @attr {string} placeholder - Hint shown while empty. Not a label.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Blocks editing and dims the field.
 * @attr {boolean} loading - Show a spinner at the end of the field.
 * @attr {boolean} skeleton - Show a placeholder instead of the field.
 * @attr {boolean} autofocus - Focus the field when it first renders.
 * @attr {boolean} clearable - Show a clear button once the field has a value.
 * @attr {boolean} floating - Float `label` above the field on focus or value. Ignored without `label`.
 * @attr {string} label - Text of the floating label.
 * @attr {string} inputmode - Which on-screen keyboard a touch device offers.
 * @attr {string} prefix - Text before the field, such as a currency symbol.
 * @attr {string} suffix - Text after the field.
 * @attr {string} aria-label - Accessible name; forwarded to the inner input.
 * @attr {string} aria-labelledby - Space-separated ids in the host's tree; resolved to elements for the inner input.
 * @attr {string} aria-describedby - Space-separated ids in the host's tree; resolved to elements for the inner input.
 * @csspart input - The native input element.
 * @csspart label - The floating label; style it with `::part(label)`.
 * @cssprop --density-input - Height and padding multiplier for this component; falls back to `--density`.
 */
export class GeInput extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        name: { reflect: true },
        value: {},
        type: { reflect: true },
        placeholder: {},
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        loading: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        autofocus: { type: Boolean },
        clearable: { type: Boolean, reflect: true },
        floating: { type: Boolean, reflect: true },
        label: {},
        inputMode: { attribute: 'inputmode' },
        prefix: { reflect: true },
        suffix: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        ariaDescribedby: { attribute: 'aria-describedby' },
        focused: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: string;
    declare type: string;
    declare placeholder: string;
    declare variant: InputVariant;
    declare disabled: boolean;
    declare loading: boolean;
    declare skeleton: boolean;
    declare autofocus: boolean;
    declare clearable: boolean;
    declare floating: boolean;
    declare label: string;
    declare inputMode: string;
    declare prefix: string;
    declare suffix: string;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare ariaDescribedby: string | null;
    declare focused: boolean;
    declare fieldsetDisabled: boolean;

    private readonly input = createRef<HTMLInputElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: string;
    private readonly autoId = `ge-input-${++nextId}`;

    constructor() {
        super();
        this.name = '';
        this.value = '';
        this.type = 'text';
        this.placeholder = '';
        this.variant = 'outline';
        this.disabled = false;
        this.loading = false;
        this.skeleton = false;
        this.autofocus = false;
        this.clearable = false;
        this.floating = false;
        this.label = '';
        this.inputMode = '';
        this.prefix = '';
        this.suffix = '';
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.ariaDescribedby = null;
        this.focused = false;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** The native input inside the shadow root. */
    get inner(): HTMLInputElement | undefined {
        return this.input.value;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    protected override firstUpdated(): void {
        if (this.autofocus) this.inner?.focus();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('ariaLabelledby') || changed.has('ariaDescribedby')) this.resolveReferences();
    }

    private resolveReferences(): void {
        const input = this.inner;
        if (!input) return;
        input.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
        input.ariaDescribedByElements = resolveIdRefs(this, this.ariaDescribedby);
    }

    private get containerNeeded(): boolean {
        return Boolean(this.prefix || this.suffix) || this.clearable || this.loading;
    }

    private get floatingNeeded(): boolean {
        return this.floating && Boolean(this.label);
    }

    private get labelActive(): boolean {
        return this.focused || Boolean(this.value);
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        if (this.floatingNeeded) {
            return html`<div class="floating" data-slot="input-floating" data-variant=${this.variant}>
                ${this.field(this.labelActive ? this.placeholder : '')}
                <label
                    for=${this.autoId}
                    part="label"
                    class=${this.labelActive ? 'floating-label active' : 'floating-label'}
                    >${this.label}</label
                >
            </div>`;
        }
        if (this.containerNeeded) {
            return html`<div class="container" data-slot="input-container" ?data-disabled=${this.isDisabled}>
                ${this.prefix ? html`<span class="affix prefix">${this.prefix}</span>` : nothing}
                ${this.field(this.placeholder, true)}
                ${this.clearable && this.value
                    ? html`<button type="button" tabindex="-1" class="clear" aria-label="Clear" @click=${this.clear}>${X}</button>`
                    : nothing}
                ${this.loading ? html`<div class="busy"><output class="spinner" aria-label="Loading">${RING}</output></div>` : nothing}
                ${this.suffix && !this.loading ? html`<span class="affix suffix">${this.suffix}</span>` : nothing}
            </div>`;
        }
        return this.field(this.placeholder);
    }

    private field(placeholder: string, inner = false) {
        return html`<input
            ${ref(this.input)}
            part="input"
            data-slot="input"
            class=${inner ? 'inner' : 'plain'}
            id=${this.autoId}
            type=${this.type}
            .value=${this.value}
            placeholder=${placeholder}
            ?disabled=${this.isDisabled}
            aria-label=${ifDefined(this.ariaLabel ?? undefined)}
            inputmode=${ifDefined(this.inputMode || undefined)}
            @input=${this.onInput}
            @change=${this.onChange}
            @focus=${() => (this.focused = true)}
            @blur=${() => (this.focused = false)}
        />`;
    }

    private readonly onInput = (event: Event) => {
        this.value = (event.target as HTMLInputElement).value;
    };

    // The native change event is not composed, so it never leaves the shadow root; the host fires its own.
    private readonly onChange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    private readonly clear = () => {
        this.value = '';
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
        this.inner?.focus();
    };
}
