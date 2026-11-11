/**
 * Wave 4, the three packages together (rows: selection, expansion, tree, groups, detail; window and focus: virtual scroll,
 * keyboard; columns: resize, order, pins, a11y). Each case here needs at least two of them in one table, so no package's own
 * file can hold it. Real input through the kit; the mouse is parked after every test.
 */
import axe from 'axe-core';
import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';
import { bodyRows, cellAt, headCell, makeColumns, makeRows, mountTable, q, qa, roving, type SampleRow, settle } from './data-table-fixtures.js';
import { frames, mouseDrag, parkMouse, press, scrollGrid, withRtl, withTheme } from './data-table-input-fixtures.js';

afterEach(async () => {
    await parkMouse();
    withTheme('light');
});

type Table = GeDataTable<SampleRow>;

const viewportOf = (table: Element): HTMLElement => q(table, '[data-slot="data-table-viewport"]');
const gridOf = (table: Element): HTMLElement => q(table, '[data-slot="table"]');
const rowOf = (table: Element, id: string): HTMLElement => q(table, `[data-slot="table-row"][data-row-id="${id}"]`);
const checkboxOf = (table: Element, id: string) => q(rowOf(table, id), 'ge-checkbox') as HTMLElement & { checked: boolean; indeterminate: boolean };
/** The cells that are tab stops: the roving model keeps this at one (the header's resize separators are tab stops of their own). */
const cellStops = (table: Element): HTMLElement[] => roving(table).filter((el) => el.matches('[data-slot="table-cell"]'));
/** Waits until the scroller has stopped moving: a scroll, the window it causes and the heights it measures. */
async function rest(table: Table): Promise<void> {
    await settle(table);
    await frames(4);
}
async function scrollTo(table: Table, top: number): Promise<void> {
    await scrollGrid(table, { top });
    await rest(table);
}

// ---- 1. virtual + tree + selection cascade -------------------------------------------------------------------------

describe('virtual scroll, a tree and the selection cascade', () => {
    const ROW = 40;
    const mountTree = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>(
            {
                columns: [{ accessorKey: 'name', header: 'Name', width: '220px' }, { accessorKey: 'age', header: 'Age', width: '100px' }],
                data: makeRows(2000, { children: 3 }),
                enableSubRows: true,
                enableRowSelection: true,
                subRowSelectionMode: 'descendants',
                enableVirtualScroll: true,
                virtualRowHeight: ROW,
                showPagination: false,
                showToolbar: false,
                ...extra,
            },
            {},
            { width: 480, height: 400 },
        );

    /** Every drawn row's aria-rowindex is its place in the whole list (header row first), whatever the window holds. */
    const expectIndexesConsistent = (table: Table, visible: number): void => {
        const rows = qa(table, '[data-slot="table-body"] > [data-slot="table-row"][data-kind="data"]:not([data-retained])');
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThan(60);
        for (const row of rows) expect(Number(row.getAttribute('aria-rowindex'))).toBe(Number(row.dataset['rowIndex']) + 2);
        expect(gridOf(table).getAttribute('aria-rowcount')).toBe(String(visible + 1));
    };

    it('keeps checkbox states, ancestors, counts and indexes right across a scroll away and back', async () => {
        const table = await mountTree();
        expect(table.getAttribute('data-virtual')).toBe('fixed');
        expectIndexesConsistent(table, 2000);
        expect(bodyRows(table).length).toBeLessThan(40);

        // deep down: open a node, then select one child of it
        await scrollTo(table, ROW * 1500);
        const toggle = q(rowOf(table, 'r1500'), '[data-action="tree"]');
        await userEvent.click(toggle);
        await rest(table);
        expect(table.subRowExpandedRows).toEqual({ r1500: true });
        expect(gridOf(table).getAttribute('aria-rowcount')).toBe(String(2003 + 1));
        expect(rowOf(table, 'r1500-c1').getAttribute('aria-level')).toBe('2');
        expectIndexesConsistent(table, 2003);

        await userEvent.click(checkboxOf(table, 'r1500-c1'));
        await rest(table);
        expect(Object.keys(table.rowSelection)).toEqual(['r1500-c1']);
        expect(checkboxOf(table, 'r1500').indeterminate).toBe(true);
        expect(checkboxOf(table, 'r1500').checked).toBe(false);

        // the parent: its whole subtree follows, the ancestor is checked once every child is
        await userEvent.click(checkboxOf(table, 'r1500'));
        await rest(table);
        expect(Object.keys(table.rowSelection).sort()).toEqual(['r1500', 'r1500-c0', 'r1500-c1', 'r1500-c2']);
        expect(checkboxOf(table, 'r1500').checked).toBe(true);
        expect(checkboxOf(table, 'r1500').indeterminate).toBe(false);
        expect(table.selectedRows.map((r) => r.id).sort()).toEqual(['r1500', 'r1500-c0', 'r1500-c1', 'r1500-c2']);

        // away (rows leave the DOM), and back: the states are read from the record, not from what was drawn
        await scrollTo(table, 0);
        expect(q(table, '[data-slot="table-row"][data-row-id="r1500-c1"]')).toBeNull();
        expect(rowOf(table, 'r1500').hasAttribute('data-retained')).toBe(true); // the clicked row holds the focus, so it stays drawn
        await scrollTo(table, ROW * 1500);
        for (const id of ['r1500', 'r1500-c0', 'r1500-c1', 'r1500-c2']) expect(checkboxOf(table, id).checked).toBe(true);
        expect(rowOf(table, 'r1500').getAttribute('aria-selected')).toBe('true');
        expectIndexesConsistent(table, 2003);

        // one child off: the parent leaves "checked" for "mixed", the other children stay
        await userEvent.click(checkboxOf(table, 'r1500-c2'));
        await rest(table);
        expect(checkboxOf(table, 'r1500').checked).toBe(false);
        expect(checkboxOf(table, 'r1500').indeterminate).toBe(true);
        expect(Object.keys(table.rowSelection).sort()).toEqual(['r1500-c0', 'r1500-c1']);
        expect(table.selectedRows.map((r) => r.id).sort()).toEqual(['r1500-c0', 'r1500-c1']);
    });

    it('closing the node takes its children out of the list and out of the count, the selection stays', async () => {
        const table = await mountTree({ subRowExpandedRows: { r10: true }, rowSelection: { 'r10-c0': true } });
        expect(gridOf(table).getAttribute('aria-rowcount')).toBe(String(2003 + 1));
        expect(checkboxOf(table, 'r10').indeterminate).toBe(true);
        await userEvent.click(q(rowOf(table, 'r10'), '[data-action="tree"]'));
        await rest(table);
        expect(gridOf(table).getAttribute('aria-rowcount')).toBe(String(2000 + 1));
        expect(table.rowSelection).toEqual({ 'r10-c0': true });
        expect(table.selectedRows.map((r) => r.id)).toEqual(['r10-c0']);
        expect(checkboxOf(table, 'r10').indeterminate).toBe(true);
    });
});

