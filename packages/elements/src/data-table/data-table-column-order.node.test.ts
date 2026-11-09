import { describe, expect, it } from 'vitest';
import { dropSide, moveByOffset, moveColumnKey, moveToIndex } from './data-table-column-order.js';

const base = ['a', 'b', 'c', 'd', 'e'];

describe('moveColumnKey', () => {
    it('drops before or after the target', () => {
        expect(moveColumnKey(base, base, 'a', 'c', 'before')).toEqual(['b', 'a', 'c', 'd', 'e']);
        expect(moveColumnKey(base, base, 'a', 'c', 'after')).toEqual(['b', 'c', 'a', 'd', 'e']);
        expect(moveColumnKey(base, base, 'e', 'b', 'before')).toEqual(['a', 'e', 'b', 'c', 'd']);
        expect(moveColumnKey(base, base, 'e', 'b', 'after')).toEqual(['a', 'b', 'e', 'c', 'd']);
    });

    it('does nothing for the same key, an unknown key or a drop that leaves the order as it is', () => {
        expect(moveColumnKey(base, base, 'b', 'b', 'after')).toBeNull();
        expect(moveColumnKey(base, base, 'x', 'b', 'after')).toBeNull();
        expect(moveColumnKey(base, base, 'b', 'x', 'after')).toBeNull();
        expect(moveColumnKey(base, base, 'b', 'c', 'before')).toBeNull();
        expect(moveColumnKey(base, base, 'c', 'b', 'after')).toBeNull();
    });

    it('keeps hidden and other-group columns in their slots', () => {
        // b is hidden, d is pinned elsewhere: the reorderable group is a, c, e.
        expect(moveColumnKey(base, ['a', 'c', 'e'], 'e', 'a', 'before')).toEqual(['e', 'b', 'a', 'd', 'c']);
        expect(moveColumnKey(base, ['a', 'c', 'e'], 'a', 'e', 'after')).toEqual(['c', 'b', 'e', 'd', 'a']);
    });
});

describe('moveByOffset', () => {
    it('moves one place or more and stops at the ends', () => {
        expect(moveByOffset(base, base, 'b', 1)).toEqual(['a', 'c', 'b', 'd', 'e']);
        expect(moveByOffset(base, base, 'b', -1)).toEqual(['b', 'a', 'c', 'd', 'e']);
        expect(moveByOffset(base, base, 'a', 2)).toEqual(['b', 'c', 'a', 'd', 'e']);
        expect(moveByOffset(base, base, 'e', -3)).toEqual(['a', 'e', 'b', 'c', 'd']);
        expect(moveByOffset(base, base, 'a', -1)).toBeNull();
        expect(moveByOffset(base, base, 'e', 1)).toBeNull();
        expect(moveByOffset(base, base, 'x', 1)).toBeNull();
    });

    it('skips hidden columns', () => {
        expect(moveByOffset(base, ['a', 'c', 'e'], 'a', 1)).toEqual(['c', 'b', 'a', 'd', 'e']);
    });
});

describe('moveToIndex', () => {
    it('clamps the index into the group', () => {
        expect(moveToIndex(base, base, 'a', 99)).toEqual(['b', 'c', 'd', 'e', 'a']);
        expect(moveToIndex(base, base, 'e', -5)).toEqual(['e', 'a', 'b', 'c', 'd']);
        expect(moveToIndex(base, base, 'c', 2)).toBeNull();
        expect(moveToIndex(base, base, 'x', 0)).toBeNull();
        expect(moveToIndex(base, base, 'a', Number.NaN)).toBeNull();
    });
});

describe('dropSide', () => {
    const rect = { left: 100, width: 100 };
    it('is the start half in ltr and the other half in rtl', () => {
        expect(dropSide(120, rect, false)).toBe('before');
        expect(dropSide(180, rect, false)).toBe('after');
        expect(dropSide(120, rect, true)).toBe('after');
        expect(dropSide(180, rect, true)).toBe('before');
    });
});
