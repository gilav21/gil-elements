import { describe, expect, it } from 'vitest';
import {
    addCondition,
    addGroup,
    asText,
    builderColumns,
    dateFilterFn,
    dateRangeFilterFn,
    defaultDateRangePresets,
    emptyGroup,
    filterInputsOf,
    hasAnyFloatingFilter,
    hasFilterTrigger,
    hasFloatingFilter,
    isCompleteRange,
    isFilterActive,
    multiselectFilterFn,
    needsValue,
    normalizeSelection,
    OPERATOR_ORDER,
    patchCondition,
    removeRule,
    selectAllValues,
    selectionValue,
    setCombinator,
    toggleSelection,
    updateRule,
    sameFilterValue,
} from './data-table-filters.js';
import { validateConfig } from './data-table-config-check.js';
import { filterRows } from './data-table-query.js';
import type { ColumnDef, FilterCondition, FilterGroup } from './data-table.types.js';

// Ported from shadcn-angular sub/data-table-date-filter.component.spec.ts 243-350.
describe('dateFilterFn', () => {
    interface Row {
        createdAt: Date | string | number | null;
    }
    const at = (r: Row): unknown => r.createdAt;
    const day = new Date(2024, 5, 15);

    it('lets every row through without a filter value', () => {
        expect(dateFilterFn({ createdAt: new Date(2024, 5, 15) }, null, at)).toBe(true);
        expect(dateFilterFn({ createdAt: 'x' }, undefined, at)).toBe(true);
    });
    it('matches the same day at any time, not another day', () => {
        expect(dateFilterFn({ createdAt: new Date(2024, 5, 15, 14, 30) }, day, at)).toBe(true);
        expect(dateFilterFn({ createdAt: new Date(2024, 5, 16) }, day, at)).toBe(false);
    });
    it('matches ISO date-only and date-time strings by their local calendar day', () => {
        expect(dateFilterFn({ createdAt: '2024-06-15' }, day, at)).toBe(true);
        expect(dateFilterFn({ createdAt: '2024-06-15T23:59:00' }, day, at)).toBe(true);
        expect(dateFilterFn({ createdAt: '2024-06-16T00:01:00' }, day, at)).toBe(false);
        expect(dateFilterFn({ createdAt: '2024-06-14T23:59:00' }, day, at)).toBe(false);
    });
    it('handles timestamps', () => {
        expect(dateFilterFn({ createdAt: new Date(2024, 5, 15, 10).getTime() }, day, at)).toBe(true);
    });
    it('never matches an invalid or null cell', () => {
        expect(dateFilterFn({ createdAt: 'not-a-date' }, day, at)).toBe(false);
        expect(dateFilterFn({ createdAt: null }, day, at)).toBe(false);
    });
});

describe('dateRangeFilterFn', () => {
    interface Row {
        date: Date | string;
    }
    const at = (r: Row): unknown => r.date;
    const range = { start: new Date(2024, 5, 10), end: new Date(2024, 5, 20) };

    it('lets every row through without a range or with an empty one', () => {
        expect(dateRangeFilterFn({ date: new Date(2024, 5, 15) }, null, at)).toBe(true);
        expect(dateRangeFilterFn({ date: new Date(2024, 5, 15) }, { start: null, end: null }, at)).toBe(true);
    });
    it('is inclusive at both ends', () => {
        expect([9, 10, 15, 20, 21].map((d) => dateRangeFilterFn({ date: new Date(2024, 5, d, 12) }, range, at))).toEqual([false, true, true, true, false]);
    });
    it('is open-ended with only a start or only an end', () => {
        const from = { start: new Date(2024, 5, 15), end: null };
        expect([14, 15, 20].map((d) => dateRangeFilterFn({ date: new Date(2024, 5, d) }, from, at))).toEqual([false, true, true]);
        const until = { start: null, end: new Date(2024, 5, 15) };
        expect([10, 15, 16].map((d) => dateRangeFilterFn({ date: new Date(2024, 5, d) }, until, at))).toEqual([true, true, false]);
    });
    it('handles ISO strings and refuses an invalid cell', () => {
        expect(dateRangeFilterFn({ date: '2024-06-15T14:30:00.000Z' }, range, at)).toBe(true);
        expect(dateRangeFilterFn({ date: 'invalid' }, range, at)).toBe(false);
    });
});