// ---- 2. variable heights + detail rows + resize --------------------------------------------------------------------

describe('virtual variable heights, detail rows and a column resize', () => {
    const detail = (): HTMLElement => Object.assign(document.createElement('div'), { style: 'height:120px' });
    const mountVariable = (): Promise<Table> =>
        mountTable<SampleRow>(
            {
                columns: [{ accessorKey: 'name', header: 'Name', width: '200px' }, { accessorKey: 'age', header: 'Age', width: '120px' }],
                data: makeRows(3000),
                enableVirtualScroll: true,
                virtualRowHeight: 0,
                virtualVariableRowHeight: true,
                enableRowExpansion: true,
                enableColumnResize: true,
                renderDetail: detail,
                showPagination: false,
                showToolbar: false,
            },
            {},
            { width: 600, height: 400 },
        );
    /** The first data row whose top is at or under the sticky header: the anchor the eye is on. */
    const firstVisible = (table: Element): HTMLElement => {
        const head = q(table, '[data-slot="table-header"]').getBoundingClientRect();
        return bodyRows(table).find((r) => r.getBoundingClientRect().top >= head.bottom - 1)!;
    };

    it('collapsing details, resizing and refreshing keep the scroll height, the position and the focused row', async () => {
        const table = await mountVariable();
        const view = viewportOf(table);
        const closed = view.scrollHeight;
        table.expandedRows = { r2: true, r5: true, r8: true, r11: true };
        await rest(table);
        const opened = view.scrollHeight - closed;
        expect(opened).toBeGreaterThan(4 * 120);
        expect(view.scrollHeight - closed).toBeLessThan(4 * 160);

        // the focused row is far from where the scroll goes: it stays drawn, out of flow, and is still the one tab stop
        table.focusCell(2, 'name');
        await rest(table);
        await scrollTo(table, 30000);
        const retained = rowOf(table, 'r2');
        expect(retained.hasAttribute('data-retained')).toBe(true);
        expect(cellStops(table)).toEqual([cellAt(table, 2, 'name')]);

        // collapse everything while away: the heights of rows that are not drawn go too
        const open = view.scrollHeight;
        table.expandedRows = {};
        await rest(table);
        // exactly the four measured detail rows (120px of content and their own padding) left the total, none stayed behind
        const gone = (open - view.scrollHeight) / 4;
        expect(gone).toBeGreaterThan(120);
        expect(gone).toBeLessThan(160);
        expect(Math.abs(open - view.scrollHeight - opened)).toBeLessThan(2);
        expect(rowOf(table, 'r2').hasAttribute('data-retained')).toBe(true);
        expect(view.scrollTop).toBeLessThanOrEqual(view.scrollHeight - view.clientHeight);

        // a resize and a refresh change no vertical geometry and move nothing on screen
        const anchor = firstVisible(table);
        const [id, top, height, scrollTop] = [anchor.dataset['rowId'], anchor.getBoundingClientRect().top, view.scrollHeight, view.scrollTop];
        const handle = q(headCell(table, 'name'), '[data-slot="data-table-resize-handle"]');
        const at = handle.getBoundingClientRect();
        await mouseDrag({ x: at.left + at.width / 2, y: at.top + at.height / 2 }, { dx: 60, dy: 0 });
        await rest(table);
        expect(Math.round(headCell(table, 'name').getBoundingClientRect().width)).toBe(260);
        table.refresh();
        await rest(table);
        const same = firstVisible(table);
        expect(same.dataset['rowId']).toBe(id);
        expect(Math.abs(same.getBoundingClientRect().top - top)).toBeLessThan(1.5);
        expect(Math.abs(view.scrollHeight - height)).toBeLessThan(1.5);
        expect(Math.abs(view.scrollTop - scrollTop)).toBeLessThan(1.5);
        expect(cellStops(table)).toEqual([cellAt(table, 2, 'name')]);
    });

    it('opens details on drawn rows while scrolled, with no jump of the rows around it', async () => {
        const table = await mountVariable();
        await scrollTo(table, 6000);
        const view = viewportOf(table);
        const anchor = firstVisible(table);
        const [id, top] = [anchor.dataset['rowId']!, anchor.getBoundingClientRect().top];
        const below = bodyRows(table).find((r) => r.getBoundingClientRect().top > top + 100)!;
        await userEvent.click(q(below, '[data-action="detail"]'));
        await rest(table);
        expect(qa(table, '[data-kind="detail"]')).toHaveLength(1);
        // opened below the eye: what the eye is on has not moved
        expect(firstVisible(table).dataset['rowId']).toBe(id);
        expect(Math.abs(firstVisible(table).getBoundingClientRect().top - top)).toBeLessThan(1.5);
        expect(view.scrollTop).toBeGreaterThan(5000);
    });
});

// ---- 3. grouped rows + local paging + keyboard + collapse ----------------------------------------------------------

