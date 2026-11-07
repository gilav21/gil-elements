import { afterEach, describe, expect, it } from 'vitest';
import { editableOf, editorIn, load, placeCaret, selectBetween } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';
import type { TableCommands, TableSelection } from './rich-text-table-commands.js';

const cleanups: (() => void)[] = [];
afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
});

interface Harness {
    readonly editor: GeRichTextEditor;
    readonly root: HTMLDivElement;
    readonly commands: TableCommands;
    /** Cells the fake pointer half has picked. */
    picked: HTMLTableCellElement[];
    target: HTMLTableCellElement | null;
    table(index?: number): HTMLTableElement;
    /** Replaces the content and returns the first table. */
    seed(html: string): Promise<HTMLTableElement>;
}

/** With `pointer` false no pointer controller is plugged in, so commands fall back to the caret cell. */
async function harness(attributes = '', pointer = true): Promise<Harness> {
    const editor = await editorIn(`<ge-rich-text-editor mode="html" ${attributes}></ge-rich-text-editor>`);
    const root = editableOf(editor);
    const commands = editor.provider('tableCommands')!;
    const state: Harness = {
        editor,
        root,
        commands,
        picked: [],
        target: null,
        table: (index = 0) => root.querySelectorAll('table')[index]!,
        seed: async (html) => {
            await load(editor, html);
            return state.table();
        },
    };
    if (pointer) {
        const selection: TableSelection = {
            selectedCells: () => state.picked,
            select: (cells) => {
                state.picked = [...cells];
            },
            clear: () => {
                state.picked = [];
            },
            target: () => state.target,
            setTarget: (cell) => {
                state.target = cell;
            },
        };
        cleanups.push(editor.provide('tableSelection', selection));
    }
    return state;
}

const SEED = `<table>
    <thead><tr><th>H1</th><th>H2</th></tr></thead>
    <tbody><tr><td>A1</td><td>A2</td></tr><tr><td>B1</td><td>B2</td></tr></tbody>
</table><p><br></p>`;

const textGrid = (table: HTMLTableElement): string[][] =>
    Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.textContent?.trim() ?? ''));

const cellAt = (table: HTMLTableElement, row: number, col: number): HTMLTableCellElement => table.rows[row]!.cells[col]!;

const cellsOf = (table: HTMLTableElement): HTMLTableCellElement[] => Array.from(table.querySelectorAll('td'));

/** A cell's computed [top, right, bottom, left] border styles. */
const sidesOf = (cell: HTMLTableCellElement): string[] => {
    const style = getComputedStyle(cell);
    return [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle];
};

const borderStyles = (table: HTMLTableElement): string[][][] => Array.from(table.rows, (row) => Array.from(row.cells, sidesOf));

