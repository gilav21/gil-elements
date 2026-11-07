import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController, RichTextFormatCommand } from './rich-text-host.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import { Disposables } from './rich-text-registry.js';
import {
    buildCellGrid,
    cellGridBounds,
    cellsInBounds,
    ownTableCells,
    selectionBounds,
    type CellGrid,
    type GridBounds,
} from './rich-text-table-grid.js';

export type TableBorderStyle = 'all' | 'none' | 'outer' | 'horizontal';
export type TableCellAlignment = 'left' | 'center' | 'right';

/**
 * The cell state the pointer half of the table editing (`rich-text-table-interaction.ts`) owns and
 * these commands act on; plugged in with `host.provide('tableSelection', ...)`.
 */
export interface TableSelection {
    /** The cells picked as a block (drag, Shift/Ctrl+click); empty when none. */
    selectedCells(): readonly HTMLTableCellElement[];
    /** Replaces the picked cells. */
    select(cells: readonly HTMLTableCellElement[]): void;
    clear(): void;
    /** The cell the menu opened on; every single-cell command acts on it. */
    target(): HTMLTableCellElement | null;
    setTarget(cell: HTMLTableCellElement | null): void;
}

const NO_CELLS: TableSelection = {
    selectedCells: () => [],
    select: () => undefined,
    clear: () => undefined,
    target: () => null,
    setTarget: () => undefined,
};

/** The table commands the context menu calls; supplied with `host.provide('tableCommands', ...)`. Each records one history entry. */
export interface TableCommands {
    /** Whether `splitCell` would do anything: the target spans more than one row or column. */
    canSplitCell(): boolean;
    /** Merges the picked cells into their top-left one; needs at least two. */
    mergeCells(): void;
    splitCell(): void;
    addRowAbove(): void;
    addRowBelow(): void;
    /** Left and right are visual: in RTL they insert after / before the column in document order. */
    addColumnLeft(): void;
    addColumnRight(): void;
    deleteRow(): void;
    deleteColumn(): void;
    deleteTable(): void;
    toggleHeaderRow(): void;
    setBorders(style: TableBorderStyle): void;
    setCellAlignment(align: TableCellAlignment): void;
    /** `'transparent'` clears the colour; acts on the picked cells, else the target. */
    setCellColor(color: string): void;
}

/** Inline marks the picked cells take as a block, one cell at a time. */
const CELL_FORMAT_COMMANDS: readonly RichTextFormatCommand[] = ['bold', 'italic', 'underline', 'strikethrough', 'code', 'clear'];

const BORDER_SIDES = ['border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight'] as const;

type Axis = 'row' | 'col';

