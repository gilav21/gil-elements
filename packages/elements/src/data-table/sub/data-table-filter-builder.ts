import { html, nothing, unsafeCSS } from 'lit';
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
    };

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
    }

    private emit(group: FilterGroup): void {
        if (group === this.group) return; // a patch of a slot that holds a group changes nothing (Angular emits nothing)
        this.dispatchEvent(new CustomEvent<FilterGroup>('group-change', { detail: group }));
    }

    private condition(rule: FilterCondition, index: number) {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        const value = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;
        return html`<div class="condition" data-slot="filter-condition">
            <select class="column" aria-label=${l.columnLabel ?? 'Column'} @change=${(e: Event) => this.emit(patchCondition(this.group, index, { column: value(e) }))}>
                ${this.columns.some((c) => c.key === rule.column) ? nothing : html`<option value="" disabled selected data-unknown>${rule.column || '(unknown column)'}</option>`}
                ${this.columns.map((c) => html`<option value=${c.key} ?selected=${c.key === rule.column}>${c.header}</option>`)}
            </select>
            <select class="operator" aria-label=${l.operatorLabel ?? 'Operator'} @change=${(e: Event) => this.emit(patchCondition(this.group, index, { operator: value(e) as FilterOperator }))}>
                ${OPERATOR_ORDER.map((op) => html`<option value=${op} ?selected=${op === rule.operator}>${l.operators[op]}</option>`)}
            </select>
            ${needsValue(rule.operator)
                ? html`<input type="text" class="value" placeholder=${l.valuePlaceholder} aria-label=${l.valueLabel ?? 'Value'} .value=${asText(rule.value)} @input=${(e: Event) => this.emit(patchCondition(this.group, index, { value: value(e) }))} />`
                : nothing}
            <button type="button" class="remove" aria-label=${l.removeCondition} @click=${() => this.emit(removeRule(this.group, index))}>
${chromeIcon('x', 'xs')}</button>
        </div>`;
    }

    private subgroup(rule: FilterGroup, index: number) {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        return html`<div class="subgroup" data-slot="filter-subgroup">
            <ge-data-table-filter-builder .group=${rule} .columns=${this.columns} .labels=${this.labels} @group-change=${(e: CustomEvent<FilterGroup>) => this.emit(updateRule(this.group, index, e.detail))}></ge-data-table-filter-builder>
            <button type="button" class="remove-group" @click=${() => this.emit(removeRule(this.group, index))}>${l.removeGroup}</button>
        </div>`;
    }

    protected override render() {
        const l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels };
        const group = this.group ?? emptyGroup();
        const and = group.combinator === 'and';
        return html`<div part="base" class="group" data-slot="filter-group" role="group" aria-label=${l.groupLabel ?? 'Group'}>
            <div class="header">
                <div class="combinator">
                    <button type="button" aria-pressed=${and ? 'true' : 'false'} ?data-active=${and} @click=${() => this.emit(setCombinator(group, 'and'))}>${l.and}</button>
                    <button type="button" aria-pressed=${and ? 'false' : 'true'} ?data-active=${!and} @click=${() => this.emit(setCombinator(group, 'or'))}>${l.or}</button>
                </div>
                <span class="hint">${and ? l.matchAll : l.matchAny}</span>
            </div>
            ${group.rules.map((rule, index) => (rule.type === 'condition' ? this.condition(rule, index) : this.subgroup(rule, index)))}
            <div class="footer">
                <ge-button size="sm" variant="outline" @click=${() => this.emit(addCondition(group, this.columns))}>${l.addCondition}</ge-button>
                <ge-button size="sm" variant="ghost" @click=${() => this.emit(addGroup(group))}>${l.addGroup}</ge-button>
            </div>
        </div>`;
    }
}
