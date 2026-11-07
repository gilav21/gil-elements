/** One slot per rendered row and column, each holding the cell that covers it (`null` for a hole in a ragged table). */
export type CellGrid = (HTMLTableCellElement | null)[][];

/** A rectangle of grid slots, inclusive on every side. */
export interface GridBounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

/**
 * The table as the browser lays it out. A cell starts at the first column its row has free after the
 * rowspans reaching down from above, so the grid is as wide as the widest row including those
 * carried-over columns; a row's own colspan sum would undercount it.
 */
export function buildCellGrid(table: HTMLTableElement): CellGrid {
    const rows = Array.from(table.rows);
    const grid: CellGrid = rows.map(() => []);
    for (const [rowIndex, row] of rows.entries()) {
        let colIndex = 0;
        for (const cell of Array.from(row.cells)) {
            while (grid[rowIndex]?.[colIndex]) colIndex++;
            colIndex = placeCellInGrid(grid, cell, rowIndex, colIndex);
        }
    }
    const width = Math.max(0, ...grid.map((gridRow) => gridRow.length));
    for (const gridRow of grid) {
        for (let col = 0; col < width; col++) gridRow[col] ??= null;
    }
    return grid;
}

function placeCellInGrid(grid: CellGrid, cell: HTMLTableCellElement, rowIndex: number, colIndex: number): number {
    const colSpan = cell.colSpan || 1;
    // A rowspan past the last row is clamped, as the browser clamps it.
    const lastRow = Math.min(rowIndex + (cell.rowSpan || 1), grid.length);
    for (let row = rowIndex; row < lastRow; row++) {
        for (let dc = 0; dc < colSpan; dc++) {
            const gridRow = grid[row];
            if (gridRow) gridRow[colIndex + dc] = cell;
        }
    }
    return colIndex + colSpan;
}

/** The slots `cell` covers, from its first slot in the grid; a cell outside the grid reads as the origin. */
export function cellGridBounds(grid: CellGrid, cell: HTMLTableCellElement): GridBounds {
    for (const [row, gridRow] of grid.entries()) {
        const col = gridRow.indexOf(cell);
        if (col !== -1) {
            return { minRow: row, minCol: col, maxRow: row + (cell.rowSpan || 1) - 1, maxCol: col + (cell.colSpan || 1) - 1 };
        }
    }
    return { minRow: 0, minCol: 0, maxRow: 0, maxCol: 0 };
}

/** The smallest rectangle covering every cell in `cells`. */
export function selectionBounds(grid: CellGrid, cells: readonly HTMLTableCellElement[]): GridBounds {
    const all = cells.map((cell) => cellGridBounds(grid, cell));
    return {
        minRow: Math.min(...all.map((b) => b.minRow)),
        maxRow: Math.max(...all.map((b) => b.maxRow)),
        minCol: Math.min(...all.map((b) => b.minCol)),
        maxCol: Math.max(...all.map((b) => b.maxCol)),
    };
}

/** Grows `initial` until no merged cell is cut by its edge, so a selection never splits a span. */
export function expandSelectionBounds(grid: CellGrid, initial: GridBounds): GridBounds {
    const bounds = { ...initial };
    let expanded = true;
    while (expanded) {
        expanded = false;
        for (const cell of cellsInBounds(grid, bounds)) {
            const cellBounds = cellGridBounds(grid, cell);
            const { minRow, maxRow, minCol, maxCol } = bounds;
            bounds.minRow = Math.min(minRow, cellBounds.minRow);
            bounds.maxRow = Math.max(maxRow, cellBounds.maxRow);
            bounds.minCol = Math.min(minCol, cellBounds.minCol);
            bounds.maxCol = Math.max(maxCol, cellBounds.maxCol);
            expanded ||= bounds.minRow !== minRow || bounds.maxRow !== maxRow || bounds.minCol !== minCol || bounds.maxCol !== maxCol;
        }
    }
    return bounds;
}

/** The distinct cells within `bounds`, in grid order. */
export function cellsInBounds(grid: CellGrid, bounds: GridBounds): Set<HTMLTableCellElement> {
    const cells = new Set<HTMLTableCellElement>();
    for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
        for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
            const cell = grid[row]?.[col];
            if (cell) cells.add(cell);
        }
    }
    return cells;
}

/** The cells of the rectangle spanning `anchor` to `current`, grown to whole spans; empty when they share no table. */
export function cellRectangle(anchor: HTMLTableCellElement, current: HTMLTableCellElement): HTMLTableCellElement[] {
    const table = anchor.closest('table');
    if (!table) return [];
    const grid = buildCellGrid(table);
    const bounds = selectionBounds(grid, [anchor, current]);
    return [...cellsInBounds(grid, expandSelectionBounds(grid, bounds))];
}

/** The table cell holding the start of the selection, if any. */
export function caretCellOf(selection: Selection | null): HTMLTableCellElement | null {
    const node = selection?.rangeCount ? selection.getRangeAt(0).startContainer : null;
    const element = node instanceof Element ? node : node?.parentElement;
    return element?.closest<HTMLTableCellElement>('td, th') ?? null;
}

/** The cells of `table` itself, not those of a table nested in one of them. */
export function ownTableCells(table: HTMLTableElement): HTMLTableCellElement[] {
    return Array.from(table.rows).flatMap((row) => Array.from(row.cells));
}
