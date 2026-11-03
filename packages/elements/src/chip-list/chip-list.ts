import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { readableForeground } from '../shared/color.js';
import type { BadgeVariant } from '../badge/badge.js';
import type { GeInput } from '../input/input.js';
import css from './chip-list.css?inline';

export type ChipListVariant = 'outline' | 'underline' | 'ghost';
export type ChipListSize = 'sm' | 'md' | 'lg';

const REMOVE_ICON = svg`<svg class="remove-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>`;

/** `KeyboardEvent.keyCode` an IME reports while it owns the key. */
const IME_KEY_CODE = 229;

/**
 * A text field that turns what you type into removable chips. Enter (and any `separator-keys` key) commits the
 * text; Backspace in an empty field removes the last chip. The chips, the field and the `max-rows` cap all scale
 * with `size` and with density.
 *
 * It is form-associated: with a `name` it submits each chip as its own entry.
 *
 * @fires chip-added - After a chip is appended; `detail` is its trimmed text. Not fired for a rejected duplicate.
 * @fires chip-removed - After a chip is removed, by its button or by Backspace; `detail` is its text.
 * @fires value-change - After either; `detail` is the full list of chips.
 * @attr {string} placeholder - Text in the field, and its accessible name. The text itself hides once there is a chip. Defaults to "Add item...".
 * @attr {boolean} disabled - Disables the field and removes the chips' remove buttons.
 * @attr {'outline' | 'underline' | 'ghost'} variant - Outline is a bordered box, underline a single rule, ghost no chrome.
 * @attr {'default' | 'secondary' | 'destructive' | 'outline'} badge-variant - The badge variant of every chip. Defaults to `default`.
 * @attr {'sm' | 'md' | 'lg'} size - Chip size.
 * @attr {number} max-rows - Caps the box at this many rows of chips and scrolls instead of growing. 0 means no cap.
 * @attr {boolean} allow-duplicates - Keep a repeated text as a second chip. Without it the repeat only clears the field.
 * @attr {string} name - Field name for forms.
 * @csspart container - The box.
 * @cssprop --density-chip-list - Spacing multiplier; falls back to `--density-badge`, then `--density`.
 */
