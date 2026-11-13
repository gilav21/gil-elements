import { describe, expect, it } from 'vitest';
import { cellGrid, copyGrid, type CopySource, gridCells, keyboardCopyGrid, rangeGrid, rowGrid, selectedGrid } from './data-table-clipboard-grid.js';
import { normalizeCellRange, parseClipboardGrid } from './data-table-range.js';
import { toClipboardText } from './data-table.spreadsheet.js';
import type { ColumnDef } from './data-table.types.js';

interface NumRow {
    id: string;
    name: string;
    score: number;
}

// Angular spec "Export & Clipboard" (NUM_DATA / NUM_COLUMNS).
const NUM_DATA: NumRow[] = [
    { id: '1', name: 'Alice', score: 30 },
    { id: '2', name: 'Bob', score: 25 },
    { id: '3', name: 'Charlie', score: 35 },
    { id: '4', name: 'David', score: 28 },
    { id: '5', name: 'Eve', score: 22 },
];
const NUM_COLUMNS: ColumnDef<NumRow>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'score', header: 'Score' },
];

function source(overrides: Partial<CopySource<NumRow>> = {}, rows: readonly NumRow[] = NUM_DATA, columns = NUM_COLUMNS): CopySource<NumRow> {
    const keys = columns.map((c) => String(c.accessorKey));
    return {
        columns,
        navigableKeys: keys,
        rowAt: (i) => rows[i],
        focused: null,
        range: null,
        drawnRows: () => rows,
        isSelected: () => false,
        exportAll: () => [columns.map((c) => c.header), ...rows.map((row) => columns.map((c) => String(row[c.accessorKey as keyof NumRow])))],
        ...overrides,
    };
}
const tsv = (grid: string[][] | null): string | null => (grid ? toClipboardText(grid) : null);

describe('the copy scopes', () => {
    it('copies one row as tab-separated cell values, no header (spec copyRowToClipboard)', () => {
        expect(tsv(rowGrid(NUM_COLUMNS, NUM_DATA[0] as NumRow))).toBe('1\tAlice\t30');
        expect(copyGrid('row', source())).toBeNull(); // no row given
    });

    it('copies the whole table with a header line (spec copyAllToClipboard)', () => {
        const lines = tsv(copyGrid('all', source()))?.split('\n') ?? [];
        expect(lines[0]).toBe('ID\tName\tScore');
        expect(lines).toHaveLength(6);
    });

    it('quotes cells a spreadsheet would run as formulas but keeps plain numbers numeric (spec 4069)', () => {
        const rows: NumRow[] = [
            { id: '1', name: '=HYPERLINK("http://evil.example","click")', score: -12 },
            { id: '2', name: '@SUM(A1:A2)', score: 3.5 },
            { id: '3', name: '- item', score: 4 },
            { id: '4', name: 'two\nlines\tand "quotes"', score: 5 },
        ];
        const all = source({}, rows);
        expect(parseClipboardGrid(tsv(copyGrid('all', all)) ?? '')).toEqual([
            ['ID', 'Name', 'Score'],
            ['1', '\'=HYPERLINK("http://evil.example","click")', '-12'],
            ['2', "'@SUM(A1:A2)", '3.5'],
            ['3', "'- item", '4'],
            ['4', 'two\nlines\tand "quotes"', '5'],
        ]);
    });

    it('keeps a comma inside a one-column grid through the paste round trip (spec 4094)', () => {
        const cols: ColumnDef<NumRow>[] = [{ accessorKey: 'name', header: 'Name' }];
        const rows = [{ id: '1', name: 'Smith, John', score: 0 }, { id: '2', name: 'Ada', score: 0 }];
        expect(parseClipboardGrid(tsv(copyGrid('all', source({}, rows, cols))) ?? '')).toEqual([['Name'], ['Smith, John'], ['Ada']]);
    });

    it('copies only the selected rows, with the header, in drawn order; nothing when none is selected (spec 4108, 4126)', () => {
        const picked = new Set(['2', '4']);
        const lines = tsv(selectedGrid(source({ isSelected: (row) => picked.has(row.id) })))?.split('\n') ?? [];
        expect(lines).toEqual(['ID\tName\tScore', '2\tBob\t25', '4\tDavid\t28']);
        expect(selectedGrid(source())).toBeNull();
        // the drawn order (a grouping) wins over the data order, collapsed groups included: it is the list the source gives
        const drawn = [NUM_DATA[3], NUM_DATA[1]] as NumRow[];
        expect(selectedGrid(source({ isSelected: (row) => picked.has(row.id), drawnRows: () => drawn }))?.slice(1).map((cells) => cells[0])).toEqual(['4', '2']);
    });

    it('copies the focused cell, and nothing without one (spec 4148, 4157)', () => {
        expect(tsv(cellGrid(source({ focused: { rowIndex: 2, columnKey: 'name' } })))).toBe('Charlie');
        expect(cellGrid(source())).toBeNull();
        expect(cellGrid(source({ focused: { rowIndex: 99, columnKey: 'name' } }))).toBeNull(); // a row that is gone
        expect(cellGrid(source({ focused: { rowIndex: 0, columnKey: 'gone' } }))).toBeNull();
    });

    it('uses the column cell formatter, as the cell shows it', () => {
        const cols: ColumnDef<NumRow>[] = [{ accessorKey: 'score', header: 'Score', cell: (row) => `${row.score} pts` }];
        expect(tsv(cellGrid(source({ focused: { rowIndex: 0, columnKey: 'score' } }, NUM_DATA, cols)))).toBe('30 pts');
    });

    it('copies the range rectangle in drawn column order, no header, rows past the data skipped (spec 4475-4549)', () => {
        const keys = ['id', 'name', 'score'];
        expect(tsv(rangeGrid(source({ range: normalizeCellRange({ startRow: 0, startCol: 'id', endRow: 1, endCol: 'name' }, keys) })))).toBe('1\tAlice\n2\tBob');
        // made from the end back to the anchor: the same rectangle
        expect(tsv(rangeGrid(source({ range: normalizeCellRange({ startRow: 1, startCol: 'name', endRow: 0, endCol: 'id' }, keys) })))).toBe('1\tAlice\n2\tBob');
        const long = rangeGrid(source({ range: normalizeCellRange({ startRow: 0, startCol: 'id', endRow: 50, endCol: 'name' }, keys) }));
        expect(long).toHaveLength(NUM_DATA.length);
        expect(rangeGrid(source())).toBeNull();
        expect(rangeGrid(source({ range: { minRow: 40, maxRow: 50, minCol: 0, maxCol: 1 } }))).toBeNull(); // wholly past the rows
    });

    it('Ctrl+C precedence: the range, else the focused cell, else the selected rows (spec handleCopyKeydown)', () => {
        const focused = { rowIndex: 2, columnKey: 'name' };
        const range = { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 };
        const isSelected = (row: NumRow): boolean => row.id === '1';
        expect(tsv(keyboardCopyGrid(source({ range, focused, isSelected })))).toBe('1\tAlice\n2\tBob');
        expect(tsv(keyboardCopyGrid(source({ focused, isSelected })))).toBe('Charlie');
        expect(tsv(keyboardCopyGrid(source({ isSelected })))).toContain('Alice');
        expect(keyboardCopyGrid(source())).toBeNull(); // nothing focused, ranged or selected
    });

    it('counts the cells of a grid', () => {
        expect(gridCells([['a', 'b'], ['c', 'd'], ['e', 'f']])).toBe(6);
        expect(gridCells([])).toBe(0);
    });
});