// Ported from sub/data-table-multiselect-filter.component.spec.ts 209-232.
describe('date filter values of any shape (a saved view restored from JSON, a timestamp, garbage)', () => {
    const at = (date: unknown) => (row: { date: unknown }) => row.date;
    const row = { date: '2024-03-10' };
    const day = new Date(2024, 2, 10);

    it('dateFilterFn reads the filter value like a cell: an ISO string, a date-time string or a timestamp filters', () => {
        expect(dateFilterFn(row, '2024-03-10', at(0))).toBe(true);
        expect(dateFilterFn(row, '2024-03-11', at(0))).toBe(false);
        expect(dateFilterFn(row, JSON.parse(JSON.stringify(day)) as string, at(0))).toBe(true);
        expect(dateFilterFn(row, day.getTime(), at(0))).toBe(true);
    });

    it('dateFilterFn treats a value that is not a date as no filter, and never throws', () => {
        for (const bad of ['not a date', {}, [], true, Number.NaN, new Date('x')]) expect(dateFilterFn(row, bad as never, at(0))).toBe(true);
    });

    it('dateRangeFilterFn reads JSON-restored ends (ISO strings) and timestamps', () => {
        const restored = JSON.parse(JSON.stringify({ start: new Date(2024, 2, 1), end: new Date(2024, 2, 10) })) as { start: string; end: string };
        expect(dateRangeFilterFn(row, restored, at(0))).toBe(true);
        expect(dateRangeFilterFn({ date: '2024-03-11' }, restored, at(0))).toBe(false);
        expect(dateRangeFilterFn(row, { start: '2024-03-11', end: null }, at(0))).toBe(false);
        expect(dateRangeFilterFn(row, { start: null, end: new Date(2024, 2, 10).getTime() }, at(0))).toBe(true);
    });

    it('dateRangeFilterFn treats a value that is not a range, or a range of non-dates, as no filter, and never throws', () => {
        for (const bad of ['2024-03-11', 7, true, [], { start: 'x', end: {} }, { from: day }]) expect(dateRangeFilterFn(row, bad as never, at(0))).toBe(true);
    });
});

describe('multiselectFilterFn', () => {
    const at = (r: { s: string }): unknown => r.s;
    it('lets every row through for null or an empty list', () => {
        expect(multiselectFilterFn({ s: 'a' }, null, at)).toBe(true);
        expect(multiselectFilterFn({ s: 'a' }, [], at)).toBe(true);
    });
    it('matches a row whose value is in the list, by identity', () => {
        expect(multiselectFilterFn({ s: 'a' }, ['a', 'b'], at)).toBe(true);
        expect(multiselectFilterFn({ s: 'c' }, ['a', 'b'], at)).toBe(false);
    });
});

// Ported from sub/data-table-multiselect-filter.component.spec.ts 44-200 (the component's logic, without its DOM).
describe('multiselect selection rules', () => {
    it('toggles on in click order and off again; an empty selection is reported as null', () => {
        let selected = toggleSelection([], 'b');
        selected = toggleSelection(selected, 'a');
        expect(selectionValue(selected)).toEqual(['b', 'a']);
        selected = toggleSelection(toggleSelection(selected, 'b'), 'a');
        expect(selectionValue(selected)).toBeNull();
    });
    it('select all adds every option whatever the search, keeping a value that has no option', () => {
        expect(selectAllValues(['ghost'], ['a', 'b'], (o) => o)).toEqual(['ghost', 'a', 'b']);
        expect(selectionValue(selectAllValues([], [], (o) => o))).toBeNull();
    });
    it('reports valueWith values of object options', () => {
        const options = [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }];
        expect(selectAllValues([], options, (o) => o.id)).toEqual([1, 2]);
    });
    it('restores a selection given as the value, dropping duplicates and keeping option-less values', () => {
        expect(normalizeSelection(['a', 'a', 'zz'])).toEqual(['a', 'zz']);
        expect(normalizeSelection(null)).toEqual([]);
        expect(normalizeSelection('a')).toEqual([]);
    });
    it('reports a copy, not the panel state', () => {
        const selected = ['a'];
        expect(selectionValue(selected)).not.toBe(selected);
    });
});