describe('grouped rows, local paging, the keyboard and collapsing', () => {
    const mountGrouped = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(12, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false, ...extra }, {}, { width: 600, height: 520 });

    it('ArrowDown crosses a group header and Ctrl+End is the last drawn row while the last group is collapsed', async () => {
        const table = await mountGrouped();
        expect(bodyRows(table)).toHaveLength(12);
        table.focusCell(3, 'c0'); // the last row of the first group: a header comes next in the DOM
        await settle(table);
        await press('{ArrowDown}');
        expect(table.focusedCell).toEqual({ rowIndex: 4, columnKey: 'c0' });
        expect(document.activeElement).toBe(cellAt(table, 4, 'c0'));
        expect(cellAt(table, 4, 'c0')!.closest('[data-slot="table-row"]')!.previousElementSibling!.getAttribute('data-kind')).toBe('group');
        await press('{ArrowUp}');
        expect(table.focusedCell!.rowIndex).toBe(3);

        table.provider('expansion')!.toggleGroup('g2');
        await settle(table);
        expect(bodyRows(table)).toHaveLength(8);
        await press('{Control>}{End}{/Control}');
        expect(table.focusedCell).toEqual({ rowIndex: 7, columnKey: 'c2' }); // the last cell: last drawn row, last column
        expect(document.activeElement).toBe(cellAt(table, 7, 'c2'));
    });

    it('pages count display rows, headers included as the Angular table does, with consecutive indexes on every page', async () => {
        const table = await mountGrouped({ paginationState: { pageIndex: 0, pageSize: 5 } });
        const pager = q(table, 'ge-data-table-pager') as HTMLElement & { total: number };
        expect(pager.total).toBe(15); // 12 rows and 3 group headers
        const seen: string[] = [];
        for (let page = 0; page < 3; page++) {
            table.paginationState = { pageIndex: page, pageSize: 5 };
            await settle(table);
            const rows = qa(table, '[data-slot="table-body"] > [data-slot="table-row"]:not([data-kind="spacer"])');
            expect(rows).toHaveLength(5);
            // data-row-index counts data rows only; aria-rowindex counts every real row, headers included, from the header row on
            expect(rows.map((r) => Number(r.getAttribute('aria-rowindex')))).toEqual([2, 3, 4, 5, 6]);
            expect(bodyRows(table).map((r) => Number(r.dataset['rowIndex']))).toEqual(bodyRows(table).map((_, i) => i));
            seen.push(...rows.map((r) => (r.dataset['kind'] === 'group' ? `[${r.dataset['groupKey']}]` : r.dataset['rowId']!)));
        }
        expect(seen.filter((x) => x.startsWith('['))).toEqual(['[g0]', '[g1]', '[g2]']);
        expect(seen.filter((x) => !x.startsWith('['))).toHaveLength(12);
    });

    it('collapsing the group of the focused row hands the focus to the toggle of that group, and no cell is a tab stop', async () => {
        const table = await mountGrouped();
        table.focusCell(1, 'c0'); // the second row of the first group
        await settle(table);
        expect(document.activeElement).toBe(cellAt(table, 1, 'c0'));
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        await frames(2);
        expect(bodyRows(table)).toHaveLength(8);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).toBe(q(table, '[data-group-key="g0"] [data-toggle]'));
        expect(cellStops(table)).toEqual([]);
        expect(viewportOf(table).getAttribute('tabindex')).toBe('0');
    });
});

describe('a tree: focus follows its row, and goes to the ancestor of a closed node', () => {
    const mountTreeKeys = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false, showPagination: false, ...extra }, {}, { width: 600, height: 500 });

    it('closing the node of the focused child moves the focus to the node, in the same column', async () => {
        const table = await mountTreeKeys();
        table.focusCell(2, 'c1'); // r0 (0), r0-c0 (1), r0-c1 (2)
        await settle(table);
        table.provider('expansion')!.collapseSubRow(table.data[0]!);
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c1' });
        expect(document.activeElement).toBe(cellAt(table, 0, 'c1'));
        expect(cellAt(table, 0, 'c1')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('r0');
        expect(cellStops(table)).toEqual([cellAt(table, 0, 'c1')]);
    });

    it('opening a node above the focused row moves the roving cell along with its row, not with its position', async () => {
        const table = await mountTreeKeys({ subRowDefaultExpanded: false });
        table.focusCell(1, 'c0'); // r1, the second root
        await settle(table);
        expect(cellAt(table, 1, 'c0')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('r1');
        table.provider('expansion')!.expandSubRow(table.data[0]!); // r0 opens: two rows slide in above r1
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'c0' });
        expect(cellAt(table, 3, 'c0')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('r1');
        expect(document.activeElement).toBe(cellAt(table, 3, 'c0'));
    });

    it('ArrowLeft on a node closes it and ArrowRight opens it again, the focus staying on the node', async () => {
        const table = await mountTreeKeys();
        table.focusCell(0, 'c0');
        await settle(table);
        await press('{ArrowLeft}');
        await settle(table);
        expect(bodyRows(table).map((r) => r.dataset['rowId'])).toEqual(['r0', 'r1', 'r1-c0', 'r1-c1', 'r2', 'r2-c0', 'r2-c1', 'r3', 'r3-c0', 'r3-c1']);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c0' });
        await press('{ArrowRight}');
        await settle(table);
        expect(bodyRows(table)).toHaveLength(12);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c0' });
    });
});

