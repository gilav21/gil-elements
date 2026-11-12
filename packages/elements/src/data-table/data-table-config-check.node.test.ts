import { describe, expect, it } from 'vitest';
import { validateConfig, type ConfigCheckInput } from './data-table-config-check.js';
import { defaultGetRowId } from './data-table.utils.js';

interface Row {
    id?: number;
    name?: string;
}

const ok: ConfigCheckInput<Row> = {
    columns: [{ accessorKey: 'name', header: 'N' }],
    localPagination: true,
    showPagination: true,
    enableVirtualScroll: false,
    virtualActive: false,
    total: 0,
};
const check = (over: Partial<ConfigCheckInput<Row>>) => validateConfig({ ...ok, ...over });

describe('validateConfig: wave 6', () => {
    it.each(['enableFillHandle', 'enableClipboardPaste'] as const)('warns when %s is on and no column has a valueSetter', (flag) => {
        expect(check({ [flag]: true }).some((m) => m.includes('no column has a valueSetter'))).toBe(true);
        const withSetter = { columns: [{ accessorKey: 'name' as const, header: 'N', valueSetter: (row: Row) => row }] };
        expect(check({ [flag]: true, ...withSetter }).some((m) => m.includes('no column has a valueSetter'))).toBe(false);
    });
    it('warns about row drag with an active group-by, not with one the table ignores', () => {
        const grouped = (over: Partial<ConfigCheckInput<Row>>) =>
            check({ enableRowDrag: true, localReorder: true, groupBy: 'name', ...over }).some((m) => m.includes('enable-row-drag with group-by'));
        expect(grouped({})).toBe(true);
        expect(grouped({ localReorder: false })).toBe(false);
        expect(grouped({ virtualActive: true })).toBe(false);
        expect(grouped({ enableRowDrag: false })).toBe(false);
    });
});

