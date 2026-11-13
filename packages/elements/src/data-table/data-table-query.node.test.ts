import { describe, expect, it, vi } from 'vitest';
import {
    activeSorts,
    ariaSortOf,
    buildSortComparator,
    countConditions,
    createQueryPipeline,
    evaluateAdvancedFilter,
    filterRows,
    matchesCondition,
    textIncludes,
    nextSortChain,
    pagesLocally,
    slicePage,
    localSortApplies,
    sortReordersRows,
    sortRows,
    type QueryInput,
} from './data-table-query.js';
import type { ColumnDef, FilterGroup } from './data-table.types.js';

describe('localSortApplies / sortReordersRows', () => {
    const cols = [{ accessorKey: 'a' }, { accessorKey: 'b' }] as ColumnDef<unknown>[];
    const asc = { column: 'a', direction: 'asc' as const };
    const none = { column: '', direction: null };
    it.each([
        [true, false, false, true],
        [false, false, true, false],
        [true, true, false, false],
        [true, true, true, true],
        [false, true, true, false],
    ])('localSortApplies(local %s, tree %s, sub %s) is %s', (local, tree, sub, expected) => {
        expect(localSortApplies(local, tree, sub)).toBe(expected);
    });
    it.each([
        ['a local single sort on a known column', false, asc, [], true, true],
        ['no sort', false, none, [], true, false],
        ['a server sort', false, asc, [], false, false],
        ['an unknown column', false, { column: 'zz', direction: 'asc' as const }, [], true, false],
        ['multi: the chain, not the single sort', true, asc, [], true, false],
        ['multi: a known chain entry', true, none, [{ column: 'b', direction: 'desc' as const }], true, true],
    ])('%s', (_name, multi, single, chain, local, expected) => {
        expect(sortReordersRows({ multi, sortState: single, multiSortState: chain, columns: cols, localSorting: local, tree: false, subRowSorting: false })).toBe(expected);
    });
    it.each([
        [false, false],
        [true, true],
    ])('in tree mode it needs sub-row sorting (sub %s -> %s)', (sub, expected) => {
        expect(sortReordersRows({ multi: false, sortState: asc, multiSortState: [], columns: cols, localSorting: true, tree: true, subRowSorting: sub })).toBe(expected);
    });
});

interface Row {
    id: number;
    name: string | null;
    age: number;
    tags?: string[];
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name', enableFiltering: true },
    { accessorKey: 'age', header: 'Age', enableFiltering: true },
    { accessorKey: '_actions', header: '' },
];
const ROWS: Row[] = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'bob', age: 25 },
    { id: 3, name: null, age: 41 },
    { id: 4, name: 'Carol', age: 25 },
];
const base = { columns: COLUMNS, globalFilter: '', columnFilters: {} };

describe('matchesCondition', () => {
    it('handles text operators case-insensitively', () => {
        expect(matchesCondition('Hello World', 'contains', 'WORLD')).toBe(true);
        expect(matchesCondition('Hello', 'notContains', 'z')).toBe(true);
        expect(matchesCondition('Hello', 'startsWith', 'he')).toBe(true);
        expect(matchesCondition('Hello', 'endsWith', 'LO')).toBe(true);
        expect(matchesCondition('Alice', 'equals', 'alice')).toBe(true);
        expect(matchesCondition('Alice', 'notEquals', 'bob')).toBe(true);
    });
    it('compares numbers numerically, strings that are numbers included', () => {
        expect(matchesCondition(10, 'gt', 9)).toBe(true);
        expect(matchesCondition('10', 'gte', '10')).toBe(true);
        expect(matchesCondition(5, 'lt', 6)).toBe(true);
        expect(matchesCondition(5, 'lte', 4)).toBe(false);
        expect(matchesCondition('10', 'equals', 10)).toBe(true);
        expect(matchesCondition('abc', 'gt', 1)).toBe(false);
    });
    it('handles empty and not-empty, blank strings and null included', () => {
        expect(matchesCondition('', 'isEmpty', undefined)).toBe(true);
        expect(matchesCondition('  ', 'isEmpty', undefined)).toBe(true);
        expect(matchesCondition(null, 'isEmpty', undefined)).toBe(true);
        expect(matchesCondition('x', 'isNotEmpty', undefined)).toBe(true);
    });
    it('matches everything for an unknown or inherited operator name', () => {
        expect(matchesCondition('x', 'bogus' as never, 'y')).toBe(true);
        expect(matchesCondition('x', 'constructor' as never, 'y')).toBe(true);
    });
});

