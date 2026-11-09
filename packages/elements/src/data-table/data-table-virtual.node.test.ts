import { describe, expect, it } from 'vitest';
import {
    buildPrefixSums,
    columnMinWidthPx,
    computeColumnRange,
    computeRowRange,
    computeVariableRowRange,
    isVirtualScrollActive,
    resolveColumnMinWidth,
    scrollLeftForColumn,
    scrollTopForRow,
} from './data-table-virtual.js';

describe('computeRowRange', () => {
    it('is empty for zero rows or a non-positive row height', () => {
        expect(computeRowRange(0, 500, 40, 0, 5)).toEqual({ start: 0, end: 0 });
        expect(computeRowRange(0, 500, 0, 10, 5)).toEqual({ start: 0, end: 0 });
    });
    it('windows at the top, with the buffer', () => {
        expect(computeRowRange(0, 400, 40, 10000, 5)).toEqual({ start: 0, end: 15 });
    });
    it('covers every row that intersects the viewport, widened by the buffer', () => {
        expect(computeRowRange(5000, 400, 40, 10000, 5)).toEqual({ start: 120, end: 140 });
        expect(computeRowRange(5020, 400, 40, 10000, 0)).toEqual({ start: 125, end: 136 });
        expect(computeRowRange(100000, 400, 40, 1000, 5)).toEqual({ start: 1000, end: 1000 });
        expect(computeRowRange(39800, 400, 40, 1000, 5).end).toBe(1000);
        expect(computeRowRange(0, 400, 40, 1, 5)).toEqual({ start: 0, end: 1 });
    });
    it('treats NaN and negative input as zero instead of producing a NaN window', () => {
        expect(computeRowRange(Number.NaN, Number.NaN, 40, 100, 2)).toEqual({ start: 0, end: 2 });
        expect(computeRowRange(-500, 400, 40, 100, 0)).toEqual({ start: 0, end: 10 });
    });
    it('handles a huge dataset', () => {
        expect(computeRowRange(4e9, 800, 40, 1e9, 10)).toEqual({ start: 1e8 - 10, end: 1e8 + 30 });
    });
});

describe('computeColumnRange', () => {
    const widths = [100, 150, 200, 120, 80, 300, 100, 150, 200, 120];
    it('is empty without columns', () => {
        expect(computeColumnRange(0, 800, [], 3)).toEqual({ start: 0, end: 0, paddingLeft: 0, paddingRight: 0 });
    });
    it('covers every column that intersects the viewport, including exact edges and scroll past the end', () => {
        expect(computeColumnRange(400, 400, widths, 0)).toEqual({ start: 2, end: 6, paddingLeft: 250, paddingRight: 570 });
        expect(computeColumnRange(450, 200, widths, 0)).toEqual({ start: 3, end: 5, paddingLeft: 450, paddingRight: 870 });
        expect(computeColumnRange(100000, 500, widths, 0)).toEqual({ start: 10, end: 10, paddingLeft: 1520, paddingRight: 0 });
    });
    it('widens by the buffer and pads the rest', () => {
        expect(computeColumnRange(400, 400, widths, 1)).toEqual({ start: 1, end: 7, paddingLeft: 100, paddingRight: 470 });
    });
    it('keeps padding + visible = total, and shows everything when the viewport is wide', () => {
        const r = computeColumnRange(0, 500, widths, 0);
        const visible = widths.slice(r.start, r.end).reduce((a, b) => a + b, 0);
        expect(r.paddingLeft + visible + r.paddingRight).toBe(1520);
        expect(computeColumnRange(0, 5000, widths, 2)).toMatchObject({ start: 0, end: 10, paddingLeft: 0, paddingRight: 0 });
    });
});