/** Table structure commands, cell fan-out of inline formats, and Backspace/Delete across a table edge. */
export class TableCommandsController implements RichTextController, TableCommands {
    private readonly life = new Disposables();

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host, life } = this;
        life.add(host.provide('tableCommands', this));
        life.add(host.addKeyHandler(KEY_PRIORITY.tableDelete, (event) => this.deleteAcrossBoundary(event)));
        for (const command of CELL_FORMAT_COMMANDS) this.fanOutToSelectedCells(command);
    }

    detach(): void {
        this.life.dispose();
    }

    // Selection state

    private get cells(): TableSelection {
        return this.host.provider('tableSelection') ?? NO_CELLS;
    }

    private isLive(node: Node | null | undefined): node is Node {
        return !!node && this.host.contentRoot.contains(node);
    }

    /** The target cell with its row and table, or null when it is gone (undo, a replaced content). */
    private targetInfo(): { cell: HTMLTableCellElement; row: HTMLTableRowElement; table: HTMLTableElement } | null {
        const cell = this.cells.target();
        if (!cell || !this.isLive(cell)) return null;
        const row = cell.closest('tr');
        const table = cell.closest('table');
        return row && table ? { cell, row, table } : null;
    }

    private finish(): void {
        this.host.commit({ focus: true });
    }

    private createCell(row: HTMLTableRowElement, header = row.parentElement?.tagName === 'THEAD'): HTMLTableCellElement {
        const cell = this.host.doc.createElement(header ? 'th' : 'td');
        cell.innerHTML = '<br>';
        return cell;
    }

    // Merge and split

    canSplitCell(): boolean {
        const target = this.cells.target();
        return this.isLive(target) && (target.colSpan > 1 || target.rowSpan > 1);
    }

    mergeCells(): void {
        const selected = this.cells.selectedCells();
        const table = selected[0]?.closest('table');
        if (!table || selected.length < 2) return;

        const grid = buildCellGrid(table);
        const bounds = selectionBounds(grid, selected);
        const topLeft = grid[bounds.minRow]?.[bounds.minCol];
        if (!topLeft) return;

        const covered = cellsInBounds(grid, bounds);
        const parts = [...covered].filter((cell) => cell.textContent?.trim()).map((cell) => cell.innerHTML);
        topLeft.colSpan = bounds.maxCol - bounds.minCol + 1;
        topLeft.rowSpan = bounds.maxRow - bounds.minRow + 1;
        topLeft.innerHTML = parts.length > 0 ? parts.join(' ') : '<br>';
        for (const cell of covered) {
            if (cell !== topLeft) cell.remove();
        }
        this.cells.clear();
        this.finish();
    }

    /** Drops the target's spans and refills the rectangle it covered with empty cells; the cell keeps the top-left slot. */
    splitCell(): void {
        const target = this.cells.target();
        const table = target?.closest('table');
        if (!target || !table || !this.isLive(target) || !this.canSplitCell()) return;

        const grid = buildCellGrid(table);
        const bounds = cellGridBounds(grid, target);
        target.removeAttribute('colspan');
        target.removeAttribute('rowspan');

        const rows = Array.from(table.rows);
        for (let ri = bounds.minRow; ri <= bounds.maxRow; ri++) {
            const row = rows[ri];
            if (!row) continue;
            for (let ci = bounds.minCol; ci <= bounds.maxCol; ci++) {
                if (ri === bounds.minRow && ci === bounds.minCol) continue;
                const reference = this.firstCellOfRowFrom(grid, row, ri, ci + 1, target);
                const cell = this.createCell(row);
                if (reference) reference.before(cell);
                else row.append(cell);
            }
        }
        this.cells.clear();
        this.finish();
    }

    private firstCellOfRowFrom(
        grid: CellGrid,
        row: HTMLTableRowElement,
        rowIndex: number,
        fromCol: number,
        exclude: HTMLTableCellElement,
    ): HTMLTableCellElement | null {
        const candidates = grid[rowIndex]?.slice(fromCol) ?? [];
        return candidates.find((cell) => cell && cell !== exclude && cell.parentElement === row) ?? null;
    }

    // Insert

    addRowAbove(): void {
        this.insertRow((bounds) => bounds.minRow);
    }

    addRowBelow(): void {
        this.insertRow((bounds) => bounds.maxRow + 1);
    }

    addColumnLeft(): void {
        this.insertColumn(this.host.isRtl ? 'after' : 'before');
    }

    addColumnRight(): void {
        this.insertColumn(this.host.isRtl ? 'before' : 'after');
    }

    private insertRow(position: (bounds: GridBounds) => number): void {
        const info = this.targetInfo();
        if (!info) return;
        const { table } = info;
        const grid = buildCellGrid(table);
        const at = position(cellGridBounds(grid, info.cell));
        const rows = Array.from(table.rows);
        const header = at === 0 && table.tHead !== null;
        const newRow = this.host.doc.createElement('tr');

        const processed = new Set<HTMLTableCellElement>();
        for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
            if (this.stretchSpan(grid, 'row', at, col, processed)) continue;
            if (this.alreadyStretched(grid, 'row', at, col, processed)) continue;
            newRow.append(this.createCell(newRow, header));
        }

        const reference = rows[at];
        if (reference) reference.before(newRow);
        else (table.tBodies.item(0) ?? table).append(newRow);
        this.finish();
    }

    private insertColumn(position: 'before' | 'after'): void {
        const info = this.targetInfo();
        if (!info) return;
        const grid = buildCellGrid(info.table);
        const bounds = cellGridBounds(grid, info.cell);
        const at = position === 'before' ? bounds.minCol : bounds.maxCol + 1;
        const numCols = grid[0]?.length ?? 0;
        const rows = Array.from(info.table.rows);

        const processed = new Set<HTMLTableCellElement>();
        for (let ri = 0; ri < grid.length; ri++) {
            if (this.stretchSpan(grid, 'col', at, ri, processed)) continue;
            if (this.alreadyStretched(grid, 'col', at, ri, processed)) continue;
            const row = rows[ri];
            if (!row) continue;
            const reference = this.firstCellStartingFrom(grid, row, ri, at, numCols);
            const cell = this.createCell(row);
            if (reference) reference.before(cell);
            else row.append(cell);
        }
        this.finish();
    }

    /** The slot on `axis` at `pos`, with `line` the index along the other axis. */
    private slot(grid: CellGrid, axis: Axis, pos: number, line: number): HTMLTableCellElement | null {
        return (axis === 'row' ? grid[pos]?.[line] : grid[line]?.[pos]) ?? null;
    }

    /** Grows a cell that straddles the insertion point by one instead of splitting it. */
    private stretchSpan(grid: CellGrid, axis: Axis, at: number, line: number, processed: Set<HTMLTableCellElement>): boolean {
        if (at <= 0) return false;
        const count = axis === 'row' ? grid.length : (grid[0]?.length ?? 0);
        const before = this.slot(grid, axis, at - 1, line);
        if (!before || processed.has(before)) return false;

        const bounds = cellGridBounds(grid, before);
        const straddles =
            at < count
                ? before === this.slot(grid, axis, at, line)
                : this.reachesEnd(bounds, axis, count);
        if (!straddles) return false;

        processed.add(before);
        if (axis === 'row') before.rowSpan = (before.rowSpan || 1) + 1;
        else before.colSpan = (before.colSpan || 1) + 1;
        return true;
    }

    private reachesEnd(bounds: GridBounds, axis: Axis, count: number): boolean {
        const [min, max] = axis === 'row' ? [bounds.minRow, bounds.maxRow] : [bounds.minCol, bounds.maxCol];
        return max >= count - 1 && min < count - 1;
    }

    private alreadyStretched(grid: CellGrid, axis: Axis, at: number, line: number, processed: Set<HTMLTableCellElement>): boolean {
        const reference = this.slot(grid, axis, Math.max(at - 1, 0), line);
        return !!reference && processed.has(reference);
    }

    private firstCellStartingFrom(grid: CellGrid, row: HTMLTableRowElement, rowIndex: number, fromCol: number, numCols: number): HTMLTableCellElement | null {
        for (let col = fromCol; col < numCols; col++) {
            const candidate = grid[rowIndex]?.[col];
            if (candidate?.parentElement === row && cellGridBounds(grid, candidate).minCol >= fromCol) return candidate;
        }
        return null;
    }

    // Delete

    deleteRow(): void {
        const info = this.targetInfo();
        if (!info) return;
        const rows = Array.from(info.table.rows);
        if (rows.length <= 1) info.table.remove();
        else this.removeRow(info.table, info.cell, rows);
        this.cells.setTarget(null);
        this.finish();
    }

    /** Spans reaching into the row shrink; one that starts in it moves to the next row so the grid stays rectangular. */
    private removeRow(table: HTMLTableElement, cell: HTMLTableCellElement, rows: HTMLTableRowElement[]): void {
        const grid = buildCellGrid(table);
        const rowToDelete = cellGridBounds(grid, cell).minRow;
        const numCols = grid[0]?.length ?? 0;
        const processed = new Set<HTMLTableCellElement>();

        for (let col = 0; col < numCols; col++) {
            const current = grid[rowToDelete]?.[col];
            if (!current || processed.has(current)) continue;
            processed.add(current);
            const bounds = cellGridBounds(grid, current);
            if (bounds.minRow === rowToDelete && bounds.maxRow === rowToDelete) continue;
            current.rowSpan = Math.max(1, (current.rowSpan || 1) - 1);
            const nextRow = rows[rowToDelete + 1];
            if (bounds.minRow !== rowToDelete || !nextRow) continue;
            const neighbor = this.rowStartAfter(grid, rowToDelete + 1, col + (current.colSpan || 1), current, nextRow);
            if (neighbor) neighbor.before(current);
            else nextRow.append(current);
        }
        rows[rowToDelete]?.remove();
    }

    private rowStartAfter(grid: CellGrid, rowIndex: number, fromCol: number, moved: HTMLTableCellElement, row: HTMLTableRowElement): HTMLTableCellElement | null {
        const candidates = grid[rowIndex]?.slice(fromCol) ?? [];
        return (
            candidates.find(
                (cell) => cell && cell !== moved && cell.parentElement === row && cellGridBounds(grid, cell).minRow === rowIndex,
            ) ?? null
        );
    }

    deleteColumn(): void {
        const info = this.targetInfo();
        if (!info) return;
        const grid = buildCellGrid(info.table);
        if ((grid[0]?.length ?? 0) <= 1) {
            info.table.remove();
        } else {
            const colToDelete = cellGridBounds(grid, info.cell).minCol;
            const processed = new Set<HTMLTableCellElement>();
            for (const gridRow of grid) {
                const cell = gridRow[colToDelete];
                if (!cell || processed.has(cell)) continue;
                processed.add(cell);
                const bounds = cellGridBounds(grid, cell);
                if (bounds.minCol < colToDelete || bounds.maxCol > colToDelete) cell.colSpan = Math.max(1, (cell.colSpan || 1) - 1);
                else cell.remove();
            }
        }
        this.cells.setTarget(null);
        this.finish();
    }

    deleteTable(): void {
        const info = this.targetInfo();
        if (!info) return;
        info.table.remove();
        this.cells.setTarget(null);
        this.finish();
    }

    // Header row

    /**
     * Turns the table's first row into a `<thead>` of `<th>`, or back into the first body row. Cells are
     * replaced rather than retagged, so the target and picked cells are re-pointed at their replacements.
     */
    toggleHeaderRow(): void {
        const info = this.targetInfo();
        const firstRow = info?.table.rows.item(0);
        if (!info || !firstRow) return;
        const { table } = info;
        const thead = table.tHead;
        if (thead) {
            const tbody = table.tBodies.item(0) ?? table.appendChild(this.host.doc.createElement('tbody'));
            this.retagRowCells(firstRow, 'td');
            tbody.insertBefore(firstRow, tbody.firstChild);
            if (thead.children.length === 0) thead.remove();
        } else {
            const newHead = this.host.doc.createElement('thead');
            this.retagRowCells(firstRow, 'th');
            newHead.append(firstRow);
            table.insertBefore(newHead, table.firstChild);
        }
        this.finish();
    }

    private retagRowCells(row: HTMLTableRowElement, tagName: 'td' | 'th'): void {
        const picked = [...this.cells.selectedCells()];
        const target = this.cells.target();
        let pickedChanged = false;
        for (const cell of Array.from(row.cells)) {
            const replacement = this.host.doc.createElement(tagName);
            replacement.innerHTML = cell.innerHTML;
            const index = picked.indexOf(cell);
            if (index !== -1) {
                picked[index] = replacement;
                pickedChanged = true;
            }
            cell.replaceWith(replacement);
            if (cell === target) this.cells.setTarget(replacement);
        }
        if (pickedChanged) this.cells.select(picked);
    }

    // Borders, alignment, colour

    /**
     * Borders are inline styles so they survive in the exported HTML, in the first cell's computed colour.
     * With cells picked, `all` and `none` act on just those; `outer` and `horizontal` are table-wide.
     */
    setBorders(style: TableBorderStyle): void {
        const info = this.targetInfo();
        if (!info) return;
        const { table } = info;
        const picked = this.cells.selectedCells().filter((cell) => cell.closest('table') === table);
        const scoped = picked.length > 0 && (style === 'all' || style === 'none');
        const cells = scoped ? picked : ownTableCells(table);
        const first = cells[0];
        const border = `1px solid ${first ? getComputedStyle(first).borderTopColor : 'currentColor'}`;

        if (!scoped) table.style.border = '';
        for (const cell of cells) {
            for (const side of BORDER_SIDES) cell.style[side] = '';
        }

        if (style === 'none') {
            for (const cell of cells) cell.style.border = 'none';
        } else if (style === 'outer') {
            this.frameTable(table, border);
        } else if (style === 'horizontal') {
            this.ruleRows(table, border);
        }
        this.finish();
    }

    /** A border on each side of a cell that lies on the table's edge as rendered; the first column is on the right in RTL. */
    private frameTable(table: HTMLTableElement, border: string): void {
        const grid = buildCellGrid(table);
        const lastRow = grid.length - 1;
        const lastCol = (grid[0]?.length ?? 0) - 1;
        const [startSide, endSide] = this.host.isRtl ? (['borderRight', 'borderLeft'] as const) : (['borderLeft', 'borderRight'] as const);
        const edge = (onEdge: boolean): string => (onEdge ? border : 'none');
        for (const cell of ownTableCells(table)) {
            const bounds = cellGridBounds(grid, cell);
            cell.style.borderTop = edge(bounds.minRow === 0);
            cell.style.borderBottom = edge(bounds.maxRow === lastRow);
            cell.style[startSide] = edge(bounds.minCol === 0);
            cell.style[endSide] = edge(bounds.maxCol === lastCol);
        }
    }

    /** Rules over the top and between rows; a cell reaching the last row gets none below. */
    private ruleRows(table: HTMLTableElement, border: string): void {
        const grid = buildCellGrid(table);
        const lastRow = grid.length - 1;
        for (const cell of ownTableCells(table)) {
            const bounds = cellGridBounds(grid, cell);
            cell.style.borderLeft = 'none';
            cell.style.borderRight = 'none';
            cell.style.borderTop = bounds.minRow === 0 ? border : 'none';
            cell.style.borderBottom = bounds.maxRow < lastRow ? border : 'none';
        }
    }

    /** `left` and `right` are physical and do not mirror in RTL. */
    setCellAlignment(align: TableCellAlignment): void {
        const target = this.cells.target();
        if (!target || !this.isLive(target)) return;
        target.style.textAlign = align;
        this.host.commit();
    }

    setCellColor(color: string): void {
        const picked = this.cells.selectedCells();
        const target = this.cells.target();
        const cells = (picked.length > 0 ? [...picked] : [target]).filter((cell): cell is HTMLTableCellElement => this.isLive(cell));
        if (cells.length === 0) return;
        for (const cell of cells) cell.style.backgroundColor = color === 'transparent' ? '' : color;
        this.host.commit();
    }

    // Inline formats across picked cells

    /**
     * A block of picked cells leaves the text selection collapsed, so a format would do nothing: select each
     * cell's contents in turn and run the original command on it. After detach a wrapper another controller
     * put on top stays in the table but only passes through.
     */
    private fanOutToSelectedCells(command: RichTextFormatCommand): void {
        const { commandTable } = this.host;
        const original = commandTable.get(command);
        if (!original) return;
        let attached = true;
        const fanned = (): void => {
            const picked = attached ? this.cells.selectedCells() : [];
            const selection = this.host.getSelection();
            if (picked.length === 0 || !selection) {
                original();
                return;
            }
            for (const cell of picked) {
                const range = this.host.doc.createRange();
                range.selectNodeContents(cell);
                selection.removeAllRanges();
                selection.addRange(range);
                original();
            }
            selection.collapseToStart();
        };
        commandTable.set(command, fanned);
        this.life.add(() => {
            attached = false;
            if (commandTable.get(command) === fanned) commandTable.set(command, original);
        });
    }

    // Backspace / Delete across a table edge

    /**
     * A range from inside a table to outside it would be deleted by the browser as one run, tearing the
     * structure apart. Each side is cleared in place instead, leaving the caret where the user was working.
     */
    private deleteAcrossBoundary(event: KeyboardEvent): boolean {
        if (event.key !== 'Delete' && event.key !== 'Backspace') return false;
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
        const range = selection.getRangeAt(0);
        if (this.tableOf(range.startContainer) === this.tableOf(range.endContainer)) return false;

        event.preventDefault();
        this.deleteWithinEachBlock(range, selection);
        this.finish();
        return true;
    }

    private tableOf(node: Node): HTMLTableElement | null {
        if (!this.host.contentRoot.contains(node)) return null;
        const element = node instanceof Element ? node : node.parentElement;
        return element?.closest('table') ?? null;
    }

    private deleteWithinEachBlock(range: Range, selection: Selection): void {
        const walker = this.host.doc.createTreeWalker(this.host.contentRoot, NodeFilter.SHOW_TEXT);
        const touched: Text[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (range.intersectsNode(node)) touched.push(node as Text);
        }
        for (const text of touched) {
            const from = text === range.startContainer ? range.startOffset : 0;
            const to = text === range.endContainer ? range.endOffset : text.data.length;
            text.deleteData(from, Math.max(0, to - from));
        }
        const caret = this.host.doc.createRange();
        caret.setStart(range.startContainer, range.startOffset);
        caret.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caret);
    }
}
