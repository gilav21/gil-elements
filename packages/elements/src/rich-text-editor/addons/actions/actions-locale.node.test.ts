import { describe, expect, it } from 'vitest';
import { RICH_TEXT_ACTIONS_LOCALES } from './actions-locale.js';

const shapeOf = (value: object): string[] => Object.entries(value)
    .flatMap(([key, entry]) => (typeof entry === 'object' ? shapeOf(entry as object).map((k) => `${key}.${k}`) : [key]))
    .filter((key) => key !== 'rtl')
    .sort((a, b) => a.localeCompare(b));

describe('actions locales', () => {
    it('ships all ten languages under their own code, with the same keys as English', () => {
        const english = shapeOf(RICH_TEXT_ACTIONS_LOCALES.en);
        expect(Object.keys(RICH_TEXT_ACTIONS_LOCALES).sort((a, b) => a.localeCompare(b))).toEqual(['ar', 'de', 'en', 'es', 'fr', 'he', 'ja', 'pt', 'ru', 'zh']);
        for (const [code, locale] of Object.entries(RICH_TEXT_ACTIONS_LOCALES)) {
            expect(locale?.code).toBe(code);
            expect(shapeOf(locale!), code).toEqual(english);
        }
    });

    it('marks only the right-to-left languages', () => {
        const rtl = Object.entries(RICH_TEXT_ACTIONS_LOCALES).filter(([, locale]) => locale?.rtl).map(([code]) => code);
        expect(rtl.sort((a, b) => a.localeCompare(b))).toEqual(['ar', 'he']);
    });

    it('keeps the {text} and {field} placeholders in every language', () => {
        for (const [code, locale] of Object.entries(RICH_TEXT_ACTIONS_LOCALES)) {
            expect(locale?.dialog.attachToText, code).toContain('{text}');
            expect(locale?.form.required, code).toContain('{field}');
        }
    });
});
