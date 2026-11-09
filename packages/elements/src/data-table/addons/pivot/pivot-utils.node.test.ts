import { describe, expect, it } from 'vitest';
import { computePivot, PIVOT_KEY_PREFIX, toAggregatableNumber, type PivotConfig } from './pivot-utils.js';

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
});

describe('toAggregatableNumber', () => {
    it.each([[3, 3], ['4.5', 4.5], [' 7 ', 7]])('reads %j', (v, n) => expect(toAggregatableNumber(v)).toBe(n));
    it.each([[null], [undefined], [''], [' '], [false], [true], [Number.NaN], [Infinity], ['x'], [{}]])('skips %j', (v) => {
        expect(toAggregatableNumber(v)).toBeNull();
    });
});
