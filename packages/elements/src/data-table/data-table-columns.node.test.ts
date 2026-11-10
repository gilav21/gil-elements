import { describe, expect, it } from 'vitest';
import { cellVarsStyle, columnCssVars, computeColumnLayout, type ColumnLayoutInput } from './data-table-columns.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    a: string;
}
const col = (accessorKey: string, extra: Partial<ColumnDef<Row>> = {}): ColumnDef<Row> => ({ accessorKey, header: accessorKey, ...extra });

function layout(columns: ColumnDef<Row>[], extra: Partial<ColumnLayoutInput<Row>> = {}) {
    return computeColumnLayout<Row>({ columns, widths: {}, visibility: {}, order: [], pins: {}, enableRowSelection: false, enableRowExpansion: false, hasActions: false, ...extra });
}
const keys = (columns: ColumnDef<Row>[], extra: Partial<ColumnLayoutInput<Row>> = {}) => layout(columns, extra).columns.map((c) => String(c.accessorKey));

describe('computeColumnLayout', () => {
    it('keeps definition order, resolves widths and floors, and flags flexible columns', () => {
        const { columns, hasFlexible } = layout([col('a'), col('b', { width: '120px' }), col('c', { minWidth: '5rem' })]);
        expect(columns.map((c) => [c._width, c._minWidth])).toEqual([['auto', '80px'], ['120px', '80px'], ['auto', '5rem']]);
        expect(hasFlexible).toBe(true);
        expect(layout([col('a', { width: '10px' })]).hasFlexible).toBe(false);
    });

    it('orders pinned-left, middle, pinned-right whatever the definition order', () => {
        expect(keys([col('r', { pin: 'right' }), col('m'), col('l', { pin: 'left' }), col('m2')])).toEqual(['l', 'm', 'm2', 'r']);
    });

    it('stacks pin offsets as calc() sums of the real widths, so rem and % work', () => {
        const { columns } = layout([col('l1', { pin: 'left', width: '10rem' }), col('l2', { pin: 'left' }), col('m'), col('r1', { pin: 'right', width: '20%' }), col('r2', { pin: 'right', width: '60px' })]);
        const offsets = Object.fromEntries(columns.map((c) => [c.accessorKey, c._pinOffset]));
        expect(offsets).toEqual({ l1: '0px', l2: 'calc(10rem)', m: undefined, r1: 'calc(60px)', r2: '0px' });
        expect(columns.find((c) => c.accessorKey === 'l2')?._width).toBe('150px');
    });

    it('lets the runtime pins, widths, visibility and order override the definitions', () => {
        const columns = [col('a'), col('b', { pin: 'left' }), col('c')];
        expect(keys(columns, { pins: { b: undefined, c: 'left' } })).toEqual(['c', 'a', 'b']);
        expect(keys(columns, { visibility: { a: false } })).toEqual(['b', 'c']);
        expect(keys(columns, { order: ['c', 'a'] })).toEqual(['b', 'c', 'a']);
        expect(layout(columns, { widths: { a: '33px' } }).columns[1]?._width).toBe('33px');
    });

    it('adds the control columns: expander, then selection, pinned left with a zero floor; actions last', () => {
        const { columns } = layout([col('a')], { enableRowSelection: true, enableRowExpansion: true, hasActions: true });
        expect(columns.map((c) => c.accessorKey)).toEqual(['_expander', '_selection', 'a', '_actions']);
        expect(columns.map((c) => c._pin)).toEqual(['left', 'left', undefined, undefined]);
        expect(columns[0]?._minWidth).toBe('0px');
        expect(columns[1]?._pinOffset).toBe('calc(var(--ge-dt-expander-w, 40px))');
    });

    it('adds no control column the consumer already defined (columnHelper().select() and the like)', () => {
        const own = [col('_selection', { pin: 'left', width: '60px' }), col('a'), col('_actions', { width: '70px' })];
        const { columns } = layout(own, { enableRowSelection: true, hasActions: true, enableRowExpansion: true });
        expect(columns.map((c) => c.accessorKey)).toEqual(['_expander', '_selection', 'a', '_actions']);
        expect(columns.find((c) => c.accessorKey === '_selection')?._width).toBe('60px');
        expect(columns.find((c) => c.accessorKey === '_actions')?._width).toBe('70px');
    });

    it('adds no second control column when the consumer\'s own is hidden by columnVisibility', () => {
        const { columns } = layout([col('_selection', { pin: 'left' }), col('a')], { enableRowSelection: true, visibility: { _selection: false } });
        expect(columns.map((c) => c.accessorKey)).toEqual(['a']);
    });

    it('does not treat a key like a prototype member as a runtime override', () => {
        expect(keys([col('constructor')], { widths: {}, visibility: {} })).toEqual(['constructor']);
    });
});

describe('column custom properties', () => {
    it('writes width, floor and pin per column index, with auto as 0px', () => {
        const { columns } = layout([col('l', { pin: 'left', width: '50px' }), col('a')]);
        expect(columnCssVars(columns)).toBe('--ge-dt-col-0:50px;--ge-dt-colmin-0:80px;--ge-dt-pin-0:0px;--ge-dt-col-1:0px;--ge-dt-colmin-1:80px;');
        expect(cellVarsStyle(columns[0]!, 0)).toBe('--ge-dt-w:var(--ge-dt-col-0);--ge-dt-min:var(--ge-dt-colmin-0);--ge-dt-pin:var(--ge-dt-pin-0)');
        expect(cellVarsStyle(columns[1]!, 1)).toBe('--ge-dt-w:var(--ge-dt-col-1);--ge-dt-min:var(--ge-dt-colmin-1);');
    });
});

describe('duplicate accessor keys', () => {
    it('draws the first column of a key, as the query code does, and reports the key', async () => {
        const { duplicateColumnKeys } = await import('./data-table-columns.js');
        const columns = [col('a', { header: 'first' }), col('b'), col('a', { header: 'second' })];
        expect(layout(columns).columns.map((c) => c.header)).toEqual(['first', 'b']);
        expect(duplicateColumnKeys(columns)).toEqual(['a']);
        expect(duplicateColumnKeys([col('a'), col('b')])).toEqual([]);
    });
});