describe('table commands: rows, columns and the table', () => {
    it('adds a row above the targeted cell', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);

        h.commands.addRowAbove();

        expect(textGrid(table)).toEqual([['H1', 'H2'], ['', ''], ['A1', 'A2'], ['B1', 'B2']]);
    });

    it('adds a row below the targeted cell', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);

        h.commands.addRowBelow();

        expect(textGrid(table)).toEqual([['H1', 'H2'], ['A1', 'A2'], ['', ''], ['B1', 'B2']]);
    });

    it('adds a column to the left and right', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const a1 = cellAt(table, 1, 0);
        h.target = a1;
        h.commands.addColumnLeft();
        expect(textGrid(table)).toEqual([['', 'H1', 'H2'], ['', 'A1', 'A2'], ['', 'B1', 'B2']]);

        h.target = a1;
        h.commands.addColumnRight();
        expect(textGrid(table)).toEqual([['', 'H1', '', 'H2'], ['', 'A1', '', 'A2'], ['', 'B1', '', 'B2']]);
        expect(Array.from(table.rows[0]!.cells, (cell) => cell.tagName)).toEqual(['TH', 'TH', 'TH', 'TH']);
    });

    it('deletes the targeted row', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 2, 0);

        h.commands.deleteRow();

        expect(textGrid(table)).toEqual([['H1', 'H2'], ['A1', 'A2']]);
        expect(h.target).toBeNull();
    });

    it('removes the whole table when deleting the last remaining row', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>solo</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        h.commands.deleteRow();

        expect(h.root.querySelector('table')).toBeNull();
    });

    it('deletes the targeted column', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);

        h.commands.deleteColumn();

        expect(textGrid(table)).toEqual([['H2'], ['A2'], ['B2']]);
    });

    it('removes the whole table when deleting the last remaining column', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>onlycol</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        h.commands.deleteColumn();

        expect(h.root.querySelector('table')).toBeNull();
    });

    it('deletes the entire table via deleteTable', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);

        h.commands.deleteTable();

        expect(h.root.querySelector('table')).toBeNull();
    });

    it('records one history entry per command', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);
        const before = h.editor.historyEntries().length;

        h.commands.addRowBelow();

        expect(h.editor.historyEntries().length - before).toBe(1);
    });

    it('ignores a menu action whose target was detached', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const merged = cellAt(table, 1, 0);
        merged.colSpan = 2;
        h.target = merged;

        await load(h.editor, '<p>replaced</p>');

        expect(merged.isConnected).toBe(false);
        expect(h.commands.canSplitCell()).toBe(false);
        h.commands.splitCell();
        expect(merged.getAttribute('colspan')).toBe('2');
    });

    it('table operations are no-ops without a target cell', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const before = table.innerHTML;
        h.target = null;

        h.commands.addRowAbove();
        h.commands.addRowBelow();
        h.commands.addColumnLeft();
        h.commands.addColumnRight();
        h.commands.deleteRow();
        h.commands.deleteColumn();
        h.commands.toggleHeaderRow();
        h.commands.deleteTable();
        h.commands.setBorders('all');
        h.commands.setCellAlignment('center');
        h.commands.setCellColor('#fff');

        expect(h.root.contains(table)).toBe(true);
        expect(table.innerHTML).toBe(before);
    });

    it('falls back to the cell holding the caret without a pointer controller', async () => {
        const h = await harness('', false);
        const table = await h.seed(SEED);

        placeCaret(cellAt(table, 1, 1).firstChild!, 1);
        h.commands.addRowBelow();

        expect(textGrid(table)).toEqual([['H1', 'H2'], ['A1', 'A2'], ['', ''], ['B1', 'B2']]);
    });

    it('routes the column insertion through the RTL branch', async () => {
        const h = await harness('dir="rtl"');
        const table = await h.seed('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);
        h.commands.addColumnLeft();
        expect(textGrid(table)).toEqual([['A', '', 'B']]);

        const second = await h.seed('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
        h.target = cellAt(second, 0, 0);
        h.commands.addColumnRight();
        expect(textGrid(second)).toEqual([['', 'A', 'B']]);
    });

    it('adding a row above the header row inserts header cells', async () => {
        const h = await harness();
        const table = await h.seed('<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        h.commands.addRowAbove();

        expect(table.rows[0]!.querySelector('th')).not.toBeNull();
    });

    it('adding a row below in a table without a tbody appends to the table', async () => {
        const h = await harness();
        const table = document.createElement('table');
        const row = table.appendChild(document.createElement('tr'));
        const cell = row.appendChild(document.createElement('td'));
        cell.textContent = 'A';
        h.root.replaceChildren(table);
        h.target = cell;

        h.commands.addRowBelow();

        expect(h.root.querySelectorAll('tr')).toHaveLength(2);
    });

    it('ignores rowspans that exceed the table bounds', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="5">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        h.commands.addRowBelow();

        expect(textGrid(table)).toEqual([['A', 'B'], ['C'], ['', '']]);
    });
});

describe('table commands: header row', () => {
    it('toggles the header row off again without re-targeting the cell', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>c1</td><td>c2</td></tr><tr><td>d1</td><td>d2</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        h.commands.toggleHeaderRow();
        expect(table.querySelectorAll('thead th')).toHaveLength(2);

        h.commands.toggleHeaderRow();
        expect(table.querySelector('thead')).toBeNull();
        expect(table.querySelectorAll('th')).toHaveLength(0);
    });

    it('re-points a multi-cell selection whose cells a header retag replaced', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.picked = Array.from(table.querySelectorAll('tr:first-child th'));
        h.target = h.picked[0]!;

        h.commands.toggleHeaderRow();

        expect(table.querySelector('thead')).toBeNull();
        expect(table.querySelectorAll('th')).toHaveLength(0);
        expect(h.picked).toHaveLength(2);
        for (const cell of h.picked) expect(cell.isConnected).toBe(true);
    });

    it('creates a tbody when none exists while un-toggling a header-only table', async () => {
        const h = await harness();
        const table = await h.seed('<table><thead><tr><th>A</th><th>B</th></tr></thead></table>');
        h.target = table.querySelector('th');

        h.commands.toggleHeaderRow();

        expect(table.querySelector('tbody')).not.toBeNull();
        expect(table.querySelector('thead')).toBeNull();
        expect(table.querySelectorAll('td')).toHaveLength(2);
    });

    it('leaves a multi-row thead intact when toggling off', async () => {
        const h = await harness();
        const table = await h.seed('<table><thead><tr><th>A</th></tr><tr><th>B</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>');
        h.target = table.querySelector('th');

        h.commands.toggleHeaderRow();

        expect(table.querySelector('thead')).not.toBeNull();
    });
});

