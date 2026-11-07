import { afterEach, describe, expect, it } from 'vitest';
import { interpolate, resolveRichTextLocale, RICH_TEXT_LOCALES, type RichTextLocale } from './rich-text-locales.js';

describe('resolveRichTextLocale', () => {
    const originalLang = document.documentElement.lang;
    afterEach(() => {
        document.documentElement.lang = originalLang;
    });

    it('falls back to English for an unknown locale key', () => {
        expect(resolveRichTextLocale('xx')).toBe(RICH_TEXT_LOCALES.en);
    });

    it('falls back to English with no input', () => {
        document.documentElement.lang = '';
        expect(resolveRichTextLocale()).toBe(RICH_TEXT_LOCALES.en);
        expect(resolveRichTextLocale(null)).toBe(RICH_TEXT_LOCALES.en);
    });

    it('looks an id up in the registry', () => {
        const fr: RichTextLocale = { ...RICH_TEXT_LOCALES.en, code: 'fr' };
        RICH_TEXT_LOCALES['fr'] = fr;
        try {
            expect(resolveRichTextLocale('fr')).toBe(fr);
        } finally {
            delete RICH_TEXT_LOCALES['fr'];
        }
    });

    it('uses an object as it is', () => {
        const custom: RichTextLocale = { ...RICH_TEXT_LOCALES.en, code: 'custom', rtl: true };
        expect(resolveRichTextLocale(custom)).toBe(custom);
    });

    it('follows the page language when no id is given or the id is unknown', () => {
        const de: RichTextLocale = { ...RICH_TEXT_LOCALES.en, code: 'de' };
        RICH_TEXT_LOCALES['de'] = de;
        try {
            document.documentElement.lang = 'de-AT';
            expect(resolveRichTextLocale()).toBe(de);
            expect(resolveRichTextLocale('xx')).toBe(de);
        } finally {
            delete RICH_TEXT_LOCALES['de'];
        }
    });
});

describe('the English dictionary', () => {
    const en = RICH_TEXT_LOCALES.en;

    it('is left-to-right', () => {
        expect(en.code).toBe('en');
        expect(en.rtl).toBeFalsy();
    });

    it('supplies every string, none blank', () => {
        const strings = (value: unknown, path: string): [string, string][] => {
            if (typeof value === 'string') return [[path, value]];
            if (value === null || typeof value !== 'object') return [];
            return Object.entries(value).flatMap(([key, child]) => strings(child, `${path}.${key}`));
        };
        const all = strings(en, 'en');
        expect(all.length).toBeGreaterThan(60);
        expect(all.filter(([, text]) => text.trim() === '')).toEqual([]);
        expect(en.toolbar.bold).toBeTruthy();
        expect(en.editor.placeholder).toBeTruthy();
    });

    it('supplies the find & replace strings, with the placeholders the counter fills', () => {
        for (const key of ['wholeWord', 'useRegex', 'invalidRegex', 'matchCounter', 'previous', 'next'] as const) {
            expect(en.findReplace[key].trim(), `findReplace.${key}`).not.toBe('');
        }
        expect(en.toolbar.find).toBeTruthy();
        expect(en.findReplace.matchCounter).toContain('{current}');
        expect(en.findReplace.matchCounter).toContain('{total}');
    });
});

describe('interpolate', () => {
    it('fills named placeholders, numbers included', () => {
        expect(interpolate('{current} of {total}', { current: 2, total: 9 })).toBe('2 of 9');
        expect(interpolate('{rows} x {cols} table', { rows: 3, cols: '4' })).toBe('3 x 4 table');
    });

    it('leaves a placeholder it has no value for as written', () => {
        expect(interpolate('{count} words', {})).toBe('{count} words');
    });
});
