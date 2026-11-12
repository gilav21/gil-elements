/**
 * The pure half of the column and advanced filter UI (wave 5, package A): the three filter functions a consumer pairs with the ready-made
 * panels, the questions the header and the floating row ask, the multiselect selection rules and the builder's tree operations. No DOM,
 * no lit: node-tested, and the panels (lazy) and the controller (static) share it. Angular sources: sub/data-table-date-filter,
 * sub/data-table-date-range-filter, sub/data-table-multiselect-filter, sub/data-table-filter-builder, cmp 2523-2560 and 3943-3980.
 */
import type { CalendarLocale } from '../shared/calendar-locales.js';
import type { ColumnDef, DataTableDateRange, FilterCondition, FilterGroup, FilterOperator, FilterRule } from './data-table.types.js';
import { asEditableDate, isFilterValueEmpty, isSpecialColumnKey, stringifyValue } from './data-table.utils.js';

// ---- filter functions (exported from the package index) ---------------------------------------------------------------------------

/** Local midnight of `d`, as a timestamp: the day granularity every date filter compares at. */
export const toDateOnlyTimestamp = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * The date panel's filter: the cell (a `Date`, an ISO date or date-time string, a timestamp) falls on the picked day. No filter value lets
 * every row through; a cell that is not a date never matches. Use it as `filterFn: (row, value) => dateFilterFn(row, value, (r) => r.date)`.
 */
export function dateFilterFn<R>(row: R, filterValue: Date | null | undefined, getValue: (row: R) => unknown): boolean {
    if (!filterValue) return true;
    const cell = asEditableDate(getValue(row));
    if (!cell) return false;
    return toDateOnlyTimestamp(cell) === toDateOnlyTimestamp(filterValue);
}

/** The date-range panel's filter: inclusive at both ends, open-ended when one end is null; an empty range lets every row through. */
export function dateRangeFilterFn<R>(row: R, filterValue: DataTableDateRange | null | undefined, getValue: (row: R) => unknown): boolean {
    if (!filterValue || (!filterValue.start && !filterValue.end)) return true;
    const cell = asEditableDate(getValue(row));
    if (!cell) return false;
    const ts = toDateOnlyTimestamp(cell);
    if (filterValue.start && ts < toDateOnlyTimestamp(filterValue.start)) return false;
    return !filterValue.end || ts <= toDateOnlyTimestamp(filterValue.end);
}

/** The multiselect panel's filter: the cell value is one of the selected values (by identity); no selection lets every row through. */
export function multiselectFilterFn<R>(row: R, filterValue: readonly unknown[] | null | undefined, getValue: (row: R) => unknown): boolean {
    if (!filterValue || filterValue.length === 0) return true;
    return filterValue.includes(getValue(row));
}

// ---- header trigger and floating row ------------------------------------------------------------------------------------------------

/** The column holds a filter value that filters (`!isFilterValueEmpty`): the header's "filtered" state. */
export const isFilterActive = (filters: Readonly<Record<string, unknown>>, key: string): boolean => !isFilterValueEmpty(Object.hasOwn(filters, key) ? filters[key] : undefined);

/** The header draws a filter trigger: `enableFiltering` and a panel (`filterComponent`), never on a special column (Angular html 633). */
export const hasFilterTrigger = <T>(column: ColumnDef<T>): boolean => !!column.enableFiltering && !!column.filterComponent && !isSpecialColumnKey(column.accessorKey);

/** The floating row draws a control for this column (cmp 2538): not opted out, not special, and a component, a renderer or `enableFiltering`. */
export function hasFloatingFilter<T>(column: ColumnDef<T>): boolean {
    if (column.floatingFilter === false || isSpecialColumnKey(column.accessorKey)) return false;
    return !!column.floatingFilterComponent || !!column.floatingFilterRenderer || !!column.enableFiltering;
}

/** Some column asks for the floating row (cmp 2523, Angular's test, which also counts a bare `floatingFilter: true`). */
export const hasAnyFloatingFilter = <T>(columns: readonly ColumnDef<T>[]): boolean =>
    columns.some((c) => !isSpecialColumnKey(c.accessorKey) && (c.floatingFilter === true || !!c.floatingFilterComponent || !!c.floatingFilterRenderer || (!!c.enableFiltering && c.floatingFilter !== false)));

/** `filterComponentInputs`, read afresh (a factory is called on every render, cmp 3943). */
export const filterInputsOf = <T>(column: ColumnDef<T>): Record<string, unknown> =>
    (typeof column.filterComponentInputs === 'function' ? column.filterComponentInputs() : column.filterComponentInputs) ?? {};

// ---- multiselect panel ---------------------------------------------------------------------------------------------------------------

/** What the panel reports for a selection: `null` for an empty one (no filter), else a copy. */
export const selectionValue = (selected: readonly unknown[]): unknown[] | null => (selected.length === 0 ? null : [...selected]);

/** The selection as given, duplicates dropped, values without an option kept (Angular's `selected` effect). */
export const normalizeSelection = (selected: unknown): unknown[] => (Array.isArray(selected) ? [...new Set(selected)] : []);

/** Adds the value at the end (selection order is click order) or removes it. */
export const toggleSelection = (selected: readonly unknown[], value: unknown): unknown[] => (selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);

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

export interface FilterBuilderColumn {
    key: string;
    header: string;
}

/** The order of the operator select. */
export const OPERATOR_ORDER: readonly FilterOperator[] = ['contains', 'notContains', 'equals', 'notEquals', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'];

const VALUELESS: ReadonlySet<FilterOperator> = new Set(['isEmpty', 'isNotEmpty']);

/** False for the unary operators, which hide the value input (the rule keeps its old value). */
export const needsValue = (operator: FilterOperator): boolean => !VALUELESS.has(operator);

/** A rule's value as the text input shows it. */
export const asText = (value: unknown): string => stringifyValue(value);

/** The empty AND group the builder shows while no advanced filter is set. */
export const emptyGroup = (): FilterGroup => ({ type: 'group', combinator: 'and', rules: [] });

/** The columns the builder offers: the consumer's columns, special ones left out. */
export const builderColumns = <T>(columns: readonly ColumnDef<T>[]): FilterBuilderColumn[] =>
    columns.filter((c) => !isSpecialColumnKey(c.accessorKey)).map((c) => ({ key: String(c.accessorKey), header: c.header }));

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
