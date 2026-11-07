import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import css from './input-otp.css?inline';

/** Slot count used when `max-length` is not a positive number. */
const DEFAULT_LENGTH = 6;

/** What a user may type: alphanumerics, upper-cased, cut to the slot count. */
function sanitizeCode(text: string, slotCount: number): string {
    return text.replaceAll(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, slotCount);
}

/** `separator="2,5"` → `[2, 5]`; an empty attribute means no separator at all. */
function parseSeparator(value: string | null): number[] {
    if (value === null) return [2];
    return value
        .split(',')
        .map((part) => Number.parseInt(part, 10))
        .filter((index) => Number.isInteger(index));
}

/**
 * A one-time-code field: a row of slots drawn over a single visually hidden text input that does all the real
 * editing, so typing, paste, autofill and IME work natively.
 *
 * The row is always left to right, like a code is read: in an RTL page it still reads `123456` from the left and
 * the Left and Right arrows move the highlight left and right on screen.
 *
 * Typed text is stripped to letters and digits, upper-cased and cut to `max-length`. A `value` set from outside
 * is shown as it is.
 *
 * @fires value-change - After the user edits the code (typing, deleting, pasting, autofill); `detail` is the sanitised code.
 * @attr {string} value - The code.
 * @attr {number} max-length - Number of slots, and the cap on the code's length. Defaults to `6`.
 * @attr {string} separator - Comma-separated zero-based slot indices after which a dot is drawn. Defaults to `2`; an empty value draws none.
 * @attr {boolean} disabled - Disables the field and dims the row.
 * @attr {string} name - Field name; with it the code is submitted with the surrounding form.
 * @attr {string} aria-label - Accessible name of the field. Defaults to the locale's "One-time code".
 * @attr {string} locale - Locale id for the default name; follows the page's `lang` when unset.
 * @cssprop --density-input - Spacing multiplier for the slot size; falls back to `--density`.
 */
