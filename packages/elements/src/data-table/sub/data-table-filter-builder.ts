import { html, nothing, type PropertyValues, unsafeCSS } from 'lit';
import { live } from 'lit/directives/live.js';
import { chromeIcon } from '../data-table-icons.js';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import { stringifyValue } from '../data-table.utils.js';
import { addCondition, addGroup, needsValue, OPERATOR_ORDER, patchCondition, removeRule, setCombinator, updateRule } from '../data-table-filter-panels.js';
import { EMPTY_GROUP, type FilterBuilderColumn, sameStructure } from '../data-table-filters.js';
import { EN_FILTER_BUILDER_LABELS, type FilterBuilderLabels } from '../data-table.locales.js';
import type { FilterCondition, FilterGroup, FilterOperator } from '../data-table.types.js';
import css from './data-table-filter-builder.css?inline';

/** `change` applied to the group at `path` of `tree` (the rule indexes from the top), the groups above it rebuilt: a new tree, nothing mutated. */
function updateAt(tree: FilterGroup, path: readonly number[], change: (group: FilterGroup) => FilterGroup): FilterGroup {
    if (path.length === 0) return change(tree);
    const [index, ...rest] = path as [number, ...number[]];
    const child = tree.rules[index];
    if (child?.type !== 'group') return tree; // the path no longer names a group (the tree changed): nothing to apply
    return updateRule(tree, index, updateAt(child, rest, change));
}

/**
 * The recursive AND/OR editor of the data table's advanced filter (shadcn-angular `ui-data-table-filter-builder`). Fully controlled: every edit
 * reports a whole new tree and changes nothing here until `group` is fed back. Nested groups are drawn by nested builders. Native `select` and
 * `input` controls (D10), each with an accessible name (the Angular builder has none).
 *
 * @fires group-change - The new WHOLE tree after any edit, also one made in a nested group: fired by the top-level builder only. Does not bubble:
 * listen on the builder.
 */