describe('validateConfig', () => {
    it('is silent for a sane configuration', () => {
        expect(validateConfig(ok)).toEqual([]);
    });
    it('warns about pagination together with forced virtual scroll', () => {
        expect(check({ enableVirtualScroll: true, virtualActive: true })).toHaveLength(1);
        expect(check({ enableVirtualScroll: true, virtualActive: true, showPagination: false })).toEqual([]);
    });
    it('warns about server pagination without a total, but not for an empty table', () => {
        expect(check({ localPagination: false, data: [{ name: 'a' }] })[0]).toContain('total');
        expect(check({ localPagination: false, data: [{ name: 'a' }], total: undefined })[0]).toContain('total');
        expect(check({ localPagination: false, data: [] })).toEqual([]);
        expect(check({ localPagination: false, data: [{ name: 'a' }], total: 1 })).toEqual([]);
    });
    it('does not ask for a total when no pager is drawn: hidden pager, or virtual scroll', () => {
        const server = { localPagination: false, data: [{ name: 'a' }], total: undefined };
        expect(check({ ...server, showPagination: false })).toEqual([]);
        expect(check({ ...server, enableVirtualScroll: true, virtualActive: true })).toEqual([]);
    });
    it('warns about virtual options without virtual scroll', () => {
        expect(check({ virtualVariableRowHeight: true })).toHaveLength(1);
        expect(check({ virtualRecycleComponents: true })).toHaveLength(1);
        expect(check({ virtualVariableRowHeight: true, virtualActive: true })).toEqual([]);
    });
    it('warns when auto virtual scroll is blocked by a pager', () => {
        expect(check({ enableVirtualScroll: 'auto' })).toHaveLength(1);
        expect(check({ enableVirtualScroll: 'auto', showPagination: false })).toEqual([]);
    });
    it('warns about sub-rows with row expansion, and group-by with sub-rows or virtual scroll', () => {
        const getRowId = (r: Row) => String(r.id);
        expect(check({ enableSubRows: true, enableRowExpansion: true, getRowId })).toHaveLength(1);
        expect(check({ groupBy: 'name', enableSubRows: true, getRowId })).toHaveLength(1);
        expect(check({ groupBy: 'name', virtualActive: true })).toHaveLength(1);
        expect(check({ groupBy: 'name' })).toEqual([]);
    });
    it('warns about the default row id for sub-rows and cell flash, not for a custom one', () => {
        expect(check({ enableSubRows: true })).toHaveLength(1);
        expect(check({ enableCellFlash: true, getRowId: defaultGetRowId })).toHaveLength(1);
        expect(check({ enableSubRows: true, getRowId: (r) => String(r.id) })).toEqual([]);
    });
    it('warns about floating filters without filterable columns', () => {
        expect(check({ enableFloatingFilters: true })).toHaveLength(1);
        expect(check({ enableFloatingFilters: true, columns: [{ accessorKey: 'name', header: 'N', enableFiltering: true }] })).toEqual([]);
    });
    it('warns about editable columns without a valueSetter, naming them', () => {
        const w = check({ columns: [{ accessorKey: 'name', header: 'N', editable: true }, { accessorKey: 'id', header: 'I', editable: true, valueSetter: (r) => r }] });
        expect(w).toHaveLength(1);
        expect(w[0]).toContain('[name]');
    });
    it('warns about duplicate accessor keys once per key', () => {
        const w = check({ columns: [{ accessorKey: 'a', header: '' }, { accessorKey: 'a', header: '' }, { accessorKey: 'a', header: '' }] });
        expect(w).toHaveLength(1);
        expect(w[0]).toContain('[a]');
    });
    it('warns about several rendering strategies on one column', () => {
        const w = check({ columns: [{ accessorKey: 'a', header: '', component: 'x-y', cell: () => '' }, { accessorKey: 'b', header: '', cell: () => '' }] });
        expect(w).toHaveLength(1);
        expect(w[0]).toContain('[a]');
    });
    it('warns about duplicate row ids only when a feature needs identity', () => {
        const data: Row[] = [{ id: 1 }, { id: 1 }, { id: 2 }];
        expect(check({ data })).toEqual([]);
        const w = check({ data, enableRowSelection: true });
        expect(w).toHaveLength(1);
        expect(w[0]).toContain('"1"');
    });
    it('does not warn about identical id-less rows, which the default id keeps apart', () => {
        expect(check({ data: [{ name: 'dup' }, { name: 'dup' }], enableRowSelection: true })).toEqual([]);
    });
    it('does not warn about a table with one row or none', () => {
        expect(check({ data: [], enableRowSelection: true })).toEqual([]);
        expect(check({ data: [{ id: 1 }], enableRowSelection: true })).toEqual([]);
    });
    it('prefixes every message', () => {
        for (const m of check({ enableFloatingFilters: true })) expect(m.startsWith('[ge-data-table]')).toBe(true);
    });
});

describe('validateConfig row ids', () => {
    it('does not warn about the default id when every row carries an id', () => {
        const rows = [{ id: 1 }, { id: 2 }];
        expect(check({ enableSubRows: true, enableCellFlash: true, data: rows })).toEqual([]);
    });
    it('warns when some rows have no id, or there is no data to tell', () => {
        expect(check({ enableSubRows: true, data: [{ id: 1 }, {}] }).join(' ')).toContain('getRowId');
        expect(check({ enableCellFlash: true }).join(' ')).toContain('getRowId');
    });
});

describe('validateConfig: edit history needs stable ids', () => {
    const editable = { columns: [{ accessorKey: 'name' as const, header: 'N', editable: true, valueSetter: (r: Row) => ({ ...r }) }], enableEditHistory: true };
    const check2 = (over: Partial<ConfigCheckInput<Row>>) => validateConfig({ ...ok, ...editable, ...over });
    it('warns when undo could not find a row again', () => {
        expect(check2({ data: [{ name: 'a' }] }).join(' ')).toContain('undo/redo cannot find the row');
    });
    it('is silent with row ids, a custom getRowId, history off, or no value setter', () => {
        expect(check2({ data: [{ id: 1 }] })).toEqual([]);
        expect(check2({ data: [{ name: 'a' }], getRowId: (r) => String(r.name) })).toEqual([]);
        expect(check2({ data: [{ name: 'a' }], enableEditHistory: false })).toEqual([]);
        expect(check2({ data: [{ name: 'a' }], columns: [{ accessorKey: 'name', header: 'N', editable: true, valueSetter: undefined }] }).join(' ')).not.toContain('undo');
    });
});
