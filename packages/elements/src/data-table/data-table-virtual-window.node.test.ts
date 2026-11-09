import { describe, expect, it } from 'vitest';
import { windowCovers, buildPrefixSums, clampScroll, computeBodyWindow, firstRowAt, heightChanged, parsePx, retainedRows, retainedTopOf, revealOffset, sameWindow, setRetainedTops } from './data-table-virtual.js';

const base = {
    total: 10000,
    scrollTop: 0,
    viewportHeight: 400,
    rowHeight: 40,
    rowBuffer: 5,
    columnCount: 3,
    middleFirst: 0,
    middleWidths: [100, 100, 100],
    scrollInline: 0,
    viewportWidth: 600,
    columnBuffer: 3,
    retained: [] as number[][],
};

describe('retainedRows', () => {
    it('keeps rows outside the window, in order, once, and drops what cannot be drawn', () => {
        expect(retainedRows([[500, 3], [500, 20], [-1, 1.5, 99999]], 10, 30, 1000)).toEqual([3, 500]);
        expect(retainedRows([], 0, 10, 100)).toEqual([]);
        expect(retainedRows([[10]], 10, 30, 100)).toEqual([]);
    });
});

describe('computeBodyWindow', () => {
    it('windows fixed rows with the padding of the rest', () => {
        const w = computeBodyWindow({ ...base, scrollTop: 200000 });
        expect(w.start).toBe(4995);
        expect(w.end).toBe(5015);
        expect(w.padStart).toBe(4995 * 40);
        expect(w.padEnd).toBe((10000 - 5015) * 40);
        expect(w.padStart + (w.end - w.start) * 40 + w.padEnd).toBe(400000);
    });
    it('is an empty window for no rows, and never start > end past the end', () => {
        expect(computeBodyWindow({ ...base, total: 0 })).toMatchObject({ start: 0, end: 0, padStart: 0, padEnd: 0 });
        const past = computeBodyWindow({ ...base, scrollTop: 9e9 });
        expect(past.start).toBe(10000);
        expect(past.end).toBe(10000);
    });
    it('uses prefix sums for variable heights and keeps the total height', () => {
        const prefix = buildPrefixSums((i) => (i % 2 === 0 ? 40 : 100), 100);
        const w = computeBodyWindow({ ...base, total: 100, scrollTop: 1400, prefix, rowBuffer: 0 });
        expect(w.padStart).toBe(prefix[w.start]);
        expect(w.padStart + ((prefix[w.end] ?? 0) - (prefix[w.start] ?? 0)) + w.padEnd).toBe(prefix[100]);
    });
    it('is the whole column set when it all fits, with absolute indices otherwise', () => {
        expect(computeBodyWindow(base)).toMatchObject({ colStart: 0, colEnd: 3, colPadStart: 0, colPadEnd: 0 });
        const wide = { ...base, columnCount: 32, middleFirst: 2, middleWidths: Array.from({ length: 30 }, () => 150), scrollInline: 1500 };
        const w = computeBodyWindow(wide);
        expect(w.colStart).toBe(2 + 10 - 3);
        expect(w.colEnd).toBe(2 + 14 + 3);
        expect(w.colPadStart).toBe(7 * 150);
        expect(w.colPadEnd).toBe((30 - 17) * 150);
    });
    it('degrades to the buffer for a zero viewport instead of drawing everything', () => {
        const w = computeBodyWindow({ ...base, viewportHeight: 0, viewportWidth: 0 });
        expect(w.end).toBe(5);
        expect(w.colEnd - w.colStart).toBeLessThanOrEqual(3);
    });
    it('carries the retained rows outside the window', () => {
        const w = computeBodyWindow({ ...base, retained: [[100], [3, 5]] });
        expect(w.retained).toEqual([100]);
    });
});

describe('sameWindow', () => {
    it('compares every part', () => {
        const a = computeBodyWindow(base);
        expect(sameWindow(a, computeBodyWindow(base))).toBe(true);
        expect(sameWindow(a, computeBodyWindow({ ...base, scrollTop: 4000 }))).toBe(false);
        expect(sameWindow(a, computeBodyWindow({ ...base, retained: [[500]] }))).toBe(false);
        expect(sameWindow(a, { ...a, padEnd: a.padEnd + 1 })).toBe(false);
    });
    it('is the same only within one row of scroll', () => {
        expect(sameWindow(computeBodyWindow({ ...base, scrollTop: 100 }), computeBodyWindow({ ...base, scrollTop: 110 }))).toBe(true);
        expect(sameWindow(computeBodyWindow({ ...base, scrollTop: 100 }), computeBodyWindow({ ...base, scrollTop: 330 }))).toBe(false);
    });
});