describe('date-range presets and completeness', () => {
    it('builds Today, Last 7 days, Last 30 days and This month from local midnight', () => {
        const presets = defaultDateRangePresets({ todayLabel: 'Heute' }, new Date(2024, 5, 15, 17, 45));
        expect(presets.map((p) => p.label)).toEqual(['Heute', 'Last 7 days', 'Last 30 days', 'This month']);
        expect(presets[0]!.range).toEqual({ start: new Date(2024, 5, 15), end: new Date(2024, 5, 15) });
        expect(presets[1]!.range.start).toEqual(new Date(2024, 5, 9));
        expect(presets[2]!.range.start).toEqual(new Date(2024, 4, 17));
        expect(presets[3]!.range.start).toEqual(new Date(2024, 5, 1));
    });
    it('reports only a complete range', () => {
        expect(isCompleteRange({ start: new Date(), end: null })).toBe(false);
        expect(isCompleteRange({ start: new Date(), end: new Date() })).toBe(true);
        expect(isCompleteRange(new Date())).toBe(false);
        expect(isCompleteRange(null)).toBe(false);
    });
});

// Ported from data-table-advanced-filter.spec.ts 259-380 (DataTableFilterBuilderComponent): the tree operations, every edit a new tree.
describe('builder tree operations', () => {
    const columns = [{ key: 'name', header: 'Name' }, { key: 'age', header: 'Age' }];
    const first: FilterCondition = { type: 'condition', column: 'name', operator: 'equals', value: 'x' };
    const second: FilterCondition = { type: 'condition', column: 'age', operator: 'gt', value: 3 };
    const group: FilterGroup = { type: 'group', combinator: 'and', rules: [first, second] };

    it('appends a contains condition on the first column after the existing rules', () => {
        expect(addCondition(group, columns)).toEqual({ ...group, rules: [first, second, { type: 'condition', column: 'name', operator: 'contains', value: '' }] });
        expect(addCondition(emptyGroup(), [])).toEqual({ type: 'group', combinator: 'and', rules: [{ type: 'condition', column: '', operator: 'contains', value: '' }] });
    });
    it('appends an empty AND group', () => {
        expect(addGroup(group).rules[2]).toEqual({ type: 'group', combinator: 'and', rules: [] });
    });
    it('toggles the combinator and keeps the rules', () => {
        const next = setCombinator(group, 'or');
        expect(next.combinator).toBe('or');
        expect(next.rules).toEqual(group.rules);
    });
    it('removes only the rule at the index; an index out of range keeps the rules', () => {
        expect(removeRule(group, 0).rules).toEqual([second]);
        expect(removeRule(group, 9).rules).toEqual([first, second]);
    });
    it('patches a condition and leaves a group slot alone (the same tree back)', () => {
        expect(patchCondition(group, 0, { column: 'age', value: 'y' }).rules[0]).toMatchObject({ column: 'age', value: 'y', operator: 'equals' });
        expect(patchCondition(group, 1, { operator: 'lte' }).rules[1]).toMatchObject({ operator: 'lte', value: 3 });
        const withGroup: FilterGroup = { ...group, rules: [emptyGroup()] };
        expect(patchCondition(withGroup, 0, { column: 'age' })).toBe(withGroup);
        expect(patchCondition(group, 5, { column: 'age' })).toBe(group);
    });
    it('a valueless operator keeps the old value', () => {
        expect(patchCondition(group, 0, { operator: 'isEmpty' }).rules[0]).toMatchObject({ operator: 'isEmpty', value: 'x' });
    });
    it('replaces a rule wholesale (the bubble-up of a nested group)', () => {
        const nested: FilterGroup = { type: 'group', combinator: 'or', rules: [second] };
        expect(updateRule(group, 0, nested).rules[0]).toBe(nested);
    });
    it('never mutates the input tree', () => {
        const before = JSON.stringify(group);
        addCondition(group, columns);
        removeRule(group, 0);
        patchCondition(group, 0, { value: 'z' });
        setCombinator(group, 'or');
        expect(JSON.stringify(group)).toBe(before);
    });
    it('needsValue is false for the unary operators; asText stringifies', () => {
        expect(needsValue('isEmpty')).toBe(false);
        expect(needsValue('isNotEmpty')).toBe(false);
        expect(OPERATOR_ORDER.filter(needsValue)).toHaveLength(10);
        expect(asText(42)).toBe('42');
        expect(asText('hello')).toBe('hello');
        expect(asText(undefined)).toBe('');
    });
    it('offers the consumer columns, special ones left out', () => {
        expect(builderColumns<unknown>([{ accessorKey: '_selection', header: '' }, { accessorKey: 'a', header: 'A' }])).toEqual([{ key: 'a', header: 'A' }]);
    });
});

