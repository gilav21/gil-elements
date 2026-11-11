import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    DATA_TABLE_LOCALES,
    dataTableLocaleVersion,
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
    DATA_TABLE_LOCALES.en = en;
    vi.restoreAllMocks();
    delete DATA_TABLE_LOCALES['de'];
    delete DATA_TABLE_LOCALES['he'];
    for (const id of ['pt', 'pt-br', 'zh-tw', 'zh-cn']) delete DATA_TABLE_LOCALES[id];
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

    it('has every wave 4 key, with the placeholders the announcements interpolate', () => {
        const keys = [
            'resizeColumnDescription', 'reorderColumnHint', 'pageAnnouncement', 'selectionAnnouncement', 'selectionAnnouncementOne',
            'selectionClearedAnnouncement', 'columnMovedAnnouncement', 'columnResizedAnnouncement',
        ] as const satisfies readonly (keyof DataTableLocale)[];
        for (const key of keys) expect(en[key], key).toBeTruthy();
        expect(interpolate(en.pageAnnouncement, { page: 2, pages: 5 })).toBe('Page 2 of 5');
        expect(interpolate(en.selectionAnnouncement, { count: 3 })).toBe('3 rows selected');
        expect(interpolate(en.columnMovedAnnouncement, { column: 'Age', position: 1, total: 4 })).toBe('Age moved to position 1 of 4');
        expect(interpolate(en.columnResizedAnnouncement, { column: 'Age', width: 120 })).toBe('Age width 120 pixels');
        expect(en.resizeColumn).not.toContain('double-click');
    });

    it('resolves an object as it is, a known id, a region id, and falls back to English', () => {
        expect(resolveDataTableLocale(de)).toBe(de);
        expect(resolveDataTableLocale('xx')).toBe(en);
        expect(resolveDataTableLocale(null)).toBe(en);
        expect(resolveDataTableLocale()).toBe(en);
        registerDataTableLocale('de', de);
        expect(resolveDataTableLocale('de')).toEqual(de);
        expect(resolveDataTableLocale('DE-ch')).toEqual(de);
    });

    it('registers case-insensitively and replaces an earlier entry', () => {
        registerDataTableLocale('DE', de);
        const other = { ...de, filterPlaceholder: 'x' };
        registerDataTableLocale('de', other);
        expect(resolveDataTableLocale('de')).toEqual(other);
    });

    it('takes a dictionary that leaves keys out and fills them from English, also the keys added later', () => {
        registerDataTableLocale('fr', { filterPlaceholder: 'Filtrer' });
        const fr = resolveDataTableLocale('fr');
        expect(fr.filterPlaceholder).toBe('Filtrer');
        expect(fr.noResultsLabel).toBe(en.noResultsLabel);
        expect(fr.code).toBe('fr');
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

    it('finds a regional dictionary by its whole id before its language: pt-BR, and zh-TW against zh-CN', () => {
        registerDataTableLocale('pt', { filterPlaceholder: 'Filtrar' });
        registerDataTableLocale('pt-BR', { filterPlaceholder: 'Filtrar (BR)' });
        registerDataTableLocale('zh-TW', { filterPlaceholder: 'TW' });
        registerDataTableLocale('zh-CN', { filterPlaceholder: 'CN' });
        expect(resolveDataTableLocale('pt-BR').filterPlaceholder).toBe('Filtrar (BR)');
        expect(resolveDataTableLocale('PT-br').filterPlaceholder).toBe('Filtrar (BR)');
        expect(resolveDataTableLocale('pt-PT').filterPlaceholder).toBe('Filtrar');
        expect(resolveDataTableLocale('zh-TW').filterPlaceholder).toBe('TW');
        expect(resolveDataTableLocale('zh-CN').filterPlaceholder).toBe('CN');
        expect(resolveDataTableLocale('zh-HK')).toBe(en);
    });

    it('ignores an id that would replace the prototype of the table, and bumps the version only for a real one', () => {
        const before = dataTableLocaleVersion();
        registerDataTableLocale('__proto__', { filterPlaceholder: 'x' });
        registerDataTableLocale('__PROTO__', { filterPlaceholder: 'x' });
        expect(Object.getPrototypeOf(DATA_TABLE_LOCALES)).toBe(Object.prototype);
        expect(Object.keys(DATA_TABLE_LOCALES)).not.toContain('__proto__');
        expect(dataTableLocaleVersion()).toBe(before);
        registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' });
        expect(dataTableLocaleVersion()).toBe(before + 1);
    });

    it('fills a registered dictionary from the English there is when it is resolved, not when it was registered', () => {
        registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' });
        expect(resolveDataTableLocale('de').noResultsLabel).toBe(en.noResultsLabel);
        registerDataTableLocale('en', { noResultsLabel: 'Nothing here' });
        expect(resolveDataTableLocale('de').noResultsLabel).toBe('Nothing here');
        expect(resolveDataTableLocale('de').filterPlaceholder).toBe('Filtern...');
        expect(withEnglishFallback({ code: 'xx' } as DataTableLocale).noResultsLabel).toBe('Nothing here');
        // the overridden English is itself whole
        expect(resolveDataTableLocale('en').filterPlaceholder).toBe(en.filterPlaceholder);
    });

    it('takes the page language it is given, the global document only by default', () => {
        registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' });
        expect(resolveDataTableLocale('xx', 'de').filterPlaceholder).toBe('Filtern...');
        expect(resolveDataTableLocale(undefined, 'de-AT').filterPlaceholder).toBe('Filtern...');
        expect(resolveDataTableLocale('xx', 'ja')).toBe(en);
        expect(resolveDataTableLocale('de', 'ja').filterPlaceholder).toBe('Filtern...');
    });

    it('warns once per ignored id', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        registerDataTableLocale('__proto__', {});
        expect(warn).toHaveBeenCalledOnce();
        expect(String(warn.mock.calls[0]![0])).toContain('__proto__');
    });

    it('interpolates {column} and leaves unknown names', () => {
        expect(interpolate(en.toggleColumnAriaLabel, { column: 'Age' })).toBe('Toggle Age column');
        expect(interpolate('{a} {b}', { a: 1 })).toBe('1 {b}');
    });
});
