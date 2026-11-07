import { describe, expect, it } from 'vitest';
import { RICH_TEXT_IMAGES_LOCALES } from './images-locale.js';

describe('images locale table', () => {
    const ids = ['en', 'he', 'ar', 'de', 'fr', 'es', 'ja', 'zh', 'ru', 'pt'];
    const keys = Object.keys(RICH_TEXT_IMAGES_LOCALES.en).sort();

    it('covers all ten languages, each keyed by its own code', () => {
        expect(Object.keys(RICH_TEXT_IMAGES_LOCALES).sort()).toEqual([...ids].sort());
        for (const id of ids) expect(RICH_TEXT_IMAGES_LOCALES[id]?.code).toBe(id);
    });

    it('gives every language the same strings, none of them empty', () => {
        for (const id of ids) {
            const entry = RICH_TEXT_IMAGES_LOCALES[id]!;
            expect(Object.keys(entry).filter((key) => key !== 'rtl').sort()).toEqual(keys.filter((key) => key !== 'rtl'));
            for (const [key, value] of Object.entries(entry)) if (typeof value === 'string') expect(value.length, `${id}.${key}`).toBeGreaterThan(0);
        }
    });

    it('flags the right-to-left languages', () => {
        expect(ids.filter((id) => RICH_TEXT_IMAGES_LOCALES[id]?.rtl)).toEqual(['he', 'ar']);
    });
});