// Ported from data-table.component.spec.ts 1327-1390 and 2124-2236.
describe('filter state questions', () => {
    it('a column is active for a non-empty value only', () => {
        const filters = { a: 'x', b: '', c: [], d: { start: null, end: null }, e: null, f: ['y'], g: { start: new Date(), end: null }, h: 0 };
        expect(Object.keys(filters).filter((k) => isFilterActive(filters, k))).toEqual(['a', 'f', 'g', 'h']);
        expect(isFilterActive(filters, 'missing')).toBe(false);
        expect(isFilterActive(filters, 'toString')).toBe(false);
    });
    it('draws a trigger for enableFiltering with a panel only', () => {
        expect(hasFilterTrigger<unknown>({ accessorKey: 'a', header: 'A', enableFiltering: true, filterComponent: 'x-f' })).toBe(true);
        expect(hasFilterTrigger<unknown>({ accessorKey: 'a', header: 'A', enableFiltering: true })).toBe(false);
        expect(hasFilterTrigger<unknown>({ accessorKey: 'a', header: 'A', filterComponent: 'x-f' })).toBe(false);
    });
    it('hasFloatingFilter: opt-out, special columns, a component or renderer, enableFiltering', () => {
        const col = (c: Partial<ColumnDef<unknown>>): ColumnDef<unknown> => ({ accessorKey: 'a', header: 'A', ...c });
        expect(hasFloatingFilter(col({ enableFiltering: true }))).toBe(true);
        expect(hasFloatingFilter(col({ enableFiltering: true, floatingFilter: false }))).toBe(false);
        expect(hasFloatingFilter(col({ accessorKey: '_selection', enableFiltering: true }))).toBe(false);
        expect(hasFloatingFilter(col({ floatingFilterComponent: 'x-f' }))).toBe(true);
        expect(hasFloatingFilter(col({ floatingFilterRenderer: () => 'r' }))).toBe(true);
        expect(hasFloatingFilter(col({}))).toBe(false);
        expect(hasFloatingFilter(col({ floatingFilter: true }))).toBe(false);
        // Round 12 (deviation from Angular): a built-in structured header panel gets no default text input; an explicit floating control still draws.
        for (const tag of ['ge-data-table-date-filter', 'ge-data-table-date-range-filter', 'GE-DATA-TABLE-MULTISELECT-FILTER']) {
            expect(hasFloatingFilter(col({ enableFiltering: true, filterComponent: tag }))).toBe(false);
            expect(hasAnyFloatingFilter([col({ enableFiltering: true, filterComponent: tag })])).toBe(false);
            expect(hasFloatingFilter(col({ enableFiltering: true, filterComponent: tag, floatingFilterRenderer: () => 'r' }))).toBe(true);
        }
        expect(hasFloatingFilter(col({ enableFiltering: true, filterComponent: 'x-text-filter' }))).toBe(true);
    });
    it('hasAnyFloatingFilter counts what asks for the row, special columns aside', () => {
        expect(hasAnyFloatingFilter<unknown>([{ accessorKey: 'a', header: 'A' }])).toBe(false);
        expect(hasAnyFloatingFilter<unknown>([{ accessorKey: 'a', header: 'A', enableFiltering: true }])).toBe(true);
        expect(hasAnyFloatingFilter<unknown>([{ accessorKey: 'a', header: 'A', enableFiltering: true, floatingFilter: false }])).toBe(false);
        expect(hasAnyFloatingFilter<unknown>([{ accessorKey: 'a', header: 'A', floatingFilter: true }])).toBe(true);
    });
    it('filterComponentInputs: an object as is, none as {}, a factory called afresh every time', () => {
        expect(filterInputsOf<unknown>({ accessorKey: 'a', header: 'A', filterComponentInputs: { options: [1] } })).toEqual({ options: [1] });
        expect(filterInputsOf<unknown>({ accessorKey: 'a', header: 'A' })).toEqual({});
        let n = 0;
        const column: ColumnDef<unknown> = { accessorKey: 'a', header: 'A', filterComponentInputs: () => ({ n: ++n }) };
        expect(filterInputsOf(column)).toEqual({ n: 1 });
        expect(filterInputsOf(column)).toEqual({ n: 2 });
    });
});

