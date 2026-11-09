import { describe, expect, it } from 'vitest';
import { nearestColumn, nextFocus, type NavigationState, pageRows } from './data-table-keys.js';

const state = (over: Partial<NavigationState> = {}): NavigationState => ({
    row: 5,
    col: 2,
    rowCount: 20,
    colCount: 4,
    isDisabled: () => false,
    pageSize: 8,
    rtl: false,
    ctrl: false,
    ...over,
});

describe('nextFocus', () => {
    it('is null for a key that is not navigation, and for an empty grid', () => {
        expect(nextFocus('Tab', state())).toBeNull();
        expect(nextFocus('Enter', state())).toBeNull();
        expect(nextFocus('a', state())).toBeNull();
        expect(nextFocus('ArrowDown', state({ rowCount: 0 }))).toBeNull();
        expect(nextFocus('ArrowDown', state({ colCount: 0 }))).toBeNull();
    });
    it('steps one cell with the arrows', () => {
        expect(nextFocus('ArrowUp', state())).toEqual({ row: 4, col: 2 });
        expect(nextFocus('ArrowDown', state())).toEqual({ row: 6, col: 2 });
        expect(nextFocus('ArrowLeft', state())).toEqual({ row: 5, col: 1 });
        expect(nextFocus('ArrowRight', state())).toEqual({ row: 5, col: 3 });
    });
    it('does not wrap at an edge', () => {
        expect(nextFocus('ArrowUp', state({ row: 0 }))).toEqual({ row: 0, col: 2 });
        expect(nextFocus('ArrowDown', state({ row: 19 }))).toEqual({ row: 19, col: 2 });
        expect(nextFocus('ArrowLeft', state({ col: 0 }))).toEqual({ row: 5, col: 0 });
        expect(nextFocus('ArrowRight', state({ col: 3 }))).toEqual({ row: 5, col: 3 });
    });
    it('swaps Left and Right in right-to-left', () => {
        expect(nextFocus('ArrowLeft', state({ rtl: true }))).toEqual({ row: 5, col: 3 });
        expect(nextFocus('ArrowRight', state({ rtl: true }))).toEqual({ row: 5, col: 1 });
        expect(nextFocus('ArrowRight', state({ rtl: true, col: 0 }))).toEqual({ row: 5, col: 0 });
        expect(nextFocus('ArrowUp', state({ rtl: true }))).toEqual({ row: 4, col: 2 });
    });
    it('skips disabled rows with Up and Down, and stays when none is left', () => {
        const off = new Set([6, 7, 3]);
        const isDisabled = (r: number): boolean => off.has(r);
        expect(nextFocus('ArrowDown', state({ isDisabled }))).toEqual({ row: 8, col: 2 });
        expect(nextFocus('ArrowUp', state({ isDisabled, row: 4 }))).toEqual({ row: 2, col: 2 });
        expect(nextFocus('ArrowDown', state({ isDisabled: (r) => r > 5 }))).toEqual({ row: 5, col: 2 });
        expect(nextFocus('ArrowUp', state({ isDisabled: (r) => r < 5 }))).toEqual({ row: 5, col: 2 });
    });
    it('lets the page keys and Home / End land on a disabled row', () => {
        const isDisabled = (r: number): boolean => r === 13 || r === 0 || r === 19;
        expect(nextFocus('PageDown', state({ isDisabled }))).toEqual({ row: 13, col: 2 });
        expect(nextFocus('PageUp', state({ isDisabled, row: 8, pageSize: 8 }))).toEqual({ row: 0, col: 2 });
        expect(nextFocus('End', state({ isDisabled, ctrl: true }))).toEqual({ row: 19, col: 3 });
    });
    it('goes to the first or last column with Home and End, and to the first or last cell with Ctrl', () => {
        expect(nextFocus('Home', state())).toEqual({ row: 5, col: 0 });
        expect(nextFocus('End', state())).toEqual({ row: 5, col: 3 });
        expect(nextFocus('Home', state({ ctrl: true }))).toEqual({ row: 0, col: 0 });
        expect(nextFocus('End', state({ ctrl: true }))).toEqual({ row: 19, col: 3 });
    });
    it('Home and End are the same in right-to-left (first and last in drawn order)', () => {
        expect(nextFocus('Home', state({ rtl: true }))).toEqual({ row: 5, col: 0 });
    });
    it('pages by pageSize and clamps at the ends', () => {
        expect(nextFocus('PageDown', state())).toEqual({ row: 13, col: 2 });
        expect(nextFocus('PageUp', state())).toEqual({ row: 0, col: 2 });
        expect(nextFocus('PageDown', state({ row: 15 }))).toEqual({ row: 19, col: 2 });
        expect(nextFocus('PageDown', state({ pageSize: 0 }))).toEqual({ row: 6, col: 2 });
        expect(nextFocus('PageUp', state({ pageSize: Number.NaN, row: 5 }))).toEqual({ row: 4, col: 2 });
    });
    it('clamps a focus that is past the end (rows or columns removed)', () => {
        expect(nextFocus('ArrowUp', state({ row: 40 }))).toEqual({ row: 18, col: 2 });
        expect(nextFocus('ArrowLeft', state({ col: 9 }))).toEqual({ row: 5, col: 2 });
        expect(nextFocus('ArrowDown', state({ row: -3 }))).toEqual({ row: 1, col: 2 });
    });
    it('is a single row and a single column without moving or throwing', () => {
        const one = state({ row: 0, col: 0, rowCount: 1, colCount: 1 });
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) expect(nextFocus(key, one)).toEqual({ row: 0, col: 0 });
    });
    it('crosses what the drawn index hides: collapsed groups are simply absent rows', () => {
        // 3 drawn rows after a collapsed group: Ctrl+End is the last DRAWN row.
        expect(nextFocus('End', state({ ctrl: true, rowCount: 3, row: 0 }))).toEqual({ row: 2, col: 3 });
    });
});

describe('pageRows', () => {
    it('is the whole rows that fit, at least one', () => {
        expect(pageRows(400, 40)).toBe(10);
        expect(pageRows(359, 40)).toBe(8);
        expect(pageRows(20, 40)).toBe(1);
        expect(pageRows(0, 40)).toBe(1);
        expect(pageRows(400, 0)).toBe(1);
    });
});

describe('nearestColumn', () => {
    const keys = ['a', 'b', 'c'];
    it('keeps a column that is still there', () => {
        expect(nearestColumn(keys, 'b', 0)).toBe(1);
    });
    it('falls back to the old position, bounded, or to nothing', () => {
        expect(nearestColumn(keys, 'x', 1)).toBe(1);
        expect(nearestColumn(keys, 'x', 9)).toBe(2);
        expect(nearestColumn(keys, 'x', -4)).toBe(0);
        expect(nearestColumn([], 'x', 1)).toBe(-1);
    });
});
