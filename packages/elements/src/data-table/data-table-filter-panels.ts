/**
 * The pure helpers of the LAZY filter UI (wave 5, package A): the multiselect selection rules, the date-range presets and the builder's tree
 * operations. Imported only by the lazy panels and builder (`lazy/filter-panels`, `lazy/filter-builder`), never by the static path, so none of it
 * is in `define.js`. The static half (filter functions, the header and floating-row questions, filter equality) is `data-table-filters.ts`.
 * No DOM, no lit: node-tested.
 */
import type { CalendarLocale } from '../shared/calendar-locales.js';
import { EMPTY_GROUP, type FilterBuilderColumn } from './data-table-filters.js';
import type { DataTableDateRange, FilterCondition, FilterGroup, FilterOperator, FilterRule } from './data-table.types.js';

// ---- multiselect panel ---------------------------------------------------------------------------------------------------------------

/** What the panel reports for a selection: `null` for an empty one (no filter), else a copy. */
export const selectionValue = (selected: readonly unknown[]): unknown[] | null => (selected.length === 0 ? null : [...selected]);

/**
 * The selection as given, duplicates dropped, values without an option kept (Angular's `selected` effect). An array, or a `Set` read as its values
 * (the rule `multiselectFilterFn` reads a filter value by); anything else is no selection.
 */
export const normalizeSelection = (selected: unknown): unknown[] => (Array.isArray(selected) || selected instanceof Set ? [...new Set(selected)] : []);

/** SameValueZero, the equality of `includes` and `Set`: `Object.is`, except that +0 and -0 are one value (and NaN is NaN). */
const sameValueZero = (a: unknown, b: unknown): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));

/** Adds the value at the end (selection order is click order) or removes it: found and removed by ONE equality (SameValueZero, as `includes`). */
export const toggleSelection = (selected: readonly unknown[], value: unknown): unknown[] =>
    selected.includes(value) ? selected.filter((v) => !sameValueZero(v, value)) : [...selected, value];

/** Every option's value added (the search text does not narrow it), already-selected values without an option kept. */
export const selectAllValues = <O>(selected: readonly unknown[], options: readonly O[], valueWith: (option: O) => unknown): unknown[] => [...new Set([...selected, ...options.map(valueWith)])];

// ---- date-range presets --------------------------------------------------------------------------------------------------------------

export interface DateRangePreset {
    readonly label: string;
    readonly range: DataTableDateRange;
}

/** Today, Last 7 days, Last 30 days and This month (local midnights), labelled from the calendar locale. */
export function defaultDateRangePresets(locale: Partial<CalendarLocale>, now: Date = new Date()): DateRangePreset[] {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const back = (days: number): Date => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
    return [
        { label: locale.todayLabel ?? 'Today', range: { start: today, end: today } },
        { label: locale.last7DaysLabel ?? 'Last 7 days', range: { start: back(6), end: today } },
        { label: locale.last30DaysLabel ?? 'Last 30 days', range: { start: back(29), end: today } },
        { label: locale.thisMonthLabel ?? 'This month', range: { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today } },
    ];
}

/** A range the calendar reports: complete ranges are emitted, a half one (start only) is kept in the panel and not reported. */
export const isCompleteRange = (value: unknown): value is DataTableDateRange =>
    !!value && typeof value === 'object' && 'start' in value && !!(value as DataTableDateRange).start && !!(value as DataTableDateRange).end;

// ---- filter builder tree operations (every edit is a whole new tree) ----------------------------------------------------------------

/** The order of the operator select. */
export const OPERATOR_ORDER: readonly FilterOperator[] = ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];

const VALUELESS: ReadonlySet<FilterOperator> = new Set(['isEmpty', 'isNotEmpty']);

/** False for the unary operators, which hide the value input (the rule keeps its old value). */
export const needsValue = (operator: FilterOperator): boolean => !VALUELESS.has(operator);

/** A new empty group (a nested one added by the builder): EMPTY_GROUP's shape, with a rules array of its own. */
export const emptyGroup = (): FilterGroup => ({ ...EMPTY_GROUP, rules: [] });

const withRules = (group: FilterGroup, rules: FilterRule[], combinator = group.combinator): FilterGroup => ({ type: 'group', combinator, rules });

export const setCombinator = (group: FilterGroup, combinator: 'and' | 'or'): FilterGroup => withRules(group, group.rules, combinator);

/** Appends `contains ''` on the first column (an empty key without columns). */
export const addCondition = (group: FilterGroup, columns: readonly FilterBuilderColumn[]): FilterGroup =>
    withRules(group, [...group.rules, { type: 'condition', column: columns[0]?.key ?? '', operator: 'contains', value: '' }]);

export const addGroup = (group: FilterGroup): FilterGroup => withRules(group, [...group.rules, emptyGroup()]);

export const removeRule = (group: FilterGroup, index: number): FilterGroup => withRules(group, group.rules.filter((_, i) => i !== index));

export const updateRule = (group: FilterGroup, index: number, rule: FilterRule): FilterGroup => withRules(group, group.rules.map((r, i) => (i === index ? rule : r)));

/** Merges into the condition at `index`; a group there (or nothing) is left alone and the tree is returned as is. */
export function patchCondition(group: FilterGroup, index: number, partial: Partial<Pick<FilterCondition, 'column' | 'operator' | 'value'>>): FilterGroup {
    const rule = group.rules[index];
    return rule?.type === 'condition' ? updateRule(group, index, { ...rule, ...partial }) : group;
}
