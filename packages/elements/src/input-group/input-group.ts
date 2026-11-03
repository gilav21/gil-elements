import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './input-group.css?inline';

export const INPUT_GROUP_REGISTER = 'ge-input-group-register';

export type InputGroupVariant = 'outline' | 'underline' | 'ghost';

/** A control that takes its disabled state from the group. */
export interface InputGroupControl extends HTMLElement {
    requestUpdate(): void;
}

export interface InputGroupHost extends HTMLElement {
    readonly disabled: boolean;
    register(control: InputGroupControl): void;
    unregister(control: InputGroupControl): void;
}

/**
 * One bordered row that holds a text field and its addons (an icon, a unit, a button), sharing a single border
 * and focus ring. Put `ge-input-group-addon` and `ge-input-group-input` inside; `disabled` disables the field
 * and dims the whole row.
 *
 * The ring shows while the field has focus, not when an addon's button does.
 *
 * @slot - `ge-input-group-addon`, `ge-input-group-input`.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Border treatment. Defaults to `outline`.
 * @attr {boolean} disabled - Disables the field inside and dims the row.
 * @csspart group - The row.
 * @cssprop --density-input - Height and padding multiplier for this component; falls back to `--density`.
 */
export class GeInputGroup extends UiElement implements InputGroupHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        variant: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        fieldFocused: { state: true },
    };

    declare variant: InputGroupVariant;
    declare disabled: boolean;
    declare fieldFocused: boolean;
    private readonly controls = new Set<InputGroupControl>();

    constructor() {
        super();
        this.variant = 'outline';
        this.disabled = false;
        this.fieldFocused = false;
        adoptChildren<InputGroupHost, InputGroupControl>(this, INPUT_GROUP_REGISTER, (control) => this.register(control));
        this.addEventListener('focusin', this.onFocusin);
        this.addEventListener('focusout', this.onFocusout);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'input-group';
    }

    register(control: InputGroupControl): void {
        this.controls.add(control);
        control.requestUpdate();
    }

    unregister(control: InputGroupControl): void {
        this.controls.delete(control);
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('disabled')) for (const control of this.controls) control.requestUpdate();
    }

    private isField(target: EventTarget | null): boolean {
        return target instanceof HTMLElement && this.controls.has(target as InputGroupControl);
    }

    private readonly onFocusin = (event: FocusEvent) => {
        this.fieldFocused = this.isField(event.target);
    };

    private readonly onFocusout = () => {
        this.fieldFocused = false;
    };

    protected override render() {
        return html`<fieldset part="group" data-slot="input-group" ?data-focus=${this.fieldFocused} ?data-disabled=${this.disabled}><slot></slot></fieldset>`;
    }
}
