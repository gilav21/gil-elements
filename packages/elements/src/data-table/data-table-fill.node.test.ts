import { describe, expect, it } from 'vitest';
import { buildFillValues } from './data-table-fill.js';

describe('buildFillValues', () => {
    it('returns nothing for a non-positive or NaN count', () => {
        expect(buildFillValues([1, 2], 0)).toEqual([]);
        expect(buildFillValues([1, 2], -3)).toEqual([]);
        expect(buildFillValues([1, 2], Number.NaN)).toEqual([]);
    });

    it('extrapolates an arithmetic number series', () => {
        expect(buildFillValues([1, 2, 3], 3)).toEqual([4, 5, 6]);
        expect(buildFillValues([2, 4], 3)).toEqual([6, 8, 10]);
        expect(buildFillValues([10, 7], 2)).toEqual([4, 1]);
    });

    it('repeats a single number', () => {
        expect(buildFillValues([5], 3)).toEqual([5, 5, 5]);
    });

    it('does not treat NaN or Infinity as a number series', () => {
        expect(buildFillValues([Number.NaN], 2)).toEqual([Number.NaN, Number.NaN]);
    });

    it('increments trailing numbers and keeps zero padding', () => {
        expect(buildFillValues(['Item 1', 'Item 2'], 2)).toEqual(['Item 3', 'Item 4']);
        expect(buildFillValues(['Q1'], 3)).toEqual(['Q2', 'Q3', 'Q4']);
        expect(buildFillValues(['SKU-008', 'SKU-009'], 2)).toEqual(['SKU-010', 'SKU-011']);
        expect(buildFillValues(['Item 2', 'Item 1'], 3)).toEqual(['Item 0', 'Item -1', 'Item -2']);
    });

    it('cycles when nothing matches', () => {
        expect(buildFillValues(['red', 'green'], 4)).toEqual(['red', 'green', 'red', 'green']);
        expect(buildFillValues([true, false], 3)).toEqual([true, false, true]);
        expect(buildFillValues(['A1', 'B2'], 3)).toEqual(['A1', 'B2', 'A1']);
        expect(buildFillValues(['Mon', 'Tue', 'Thu'], 4)).toEqual(['Mon', 'Tue', 'Thu', 'Mon']);
        expect(buildFillValues(['Mon', 'Mon'], 2)).toEqual(['Mon', 'Mon']);
    });

    it('returns empty strings for an empty source', () => {
        expect(buildFillValues([], 2)).toEqual(['', '']);
    });

    it('cycles Date objects with a non-constant step and an invalid Date', () => {
        const source = [new Date(2024, 0, 1), new Date(2024, 0, 3), new Date(2024, 0, 4)];
        expect(buildFillValues(source, 2)).toEqual([source[0], source[1]]);
        const invalid = new Date(Number.NaN);
        expect((buildFillValues([invalid], 2) as Date[])[0]).toBe(invalid);
    });

    describe('ISO date strings', () => {
        it('detects a weekly step', () => {
            expect(buildFillValues(['2024-01-01', '2024-01-08'], 2)).toEqual(['2024-01-15', '2024-01-22']);
        });
        it('rolls a single date forward a day across a leap-year boundary', () => {
            expect(buildFillValues(['2024-02-28'], 2)).toEqual(['2024-02-29', '2024-03-01']);
        });
        it('steps by month when the day of month is constant, clamping into shorter months', () => {
            expect(buildFillValues(['2024-01-15', '2024-02-15'], 2)).toEqual(['2024-03-15', '2024-04-15']);
            expect(buildFillValues(['2024-07-31', '2024-08-31'], 2)).toEqual(['2024-09-30', '2024-10-31']);
        });
        it('steps backwards across a year boundary', () => {
            expect(buildFillValues(['2024-02-10', '2024-01-10'], 2)).toEqual(['2023-12-10', '2023-11-10']);
        });
    });

    it('steps Date objects by day and returns Dates', () => {
        const out = buildFillValues([new Date(2024, 0, 1), new Date(2024, 0, 2)], 2) as Date[];
        expect(out.map((d) => d.getDate())).toEqual([3, 4]);
        expect(out.every((d) => d instanceof Date)).toBe(true);
    });

    describe('names', () => {
        it('steps and wraps weekdays, keeping casing', () => {
            expect(buildFillValues(['Mon', 'Tue'], 2)).toEqual(['Wed', 'Thu']);
            expect(buildFillValues(['Friday', 'Saturday'], 2)).toEqual(['Sunday', 'Monday']);
            expect(buildFillValues(['mon', 'tue'], 2)).toEqual(['wed', 'thu']);
        });
        it('steps and wraps months', () => {
            expect(buildFillValues(['Jan', 'Feb'], 2)).toEqual(['Mar', 'Apr']);
            expect(buildFillValues(['DECEMBER'], 2)).toEqual(['JANUARY', 'FEBRUARY']);
        });
    });

    it('handles a very large count without error', () => {
        expect(buildFillValues([1, 2], 50_000)).toHaveLength(50_000);
    });
});