describe('evaluateAdvancedFilter', () => {
    const get = (row: Record<string, unknown>) => (c: string) => row[c];
    const cond = (column: string, operator: 'equals' | 'gt', value: unknown) => ({ type: 'condition' as const, column, operator, value });
    it('matches an empty group', () => {
        expect(evaluateAdvancedFilter({ type: 'group', combinator: 'and', rules: [] }, get({}))).toBe(true);
    });
    it('AND needs every rule, OR any', () => {
        const rules = [cond('a', 'equals', 1), cond('b', 'equals', 2)];
        const row = { a: 1, b: 3 };
        expect(evaluateAdvancedFilter({ type: 'group', combinator: 'and', rules }, get(row))).toBe(false);
        expect(evaluateAdvancedFilter({ type: 'group', combinator: 'or', rules }, get(row))).toBe(true);
    });
    it('evaluates nested groups and counts conditions across them', () => {
        const tree: FilterGroup = {
            type: 'group',
            combinator: 'and',
            rules: [cond('a', 'gt', 0), { type: 'group', combinator: 'or', rules: [cond('b', 'equals', 9), cond('c', 'equals', 1)] }],
        };
        expect(evaluateAdvancedFilter(tree, get({ a: 1, b: 0, c: 1 }))).toBe(true);
        expect(evaluateAdvancedFilter(tree, get({ a: 1, b: 0, c: 0 }))).toBe(false);
        expect(countConditions(tree)).toBe(3);
        expect(countConditions(null)).toBe(0);
    });
});

describe('filterRows', () => {
    it('returns the same array when nothing filters', () => {
        expect(filterRows(ROWS, base)).toBe(ROWS);
    });
    it('global filter searches data columns case-insensitively and skips table-owned and opted-out columns', () => {
        expect(filterRows(ROWS, { ...base, globalFilter: 'ALI' }).map((r) => r.id)).toEqual([1]);
        expect(filterRows(ROWS, { ...base, globalFilter: '25' }).map((r) => r.id)).toEqual([2, 4]);
        const cols = COLUMNS.map((c) => (c.accessorKey === 'name' ? { ...c, enableGlobalFilter: false } : c));
        expect(filterRows(ROWS, { ...base, columns: cols, globalFilter: 'alice' })).toEqual([]);
    });
    it('uses a custom globalFilterFn with the lower-cased text and the data columns', () => {
        const fn = vi.fn((row: Row) => row.id === 3);
        expect(filterRows(ROWS, { ...base, globalFilter: 'Q', globalFilterFn: fn }).map((r) => r.id)).toEqual([3]);
        expect(fn.mock.calls[0]?.[1]).toBe('q');
        expect(fn.mock.calls[0]?.[2].map((c) => c.accessorKey)).toEqual(['id', 'name', 'age']);
    });
    it('column filters need enableFiltering, skip empty values, and use filterFn when given', () => {
        expect(filterRows(ROWS, { ...base, columnFilters: { name: 'o' } }).map((r) => r.id)).toEqual([2, 4]);
        expect(filterRows(ROWS, { ...base, columnFilters: { id: '1' } })).toBe(ROWS);
        expect(filterRows(ROWS, { ...base, columnFilters: { name: '' } })).toBe(ROWS);
        const cols = COLUMNS.map((c) => (c.accessorKey === 'age' ? { ...c, filterFn: (r: Row, v: unknown) => r.age > Number(v) } : c));
        expect(filterRows(ROWS, { ...base, columns: cols, columnFilters: { age: 29 } }).map((r) => r.id)).toEqual([1, 3]);
    });
    it('ignores a column filter keyed by an inherited property name', () => {
        expect(filterRows(ROWS, { ...base, columnFilters: { constructor: 'x' } })).toBe(ROWS);
    });
    it('applies all three filters together', () => {
        const advancedFilter: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'age', operator: 'gte', value: 25 }] };
        const out = filterRows(ROWS, { ...base, globalFilter: 'o', columnFilters: { name: 'b' }, advancedFilter });
        expect(out.map((r) => r.id)).toEqual([2]);
    });
    it('copes with an empty list', () => {
        expect(filterRows([], { ...base, globalFilter: 'x' })).toEqual([]);
    });
});