describe('table commands: merge and split', () => {
    const THREE = `<table>
        <thead><tr><th>H1</th><th>H2</th><th>H3</th></tr></thead>
        <tbody><tr><td>A1</td><td>A2</td><td>A3</td></tr><tr><td>B1</td><td>B2</td><td>B3</td></tr></tbody>
    </table>`;

    it('merges two horizontally adjacent cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const row = table.tBodies[0]!.rows[0]!;
        h.picked = [row.cells[0]!, row.cells[1]!];

        h.commands.mergeCells();

        expect(row.cells[0]!.colSpan).toBe(2);
        expect(row.cells[0]!.rowSpan).toBe(1);
        expect(row.cells[0]!.innerHTML).toContain('A1');
        expect(row.cells[0]!.innerHTML).toContain('A2');
        expect(row.cells).toHaveLength(2);
    });

    it('merges two vertically adjacent cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const [first, second] = Array.from(table.tBodies[0]!.rows);
        h.picked = [first!.cells[0]!, second!.cells[0]!];

        h.commands.mergeCells();

        expect([first!.cells[0]!.colSpan, first!.cells[0]!.rowSpan]).toEqual([1, 2]);
        expect(first!.cells[0]!.innerHTML).toContain('A1');
        expect(first!.cells[0]!.innerHTML).toContain('B1');
    });

    it('merges a 2x2 block of cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const [first, second] = Array.from(table.tBodies[0]!.rows);
        h.picked = [first!.cells[0]!, first!.cells[1]!, second!.cells[0]!, second!.cells[1]!];

        h.commands.mergeCells();

        expect([first!.cells[0]!.colSpan, first!.cells[0]!.rowSpan]).toEqual([2, 2]);
        expect(first!.cells).toHaveLength(2);
        expect(second!.cells).toHaveLength(1);
    });

    it('does nothing with fewer than 2 selected cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const before = table.outerHTML;
        const entries = h.editor.historyEntries().length;
        h.picked = [cellAt(table, 1, 0)];

        h.commands.mergeCells();

        expect(table.outerHTML).toBe(before);
        expect(h.editor.historyEntries().length).toBe(entries);
    });

    it('keeps a <br> when every merged cell is empty', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const row = table.tBodies[0]!.rows[0]!;
        row.cells[0]!.innerHTML = '';
        row.cells[1]!.innerHTML = '';
        h.picked = [row.cells[0]!, row.cells[1]!];

        h.commands.mergeCells();

        expect(row.cells[0]!.innerHTML).toBe('<br>');
    });

    it('clears the cell selection after a merge', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const row = table.tBodies[0]!.rows[0]!;
        h.picked = [row.cells[0]!, row.cells[1]!];

        h.commands.mergeCells();

        expect(h.picked).toEqual([]);
    });

    it('is a no-op when the first selected cell has no table ancestor', async () => {
        const h = await harness();
        h.picked = [document.createElement('td'), document.createElement('td')];

        expect(() => h.commands.mergeCells()).not.toThrow();
    });

    it('splitCell is a no-op without a target', async () => {
        const h = await harness();
        h.target = null;

        expect(() => h.commands.splitCell()).not.toThrow();
    });

    it('canSplitCell is false for a regular cell and true for a colspan or rowspan', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const cell = cellAt(table, 1, 0);
        h.target = cell;
        expect(h.commands.canSplitCell()).toBe(false);

        cell.colSpan = 2;
        expect(h.commands.canSplitCell()).toBe(true);

        cell.colSpan = 1;
        cell.rowSpan = 2;
        expect(h.commands.canSplitCell()).toBe(true);
    });

    it('splits a colspan=2 cell back into two cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const row = table.tBodies[0]!.rows[0]!;
        h.picked = [row.cells[0]!, row.cells[1]!];
        h.commands.mergeCells();
        expect(row.cells[0]!.colSpan).toBe(2);

        h.target = row.cells[0]!;
        h.commands.splitCell();

        expect(row.cells[0]!.colSpan).toBe(1);
        expect(row.cells).toHaveLength(3);
        expect(row.cells[1]!.innerHTML).toBe('<br>');
    });

    it('splits a rowspan=2 cell back into individual cells', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const [first, second] = Array.from(table.tBodies[0]!.rows);
        h.picked = [first!.cells[0]!, second!.cells[0]!];
        h.commands.mergeCells();

        h.target = first!.cells[0]!;
        h.commands.splitCell();

        expect(first!.cells[0]!.rowSpan).toBe(1);
        expect(first!.cells).toHaveLength(3);
        expect(second!.cells).toHaveLength(3);
    });

    it('does nothing for a cell without a colspan or rowspan', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const before = table.outerHTML;
        const entries = h.editor.historyEntries().length;
        h.target = cellAt(table, 1, 0);

        h.commands.splitCell();

        expect(table.outerHTML).toBe(before);
        expect(h.editor.historyEntries().length).toBe(entries);
    });

    it('creates th elements when splitting inside thead', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const headerRow = table.tHead!.rows[0]!;
        h.picked = [headerRow.cells[0]!, headerRow.cells[1]!];
        h.commands.mergeCells();
        expect(headerRow.cells[0]!.colSpan).toBe(2);

        h.target = headerRow.cells[0]!;
        h.commands.splitCell();

        expect(Array.from(headerRow.cells, (cell) => cell.tagName)).toEqual(['TH', 'TH', 'TH']);
    });

    it('splits a 2x2 merged cell correctly', async () => {
        const h = await harness();
        const table = await h.seed(THREE);
        const [first, second] = Array.from(table.tBodies[0]!.rows);
        h.picked = [first!.cells[0]!, first!.cells[1]!, second!.cells[0]!, second!.cells[1]!];
        h.commands.mergeCells();
        const merged = first!.cells[0]!;
        expect([merged.colSpan, merged.rowSpan]).toEqual([2, 2]);

        h.target = merged;
        h.commands.splitCell();

        expect([merged.colSpan, merged.rowSpan]).toEqual([1, 1]);
        expect(first!.cells).toHaveLength(3);
        expect(second!.cells).toHaveLength(3);
    });

    it('merges the selected cells then splits the merged cell back', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>');
        h.picked = Array.from(table.rows[0]!.cells);
        h.commands.mergeCells();
        const merged = h.root.querySelector<HTMLTableCellElement>('td[colspan="2"]')!;
        expect(merged.textContent).toBe('A B');

        h.target = merged;
        expect(h.commands.canSplitCell()).toBe(true);
        h.commands.splitCell();

        expect(h.root.querySelector('td[colspan="2"]')).toBeNull();
        expect(textGrid(table)).toEqual([['A B', ''], ['C', 'D']]);
    });

    it('counts a cell once when a rowspan/colspan overlap gathers the merged content', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="2" colspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>');
        h.picked = cellsOf(table);

        h.commands.mergeCells();

        expect(table.querySelector('td')!.innerHTML).toBe('A B C');
    });

    it('leaves a table nested in a merged cell alone', async () => {
        const h = await harness();
        const outer = await h.seed(
            '<table><tbody><tr><td>A<table><tbody><tr><td>x</td></tr><tr><td>y</td></tr></tbody></table></td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
        );
        const [cellA, cellB] = Array.from(outer.rows[0]!.cells);
        const [cellC, cellD] = Array.from(outer.rows[1]!.cells);
        h.picked = [cellA!, cellB!, cellC!, cellD!];

        h.commands.mergeCells();

        expect([cellA!.rowSpan, cellA!.colSpan]).toEqual([2, 2]);
        expect(Array.from(cellA!.querySelectorAll('td'), (td) => td.textContent)).toEqual(['x', 'y']);
        expect(Array.from(outer.querySelectorAll(':scope > tbody > tr > td'))).toEqual([cellA]);
    });
});

