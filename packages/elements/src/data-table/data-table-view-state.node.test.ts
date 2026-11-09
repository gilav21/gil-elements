import { describe, expect, it } from 'vitest';
import {
    applyColumnState,
    applyKeyOrder,
    applyViewState,
    currentQuery,
    EMPTY_LAYOUT,
    exportQuery,
    readColumnState,
    readViewState,
    sameQuery,
    type ColumnLayout,
    type ViewModel,
} from './data-table-view-state.js';
import type { ColumnDef, DataTableViewState } from './data-table.types.js';

const COLS: ColumnDef<unknown>[] = [
    { accessorKey: 'id', header: 'ID', width: '60px' },
    { accessorKey: 'name', header: 'Name', pin: 'left' },
    { accessorKey: 'age', header: 'Age' },
];

const MODEL: ViewModel = {
    layout: EMPTY_LAYOUT,
    sort: { column: '', direction: null },
    sortStates: [],
    columnFilters: {},
    advancedFilter: null,
    globalFilter: '',
    pagination: { pageIndex: 0, pageSize: 10 },
};

describe('applyKeyOrder', () => {
    it('sorts by position and puts unlisted keys last in their own order', () => {
        expect(applyKeyOrder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
        expect(applyKeyOrder(['a', 'b'], [])).toEqual(['a', 'b']);
    });
});

describe('readColumnState', () => {
    it('reports width, visibility, pin and order, with definition values as defaults', () => {
        const layout: ColumnLayout = { widths: { age: '90px' }, visibility: { id: false }, pins: {}, order: ['age', 'id', 'name'] };
        expect(readColumnState(COLS, layout)).toEqual([
            { columnKey: 'id', width: '60px', visible: false, pin: undefined, order: 1 },
            { columnKey: 'name', width: undefined, visible: true, pin: 'left', order: 2 },
            { columnKey: 'age', width: '90px', visible: true, pin: undefined, order: 0 },
        ]);
    });
    it('a runtime unpin (own undefined entry) overrides the definition pin', () => {
        const state = readColumnState(COLS, { ...EMPTY_LAYOUT, pins: { name: undefined } });
        expect(state[1]).toMatchObject({ pin: undefined });
        expect('pin' in (state[1] ?? {})).toBe(true);
    });
});

describe('applyColumnState', () => {
    const layout: ColumnLayout = { widths: { name: '200px' }, visibility: { name: false }, pins: { name: 'left' }, order: ['b', 'a'] };

    it('ignores null, undefined and empty lists', () => {
        expect(applyColumnState(layout, [])).toBe(layout);
        expect(applyColumnState(layout, null)).toBe(layout);
        expect(applyColumnState(layout, undefined)).toBe(layout);
    });
    it('merges: untouched columns and left-out fields keep their value', () => {
        const next = applyColumnState(layout, [{ columnKey: 'age', width: '50px' }]);
        expect(next).toEqual({ widths: { name: '200px', age: '50px' }, visibility: { name: false }, pins: { name: 'left' }, order: ['b', 'a'] });
    });
    it('keeps Angular merge semantics: width "" and visible undefined are skipped, pin present-as-undefined clears', () => {
        const next = applyColumnState(layout, [{ columnKey: 'name', width: '', visible: undefined, pin: undefined }]);
        expect(next.widths).toEqual({ name: '200px' });
        expect(next.visibility).toEqual({ name: false });
        expect(Object.hasOwn(next.pins, 'name')).toBe(true);
        expect(next.pins['name']).toBeUndefined();
    });
    it('absent pin key leaves the pin alone', () => {
        expect(applyColumnState(layout, [{ columnKey: 'name', visible: true }]).pins).toEqual({ name: 'left' });
    });
    it('replaces the order by the states carrying one, sorted', () => {
        const next = applyColumnState(layout, [{ columnKey: 'x', order: 2 }, { columnKey: 'y', order: 0 }, { columnKey: 'z' }]);
        expect(next.order).toEqual(['y', 'x']);
    });
    it('does not mutate the input layout', () => {
        const before = JSON.stringify(layout);
        applyColumnState(layout, [{ columnKey: 'age', width: '1px', visible: false, pin: 'right', order: 0 }]);
        expect(JSON.stringify(layout)).toBe(before);
    });
    it('treats column keys named like prototype members or __proto__ as plain data', () => {
        const next = applyColumnState(EMPTY_LAYOUT, [{ columnKey: '__proto__', width: '9px' }, { columnKey: 'constructor', visible: false }]);
        expect(Object.hasOwn(next.widths, '__proto__')).toBe(true);
        expect(Object.getPrototypeOf(next.widths)).toBe(Object.prototype);
        expect(next.visibility['constructor']).toBe(false);
    });
});

describe('saved views', () => {
    const arranged: ViewModel = {
        layout: { widths: { id: '70px' }, visibility: { age: false }, pins: {}, order: ['name', 'id', 'age'] },
        sort: { column: 'name', direction: 'desc' },
        sortStates: [{ column: 'name', direction: 'desc' }],
        columnFilters: { name: 'Person 1' },
        advancedFilter: { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'age', operator: 'gt', value: 3 }] },
        globalFilter: 'person',
        pagination: { pageIndex: 2, pageSize: 10 },
    };

    it('restores everything it captured, in one step, through a JSON round trip', () => {
        const token = JSON.parse(JSON.stringify(readViewState(COLS, arranged))) as DataTableViewState;
        const restored = applyViewState(MODEL, token);
        expect(restored).not.toBeNull();
        expect(restored?.sort).toEqual(arranged.sort);
        expect(restored?.sortStates).toEqual(arranged.sortStates);
        expect(restored?.columnFilters).toEqual(arranged.columnFilters);
        expect(restored?.advancedFilter).toEqual(arranged.advancedFilter);
        expect(restored?.globalFilter).toBe('person');
        expect(restored?.pagination).toEqual({ pageIndex: 2, pageSize: 10 });
        expect(restored?.layout.widths).toEqual({ id: '70px' });
        expect(restored?.layout.visibility).toMatchObject({ age: false });
        expect(restored?.layout.order).toEqual(['name', 'id', 'age']);
    });

    it('writes the current version', () => {
        expect(readViewState(COLS, MODEL).version).toBe(1);
    });

    it('refuses an unknown version, null, undefined and malformed tokens, changing nothing', () => {
        const good = readViewState(COLS, arranged);
        expect(applyViewState(MODEL, { ...good, version: 99 })).toBeNull();
        expect(applyViewState(MODEL, null)).toBeNull();
        expect(applyViewState(MODEL, undefined)).toBeNull();
        expect(applyViewState(MODEL, { ...good, pagination: { pageIndex: -1, pageSize: 10 } })).toBeNull();
        expect(applyViewState(MODEL, { ...good, pagination: { pageIndex: 1.5, pageSize: 10 } })).toBeNull();
        expect(applyViewState(MODEL, { ...good, pagination: { pageIndex: 0, pageSize: 0 } })).toBeNull();
        expect(applyViewState(MODEL, { ...good, columns: 'x' as never })).toBeNull();
        expect(applyViewState(MODEL, { ...good, sort: null as never })).toBeNull();
        expect(applyViewState(MODEL, { ...good, sortStates: [null] as never })).toBeNull();
        expect(applyViewState(MODEL, { ...good, columnFilters: [] as never })).toBeNull();
        expect(applyViewState(MODEL, { ...good, globalFilter: 3 as never })).toBeNull();
        expect(MODEL.globalFilter).toBe('');
    });
});