export class GeDataTableFilterBuilder extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        group: { attribute: false },
        columns: { attribute: false },
        labels: { attribute: false },
        debounce: { attribute: false },
        owner: { attribute: false },
        path: { attribute: false },
    };

    /**
     * Milliseconds a typed value waits before `group-change` (the table's `filterDebounce`, like its floating input; 0 = at once, Angular's
     * behaviour). Column, operator and structure edits are never delayed. Read on the top-level builder.
     */
    declare debounce: number;
    /**
     * A NESTED builder's top-level builder (null on the top level itself). Every edit of a nested group goes up to it: ONE tree, ONE pending map,
     * ONE timer and ONE `group-change`, so a nested builder that Lit reuses for another group (its row index changed) never holds anything of its own.
     */
    declare owner: GeDataTableFilterBuilder | null;
    /** Where this builder's group sits in the top-level tree: the rule indexes from the top (empty on the top level). */
    declare path: readonly number[];
    /** Top level only: the typed values waiting on the debounce, by the PATH of their condition (`'0.2'`), and the one timer. */
    private readonly pending = new Map<string, { path: readonly number[]; value: string }>();
    private timer: ReturnType<typeof setTimeout> | undefined;

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
        this.group = EMPTY_GROUP;
        this.columns = [];
        this.labels = EN_FILTER_BUILDER_LABELS;
        this.debounce = 0;
        this.owner = null;
        this.path = [];
    }

    /** The path arrays handed to nested builders, one per rule index, kept while this builder's own path is the same: a parent render that changes
     * nothing of a nested group passes it the SAME path (and its own rule object), so the nested builder does not re-render. */
    private childPaths: { base: readonly number[]; paths: (readonly number[])[] } = { base: [], paths: [] };

    private childPath(index: number): readonly number[] {
        if (this.childPaths.base !== this.path) this.childPaths = { base: this.path, paths: [] };
        return (this.childPaths.paths[index] ??= [...this.path, index]);
    }

    /** The top-level builder: the one that holds the tree, the pending values and the event. */
    private get root(): GeDataTableFilterBuilder {
        return this.owner ?? this;
    }

    /** The tree this builder reported last: a `group` fed back that is NOT it was replaced from outside (Clear all, a restored view). */
    private lastEmitted: FilterGroup | null = null;

    /** The labels with every English default filled in: merged ONCE when `labels` changes (not per row), and handed down to nested builders. */
    private l: Required<FilterBuilderLabels> = EN_FILTER_BUILDER_LABELS as Required<FilterBuilderLabels>;

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('labels')) this.l = { ...EN_FILTER_BUILDER_LABELS, ...this.labels } as Required<FilterBuilderLabels>;
        // A tree replaced from outside makes the waiting values meaningless (their paths name another tree's conditions): they are dropped.
        if (!this.owner && changed.has('group') && this.group !== this.lastEmitted && this.pending.size > 0) {
            clearTimeout(this.timer);
            this.timer = undefined;
            this.pending.clear();
        }
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        // The popover closed while a typed value waited: the top level reports it now, once, against its latest tree.
        this.flush();
    }

    /**
     * Reports the typed values still waiting on the debounce now (one `group-change`), if any; a no-op otherwise. The table calls it while it detaches
     * (it is removed before its builder is), so the value reaches the table while it can still filter. Called on a nested builder, flushes its top level.
     */
    flush(): void {
        if (this.root.pending.size > 0) this.root.edit([], (group) => group);
    }

    /** A value typed in the condition at `path` (top-level tree): reported now, or after `debounce` ms of quiet (the last value per condition wins). */
    private typed(path: readonly number[], value: string): void {
        const root = this.root;
        root.pending.set(path.join('.'), { path, value });
        clearTimeout(root.timer);
        if (root.debounce > 0) root.timer = setTimeout(() => root.edit([], (group) => group), root.debounce);
        else root.edit([], (group) => group);
    }

    /**
     * Every edit goes through the top level: the values still waiting on the debounce are patched in FIRST (into the conditions they were typed
     * in, before a structural edit can move them), then `change` applies to the group at `at`, and ONE new tree is reported.
     */
    private edit(at: readonly number[], change: (group: FilterGroup) => FilterGroup): void {
        const root = this.root;
        if (root !== this) return root.edit(at, change);
        clearTimeout(this.timer);
        this.timer = undefined;
        let tree = this.group ?? EMPTY_GROUP;
        for (const { path, value } of this.pending.values()) {
            const index = path.at(-1) as number;
            tree = updateAt(tree, path.slice(0, -1), (group) => patchCondition(group, index, { value }));
        }
        this.pending.clear();
        this.emit(updateAt(tree, at, change));
    }

    /** The value shown in the condition at `path`: a typed one still waiting, else the tree's. */
    private shownValue(path: readonly number[], rule: FilterCondition): string {
        return this.root.pending.get(path.join('.'))?.value ?? stringifyValue(rule.value);
    }

    private emit(group: FilterGroup): void {
        // An edit that changed nothing emits nothing: a patch of a slot that holds a group (Angular emits nothing), and a new tree STRUCTURALLY equal to
        // the current one (a value typed then erased within the debounce).
        if (sameStructure(group, this.group)) return;
        this.lastEmitted = group;
        this.dispatchEvent(new CustomEvent<FilterGroup>('group-change', { detail: group }));
    }

    private condition(rule: FilterCondition, index: number) {
        const { l } = this;
        const value = (event: Event): string => (event.target as HTMLInputElement | HTMLSelectElement).value;
        const known = this.columns.some((c) => c.key === rule.column);
        // The rows are drawn by index, so a row is REUSED for another rule (remove condition 0: row 0 now shows condition 1). Each select's
        // `.value` is therefore bound with `live` against the DOM, so it shows the model's choice and not the one the reused row last had.
        return html`<div class="condition" data-slot="filter-condition">
            <select class="column" aria-label=${l.columnLabel} .value=${live(known ? rule.column : '')} @change=${(e: Event) => this.edit(this.path, (g) => patchCondition(g, index, { column: value(e) }))}>
                ${known ? nothing : html`<option value="" disabled selected data-unknown>${rule.column || '(unknown column)'}</option>`}
                ${this.columns.map((c) => html`<option value=${c.key} ?selected=${c.key === rule.column}>${c.header}</option>`)}
            </select>
            <select class="operator" aria-label=${l.operatorLabel} .value=${live(rule.operator)} @change=${(e: Event) => this.edit(this.path, (g) => patchCondition(g, index, { operator: value(e) as FilterOperator }))}>
                ${OPERATOR_ORDER.map((op) => html`<option value=${op} ?selected=${op === rule.operator}>${l.operators[op]}</option>`)}
            </select>
            ${needsValue(rule.operator)
                ? html`<input type="text" class="value" placeholder=${l.valuePlaceholder} aria-label=${l.valueLabel} .value=${live(this.shownValue([...this.path, index], rule))} @input=${(e: Event) => this.typed([...this.path, index], value(e))} />`
                : nothing}
            <button type="button" class="remove" aria-label=${l.removeCondition} @click=${() => this.edit(this.path, (g) => removeRule(g, index))}>
${chromeIcon('x', 'xs')}</button>
        </div>`;
    }

    private subgroup(rule: FilterGroup, index: number) {
        const { l } = this;
        return html`<div class="subgroup" data-slot="filter-subgroup">
            <ge-data-table-filter-builder .group=${rule} .columns=${this.columns} .labels=${l} .owner=${this.root} .path=${this.childPath(index)}></ge-data-table-filter-builder>
            <button type="button" class="remove-group" @click=${() => this.edit(this.path, (g) => removeRule(g, index))}>${l.removeGroup}</button>
        </div>`;
    }

    protected override render() {
        const { l } = this;
        const group = this.group ?? EMPTY_GROUP;
        const and = group.combinator === 'and';
        return html`<div part="base" class="group" data-slot="filter-group" role="group" aria-label=${l.groupLabel}>
            <div class="header">
                <div class="combinator">
                    <button type="button" aria-pressed=${and ? 'true' : 'false'} ?data-active=${and} @click=${() => this.edit(this.path, (g) => setCombinator(g, 'and'))}>${l.and}</button>
                    <button type="button" aria-pressed=${and ? 'false' : 'true'} ?data-active=${!and} @click=${() => this.edit(this.path, (g) => setCombinator(g, 'or'))}>${l.or}</button>
                </div>
                <span class="hint">${and ? l.matchAll : l.matchAny}</span>
            </div>
            ${group.rules.map((rule, index) => (rule.type === 'condition' ? this.condition(rule, index) : this.subgroup(rule, index)))}
            <div class="footer">
                <ge-button size="sm" variant="outline" @click=${() => this.edit(this.path, (g) => addCondition(g, this.columns))}>${l.addCondition}</ge-button>
                <ge-button size="sm" variant="ghost" @click=${() => this.edit(this.path, (g) => addGroup(g))}>${l.addGroup}</ge-button>
            </div>
        </div>`;
    }
}