describe('table commands: cases that belong to the pointer half or cannot run against module functions', () => {
    // Angular spec 1621, 1667, 8566: white-box guards forced by spying on private methods; the grid is a pure module function now
    it.skip('mergeCells is a no-op when the computed grid has no cell at the merge origin', () => undefined);
    it.skip('splitCell skips a grid row index with no corresponding <tr>', () => undefined);
    it.skip('insertTableColumn skips a grid row index with no corresponding <tr>', () => undefined);
});

describe('table commands: spans', () => {
    it('inserting a row through a rowspan extends that span instead of splitting it', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="2">M</td><td>A2</td></tr><tr><td>B2</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 1);

        h.commands.addRowBelow();

        expect(table.querySelector<HTMLTableCellElement>('td[rowspan]')!.rowSpan).toBe(3);
        expect(table.rows).toHaveLength(3);
    });

    it('inserting a column through a colspan extends that span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td colspan="2">M</td></tr><tr><td>B1</td><td>B2</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 0);

        h.commands.addColumnRight();

        expect(table.querySelector<HTMLTableCellElement>('td[colspan]')!.colSpan).toBe(3);
    });

    it('deleting a row that intersects a rowspan reduces the span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="2">M</td><td>A2</td></tr><tr><td>B2</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 0);

        h.commands.deleteRow();

        expect(table.querySelector<HTMLTableCellElement>('td[rowspan]')?.rowSpan ?? 1).toBe(1);
        expect(table.rows).toHaveLength(1);
    });

    it('adding a row below a rowspan that ends at the last row extends the span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A1</td><td rowspan="2">M</td></tr><tr><td>B1</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 0);

        h.commands.addRowBelow();

        expect(table.rows).toHaveLength(3);
        expect(table.querySelector<HTMLTableCellElement>('td[rowspan]')!.rowSpan).toBe(3);
    });

    it('adding a column right of a colspan that ends at the last column extends the span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A1</td><td colspan="2">M</td></tr><tr><td>B1</td><td>B2</td><td>B3</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 2);

        h.commands.addColumnRight();

        expect(table.querySelector<HTMLTableCellElement>('td[colspan]')!.colSpan).toBe(3);
    });

    it('deleting a column intersecting a colspan reduces the span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td colspan="2">M</td></tr><tr><td>B1</td><td>B2</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 0);

        h.commands.deleteColumn();

        expect(cellsOf(table).map((cell) => `${cell.textContent}:${cell.colSpan}`)).toEqual(['M:1', 'B2:1']);
    });

    it('inserting a row mid-table above a cell spanning rows and columns skips already-expanded reference cells', async () => {
        const h = await harness();
        const table = await h.seed(
            '<table><tbody><tr><td rowspan="2" colspan="2">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>',
        );
        h.target = cellAt(table, 1, 0);

        h.commands.addRowAbove();

        expect(table.querySelector('td')!.rowSpan).toBe(3);
        expect(table.rows).toHaveLength(4);
        expect(table.rows[1]!.cells).toHaveLength(1);
    });

    it('inserting a column mid-table before a cell spanning rows and columns skips already-expanded reference cells', async () => {
        const h = await harness();
        const table = await h.seed(
            '<table><tbody><tr><td rowspan="2" colspan="2">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td><td>F</td></tr></tbody></table>',
        );
        h.target = cellAt(table, 2, 1);

        h.commands.addColumnLeft();

        expect(table.querySelector('td')!.colSpan).toBe(3);
        expect(table.rows[1]!.cells).toHaveLength(1);
        expect(table.rows[2]!.cells).toHaveLength(4);
    });

    it('deleting a row intersecting a rowspan moves the cell into the next row', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 1);

        h.commands.deleteRow();

        expect(table.querySelector('td')!.rowSpan).toBe(1);
        expect(table.rows).toHaveLength(1);
        expect(Array.from(table.rows[0]!.cells, (cell) => cell.textContent)).toEqual(['A', 'C']);
    });

    it('deleting a column intersecting a colspan in the middle of the table reduces the span', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td colspan="2">A</td><td>B</td></tr><tr><td>C</td><td>D</td><td>E</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 1);

        h.commands.deleteColumn();

        const first = table.querySelector('td')!;
        expect([first.textContent, first.colSpan]).toEqual(['A', 1]);
    });

    it('deleting a jagged row with a missing trailing cell skips the empty grid slot', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr><tr><td>F</td><td>G</td><td>H</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 1);

        expect(() => h.commands.deleteRow()).not.toThrow();
        expect(table.rows).toHaveLength(2);
    });

    it('adding a column right of a jagged row with a missing trailing cell skips the empty grid slot', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>');
        h.target = cellAt(table, 2, 1);

        expect(() => h.commands.addColumnRight()).not.toThrow();
        expect(table.rows[0]!.cells).toHaveLength(3);
    });

    it('adding a row below a jagged last row with a missing trailing cell skips the empty grid slot', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td>A</td><td>B</td><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>');
        h.target = cellAt(table, 1, 1);

        expect(() => h.commands.addRowBelow()).not.toThrow();
        expect(table.rows).toHaveLength(3);
    });

    it('deleting a row skips a non-adjacent rowspan neighbour before finding the cell to relocate before', async () => {
        const h = await harness();
        const table = await h.seed(
            '<table><tbody><tr><td>P</td><td rowspan="3">Q</td><td>R</td></tr><tr><td rowspan="2">X</td><td>S</td></tr><tr><td>T</td></tr></tbody></table>',
        );
        h.target = cellAt(table, 1, 0);

        h.commands.deleteRow();

        expect(table.rows).toHaveLength(2);
        expect(Array.from(table.rows[1]!.cells, (cell) => cell.textContent)).toEqual(['X', 'T']);
        expect(table.querySelector<HTMLTableCellElement>('td[rowspan]')!.rowSpan).toBe(2);
    });

    it('inserting a column after a rowspan/colspan cell skips a non-adjacent neighbour before finding the reference cell', async () => {
        const h = await harness();
        const table = await h.seed(
            '<table><tbody><tr><td rowspan="3">P</td><td>Q</td><td rowspan="2">R</td></tr><tr><td>S</td></tr><tr><td>T</td><td>U</td></tr></tbody></table>',
        );
        h.target = cellAt(table, 0, 1);

        expect(() => h.commands.addColumnRight()).not.toThrow();
        expect(table.rows[0]!.cells).toHaveLength(4);
    });

    it('deleting a column removes a rowspan cell that occupies it', async () => {
        const h = await harness();
        const table = await h.seed('<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>');
        h.target = cellAt(table, 0, 0);

        expect(() => h.commands.deleteColumn()).not.toThrow();
        expect(table.querySelector('td')!.textContent).not.toContain('A');
    });

    it('appends a relocated rowspan cell directly when the next, fully spanned row has no neighbour to go before', async () => {
        const h = await harness();
        const table = await h.seed(
            '<table><tbody><tr><td>N</td><td rowspan="3">M</td><td rowspan="3">S</td></tr><tr><td rowspan="2">X</td></tr><tr></tr></tbody></table>',
        );
        const cellX = cellAt(table, 1, 0);
        h.target = cellX;

        expect(() => h.commands.deleteRow()).not.toThrow();

        expect(table.rows).toHaveLength(2);
        expect(table.rows[1]!.contains(cellX)).toBe(true);
    });
});

