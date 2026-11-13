import { describe, expect, it } from 'vitest';
import type { RangeChartPayload } from '../data-table.types.js';
import {
    barData,
    chartCategories,
    dataTableOf,
    effectiveChartType,
    hasMultipleSeries,
    pieData,
    seriesIndexOf,
    stackedSeries,
    type RangeChartData,
} from './range-chart-data.js';
import { fill, RANGE_CHART_LOCALES, resolveRangeChartLocale } from './range-chart-locale.js';

const SINGLE: RangeChartData = { categories: ['Alice', 'Bob'], series: [{ name: 'Sales', values: [10, 30] }] };
const MULTI: RangeChartData = {
    categories: ['Alice', 'Bob'],
    series: [
        { name: 'Q1', values: [10, 30] },
        { name: 'Q2', values: [20, 40] },
    ],
};

describe('the chart data (Angular data-table-range-chart spec 87-141)', () => {
    it('maps the first series onto the categories for bar and pie', () => {
        expect(barData(MULTI)).toEqual([
            { name: 'Alice', value: 10 },
            { name: 'Bob', value: 30 },
        ]);
        expect(pieData(MULTI).data).toEqual(barData(MULTI));
    });

    it('maps every series for stacked', () => {
        expect(stackedSeries(MULTI)).toEqual([
            { name: 'Q1', data: [{ name: 'Alice', value: 10 }, { name: 'Bob', value: 30 }] },
            { name: 'Q2', data: [{ name: 'Alice', value: 20 }, { name: 'Bob', value: 40 }] },
        ]);
    });

    it('reports multiple series', () => {
        expect(hasMultipleSeries(MULTI)).toBe(true);
        expect(hasMultipleSeries(SINGLE)).toBe(false);
    });

    it('returns empty data for a null payload', () => {
        expect(barData(null)).toEqual([]);
        expect(pieData(null)).toEqual({ data: [], droppedNegatives: false });
        expect(stackedSeries(null)).toEqual([]);
        expect(chartCategories(null)).toEqual([]);
        expect(hasMultipleSeries(null)).toBe(false);
        expect(dataTableOf(null, 'bar')).toEqual({ columns: [], rows: [], total: 0 });
    });

    it('maps the categories of a populated payload', () => {
        expect(chartCategories(MULTI)).toEqual(['Alice', 'Bob']);
    });

    it('substitutes 0 for missing series values', () => {
        const payload: RangeChartData = { categories: ['Alice', 'Bob', 'Cara'], series: [{ name: 'Sales', values: [10] }] };
        expect(barData(payload)).toEqual([
            { name: 'Alice', value: 10 },
            { name: 'Bob', value: 0 },
            { name: 'Cara', value: 0 },
        ]);
        expect(stackedSeries(payload)).toEqual([{ name: 'Sales', data: [{ name: 'Alice', value: 10 }, { name: 'Bob', value: 0 }, { name: 'Cara', value: 0 }] }]);
    });

    it('accepts the table\'s RangeChartPayload as it is', () => {
        const payload: RangeChartPayload = { categories: ['Row 1'], series: [{ name: 'Score', values: [3] }] };
        expect(barData(payload)).toEqual([{ name: 'Row 1', value: 3 }]);
    });
});

