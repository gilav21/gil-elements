import { describe, expect, it } from 'vitest';
import {
    clampToRows,
    coercePasteValue,
    fillSourceRange,
    isCellInRange,
    normalizeCellRange,
    parseClipboardGrid,
    planPaste,
    rangeChartPayload,
    rangeStats,
    rangeEdges,
    readRangeColumns,
    sanitizeCellRange,
} from './data-table-range.js';
import type { CellRange, ColumnDef } from './data-table.types.js';

interface Row {
    name: string;
    q1: number;
    q2: number;
}
const COLS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Rep' },
    { accessorKey: 'q1', header: 'Q1' },
    { accessorKey: 'q2', header: 'Q2' },
];
const KEYS = ['name', 'q1', 'q2'];
const ROWS: Row[] = [
    { name: 'Alice', q1: 10, q2: 20 },
    { name: 'Bob', q1: 30, q2: 40 },
];
const range = (startRow: number, startCol: string, endRow: number, endCol: string): CellRange => ({ startRow, startCol, endRow, endCol });

describe('normalizeCellRange / isCellInRange', () => {
    it('normalises a backwards range', () => {
        expect(normalizeCellRange(range(3, 'q2', 1, 'name'), KEYS)).toEqual({ minRow: 1, maxRow: 3, minCol: 0, maxCol: 2 });
    });
    it('is null for no range or for a column that is no longer navigable', () => {
        expect(normalizeCellRange(null, KEYS)).toBeNull();
        expect(normalizeCellRange(range(0, 'gone', 1, 'q1'), KEYS)).toBeNull();
    });
    it('tests membership by column position, so a reordered column changes the answer', () => {
        const n = normalizeCellRange(range(0, 'name', 1, 'q1'), KEYS);
        expect(isCellInRange(n, KEYS, 1, 'q1')).toBe(true);
        expect(isCellInRange(n, KEYS, 2, 'q1')).toBe(false);
        expect(isCellInRange(n, KEYS, 0, 'q2')).toBe(false);
        expect(isCellInRange(n, ['q2', 'name', 'q1'], 0, 'q2')).toBe(true);
        expect(isCellInRange(n, ['q2', 'q1', 'name'], 0, 'name')).toBe(false);
        expect(isCellInRange(null, KEYS, 0, 'q1')).toBe(false);
        expect(isCellInRange(n, KEYS, 0, 'unknown')).toBe(false);
    });
});

describe('fillSourceRange', () => {
    it('prefers the range, else the focused cell as 1x1, else null', () => {
        const n = normalizeCellRange(range(0, 'q1', 1, 'q2'), KEYS);
        expect(fillSourceRange(n, null, KEYS)).toBe(n);
        expect(fillSourceRange(null, { rowIndex: 2, columnKey: 'q1' }, KEYS)).toEqual({ minRow: 2, maxRow: 2, minCol: 1, maxCol: 1 });
        expect(fillSourceRange(null, { rowIndex: 2, columnKey: 'zz' }, KEYS)).toBeNull();
        expect(fillSourceRange(null, null, KEYS)).toBeNull();
    });
});

describe('clampToRows', () => {
    const focus = { rowIndex: 5, columnKey: 'q1' };
    it('drops a focus past the last row and keeps one within', () => {
        expect(clampToRows(focus, null, 5).focused).toBeNull();
        expect(clampToRows(focus, null, 6).focused).toBe(focus);
    });
    it('trims a range running past, drops one wholly past, keeps one whose first row is the last', () => {
        expect(clampToRows(null, range(1, 'name', 9, 'q1'), 4).range).toEqual(range(1, 'name', 3, 'q1'));
        expect(clampToRows(null, range(7, 'name', 9, 'q1'), 4).range).toBeNull();
        expect(clampToRows(null, range(3, 'name', 8, 'q1'), 4).range).toEqual(range(3, 'name', 3, 'q1'));
        const inside = range(0, 'name', 2, 'q1');
        expect(clampToRows(null, inside, 4).range).toBe(inside);
    });
    it('leaves everything alone while the list is empty (a server page loading)', () => {
        const r = range(0, 'name', 9, 'q1');
        expect(clampToRows(focus, r, 0)).toEqual({ focused: focus, range: r });
    });
});

