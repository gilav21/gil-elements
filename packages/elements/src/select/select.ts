import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { deepActive, registerLayer } from '../shared/overlay.js';
import css from './select.css?inline';

/** The text a value stands for: objects as JSON rather than `[object Object]`. */
const valueText = (value: unknown): string => (typeof value === 'object' ? (JSON.stringify(value) ?? '') : `${value as string | number | boolean}`);

export const SELECT_REGISTER = 'ge-select-register';

export type SelectPosition = 'item-aligned' | 'popper';

/** A part that re-renders when the select opens, closes or changes value. */
export interface SelectPart extends HTMLElement {
    requestUpdate(): void;
}

/** What the parts of a select need from it. */
export interface SelectHost {
    readonly open: boolean;
    readonly isDisabled: boolean;
    /** Whether the options come from `options` instead of projected items. */
    readonly dataDriven: boolean;
    readonly position: SelectPosition;
    readonly resolvedPlaceholder: string;
    /** The selected value as shown in `ge-select-value`. */
    readonly shownText: string | undefined;
    readonly trigger: HTMLElement | null;
    readonly content: HTMLElement | null;
    /** The `ge-select` element, for its `aria-label` and `aria-labelledby`. */
    readonly host: HTMLElement;
    isSelected(key: string): boolean;
    /** Commits the row with this key, as a user pick. */
    select(key: string): void;
    show(): void;
    hide(options?: { restoreFocus?: 'now' }): void;
    toggle(): void;
    register(part: SelectPart): void;
    unregister(part: SelectPart): void;
}

/**
 * A control that picks one value from a list. This element holds the value and the open state; put a
 * `ge-select-trigger` and a `ge-select-content` inside it, or set `options` to have both built for you.
 * It takes part in forms: the value is submitted under `name` as a string.
 *
 * @slot - `ge-select-trigger` and `ge-select-content`.
 * @fires input - When the user picks a different value.
 * @fires change - When the user picks a different value, after `input`.
 * @fires value-change - Same moment; `detail` is the picked value itself (an option object stays an object).
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} value - The selected value.
 * @attr {string} default-value - Value used while none is set, and what a form reset returns to.
 * @attr {string} placeholder - Text shown while nothing is selected. Defaults to "Select...".
 * @attr {boolean} disabled - Disables the select.
 * @attr {'item-aligned' | 'popper'} position - `item-aligned` (default) overlays the panel so the selected row sits on the trigger and falls back to `popper` when it would not fit; `popper` drops it beside the trigger.
 * @attr {string} value-attribute - With `options` of objects: the property that holds an option's value.
 * @attr {boolean} open - Whether the panel is showing.
 * @cssprop --density-select - Size multiplier for the trigger and rows; falls back to `--density`.
 */