describe('sameFilterValue (an equal write is a no-op; conservative since round 10)', () => {
    it('treats every "no filter" spelling as equal', () => {
        expect(sameFilterValue(null, undefined)).toBe(true);
        expect(sameFilterValue(undefined, null)).toBe(true);
        // Round 7: '' (and [], an empty range) is "no filter" too, the isFilterValueEmpty rule.
        expect(sameFilterValue(null, '')).toBe(true);
        expect(sameFilterValue('', undefined)).toBe(true);
        expect(sameFilterValue([], null)).toBe(true);
        expect(sameFilterValue({ start: null, end: null }, '')).toBe(true);
        expect(sameFilterValue('', 'a')).toBe(false);
    });

    it('is the same only for primitives (Object.is) and dates of the same instant (round 10: conservative)', () => {
        expect(sameFilterValue('ab', 'ab')).toBe(true);
        expect(sameFilterValue(3, 3)).toBe(true);
        expect(sameFilterValue(Number.NaN, Number.NaN)).toBe(true);
        expect(sameFilterValue('ab', 'abc')).toBe(false);
        expect(sameFilterValue(new Date(2024, 1, 3), new Date(2024, 1, 3))).toBe(true);
        expect(sameFilterValue(new Date(2024, 1, 3), new Date(2024, 1, 4))).toBe(false);
    });

    it('counts any array or object as a change, as Angular re-filters on every write (round 10)', () => {
        expect(sameFilterValue(['a', 'b'], ['a', 'b'])).toBe(false);
        const same = ['a'];
        expect(sameFilterValue(same, same)).toBe(false); // the SAME array, mutated and re-emitted
        expect(sameFilterValue(new Set(['a']), new Set(['b']))).toBe(false);
        expect(sameFilterValue(new Set(['a']), new Set(['a']))).toBe(false);
        expect(sameFilterValue([''], [null])).toBe(false);
        expect(sameFilterValue({ start: new Date(1), end: null }, { start: new Date(1), end: null })).toBe(false);
        expect(sameFilterValue(/a/, /a/)).toBe(false);
        expect(sameFilterValue('2024-01-01', new Date(2024, 0, 1))).toBe(false);
    });
});

