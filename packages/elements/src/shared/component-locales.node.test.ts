import { describe, expect, it } from 'vitest';
import { FILE_VIEWER_LOCALES, resolveFileViewerLocale } from '../file-viewer/file-viewer.locales.js';
import { PAGE_BUILDER_LOCALES, resolvePageBuilderLocale } from '../page-builder/page-builder.locales.js';
import { PROPERTY_EDITOR_LOCALES, resolvePropertyEditorLocale } from '../page-builder/sub/property-editor.locales.js';

type Dictionary = { code: string; rtl?: boolean } & Record<string, unknown>;
const TABLES: [string, Record<string, Dictionary | undefined> & { en: Dictionary }, number][] = [
    ['file-viewer', FILE_VIEWER_LOCALES as never, 17],
    ['page-builder', PAGE_BUILDER_LOCALES as never, 40],
    ['property-editor', PROPERTY_EDITOR_LOCALES as never, 14],
];
const IDS = ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'];
const placeholders = (text: unknown) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const keysOf = (dictionary: Dictionary) => Object.keys(dictionary).filter((key) => key !== 'code' && key !== 'rtl');

describe.each(TABLES)('%s locales', (_name, table, count) => {
    it('has the ten ids and the key count of the Angular dictionary', () => {
        expect(Object.keys(table).sort()).toEqual([...IDS].sort());
        expect(keysOf(table.en)).toHaveLength(count);
    });

    it.each(IDS)('%s has exactly the English keys, none empty, with the same placeholders', (id) => {
        const dictionary = table[id]!;
        expect(dictionary.code).toBe(id);
        expect(keysOf(dictionary).sort()).toEqual(keysOf(table.en).sort());
        for (const key of keysOf(table.en)) {
            expect(String(dictionary[key]).trim(), `${id}.${key}`).not.toBe('');
            expect(placeholders(dictionary[key]), `${id}.${key}`).toEqual(placeholders(table.en[key]));
        }
    });

    it('marks Hebrew and Arabic right-to-left and no other locale', () => {
        expect(IDS.filter((id) => table[id]!.rtl)).toEqual(['he', 'ar']);
    });
});

describe('the resolvers', () => {
    it('use an object as given, look an id up, and fall back to English', () => {
        const custom = { ...FILE_VIEWER_LOCALES.en, code: 'xx', download: 'Fetch' };
        expect(resolveFileViewerLocale(custom)).toBe(custom);
        expect(resolveFileViewerLocale('de')).toBe(FILE_VIEWER_LOCALES.de);
        expect(resolveFileViewerLocale('nope')).toBe(FILE_VIEWER_LOCALES.en);
        expect(resolvePageBuilderLocale(undefined)).toBe(PAGE_BUILDER_LOCALES.en);
        expect(resolvePropertyEditorLocale('he')).toBe(PROPERTY_EDITOR_LOCALES.he);
    });

    it('ignore case and region in an id, and never answer with an inherited member', () => {
        expect(resolveFileViewerLocale('de-DE')).toBe(FILE_VIEWER_LOCALES.de);
        expect(resolveFileViewerLocale('HE')).toBe(FILE_VIEWER_LOCALES.he);
        expect(resolvePageBuilderLocale('pt-BR')).toBe(PAGE_BUILDER_LOCALES.pt);
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(resolveFileViewerLocale(name)).toBe(FILE_VIEWER_LOCALES.en);
            expect(resolvePropertyEditorLocale(name)).toBe(PROPERTY_EDITOR_LOCALES.en);
        }
    });
});
