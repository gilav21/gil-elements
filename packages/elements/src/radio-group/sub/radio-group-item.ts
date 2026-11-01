import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './radio-group-item.css?inline';

/** What an item sends up the tree to find the group it belongs to. */
export interface RadioRegistration {
    item: GeRadioGroupItem;
    group?: RadioGroupHost;
}

/** The part of the group an item talks to; the group element implements it. */
export interface RadioGroupHost {
    readonly value: string | undefined;
    readonly isDisabled: boolean;
    register(item: GeRadioGroupItem): void;
    unregister(item: GeRadioGroupItem): void;
    select(value: string): void;
}

export const RADIO_REGISTER = 'ge-radio-register';

/**
 * One choice in a `ge-radio-group`.
 *
 * Like `ge-checkbox`, the host is the control (`role="radio"`), so a `ge-label`, `aria-label` and `id`
 * on it work with no forwarding. Which item is selected, and which one Tab reaches, is decided by the group.
 *
 * @attr {string} value - What the group's value becomes when this item is selected. Required.
 * @attr {boolean} disabled - Blocks selecting this item and dims it.
 * @attr {string} label - Plain text label beside the circle, for the simple case. Clicking it selects.
 * @attr {string} aria-label - Accessible name when there is no visible label.
 * @csspart box - The circle.
 * @csspart label - The label text.
 * @cssprop --density-radio - Size multiplier for this component; falls back to `--density`.
 */
export class GeRadioGroupItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        label: { reflect: true },
    };

    declare value: string;
    declare disabled: boolean;
    declare label: string | null;

    private group?: RadioGroupHost;
    private readonly internals?: ElementInternals;

    constructor() {
        super();
        this.value = '';
        this.disabled = false;
        this.label = null;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
        if (this.internals) this.internals.role = 'radio';
        this.addEventListener('click', this.onClick);
    }

    /** True when this item belongs to a group and the group's value is this item's value. */
    get checked(): boolean {
        return this.group !== undefined && this.group.value === this.value;
    }

    /** True when it cannot be selected: disabled itself, or by its group or an ancestor fieldset. */
    get isDisabled(): boolean {
        return this.disabled || (this.group?.isDisabled ?? false);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        const registration: RadioRegistration = { item: this };
        this.dispatchEvent(new CustomEvent(RADIO_REGISTER, { detail: registration, bubbles: true, composed: true }));
        this.group = registration.group;
        this.requestUpdate();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.group?.unregister(this);
        this.group = undefined;
    }

    protected override willUpdate(): void {
        if (!this.internals) return;
        this.internals.ariaChecked = String(this.checked);
        this.internals.ariaDisabled = this.isDisabled ? 'true' : null;
    }

    protected override render() {
        const state = this.checked ? 'checked' : 'unchecked';
        return html`<span class=${this.isDisabled ? 'disabled' : nothing} style="display:contents"
            ><span class="box" part="box" data-slot="radio-group-item" data-state=${state}
                >${this.checked ? html`<span class="dot"></span>` : nothing}</span
            >${this.label ? html`<span class="label" part="label">${this.label}</span>` : nothing}</span
        >`;
    }

    private readonly onClick = (event: Event) => {
        if (this.isDisabled || event.defaultPrevented) return;
        this.group?.select(this.value);
    };
}