describe('variable row heights', () => {
    const heights = [40, 100, 200, 50, 80, 1000, 40, 60, 300, 40];
    const h = (i: number) => heights[i] ?? 40;
    const sums = buildPrefixSums(h, heights.length);

    it('builds a cumulative table with a leading zero, and survives zero rows', () => {
        expect(Array.from(buildPrefixSums((i) => [40, 100, 200][i] ?? 0, 3))).toEqual([0, 40, 140, 340]);
        expect(Array.from(buildPrefixSums(h, 0))).toEqual([0]);
    });
    it('is empty for zero rows', () => {
        expect(computeVariableRowRange(0, 500, h, 0, 5)).toEqual({ start: 0, end: 0, paddingTop: 0, paddingBottom: 0 });
    });
    it('handles a 1000px row and keeps the total height', () => {
        expect(computeVariableRowRange(370, 500, h, 10, 1)).toEqual({ start: 2, end: 7, paddingTop: 140, paddingBottom: 400 });
        const r = computeVariableRowRange(100, 300, h, 10, 2);
        const visible = heights.slice(r.start, r.end).reduce((a, b) => a + b, 0);
        expect(r.paddingTop + visible + r.paddingBottom).toBe(1910);
    });
    it('covers every intersecting row, with and without prefix sums, to the same result', () => {
        const cases: [number, number, number, object][] = [
            [100, 300, 0, { start: 1, end: 5, paddingTop: 40, paddingBottom: 1440 }],
            [40, 300, 0, { start: 1, end: 3, paddingTop: 40, paddingBottom: 1570 }],
            [100000, 300, 0, { start: 10, end: 10, paddingTop: 1910, paddingBottom: 0 }],
            [0, 300, 2, { start: 0, end: 5, paddingTop: 0, paddingBottom: 1440 }],
            [200, 300, 1, { start: 1, end: 7, paddingTop: 40, paddingBottom: 400 }],
        ];
        for (const [top, view, buffer, expected] of cases) {
            expect(computeVariableRowRange(top, view, h, 10, buffer)).toEqual(expected);
            expect(computeVariableRowRange(top, view, h, 10, buffer, sums)).toEqual(expected);
        }
    });
    it('ignores a prefix table of the wrong length', () => {
        expect(computeVariableRowRange(40, 300, h, 10, 0, new Float64Array(3))).toEqual({ start: 1, end: 3, paddingTop: 40, paddingBottom: 1570 });
    });
});

describe('scroll targets', () => {
    it('uses prefix sums when given, else index * height; clamps negatives', () => {
        const sums = buildPrefixSums(() => 10, 5);
        expect(scrollTopForRow(3, 40, sums)).toBe(30);
        expect(scrollTopForRow(3, 40)).toBe(120);
        expect(scrollTopForRow(99, 40, sums)).toBe(3960);
        expect(scrollTopForRow(-2, 40)).toBe(0);
    });
    it('sums the column widths before the target', () => {
        expect(scrollLeftForColumn(2, [100, 50, 30])).toBe(150);
        expect(scrollLeftForColumn(9, [100, 50, 30])).toBe(180);
        expect(scrollLeftForColumn(0, [100])).toBe(0);
    });
});

describe('isVirtualScrollActive', () => {
    const t = { rows: 100, columns: 20 };
    it('is never on for false and always on for true (even beside a pager)', () => {
        expect(isVirtualScrollActive(false, false, 1e6, 99, t)).toBe(false);
        expect(isVirtualScrollActive(true, true, 1, 1, t)).toBe(true);
    });
    it('auto needs no pager and a crossed threshold', () => {
        expect(isVirtualScrollActive('auto', false, 101, 3, t)).toBe(true);
        expect(isVirtualScrollActive('auto', false, 100, 20, t)).toBe(false);
        expect(isVirtualScrollActive('auto', false, 5, 21, t)).toBe(true);
        expect(isVirtualScrollActive('auto', true, 1e6, 99, t)).toBe(false);
    });
});

describe('column min width', () => {
    it('uses minWidth, else 80px, else 0px for the table-owned columns', () => {
        expect(resolveColumnMinWidth({ accessorKey: 'a', minWidth: '120px' })).toBe('120px');
        expect(resolveColumnMinWidth({ accessorKey: 'a' })).toBe('80px');
        expect(resolveColumnMinWidth({ accessorKey: '_selection' })).toBe('0px');
    });
    it('reads the floor as pixels, falling back to the default for non-pixel input', () => {
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: '120px' })).toBe(120);
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: 'auto' })).toBe(80);
        expect(columnMinWidthPx({ accessorKey: '_actions' })).toBe(0);
    });
});

describe('columnMinWidthPx units', () => {
    it('reads px and rem, and falls back to the default floor for a length it cannot measure', () => {
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: '10rem' })).toBe(160);
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: '10rem' }, 20)).toBe(200);
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: '20%' })).toBe(80);
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: 'calc(1px + 2px)' })).toBe(80);
        expect(columnMinWidthPx({ accessorKey: 'a', minWidth: '90' })).toBe(90);
    });
});