describe('revealOffset', () => {
    // viewport 400 tall, 40px header, 30px footer: the rows show in [scroll + 40, scroll + 370).
    const at = (start: number, end: number, scroll: number): number => revealOffset(start, end, scroll, 400, 40, 30);
    it('leaves the scroll alone when the item is inside the shown band', () => {
        expect(at(200, 240, 100)).toBe(100);
        expect(at(140, 180, 100)).toBe(100);
    });
    it('aligns an item above the band under the header', () => {
        expect(at(60, 100, 100)).toBe(20);
        expect(at(140, 180, 150)).toBe(100);
    });
    it('aligns an item below the band above the footer', () => {
        expect(at(500, 540, 100)).toBe(170);
    });
    it('an item that hides under the footer by one pixel still scrolls', () => {
        expect(at(331, 371, 0)).toBe(1);
    });
    it('aligns at the start when the item is taller than the band and never scrolls below zero', () => {
        expect(at(600, 1200, 0)).toBe(560);
        expect(at(10, 50, 0)).toBe(0);
    });
    it('works for the inline axis with pinned columns as lead and trail', () => {
        // pinned 100 at the start and 80 at the end, 500 wide: the middle shows in [scroll + 100, scroll + 420).
        expect(revealOffset(150, 250, 0, 500, 100, 80)).toBe(0);
        expect(revealOffset(600, 750, 0, 500, 100, 80)).toBe(330);
        expect(revealOffset(120, 220, 300, 500, 100, 80)).toBe(20);
    });
});

describe('small helpers', () => {
    it('clampScroll bounds and sanitises', () => {
        expect(clampScroll(50, 100)).toBe(50);
        expect(clampScroll(500, 100)).toBe(100);
        expect(clampScroll(-5, 100)).toBe(0);
        expect(clampScroll(Number.NaN, 100)).toBe(0);
        expect(clampScroll(10, -3)).toBe(0);
    });
    it('firstRowAt is the first row whose far edge is past the scroll', () => {
        expect(firstRowAt(0, 40, 100)).toBe(0);
        expect(firstRowAt(39, 40, 100)).toBe(0);
        expect(firstRowAt(40, 40, 100)).toBe(1);
        expect(firstRowAt(9999, 40, 100)).toBe(100);
        const prefix = buildPrefixSums((i) => (i === 0 ? 100 : 10), 5);
        expect(firstRowAt(99, 10, 5, prefix)).toBe(0);
        expect(firstRowAt(100, 10, 5, prefix)).toBe(1);
        expect(firstRowAt(115, 10, 5, prefix)).toBe(2);
    });
    it('parsePx reads plain pixel numbers only', () => {
        expect(parsePx('40px')).toBe(40);
        expect(parsePx(' 60px ')).toBe(60);
        expect(parsePx('2.5rem')).toBeNull();
        expect(parsePx('')).toBeNull();
        expect(parsePx('calc(1px)')).toBeNull();
    });
    it('heightChanged ignores sub-pixel noise', () => {
        expect(heightChanged(40, 40.4)).toBe(false);
        expect(heightChanged(40, 40.5)).toBe(true);
        expect(heightChanged(40, 39.4)).toBe(true);
    });
    it('retained tops are read back per window object', () => {
        const w = computeBodyWindow(base);
        expect(retainedTopOf(w, 7)).toBe(0);
        setRetainedTops(w, new Map([[7, 280]]));
        expect(retainedTopOf(w, 7)).toBe(280);
        expect(retainedTopOf(w, 8)).toBe(0);
        expect(retainedTopOf(computeBodyWindow(base), 7)).toBe(0);
    });
});

describe('windowCovers', () => {
    it('keeps a window that still has spare rows on both sides, or touches the list edge', () => {
        expect(windowCovers({ start: 10, end: 40 }, { start: 15, end: 35 }, 2, 1000)).toBe(true);
        expect(windowCovers({ start: 10, end: 40 }, { start: 11, end: 35 }, 2, 1000)).toBe(false);
        expect(windowCovers({ start: 10, end: 40 }, { start: 15, end: 39 }, 2, 1000)).toBe(false);
        expect(windowCovers({ start: 0, end: 40 }, { start: 0, end: 35 }, 2, 1000)).toBe(true);
        expect(windowCovers({ start: 10, end: 1000 }, { start: 20, end: 1000 }, 2, 1000)).toBe(true);
    });
});
