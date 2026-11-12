import { describe, expect, it } from 'vitest';
import {
    asEditableDate,
    computeAggregateValue,
    dateOnlyParts,
    defaultGetRowId,
    findDuplicateRowIds,
    getCellValue,
    isFilterValueEmpty,
    isSpecialColumnKey,
    parseNlFilterSpec,
    stringifyValue,
    isoDateTime,
    toLocalDateString,
} from './data-table.utils.js';

describe('stringifyValue', () => {
    it('stringifies primitives and treats null/undefined/functions as empty', () => {
        expect(stringifyValue('a')).toBe('a');
        expect(stringifyValue(12)).toBe('12');
        expect(stringifyValue(10n)).toBe('10');
        expect(stringifyValue(null)).toBe('');
        expect(stringifyValue(undefined)).toBe('');
        expect(stringifyValue(() => 1)).toBe('');
        expect(stringifyValue({ a: 1 })).toBe('{"a":1}');
    });

    it('does not throw on cyclic objects or BigInt inside an object', () => {
        const cyc: Record<string, unknown> = {};
        cyc['self'] = cyc;
        expect(stringifyValue(cyc)).toBe('[object Object]');
        expect(stringifyValue({ n: 1n })).toBe('[object Object]');
    });
});

describe('getCellValue', () => {
    const row = { a: { b: { c: 7 } }, 'x.y': 'literal', n: null };

    it('reads keys, dotted paths, and gives undefined at the first missing link', () => {
        expect(getCellValue(row, 'a.b.c')).toBe(7);
        expect(getCellValue(row, 'a.z.c')).toBeUndefined();
        expect(getCellValue(row, 'n.deeper')).toBeUndefined();
        expect(getCellValue(null as unknown as typeof row, 'a')).toBeUndefined();
    });

    it('lets accessorFn win', () => {
        expect(getCellValue(row, 'a.b.c', { accessorFn: () => 'fn' })).toBe('fn');
    });
});

describe('isFilterValueEmpty', () => {
    // Wave 5 review round 9: a range with no end set is empty however its keys are spelled ({ start: null }, undefined ends, `{}`); Angular
    // asks for both keys (cmp 3981), so `{ start: null }` there filters every row out.
    it.each([[undefined], [null], [''], [[]], [{ start: null, end: null }], [{ start: null }], [{ end: undefined }], [{ start: undefined, end: undefined }], [{}], [{ start: '', end: '' }], [{ start: '', end: null }], [{ end: '' }], [new Set()]])('%j is empty', (v) => {
        expect(isFilterValueEmpty(v)).toBe(true);
    });
    it.each([['a'], [0], [false], [['a']], [{ start: new Date(), end: null }], [{ end: new Date() }], [new Date()], [{ other: 1 }], [{ start: '2024-01-01', end: '' }], [{ start: null, end: null, includeBlanks: true }], [{ start: null, mode: 'x' }], [new Set(['a'])]])('%j is not empty', (v) => {
        expect(isFilterValueEmpty(v)).toBe(false);
    });
});

describe('isSpecialColumnKey', () => {
    it('knows the table-owned columns', () => {
        expect(isSpecialColumnKey('_selection')).toBe(true);
        expect(isSpecialColumnKey('name')).toBe(false);
    });
});

describe('defaultGetRowId', () => {
    it('uses id when there is one, including a bigint id', () => {
        expect(defaultGetRowId({ id: 5 })).toBe('5');
        expect(defaultGetRowId({ id: 5n })).toBe('5');
    });

    it('gives identical id-less rows different ids (Angular: JSON.stringify collides)', () => {
        const a = { name: 'dup' };
        const b = { name: 'dup' };
        expect(defaultGetRowId(a)).not.toBe(defaultGetRowId(b));
        expect(findDuplicateRowIds([a, b], defaultGetRowId)).toEqual([]);
    });

    it('is stable for the same object across calls and survives a mutation', () => {
        const a = { name: 'x' };
        const id = defaultGetRowId(a);
        a.name = 'y';
        expect(defaultGetRowId(a)).toBe(id);
    });

    it('does not throw on cyclic or BigInt-holding rows', () => {
        const cyc: Record<string, unknown> = {};
        cyc['me'] = cyc;
        expect(() => defaultGetRowId(cyc)).not.toThrow();
        expect(() => defaultGetRowId({ big: 1n })).not.toThrow();
    });

    it('reports the same object listed twice, and type-prefixes primitive rows', () => {
        const a = { name: 'x' };
        expect(findDuplicateRowIds([a, a, { name: 'z' }], defaultGetRowId)).toEqual([defaultGetRowId(a)]);
        expect(defaultGetRowId(1)).not.toBe(defaultGetRowId('1'));
    });
});