describe('focus follows its row: the edges', () => {
    const mountGrouped = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(12, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false, ...extra }, {}, { width: 600, height: 520 });
    const mountTreeEdges = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false, showPagination: false, ...extra }, {}, { width: 600, height: 500 });

    it('a column hidden in the same update as the toggle is left for its neighbour, as in any other update', async () => {
        const table = await mountTreeEdges();
        table.focusCell(2, 'c1');
        await settle(table);
        table.provider('expansion')!.collapseSubRow(table.data[0]!);
        table.columnVisibility = { c1: false };
        await settle(table);
        await frames(2);
        expect(table.focusedCell!.rowIndex).toBe(0);
        expect(['c0', 'c2']).toContain(table.focusedCell!.columnKey);
        expect(cellAt(table, 0, table.focusedCell!.columnKey)).toBe(document.activeElement);
    });

    it('an empty list after the toggle (a page loading) keeps the focus waiting, and it is there when the rows come back', async () => {
        const table = await mountTreeEdges();
        const rows = table.data;
        table.focusCell(2, 'c0');
        await settle(table);
        table.provider('expansion')!.collapseSubRow(rows[0]!);
        table.data = [];
        await settle(table);
        expect(table.focusedCell).not.toBeNull();
        table.data = rows;
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c0' }); // the child is closed away: its node holds the focus
        expect(document.activeElement).toBe(cellAt(table, 0, 'c0'));
    });

    it('a toggle while nothing is focused is not applied to the row focused after it', async () => {
        const table = await mountTreeEdges();
        table.provider('expansion')!.collapseSubRow(table.data[0]!);
        await settle(table);
        table.focusCell(4, 'c1');
        await settle(table);
        table.requestUpdate();
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 4, columnKey: 'c1' });
    });

    it('a grouped, virtual table has no groups: a retained focused row keeps the focus when a "group" is toggled', async () => {
        const table = await mountTable<SampleRow>(
            { columns: makeColumns(3), data: makeRows(300, { columns: 3, groups: 3 }), groupBy: 'group', enableVirtualScroll: true, virtualRowHeight: 40, showPagination: false, showToolbar: false },
            {},
            { width: 600, height: 400 },
        );
        expect(qa(table, '[data-kind="group"]')).toHaveLength(0);
        table.focusCell(5, 'c0');
        await settle(table);
        await scrollTo(table, 5000);
        expect(rowOf(table, 'r5').hasAttribute('data-retained')).toBe(true);
        table.provider('expansion')!.toggleGroup('g0');
        await rest(table);
        expect(table.focusedCell).toEqual({ rowIndex: 5, columnKey: 'c0' });
        expect(rowOf(table, 'r5').hasAttribute('data-retained')).toBe(true);
        expect(cellStops(table)).toEqual([cellAt(table, 5, 'c0')]);
    });

    it('the group toggle that takes the focus is the one of this table, not that of a table nested in a detail row', async () => {
        const inner = document.createElement('ge-data-table') as Table;
        Object.assign(inner, { columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 2 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false });
        const table = await mountTable<SampleRow>(
            { columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 2 }), groupBy: 'group', enableRowExpansion: true, expandedRows: { r0: true }, renderDetail: () => inner, paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false },
            {},
            { width: 600, height: 700 },
        );
        await settle(inner);
        // the outer rows are r0 r2 r4 (g0), then r1 r3 r5 (g1); the inner table sits in r0's detail row, above the outer g1 header
        expect(qa(table, '[data-group-key="g1"] [data-toggle]')).toHaveLength(2);
        table.focusCell(3, 'c0');
        await settle(table);
        expect(document.activeElement).toBe(table.cellAt(3, 'c0')); // the table's own cell: the nested table has an r1 of its own
        table.provider('expansion')!.toggleGroup('g1');
        await settle(table);
        await frames(2);
        const toggle = document.activeElement as HTMLElement;
        expect(toggle.matches('[data-toggle]')).toBe(true);
        expect(toggle.closest('ge-data-table')).toBe(table);
        expect(toggle.closest('[data-kind="group"]')!.getAttribute('data-group-key')).toBe('g1');
    });

    it('a row that left with a group whose header is not on the page hands the focus to the nearest row that is left, in its column, without scrolling', async () => {
        const table = await mountGrouped({ paginationState: { pageIndex: 1, pageSize: 3 } });
        // page 1: the rows after the first group header of page 0 (r6, r9), then the header of g1
        expect(qa(table, '[data-kind="group"]').map((r) => r.dataset['groupKey'])).not.toContain('g0');
        table.focusCell(1, 'c1');
        await settle(table);
        expect(cellAt(table, 1, 'c1')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('r9');
        const scrollTop = viewportOf(table).scrollTop;
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        await frames(3);
        // the rows of the page are other ones now: the cell at the same place on the page holds the focus, the viewport does not
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'c1' });
        expect(document.activeElement).toBe(cellAt(table, 1, 'c1'));
        expect(cellAt(table, 1, 'c1')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).not.toBe('r9');
        expect(viewportOf(table).scrollTop).toBe(scrollTop);
        expect(cellStops(table)).toEqual([cellAt(table, 1, 'c1')]);
    });

    it('a detail toggle in a flat table does not search the rows for the focused one (a constant number of id reads)', async () => {
        const reads = { count: 0 };
        const mount = (focus: boolean) => async (): Promise<number> => {
            const table = await mountTable<SampleRow>(
                {
                    columns: makeColumns(3),
                    data: makeRows(3000, { columns: 3 }),
                    getRowId: (row: SampleRow) => (reads.count++, row.id),
                    enableRowExpansion: true,
                    renderDetail: () => html`<span>detail</span>`,
                    showPagination: false,
                    showToolbar: false,
                },
                {},
                { width: 600, height: 400 },
            );
            if (focus) table.focusCell(2500, 'c0'); // deep: a search from the top would read every id up to it
            await rest(table);
            reads.count = 0;
            table.provider('expansion')!.toggleRow(table.data[2]!);
            await rest(table);
            return reads.count;
        };
        const unfocused = await mount(false)();
        const focused = await mount(true)();
        // everything a toggle costs is in `unfocused`; keeping the focus on its row adds a few reads, not a scan of the rows
        // Calibrated the same way: the current code adds 1 read over an unfocused toggle (measured 15002 against 15001), a search for the
        // focused row from the top (row 2500) adds about 2500. The bound, a tenth of the rows (300), is clear of both whatever the call pattern.
        expect(focused - unfocused).toBeLessThan(0.1 * 3000);
    });
});

describe('focus follows its row: round 8', () => {
    it('a table in a consumer\'s shadow root leaves focus the user put on an outside input alone when the dropped focus is finished', async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const frame = document.createElement('div');
        frame.style.cssText = 'width:600px;height:400px;';
        shadow.append(frame);
        const table = document.createElement('ge-data-table') as Table;
        Object.assign(table, { columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false });
        frame.append(table);
        const outside = Object.assign(document.createElement('input'), { ariaLabel: 'outside' });
        document.body.append(outside);
        try {
            await settle(table);
            table.focusCell(1, 'c0');
            await settle(table);
            expect(shadow.activeElement).toBe(table.cellAt(1, 'c0'));
            table.provider('expansion')!.toggleGroup('g0'); // the focused row's group: the drop would take the focus to its toggle
            outside.focus(); // the user is on a light-DOM input outside the shadow tree before it renders
            expect(document.activeElement).toBe(outside);
            await settle(table);
            await frames(3);
            expect(table.focusedCell).toBeNull();
            expect(document.activeElement).toBe(outside);
        } finally {
            outside.remove();
            host.remove();
        }
    });

    it('and the same table still gives the focus to the toggle when nothing else has it', async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const shadow = host.attachShadow({ mode: 'open' });
        const frame = document.createElement('div');
        frame.style.cssText = 'width:600px;height:400px;';
        shadow.append(frame);
        const table = document.createElement('ge-data-table') as Table;
        Object.assign(table, { columns: makeColumns(3), data: makeRows(6, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false });
        frame.append(table);
        try {
            await settle(table);
            table.focusCell(1, 'c0');
            await settle(table);
            table.provider('expansion')!.toggleGroup('g0');
            await settle(table);
            await frames(3);
            expect(shadow.activeElement).toBe(table.querySelector('[data-group-key="g0"] [data-toggle]'));
        } finally {
            host.remove();
        }
    });
});

