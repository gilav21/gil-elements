import { html, nothing, unsafeCSS } from 'lit';
import { live } from 'lit/directives/live.js';
import { chromeIcon } from '../data-table-icons.js';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import { addCondition, addGroup, asText, emptyGroup, type FilterBuilderColumn, needsValue, OPERATOR_ORDER, patchCondition, removeRule, setCombinator, updateRule } from '../data-table-filters.js';
import { EN_FILTER_BUILDER_LABELS, type FilterBuilderLabels } from '../data-table.locales.js';
import type { FilterCondition, FilterGroup, FilterOperator } from '../data-table.types.js';
import css from './data-table-filter-builder.css?inline';


/**
 * The recursive AND/OR editor of the data table's advanced filter (shadcn-angular `ui-data-table-filter-builder`). Fully controlled: every edit
 * reports a whole new tree and changes nothing here until `group` is fed back. Nested groups are drawn by nested builders. Native `select` and
 * `input` controls (D10), each with an accessible name (the Angular builder has none).
 *
 * @fires group-change - The new tree after any edit (also one made in a nested group). Does not bubble: listen on the builder.
 */
export class GeDataTableFilterBuilder extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        group: { attribute: false },
        columns: { attribute: false },
        labels: { attribute: false },
        debounce: { attribute: false },
    };

    /**
     * Milliseconds a typed value waits before `group-change` (the table's `filterDebounce`, like its floating input; 0 = at once, Angular's
     * behaviour). Column, operator and structure edits are never delayed. Nested builders get the same.
     */
    declare debounce: number;
    /** The pending value edit per condition index: its timer and the value it will report. */
    private readonly pending = new Map<number, { timer: ReturnType<typeof setTimeout>; value: string }>();

    declare group: FilterGroup;
    /**
     * The columns the first select offers. A condition naming a column that is not among them (removed, hidden from the builder) shows that
     * key as a disabled, selected first option, so the select tells the truth and picking any real column fires `change`; the tree is never
     * rewritten by the builder itself.
     */
    declare columns: FilterBuilderColumn[];
    declare labels: FilterBuilderLabels;

    constructor() {
        super();
        this.group = emptyGroup();
        this.columns = [];
        this.labels = EN_FILTER_BUILDER_LABELS;
        this.debounce = 0;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // The popover closed (or the table went) while a typed value waited: it is reported now, once, not lost.
        if (this.pending.size > 0) this.edit((group) => group);
    }

    /** A value typed in condition `index`: reported now, or after `debounce` ms of quiet (the last value wins, patched into the tree of THAT moment). */
    private typed(index: number, value: string): void {
        clearTimeout(this.pending.get(index)?.timer);
        this.pending.delete(index);
        if (!(this.debounce > 0)) return this.edit((group) => patchCondition(group, index, { value }));
        const timer = setTimeout(() => this.edit((group) => group), this.debounce);
        this.pending.set(index, { timer, value });
    }

    /**
     * Every edit goes through here: the values still waiting on the debounce are patched in FIRST (into the slots they were typed in, before a
     * structural edit can move them), then `change` applies, and ONE new tree is reported.
     */
    private edit(change: (group: FilterGroup) => FilterGroup): void {
        let group = this.group ?? emptyGroup();
        for (const [index, { timer, value }] of this.pending) {
            clearTimeout(timer);
            group = patchCondition(group, index, { value });
        }
        this.pending.clear();
        this.emit(change(group));
    }

    private emit(group: FilterGroup): void {
        if (group === this.group) return; // a patch of a slot that holds a group changes nothing (Angular emits nothing); also an edit that changed nothing
        this.dispatchEvent(new CustomEvent<FilterGroup>('group-change', { detail: group }));
    }

    private condition(rule: FilterCondition, index: number) {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        const value = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;
        const known = this.columns.some((c) => c.key === rule.column);
        // The rows are drawn by index, so a row is REUSED for another rule (remove condition 0: row 0 now shows condition 1). Each select's
        // `.value` is therefore bound with `live` against the DOM, so it shows the model's choice and not the one the reused row last had.
        return html`<div class="condition" data-slot="filter-condition">
            <select class="column" aria-label=${l.columnLabel ?? 'Column'} .value=${live(known ? rule.column : '')} @change=${(e: Event) => this.edit((g) => patchCondition(g, index, { column: value(e) }))}>
                ${known ? nothing : html`<option value="" disabled selected data-unknown>${rule.column || '(unknown column)'}</option>`}
                ${this.columns.map((c) => html`<option value=${c.key} ?selected=${c.key === rule.column}>${c.header}</option>`)}
            </select>
            <select class="operator" aria-label=${l.operatorLabel ?? 'Operator'} .value=${live(rule.operator)} @change=${(e: Event) => this.edit((g) => patchCondition(g, index, { operator: value(e) as FilterOperator }))}>
                ${OPERATOR_ORDER.map((op) => html`<option value=${op} ?selected=${op === rule.operator}>${l.operators[op]}</option>`)}
            </select>
            ${needsValue(rule.operator)
                ? html`<input type="text" class="value" placeholder=${l.valuePlaceholder} aria-label=${l.valueLabel ?? 'Value'} .value=${live(this.pending.get(index)?.value ?? asText(rule.value))} @input=${(e: Event) => this.typed(index, value(e))} />`
                : nothing}
            <button type="button" class="remove" aria-label=${l.removeCondition} @click=${() => this.edit((g) => removeRule(g, index))}>
${chromeIcon('x', 'xs')}</button>
        </div>`;
    }

    private subgroup(rule: FilterGroup, index: number) {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        return html`<div class="subgroup" data-slot="filter-subgroup">
            <ge-data-table-filter-builder .group=${rule} .columns=${this.columns} .labels=${this.labels} .debounce=${this.debounce} @group-change=${(e: CustomEvent<FilterGroup>) => this.edit((g) => updateRule(g, index, e.detail))}></ge-data-table-filter-builder>
            <button type="button" class="remove-group" @click=${() => this.edit((g) => removeRule(g, index))}>${l.removeGroup}</button>
        </div>`;
    }

    protected override render() {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        const group = this.group ?? emptyGroup();
        const and = group.combinator === 'and';
        return html`<div part="base" class="group" data-slot="filter-group" role="group" aria-label=${l.groupLabel ?? 'Group'}>
            <div class="header">
                <div class="combinator">
                    <button type="button" aria-pressed=${and ? 'true' : 'false'} ?data-active=${and} @click=${() => this.edit((g) => setCombinator(g, 'and'))}>${l.and}</button>
                    <button type="button" aria-pressed=${and ? 'false' : 'true'} ?data-active=${!and} @click=${() => this.edit((g) => setCombinator(g, 'or'))}>${l.or}</button>
                </div>
                <span class="hint">${and ? l.matchAll : l.matchAny}</span>
            </div>
            ${group.rules.map((rule, index) => (rule.type === 'condition' ? this.condition(rule, index) : this.subgroup(rule, index)))}
            <div class="footer">
                <ge-button size="sm" variant="outline" @click=${() => this.edit((g) => addCondition(g, this.columns))}>${l.addCondition}</ge-button>
                <ge-button size="sm" variant="ghost" @click=${() => this.edit((g) => addGroup(g))}>${l.addGroup}</ge-button>
            </div>
        </div>`;
    }
}