describe('computeAggregateValue', () => {
    it('sums, averages, min/max numeric values and ignores non-numeric', () => {
        const values = ['Alice', 10, 20, 'Bob', 30, 40];
        expect(computeAggregateValue(values, 'sum')).toBe('100');
        expect(computeAggregateValue(values, 'avg')).toBe('25');
        expect(computeAggregateValue(values, 'min')).toBe('10');
        expect(computeAggregateValue(values, 'max')).toBe('40');
    });
    it('skips empty cells instead of reading them as zero', () => {
        for (const empty of [null, undefined, '', '   ']) {
            expect(computeAggregateValue([empty, 5], 'min')).toBe('5');
            expect(computeAggregateValue([empty, 5], 'avg')).toBe('5');
            expect(computeAggregateValue([empty, 5], 'sum')).toBe('5');
            expect(computeAggregateValue([empty], 'max')).toBe('');
        }
        expect(computeAggregateValue([0, 5], 'min')).toBe('0');
    });
    it('counts every value, numeric or not', () => {
        expect(computeAggregateValue(['Alice', 10, 20], 'count')).toBe('3');
        expect(computeAggregateValue([], 'count')).toBe('0');
    });
    it('is empty for numeric aggregates over no numbers', () => {
        expect(computeAggregateValue(['a', 'b'], 'sum')).toBe('');
        expect(computeAggregateValue([], 'avg')).toBe('');
    });
    it('rounds averages to two decimals', () => {
        expect(computeAggregateValue([1, 2], 'avg')).toBe('1.5');
        expect(computeAggregateValue([1, 1, 2], 'avg')).toBe('1.33');
    });
    it('supports a custom function and ignores an unknown keyword', () => {
        expect(computeAggregateValue([1, 2, 3], (vals) => `n=${vals.length}`)).toBe('n=3');
        expect(computeAggregateValue([1, 2, 3], 'median' as unknown as 'sum')).toBe('');
    });
    it('does not overflow the stack on a huge list', () => {
        const big = Array.from({ length: 300_000 }, (...[, i]) => i);
        expect(computeAggregateValue(big, 'max')).toBe('299999');
        expect(computeAggregateValue(big, 'min')).toBe('0');
    });
    it('reads a key that is itself a property before treating it as a path', () => {
        const row = { 'pivot:2.5': 7, a: { b: 1 } };
        expect(getCellValue(row, 'pivot:2.5')).toBe(7);
        expect(getCellValue(row, 'a.b')).toBe(1);
    });
    it('formats a Date as its ISO text, not a quoted JSON string', () => {
        expect(stringifyValue(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z');
        expect(stringifyValue(new Date('nope'))).toBe('');
    });
});

describe('parseNlFilterSpec', () => {
    const KEYS = ['status', 'name'];
    it('keeps a string globalFilter and known columnFilters', () => {
        const raw = JSON.stringify({ globalFilter: 'x', columnFilters: { status: ['failed'], bogus: 1 } });
        expect(parseNlFilterSpec(raw, KEYS)).toEqual({ globalFilter: 'x', columnFilters: { status: ['failed'] } });
    });
    it('returns an empty spec for malformed or non-object input', () => {
        for (const raw of ['not json', '"a string"', 'null', '[]', '']) expect(parseNlFilterSpec(raw, KEYS)).toEqual({});
    });
    it('drops a non-string globalFilter and an all-unknown columnFilters', () => {
        expect(parseNlFilterSpec('{"globalFilter":3,"columnFilters":{"zzz":1}}', KEYS)).toEqual({});
    });
    it('cannot be used to rewrite the prototype', () => {
        const spec = parseNlFilterSpec('{"columnFilters":{"__proto__":{"polluted":1}}}', ['__proto__']);
        expect(Object.hasOwn(spec.columnFilters ?? {}, '__proto__')).toBe(true);
        expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
});

describe('date helpers', () => {
    it('reads a Date, ISO date-only as local midnight, a date-time as an instant, an epoch', () => {
        const d = new Date(2026, 2, 4);
        expect(asEditableDate(d)).toBe(d);
        const local = asEditableDate('2026-03-04');
        expect([local?.getFullYear(), local?.getMonth(), local?.getDate(), local?.getHours()]).toEqual([2026, 2, 4, 0]);
        expect(asEditableDate('2026-03-04T10:00:00Z')?.toISOString()).toBe('2026-03-04T10:00:00.000Z');
        expect(asEditableDate(0)?.getTime()).toBe(0);
    });

    it.each([['not a date'], ['2026-02-30'], [null], [undefined], [{}], [Number.NaN], [new Date(Number.NaN)]])('reads %j as no date', (v) => {
        expect(asEditableDate(v)).toBeNull();
    });

    it('formats in the local calendar and pads', () => {
        expect(toLocalDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    });

    // (The write-back in the cell's own shape is writeBackDate in data-table-edit.ts, node-tested there; toEditedDateValue was removed in wave 5.)

    it('reads a space-separated date-time like its T form (Safari reads the space form as Invalid Date)', () => {
        expect(isoDateTime('2024-01-03 10:20')).toBe('2024-01-03T10:20');
        expect(isoDateTime('2024-01-03 10:20:30')).toBe('2024-01-03T10:20:30');
        expect(isoDateTime('2024-01-03T10:20')).toBe('2024-01-03T10:20');
        expect(isoDateTime('soon')).toBe('soon');
        expect(asEditableDate('2024-01-03 10:20')?.getTime()).toBe(new Date('2024-01-03T10:20').getTime());
    });

    it('parses only strictly date-only strings', () => {
        expect(dateOnlyParts('2026-03-04')).toEqual({ y: 2026, m: 3, d: 4 });
        expect(dateOnlyParts('2026-3-4')).toBeNull();
        expect(dateOnlyParts('2026-03-04T00:00')).toBeNull();
    });
});