describe('focus follows its row: round 7', () => {
    // A JS consumer's `getRowId` may answer with numbers; the DOM carries them as strings.
    interface Numbered { id: number; name: string; group?: string; children?: Numbered[] }
    const columns: ColumnDef<Numbered>[] = [{ accessorKey: 'name', header: 'Name', width: '200px' }];

    it('numeric row ids: opening a node above the focused row keeps the roving cell on its row, and a closed node hands it to the node', async () => {
        const data: Numbered[] = Array.from({ length: 4 }, (_, i) => ({ id: i * 10, name: `n${i}`, children: [{ id: i * 10 + 1, name: `c${i}a` }, { id: i * 10 + 2, name: `c${i}b` }] }));
        const table = await mountTable<Numbered>({ columns, data, getRowId: (row: Numbered) => row.id, enableSubRows: true, showToolbar: false, showPagination: false }, {}, { width: 600, height: 500 });
        table.focusCell(1, 'name'); // 0, 10, 20, 30: the second root
        await settle(table);
        expect(cellAt(table as never, 1, 'name')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('10');
        table.provider('expansion')!.expandSubRow(data[0]!); // two rows slide in above it
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'name' });
        // a child of an open node, then its node closed: the node (found through the tree index) holds the focus
        table.provider('expansion')!.expandSubRow(data[1]!);
        await settle(table);
        table.focusCell(5, 'name'); // 0, 1, 2, 10, 11, 12: the second child of the second root
        await settle(table);
        table.provider('expansion')!.collapseSubRow(data[1]!);
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 3, columnKey: 'name' });
        expect(cellAt(table as never, 3, 'name')!.closest('[data-slot="table-row"]')!.getAttribute('data-row-id')).toBe('10');
    });

    it('numeric row ids: collapsing the group of the focused row still hands the focus to its toggle', async () => {
        const data: Numbered[] = Array.from({ length: 6 }, (_, i) => ({ id: i + 100, name: `n${i}`, group: `g${i % 2}` }));
        const table = await mountTable<Numbered>({ columns, data, getRowId: (row: Numbered) => row.id, groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false }, {}, { width: 600, height: 500 });
        table.focusCell(1, 'name');
        await settle(table);
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        await frames(3);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).toBe(q(table, '[data-group-key="g0"] [data-toggle]'));
    });
});

describe('focus follows its row: round 6', () => {
    const mountGroups = (rows: number, groups: number, extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(rows, { columns: 3, groups }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 1000 }, showToolbar: false, ...extra }, {}, { width: 600, height: 400 });

    it('a table removed before the frame that finishes a dropped focus throws nothing, and the tasks queued after it still run', async () => {
        const errors: string[] = [];
        const onError = (event: ErrorEvent): void => void errors.push(event.message);
        window.addEventListener('error', onError);
        try {
            const table = await mountGroups(6, 3);
            const frame = table.parentElement!;
            table.focusCell(1, 'c0');
            await settle(table);
            let ran = false;
            table.provider('expansion')!.toggleGroup('g0');
            await table.updateComplete; // rendered: the task that gives the focus to the toggle is queued for the frame
            table.afterRender(() => (ran = true)); // and one after it
            table.remove(); // the providers are gone before the frame
            await frames(3);
            frame.append(table); // attached again: the frame runs the queue, the old task is not for this attach
            await settle(table);
            await frames(3);
            expect(errors).toEqual([]);
            expect(ran).toBe(true);
            // the dropped focus was the first attach's: it is not given to a toggle by the second
            expect((document.activeElement as HTMLElement | null)?.matches('[data-toggle]')).toBeFalsy();
        } finally {
            window.removeEventListener('error', onError);
        }
    });

    it('a row noted before an empty list is not a claim on the focus later: where the user clicked meanwhile stays theirs', async () => {
        const table = await mountGroups(6, 3);
        const rows = table.data;
        table.focusCell(1, 'c0'); // a row of g0, with the DOM focus on its cell
        await settle(table);
        table.provider('expansion')!.toggleGroup('g1'); // a group the row is not in: the note waits through the empty list
        table.provider('expansion')!.toggleGroup('g0'); // and the row's own group is closed too
        table.data = [];
        await settle(table);
        (document.activeElement as HTMLElement | null)?.blur(); // a click on the page background: the focus is on the body
        expect(document.activeElement).toBe(document.body);
        table.data = rows;
        await settle(table);
        await frames(3);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).toBe(document.body); // nothing was pulled onto a toggle
    });

    it('the toggle that takes the focus does not scroll the viewport to its header, which is above it', async () => {
        const table = await mountGroups(120, 3); // 40 rows per group, all drawn
        table.focusCell(30, 'c0'); // far down g0: its header is scrolled out above
        await rest(table);
        const view = viewportOf(table);
        const scrollTop = view.scrollTop;
        expect(scrollTop).toBeGreaterThan(500);
        table.provider('expansion')!.toggleGroup('g0');
        await rest(table);
        expect(document.activeElement).toBe(q(table, '[data-group-key="g0"] [data-toggle]'));
        expect(Math.abs(view.scrollTop - scrollTop)).toBeLessThan(2);
    });
});