describe('beyond Angular', () => {
    it('charts the picked series for bar and pie; an index out of range means the first', () => {
        expect(barData(MULTI, 1)).toEqual([
            { name: 'Alice', value: 20 },
            { name: 'Bob', value: 40 },
        ]);
        expect(pieData(MULTI, 1).data.map((p) => p.value)).toEqual([20, 40]);
        for (const index of [-1, 2, 0.5, Number.NaN]) {
            expect(seriesIndexOf(MULTI, index)).toBe(0);
            expect(barData(MULTI, index)).toEqual(barData(MULTI));
        }
        expect(seriesIndexOf(null, 3)).toBe(0);
    });

    it('leaves the negative values out of the pie and says so; zeros stay', () => {
        const payload: RangeChartData = { categories: ['a', 'b', 'c', 'd'], series: [{ name: 'Delta', values: [5, -3, 0, 2] }] };
        expect(pieData(payload)).toEqual({
            data: [
                { name: 'a', value: 5 },
                { name: 'c', value: 0 },
                { name: 'd', value: 2 },
            ],
            droppedNegatives: true,
        });
        // the bar chart draws them, below the baseline
        expect(barData(payload).map((p) => p.value)).toEqual([5, -3, 0, 2]);
        expect(pieData(SINGLE).droppedNegatives).toBe(false);
    });

    it('draws a non-finite value as 0, everywhere', () => {
        const payload = { categories: ['a', 'b', 'c', 'd'], series: [{ name: 'S', values: [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '7' as unknown as number] }] };
        expect(barData(payload).map((p) => p.value)).toEqual([0, 0, 0, 0]);
        expect(stackedSeries(payload)[0]!.data.map((p) => p.value)).toEqual([0, 0, 0, 0]);
        expect(pieData(payload).droppedNegatives).toBe(false);
        expect(dataTableOf(payload, 'bar').rows.map((r) => r.values)).toEqual([[0], [0], [0], [0]]);
    });

    it('handles empty categories and a payload without series', () => {
        expect(barData({ categories: [], series: [{ name: 'S', values: [] }] })).toEqual([]);
        expect(stackedSeries({ categories: [], series: [{ name: 'S', values: [1] }] })).toEqual([{ name: 'S', data: [] }]);
        expect(barData({ categories: ['a'], series: [] })).toEqual([]);
        expect(stackedSeries({ categories: ['a'], series: [] })).toEqual([]);
    });

    it('draws stacked as bar when there is only one series', () => {
        expect(effectiveChartType(SINGLE, 'stacked')).toBe('bar');
        expect(effectiveChartType(null, 'stacked')).toBe('bar');
        expect(effectiveChartType(MULTI, 'stacked')).toBe('stacked');
        expect(effectiveChartType(SINGLE, 'pie')).toBe('pie');
    });

    it('builds the hidden data table from what is drawn, capped, with the uncapped count', () => {
        expect(dataTableOf(MULTI, 'bar', 1)).toEqual({ columns: ['Q2'], rows: [{ category: 'Alice', values: [20] }, { category: 'Bob', values: [40] }], total: 2 });
        expect(dataTableOf(MULTI, 'stacked')).toEqual({ columns: ['Q1', 'Q2'], rows: [{ category: 'Alice', values: [10, 20] }, { category: 'Bob', values: [30, 40] }], total: 2 });
        // stacked with one series is a bar chart: one column
        expect(dataTableOf(SINGLE, 'stacked').columns).toEqual(['Sales']);
        const long: RangeChartData = { categories: Array.from({ length: 120 }, (_, i) => `r${i}`), series: [{ name: 'S', values: Array.from({ length: 120 }, (_, i) => i) }] };
        const table = dataTableOf(long, 'pie');
        expect(table.rows).toHaveLength(50);
        expect(table.rows.at(-1)).toEqual({ category: 'r49', values: [49] });
        expect(table.total).toBe(120);
        expect(dataTableOf(long, 'bar', 0, 3).rows).toHaveLength(3);
    });
});

describe('the locale', () => {
    it('has the strings Angular printed raw, in English', () => {
        expect(RANGE_CHART_LOCALES.en).toMatchObject({ title: 'Chart', bar: 'Bar', pie: 'Pie', stacked: 'Stacked' });
    });

    it('takes an object override over en, a string id or the lang by prefix, and falls back to en', () => {
        RANGE_CHART_LOCALES['fr'] = { ...RANGE_CHART_LOCALES.en, title: 'Graphique' };
        try {
            expect(resolveRangeChartLocale('', 'fr-CA').title).toBe('Graphique');
            expect(resolveRangeChartLocale('fr', 'en').title).toBe('Graphique');
            expect(resolveRangeChartLocale('', 'xx').title).toBe('Chart');
            expect(resolveRangeChartLocale(undefined, '').title).toBe('Chart');
            expect(resolveRangeChartLocale('constructor', '').title).toBe('Chart');
            const partial = resolveRangeChartLocale({ title: 'Diagramm' } as never, 'fr');
            expect(partial.title).toBe('Diagramm');
            expect(partial.bar).toBe('Bar');
        } finally {
            delete RANGE_CHART_LOCALES['fr'];
        }
    });

    it('fills placeholders and leaves an unknown one as written', () => {
        expect(fill('{title}, {type} chart: {series}', { title: 'Chart', type: 'Bar', series: 'Q1' })).toBe('Chart, Bar chart: Q1');
        expect(fill('{shown} of {total} {x}', { shown: 50, total: 120 })).toBe('50 of 120 {x}');
    });
});
