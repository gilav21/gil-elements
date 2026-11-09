import { describe, expect, it } from 'vitest';
import { pageSizeTarget, pageTarget, totalPages } from './data-table-paging.js';

describe('totalPages', () => {
    it('rounds up, is at least one, and reads a bad page size as 10', () => {
        expect(totalPages(25, 10)).toBe(3);
        expect(totalPages(0, 10)).toBe(1);
        expect(totalPages(25, 0)).toBe(3);
        expect(totalPages(25, -5)).toBe(3);
    });
});

describe('pageTarget', () => {
    const state = { pageIndex: 1, pageSize: 10 };
    it('moves and clamps to the first and last page', () => {
        expect(pageTarget(state, 35, 'first').pageIndex).toBe(0);
        expect(pageTarget(state, 35, 'previous').pageIndex).toBe(0);
        expect(pageTarget(state, 35, 'next').pageIndex).toBe(2);
        expect(pageTarget(state, 35, 'last').pageIndex).toBe(3);
        expect(pageTarget({ pageIndex: 3, pageSize: 10 }, 35, 'next').pageIndex).toBe(3);
        expect(pageTarget({ pageIndex: 0, pageSize: 10 }, 35, 'previous').pageIndex).toBe(0);
    });

    it('keeps the page size and is one page for no rows', () => {
        expect(pageTarget({ pageIndex: 0, pageSize: 20 }, 0, 'last')).toEqual({ pageIndex: 0, pageSize: 20 });
    });
});

describe('pageSizeTarget', () => {
    it('goes back to page 0 with the new size; a bad value keeps the size but still resets', () => {
        expect(pageSizeTarget({ pageIndex: 4, pageSize: 10 }, '25')).toEqual({ pageIndex: 0, pageSize: 25 });
        expect(pageSizeTarget({ pageIndex: 4, pageSize: 10 }, 'abc')).toEqual({ pageIndex: 0, pageSize: 10 });
        expect(pageSizeTarget({ pageIndex: 4, pageSize: 10 }, '0')).toEqual({ pageIndex: 0, pageSize: 10 });
    });
});
