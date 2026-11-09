import { describe, expect, it } from 'vitest';
import { DEFAULT_ICONS } from '../icon/icons.js';
import { CHROME_ICON_NAMES, chromeGlyphMarkup } from './data-table-icons.js';

describe('the data-table chrome glyphs', () => {
    it.each(CHROME_ICON_NAMES)('%s is the same markup ge-icon draws', (name) => {
        expect(chromeGlyphMarkup(name)).toBe((DEFAULT_ICONS as Record<string, string>)[name]);
    });
});