export class GeChipList extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static formAssociated = true;
    static override properties = {
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        variant: { reflect: true },
        badgeVariant: { attribute: 'badge-variant' },
        size: { reflect: true },
        maxRows: { type: Number, attribute: 'max-rows' },
        allowDuplicates: { type: Boolean, attribute: 'allow-duplicates' },
        name: { reflect: true },
        value: { attribute: false },
        chipColors: { attribute: false },
        separatorKeys: { attribute: false },
        draft: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare placeholder: string;
    declare disabled: boolean;
    declare variant: ChipListVariant;
    declare badgeVariant: BadgeVariant;
    declare size: ChipListSize;
    declare maxRows: number;
    declare allowDuplicates: boolean;
    declare name: string;
    /** The chips, in order. Setting it does not fire any event. */
    declare value: readonly string[];
    /** Background colour per chip text. A listed chip is drawn with it, with black or white text, whichever reads better. */
    declare chipColors: Readonly<Record<string, string>>;
    /** Extra `KeyboardEvent.key` values that commit the text, such as `[',', ' ']`. Enter always does. */
    declare separatorKeys: readonly string[];
    declare draft: string;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;
    private defaultValue: readonly string[] = [];
    private revealField = false;

    constructor() {
        super();
        this.placeholder = 'Add item...';
        this.disabled = false;
        this.variant = 'outline';
        this.badgeVariant = 'default';
        this.size = 'md';
        this.maxRows = 0;
        this.allowDuplicates = false;
        this.name = '';
        this.value = [];
        this.chipColors = {};
        this.separatorKeys = [];
        this.draft = '';
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    private get field(): GeInput | null {
        return this.shadowRoot?.querySelector<GeInput>('ge-input') ?? null;
    }

    override focus(options?: FocusOptions): void {
        if (!this.isDisabled) this.field?.focus(options);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'chip-list-host';
        this.defaultValue = this.value;
    }

    /**
     * Appends `text` as a chip and clears the field. The text is trimmed and an empty one ignored; unless
     * `allow-duplicates` is set, a repeat only clears the field.
     */
    addChip(text: string): void {
        const chip = text.trim();
        if (!chip) return;
        this.draft = '';
        if (!this.allowDuplicates && this.value.includes(chip)) return;
        this.revealField = true;
        this.value = [...this.value, chip];
        this.dispatchEvent(new CustomEvent('chip-added', { detail: chip, bubbles: true, composed: true }));
        this.announce();
    }

    private announce(): void {
        this.dispatchEvent(new CustomEvent('value-change', { detail: this.value, bubbles: true, composed: true }));
    }

    private dropChip(index: number): void {
        const removed = this.value[index] ?? '';
        this.value = this.value.filter((...[, i]) => i !== index);
        this.dispatchEvent(new CustomEvent('chip-removed', { detail: removed, bubbles: true, composed: true }));
        this.announce();
    }

    private readonly onRemove = (index: number, event: Event) => {
        // The click is on a chip, not on the box: the box would only hand focus to the field, which is done below.
        event.stopPropagation();
        this.dropChip(index);
        this.focus();
    };

    private readonly onBoxClick = () => this.focus();

    private readonly onBoxKeydown = (event: KeyboardEvent) => {
        // A key aimed at a child (a chip's remove button) is that child's own.
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        this.focus();
    };

    private readonly onInput = (event: Event) => {
        this.draft = (event.target as GeInput).value;
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        // keyCode 229 is Safari: it fires the keydown that confirms a candidate after compositionend, with isComposing already false.
        if (event.isComposing || event.keyCode === IME_KEY_CODE) return;
        if (event.key === 'Enter' || this.separatorKeys.includes(event.key)) {
            event.preventDefault();
            this.addChip(this.draft);
        } else if (event.key === 'Backspace' && this.draft === '' && this.value.length > 0) {
            this.dropChip(this.value.length - 1);
        }
    };

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value') || changed.has('name')) this.syncForm();
    }

    private syncForm(): void {
        if (!this.name) {
            this.internals?.setFormValue(null);
            return;
        }
        const data = new FormData();
        for (const chip of this.value) data.append(this.name, chip);
        this.internals?.setFormValue(data);
    }

    protected override updated(): void {
        if (!this.revealField) return;
        this.revealField = false;
        // A capped box scrolls to the field, so the user is not typing out of sight.
        const box = this.shadowRoot?.querySelector<HTMLElement>('.chips');
        if (box) box.scrollTop = box.scrollHeight;
    }

    private chip(text: string, index: number) {
        const background = this.chipColors[text];
        const style = background ? `background-color:${background};color:${readableForeground(background)};border-color:${background}` : nothing;
        return html`<ge-badge class="chip" variant=${background ? 'default' : this.badgeVariant} style=${style} data-slot="chip">
            <span class="chip-text">${text}</span>
            ${this.isDisabled
                ? nothing
                : html`<button type="button" class="remove" data-slot="chip-remove" aria-label="Remove ${text}" @click=${(event: Event) => this.onRemove(index, event)}>${REMOVE_ICON}</button>`}
        </ge-badge>`;
    }

    protected override render() {
        return html`<fieldset
            class="chips"
            part="container"
            data-slot="chip-list"
            data-variant=${this.variant}
            data-size=${this.size}
            ?data-max-rows=${this.maxRows > 0}
            style=${this.maxRows > 0 ? `--_rows:${this.maxRows}` : nothing}
            ?disabled=${this.isDisabled}
            ?data-disabled=${this.isDisabled}
            tabindex="-1"
            @click=${this.onBoxClick}
            @keydown=${this.onBoxKeydown}
        >
            ${this.value.map((text, index) => this.chip(text, index))}
            <ge-input
                variant="ghost"
                aria-label=${this.placeholder}
                placeholder=${this.value.length === 0 ? this.placeholder : ''}
                ?disabled=${this.isDisabled}
                .value=${this.draft}
                @input=${this.onInput}
                @keydown=${this.onKeydown}
            ></ge-input>
        </fieldset>`;
    }
}
