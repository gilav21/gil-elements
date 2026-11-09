import axe from 'axe-core';
import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axTree, bodyRows, makeRows, mountTable, q, qa, type SampleRow, settle } from './data-table-fixtures.js';
import { parkMouse, perf, press, withRtl, withTheme } from './data-table-input-fixtures.js';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';

afterEach(parkMouse);

type Table = GeDataTable<SampleRow>;

const GROUP_COLUMNS: ColumnDef<SampleRow>[] = [
    { accessorKey: 'name', header: 'Name', width: '160px' },
    { accessorKey: 'age', header: 'Age', width: '100px', aggregateFn: 'sum' },
];
const mountGrouped = (props: Record<string, unknown> = {}): Promise<Table> =>
    mountTable<SampleRow>({ data: makeRows(9, { groups: 3 }), columns: GROUP_COLUMNS, groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 }, ...props });

const allRows = (table: Element): HTMLElement[] => qa(table, '[data-slot="table-body"] > [data-slot="table-row"]:not([data-kind="spacer"])');
const dataIdx = (table: Element): number[] => bodyRows(table).map((r) => Number(r.dataset['rowIndex']));
const ariaIdx = (table: Element): number[] => allRows(table).map((r) => Number(r.getAttribute('aria-rowindex')));
const shape = (table: Element): string[] => allRows(table).map((r) => (r.dataset['kind'] === 'group' ? `[${r.dataset['groupKey']}]` : `${r.dataset['kind'] === 'detail' ? 'detail:' : ''}${r.dataset['rowId']}`));
const groupToggle = (table: Element, key: string): HTMLElement => q(table, `[data-group-key="${key}"] button[data-toggle]`);
const record = (table: Table, name: string): CustomEvent[] => {
    const seen: CustomEvent[] = [];
    table.addEventListener(name, (e) => seen.push(e as CustomEvent));
    return seen;
};
const goTo = async (table: Table, pageIndex: number, pageSize = 4): Promise<void> => {
    table.paginationState = { pageIndex, pageSize };
    await settle(table);
};

