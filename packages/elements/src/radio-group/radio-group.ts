import { html, unsafeCSS, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { GeRadioGroupItem, RADIO_REGISTER, type RadioGroupHost, type RadioRegistration } from './sub/radio-group-item.js';
import css from './radio-group.css?inline';

export type RadioGroupOrientation = 'vertical' | 'horizontal';

const FORWARD = new Set(['ArrowDown', 'ArrowRight']);
const BACKWARD = new Set(['ArrowUp', 'ArrowLeft']);

/**
 * A set of mutually exclusive choices.
 *
 * Items register themselves with the nearest group by sending an event up the tree, so they may be
 * written as children, rendered from `options`, or wrapped in other elements. The group keeps one
 * item in the tab order (the selected one, else the first enabled) and moves focus and selection
 * with the arrow keys, the way a native radio group does.
 *
 * @fires input - When the user selects an item.
 * @fires change - When the user selects an item, after `input`.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - Value of the selected item.
 * @attr {'vertical' | 'horizontal'} orientation - Layout direction. Defaults to `vertical`.
 * @attr {boolean} disabled - Disables every item.
 * @attr {string} aria-label - Accessible name of the group.
 * @cssprop --density-radio - Size multiplier for the items; falls back to `--density`.
 */
export class GeRadioGroup extends UiElement implements RadioGroupHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static formAssociated = true;
    static override properties = {
        name: { reflect: true },
        value: { reflect: true },
        orientation: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        options: { attribute: false },
        displayWith: { attribute: false },
        valueWith: { attribute: false },
        disabledWith: { attribute: false },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: string | undefined;
    declare orientation: RadioGroupOrientation;
    declare disabled: boolean;
    /** Data-driven mode: one item per entry. Children are rendered after them. */
    declare options: readonly unknown[] | undefined;
    /** Text shown for an option. Defaults to `String(option)`. */
    declare displayWith: (option: unknown) => string;
    /** Value of an option. Defaults to `String(option)`. */
    declare valueWith: (option: unknown) => string;
    /** Whether an option is disabled. Defaults to never. */
    declare disabledWith: (option: unknown) => boolean;
    declare fieldsetDisabled: boolean;

    private readonly items = new Set<GeRadioGroupItem>();
    private readonly internals?: ElementInternals;
    private defaultValue?: string;

    constructor() {
        super();
        this.name = '';
        this.value = undefined;
        this.orientation = 'vertical';
        this.disabled = false;
        this.options = undefined;
        this.displayWith = String;
        this.valueWith = String;
        this.disabledWith = () => false;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
        if (this.internals) this.internals.role = 'radiogroup';
        this.addEventListener(RADIO_REGISTER, this.onRegister as EventListener);
        this.addEventListener('keydown', this.onKeydown);
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared. */
    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue ??= this.value;
    }

    register(item: GeRadioGroupItem): void {
        this.items.add(item);
        this.requestUpdate();
    }

    unregister(item: GeRadioGroupItem): void {
        this.items.delete(item);
        this.requestUpdate();
    }

    /** Select the item with this value and announce it as a user change. */
    select(value: string): void {
        if (this.isDisabled || this.value === value) return;
        this.value = value;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (this.internals) {
            this.internals.ariaOrientation = this.orientation;
            this.internals.ariaDisabled = this.isDisabled ? 'true' : null;
            if (changed.has('value')) this.internals.setFormValue(this.value ?? null);
        }
    }

    protected override updated(): void {
        const stops = this.enabledItems();
        const current = stops.find((item) => item.checked) ?? stops[0];
        for (const item of this.items) {
            item.tabIndex = item === current ? 0 : -1;
            item.requestUpdate();
        }
    }

    protected override render() {
        return html`${repeat(
                this.options ?? [],
                (option) => this.valueWith(option),
                (option) => this.renderOption(option),
            )}<slot></slot>`;
    }

    private renderOption(option: unknown) {
        return html`<ge-radio-group-item
            .value=${this.valueWith(option)}
            .label=${this.displayWith(option)}
            ?disabled=${this.disabledWith(option)}
        ></ge-radio-group-item>`;
    }

    private enabledItems(): GeRadioGroupItem[] {
        return [...this.items]
            .filter((item) => !item.isDisabled)
            .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    }

    private readonly onRegister = (event: CustomEvent<RadioRegistration>) => {
        event.stopPropagation();
        event.detail.group = this;
        this.register(event.detail.item);
    };

    private isRtl(): boolean {
        return getComputedStyle(this).direction === 'rtl';
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        const from = event.target instanceof GeRadioGroupItem ? event.target : undefined;
        if (!from || event.defaultPrevented) return;
        if (event.key === ' ') {
            event.preventDefault();
            if (!from.isDisabled) this.select(from.value);
            return;
        }
        const step = this.stepFor(event.key);
        if (step === 0) return;
        event.preventDefault();
        const stops = this.enabledItems();
        if (stops.length === 0) return;
        const index = stops.indexOf(from);
        const next = stops.at((index + step) % stops.length);
        if (!next) return;
        next.focus();
        this.select(next.value);
    };

    private stepFor(key: string): -1 | 0 | 1 {
        // In right-to-left text the horizontal arrows swap meaning; Up and Down never do.
        const flip = this.isRtl() && (key === 'ArrowLeft' || key === 'ArrowRight');
        if (FORWARD.has(key)) return flip ? -1 : 1;
        if (BACKWARD.has(key)) return flip ? 1 : -1;
        return 0;
    }
}