describe('table commands: borders, alignment and colour', () => {
    it('sets cell text alignment', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const cell = cellAt(table, 1, 0);
        h.target = cell;

        h.commands.setCellAlignment('center');

        expect(cell.style.textAlign).toBe('center');
    });

    it('sets and clears cell background colour', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const cell = cellAt(table, 1, 0);
        h.target = cell;

        h.commands.setCellColor('#ff0000');
        expect(cell.style.backgroundColor).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/);

        h.commands.setCellColor('transparent');
        expect(cell.style.backgroundColor).toBe('');
    });

    it('colours every picked cell, not only the target', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.picked = [cellAt(table, 1, 0), cellAt(table, 1, 1)];
        h.target = h.picked[0]!;

        h.commands.setCellColor('#ff0000');

        expect(h.picked.every((cell) => cell.style.backgroundColor !== '')).toBe(true);
        expect(cellAt(table, 2, 0).style.backgroundColor).toBe('');
    });

    it('applies "none" border style to all cells', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);
        h.commands.setBorders('outer');

        h.commands.setBorders('none');

        const none = ['none', 'none', 'none', 'none'];
        expect(borderStyles(table)).toEqual([[none, none], [none, none], [none, none]]);
    });

    it('applies "none" to just the picked cells, leaving the table border', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const picked = cellAt(table, 1, 0);
        h.picked = [picked];
        h.target = picked;

        h.commands.setBorders('none');

        expect(sidesOf(picked)).toEqual(['none', 'none', 'none', 'none']);
        expect(picked.style.borderTopStyle).toBe('none');
        expect(cellAt(table, 1, 1).getAttribute('style')).toBeNull();
    });

    it.each([
        ['ltr', { A: ['solid', 'none', 'solid', 'solid'], B: ['solid', 'solid', 'none', 'none'], C: ['none', 'solid', 'solid', 'none'] }],
        ['rtl', { A: ['solid', 'solid', 'solid', 'none'], B: ['solid', 'none', 'none', 'solid'], C: ['none', 'none', 'solid', 'solid'] }],
    ] as const)('applies "outer" border style around the table as rendered in %s, leaving a nested table alone', async (dir, frame) => {
        const h = await harness(`dir="${dir}"`);
        const table = await h.seed(
            '<table><tbody><tr><td rowspan="2">A</td><td>B<table><tbody><tr><td>x</td></tr><tr><td>y</td></tr></tbody></table></td></tr><tr><td>C</td></tr></tbody></table>',
        );
        h.target = table.rows[0]!.cells[0]!;

        h.commands.setBorders('outer');

        const [a, b] = Array.from(table.rows[0]!.cells);
        const c = table.rows[1]!.cells[0]!;
        expect({ A: sidesOf(a!), B: sidesOf(b!), C: sidesOf(c) }).toEqual(frame);
        for (const inner of b!.querySelectorAll('td')) expect(inner.getAttribute('style')).toBeNull();
    });

    it('applies "horizontal" border style', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        h.target = cellAt(table, 1, 0);
        h.commands.setBorders('outer');

        h.commands.setBorders('horizontal');

        const first = ['solid', 'none', 'solid', 'none'];
        const middle = ['none', 'none', 'solid', 'none'];
        const last = ['none', 'none', 'none', 'none'];
        expect(borderStyles(table)).toEqual([[first, first], [middle, middle], [last, last]]);
    });

    it('applies "all" border style, clearing overrides back to the table default', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const pristine = borderStyles(table);
        h.target = cellAt(table, 1, 0);
        h.commands.setBorders('outer');
        expect(borderStyles(table)).not.toEqual(pristine);

        h.commands.setBorders('all');

        expect(borderStyles(table)).toEqual(pristine);
        for (const cell of table.querySelectorAll<HTMLElement>('td, th')) {
            expect(cell.getAttribute('style') ?? '').not.toContain('border');
        }
    });
});

