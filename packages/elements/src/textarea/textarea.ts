import { html, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../shared/aria-refs.js';
import css from './textarea.css?inline';

export type TextareaVariant = 'outline' | 'underline' | 'ghost';

/**
 * A multi-line text field.
 *
 * The native `<textarea>` lives in the shadow root, so typing, selection, resizing and the keyboard stay
 * native. `aria-labelledby` and `aria-describedby` on the host are resolved to elements and handed to it,
 * which is how a `ge-label` names it.
 *
 * @fires input - On every edit; the native event, which already crosses the shadow boundary.
 * @fires change - When an edit is committed (on blur), re-fired from the host because the native one does not leave the shadow root.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - Current text.
 * @attr {string} placeholder - Hint shown while empty. Not a label.
 * @attr {number} rows - Visible lines. Defaults to 3.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. The underline and ghost variants cannot be resized.
 * @attr {boolean} disabled - Blocks editing and dims the field.
 * @attr {boolean} skeleton - Show a placeholder instead of the field.
 * @attr {string} aria-label - Accessible name; forwarded to the inner textarea.
 * @attr {string} aria-labelledby - Space-separated ids in the host's tree; resolved to elements for the inner textarea.
 * @attr {string} aria-describedby - Space-separated ids in the host's tree; resolved to elements for the inner textarea.
 * @csspart textarea - The native textarea element.
 * @cssprop --density-input - Padding and minimum height multiplier; falls back to `--density`.
 */
export class GeTextarea extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        name: { reflect: true },
        value: {},
        placeholder: {},
        rows: { type: Number },
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        ariaDescribedby: { attribute: 'aria-describedby' },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: string;
    declare placeholder: string;
    declare rows: number;
    declare variant: TextareaVariant;
    declare disabled: boolean;
    declare skeleton: boolean;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare ariaDescribedby: string | null;
    declare fieldsetDisabled: boolean;

    private readonly field = createRef<HTMLTextAreaElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: string;

    constructor() {
        super();
        this.name = '';
        this.value = '';
        this.placeholder = '';
        this.rows = 3;
        this.variant = 'outline';
        this.disabled = false;
        this.skeleton = false;
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.ariaDescribedby = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** The native textarea inside the shadow root. */
    get inner(): HTMLTextAreaElement | undefined {
        return this.field.value;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue ?? '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value);
    }

    protected override updated(changed: PropertyValues<this>): void {
        const field = this.inner;
        if (!field || !(changed.has('ariaLabelledby') || changed.has('ariaDescribedby'))) return;
        field.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
        field.ariaDescribedByElements = resolveIdRefs(this, this.ariaDescribedby);
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        return html`<textarea
            ${ref(this.field)}
            part="textarea"
            data-slot="textarea"
            .value=${this.value}
            placeholder=${this.placeholder}
            rows=${this.rows}
            ?disabled=${this.isDisabled}
            aria-label=${ifDefined(this.ariaLabel ?? undefined)}
            @input=${this.onInput}
            @change=${this.onChange}
        ></textarea>`;
    }

    private readonly onInput = (event: Event) => {
        this.value = (event.target as HTMLTextAreaElement).value;
    };

    // The native change event is not composed, so it never leaves the shadow root; the host fires its own.
    private readonly onChange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };
}
