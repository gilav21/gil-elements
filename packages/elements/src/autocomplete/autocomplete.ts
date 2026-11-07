import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { clippingRect } from '../shared/anchor.js';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import type { GeCommand } from '../command/command.js';
import { splitMatches } from './autocomplete.utils.js';
import css from './autocomplete.css?inline';

const CLOSE_ICON = svg`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chip-icon" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const CHEVRON = svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const CHECK = svg`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;

/** Room the list needs below the box before it opens downwards. */
const LIST_HEIGHT = 300;
const EDGE = 8;

let counter = 0;

type Side = 'top' | 'bottom';

/**
 * A text box that suggests options as you type. Set `options`, and the box filters them as the user types and
 * highlights what matched. Arrow keys move through the list, Enter picks, Escape closes.
 *
 * Without `multiple` a pick replaces the value and closes the list; the closed box shows the picked label. With
 * `multiple` each pick toggles a removable chip, the list stays open, the box is cleared, and Backspace in an
 * empty box removes the last chip.
 *
 * Options may be anything. For objects, set `displayWith` to say what to show, and `valueAttribute` to the
 * property that identifies an option (without it options are compared by reference).
 *
 * It is form-associated: with a `name` it submits the identifying property of each pick, or its label without
 * `valueAttribute`.
 *
 * @fires value-change - After the user picks or removes; `detail` is the option (or `null`), or the array with `multiple`.
 * @fires search-change - As the user types; `detail` is the text. Delayed by `debounce-time`. Use it to fetch `options` from a server.
 * @attr {boolean} multiple - Chip selection instead of a single value.
 * @attr {string} placeholder - Hint while nothing is typed or picked. Defaults to the locale's "Select...".
 * @attr {boolean} disabled - Disables the box.
 * @attr {boolean} no-filter - Keeps every option visible whatever is typed; use it when `options` is already the server's result.
 * @attr {string} value-attribute - Property that identifies an option, such as `id`.
 * @attr {number} debounce-time - Milliseconds of quiet typing before `search-change` fires. Defaults to 0.
 * @attr {string} name - Field name for forms.
 * @attr {string} locale - Locale id for the placeholder and the empty message; follows the page's `lang` when unset.
 * @csspart container - The bordered box.
 * @cssprop --density-select - Spacing multiplier; falls back to `--density`.
 */