describe('focus follows its row: round 4', () => {
    const mountGroups = (groups: number, extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(6, { columns: 3, groups }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false, ...extra }, {}, { width: 600, height: 500 });

    it('collapsing the only open group leaves no data rows, not a loading table: the focus goes to that group\'s toggle', async () => {
        const table = await mountGroups(1);
        table.focusCell(1, 'c1');
        await settle(table);
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        await frames(3);
        expect(bodyRows(table)).toHaveLength(0);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).toBe(q(table, '[data-group-key="g0"] [data-toggle]'));
        // and the table is not left waiting on a note: opening the group again and focusing a cell works as ever
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        table.focusCell(2, 'c0');
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'c0' });
    });

    it('collapsing every group at once lands the focus on a group toggle, not on the page', async () => {
        const table = await mountGroups(3);
        table.focusCell(3, 'c0');
        await settle(table);
        table.provider('expansion')!.collapseAllGroups();
        await settle(table);
        await frames(3);
        expect(bodyRows(table)).toHaveLength(0);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).not.toBe(document.body);
        expect((document.activeElement as HTMLElement).matches('[data-kind="group"] [data-toggle]')).toBe(true);
        expect((document.activeElement as HTMLElement).closest('ge-data-table')).toBe(table);
    });

    it('a deferred drop whose focus the user moved meanwhile, with a column hidden, changes neither the focus nor the column the next focus remembers', async () => {
        const table = await mountGroups(3);
        const button = Object.assign(document.createElement('button'), { textContent: 'other', slot: 'toolbar-start' });
        table.showToolbar = true;
        table.append(button);
        await settle(table);
        table.focusCell(1, 'c2');
        await settle(table);
        table.provider('expansion')!.toggleGroup('g0'); // (1, c2) is in g0: the drop would take the focus to its toggle after the render
        table.columnVisibility = { c2: false };
        button.focus(); // the user is elsewhere before it renders
        await settle(table);
        await frames(3);
        expect(document.activeElement).toBe(button);
        expect(table.focusedCell).toBeNull();
        // the column comes back and the grid is entered at its first cell, as with any table that had no focus
        table.columnVisibility = {};
        await settle(table);
        table.focusCell(0, 'c2');
        await settle(table);
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c2' });
    });

    it('no data at all (a loading table) after a toggle is not that: the focus waits for rows', async () => {
        const table = await mountGroups(3);
        const rows = table.data;
        table.focusCell(1, 'c0');
        await settle(table);
        table.provider('expansion')!.toggleGroup('g1'); // a group the focused row is not in
        table.data = [];
        await settle(table);
        expect(table.focusedCell).not.toBeNull();
        table.data = rows;
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 1, columnKey: 'c0' });
        expect(document.activeElement).toBe(cellAt(table, 1, 'c0'));
    });

    it('a second toggle while the list is empty does not discard the row the first one noted', async () => {
        const table = await mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false, showPagination: false }, {}, { width: 600, height: 500 });
        const rows = table.data;
        table.focusCell(2, 'c0'); // r0 r0-c0 r0-c1: a child of the first node
        await settle(table);
        table.provider('expansion')!.collapseSubRow(rows[0]!); // notes the row of (2, c0)
        table.data = [];
        await settle(table);
        table.provider('expansion')!.collapseSubRow(rows[1]!); // a second toggle with nothing drawn: no row to note, the first note stays
        await settle(table);
        table.data = rows;
        await settle(table);
        await frames(2);
        // the row followed by its id: its node r0 is what is left of it
        expect(table.focusedCell).toEqual({ rowIndex: 0, columnKey: 'c0' });
    });
});

describe('focus follows its row: round 2', () => {
    it('a row noted before a detach is not followed after the attach (the table keeps no pending move across it)', async () => {
        const table = await mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false, showPagination: false }, {}, { width: 600, height: 500 });
        const rows = table.data;
        const frame = table.parentElement!;
        table.focusCell(2, 'c0'); // r0 r0-c0 r0-c1: a child of the first node
        await settle(table);
        table.provider('expansion')!.collapseSubRow(rows[0]!); // notes the row...
        table.data = []; // ...and the empty list keeps it waiting
        await settle(table);
        table.remove();
        table.data = rows;
        frame.append(table);
        await settle(table);
        await frames(2);
        // not moved up to the node r0: its ancestors were what the stale note would have followed; the cell is only clamped
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'c0' });
    });

    const mountGrouped = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(12, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, ...extra }, {}, { width: 600, height: 520 });
    const mountTreeRound2 = (extra: Record<string, unknown> = {}): Promise<Table> =>
        mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false, showPagination: false, ...extra }, {}, { width: 600, height: 500 });

    it('a button of the consumer that collapses the group keeps its focus: only focus on the dropped cell is moved', async () => {
        const table = await mountGrouped();
        const button = Object.assign(document.createElement('button'), { textContent: 'collapse', slot: 'toolbar-start' });
        table.append(button);
        await settle(table);
        table.focusCell(1, 'c0');
        await settle(table);
        button.focus();
        expect(document.activeElement).toBe(button);
        table.provider('expansion')!.toggleGroup('g0');
        await settle(table);
        await frames(3);
        expect(bodyRows(table)).toHaveLength(8);
        expect(table.focusedCell).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('a row that is not drawn for a reason other than a collapsed group (a filter in the same tick) leaves the roving cell clamped, not cleared', async () => {
        const table = await mountTreeRound2();
        table.focusCell(5, 'c0'); // r0 r0-c0 r0-c1 r1 r1-c0 r1-c1
        await settle(table);
        table.provider('expansion')!.collapseSubRow(table.data[1]!);
        table.data = table.data.slice(3); // only r3 and its children remain, r1 and its descendants are gone with no ancestor drawn
        await settle(table);
        await frames(2);
        const rows = bodyRows(table).length;
        expect(rows).toBeGreaterThan(0);
        expect(table.focusedCell).toEqual({ rowIndex: rows - 1, columnKey: 'c0' });
        expect(cellStops(table)).toEqual([cellAt(table, rows - 1, 'c0')]);
    });

    it('a row recorded for one cell is not applied to another cell focused while the list was empty', async () => {
        const table = await mountTreeRound2();
        const rows = table.data;
        table.focusCell(2, 'c0');
        await settle(table);
        table.provider('expansion')!.collapseSubRow(rows[0]!); // records the row of (2, c0)...
        table.data = []; // ...and the list is empty for a render: the focus waits
        await settle(table);
        table.data = rows;
        table.focusCell(5, 'c1'); // another cell takes the focus before the rows are drawn again
        await settle(table);
        await frames(2);
        expect(table.focusedCell).toEqual({ rowIndex: 5, columnKey: 'c1' });
    });

    it('finding the row of a deep child under closed ancestors reads the ids a constant number of times, not once per ancestor', async () => {
        const reads = { count: 0 };
        const leaf = (id: string): SampleRow => ({ id, name: id, age: 1 });
        const chain: SampleRow = { id: 'top', name: 'top', age: 1, children: [{ ...leaf('l1'), children: [{ ...leaf('l2'), children: [{ ...leaf('l3'), children: [leaf('l4')] }] }] }] };
        const data = [chain, ...makeRows(2000)];
        const mount = (focusAt: number) => async (): Promise<number> => {
            const table = await mountTable<SampleRow>(
                { columns: makeColumns(2), data, enableSubRows: true, subRowDefaultExpanded: true, getRowId: (row: SampleRow) => (reads.count++, row.id), showPagination: false, showToolbar: false },
                {},
                { width: 600, height: 400 },
            );
            table.focusCell(focusAt, 'c0'); // 4 is the deepest of top l1 l2 l3 l4; the control is a root row the toggle does not move
            await settle(table);
            reads.count = 0;
            table.provider('expansion')!.collapseSubRow(data[0]!);
            await settle(table);
            expect(table.focusedCell).toEqual({ rowIndex: focusAt === 4 ? 0 : focusAt - 4, columnKey: 'c0' });
            return reads.count;
        };
        const control = await mount(1500)(); // a row below the node: it moves up four places, the toggle reads every id once to find it
        const deep = await mount(4)();
        // Calibrated on the current code and on a per-ancestor scan (the round-1 code): the single pass adds about n = 2000 reads over the
        // control (measured 2009), a scan per ancestor adds about 4 n more (measured 8517 then). The bound, 2 n, passes the first with
        // a factor two to spare and fails the second by a factor two, whatever the exact call pattern.
        expect(deep - control).toBeLessThan(2 * 2000);
    });
});

