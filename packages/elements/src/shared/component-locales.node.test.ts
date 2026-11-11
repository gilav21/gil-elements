import { describe, expect, it } from 'vitest';
import { lookupLocale } from './locale-id.js';
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

    it('fill a partial dictionary from English, and hand a complete one back as it is', () => {
        const partial = { code: 'xx', download: 'Fetch' } as never;
        const filled = resolveFileViewerLocale(partial);
        expect(filled.download).toBe('Fetch');
        expect(filled.code).toBe('xx');
        for (const dictionary of [filled, resolvePageBuilderLocale(partial), resolvePropertyEditorLocale(partial)]) {
            expect(Object.values(dictionary).every((value) => value !== undefined)).toBe(true);
        }
        expect(resolvePageBuilderLocale(partial).components).toBe(PAGE_BUILDER_LOCALES.en.components);
    });

    it('keep the code of a custom dictionary (unnamed is empty, never English) and give the same object for the same input', () => {
        const named = { code: 'xx', download: 'Fetch' } as never;
        expect(resolveFileViewerLocale(named).code).toBe('xx');
        expect(resolveFileViewerLocale(named)).toBe(resolveFileViewerLocale(named));
        const unnamed = { download: 'Fetch' } as never;
        expect(resolveFileViewerLocale(unnamed).code).toBe('');
        expect(resolveFileViewerLocale(unnamed)).toBe(resolveFileViewerLocale(unnamed));
        expect(resolveFileViewerLocale(unnamed).print).toBe(FILE_VIEWER_LOCALES.en.print);
    });

    it('take an underscore like a hyphen in an id', () => {
        expect(resolveFileViewerLocale('de_DE')).toBe(FILE_VIEWER_LOCALES.de);
        expect(lookupLocale({ 'pt-br': 'BR', pt: 'PT' }, 'pt_BR')).toBe('BR');
        expect(lookupLocale({ 'pt-br': 'BR', pt: 'PT' }, 'PT_pt')).toBe('PT');
        expect(lookupLocale({ 'zh-cn': 'CN', zh: 'ZH' }, 'zh_TW')).toBe('ZH');
        // prefixes are tried longest first: zh-Hant-TW finds zh-hant before zh
        expect(lookupLocale({ 'zh-hant': 'HANT', zh: 'ZH' }, 'zh-Hant-TW')).toBe('HANT');
        expect(lookupLocale({ zh: 'ZH' }, 'zh-Hant-TW')).toBe('ZH');
        expect(lookupLocale({ zh: 'ZH' }, 'xx-Hant-TW')).toBeUndefined();
        // a record keyed with a mixed-case id is found whichever way the id is written
        const regional = { 'pt-BR': 'BR', pt: 'PT' };
        for (const id of ['pt-br', 'PT-BR', 'pt_BR', 'pt-BR']) expect(lookupLocale(regional, id)).toBe('BR');
        expect(lookupLocale(regional, 'pt-PT')).toBe('PT');
        for (const name of ['__proto__', 'constructor', 'toString']) expect(lookupLocale(regional, name)).toBeUndefined();
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
