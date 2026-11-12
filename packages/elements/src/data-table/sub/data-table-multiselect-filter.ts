import { html, nothing, type PropertyValues, unsafeCSS } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import '../../checkbox/define.js';
import '../../command/define.js';
import { normalizeSelection, selectAllValues, selectionValue, toggleSelection } from '../data-table-filters.js';
import { type DataTableLocale, resolveDataTableLocale } from '../data-table.locales.js';
import css from './data-table-filters-panels.css?inline';

/**
 * The ready-made multiselect filter panel of a data-table column (shadcn-angular `ui-data-table-multiselect-filter`): a searchable list of
 * options, each with a checkbox, plus Select all and Clear. Pair it with `multiselectFilterFn`. Selection order is click order; a selected
 * value without an option is kept; Select all selects every option whatever the search text; an empty selection is reported as `null`.
 *
 * @fires filter-change - The selected values (`valueWith` of the options) in selection order, or `null` when none is selected.
 * @attr {string} placeholder - The search field's placeholder; defaults to the locale's `searchPlaceholder`.
 * @attr {string} title - Optional heading; with it a badge shows the number selected.
 * @attr {string} locale - Data-table dictionary id; the property also takes a dictionary.
 */
export class GeDataTableMultiselectFilter<O = unknown> extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { attribute: false },
        options: { attribute: false },
        displayWith: { attribute: false },
        valueWith: { attribute: false },
        placeholder: {},
        title: {},
        locale: {},
        selected: { state: true },
    };

    /** The current filter (the selected values), re-supplied by the table. */
    declare value: unknown[] | null;
    /** Every option is drawn; the search box narrows what is shown, not this list. */
    declare options: O[];
    /** An option's label: the visible text, the checkbox name and the search text. */
    declare displayWith: (option: O) => string;
    /** An option's value: what is reported and compared with the cell (by identity: project objects to a primitive key). */
    declare valueWith: (option: O) => unknown;
    declare placeholder: string | undefined;
    declare title: string;
    declare locale: string | DataTableLocale | undefined;
    declare selected: unknown[];

    constructor() {
        super();
        this.value = null;
        this.options = [];
        this.displayWith = String;
        this.valueWith = (option) => option;
        this.placeholder = undefined;
        this.title = '';
        this.locale = undefined;
        this.selected = [];
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('value')) this.selected = normalizeSelection(this.value);
    }

    private commit(next: unknown[]): void {
        this.selected = next;
        this.dispatchEvent(new CustomEvent('filter-change', { detail: selectionValue(next), bubbles: true, composed: true }));
    }

    private toggle(option: O): void {
        this.commit(toggleSelection(this.selected, this.valueWith(option)));
    }

    private readonly selectAll = (): void => this.commit(selectAllValues(this.selected, this.options, this.valueWith));

    private readonly clearAll = (): void => this.commit([]);

    protected override render() {
        const t = resolveDataTableLocale(this.locale);
        const chosen = new Set(this.selected);
        return html`<div part="base" data-slot="multiselect-filter">
            ${this.title
                ? html`<div class="title"><span>${this.title}</span>${this.selected.length > 0 ? html`<span class="badge">${this.selected.length}</span>` : nothing}</div>`
                : nothing}
            <ge-command dir=${t.rtl ? 'rtl' : nothing} @state-change=${(event: Event) => event.stopPropagation()}>
                <ge-command-input placeholder=${this.placeholder ?? t.searchPlaceholder}></ge-command-input>
                <div class="actions">
                    <ge-button variant="ghost" size="sm" @click=${this.selectAll}>${t.selectAllRows}</ge-button>
                    <ge-button variant="ghost" size="sm" @click=${this.clearAll}>${t.clearAll}</ge-button>
                </div>
                <ge-command-separator></ge-command-separator>
                <ge-command-list aria-label=${this.title || this.placeholder || t.searchPlaceholder}>
                    <ge-command-empty>${t.noResultsLabel}</ge-command-empty>
                    ${repeat(
                        this.options,
                        (option) => this.valueWith(option),
                        (option) => {
                            const label = this.displayWith(option);
                            const on = chosen.has(this.valueWith(option));
                            return html`<ge-command-item value=${label} ?selected=${on} @select-item=${() => this.toggle(option)}><span class="option"><ge-checkbox .checked=${on} aria-hidden="true" tabindex="-1" inert></ge-checkbox><span>${label}</span></span></ge-command-item>`;
                        },
                    )}
                </ge-command-list>
            </ge-command>
        </div>`;
    }
}
