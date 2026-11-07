import { describe, expect, it } from 'vitest';
import {
    buildCellGrid,
    cellGridBounds,
    cellRectangle,
    cellsInBounds,
    expandSelectionBounds,
    ownTableCells,
    selectionBounds,
} from './rich-text-table-grid.js';

function tableOf(html: string): HTMLTableElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.querySelector('table')!;
}

const texts = (cells: Iterable<HTMLTableCellElement | null>): (string | null)[] =>
    Array.from(cells, (cell) => (cell ? (cell.textContent ?? '') : null));

describe('buildCellGrid', () => {
    it('places a cell at the first column its row has free after the rowspans from above', () => {
        const table = tableOf('<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></table>');

        expect(buildCellGrid(table).map(texts)).toEqual([['A', 'B'], ['A', 'C']]);
    });

    it('is as wide as the widest row including carried-over columns, padding ragged rows with null', () => {
        const table = tableOf('<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>');

        expect(buildCellGrid(table).map(texts)).toEqual([['1', '2'], ['3', null]]);
    });

    it('spreads a colspan cell over every column it covers', () => {
        const table = tableOf('<table><tr><td colspan="2">M</td><td>X</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>');

        expect(buildCellGrid(table).map(texts)).toEqual([['M', 'M', 'X'], ['1', '2', '3']]);
    });

    it('ignores rowspans that exceed the table bounds', () => {
        const table = tableOf('<table><tr><td rowspan="5">A</td><td>B</td></tr><tr><td>C</td></tr></table>');

        expect(buildCellGrid(table).map(texts)).toEqual([['A', 'B'], ['A', 'C']]);
    });

    it('has no rows for an empty table', () => {
        expect(buildCellGrid(tableOf('<table></table>'))).toEqual([]);
    });
});

describe('cellGridBounds and selectionBounds', () => {
    const table = tableOf('<table><tr><td rowspan="2">A</td><td>B</td><td>C</td></tr><tr><td colspan="2">D</td></tr></table>');
    const grid = buildCellGrid(table);
    const [a, b, , d] = Array.from(table.querySelectorAll('td'));

    it('reports the slots a cell covers', () => {
        expect(cellGridBounds(grid, a!)).toEqual({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 0 });
        expect(cellGridBounds(grid, d!)).toEqual({ minRow: 1, maxRow: 1, minCol: 1, maxCol: 2 });
    });

    it('reads a cell outside the grid as the origin', () => {
        expect(cellGridBounds(grid, document.createElement('td'))).toEqual({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 });
    });

    it('covers every cell of a selection', () => {
        expect(selectionBounds(grid, [b!, d!])).toEqual({ minRow: 0, maxRow: 1, minCol: 1, maxCol: 2 });
    });
});

describe('expandSelectionBounds', () => {
    it('grows the rectangle until no merged cell is cut by its edge', () => {
        const table = tableOf('<table><tr><td>P</td><td rowspan="2">Q</td><td>R</td></tr><tr><td>S</td><td>T</td></tr></table>');
        const grid = buildCellGrid(table);

        const bounds = expandSelectionBounds(grid, { minRow: 0, maxRow: 0, minCol: 0, maxCol: 2 });

        expect(bounds).toEqual({ minRow: 0, maxRow: 1, minCol: 0, maxCol: 2 });
        expect(texts(cellsInBounds(grid, bounds))).toEqual(['P', 'Q', 'R', 'S', 'T']);
    });

    it('grows each of the four edges independently', () => {
        const table = tableOf(
            '<table><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td><td rowspan="2" colspan="2">e</td></tr><tr><td>f</td></tr></table>',
        );
        const grid = buildCellGrid(table);

        expect(expandSelectionBounds(grid, { minRow: 1, maxRow: 1, minCol: 1, maxCol: 1 })).toEqual({ minRow: 1, maxRow: 2, minCol: 1, maxCol: 2 });
        expect(expandSelectionBounds(grid, { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 })).toEqual({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 });
    });
});

describe('cellRectangle', () => {
    it('selects the block spanning two cells, grown to whole spans', () => {
        const table = tableOf('<table><tr><td>P</td><td rowspan="2">Q</td><td>R</td></tr><tr><td>S</td><td>T</td></tr></table>');
        const [p, , r] = Array.from(table.querySelectorAll('td'));

        expect(texts(cellRectangle(p!, r!)).sort()).toEqual(['P', 'Q', 'R', 'S', 'T']);
    });

    it('selects from a rowspan cell to a cell it pushed right', () => {
        const table = tableOf('<table><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>');
        const [a, , , d] = Array.from(table.querySelectorAll('td'));

        expect(texts(cellRectangle(a!, d!))).toEqual(['A', 'B', 'C', 'D']);
    });

    it('skips the empty slots of a ragged table', () => {
        const table = tableOf('<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>');
        const cells = Array.from(table.querySelectorAll('td'));

        expect(texts(cellRectangle(cells[1]!, cells[2]!)).sort()).toEqual(['1', '2', '3']);
    });

    it('is empty for an anchor with no table', () => {
        expect(cellRectangle(document.createElement('td'), document.createElement('td'))).toEqual([]);
    });
});

describe('ownTableCells', () => {
    it('leaves out the cells of a table nested in one of them', () => {
        const table = tableOf('<table><tr><td>A<table><tr><td>x</td></tr></table></td><td>B</td></tr></table>');

        expect(texts(ownTableCells(table))).toEqual(['Ax', 'B']);
    });
});