// ---- 4. rtl + pinned columns + virtual columns ---------------------------------------------------------------------

describe.each([
    { dir: 'ltr', rtl: false },
    { dir: 'rtl', rtl: true },
])('pinned columns and a window of columns, $dir', ({ rtl }) => {
    const COLUMNS = 30;
    const mountWide = async (): Promise<Table> => {
        const table = await mountTable<SampleRow>(
            { columns: makeColumns(COLUMNS, { pinLeft: 1, pinRight: 1 }), data: makeRows(40, { columns: COLUMNS }), enableVirtualScroll: true, virtualRowHeight: 40, showPagination: false, showToolbar: false, enableColumnResize: true },
            {},
            { width: 600, height: 400 },
        );
        if (rtl) await withRtl(table);
        return table;
    };
    const keysDrawn = (table: Element): string[] => [...new Set(qa(table, '[data-slot="table-cell"][data-column]').map((c) => c.dataset['column']!))];
    const index = (key: string): number => Number(key.slice(1));

    it('draws the pinned columns at their edges and a window of the middle ones, with an absolute aria-colindex, before and after a scroll', async () => {
        const table = await mountWide();
        const view = viewportOf(table).getBoundingClientRect();
        for (const left of [0, 1500, 3000]) {
            await scrollGrid(viewportOf(table), { left: rtl ? -left : left });
            await rest(table);
            const keys = keysDrawn(table);
            expect(keys).toContain('c0');
            expect(keys).toContain(`c${COLUMNS - 1}`);
            expect(keys.length).toBeLessThan(15);
            // the window follows the scroll: the middle columns at that offset (150px each, the start pin takes one)
            const middle = keys.filter((k) => k !== 'c0' && k !== `c${COLUMNS - 1}`).map(index);
            expect(Math.min(...middle)).toBeLessThanOrEqual(Math.floor(left / 150) + 1);
            expect(Math.max(...middle)).toBeGreaterThanOrEqual(Math.floor(left / 150) + 3);
            for (const key of keys) {
                expect(cellAt(table, 0, key)!.getAttribute('aria-colindex')).toBe(String(index(key) + 1));
                expect(headCell(table, key).getAttribute('aria-colindex')).toBe(String(index(key) + 1));
            }
            // the pins stick to the logical edges: start (c0) and end (c29)
            const start = cellAt(table, 0, 'c0')!.getBoundingClientRect();
            const end = cellAt(table, 0, `c${COLUMNS - 1}`)!.getBoundingClientRect();
            if (rtl) {
                expect(start.right).toBeCloseTo(view.right - 1, 0);
                expect(end.left).toBeCloseTo(view.left + 1, 0);
            } else {
                expect(start.left).toBeCloseTo(view.left + 1, 0);
                expect(end.right).toBeCloseTo(view.right - 1, 0);
            }
        }
        expect(q(table, '[data-slot="table"]').getAttribute('aria-colcount')).toBe(String(COLUMNS));
        expect(q(table, '[data-slot="table"]').scrollWidth).toBeGreaterThanOrEqual(COLUMNS * 150);
    });

    it('keeps the window and the pins when a column of the window is resized while scrolled inline', async () => {
        const table = await mountWide();
        await scrollGrid(viewportOf(table), { left: rtl ? -1500 : 1500 });
        await rest(table);
        // a middle column that is wholly on screen, between the two pins
        const view = viewportOf(table).getBoundingClientRect();
        const key = keysDrawn(table)
            .filter((k) => k !== 'c0' && k !== `c${COLUMNS - 1}`)
            .map(index)
            .find((i) => {
                const box = headCell(table, `c${i}`).getBoundingClientRect();
                return box.left >= view.left + 148 && box.right <= view.right - 148;
            })!;
        expect(key).toBeDefined();
        const head = headCell(table, `c${key}`).getBoundingClientRect();
        await mouseDrag({ x: rtl ? head.left + 3 : head.right - 3, y: head.top + head.height / 2 }, { dx: rtl ? -30 : 30, dy: 0 });
        await rest(table);
        expect(Math.round(headCell(table, `c${key}`).getBoundingClientRect().width)).toBe(180);
        const keys = keysDrawn(table);
        expect(keys).toContain('c0');
        expect(keys).toContain(`c${COLUMNS - 1}`);
        expect(keys).toContain(`c${key}`);
        for (const k of keys) expect(cellAt(table, 0, k)!.getAttribute('aria-colindex')).toBe(String(index(k) + 1));
    });
});