export class GeSelect extends UiElement implements SelectHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        name: { reflect: true },
        value: {},
        defaultValue: { attribute: 'default-value' },
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        position: { reflect: true },
        open: { type: Boolean, reflect: true },
        options: { attribute: false },
        displayWith: { attribute: false },
        valueAttribute: { attribute: 'value-attribute' },
        disabledWith: { attribute: false },
        fieldsetDisabled: { state: true },
    };

    declare name: string;
    declare value: unknown;
    declare defaultValue: unknown;
    declare placeholder: string | undefined;
    declare disabled: boolean;
    declare position: SelectPosition;
    declare open: boolean;
    declare options: readonly unknown[] | undefined;
    /** Text shown for an option. Defaults to `String(option)`. */
    declare displayWith: (option: unknown) => string;
    declare valueAttribute: string | undefined;
    /** Whether an option is disabled. Defaults to never. */
    declare disabledWith: (option: unknown) => boolean;
    declare fieldsetDisabled: boolean;

    private readonly parts = new Set<SelectPart>();
    private readonly internals?: ElementInternals;
    private initialValue: unknown;
    private release?: () => void;

    constructor() {
        super();
        this.name = '';
        this.value = undefined;
        this.defaultValue = undefined;
        this.placeholder = undefined;
        this.disabled = false;
        this.open = false;
        this.position = 'item-aligned';
        this.options = undefined;
        this.displayWith = String;
        this.valueAttribute = undefined;
        this.disabledWith = () => false;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
        adoptChildren<SelectHost, SelectPart>(this, SELECT_REGISTER, (part) => this.register(part));
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    get dataDriven(): boolean {
        return (this.options?.length ?? 0) > 0;
    }

    get resolvedPlaceholder(): string {
        return this.placeholder ?? 'Select...';
    }

    get shownText(): string | undefined {
        if (this.value === undefined || this.value === null) return undefined;
        const option = this.options?.find((candidate) => this.valueOfOption(candidate) === this.value);
        return option === undefined ? valueText(this.value) : this.displayWith(option);
    }

    get host(): HTMLElement {
        return this;
    }

    get content(): HTMLElement | null {
        return this.querySelector<HTMLElement>('ge-select-content') ?? this.shadowRoot?.querySelector<HTMLElement>('ge-select-content') ?? null;
    }

    get trigger(): HTMLElement | null {
        return this.querySelector<HTMLElement>('ge-select-trigger') ?? this.shadowRoot?.querySelector<HTMLElement>('ge-select-trigger') ?? null;
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    /** Called by the browser when the form is reset: back to the value the markup first declared (or `default-value`, which applies again while none is set). */
    formResetCallback(): void {
        this.value = this.initialValue;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.initialValue ??= this.value;
        document.addEventListener('click', this.onOutsideClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('click', this.onOutsideClick);
        this.release?.();
        this.release = undefined;
    }

    register(part: SelectPart): void {
        this.parts.add(part);
    }

    unregister(part: SelectPart): void {
        this.parts.delete(part);
    }

    isSelected(key: string): boolean {
        return this.value !== undefined && this.value !== null && valueText(this.value) === key;
    }

    show(): void {
        if (!this.isDisabled) this.setOpen(true);
    }

    toggle(): void {
        if (this.open) this.hide();
        else this.show();
    }

    /**
     * Closes the panel. When focus is inside it, focus goes back to the trigger, since the panel is about to
     * leave; a close from an outside click leaves focus where the user put it.
     */
    hide(options: { restoreFocus?: 'now' } = {}): void {
        const active = deepActive(document);
        const trigger = this.trigger;
        const inside = !!active && (this.contains(active) || !!this.shadowRoot?.contains(active)) && !trigger?.contains(active) && !trigger?.shadowRoot?.contains(active);
        this.setOpen(false);
        // After the key event: Enter's default action would otherwise click the trigger focus just landed on and reopen the panel.
        // `now` is for Tab: the key's own default action runs after this handler and must start from the trigger.
        if (inside && options.restoreFocus === 'now') this.trigger?.focus();
        else if (inside) setTimeout(() => this.trigger?.focus());
    }

    select(key: string): void {
        if (this.isDisabled) return;
        const next = this.valueFor(key);
        if (this.value !== next) {
            this.value = next;
            this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            this.dispatchEvent(new Event('change', { bubbles: true }));
            this.dispatchEvent(new CustomEvent('value-change', { detail: next, bubbles: true, composed: true }));
        }
        this.hide();
    }

    private valueOfOption(option: unknown): unknown {
        if (!this.valueAttribute || option === null || typeof option !== 'object') return option;
        return (option as Record<string, unknown>)[this.valueAttribute];
    }

    /** The option whose value renders as `key`; `undefined` for projected rows, which carry plain strings. */
    private optionFor(key: string): unknown {
        return this.options?.find((option) => String(this.valueOfOption(option)) === key);
    }

    private valueFor(key: string): unknown {
        const option = this.optionFor(key);
        return option === undefined ? key : this.valueOfOption(option);
    }

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: next, bubbles: true, composed: true }));
    }

    // composedPath, because the click's target is retargeted to the outermost host once it leaves a shadow root.
    private readonly onOutsideClick = (event: MouseEvent) => {
        if (this.open && !event.composedPath().includes(this)) this.hide();
    };

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (this.value === undefined && this.defaultValue !== undefined) this.value = this.defaultValue;
        if (changed.has('value') || changed.has('defaultValue')) {
            this.internals?.setFormValue(this.value === undefined || this.value === null ? null : valueText(this.value));
        }
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('open')) {
            this.release?.();
            this.release = this.open && this.isConnected ? registerLayer({ modal: false, dismiss: () => this.hide() }) : undefined;
        }
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        if (!this.dataDriven) return html`<slot></slot>`;
        return html`<ge-select-trigger fill><ge-select-value></ge-select-value></ge-select-trigger>
            <ge-select-content data-driven>
                ${(this.options ?? []).map(
                    (option) => html`<ge-select-item .value=${String(this.valueOfOption(option))} ?disabled=${this.disabledWith(option)}>${this.displayWith(option)}</ge-select-item>`,
                )}
            </ge-select-content>`;
    }
}
