import { describe, expect, it } from 'vitest';
import { computePivot, PIVOT_KEY_PREFIX, pivotToColumns, toAggregatableNumber, type PivotConfig } from './pivot-utils.js';

interface Sale {
    region: string;
    sub?: string;
    quarter: string;
    amount: unknown;
}
const DATA: Sale[] = [
    { region: 'N', quarter: 'Q2', amount: 10 },
    { region: 'N', quarter: 'Q1', amount: 5 },
    { region: 'S', quarter: 'Q1', amount: '7' },
    { region: 'N', quarter: 'Q1', amount: 1 },
];
const cfg = (over: Partial<PivotConfig> = {}): PivotConfig => ({ rows: ['region'], column: 'quarter', value: 'amount', aggregate: 'sum', ...over });
const key = (v: string) => PIVOT_KEY_PREFIX + v;

describe('computePivot', () => {
    it('spreads sorted column values and sums per cell', () => {
        const r = computePivot(DATA, cfg());
        expect(r.pivotColumnKeys).toEqual([key('Q1'), key('Q2')]);
        expect(r.columns.map((c) => c.header)).toEqual(['region', 'Q1', 'Q2']);
        expect(r.rows).toEqual([
            { region: 'N', [key('Q1')]: 6, [key('Q2')]: 10 },
            { region: 'S', [key('Q1')]: 7, [key('Q2')]: 0 },
        ]);
    });
    it('adds a total column on request', () => {
        const r = computePivot(DATA, cfg({ showRowTotals: true }));
        expect(r.rows.map((x) => x['__total__'])).toEqual([16, 7]);
        expect(r.columns.at(-1)).toEqual({ key: '__total__', header: 'Total' });
    });
    it('supports several row dimensions without merging ambiguous tuples', () => {
        const data: Sale[] = [
            { region: 'a b', sub: 'c', quarter: 'Q1', amount: 1 },
            { region: 'a', sub: 'b c', quarter: 'Q1', amount: 2 },
        ];
        const r = computePivot(data, cfg({ rows: ['region', 'sub'] }));
        expect(r.rows).toHaveLength(2);
    });
    it('aggregates only numbers, leaving a cell with none blank (not zero)', () => {
        const data: Sale[] = [
            { region: 'N', quarter: 'Q1', amount: null },
            { region: 'N', quarter: 'Q1', amount: '' },
            { region: 'N', quarter: 'Q1', amount: ' ' },
            { region: 'N', quarter: 'Q1', amount: false },
            { region: 'N', quarter: 'Q1', amount: 'abc' },
            { region: 'S', quarter: 'Q1', amount: 4 },
        ];
        for (const aggregate of ['avg', 'min', 'max'] as const) {
            expect(computePivot(data, cfg({ aggregate })).rows[0]?.[key('Q1')], aggregate).toBeNull();
        }
        expect(computePivot(data, cfg({ aggregate: 'sum' })).rows[0]?.[key('Q1')]).toBe(0);
        expect(computePivot(data, cfg({ aggregate: 'count' })).rows[0]?.[key('Q1')]).toBe(5);
    });
    it('rounds averages to two decimals and finds min/max', () => {
        const data: Sale[] = [1, 1, 2].map((amount) => ({ region: 'N', quarter: 'Q1', amount }));
        expect(computePivot(data, cfg({ aggregate: 'avg' })).rows[0]?.[key('Q1')]).toBe(1.33);
        expect(computePivot(data, cfg({ aggregate: 'min' })).rows[0]?.[key('Q1')]).toBe(1);
        expect(computePivot(data, cfg({ aggregate: 'max' })).rows[0]?.[key('Q1')]).toBe(2);
    });
    it('copes with empty data and a custom value reader', () => {
        expect(computePivot([], cfg())).toEqual({ columns: [{ key: 'region', header: 'region' }], rows: [], pivotColumnKeys: [] });
        const r = computePivot([[1, 'x', 2]], cfg({ rows: ['0'], column: '1', value: '2' }), (row, k) => (row as unknown[])[Number(k)]);
        expect(r.rows).toEqual([{ 0: 1, [key('x')]: 2 }]);
    });
    it('keeps a column value named like a prototype member as data', () => {
        const r = computePivot([{ region: 'N', quarter: '__proto__', amount: 3 }], cfg());
        expect(r.rows[0]?.[key('__proto__')]).toBe(3);
    });

    // Wave 7 (package B): the Angular cases not ported in wave 1, and the spec C edge cases.
    it('counts rows per cell with the count aggregate (Angular spec 40)', () => {
        const r = computePivot(DATA, cfg({ aggregate: 'count' }));
        expect(r.rows).toEqual([
            { region: 'N', [key('Q1')]: 2, [key('Q2')]: 1 },
            { region: 'S', [key('Q1')]: 1, [key('Q2')]: 0 },
        ]);
    });
    it('returns 0 from an unknown aggregate over non-empty values (Angular spec 120)', () => {
        const r = computePivot(DATA, cfg({ aggregate: 'bogus' as unknown as 'sum' }));
        expect(r.rows[0]?.[key('Q1')]).toBe(0);
    });
    it('keeps row dimension values and keys named like prototype members as own data', () => {
        const data = [
            { region: '__proto__', quarter: 'Q1', amount: 1 },
            { region: 'constructor', quarter: 'Q1', amount: 2 },
        ];
        const r = computePivot(data, cfg());
        expect(r.rows.map((row) => Object.hasOwn(row, 'region') && row['region'])).toEqual(['__proto__', 'constructor']);
        const own = JSON.parse('{"__proto__":"x","quarter":"Q1","amount":1}') as Sale; // an own `__proto__` key, as parsed JSON data has
        const byKey = computePivot([own], cfg({ rows: ['__proto__'] }), (row, k) => (Object.hasOwn(row, k) ? (row as unknown as Record<string, unknown>)[k] : undefined));
        expect(Object.getOwnPropertyDescriptor(byKey.rows[0], '__proto__')?.value).toBe('x');
        expect(Object.getPrototypeOf(byKey.rows[0])).toBe(Object.prototype);
    });
    it('keeps a column value named like the total key apart from the total column', () => {
        const r = computePivot([{ region: 'N', quarter: '__total__', amount: 4 }], cfg({ showRowTotals: true }));
        expect(r.rows[0]).toEqual({ region: 'N', [key('__total__')]: 4, __total__: 4 });
        expect(r.columns.map((c) => c.key)).toEqual(['region', key('__total__'), '__total__']);
    });
    it('skips NaN and Infinity, as numbers and as text', () => {
        const data = [Number.NaN, Infinity, -Infinity, 'NaN', 'Infinity', 5].map((amount) => ({ region: 'N', quarter: 'Q1', amount }));
        expect(computePivot(data, cfg()).rows[0]?.[key('Q1')]).toBe(5);
        expect(computePivot(data, cfg({ aggregate: 'max' })).rows[0]?.[key('Q1')]).toBe(5);
    });
    it('does not merge row dimension values that differ only by case (documented)', () => {
        const r = computePivot([{ region: 'n', quarter: 'Q1', amount: 1 }, { region: 'N', quarter: 'Q1', amount: 2 }], cfg());
        expect(r.rows).toHaveLength(2);
    });
    it('pivots 50k rows over 100 column values in reasonable time', () => {
        const data = Array.from({ length: 50_000 }, (_, i) => ({ region: `r${i % 20}`, quarter: `c${i % 100}`, amount: i }));
        const start = performance.now();
        const r = computePivot(data, cfg({ showRowTotals: true }));
        expect(r.pivotColumnKeys).toHaveLength(100);
        expect(r.rows).toHaveLength(20);
        expect(performance.now() - start).toBeLessThan(2000); // soft: about 50 ms locally
    });
});

describe('pivotToColumns', () => {
    it('maps the pivot columns to table columns', () => {
        const r = computePivot(DATA, cfg({ showRowTotals: true }));
        expect(pivotToColumns(r)).toEqual([
            { accessorKey: 'region', header: 'region' },
            { accessorKey: key('Q1'), header: 'Q1' },
            { accessorKey: key('Q2'), header: 'Q2' },
            { accessorKey: '__total__', header: 'Total' },
        ]);
    });
});

describe('toAggregatableNumber', () => {
    it.each([[3, 3], ['4.5', 4.5], [' 7 ', 7]])('reads %j', (v, n) => expect(toAggregatableNumber(v)).toBe(n));
    it.each([[null], [undefined], [''], [' '], [false], [true], [Number.NaN], [Infinity], ['x'], [{}]])('skips %j', (v) => {
        expect(toAggregatableNumber(v)).toBeNull();
    });
});