export class GeAutocomplete extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        options: { attribute: false },
        displayWith: { attribute: false },
        valueAttribute: { attribute: 'value-attribute' },
        noFilter: { type: Boolean, attribute: 'no-filter', reflect: true },
        multiple: { type: Boolean, reflect: true },
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        debounceTime: { type: Number, attribute: 'debounce-time' },
        name: { reflect: true },
        locale: {},
        value: { attribute: false },
        searchTerm: { attribute: false },
        isOpen: { state: true },
        side: { state: true },
        panelWidth: { state: true },
        activeId: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare options: readonly unknown[];
    /** Maps an option to the text shown for it. Defaults to `String`. */
    declare displayWith: (option: unknown) => string;
    declare valueAttribute: string;
    declare noFilter: boolean;
    declare multiple: boolean;
    declare placeholder: string | null;
    declare disabled: boolean;
    declare debounceTime: number;
    declare name: string;
    declare locale: string | CommonLocale | null;
    /** The selection: an option or `null`, or an array with `multiple`. Setting it does not fire `value-change`. */
    declare value: unknown;
    /** The text in the box. Clears when a pick is made and when the list closes. */
    declare searchTerm: string;
    declare isOpen: boolean;
    declare side: Side;
    declare panelWidth: number;
    declare activeId: string | null;
    declare fieldsetDisabled: boolean;

    private readonly listId = `ge-autocomplete-list-${++counter}`;
    private readonly internals?: ElementInternals;
    private defaultValue: unknown;
    private debounceTimer?: ReturnType<typeof setTimeout>;
    private watcher?: MutationObserver;

    constructor() {
        super();
        this.options = [];
        this.displayWith = String;
        this.valueAttribute = '';
        this.noFilter = false;
        this.multiple = false;
        this.placeholder = null;
        this.disabled = false;
        this.debounceTime = 0;
        this.name = '';
        this.locale = null;
        this.value = null;
        this.searchTerm = '';
        this.isOpen = false;
        this.side = 'bottom';
        this.panelWidth = 0;
        this.activeId = null;
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    private get text(): CommonLocale {
        return resolveCommonLocale(this.locale);
    }

    private get input(): HTMLInputElement | null {
        return this.shadowRoot?.querySelector<HTMLInputElement>('input') ?? null;
    }

    private get command(): GeCommand | null {
        return this.shadowRoot?.querySelector<GeCommand>('ge-command') ?? null;
    }

    /** The selection as a list, whichever shape `value` has. */
    get selectedItems(): unknown[] {
        if (this.value === null || this.value === undefined) return [];
        return Array.isArray(this.value) ? this.value : [this.value];
    }

    /** Text for an option. */
    getDisplayValue(option: unknown): string {
        return typeof this.displayWith === 'function' ? this.displayWith(option) : String(option);
    }

    /** What identifies an option when comparing: the `value-attribute` property, else the option itself. */
    getValue(option: unknown): unknown {
        return this.valueAttribute ? (option as Record<string, unknown>)[this.valueAttribute] : option;
    }

    isSelected(option: unknown): boolean {
        const id = this.getValue(option);
        return this.selectedItems.some((item) => this.getValue(item) === id);
    }

    /** Opens the list. */
    show(): void {
        if (this.isDisabled || this.isOpen) return;
        this.resolveSide();
        this.isOpen = true;
    }

    /** Closes the list and clears the text, which puts the picked label back in a single box. */
    hide(): void {
        this.isOpen = false;
        this.searchTerm = '';
    }

    override focus(options?: FocusOptions): void {
        this.input?.focus(options);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.setValue(this.defaultValue, false);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'autocomplete';
        this.defaultValue = this.value;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.debounceTimer);
        this.watcher?.disconnect();
    }

    private resolveSide(): void {
        const box = this.shadowRoot?.querySelector<HTMLElement>('.container');
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const bounds = clippingRect(box);
        const below = bounds.bottom - rect.bottom - EDGE;
        const above = rect.top - bounds.top - EDGE;
        this.side = LIST_HEIGHT <= below || below >= above ? 'bottom' : 'top';
    }

    private setValue(next: unknown, emit: boolean): void {
        this.value = next;
        if (emit) this.dispatchEvent(new CustomEvent('value-change', { detail: next, bubbles: true, composed: true }));
    }

    private commit(items: unknown[]): void {
        this.setValue(this.multiple ? items : (items[0] ?? null), true);
    }

    private readonly onOpenChange = (event: CustomEvent<boolean>) => {
        event.stopPropagation();
        if (!event.detail) this.hide();
    };

    private readonly onContainerClick = (event: Event) => {
        // Stops here so the click never reaches the popover trigger, which would toggle the list instead of leaving it to the input.
        event.stopPropagation();
        this.input?.focus();
    };

    private readonly onFocus = () => {
        if (!this.multiple) this.show();
    };

    private readonly onInput = (event: Event) => {
        const text = (event.target as HTMLInputElement).value;
        this.searchTerm = text;
        this.announceSearch(text);
        this.show();
    };

    private announceSearch(text: string): void {
        clearTimeout(this.debounceTimer);
        const fire = () => this.dispatchEvent(new CustomEvent('search-change', { detail: text, bubbles: true, composed: true }));
        if (this.debounceTime > 0) this.debounceTimer = setTimeout(fire, this.debounceTime);
        else fire();
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowUp':
                this.arrow(event);
                break;
            case 'Enter':
                event.preventDefault();
                if (this.isOpen) this.command?.selectActive();
                break;
            case 'Backspace':
                this.popChip();
                break;
        }
    };

    private arrow(event: KeyboardEvent): void {
        event.preventDefault();
        if (!this.isOpen) this.show();
        else if (event.key === 'ArrowDown') this.command?.moveNext();
        else this.command?.movePrev();
    }

    private popChip(): void {
        if (this.multiple && this.searchTerm === '' && this.selectedItems.length > 0) this.commit(this.selectedItems.slice(0, -1));
    }

    private select(option: unknown): void {
        if (this.multiple) {
            const id = this.getValue(option);
            const without = this.selectedItems.filter((item) => this.getValue(item) !== id);
            this.commit(without.length === this.selectedItems.length ? [...this.selectedItems, option] : without);
            this.searchTerm = '';
            this.input?.focus();
        } else {
            this.commit([option]);
            this.hide();
        }
    }

    private removeItem(option: unknown, event: Event): void {
        // A removed chip is not a click on the box: the input must not take focus (and, in a single box, open the list).
        event.stopPropagation();
        const id = this.getValue(option);
        this.commit(this.selectedItems.filter((item) => this.getValue(item) !== id));
    }

    private formEntry(option: unknown): string {
        return this.valueAttribute ? String(this.getValue(option)) : this.getDisplayValue(option);
    }

    private syncForm(): void {
        const items = this.selectedItems;
        if (!this.name || items.length === 0) {
            this.internals?.setFormValue(null);
            return;
        }
        const data = new FormData();
        for (const item of items) data.append(this.name, this.formEntry(item));
        this.internals?.setFormValue(data);
    }

    private watchActive(): void {
        this.watcher?.disconnect();
        const list = this.shadowRoot?.querySelector('ge-command-list');
        if (!this.isOpen || !list) {
            this.activeId = null;
            return;
        }
        const read = () => {
            this.activeId = list.querySelector('[data-active]')?.id ?? null;
        };
        this.watcher = new MutationObserver(read);
        this.watcher.observe(list, { attributes: true, attributeFilter: ['data-active'], subtree: true });
        read();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('isOpen') && this.isOpen) {
            const box = this.shadowRoot?.querySelector<HTMLElement>('.container');
            if (box) this.panelWidth = box.getBoundingClientRect().width;
        }
        if (changed.has('disabled') && this.isDisabled) this.isOpen = false;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('isOpen')) this.watchActive();
        this.syncForm();
    }

    private get inputText(): string {
        // With chips the box only ever holds what is being typed; the picks are the chips.
        if (this.isOpen || this.multiple) return this.searchTerm;
        const first = this.selectedItems[0];
        return first === undefined ? '' : this.getDisplayValue(first);
    }

    private label(option: unknown) {
        const label = this.getDisplayValue(option);
        return splitMatches(label, this.searchTerm).map((part) => (part.hit ? html`<span class="hit">${part.text}</span>` : part.text));
    }

    private renderChips() {
        return repeat(
            this.selectedItems,
            (item) => String(this.getValue(item)),
            (item) => html`<ge-badge class="chip" variant="secondary">
                ${this.getDisplayValue(item)}
                <button type="button" class="chip-remove" data-slot="chip-remove" aria-label="Remove ${this.getDisplayValue(item)}" @click=${(event: Event) => this.removeItem(item, event)}>${CLOSE_ICON}</button>
            </ge-badge>`,
        );
    }

    private renderInput(cls: string, placeholder: string) {
        return html`<input
            type="text"
            role="combobox"
            class=${cls}
            aria-autocomplete="list"
            aria-expanded=${this.isOpen ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${this.activeId ?? nothing}
            .value=${this.inputText}
            placeholder=${placeholder}
            ?disabled=${this.isDisabled}
            @input=${this.onInput}
            @keydown=${this.onKeydown}
            @focus=${this.onFocus}
        />`;
    }

    private renderRow(option: unknown, index: number) {
        const selected = this.isSelected(option);
        return html`<ge-command-item id="${this.listId}-${index}" value=${this.getDisplayValue(option)} ?selected=${selected} @select-item=${() => this.select(option)}>
            <span class="label">${this.label(option)}</span>
            <span class="check" ?data-on=${selected}>${CHECK}</span>
        </ge-command-item>`;
    }

    protected override render() {
        const placeholder = this.placeholder ?? this.text.selectPlaceholder;
        const rtl = this.text.rtl ? 'rtl' : nothing;
        return html`<ge-popover ?open=${this.isOpen} @open-change=${this.onOpenChange}>
            <ge-popover-trigger>
                <div
                    class="container"
                    part="container"
                    data-slot="autocomplete-container"
                    data-state=${this.isOpen ? 'open' : 'closed'}
                    ?data-disabled=${this.isDisabled}
                    dir=${rtl}
                    tabindex="-1"
                    @click=${this.onContainerClick}
                >
                    ${this.multiple
                        ? html`<div class="chips">${this.renderChips()}${this.renderInput('multi-input', this.selectedItems.length === 0 ? placeholder : '')}</div>`
                        : html`<div class="single">${this.renderInput('single-input', placeholder)}${CHEVRON}</div>`}
                </div>
            </ge-popover-trigger>
            <ge-popover-content strategy="fixed" side=${this.side} align="start" no-restore-focus style="--_width:${this.panelWidth}px">
                <ge-command ?no-filter=${this.noFilter} .search=${this.searchTerm} dir=${rtl}>
                    <ge-command-list id=${this.listId}>
                        <ge-command-empty>${this.text.noResults}</ge-command-empty>
                        ${repeat(this.options, (option) => String(this.getValue(option)), (option, index) => this.renderRow(option, index))}
                    </ge-command-list>
                </ge-command>
            </ge-popover-content>
        </ge-popover>`;
    }
}
