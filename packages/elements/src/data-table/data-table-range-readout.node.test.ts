/** The range readout's text (the stats themselves are the wave 1 `rangeStats` tests): the labels, the two-cell threshold, the numeric gate. */
import { describe, expect, it } from 'vitest';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import { readoutEntries, readoutLabels, readoutText } from './data-table-range-readout.js';
import { rangeStats, type RangeColumn } from './data-table-range.js';

const EN = DATA_TABLE_LOCALES.en;
const labels = readoutLabels(EN);
const column = (values: unknown[]): RangeColumn => ({ key: 'k', header: 'K', values });

describe('the readout', () => {
    it('has no stats (so no readout) for fewer than two cells', () => {
        expect(rangeStats([column([5])])).toBeNull();
        expect(rangeStats([column([])])).toBeNull();
    });

    it('shows Count, Sum, Avg, Min and Max for a range with numbers', () => {
        const stats = rangeStats([column([1, 2, 3])])!;
        expect(readoutEntries(stats, labels)).toEqual([
            ['Count', '3'],
            ['Sum', '6'],
            ['Avg', '2'],
            ['Min', '1'],
            ['Max', '3'],
        ]);
        expect(readoutText(stats, labels)).toBe('Count: 3, Sum: 6, Avg: 2, Min: 1, Max: 3');
    });

    it('shows Count only for text (no numeric cell)', () => {
        const stats = rangeStats([column(['a', 'b'])])!;
        expect(readoutEntries(stats, labels)).toEqual([['Count', '2']]);
    });

    it('takes its labels from the locale, with the English fallback for the optional ones', () => {
        const own = readoutLabels({ ...EN, rangeCount: 'Anzahl', rangeSum: undefined, rangeReadoutLabel: 'Auswahl' });
        expect(own.count).toBe('Anzahl');
        expect(own.sum).toBe('Sum');
        expect(own.group).toBe('Auswahl');
        expect(labels.chart).toBe('Chart');
    });
});