export class GeInputOtp extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static readonly formAssociated = true;
    static override readonly properties = {
        value: { reflect: true },
        maxLength: { type: Number, attribute: 'max-length' },
        separator: { converter: { fromAttribute: parseSeparator } },
        disabled: { type: Boolean, reflect: true },
        name: { reflect: true },
        ariaLabel: { attribute: 'aria-label' },
        locale: {},
        focused: { state: true },
        caret: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare value: string;
    declare maxLength: number;
    declare separator: readonly number[];
    declare disabled: boolean;
    declare name: string;
    declare ariaLabel: string | null;
    declare locale: string | CommonLocale | null;
    declare focused: boolean;
    /** The slot the next character lands in; mirrors the hidden input's selection start. */
    declare caret: number;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;
    private defaultValue = '';
    private followExternal = false;

    constructor() {
        super();
        this.value = '';
        this.maxLength = DEFAULT_LENGTH;
        this.separator = [2];
        this.disabled = false;
        this.name = '';
        this.ariaLabel = null;
        this.locale = null;
        this.focused = false;
        this.caret = 0;
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    private get slotCount(): number {
        return this.maxLength > 0 ? Math.floor(this.maxLength) : DEFAULT_LENGTH;
    }

    private get activeIndex(): number {
        return this.focused ? Math.min(this.caret, this.slotCount - 1) : -1;
    }

    private get field(): HTMLInputElement | null {
        return this.shadowRoot?.querySelector<HTMLInputElement>('.field') ?? null;
    }

    override focus(options?: FocusOptions): void {
        this.field?.focus(options);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultValue = this.value;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value') || changed.has('name')) this.internals?.setFormValue(this.value);
        // A disabled input never fires blur, so the highlight would otherwise outlive the focus.
        if (this.isDisabled && this.focused) this.focused = false;
        // Edits made here already match the field; only a write from outside leaves it behind.
        if (changed.has('value') && this.focused && this.field && this.field.value !== this.value) this.followExternal = true;
    }

    /**
     * A value written from outside while the field is focused leaves the browser caret at the end of the old text
     * and `caret` at the old slot; this re-aims both at the end of the new code.
     */
    protected override updated(): void {
        if (!this.followExternal) return;
        this.followExternal = false;
        this.select(this.value.length);
    }

    /**
     * Moves the hidden input's real selection to `index`, clamped to `[0, min(value.length, slotCount - 1)]`.
     * A slot holding a character is selected, so typing replaces it natively; the first empty slot gets a
     * collapsed caret, so typing fills it. Invariant: the highlighted slot is always where the next character lands.
     */
    private select(index: number): void {
        const length = this.value.length;
        const slot = Math.max(0, Math.min(index, length, this.slotCount - 1));
        this.caret = slot;
        this.field?.setSelectionRange(slot, slot < length ? slot + 1 : slot);
    }

    private commit(next: string): void {
        this.value = next;
        this.dispatchEvent(new CustomEvent('value-change', { detail: next, bubbles: true, composed: true }));
    }

    private isRejectedInsertion(event: InputEvent): boolean {
        return event.inputType.startsWith('insert') && !!event.data && !sanitizeCode(event.data, this.slotCount);
    }

    /**
     * Reads what native editing produced (typing, Backspace, autofill, dictation), sanitises it, publishes it and
     * re-selects the slot after the edit. An insertion made only of rejected characters is undone, so typing `!`
     * over a selected slot does not delete its digit; nothing is touched while an IME composition is open, because
     * moving the selection mid-composition cancels it.
     */
    private readonly onInput = (event?: Event) => {
        const field = this.field;
        if (!field) return;
        if (event instanceof InputEvent && event.isComposing) return;
        if (event instanceof InputEvent && this.isRejectedInsertion(event)) {
            field.value = this.value;
            this.select(this.caret);
            return;
        }
        const raw = field.value;
        const next = sanitizeCode(raw, this.slotCount);
        const caretAfter = sanitizeCode(raw.slice(0, field.selectionStart ?? raw.length), this.slotCount).length;
        field.value = next;
        if (next !== this.value) this.commit(next);
        this.select(caretAfter);
    };

    /**
     * A paste replaces the code: the browser's own paste would insert at the selection, which appends to a partial
     * code and does nothing in a full field. After a paste the field holds exactly the pasted code.
     */
    private readonly onPaste = (event: ClipboardEvent) => {
        event.preventDefault();
        const field = this.field;
        const code = sanitizeCode(event.clipboardData?.getData('text') ?? '', this.slotCount);
        if (!field || !code) return;
        field.value = code;
        if (code !== this.value) this.commit(code);
        this.select(code.length);
    };

    /** Arrow keys, Home and End move the highlight between slots; everything else, any Ctrl, Alt or Meta chord included, is native. */
    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const target = this.slotTarget(event.key);
        if (target === null) return;
        event.preventDefault();
        this.select(target);
    };

    private slotTarget(key: string): number | null {
        switch (key) {
            case 'ArrowLeft': return this.caret - 1;
            case 'ArrowRight': return this.caret + 1;
            case 'Home': return 0;
            case 'End': return this.value.length;
            default: return null;
        }
    }

    /** Follows selection changes the browser makes on its own (Ctrl+A, a drag), so the highlight names the slot the next character lands in. */
    private readonly onSelect = () => {
        const start = this.field?.selectionStart ?? 0;
        this.caret = Math.min(start, this.value.length, this.slotCount - 1);
    };

    private readonly onFocus = () => {
        this.focused = true;
        this.select(this.value.length);
    };

    private readonly onBlur = () => {
        this.focused = false;
    };

    private focusSlot(index: number): void {
        this.field?.focus();
        this.select(index);
    }

    private renderSlot(index: number) {
        const char = this.value[index] ?? '';
        const active = this.activeIndex === index;
        const classes = [
            'slot',
            index === 0 && 'first',
            index === this.slotCount - 1 && 'last',
            this.separator.includes(index) && 'before-separator',
            this.separator.includes(index - 1) && 'after-separator',
            active && 'active',
        ]
            .filter(Boolean)
            .join(' ');
        return html`<div
                class=${classes}
                data-slot="input-otp-slot"
                data-active=${active ? 'true' : nothing}
                aria-hidden="true"
                @mousedown=${(event: Event) => event.preventDefault()}
                @click=${() => this.focusSlot(index)}
            >
                <span class="char">${char}</span>
                ${active && !char ? html`<div class="caret"></div>` : nothing}
            </div>
            ${this.separator.includes(index) ? html`<div class="separator" aria-hidden="true"><div class="dot"></div></div>` : nothing}`;
    }

    protected override render() {
        const label = this.ariaLabel ?? resolveCommonLocale(this.locale).oneTimeCode;
        return html`<div class="row" dir="ltr" data-slot="input-otp" part="row">
            ${Array.from({ length: this.slotCount }, (...[, index]) => this.renderSlot(index))}
            <input
                class="field"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength=${this.slotCount}
                aria-label=${label}
                .value=${this.value}
                ?disabled=${this.isDisabled}
                @input=${this.onInput}
                @compositionend=${() => this.onInput()}
                @keydown=${this.onKeydown}
                @select=${this.onSelect}
                @paste=${this.onPaste}
                @focus=${this.onFocus}
                @blur=${this.onBlur}
            />
        </div>`;
    }
}
