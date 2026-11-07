import { describe, expect, it } from 'vitest';
import { RICH_TEXT_LOCALES, interpolate, resolveRichTextLocale, type RichTextLocale } from '../rich-text-locales.js';
import { ar } from './ar.js';
import { de } from './de.js';
import { fr } from './fr.js';
import { he } from './he.js';

const en = RICH_TEXT_LOCALES.en;
const cases: [string, RichTextLocale, boolean][] = [['he', he, true], ['ar', ar, true], ['de', de, false], ['fr', fr, false]];

function leaves(locale: RichTextLocale): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [group, value] of Object.entries(locale)) {
        if (value && typeof value === 'object') {
            for (const [key, text] of Object.entries(value)) out[`${group}.${key}`] = text;
        }
    }
    return out;
}

const tokens = (text: unknown) => (String(text).match(/\{\w+\}/g) ?? []).sort();

describe.each(cases)('%s locale', (id, locale, rtl) => {
    it('has the code and direction', () => {
        expect(locale.code).toBe(id);
        expect(Boolean(locale.rtl)).toBe(rtl);
    });

    it('has every English key and no extras', () => {
        expect(Object.keys(leaves(locale)).sort()).toEqual(Object.keys(leaves(en)).sort());
    });

    it('has non-empty strings throughout', () => {
        for (const [key, text] of Object.entries(leaves(locale))) {
            expect(typeof text, key).toBe('string');
            expect((text as string).trim(), key).not.toBe('');
        }
    });

    it('keeps the placeholder tokens of English', () => {
        const english = leaves(en);
        for (const [key, text] of Object.entries(leaves(locale))) expect(tokens(text), key).toEqual(tokens(english[key]));
    });

    it('interpolates the counters', () => {
        expect(interpolate(locale.findReplace.matchCounter, { current: 1, total: 2 })).toMatch(/1.*2/);
        expect(interpolate(locale.editor.words, { count: 7 })).toContain('7');
        expect(interpolate(locale.table.gridLabel, { rows: 3, cols: 4 })).toMatch(/3.*4/);
    });

    it('resolves from an object', () => {
        expect(resolveRichTextLocale(locale)).toBe(locale);
    });
});

describe('locale content', () => {
    it('uses Hebrew placeholder text', () => {
        expect(he.editor.placeholder).toBe('ניתן לכתוב כאן...');
        expect(he.findReplace.matchCounter).toBe('{current} מתוך {total}');
    });

    it('differs from English in the visible strings', () => {
        for (const [, locale] of cases) {
            expect(locale.toolbar.bold).not.toBe(en.toolbar.bold);
            expect(locale.editor.placeholder).not.toBe(en.editor.placeholder);
        }
    });
});
