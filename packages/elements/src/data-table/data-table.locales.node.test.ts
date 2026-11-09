import { afterEach, describe, expect, it } from 'vitest';
import {
    DATA_TABLE_LOCALES,
    EN_FILTER_BUILDER_LABELS,
    filterBuilderLabels,
    interpolate,
    registerDataTableLocale,
    resolveDataTableLocale,
    withEnglishFallback,
    type DataTableLocale,
} from './data-table.locales.js';

const en = DATA_TABLE_LOCALES.en;
const de: DataTableLocale = { ...en, code: 'de', filterPlaceholder: 'Filtern...' };

afterEach(() => {
    delete DATA_TABLE_LOCALES['de'];
    delete DATA_TABLE_LOCALES['he'];
});

describe('data-table locales', () => {
    it('ships English only, with every optional key present', () => {
        expect(Object.keys(DATA_TABLE_LOCALES)).toEqual(['en']);
        for (const key of ['rangeCount', 'rangeSum', 'rangeAvg', 'rangeMin', 'rangeMax', 'rangeChart', 'nlFilterPlaceholder', 'advancedFilter'] as const) {
            expect(en[key], key).toBeTruthy();
        }
        expect(Object.keys(EN_FILTER_BUILDER_LABELS.operators)).toHaveLength(12);
    });

    it('has every wave 3 key, with the placeholders the renderers interpolate', () => {
        const keys = [
            'selectRow', 'actions', 'expandRow', 'collapseRow', 'expandAllRows', 'collapseAllRows', 'expandSubRows', 'collapseSubRows',
            'expandAllSubRows', 'collapseAllSubRows', 'expandGroup', 'collapseGroup', 'filterColumn', 'columnMenu', 'resizeColumn', 'loading',
            'goToFirstPage', 'goToPreviousPage', 'goToNextPage', 'goToLastPage', 'sortStateAscending', 'sortStateDescending', 'sortStateNone',
            'sortPriority', 'sortedAscendingAnnouncement', 'sortedDescendingAnnouncement', 'sortRemovedAnnouncement',
            'filterClearedAnnouncement', 'filterResultsAnnouncement', 'filterResultAnnouncement',
        ] as const satisfies readonly (keyof DataTableLocale)[];
        for (const key of keys) expect(en[key], key).toBeTruthy();
        for (const key of ['filterColumn', 'columnMenu', 'resizeColumn', 'sortedAscendingAnnouncement'] as const) expect(en[key]).toContain('{column}');
        expect(interpolate(en.sortStateAscending, { title: 'Age', priority: interpolate(en.sortPriority, { index: 2 }) })).toBe(
            'Age, sorted ascending, sort priority 2. Activate to sort descending.',
        );
        expect(en.filterResultsAnnouncement).toContain('{count}');
    });

    it('resolves an object as it is, a known id, a region id, and falls back to English', () => {
        expect(resolveDataTableLocale(de)).toBe(de);
        expect(resolveDataTableLocale('xx')).toBe(en);
        expect(resolveDataTableLocale(null)).toBe(en);
        expect(resolveDataTableLocale()).toBe(en);
        registerDataTableLocale('de', de);
        expect(resolveDataTableLocale('de')).toBe(de);
        expect(resolveDataTableLocale('DE-ch')).toBe(de);
    });

    it('registers case-insensitively and replaces an earlier entry', () => {
        registerDataTableLocale('DE', de);
        const other = { ...de, filterPlaceholder: 'x' };
        registerDataTableLocale('de', other);
        expect(resolveDataTableLocale('de')).toBe(other);
    });

    it('does not resolve prototype-member names', () => {
        expect(resolveDataTableLocale('constructor')).toBe(en);
        expect(resolveDataTableLocale('toString')).toBe(en);
    });

    it('fills omitted optional keys and advanced-filter labels from English', () => {
        const partial: DataTableLocale = { ...en, code: 'zz', rangeSum: undefined, advancedFilter: { ...EN_FILTER_BUILDER_LABELS, and: 'UND', operators: { contains: 'enthält' } as never } };
        const full = withEnglishFallback({ ...partial, rangeSum: undefined });
        expect(full.advancedFilter?.and).toBe('UND');
        expect(full.advancedFilter?.operators.contains).toBe('enthält');
        expect(full.advancedFilter?.operators.equals).toBe('equals');
        expect(filterBuilderLabels({ ...en, advancedFilter: undefined })).toBe(EN_FILTER_BUILDER_LABELS);
        expect(full.rangeCount).toBe('Count');
    });

    it('interpolates {column} and leaves unknown names', () => {
        expect(interpolate(en.toggleColumnAriaLabel, { column: 'Age' })).toBe('Toggle Age column');
        expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}');
    });
});