describe('sorting', () => {
    it('sorts ascending/descending with nulls first, and is stable', () => {
        expect(sortRows(ROWS, [{ column: 'name', direction: 'asc' }], COLUMNS).map((r) => r.id)).toEqual([3, 1, 4, 2]);
        expect(sortRows(ROWS, [{ column: 'age', direction: 'desc' }], COLUMNS).map((r) => r.id)).toEqual([3, 1, 2, 4]);
    });
    it('multi-sort breaks ties by the next column; unknown columns and empty directions are skipped', () => {
        const sorts = [
            { column: 'age', direction: 'asc' as const },
            { column: 'ghost', direction: 'asc' as const },
            { column: 'id', direction: 'desc' as const },
        ];
        expect(sortRows(ROWS, sorts, COLUMNS).map((r) => r.id)).toEqual([4, 2, 1, 3]);
        expect(buildSortComparator([{ column: 'age', direction: '' }], COLUMNS)(ROWS[0] as Row, ROWS[1] as Row)).toBe(0);
    });
    it('honours sortFn and flips it for desc', () => {
        const cols: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'N', sortFn: (a, b) => (a.name ?? '').length - (b.name ?? '').length }];
        expect(sortRows(ROWS, [{ column: 'name', direction: 'desc' }], cols).map((r) => r.id)).toEqual([1, 4, 2, 3]);
    });
    it('never mutates its input and copes with empty input', () => {
        const copy = [...ROWS];
        sortRows(ROWS, [{ column: 'age', direction: 'desc' }], COLUMNS);
        expect(ROWS).toEqual(copy);
        expect(sortRows([], [{ column: 'age', direction: 'asc' }], COLUMNS)).toEqual([]);
    });
    it('activeSorts picks the single or multi chain and drops incomplete entries', () => {
        const single = { column: 'a', direction: 'asc' as const };
        expect(activeSorts(false, single, [])).toEqual([single]);
        expect(activeSorts(false, { column: '', direction: 'asc' }, [])).toEqual([]);
        expect(activeSorts(true, single, [{ column: 'b', direction: null }, { column: 'c', direction: 'desc' }])).toEqual([{ column: 'c', direction: 'desc' }]);
    });
    it('ariaSortOf covers special, non-sortable, sorted and unsorted columns', () => {
        expect(ariaSortOf({ accessorKey: '_selection', header: '' }, null)).toBeNull();
        expect(ariaSortOf({ accessorKey: 'a', header: '', enableSorting: false }, 'asc')).toBeNull();
        expect(ariaSortOf({ accessorKey: 'a', header: '' }, 'asc')).toBe('ascending');
        expect(ariaSortOf({ accessorKey: 'a', header: '' }, 'desc')).toBe('descending');
        expect(ariaSortOf({ accessorKey: 'a', header: '' }, null)).toBe('none');
    });
    it('nextSortChain replaces, appends on multi, removes on no direction, and trims to the newest', () => {
        const chain = [{ column: 'a', direction: 'asc' as const }];
        expect(nextSortChain(chain, 'b', 'asc', false, 3).chain).toEqual([{ column: 'b', direction: 'asc' }]);
        expect(nextSortChain(chain, 'b', 'desc', true, 3).chain.map((s) => s.column)).toEqual(['a', 'b']);
        expect(nextSortChain(chain, 'a', 'desc', true, 3).chain).toEqual([{ column: 'a', direction: 'desc' }]);
        expect(nextSortChain(chain, 'a', null, true, 3)).toEqual({ chain: [], primary: { column: '', direction: null } });
        const trimmed = nextSortChain([{ column: 'a', direction: 'asc' }, { column: 'b', direction: 'asc' }], 'c', 'asc', true, 2);
        expect(trimmed.chain.map((s) => s.column)).toEqual(['b', 'c']);
        expect(nextSortChain(chain, 'c', 'asc', true, 0).chain.map((s) => s.column)).toEqual(['c']);
    });
});

describe('paging', () => {
    it('slices a page, including a short last page and a page past the end', () => {
        expect(slicePage([1, 2, 3, 4, 5], { pageIndex: 1, pageSize: 2 })).toEqual([3, 4]);
        expect(slicePage([1, 2, 3, 4, 5], { pageIndex: 2, pageSize: 2 })).toEqual([5]);
        expect(slicePage([1, 2, 3], { pageIndex: 9, pageSize: 2 })).toEqual([]);
    });
    it('pages locally only while a pager can reach the pages', () => {
        expect(pagesLocally(true, true, false)).toBe(true);
        expect(pagesLocally(true, false, false)).toBe(false);
        expect(pagesLocally(true, true, true)).toBe(false);
        expect(pagesLocally(false, true, false)).toBe(false);
    });
});