describe('the package A config checks', () => {
    const base = { localPagination: true, showPagination: true, enableVirtualScroll: false, virtualActive: false, total: undefined };
    it('warns for a panel without enableFiltering, and for a BUILT-IN panel without a filterFn', () => {
        const warnings = validateConfig<unknown>({
            ...base,
            columns: [
                { accessorKey: 'a', header: 'A', filterComponent: 'x-f' },
                { accessorKey: 'b', header: 'B', enableFiltering: true, filterComponent: 'ge-data-table-date-filter' },
                { accessorKey: 'c', header: 'C', enableFiltering: true, filterComponent: 'ge-data-table-multiselect-filter' },
            ],
        });
        expect(warnings.filter((w) => w.includes('[a] have a filterComponent but no enableFiltering'))).toHaveLength(1);
        expect(warnings.filter((w) => w.includes('[b, c] have a built-in filter panel but no filterFn'))).toHaveLength(1);
    });
    it('warns about a floating component or renderer without enableFiltering: drawn (Angular parity) but filtering nothing (round 5)', () => {
        const columns: ColumnDef<unknown>[] = [
            { accessorKey: 'a', header: 'A', floatingFilterComponent: 'x-f' },
            { accessorKey: 'b', header: 'B', floatingFilterRenderer: () => '' },
            { accessorKey: 'c', header: 'C', floatingFilterComponent: 'x-f', enableFiltering: true, filterFn: () => true },
            { accessorKey: 'd', header: 'D', floatingFilterComponent: 'x-f', floatingFilter: false },
        ];
        expect(validateConfig<unknown>({ ...base, columns, enableFloatingFilters: true }).filter((w) => w.includes('floating filter component or renderer'))).toEqual([
            '[ge-data-table] Columns [a, b] have a floating filter component or renderer but no enableFiltering. The control is drawn but its value filters nothing; set enableFiltering.',
        ]);
        expect(hasFloatingFilter(columns[0]!)).toBe(true); // still drawn, as in Angular
        // Round 8: without the floating row nothing is drawn, so nothing to warn about.
        expect(validateConfig<unknown>({ ...base, columns }).filter((w) => w.includes('floating filter component or renderer'))).toEqual([]);
    });
    it('does not ask for a filterFn with server filtering (localFiltering off: nothing is matched here)', () => {
        const columns: ColumnDef<unknown>[] = [{ accessorKey: 'b', header: 'B', enableFiltering: true, filterComponent: 'ge-data-table-date-filter' }];
        expect(validateConfig<unknown>({ ...base, columns, localFiltering: false }).filter((w) => w.includes('filterFn'))).toEqual([]);
        expect(validateConfig<unknown>({ ...base, columns, localFiltering: true }).filter((w) => w.includes('filterFn'))).toHaveLength(1);
    });
    it('does not ask a consumer panel for a filterFn: it may report text the default match handles', () => {
        const columns: ColumnDef<unknown>[] = [{ accessorKey: 'a', header: 'A', enableFiltering: true, filterComponent: 'x-text-filter' }];
        expect(validateConfig<unknown>({ ...base, columns }).filter((w) => w.includes('filterFn'))).toEqual([]);
    });
    it('is quiet for a panel with both', () => {
        const columns: ColumnDef<unknown>[] = [{ accessorKey: 'a', header: 'A', enableFiltering: true, filterComponent: 'x-f', filterFn: () => true }];
        expect(validateConfig<unknown>({ ...base, columns }).filter((w) => w.includes('filterComponent'))).toEqual([]);
    });
});

describe('column filters through filterRows', () => {
    interface Row {
        name: string;
        day: string;
    }
    const rows: Row[] = [
        { name: 'Alice', day: '2024-06-15' },
        { name: 'Bob', day: '2024-06-16' },
        { name: 'Carol', day: '2024-06-15' },
    ];
    it('runs the column filterFn with the panel value (a date)', () => {
        const columns: ColumnDef<Row>[] = [{ accessorKey: 'day', header: 'Day', enableFiltering: true, filterFn: (row, value) => dateFilterFn(row, value as Date, (r) => r.day) }];
        expect(filterRows(rows, { columns, globalFilter: '', columnFilters: { day: new Date(2024, 5, 15) } }).map((r) => r.name)).toEqual(['Alice', 'Carol']);
    });
    it('runs a multiselect filterFn and skips an empty (null) one', () => {
        const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', enableFiltering: true, filterFn: (row, value) => multiselectFilterFn(row, value as unknown[], (r) => r.name) }];
        expect(filterRows(rows, { columns, globalFilter: '', columnFilters: { name: ['Bob'] } }).map((r) => r.name)).toEqual(['Bob']);
        expect(filterRows(rows, { columns, globalFilter: '', columnFilters: { name: null } })).toBe(rows);
    });
    it('ignores the filter of a column without enableFiltering', () => {
        const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name' }];
        expect(filterRows(rows, { columns, globalFilter: '', columnFilters: { name: 'Bob' } })).toBe(rows);
    });
});