describe('range columns, stats and chart payload', () => {
    const cols = (r: CellRange) => readRangeColumns(normalizeCellRange(r, KEYS) as never, KEYS, ROWS, COLS);

    it('reads header and values per column, skipping rows that are missing', () => {
        expect(cols(range(0, 'name', 5, 'q1'))).toEqual([
            { key: 'name', header: 'Rep', values: ['Alice', 'Bob'] },
            { key: 'q1', header: 'Q1', values: [10, 30] },
        ]);
    });
    it('computes stats for a multi-cell range only', () => {
        expect(rangeStats(cols(range(0, 'q1', 1, 'q2')))).toEqual({ count: 4, numericCount: 4, sum: '100', avg: '25', min: '10', max: '40' });
        expect(rangeStats(cols(range(0, 'q1', 0, 'q1')))).toBeNull();
    });
    it('counts only finite numbers as numeric', () => {
        expect(rangeStats(cols(range(0, 'name', 1, 'name')))).toMatchObject({ count: 2, numericCount: 0, sum: '' });
    });
    it('builds a chart: first non-numeric column labels, numeric columns are series', () => {
        expect(rangeChartPayload(cols(range(0, 'name', 1, 'q2')))).toEqual({
            categories: ['Alice', 'Bob'],
            series: [{ name: 'Q1', values: [10, 30] }, { name: 'Q2', values: [20, 40] }],
        });
    });
    it('labels rows "Row n" without a text column, and gives no chart without numbers or rows', () => {
        expect(rangeChartPayload(cols(range(0, 'q1', 1, 'q1')))?.categories).toEqual(['Row 1', 'Row 2']);
        expect(rangeChartPayload(cols(range(0, 'name', 1, 'name')))).toBeNull();
        expect(rangeChartPayload([])).toBeNull();
        expect(rangeChartPayload([{ key: 'q1', header: 'Q1', values: [] }])).toBeNull();
    });
});