describe('table commands: formats across picked cells', () => {
    it('applies an inline format to the picked cells only', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const cells = cellsOf(table);
        h.picked = [cells[0]!, cells[1]!];

        h.editor.format('bold');

        expect(cells[0]!.querySelector('b, strong')).not.toBeNull();
        expect(cells[1]!.querySelector('b, strong')).not.toBeNull();
        expect(cells[2]!.querySelector('b, strong')).toBeNull();
        expect(cells[3]!.querySelector('b, strong')).toBeNull();
    });

    it('restores the original command when detached', async () => {
        const h = await harness();
        const table = await h.seed(SEED);
        const cells = cellsOf(table);
        h.commands.detach();
        h.picked = [cells[0]!, cells[1]!];
        placeCaret(cells[2]!.firstChild!, 0);

        selectBetween(cells[2]!.firstChild!, 0, cells[2]!.firstChild!, 2);
        h.editor.format('bold');

        expect(cells[0]!.querySelector('b, strong')).toBeNull();
        expect(cells[2]!.querySelector('b, strong')).not.toBeNull();
    });
});

describe('table commands: Backspace and Delete across a table edge', () => {
    it('does not pull a following paragraph into a table cell on delete', async () => {
        const h = await harness();
        await h.seed('<table><tbody><tr><td>Cell A</td><td>Cell B</td></tr></tbody></table><p>Trailing paragraph.</p>');
        const cellB = h.root.querySelectorAll('td')[1]!.firstChild!;
        const paragraph = h.root.querySelector('p')!.firstChild!;
        selectBetween(cellB, 2, paragraph, 8);

        const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
        h.root.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(h.root.querySelector('table + p')).not.toBeNull();
        expect(h.root.querySelectorAll('td')[1]!.textContent).toBe('Ce');
        expect(h.root.querySelector('table + p')!.textContent).toBe(' paragraph.');
    });

    it('leaves a delete inside one table to the browser', async () => {
        const h = await harness();
        await h.seed('<table><tbody><tr><td>Cell A</td><td>Cell B</td></tr></tbody></table>');
        const [a, b] = Array.from(h.root.querySelectorAll('td'));
        selectBetween(a!.firstChild!, 2, b!.firstChild!, 2);

        const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
        h.root.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });
});