describe('createQueryPipeline', () => {
    const input = (over: Partial<QueryInput<Row>> = {}): QueryInput<Row> => ({
        ...base, data: ROWS, localFiltering: true, localSorting: true, sorts: [], ...over,
    });

    it('returns identical arrays for identical inputs', () => {
        const run = createQueryPipeline<Row>();
        const a = run(input());
        const b = run(input());
        expect(b.filtered).toBe(a.filtered);
        expect(b.sorted).toBe(a.sorted);
    });

    it('a range-like value with a key of its own is a real filter: it reaches filterFn (round 14)', () => {
        const run = createQueryPipeline<Row>();
        const value = { start: null, end: null, includeBlanks: true };
        const filterFn = vi.fn(() => true);
        const columns = COLUMNS.map((c) => (c.accessorKey === 'age' ? { ...c, enableFiltering: true, filterFn } : c));
        run(input({ columns, columnFilters: { age: value } }));
        expect(filterFn).toHaveBeenCalled();
        expect(filterFn.mock.calls[0]![1]).toBe(value);
        // Round 23: a key-less object is a value as on main (it reaches filterFn).
        filterFn.mockClear();
        run(input({ columns, columnFilters: { age: {} } }));
        expect(filterFn).toHaveBeenCalled();
        // A bare empty range is still no filter.
        filterFn.mockClear();
        run(input({ columns, columnFilters: { age: { start: null, end: '' } } }));
        expect(filterFn).not.toHaveBeenCalled();
    });

    it('changing the sort does not re-run the filters', () => {
        const run = createQueryPipeline<Row>();
        const filterFn = vi.fn((r: Row) => r.age > 0);
        const columns = COLUMNS.map((c) => (c.accessorKey === 'age' ? { ...c, filterFn } : c));
        const columnFilters = { age: 1 };
        const first = run(input({ columns, columnFilters }));
        const calls = filterFn.mock.calls.length;
        const second = run(input({ columns, columnFilters, sorts: [{ column: 'age', direction: 'asc' }] }));
        expect(filterFn.mock.calls.length).toBe(calls);
        expect(second.filtered).toBe(first.filtered);
        expect(second.sorted).not.toBe(first.sorted);
    });

    it('server mode passes data through untouched', () => {
        const run = createQueryPipeline<Row>();
        const out = run(input({ localFiltering: false, localSorting: false, globalFilter: 'zzz', sorts: [{ column: 'age', direction: 'asc' }] }));
        expect(out.filtered).toBe(ROWS);
        expect(out.sorted.map((r) => r.id)).toEqual([1, 2, 3, 4]);
    });

    it('re-filters when the data changes identity', () => {
        const run = createQueryPipeline<Row>();
        run(input({ globalFilter: 'a' }));
        expect(run(input({ globalFilter: 'a', data: [] })).sorted).toEqual([]);
    });

    it('10k rows filter + sort stays fast (soft bound)', () => {
        const data = Array.from({ length: 10_000 }, (...[, i]): Row => ({ id: i, name: `n${i % 97}`, age: i % 50 }));
        const run = createQueryPipeline<Row>();
        const t = performance.now();
        run(input({ data, globalFilter: 'n1', sorts: [{ column: 'age', direction: 'desc' }] }));
        expect(performance.now() - t).toBeLessThan(500);
    });
});

describe('empty cells and text in filters', () => {
    it('never read a blank as zero in a numeric rule, and only isEmpty selects it', () => {
        for (const blank of [null, undefined, '', '  ']) {
            expect(matchesCondition(blank, 'lt', 5)).toBe(false);
            expect(matchesCondition(blank, 'lte', 5)).toBe(false);
            expect(matchesCondition(blank, 'gte', 0)).toBe(false);
            expect(matchesCondition(blank, 'equals', 0)).toBe(false);
            expect(matchesCondition(blank, 'isEmpty', '')).toBe(true);
        }
        expect(matchesCondition(0, 'equals', 0)).toBe(true);
        expect(matchesCondition(3, 'lt', 5)).toBe(true);
    });
    it('matches a Date by its ISO text and an empty cell by nothing in the default search', () => {
        expect(matchesCondition(new Date('2026-01-01T00:00:00.000Z'), 'startsWith', '2026-01')).toBe(true);
        expect(textIncludes(null, 'null')).toBe(false);
        expect(textIncludes(undefined, 'undef')).toBe(false);
        expect(textIncludes({ a: 1 }, 'object')).toBe(false);
        expect(textIncludes('Alice', 'LIC')).toBe(true);
    });
});
