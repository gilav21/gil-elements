import { describe, expect, it } from 'vitest';
import { extendRange, type RangeKeyState, selectAllRange } from './data-table-range-keys.js';

const keys = ['a', 'b', 'c', 'd'];
const state = (over: Partial<RangeKeyState> = {}): RangeKeyState => ({ rowCount: 10, keys, pageSize: 4, rtl: false, ctrl: false, ...over });
const focused = { rowIndex: 2, columnKey: 'b' };

describe('extendRange', () => {
    it('starts a range at the focused cell and moves its end by one cell per arrow', () => {
        expect(extendRange(null, focused, 'ArrowDown', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 3, endCol: 'b' });
        expect(extendRange(null, focused, 'ArrowRight', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 2, endCol: 'c' });
        expect(extendRange(null, focused, 'ArrowUp', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 1, endCol: 'b' });
        expect(extendRange(null, focused, 'ArrowLeft', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 2, endCol: 'a' });
    });

    it('keeps the anchor of an existing range and moves only its end (the focus is the anchor)', () => {
        const range = { startRow: 2, startCol: 'b', endRow: 4, endCol: 'c' };
        expect(extendRange(range, { rowIndex: 9, columnKey: 'd' }, 'ArrowDown', state())).toEqual({ ...range, endRow: 5 });
        expect(extendRange(range, focused, 'ArrowLeft', state())).toEqual({ ...range, endCol: 'b' });
    });

    it('flips ArrowLeft and ArrowRight in rtl', () => {
        expect(extendRange(null, focused, 'ArrowLeft', state({ rtl: true }))?.endCol).toBe('c');
        expect(extendRange(null, focused, 'ArrowRight', state({ rtl: true }))?.endCol).toBe('a');
    });

    it('stops at the edges (no wrap) and collapses to null when the end comes back onto the anchor', () => {
        expect(extendRange(null, { rowIndex: 9, columnKey: 'd' }, 'ArrowDown', state())).toBeNull(); // the end cannot move: 1x1
        const range = { startRow: 2, startCol: 'b', endRow: 3, endCol: 'b' };
        expect(extendRange(range, focused, 'ArrowUp', state())).toBeNull();
    });

    it('Home / End go to the row ends, with Ctrl to the first / last row; PageUp / PageDown by the page size', () => {
        expect(extendRange(null, focused, 'End', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 2, endCol: 'd' });
        expect(extendRange(null, focused, 'Home', state())).toEqual({ startRow: 2, startCol: 'b', endRow: 2, endCol: 'a' });
        expect(extendRange(null, focused, 'End', state({ ctrl: true }))).toEqual({ startRow: 2, startCol: 'b', endRow: 9, endCol: 'd' });
        expect(extendRange(null, focused, 'Home', state({ ctrl: true }))).toEqual({ startRow: 2, startCol: 'b', endRow: 0, endCol: 'a' });
        expect(extendRange(null, focused, 'PageDown', state())?.endRow).toBe(6);
        expect(extendRange(null, focused, 'PageDown', state({ pageSize: 50 }))?.endRow).toBe(9);
        expect(extendRange(null, { rowIndex: 7, columnKey: 'b' }, 'PageUp', state())?.endRow).toBe(3);
    });

    it('does not skip disabled rows: a range is a selection of cells, not a row move', () => {
        // nextFocus would step over a disabled row; the range state has none
        expect(extendRange(null, focused, 'ArrowDown', state())?.endRow).toBe(3);
    });

    it('does not apply without an anchor, from a special column, for a key that is not navigation, or with nothing to move across', () => {
        expect(extendRange(null, null, 'ArrowDown', state())).toBeUndefined();
        expect(extendRange(null, { rowIndex: 1, columnKey: '_selection' }, 'ArrowDown', state())).toBeUndefined();
        expect(extendRange(null, focused, 'Enter', state())).toBeUndefined();
        expect(extendRange(null, focused, 'ArrowDown', state({ rowCount: 0 }))).toBeUndefined();
        expect(extendRange({ startRow: 0, startCol: 'gone', endRow: 1, endCol: 'b' }, focused, 'ArrowDown', state())).toBeUndefined();
    });
});

describe('selectAllRange (Ctrl/Cmd+A)', () => {
    it('spans every drawn row and every data column', () => {
        expect(selectAllRange(10, keys)).toEqual({ startRow: 0, startCol: 'a', endRow: 9, endCol: 'd' });
    });

    it('is null with no rows or no columns', () => {
        expect(selectAllRange(0, keys)).toBeNull();
        expect(selectAllRange(5, [])).toBeNull();
    });
});
