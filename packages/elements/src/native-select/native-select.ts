import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import css from './native-select.css?inline';

export type NativeSelectSize = 'default' | 'sm';

const CHEVRON = svg`<svg class="chevron" part="icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-slot="native-select-icon"><path d="m6 9 6 6 6-6" /></svg>`;

/**
 * The platform's own `<select>`, styled like an input. The browser still draws the list, so it behaves as on
 * every device (the mobile picker, type-to-select, the keyboard) and costs no script for the popup.
 *
 * Project `<option>` and `<optgroup>` children. An `<option>` cannot be slotted into a select that lives in a
 * shadow root, so they are mirrored into it and kept in step as you add, remove or edit them.
 *
 * @slot - `<option>` and `<optgroup>` elements.
 * @fires change - When the user picks an option, re-fired from the host because the native one does not leave the shadow root.
 * @fires input - When the user picks an option; the native event, which already crosses the shadow boundary.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - The picked option's value. Empty shows the option whose value is empty, or the first one when there is none.
 * @attr {'default' | 'sm'} size - Control height.
 * @attr {boolean} disabled - Blocks picking and dims the control.
 * @attr {boolean} invalid - Destructive border and ring, and `aria-invalid`.
 * @attr {string} aria-label - Accessible name; forwarded to the inner select.
 * @csspart select - The native select element.
 * @csspart icon - The chevron.
 * @cssprop --density-input - Height and padding multiplier for this component; falls back to `--density`.
 */
export class GeNativeSelect extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        name: { reflect: true },
        value: {},
        size: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        invalid: { type: Boolean, reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: string;
    declare size: NativeSelectSize;
    declare disabled: boolean;
    declare invalid: boolean;
    declare ariaLabel: string | null;
    declare fieldsetDisabled: boolean;

    private readonly select = createRef<HTMLSelectElement>();
    private readonly internals?: ElementInternals;
    private readonly observer = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(() => this.mirror());
    private defaultValue?: string;

    constructor() {
        super();
        this.name = '';
        this.value = '';
        this.size = 'default';
        this.disabled = false;
        this.invalid = false;
        this.ariaLabel = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The native select inside the shadow root. */
    get inner(): HTMLSelectElement | undefined {
        return this.select.value;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
        this.toggleAttribute('data-fieldset-disabled', disabled);
    }

    /** Called by the browser when the form is reset: back to the value first shown. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'native-select';
        this.observer?.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'selected', 'disabled', 'label'] });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
    }

    protected override firstUpdated(): void {
        this.mirror();
        this.defaultValue = this.value;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('value') && this.select.value) this.show();
        this.internals?.setFormValue(this.value);
    }

    /** Copies the projected options into the shadow select and shows the one `value` names. */
    private mirror(): void {
        const select = this.select.value;
        if (!select) return;
        const options = [...this.children].filter((child) => child instanceof HTMLOptionElement || child instanceof HTMLOptGroupElement);
        select.replaceChildren(...options.map((option) => option.cloneNode(true)));
        this.show();
    }

    private show(): void {
        const select = this.select.value;
        if (!select) return;
        select.value = this.value;
        // Nothing named: an empty value falls back to what the browser would show, a stray one stays blank.
        if (select.selectedIndex === -1 && this.value === '' && select.options.length > 0) {
            select.selectedIndex = Math.max(0, [...select.options].findIndex((option) => option.hasAttribute('selected')));
            this.value = select.value;
        }
    }

    protected override render() {
        return html`<div class="wrapper" part="wrapper" data-slot="native-select-wrapper">
            <select
                ${ref(this.select)}
                part="select"
                data-slot="native-select"
                data-size=${this.size}
                ?disabled=${this.isDisabled}
                aria-label=${this.ariaLabel ?? nothing}
                aria-invalid=${this.invalid ? 'true' : nothing}
                @change=${this.onChange}
            ></select>
            ${CHEVRON}
        </div>`;
    }

    private readonly onChange = (event: Event) => {
        this.value = (event.target as HTMLSelectElement).value;
        // The native change event is not composed, so it never leaves the shadow root; the host fires its own.
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };
}
