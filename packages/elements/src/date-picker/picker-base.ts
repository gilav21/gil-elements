import { html, nothing, svg, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './date-picker.css?inline';

const CALENDAR_ICON = svg`<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;

/**
 * What the date picker and the range picker share: a trigger button, a popover that holds a calendar, the open
 * state and the form plumbing. Not registered as an element on its own.
 */
export abstract class PickerBase extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        name: { reflect: true },
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        showTime: { type: Boolean, attribute: 'show-time', reflect: true },
        locale: {},
        isOpen: { state: true },
        fieldsetDisabled: { state: true },
        invalid: { type: Boolean, reflect: true },
        errorMessage: { attribute: 'error-message' },
    };

    /** Marks the value as rejected: the trigger (the focusable part) gets `aria-invalid="true"`. A host's own `aria-invalid` cannot reach it (shadow root). */
    declare invalid: boolean;
    /** Why the value is rejected: the trigger's accessible description (`aria-description`), since an id reference cannot cross the shadow root. */
    declare errorMessage: string;

    declare name: string;
    declare placeholder: string;
    declare disabled: boolean;
    declare showTime: boolean;
    declare locale: string;
    declare isOpen: boolean;
    declare fieldsetDisabled: boolean;
    private readonly internals?: ElementInternals;

    protected abstract readonly slotName: string;
    /** The label inside the trigger when a value is showing, or `null` for the placeholder. */
    protected abstract label(): string | null;
    /** The calendar shown in the panel while it is open. */
    protected abstract calendar(): TemplateResult;
    /** What a form submits for the current value; an empty string for none. */
    protected abstract formValue(): string;
    /** Puts the value back to what the markup declared. */
    protected abstract resetValue(): void;

    constructor() {
        super();
        this.name = '';
        this.placeholder = '';
        this.disabled = false;
        this.showTime = false;
        this.locale = 'en';
        this.isOpen = false;
        this.fieldsetDisabled = false;
        this.invalid = false;
        this.errorMessage = '';
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.resetValue();
    }

    /** Opens the panel; does nothing while disabled. */
    show(): void {
        if (!this.isDisabled) this.isOpen = true;
    }

    /** Closes the panel without touching the value. */
    hide(): void {
        this.isOpen = false;
    }

    /** Opens or closes the panel; does nothing while disabled. */
    toggle(): void {
        if (this.isOpen) this.hide();
        else this.show();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('disabled') && this.isDisabled) this.isOpen = false;
    }

    protected override updated(): void {
        this.internals?.setFormValue(this.formValue() || null);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = this.slotName;
    }

    private readonly onOpenChange = (event: CustomEvent<boolean>) => {
        event.stopPropagation();
        this.isOpen = event.detail;
    };

    protected formatOptions(base: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
        return this.showTime ? { ...base, hour: '2-digit', minute: '2-digit' } : base;
    }

    protected override render() {
        const label = this.label();
        return html`<div class="picker" data-slot=${this.slotName}>
            <ge-popover ?open=${this.isOpen} @open-change=${this.onOpenChange}>
                <ge-popover-trigger>
                    <button type="button" class="trigger" part="trigger" ?disabled=${this.isDisabled} aria-expanded=${this.isOpen ? 'true' : 'false'} aria-haspopup="dialog"
                        aria-invalid=${this.invalid ? 'true' : nothing} aria-description=${this.errorMessage || nothing}>
                        ${CALENDAR_ICON}${label === null ? html`<span class="placeholder">${this.placeholder}</span>` : html`<span>${label}</span>`}
                    </button>
                </ge-popover-trigger>
                <ge-popover-content strategy="fixed" align="start" side="bottom">${this.isOpen ? this.calendar() : nothing}</ge-popover-content>
            </ge-popover>
        </div>`;
    }
}
