import { describe, expect, it } from 'vitest';
import { splitMatches } from './autocomplete.utils.js';

describe('splitMatches', () => {
    it('marks every occurrence regardless of case and keeps the original text', () => {
        expect(splitMatches('Banana band', 'AN')).toEqual([
            { text: 'B', hit: false },
            { text: 'an', hit: true },
            { text: 'an', hit: true },
            { text: 'a b', hit: false },
            { text: 'an', hit: true },
            { text: 'd', hit: false },
        ]);
    });

    it('treats regex characters in the search as plain text', () => {
        expect(splitMatches('Fig (dried) [2kg]', '(dried)')).toEqual([
            { text: 'Fig ', hit: false },
            { text: '(dried)', hit: true },
            { text: ' [2kg]', hit: false },
        ]);
        expect(splitMatches('a.b axb', '.')).toEqual([
            { text: 'a', hit: false },
            { text: '.', hit: true },
            { text: 'b axb', hit: false },
        ]);
    });

    it('returns the whole text unmarked for an empty search or no match', () => {
        expect(splitMatches('Apple', '')).toEqual([{ text: 'Apple', hit: false }]);
        expect(splitMatches('Apple', 'zz')).toEqual([{ text: 'Apple', hit: false }]);
    });
});
