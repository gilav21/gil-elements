import { describe, expect, it } from 'vitest';
import { computeGridAria, groupRowExpanded, treeRowAria } from './data-table-aria.js';

describe('computeGridAria', () => {
    it('is a grid; the header row is 1 and data starts at 2; the count includes the header', () => {
        const aria = computeGridAria({ tree: false, headerRows: 1, totalDataRows: 5, columnCount: 3 });
        expect(aria.role).toBe('grid');
        expect(aria.rowCount).toBe(6);
        expect(aria.colCount).toBe(3);
        expect(aria.headerRowIndex(0)).toBe(1);
        expect([0, 1, 4].map(aria.dataRowIndex)).toEqual([2, 3, 6]);
        expect([0, 1, 2].map(aria.colIndex)).toEqual([1, 2, 3]);
    });
    it('counts a real floating-filter row as a second header row', () => {
        const aria = computeGridAria({ tree: false, headerRows: 2, totalDataRows: 1, columnCount: 1 });
        expect(aria.rowCount).toBe(3);
        expect(aria.dataRowIndex(0)).toBe(3);
        expect(aria.headerRowIndex(1)).toBe(2);
    });
    it('is a treegrid in tree mode', () => {
        expect(computeGridAria({ tree: true, headerRows: 1, totalDataRows: 0, columnCount: 0 }).role).toBe('treegrid');
    });
    it('numbers windowed rows absolutely and counts the whole dataset', () => {
        const aria = computeGridAria({ tree: false, headerRows: 1, totalDataRows: 5000, columnCount: 30, firstRenderedRow: 120 });
        expect(aria.rowCount).toBe(5001);
        expect(aria.dataRowIndex(0)).toBe(122);
        expect(aria.dataRowIndex(2)).toBe(124);
    });
    it('leaves aria-colindex off when columns are windowed, but still counts them', () => {
        const aria = computeGridAria({ tree: false, headerRows: 1, totalDataRows: 5, columnCount: 30, columnsWindowed: true });
        expect(aria.colIndex(0)).toBeNull();
        expect(aria.colCount).toBe(30);
    });
    it('treats NaN or negative counts as zero', () => {
        const aria = computeGridAria({ tree: false, headerRows: Number.NaN, totalDataRows: -4, columnCount: Number.NaN });
        expect(aria).toMatchObject({ rowCount: 0, colCount: 0 });
        expect(aria.dataRowIndex(0)).toBe(1);
    });
});

describe('tree and group rows', () => {
    it('gives tree rows a 1-based level and no aria-expanded on a leaf', () => {
        expect(treeRowAria({ depth: 0, isLeaf: false, isExpanded: true })).toEqual({ level: 1, expanded: true });
        expect(treeRowAria({ depth: 2, isLeaf: false, isExpanded: false })).toEqual({ level: 3, expanded: false });
        expect(treeRowAria({ depth: 1, isLeaf: true, isExpanded: false })).toEqual({ level: 2, expanded: null });
    });
    it('group rows are expanded unless collapsed', () => {
        expect(groupRowExpanded({ collapsed: false })).toBe(true);
        expect(groupRowExpanded({ collapsed: true })).toBe(false);
    });
});
