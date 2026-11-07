import { describe, expect, it } from 'vitest';
import { interpolate, resolveRichTextLocale, RICH_TEXT_LOCALES, type RichTextLocale } from '../rich-text-locales.js';
import { es } from './es.js';
import { ja } from './ja.js';
import { pt } from './pt.js';
import { ru } from './ru.js';
import { zh } from './zh.js';

const en = RICH_TEXT_LOCALES.en;
const LOCALES: Record<string, RichTextLocale> = { es, ja, zh, ru, pt };

function flatten(value: object, prefix = ''): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, v] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (v && typeof v === 'object') Object.assign(out, flatten(v, path));
        else out[path] = String(v);
    }
    return out;
}

const tokens = (text: string): string[] => (text.match(/\{\w+\}/g) ?? []).sort((a, b) => a.localeCompare(b));
const englishFlat = flatten({ toolbar: en.toolbar, findReplace: en.findReplace, table: en.table, editor: en.editor });

describe.each(Object.entries(LOCALES))('rich-text locale %s', (id, locale) => {
    const flat = flatten({ toolbar: locale.toolbar, findReplace: locale.findReplace, table: locale.table, editor: locale.editor });

    it('has the same keys as English, all non-empty', () => {
        expect(Object.keys(flat).sort((a, b) => a.localeCompare(b))).toEqual(Object.keys(englishFlat).sort((a, b) => a.localeCompare(b)));
        for (const [key, text] of Object.entries(flat)) expect(text.trim(), `${id}.${key}`).not.toBe('');
    });

    it('keeps the placeholder tokens of English per key', () => {
        for (const [key, text] of Object.entries(englishFlat)) expect(tokens(flat[key] ?? ''), `${id}.${key}`).toEqual(tokens(text));
    });

    it('is left-to-right with its own code', () => {
        expect(locale.code).toBe(id);
        expect(locale.rtl).toBeFalsy();
    });

    it('supplies the find and replace strings', () => {
        expect(locale.toolbar.find).toBeTruthy();
        expect(locale.findReplace.matchCounter).toContain('{current}');
        expect(locale.findReplace.matchCounter).toContain('{total}');
    });

    it('interpolates its counters', () => {
        expect(interpolate(locale.editor.characters, { count: 7 })).toContain('7');
        expect(interpolate(locale.editor.words, { count: 3 })).toContain('3');
        expect(interpolate(locale.table.gridLabel, { rows: 2, cols: 4 })).toMatch(/2.*4/);
    });

    it('resolves by id and by page language once registered', () => {
        RICH_TEXT_LOCALES[id] = locale;
        const original = document.documentElement.lang;
        try {
            expect(resolveRichTextLocale(id)).toBe(locale);
            document.documentElement.lang = `${id}-XX`;
            expect(resolveRichTextLocale()).toBe(locale);
        } finally {
            document.documentElement.lang = original;
            delete RICH_TEXT_LOCALES[id];
        }
    });
});

describe('rich-text locale texts', () => {
    it('differs from English where a translation is expected', () => {
        for (const locale of Object.values(LOCALES)) {
            expect(locale.toolbar.bold).not.toBe(en.toolbar.bold);
            expect(locale.editor.placeholder).not.toBe(en.editor.placeholder);
        }
    });

    it('orders the match counter per language', () => {
        expect(interpolate(ja.findReplace.matchCounter, { current: 2, total: 9 })).toBe('9 件中 2 件目');
        expect(interpolate(es.findReplace.matchCounter, { current: 2, total: 9 })).toBe('2 de 9');
    });
});
