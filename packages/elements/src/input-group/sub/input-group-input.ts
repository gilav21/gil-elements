import { html, unsafeCSS, type PropertyValues } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import { resolveIdRefs } from '../../shared/aria-refs.js';
import { findParent } from '../../shared/compound.js';
import { INPUT_GROUP_REGISTER, type InputGroupHost } from '../input-group.js';
import css from './input-group-input.css?inline';

/**
 * The text field of a `ge-input-group`. It has no border of its own; the group draws it. A native `<input>`
 * lives in the shadow root, and, like `ge-input`, the host forwards `aria-label`, `aria-labelledby` and
 * `aria-describedby` to it.
 *
 * @fires input - On every edit; the native event.
 * @fires change - When an edit is committed, re-fired from the host because the native one stays in the shadow root.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - Current text.
 * @attr {string} type - Native input type. Defaults to `text`.
 * @attr {string} placeholder - Hint shown while empty. Not a label.
 * @attr {boolean} disabled - Blocks editing. A disabled group disables it too.
 * @attr {string} inputmode - Which on-screen keyboard a touch device offers.
 * @attr {string} aria-label - Accessible name, forwarded to the inner input.
 * @attr {string} aria-labelledby - Ids in the host's tree, resolved to elements for the inner input.
 * @attr {string} aria-describedby - Ids in the host's tree, resolved to elements for the inner input.
 * @csspart input - The native input.
 */
export class GeInputGroupInput extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static readonly formAssociated = true;
    static override readonly properties = {
        name: { reflect: true },
        value: {},
        type: { reflect: true },
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        inputMode: { attribute: 'inputmode' },
        ariaLabel: { attribute: 'aria-label' },
        ariaLabelledby: { attribute: 'aria-labelledby' },
        ariaDescribedby: { attribute: 'aria-describedby' },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: string;
    declare type: string;
    declare placeholder: string;
    declare disabled: boolean;
    declare inputMode: string;
    declare ariaLabel: string | null;
    declare ariaLabelledby: string | null;
    declare ariaDescribedby: string | null;
    declare fieldsetDisabled: boolean;

    private readonly input = createRef<HTMLInputElement>();
    private readonly internals?: ElementInternals;
    private defaultValue?: string;
    private group?: InputGroupHost;

    constructor() {
        super();
        this.name = '';
        this.value = '';
        this.type = 'text';
        this.placeholder = '';
        this.disabled = false;
        this.inputMode = '';
        this.ariaLabel = null;
        this.ariaLabelledby = null;
        this.ariaDescribedby = null;
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    /** The native input inside the shadow root. */
    get inner(): HTMLInputElement | undefined {
        return this.input.value;
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled || Boolean(this.group?.disabled);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue ?? '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'input-group-input';
        this.defaultValue ??= this.value;
        this.group = findParent<InputGroupHost, GeInputGroupInput>(this, INPUT_GROUP_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.group?.unregister(this);
        this.group = undefined;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.internals?.setFormValue(this.value);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (!changed.has('ariaLabelledby') && !changed.has('ariaDescribedby')) return;
        const input = this.inner;
        if (!input) return;
        input.ariaLabelledByElements = resolveIdRefs(this, this.ariaLabelledby);
        input.ariaDescribedByElements = resolveIdRefs(this, this.ariaDescribedby);
    }

    protected override render() {
        return html`<input
            ${ref(this.input)}
            part="input"
            data-slot="input-group-control"
            type=${this.type}
            .value=${this.value}
            placeholder=${this.placeholder}
            ?disabled=${this.isDisabled}
            aria-label=${ifDefined(this.ariaLabel ?? undefined)}
            inputmode=${ifDefined(this.inputMode || undefined)}
            @input=${this.onInput}
            @change=${this.onChange}
        />`;
    }

    private readonly onInput = (event: Event) => {
        this.value = (event.target as HTMLInputElement).value;
    };

    private readonly onChange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };
}