// Where the handle of a pinned column takes it: toward the end of the line while nothing holds the column, and, for a column pinned
// to the end of a table that overflows, toward the start (the column is stuck to the edge of the scroller, which cannot move).
describe.each([
    { pin: 'start', key: 'c0', rtl: false, overflow: false, grows: 1 },
    { pin: 'start', key: 'c0', rtl: true, overflow: false, grows: -1 },
    { pin: 'end', key: 'c3', rtl: false, overflow: false, grows: 1 },
    { pin: 'end', key: 'c3', rtl: true, overflow: false, grows: -1 },
    { pin: 'start', key: 'c0', rtl: false, overflow: true, grows: 1 },
    { pin: 'start', key: 'c0', rtl: true, overflow: true, grows: -1 },
    { pin: 'end', key: 'c3', rtl: false, overflow: true, grows: -1 },
    { pin: 'end', key: 'c3', rtl: true, overflow: true, grows: 1 },
])('resizing the $pin-pinned column, rtl: $rtl, overflowing: $overflow, in a virtual table', ({ pin, key, rtl, overflow, grows }) => {
    const mountPinned = async (): Promise<Table> => {
        const table = await mountTable<SampleRow>(
            {
                columns: makeColumns(4, { width: '150px', pinLeft: pin === 'start' ? 1 : 0, pinRight: pin === 'end' ? 1 : 0 }),
                data: makeRows(60, { columns: 4 }),
                enableVirtualScroll: true,
                virtualRowHeight: 40,
                enableColumnResize: true,
                showPagination: false,
                showToolbar: false,
            },
            {},
            { width: overflow ? 400 : 800, height: 300 },
        );
        if (rtl) await withRtl(table);
        await rest(table);
        expect(viewportOf(table).scrollWidth > viewportOf(table).clientWidth).toBe(overflow);
        return table;
    };
    const head = (table: Element) => headCell(table, key).getBoundingClientRect();
    const anchored = (table: Element) => (grows > 0 ? head(table).left : head(table).right);
    const handleOf = (table: Element) => q(headCell(table, key), '[data-slot="data-table-resize-handle"]');

    it('widens under the pointer, the edge it started from staying put', async () => {
        const table = await mountPinned();
        const [width, edge] = [head(table).width, anchored(table)];
        const at = handleOf(table).getBoundingClientRect();
        await mouseDrag({ x: at.left + at.width / 2, y: at.top + at.height / 2 }, { dx: 40 * grows, dy: 0 });
        await rest(table);
        expect(head(table).width).toBe(width + 40);
        expect(anchored(table)).toBeCloseTo(edge, 0);
    });

    it('widens with the arrow key that points the same way, in the same steps as the pointer', async () => {
        const table = await mountPinned();
        const [width, edge] = [Math.round(head(table).width), anchored(table)];
        handleOf(table).focus();
        for (let i = 0; i < 3; i++) await press(grows > 0 ? '{ArrowRight}' : '{ArrowLeft}');
        await rest(table);
        expect(Math.round(head(table).width)).toBe(width + 30);
        expect(handleOf(table).getAttribute('aria-valuenow')).toBe(String(width + 30));
        expect(anchored(table)).toBeCloseTo(edge, 0);
        await press(grows > 0 ? '{ArrowLeft}' : '{ArrowRight}');
        await rest(table);
        expect(Math.round(head(table).width)).toBe(width + 20);
    });
});

// ---- 5. accessibility in every mode, light and dark ----------------------------------------------------------------

describe('axe on every mode', () => {
    const modes: [string, () => Promise<Table>][] = [
        ['flat', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(6, { columns: 3 }), showToolbar: false })],
        ['tree', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(3, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, showToolbar: false })],
        ['grouped', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(9, { columns: 3, groups: 3 }), groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, showToolbar: false })],
        ['a detail open', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(4, { columns: 3 }), enableRowExpansion: true, expandedRows: { r1: true }, renderDetail: (row: SampleRow) => html`<span>${row.name}</span>`, showToolbar: false })],
        ['virtual', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(500, { columns: 3 }), enableVirtualScroll: true, virtualRowHeight: 40, showPagination: false, showToolbar: false }, {}, { width: 600, height: 360 })],
        ['a selection with a mixed header', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(6, { columns: 3 }), enableRowSelection: true, rowSelection: { r1: true, r3: true }, showToolbar: false })],
        ['a tree with a mixed parent', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(3, { columns: 3, children: 2 }), enableSubRows: true, subRowDefaultExpanded: true, enableRowSelection: true, subRowSelectionMode: 'descendants', rowSelection: { 'r0-c0': true }, showToolbar: false })],
        ['pinned columns, rtl', async () => {
            const table = await mountTable<SampleRow>({ columns: makeColumns(6, { pinLeft: 1, pinRight: 1 }), data: makeRows(6, { columns: 6 }), enableColumnResize: true, enableColumnReorder: true, showToolbar: false }, {}, { width: 600, height: 360 });
            await withRtl(table);
            return table;
        }],
        ['a virtual variable table with details', () => mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(300, { columns: 3 }), enableVirtualScroll: true, virtualVariableRowHeight: true, enableRowExpansion: true, expandedRows: { r2: true }, renderDetail: (row: SampleRow) => html`<span>${row.name}</span>`, showPagination: false, showToolbar: false }, {}, { width: 600, height: 360 })],
    ];

    it.each(['light', 'dark'])('has no violations in %s mode', async (mode) => {
        withTheme(mode);
        const found: string[] = [];
        for (const [name, mount] of modes) {
            const table = await mount();
            await rest(table);
            const result = await axe.run(table);
            found.push(...result.violations.map((v) => `${name}: ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
        }
        expect(found).toEqual([]);
    });

    it('the mixed header and the mixed parent are mixed for assistive technology too', async () => {
        const table = await mountTable<SampleRow>({ columns: makeColumns(3), data: makeRows(6, { columns: 3 }), enableRowSelection: true, rowSelection: { r1: true }, showToolbar: false });
        const header = q(table, '[data-slot="table-head"] ge-checkbox') as HTMLElement & { indeterminate: boolean; checked: boolean };
        expect(header.indeterminate).toBe(true);
        expect(header.checked).toBe(false);
        expect(rowOf(table, 'r1').getAttribute('aria-selected')).toBe('true');
        expect(rowOf(table, 'r0').getAttribute('aria-selected')).toBe('false');
    });
});