describe('query shape', () => {
    it('describes the current state and the export subset', () => {
        const q = currentQuery(MODEL);
        expect(q).toEqual({ globalFilter: '', columnFilters: {}, sort: MODEL.sort, sortStates: [], advancedFilter: null, page: MODEL.pagination });
        expect(exportQuery(MODEL)).toEqual({ globalFilter: '', columnFilters: {}, sort: MODEL.sort, sortStates: [] });
    });
    it('survives a JSON round trip', () => {
        const q = currentQuery(MODEL);
        expect(JSON.parse(JSON.stringify(q))).toEqual(q);
    });
    it('sameQuery is quiet for an equal rewrite and for an equal-but-rebuilt sort chain', () => {
        const a = currentQuery({ ...MODEL, sortStates: [{ column: 'n', direction: 'asc' }], pagination: { pageIndex: 1, pageSize: 5 } });
        const b = currentQuery({
            ...MODEL, columnFilters: MODEL.columnFilters, sortStates: [{ column: 'n', direction: 'asc' }], pagination: { pageIndex: 1, pageSize: 5 },
        });
        expect(sameQuery(a, b)).toBe(true);
    });
    it('sameQuery sees every genuine change', () => {
        const a = currentQuery(MODEL);
        const change = (patch: Partial<ViewModel>) => sameQuery(a, currentQuery({ ...MODEL, ...patch }));
        expect(change({ globalFilter: 'x' })).toBe(false);
        expect(change({ columnFilters: {} })).toBe(false); // by reference, as in Angular
        expect(change({ pagination: { pageIndex: 1, pageSize: 10 } })).toBe(false);
        expect(change({ pagination: { pageIndex: 0, pageSize: 25 } })).toBe(false);
        expect(change({ sort: { column: 'a', direction: 'asc' } })).toBe(false);
        expect(change({ sortStates: [{ column: 'a', direction: 'asc' }] })).toBe(false);
        expect(change({ advancedFilter: { type: 'group', combinator: 'and', rules: [] } })).toBe(false);
    });
});