describe('grouped rows: the rendered index', () => {
    it('numbers the data rows as drawn, restarts on every page, and the row at data-row-index i is renderedRowAt(i)', async () => {
        const table = await mountGrouped({ paginationState: { pageIndex: 0, pageSize: 4 } });
        const query = table.provider('query')!;
        const pages: string[][] = [];
        for (const page of [0, 1, 2]) {
            await goTo(table, page);
            pages.push(shape(table));
            expect(dataIdx(table)).toEqual(bodyRows(table).map((_, i) => i));
            for (const row of bodyRows(table)) expect(query.renderedRowAt(Number(row.dataset['rowIndex']))?.id).toBe(row.dataset['rowId']);
            // The header row is 1; every real row, group headers included, follows in order.
            expect(ariaIdx(table)).toEqual(allRows(table).map((_, i) => i + 2));
        }
        // Headers count toward the page size; a group split over a page is not repeated.
        expect(pages).toEqual([
            ['[g0]', 'r0', 'r3', 'r6'],
            ['[g1]', 'r1', 'r4', 'r7'],
            ['[g2]', 'r2', 'r5', 'r8'],
        ]);
    });

    it('opens a page on data rows when their group header is on the previous page', async () => {
        const table = await mountGrouped();
        await goTo(table, 0, 3);
        expect(shape(table)).toEqual(['[g0]', 'r0', 'r3']);
        await goTo(table, 1, 3);
        expect(shape(table)).toEqual(['r6', '[g1]', 'r1']);
        expect(dataIdx(table)).toEqual([0, 1]);
        expect(ariaIdx(table)).toEqual([2, 3, 4]);
        expect(q(table, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe('5'); // the header, three rows and the footer the sum aggregate turns on
    });

    it('numbers the whole list again when paging is switched off after a page was visited', async () => {
        const table = await mountGrouped();
        await goTo(table, 1, 3);
        table.showPagination = false;
        await settle(table);
        expect(dataIdx(table)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        expect(allRows(table)).toHaveLength(12);
    });

    it('draws a header per group with the count, the aggregates in column order, and an empty label for a null value', async () => {
        const data: SampleRow[] = [
            { id: '1', name: 'a', age: 1, group: 'x' },
            { id: '2', name: 'b', age: 2, group: null },
            { id: '3', name: 'c', age: 4, group: 'x' },
        ];
        const table = await mountGrouped({ data, columns: [{ accessorKey: 'age', header: 'Age', aggregateFn: 'sum' }, { accessorKey: 'name', header: 'Name', aggregateFn: 'count' }] });
        const [first, second] = qa(table, '[data-kind="group"]');
        expect(first!.dataset['groupKey']).toBe('x');
        const metas = qa(first!, '[data-slot="data-table-group-meta"]').map((m) => m.textContent!.trim());
        expect(metas).toEqual(['(2)', expect.stringMatching(/^Age: /), expect.stringMatching(/^Name: /)]);
        expect(second!.dataset['groupKey']).toBe('null');
        expect(q(second!, '[data-slot="data-table-text"]').textContent).toBe('');
    });

    it('omits the aggregates when group-aggregates is off', async () => {
        const table = await mountGrouped({ groupAggregates: false });
        expect(qa(table, '[data-kind="group"] [data-slot="data-table-group-meta"]').map((m) => m.textContent)).toEqual(['(3)', '(3)', '(3)']);
    });

    it('leaves grouping off in tree mode, and keeps the treegrid role while grouping is switched off', async () => {
        const table = await mountGrouped({ enableSubRows: true });
        expect(qa(table, '[data-kind="group"]')).toHaveLength(0);
        expect(q(table, '[data-slot="table"]').getAttribute('role')).toBe('treegrid');
        expect(bodyRows(table).every((r) => r.hasAttribute('aria-level'))).toBe(true);
    });

    it('is a plain grid when virtual scroll switches grouping off', async () => {
        const table = await mountGrouped({ enableVirtualScroll: true, virtualRowHeight: 40 });
        expect(qa(table, '[data-kind="group"]')).toHaveLength(0);
        expect(q(table, '[data-slot="table"]').getAttribute('role')).toBe('grid');
    });

    it('is a treegrid while groupBy draws group rows, and group rows are not selectable rows', async () => {
        const table = await mountGrouped({ enableRowSelection: true });
        expect(q(table, '[data-slot="table"]').getAttribute('role')).toBe('treegrid');
        const group = q(table, '[data-kind="group"]');
        expect(group.hasAttribute('aria-selected')).toBe(false);
        expect(group.hasAttribute('aria-level')).toBe(false);
        expect(group.getAttribute('aria-expanded')).toBe('true');
        expect(qa(group, 'ge-checkbox')).toHaveLength(0);
    });
});

describe('collapsing a group', () => {
    it('removes its rows, renumbers the rest, flips aria-expanded on the header and the toggle, and fires one event', async () => {
        const table = await mountGrouped();
        const events = record(table, 'collapsed-groups-change');
        await userEvent.click(groupToggle(table, 'g0'));
        await settle(table);

        expect(shape(table)).toEqual(['[g0]', '[g1]', 'r1', 'r4', 'r7', '[g2]', 'r2', 'r5', 'r8']);
        expect(dataIdx(table)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(q(table, '[data-group-key="g0"]').getAttribute('aria-expanded')).toBe('false');
        expect(groupToggle(table, 'g0').getAttribute('aria-expanded')).toBe('false');
        expect(groupToggle(table, 'g0').getAttribute('aria-label')).toBe('Expand group');
        expect(events.map((e) => e.detail)).toEqual([{ g0: true }]);
        expect(table.collapsedGroups).toEqual({ g0: true });

        // A click on the header row itself toggles too, once.
        await userEvent.click(q(table, '[data-group-key="g0"] [data-slot="data-table-text"]'));
        await settle(table);
        expect(allRows(table)).toHaveLength(12);
        expect(events).toHaveLength(2);
    });

    it('collapseAllGroups and expandAllGroups through the element, and the rows of a collapsed group stay in groupRows', async () => {
        const table = await mountGrouped();
        table.collapseAllGroups();
        await settle(table);
        expect(shape(table)).toEqual(['[g0]', '[g1]', '[g2]']);
        expect(table.provider('query')!.groupRows().map((g) => g.rows.length)).toEqual([3, 3, 3]);
        table.expandAllGroups();
        await settle(table);
        expect(bodyRows(table)).toHaveLength(9);
    });

    it('keeps a group named after an Object member working', async () => {
        const data = [{ id: '1', name: 'a', age: 1, group: 'constructor' }, { id: '2', name: 'b', age: 2, group: '__proto__' }];
        const table = await mountGrouped({ data });
        await userEvent.click(groupToggle(table, '__proto__'));
        await settle(table);
        expect(shape(table)).toEqual(['[constructor]', '1', '[__proto__]']);
    });

    it('makes the toggle button the only focusable part of a group header', async () => {
        const table = await mountGrouped();
        const row = q(table, '[data-group-key="g1"]');
        expect(row.getAttribute('tabindex')).toBeNull();
        const focusable = qa(row, 'button, [tabindex]');
        expect(focusable).toEqual([groupToggle(table, 'g1')]);
    });
});

interface TreeNode extends SampleRow {
    children?: TreeNode[];
}
const node = (id: string, children?: TreeNode[]): TreeNode => ({ id, name: id, age: 1, ...(children ? { children } : {}) });
const TREE = (): TreeNode[] => [
    node('a', [node('a1', [node('a1x'), node('a1y')]), node('a2')]),
    node('b', [node('b1')]),
    node('c'),
];
const mountTree = (props: Record<string, unknown> = {}): Promise<Table> => mountTable<SampleRow>({ data: TREE(), enableSubRows: true, ...props });

describe('tree rows', () => {
    it('stamps level, set size and position, and omits aria-expanded on a leaf', async () => {
        const table = await mountTree({ subRowDefaultExpanded: true });
        const row = (id: string) => q(table, `[data-row-id="${id}"]`);
        const aria = (id: string) => ['aria-level', 'aria-setsize', 'aria-posinset', 'aria-expanded'].map((a) => row(id).getAttribute(a));
        expect(aria('a')).toEqual(['1', '3', '1', 'true']);
        expect(aria('a1')).toEqual(['2', '2', '1', 'true']);
        expect(aria('a1y')).toEqual(['3', '2', '2', null]);
        expect(aria('a2')).toEqual(['2', '2', '2', null]);
        expect(aria('c')).toEqual(['1', '3', '3', null]);
        expect(row('a1y').dataset['depth']).toBe('2');
        expect(row('a1y').style.getPropertyValue('--ge-dt-depth')).toBe('2');
        expect(q(table, '[data-slot="table"]').getAttribute('role')).toBe('treegrid');
    });

    it('the tree-host header carries the same reorder shortcuts and controls wrapper as any header', async () => {
        const table = await mountTree({ enableColumnReorder: true });
        const head = q(table, '[data-slot="table-head"][data-column-id="name"]');
        expect(head.querySelector('[data-slot="data-table-head-controls"] [data-action="tree-all"]')).not.toBeNull();
        const button = head.querySelector('ge-data-table-column-header')!.shadowRoot!.querySelector('ge-button')!;
        expect(button.getAttribute('aria-keyshortcuts')).toContain('Alt+Shift+ArrowLeft');
    });

    it('counts siblings of the filtered tree, not of the data', async () => {
        const table = await mountTree({ subRowDefaultExpanded: true });
        table.globalFilter = 'a1';
        await settle(table);
        expect(shape(table)).toEqual(['a', 'a1', 'a1x', 'a1y']);
        expect(q(table, '[data-row-id="a"]').getAttribute('aria-setsize')).toBe('1');
        expect(q(table, '[data-row-id="a1"]').getAttribute('aria-setsize')).toBe('1');
    });

    it('draws the toggle on the first data column, expands and collapses it, and keeps the state in the model', async () => {
        const table = await mountTree();
        const events = record(table, 'sub-row-expanded-rows-change');
        expect(shape(table)).toEqual(['a', 'b', 'c']);
        const toggle = (id: string) => q(table, `[data-row-id="${id}"] [data-slot="data-table-tree-cell"] button[data-toggle]`);
        expect(qa(table, '[data-row-id="c"] [data-slot="data-table-tree-leaf"]')).toHaveLength(1);
        expect(toggle('a').getAttribute('aria-label')).toBe('Expand sub-rows');

        await userEvent.click(toggle('a'));
        await settle(table);
        expect(shape(table)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
        expect(toggle('a').getAttribute('aria-expanded')).toBe('true');
        expect(table.subRowExpandedRows).toEqual({ a: true });
        expect(events.map((e) => e.detail)).toEqual([{ a: true }]);
        await userEvent.click(toggle('a'));
        await settle(table);
        expect(shape(table)).toEqual(['a', 'b', 'c']);
    });

    it('indents a level by --ge-dt-indent', async () => {
        const table = await mountTree({ subRowDefaultExpanded: true });
        const pad = (id: string) => parseFloat(getComputedStyle(q(table, `[data-row-id="${id}"] [data-slot="data-table-tree-cell"]`)).paddingInlineStart);
        expect([pad('a'), pad('a1'), pad('a1x')]).toEqual([0, 20, 40]);
    });

    it('expands and collapses all from the host header and through the element, replacing the record', async () => {
        const table = await mountTree();
        const all = () => q(table, '[data-slot="table-head"] button[data-action="tree-all"]');
        expect(all().getAttribute('aria-label')).toBe('Expand all sub-rows');
        await userEvent.click(all());
        await settle(table);
        expect(shape(table)).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2', 'b', 'b1', 'c']);
        expect(all().getAttribute('aria-label')).toBe('Collapse all sub-rows');
        await userEvent.click(all());
        await settle(table);
        expect(shape(table)).toEqual(['a', 'b', 'c']);
        expect(table.subRowExpandedRows).toEqual({ a: false, a1: false, b: false });
        table.expandAllSubRows(1);
        await settle(table);
        expect(shape(table)).toEqual(['a', 'a1', 'a2', 'b', 'b1', 'c']);
    });

    it('puts the tree on the column marked treeExpander', async () => {
        const table = await mountTree({ columns: [{ accessorKey: 'name', header: 'Name', width: '120px' }, { accessorKey: 'age', header: 'Age', width: '80px', treeExpander: true }] });
        expect(qa(table, '[data-slot="data-table-tree-cell"]').every((c) => c.closest('[data-column]')!.getAttribute('data-column') === 'age')).toBe(true);
        expect(qa(table, '[data-slot="table-head"] button[data-action="tree-all"]')).toHaveLength(1);
        expect(q(table, '[data-slot="table-head"][data-column-id="age"] button[data-action="tree-all"]')).toBeDefined();
    });

    const focusHost = (table: Table, id: string): HTMLElement => {
        const cell = q(table, `[data-row-id="${id}"] [data-column="name"]`);
        cell.tabIndex = 0;
        cell.focus();
        return cell;
    };

    it('opens with ArrowRight and closes with ArrowLeft on the host cell, flipped in rtl, and otherwise leaves the key alone', async () => {
        const table = await mountTree();
        focusHost(table, 'a');
        await press('{ArrowLeft}');
        expect(shape(table)).toEqual(['a', 'b', 'c']);
        await press('{ArrowRight}');
        expect(shape(table)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
        // On an open node the key is not ours: the roving-focus controller, when there is one, moves to the next cell.
        await press('{ArrowRight}');
        expect(table.subRowExpandedRows).toEqual({ a: true });
        focusHost(table, 'a');
        await press('{ArrowLeft}');
        expect(shape(table)).toEqual(['a', 'b', 'c']);

        await withRtl(table);
        focusHost(table, 'a');
        await press('{ArrowRight}');
        expect(shape(table)).toEqual(['a', 'b', 'c']);
        await press('{ArrowLeft}');
        expect(shape(table)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
    });

    it('does not use the arrow keys on a cell that is not the tree host', async () => {
        const table = await mountTree();
        const cell = q(table, '[data-row-id="a"] [data-column="age"]');
        cell.tabIndex = 0;
        cell.focus();
        await press('{ArrowRight}');
        expect(shape(table)).toEqual(['a', 'b', 'c']);
    });

    it('pages the roots with their descendants, or the visible rows when subRowsPaginated', async () => {
        const roots = await mountTree({ subRowDefaultExpanded: true, paginationState: { pageIndex: 0, pageSize: 1 } });
        expect(shape(roots)).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2']);
        expect(dataIdx(roots)).toEqual([0, 1, 2, 3, 4]);
        await goTo(roots, 1, 1);
        expect(shape(roots)).toEqual(['b', 'b1']);
        expect(dataIdx(roots)).toEqual([0, 1]);

        const rows = await mountTree({ subRowDefaultExpanded: true, subRowsPaginated: true, paginationState: { pageIndex: 1, pageSize: 3 } });
        expect(shape(rows)).toEqual(['a1y', 'a2', 'b']);
        expect(rows.provider('query')!.totalItems()).toBe(8);
    });
});

describe('detail rows', () => {
    const mountDetail = (props: Record<string, unknown> = {}): Promise<Table> => mountTable<SampleRow>({ enableRowExpansion: true, data: makeRows(4), ...props });
    const expander = (table: Element, id: string): HTMLElement => q(table, `[data-row-id="${id}"] button[data-action="detail"]`);

    it('opens the detail row after its data row, wires aria-controls, shifts the next aria-rowindex and fires one event', async () => {
        const table = await mountDetail({ renderDetail: (row: SampleRow) => html`<span data-testid="detail">${row.name}!</span>` });
        const events = record(table, 'expanded-rows-change');
        expect(expander(table, 'r1').getAttribute('aria-expanded')).toBe('false');
        expect(expander(table, 'r1').hasAttribute('aria-controls')).toBe(false);
        const before = ariaIdx(table);

        await userEvent.click(expander(table, 'r1'));
        await settle(table);
        expect(shape(table)).toEqual(['r0', 'r1', 'detail:r1', 'r2', 'r3']);
        const detail = q(table, '[data-kind="detail"]');
        expect(expander(table, 'r1').getAttribute('aria-controls')).toBe(detail.id);
        expect(document.getElementById(detail.id)).toBe(detail);
        expect(expander(table, 'r1').getAttribute('aria-expanded')).toBe('true');
        expect(expander(table, 'r1').getAttribute('aria-label')).toBe('Collapse row');
        expect(detail.dataset['detailFor']).toBe('1');
        expect(detail.hasAttribute('data-row-index')).toBe(false);
        expect(detail.textContent).toContain('n1!');
        expect(q(detail, '[role="gridcell"]').getAttribute('aria-colspan')).toBe(q(table, '[data-slot="table"]').getAttribute('aria-colcount'));
        expect(ariaIdx(table)).toEqual([2, 3, 4, 5, 6]);
        expect(before).toEqual([2, 3, 4, 5]);
        expect(dataIdx(table)).toEqual([0, 1, 2, 3]);
        expect(q(table, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe('6');
        expect(events.map((e) => e.detail)).toEqual([{ r1: true }]);
        expect(detail.querySelector('[data-pinned]')).toBeNull();
    });

    it('draws the row as JSON without renderDetail, and closes again', async () => {
        const table = await mountDetail();
        await userEvent.click(expander(table, 'r0'));
        await settle(table);
        expect(JSON.parse(q(table, '[data-kind="detail"] pre').textContent!)).toMatchObject({ id: 'r0', name: 'n0' });
        await userEvent.click(expander(table, 'r0'));
        await settle(table);
        expect(qa(table, '[data-kind="detail"]')).toHaveLength(0);
        expect(table.expandedRows).toEqual({});
    });

    it('opens an id-less row with spaces in its id, and the controls id has none', async () => {
        const table = await mountDetail({ data: [{ id: 'a b', name: 'x', age: 1 }] });
        await userEvent.click(expander(table, 'a b'));
        await settle(table);
        expect(q(table, '[data-kind="detail"]').id).not.toMatch(/\s/);
    });

    it('expands every filtered row from the header, and leaves rows the filter hides as they are', async () => {
        const table = await mountDetail({ expandedRows: { r3: true } });
        table.globalFilter = 'n1';
        await settle(table);
        const head = () => q(table, '[data-slot="table-head"] button[data-action="detail-all"]');
        expect(head().getAttribute('aria-label')).toBe('Expand all rows');
        await userEvent.click(head());
        await settle(table);
        expect(shape(table)).toEqual(['r1', 'detail:r1']);
        expect(table.expandedRows).toEqual({ r1: true, r3: true });
        expect(head().getAttribute('aria-label')).toBe('Collapse all rows');
        await userEvent.click(head());
        await settle(table);
        expect(table.expandedRows).toEqual({ r3: true });
    });

    it('opens and closes with Space and Enter on the expander cell', async () => {
        const table = await mountDetail();
        const cell = q(table, '[data-row-id="r2"] [data-column="_expander"]');
        cell.tabIndex = 0;
        cell.focus();
        await press(' ');
        expect(shape(table)).toContain('detail:r2');
        await press('{Enter}');
        expect(shape(table)).not.toContain('detail:r2');
    });

    it('still opens the detail of a disabled row, and draws a row that claims the full width', async () => {
        const table = await mountDetail({ disabledRowIds: ['r0'], renderFullWidth: (row: SampleRow) => (row.id === 'r3' ? html`<b>wide ${row.name}</b>` : undefined) });
        // Playwright refuses to click under aria-disabled, so this one is a DOM click; a person can click it.
        expander(table, 'r0').click();
        await settle(table);
        expect(shape(table)).toContain('detail:r0');
        const wide = q(table, '[data-row-id="r3"]');
        expect(wide.querySelectorAll('[data-slot="table-cell"]')).toHaveLength(1);
        expect(wide.textContent).toContain('wide n3');
        expect(wide.querySelector('[data-column]')).toBeNull();
    });

    it('counts a detail row of a tree row, with sub-rows paged both ways', async () => {
        const open = { expandedRows: { a: true }, subRowDefaultExpanded: true };
        const roots = await mountTree({ enableRowExpansion: true, ...open, paginationState: { pageIndex: 0, pageSize: 1 } });
        expect(shape(roots)).toEqual(['a', 'detail:a', 'a1', 'a1x', 'a1y', 'a2']);
        expect(q(roots, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe('7');
        expect(ariaIdx(roots)).toEqual([2, 3, 4, 5, 6, 7]);

        const rows = await mountTree({ enableRowExpansion: true, ...open, subRowsPaginated: true, paginationState: { pageIndex: 0, pageSize: 2 } });
        expect(shape(rows)).toEqual(['a', 'detail:a', 'a1']);
        expect(q(rows, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe('4');
        expect(dataIdx(rows)).toEqual([0, 1]);
    });

    it('exposes the detail row as a row of the grid in the accessibility tree', async () => {
        const table = await mountDetail({ expandedRows: { r1: true } });
        const nodes = await axTree();
        const rows = nodes.filter((n) => n.role?.value === 'row');
        // The header, four data rows and the detail row; the detail row's name is its JSON.
        expect(rows).toHaveLength(6);
        expect(rows.filter((n) => n.name?.value?.includes('"id": "r1"'))).toHaveLength(1);
        expect(table.querySelectorAll('[role="row"]')).toHaveLength(6);
    });
});

describe('rows in every mode', () => {
    it.each(['light', 'dark'])('pass axe in %s mode', async (mode) => {
        withTheme(mode);
        for (const table of [
            await mountGrouped({ enableRowSelection: true }),
            await mountTree({ enableRowSelection: true, enableRowExpansion: true, subRowDefaultExpanded: true, expandedRows: { a: true } }),
            await mountTable<SampleRow>({ enableRowExpansion: true, enableRowSelection: true, data: makeRows(3), expandedRows: { r1: true } }),
        ]) {
            const result = await axe.run(table);
            expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        }
    });

    it('toggling selection or a group in 5k rows stays cheap and keeps the draw order', async () => {
        const table = await mountTable<SampleRow>({ enableRowSelection: true, data: makeRows(5000, { groups: 50 }), columns: GROUP_COLUMNS, groupBy: 'group', paginationState: { pageIndex: 0, pageSize: 100 } });
        const first = table.data[0]!;
        const result = await perf(async () => {
            for (let i = 0; i < 5; i++) {
                table.toggleRow(first);
                await settle(table);
            }
            table.provider('expansion')!.toggleGroup('g0');
            await settle(table);
        });
        expect(result.elapsedMs).toBeLessThan(3000);
        expect(dataIdx(table).slice(0, 3)).toEqual([0, 1, 2]);
    });
});