describe('parseClipboardGrid', () => {
    it('returns an empty grid for empty text', () => {
        expect(parseClipboardGrid('')).toEqual([]);
    });
    it('parses tab-separated text, drops one trailing newline, normalises CRLF and CR', () => {
        expect(parseClipboardGrid('a\tb\n1\t2\n')).toEqual([['a', 'b'], ['1', '2']]);
        expect(parseClipboardGrid('a\tb\r\n1\t2\r3\t4')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    });
    it('parses comma-separated text with quoted cells and escaped quotes', () => {
        expect(parseClipboardGrid('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
        expect(parseClipboardGrid('"a,b","c""d"\n1,2')).toEqual([['a,b', 'c"d'], ['1', '2']]);
    });
    it('keeps one cell per line without a delimiter, and keeps an inner empty line', () => {
        expect(parseClipboardGrid('one\ntwo')).toEqual([['one'], ['two']]);
    });
    it('keeps a quoted cell with a line break in one cell, tab- or comma-separated, as Excel and Sheets send it', () => {
        expect(parseClipboardGrid('"a\nb",c\n1,2')).toEqual([['a\nb', 'c'], ['1', '2']]);
        expect(parseClipboardGrid('"a\nb"\tc\n1\t2')).toEqual([['a\nb', 'c'], ['1', '2']]);
        expect(parseClipboardGrid('"say ""hi"""\t"x\ty"\r\n1\t2\r\n')).toEqual([['say "hi"', 'x\ty'], ['1', '2']]);
        expect(parseClipboardGrid('5" pipe\tb')).toEqual([['5" pipe', 'b']]);
        expect(parseClipboardGrid('"unterminated\nrest')).toEqual([['unterminated\nrest']]);
    });
    it('does not split a sentence or an uneven list at commas, but reads consistent rows as CSV', () => {
        expect(parseClipboardGrid('Hello, world')).toEqual([['Hello, world']]);
        expect(parseClipboardGrid('apples, pears\nkiwis')).toEqual([['apples, pears'], ['kiwis']]);
        expect(parseClipboardGrid('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
        expect(parseClipboardGrid('"a,b"')).toEqual([['a,b']]);
    });
    it('keeps a plain column of lines', () => {
        expect(parseClipboardGrid('one\ntwo')).toEqual([['one'], ['two']]);
        expect(parseClipboardGrid('a\n\nb')).toEqual([['a'], [''], ['b']]);
    });
    it('treats a lone newline as one empty cell', () => {
        expect(parseClipboardGrid('\n')).toEqual([['']]);
    });
});

describe('paste coercion and planning', () => {
    it('coerces to the type of the current value', () => {
        expect(coercePasteValue('12.5', 1)).toBe(12.5);
        expect(coercePasteValue('abc', 1)).toBe('abc');
        expect(coercePasteValue('', 1)).toBeNull();
        expect(coercePasteValue('   ', 1)).toBeNull();
        expect(coercePasteValue('TRUE', false)).toBe(true);
        expect(coercePasteValue('no', true)).toBe(false);
        expect(coercePasteValue('12', 'text')).toBe('12');
        expect(coercePasteValue('12', undefined)).toBe('12');
    });
    it('maps a grid onto cells, dropping what runs past the last column', () => {
        expect(planPaste([['a', 'b', 'c'], ['d']], 4, 'q1', KEYS)).toEqual([
            { rowIndex: 4, columnKey: 'q1', raw: 'a' },
            { rowIndex: 4, columnKey: 'q2', raw: 'b' },
            { rowIndex: 5, columnKey: 'q1', raw: 'd' },
        ]);
        expect(planPaste([['x']], 0, 'nope', KEYS)).toEqual([]);
        expect(planPaste([], 0, 'q1', KEYS)).toEqual([]);
    });
});

describe('rangeEdges', () => {
    const range = { minRow: 1, maxRow: 3, minCol: 1, maxCol: 2 };

    it('lists the edges a cell touches and nothing for an inner cell', () => {
        expect(rangeEdges(range, 1, 1)).toBe('top start');
        expect(rangeEdges(range, 3, 2)).toBe('bottom end');
        expect(rangeEdges(range, 2, 1)).toBe('start');
        expect(rangeEdges({ ...range, minCol: 1, maxCol: 3 }, 2, 2)).toBe('');
    });

    it('gives a one-cell range all four', () => {
        expect(rangeEdges({ minRow: 2, maxRow: 2, minCol: 0, maxCol: 0 }, 2, 0)).toBe('top bottom start end');
    });
});

describe('sanitizeCellRange', () => {
    const range: CellRange = { startRow: 1, startCol: 'q1', endRow: 3, endCol: 'q2' };

    it('turns undefined and null into "no range"', () => {
        expect(sanitizeCellRange(undefined, 10, KEYS)).toBeNull();
        expect(sanitizeCellRange(null, 10, KEYS)).toBeNull();
    });

    it('keeps a good range, copying only its four fields', () => {
        const result = sanitizeCellRange({ ...range, extra: 1 }, 10, KEYS);
        expect(result).toEqual(range);
        expect(result).not.toBe(range);
        expect(Object.keys(result as object)).toHaveLength(4);
    });

    it.each([
        ['a string', 'q1'],
        ['an empty object', {}],
        ['a fractional row', { ...range, startRow: 1.5 }],
        ['a negative row', { ...range, endRow: -1 }],
        ['a numeric column key', { ...range, startCol: 1 }],
        ['a column that does not exist', { ...range, endCol: 'nope' }],
    ])('refuses %s', (_name, input) => {
        expect(sanitizeCellRange(input, 10, KEYS)).toBeUndefined();
    });

    it('trims rows past the last drawn one, and drops a range wholly past them', () => {
        expect(sanitizeCellRange({ ...range, endRow: 50 }, 5, KEYS)).toEqual({ ...range, endRow: 4 });
        expect(sanitizeCellRange({ ...range, startRow: 20, endRow: 30 }, 5, KEYS)).toBeNull();
    });

    it('leaves rows and columns as they are while they are not known (no rows drawn yet, no column keys)', () => {
        expect(sanitizeCellRange({ ...range, endRow: 50 }, 0, [])).toEqual({ ...range, endRow: 50 });
        expect(sanitizeCellRange({ ...range, endCol: 'whatever' }, 10, [])).toEqual({ ...range, endCol: 'whatever' });
    });
});
