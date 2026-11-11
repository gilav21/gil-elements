import axe from 'axe-core';
import { html } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { paintedToken, useTheme } from '../test-utils.js';
import { computeGridAria } from './data-table-aria.js';
import { bodyRows, mountTable, q, qa, SAMPLE_COLUMNS as COLUMNS, SAMPLE_ROWS as ROWS, type SampleRow as Row, settle, trackTable } from './data-table-fixtures.js';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';

afterEach(() => document.documentElement.classList.remove('dark'));

const cellTexts = (table: Element, column: string) => qa(table, `[data-slot="table-cell"][data-column="${column}"]`).map((c) => c.textContent!.trim());
const sortButton = (table: Element, column: string) =>
    q(table, `[data-column-id="${column}"] ge-data-table-column-header`).shadowRoot!.querySelector('ge-button')!.shadowRoot!.querySelector('button')!;
const headerOf = (table: Element, column: string) => q(table, `[data-column-id="${column}"]`);

describe('ge-data-table rendering', () => {
    it('draws one header cell per column and one row per datum, addressed by the DOM protocol', async () => {
        const table = await mountTable();

        expect(qa(table, '[data-slot="table-head"][role="columnheader"]').map((h) => h.querySelector<HTMLElement>('ge-data-table-column-header')!.title)).toEqual(['Name', 'Age']);
        expect(cellTexts(table, 'name')).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
        const rows = bodyRows(table);
        expect(rows.map((r) => r.dataset['rowIndex'])).toEqual(['0', '1', '2', '3']);
        expect(rows.map((r) => r.dataset['rowId'])).toEqual(['a', 'b', 'c', 'd']);
        const cell = q(table, '[data-slot="table-cell"][data-column="age"][data-row-index="2"]');
        expect(cell.textContent).toBe('25');
        expect(table.cellAt(2, 'age')).toBe(cell);
        expect(table.rowAt(2)).toBe(rows[2]);
    });

    it('never mutates the data and renders into one wrapper of its own', async () => {
        const data = ROWS.map((r) => ({ ...r }));
        const table = await mountTable({ data });
        table.querySelector<HTMLElement>('ge-data-table-column-header')!.shadowRoot!.querySelector('ge-button')!.shadowRoot!.querySelector('button')!.click();

        expect(data).toEqual(ROWS);
        expect(table.shadowRoot).toBeNull();
        expect([...table.children].map((c) => c.getAttribute('data-slot'))).toEqual(['data-table-root']);
    });

    it('stamps the grid ARIA from computeGridAria, with the footer row counted and colcount for every column', async () => {
        const table = await mountTable({ columns: [{ ...COLUMNS[0]!, footer: 'Total' }, COLUMNS[1]!], enableRowSelection: true });
        const grid = q(table, '[data-slot="table"]');
        const aria = computeGridAria({ tree: false, headerRows: 1, totalDataRows: 4, columnCount: 3, footerRows: 1 });

        expect(grid.getAttribute('role')).toBe(aria.role);
        expect(grid.getAttribute('aria-rowcount')).toBe(String(aria.rowCount));
        expect(grid.getAttribute('aria-colcount')).toBe(String(aria.colCount));
        expect(grid.getAttribute('aria-multiselectable')).toBe('true');
        expect(q(table, '[data-slot="table-header"] [role="row"]').getAttribute('aria-rowindex')).toBe('1');
        expect(bodyRows(table).map((r) => r.getAttribute('aria-rowindex'))).toEqual([0, 1, 2, 3].map((i) => String(aria.dataRowIndex(i))));
        expect(q(table, '[data-slot="table-footer"] [role="row"]').getAttribute('aria-rowindex')).toBe(String(aria.footerRowIndex()));
        expect(qa(bodyRows(table)[0]!, '[role="gridcell"]').map((c) => c.getAttribute('aria-colindex'))).toEqual(['1', '2', '3']);
        // Fillers and the spacer are decorative and never counted.
        expect(qa(table, '[data-slot="table-row"][data-kind="spacer"]').every((r) => r.getAttribute('aria-hidden') === 'true')).toBe(true);
        expect(bodyRows(table).every((r) => r.getAttribute('aria-selected') === 'false')).toBe(true);
    });

    it('marks rows selected at creation and after a later change the same way: state, aria-selected, tint, multiselectable', async () => {
        const selectedRows = (table: Element) => bodyRows(table).filter((r) => r.getAttribute('data-state') === 'selected').map((r) => r.dataset['rowId']);
        const check = async (table: GeDataTable<Row>, ids: string[]) => {
            await new Promise((resolve) => setTimeout(resolve, 300)); // the row colour transitions

            expect(selectedRows(table)).toEqual(ids);
            for (const row of bodyRows(table)) {
                const on = ids.includes(row.dataset['rowId']!);
                expect(row.getAttribute('aria-selected')).toBe(String(on));
                expect(getComputedStyle(row).backgroundColor === paintedToken('--muted', row)).toBe(on);
            }
            expect(q(table, '[data-slot="table"]').getAttribute('aria-multiselectable')).toBe('true');
        };
        // The property is written before the first render.
        const table = await mountTable({ enableRowSelection: true, rowSelection: { b: true, d: true } });
        await check(table, ['b', 'd']);

        table.rowSelection = { a: true };
        await settle(table);
        await check(table, ['a']);
    });

    it('is a plain grid, and a treegrid with sub-rows or grouping', async () => {
        expect(q(await mountTable(), '[data-slot="table"]').getAttribute('role')).toBe('grid');
        expect(q(await mountTable({ enableSubRows: true }), '[data-slot="table"]').getAttribute('role')).toBe('treegrid');
        expect(q(await mountTable({ groupBy: 'age' }), '[data-slot="table"]').getAttribute('role')).toBe('treegrid');
    });

    it('moves the single tab stop from the viewport to the focused cell, and nothing else is tabbable', async () => {
        const table = await mountTable();
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        expect(viewport.getAttribute('tabindex')).toBe('0');
        expect(qa(table, '[data-slot="table-cell"][tabindex]')).toHaveLength(0);

        table.provide('interaction', { focusedCell: () => ({ rowIndex: 1, columnKey: 'age' }), cellRange: () => null, editingCell: () => null, cellEditError: () => null, focusCell() {}, isCellSelected: () => false });
        table.requestRender();
        await settle(table);

        expect(viewport.getAttribute('tabindex')).toBe('-1');
        const tabbable = qa(table, '[data-slot="table-cell"][tabindex]');
        expect(tabbable).toEqual([table.cellAt(1, 'age')]);
        expect(tabbable[0]!.getAttribute('tabindex')).toBe('0');
    });

    it('reflects the borders, theme and busy state on the host', async () => {
        const table = await mountTable({ showRowBorders: false, theme: 'blue', loading: true });
        expect(table.hasAttribute('data-row-borders')).toBe(false);
        expect(table.hasAttribute('data-column-borders')).toBe(true);
        expect(table.getAttribute('data-ui-theme')).toBe('blue');
        expect(table.getAttribute('aria-busy')).toBe('true');
        expect(getComputedStyle(q(table, '[data-slot="table-cell"][data-row-index="0"]')).borderBottomWidth).toBe('0px');
        table.showRowBorders = true;
        await settle(table);
        expect(getComputedStyle(q(table, '[data-slot="table-cell"][data-row-index="0"]')).borderBottomWidth).toBe('1px');
    });
});

describe('ge-data-table cell content', () => {
    it('draws a custom element by tag with the inputs as properties and the outputs as listeners, reusing it across renders', async () => {
        const seen: string[] = [];
        class TestBadge extends HTMLElement {
            label = '';
        }
        if (!customElements.get('test-badge')) customElements.define('test-badge', TestBadge);
        const table = await mountTable({
            columns: [{ accessorKey: 'name', header: 'Name', component: 'test-badge', componentInputs: (row: Row) => ({ label: row.name }), componentOutputs: (row: Row) => ({ ping: () => seen.push(row.id) }) }],
        });
        const badges = qa(table, 'test-badge');

        expect(badges.map((b) => (b as TestBadge).label)).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
        expect(badges[0]!.getAttribute('label')).toBeNull();
        expect(badges[0]!.getAttribute('data-slot')).toBe('cell-component');
        badges[1]!.dispatchEvent(new Event('ping'));
        expect(seen).toEqual(['b']);

        table.data = [...ROWS];
        await settle(table);
        expect(qa(table, 'test-badge')[0]).toBe(badges[0]);
        qa(table, 'test-badge')[1]!.dispatchEvent(new Event('ping'));
        expect(seen).toEqual(['b', 'b']);
    });

    it('draws a cellRenderer result: a lit template, a Node or a string', async () => {
        const node = document.createElement('i');
        node.textContent = 'node';
        const table = await mountTable({
            columns: [
                { accessorKey: 'name', header: 'Name', cellRenderer: ({ row }: { row: Row }) => html`<b class="t">${row.name}</b>` },
                { accessorKey: 'age', header: 'Age', cellRenderer: ({ rowIndex }: { rowIndex: number }) => (rowIndex === 0 ? node : `#${rowIndex}`) },
            ],
        });

        expect(qa(table, '[data-column="name"] b.t').map((b) => b.textContent)).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
        expect(table.cellAt(0, 'age')!.firstElementChild).toBe(node);
        expect(table.cellAt(2, 'age')!.textContent).toBe('#2');
    });

    it('puts cellClassRules and style rules on the inner span, not on the cell, and bypasses formatting for renderers', async () => {
        const table = await mountTable({
            columns: [
                { accessorKey: 'age', header: 'Age', cellClassRules: [{ when: (v: unknown) => (v as number) > 29, class: 'old' }], cellStyleRules: (v: unknown) => ({ color: (v as number) > 40 ? 'rgb(255, 0, 0)' : '' }) },
                { accessorKey: 'name', header: 'Name', cellRenderer: ({ row }: { row: Row }) => row.name, cellClassRules: [{ when: () => true, class: 'ignored' }] },
            ],
        });
        const cell = table.cellAt(0, 'age')!;
        const span = cell.querySelector('[data-slot="cell-formatted"]')!;

        expect(span.classList.contains('old')).toBe(true);
        expect(cell.classList.contains('old')).toBe(false);
        expect(cell.className).toBe('');
        expect(getComputedStyle(span).color).toBe('rgb(255, 0, 0)');
        expect(table.cellAt(2, 'age')!.querySelector('.old')).toBeNull();
        expect(table.querySelector('.ignored')).toBeNull();
        expect(span.querySelector('[data-slot="cell-text"]')!.textContent).toBe('41');
    });

    it('draws a data bar with its track and an icon', async () => {
        const table = await mountTable({ columns: [{ accessorKey: 'age', header: 'Age', dataBar: { min: 0, max: 100, color: 'rgb(0, 128, 0)', track: 'rgb(200, 200, 200)' }, iconSet: () => ({ glyph: '*' }) }] });
        const cell = table.cellAt(0, 'age')!;

        expect(q(cell, '[data-slot="cell-data-bar"]').style.width).toBe('41%');
        expect(q(cell, '[data-slot="cell-data-bar-track"]').style.backgroundColor).toBe('rgb(200, 200, 200)');
        expect(q(cell, '[data-slot="cell-icon"]').textContent).toBe('*');
    });

    it('shows the footer text and aggregates over all rows, not just the page', async () => {
        const many = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, age: 1 }));
        const table = await mountTable({ data: many, columns: [{ ...COLUMNS[0]!, footer: 'Total' }, { ...COLUMNS[1]!, aggregateFn: 'sum' }] });
        const cells = qa(table, '[data-slot="table-footer"] [role="gridcell"]');

        expect(cells.map((c) => c.textContent)).toEqual(['Total', '25']);
        expect(bodyRows(table)).toHaveLength(10);
    });

    it('asks for the sorted rows to hand to the footer only when a footer is drawn', async () => {
        const countFor = async (columns: ColumnDef<Row>[]): Promise<number> => {
            const table = await mountTable({ columns });
            const query = table.provider('query')!;
            const sorted = query.sortedData.bind(query);
            let calls = 0;
            query.sortedData = () => (calls++, sorted());
            table.requestUpdate();
            await settle(table);
            return calls;
        };
        expect(await countFor(COLUMNS)).toBe(0);
        expect(await countFor([{ ...COLUMNS[0]!, footer: 'Total' }, COLUMNS[1]!])).toBeGreaterThan(0);
    });
});

describe('ge-data-table sorting', () => {
    it('sorts by a header click, announces it, and emits once', async () => {
        const table = await mountTable();
        const events: unknown[] = [];
        table.addEventListener('sort-change', (e) => events.push((e as CustomEvent).detail));
        const queries: unknown[] = [];
        table.addEventListener('query', (e) => queries.push((e as CustomEvent).detail));

        sortButton(table, 'name').click();
        await settle(table);

        expect(events).toEqual([{ column: 'name', direction: 'asc' }]);
        expect(cellTexts(table, 'name')).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
        expect(headerOf(table, 'name').getAttribute('aria-sort')).toBe('ascending');
        expect(headerOf(table, 'age').getAttribute('aria-sort')).toBe('none');
        expect(q(table, '[data-slot="data-table-announcer"]').textContent).toContain('Table sorted by Name, ascending');
        expect(queries).toHaveLength(1);

        sortButton(table, 'name').click();
        await settle(table);
        expect(cellTexts(table, 'name')).toEqual(['Dave', 'Carol', 'Bob', 'Alice']);
        expect(headerOf(table, 'name').getAttribute('aria-sort')).toBe('descending');

        sortButton(table, 'name').click();
        await settle(table);
        expect(cellTexts(table, 'name')).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
        expect(headerOf(table, 'name').getAttribute('aria-sort')).toBe('none');
    });

    it('sorts once per key press, Enter and Space, with no second handler on top of the click', async () => {
        const table = await mountTable();
        let count = 0;
        table.addEventListener('sort-change', () => count++);
        sortButton(table, 'age').focus();

        await userEvent.keyboard('{Enter}');
        await settle(table);
        expect(count).toBe(1);
        expect(headerOf(table, 'age').getAttribute('aria-sort')).toBe('ascending');

        await userEvent.keyboard(' ');
        await settle(table);
        expect(count).toBe(2);
        expect(headerOf(table, 'age').getAttribute('aria-sort')).toBe('descending');
    });

    it('names the sort button after its state and leaves aria-sort to the header cell', async () => {
        const table = await mountTable();
        const header = q(table, '[data-column-id="age"] ge-data-table-column-header');

        expect(sortButton(table, 'age').getAttribute('aria-label')).toBe('Age, not sorted. Activate to sort ascending.');
        expect(header.hasAttribute('aria-sort')).toBe(false);
        sortButton(table, 'age').click();
        await settle(table);
        expect(sortButton(table, 'age').getAttribute('aria-label')).toBe('Age, sorted ascending. Activate to sort descending.');
    });

    it('chains a shift-click with a priority badge when multi-sort is on, and trims the chain to the maximum', async () => {
        const table = await mountTable({ enableMultiSort: true, maxMultiSortColumns: 2 });
        const chains: unknown[] = [];
        table.addEventListener('multi-sort-change', (e) => chains.push((e as CustomEvent).detail));

        sortButton(table, 'age').click();
        sortButton(table, 'name').dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, shiftKey: true }));
        await settle(table);

        expect(chains.at(-1)).toEqual([{ column: 'age', direction: 'asc' }, { column: 'name', direction: 'asc' }]);
        expect(cellTexts(table, 'name')).toEqual(['Bob', 'Alice', 'Dave', 'Carol']);
        const badge = (column: string) => q(table, `[data-column-id="${column}"] ge-data-table-column-header`).shadowRoot!.querySelector('.badge')?.textContent;
        expect([badge('age'), badge('name')]).toEqual(['1', '2']);
    });

    it('with local sorting off it emits and leaves the rows alone', async () => {
        const table = await mountTable({ localSorting: false });
        let detail: unknown;
        table.addEventListener('sort-change', (e) => (detail = (e as CustomEvent).detail));
        sortButton(table, 'name').click();
        await settle(table);

        expect(detail).toEqual({ column: 'name', direction: 'asc' });
        expect(cellTexts(table, 'name')).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
    });
});

describe('ge-data-table paging', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `r${i}`, name: `n${String(i).padStart(2, '0')}`, age: i }));
    const pagerButton = (table: Element, label: string) =>
        [...q(table, 'ge-data-table-pager').shadowRoot!.querySelectorAll('ge-pagination-link')].find((l) => l.textContent!.includes(label))!.shadowRoot!.querySelector('button')!;
    const indicator = (table: Element) => q(table, 'ge-data-table-pager').shadowRoot!.querySelector('.indicator')!.textContent!.trim();

    it('shows one page of local rows and moves with the next and last buttons, emitting page-change', async () => {
        const table = await mountTable({ data: many });
        const pages: unknown[] = [];
        table.addEventListener('page-change', (e) => pages.push((e as CustomEvent).detail));
        expect(bodyRows(table)).toHaveLength(10);
        expect(indicator(table)).toBe('Page 1 of 3');
        expect(pagerButton(table, 'previous').disabled).toBe(true);

        pagerButton(table, 'next').click();
        await settle(table);
        expect(cellTexts(table, 'name')[0]).toBe('n10');
        expect(indicator(table)).toBe('Page 2 of 3');
        expect(pages).toEqual([{ pageIndex: 1, pageSize: 10 }]);

        pagerButton(table, 'last').click();
        await settle(table);
        expect(bodyRows(table)).toHaveLength(5);
        expect(pagerButton(table, 'next').disabled).toBe(true);
        expect(bodyRows(table)[0]!.getAttribute('aria-rowindex')).toBe('2');
    });

    it('pages the data a consumer assigns to paginationState, and resets to the first page on a sort', async () => {
        const table = await mountTable({ data: many });
        table.paginationState = { pageIndex: 2, pageSize: 10 };
        await settle(table);
        expect(bodyRows(table)).toHaveLength(5);

        const pages: unknown[] = [];
        table.addEventListener('page-change', (e) => pages.push((e as CustomEvent).detail));
        sortButton(table, 'age').click();
        await settle(table);
        expect(pages).toEqual([{ pageIndex: 0, pageSize: 10 }]);
        expect(bodyRows(table)).toHaveLength(10);
    });

    it('slices nothing without a pager, and leaves server rows alone with local-pagination off', async () => {
        expect(bodyRows(await mountTable({ data: many, showPagination: false }))).toHaveLength(25);
        const server = await mountTable({ data: many.slice(0, 10), localPagination: false, total: 95 });
        expect(bodyRows(server)).toHaveLength(10);
        expect(indicator(server)).toBe('Page 1 of 10');
    });

    it('reads boolean and list attributes', async () => {
        const table = await mountTable({ data: many }, { 'show-page-size-selector': 'false', 'page-size-options': '5, 25' });
        expect(q(table, 'ge-data-table-pager').shadowRoot!.querySelector('ge-select')).toBeNull();
        expect(table.pageSizeOptions).toEqual([5, 25]);
    });
});

describe('ge-data-table states', () => {
    it('draws the empty state as one spanning cell, and a custom empty slot or renderer in its place', async () => {
        const table = await mountTable({ data: [] });
        const cell = q(table, '[data-slot="table-cell"][data-kind="empty"]');
        expect(cell.getAttribute('aria-colspan')).toBe('2');
        expect(cell.textContent).toContain('No results found.');

        const slot = document.createElement('p');
        slot.slot = 'empty';
        slot.textContent = 'Nothing here';
        const custom = document.createElement('ge-data-table') as GeDataTable<Row>;
        Object.assign(custom, { columns: COLUMNS, data: [] });
        custom.append(slot);
        document.body.append(custom);
        trackTable(custom);
        await settle(custom);
        expect(q(custom, '[data-kind="empty"]').textContent).toContain('Nothing here');
        expect(q(custom, '[data-kind="empty"] p')).toBe(slot);

        const rendered = await mountTable({ data: [], renderEmpty: () => html`<em>Empty!</em>` });
        expect(q(rendered, '[data-kind="empty"] em').textContent).toBe('Empty!');
    });

    it('replaces the whole shell with the skeleton and marks itself busy', async () => {
        const table = await mountTable({ skeleton: true, skeletonRows: 3 });
        expect(qa(table, 'ge-skeleton[data-kind="row"]')).toHaveLength(3);
        expect(qa(table, 'ge-skeleton[data-kind="bar"]')).toHaveLength(2);
        expect(table.querySelector('[data-slot="table"]')).toBeNull();
        expect(table.getAttribute('aria-busy')).toBe('true');
        expect(q(table, '[data-slot="data-table-skeleton"]').getAttribute('role')).toBe('status');
    });

    it('overlays the rows while loading, per trigger, with the default box or a custom renderer', async () => {
        const table = await mountTable({ loading: true });
        const overlay = q(table, '[data-slot="data-table-loader"]');
        expect(overlay.getAttribute('role')).toBe('status');
        expect(overlay.textContent).toContain('Loading...');
        expect(bodyRows(table)).toHaveLength(4);
        expect(getComputedStyle(overlay).position).toBe('absolute');

        table.loadingVisibility = { initial: false };
        await settle(table);
        expect(table.querySelector('[data-slot="data-table-loader"]')).toBeNull();

        table.loadingVisibility = { sorting: false };
        table.renderLoader = (trigger) => `custom ${trigger}`;
        sortButton(table, 'name').click();
        await settle(table);
        expect(table.querySelector('[data-slot="data-table-loader"]')).toBeNull();
        table.setLoadingTrigger('pagination');
        await settle(table);
        expect(q(table, '[data-slot="data-table-loader"]').textContent).toBe('custom pagination');
    });

    it('moves the toolbar and footer slot children once and keeps them as the same nodes', async () => {
        const start = Object.assign(document.createElement('button'), { slot: 'toolbar-start', textContent: 'start' });
        const footer = Object.assign(document.createElement('div'), { slot: 'footer', textContent: 'foot' });
        const table = document.createElement('ge-data-table') as GeDataTable<Row>;
        Object.assign(table, { columns: COLUMNS, data: ROWS });
        table.append(start, footer);
        document.body.append(table);
        trackTable(table);
        await settle(table);

        expect(start.parentElement).toBe(q(table, '[data-slot="data-table-toolbar-start"]'));
        expect(footer.parentElement).toBe(q(table, '[data-slot="data-table-footer-slot"]'));
        table.data = [...ROWS];
        await settle(table);
        expect(start.parentElement).toBe(q(table, '[data-slot="data-table-toolbar-start"]'));
        expect(table.contains(start)).toBe(true);
    });

    it('filters by the toolbar input and resets to page 0', async () => {
        const table = await mountTable();
        const filters: string[] = [];
        table.addEventListener('filter-change', (e) => filters.push((e as CustomEvent<string>).detail));
        const input = q(table, '[data-slot="data-table-filter"] ge-input') as HTMLElement & { value: string };
        const inner = input.shadowRoot!.querySelector('input')!;
        inner.value = 'ali';
        inner.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
        await settle(table);

        expect(filters).toEqual(['ali']);
        expect(cellTexts(table, 'name')).toEqual(['Alice']);
    });

    it('hides columns from the toolbar popover state, and the column visibility model follows', async () => {
        const table = await mountTable();
        const changes: unknown[] = [];
        table.addEventListener('column-visibility-change', (e) => changes.push((e as CustomEvent).detail));
        // The checkbox reports its own state; flip it the way a user would.
        const box = table.querySelector<HTMLElement & { checked: boolean }>('[data-slot="data-table-columns-item"] ge-checkbox')!;
        box.checked = false;
        box.dispatchEvent(new Event('change'));
        await settle(table);

        expect(changes.at(-1)).toEqual({ name: false });
        expect(qa(table, '[data-slot="table-head"][role="columnheader"]').map((h) => h.dataset['columnId'])).toEqual(['age']);
    });
});

describe('ge-data-table pinned columns', () => {
    const wide = (): ColumnDef<Row>[] => [
        { accessorKey: 'id', header: 'Id', width: '100px', pin: 'left' },
        { accessorKey: 'name', header: 'Name', width: '200px', pin: 'left' },
        { accessorKey: 'age', header: 'Age', width: '400px' },
        { accessorKey: 'x', header: 'X', width: '150px', pin: 'right' },
    ];
    async function pinned(dir: 'ltr' | 'rtl') {
        const table = await mountTable({ columns: wide(), data: ROWS.map((r) => ({ ...r, x: 'x' })), showPagination: false, showToolbar: false }, { dir }, { width: 500, height: 300 });
        return { table };
    }
    const edges = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
    };

    it('sticks the pinned-left columns to the start edge in a stack, and the pinned-right column to the end, in ltr', async () => {
        const { table } = await pinned('ltr');
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        viewport.scrollLeft = 150;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const view = viewport.getBoundingClientRect();
        const stuck = (key: string) => table.cellAt(0, key)!;

        expect(Math.round(edges(stuck('id')).left - view.left)).toBe(1);
        expect(Math.round(edges(stuck('name')).left - view.left)).toBe(101);
        expect(Math.round(view.right - edges(stuck('x')).right)).toBe(1);
        expect(qa(table, '[data-slot="table-head"]').map((h) => h.dataset['pinned'] ?? null)).toEqual(['left', 'left', null, 'right', null]);
        // The scrolled-under cell is hidden by the opaque pinned one.
        expect(getComputedStyle(stuck('id')).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(stuck('age')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it('uses logical sides: pin left is the start edge in rtl, so a pinned-left column stays first', async () => {
        const { table } = await pinned('rtl');
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        viewport.scrollLeft = -150;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const view = viewport.getBoundingClientRect();
        const stuck = (key: string) => table.cellAt(0, key)!;

        expect(Math.round(view.right - edges(stuck('id')).right)).toBe(1);
        expect(Math.round(view.right - edges(stuck('name')).right)).toBe(101);
        expect(Math.round(edges(stuck('x')).left - view.left)).toBe(1);
    });

    it('writes the column geometry as custom properties on the grid, one set per column', async () => {
        const { table } = await pinned('ltr');
        const style = q(table, '[data-slot="table"]').style;

        expect(style.getPropertyValue('--ge-dt-col-1')).toBe('200px');
        expect(style.getPropertyValue('--ge-dt-pin-1')).toBe('calc(100px)');
        expect(style.getPropertyValue('--ge-dt-pin-3')).toBe('0px');
        expect(table.cellAt(0, 'name')!.style.getPropertyValue('--ge-dt-w')).toBe('var(--ge-dt-col-1)');
    });
});

describe('ge-data-table styles and lifecycle', () => {
    it('adopts one layered stylesheet per document, scoped under ge-data-table, and drops it with the last table', async () => {
        const before = document.adoptedStyleSheets.length;
        const a = await mountTable();
        const b = await mountTable();
        expect(document.adoptedStyleSheets.length).toBe(before + 1);
        const sheet = document.adoptedStyleSheets.at(-1)!;
        const layer = sheet.cssRules[0] as CSSGroupingRule;

        expect(sheet.cssRules).toHaveLength(1);
        expect(layer.cssText.startsWith('@layer ge-data-table')).toBe(true);
        const selectors: string[] = [];
        const collect = (rules: CSSRuleList) => {
            for (const rule of rules) {
                if (rule instanceof CSSStyleRule) selectors.push(rule.selectorText);
                else if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
            }
        };
        collect(layer.cssRules);
        const leaks = selectors.filter((s) => s.split(',').some((part) => !/(^|\s)(ge-data-table|\.dark ge-data-table)\b/.test(part.trim())));
        expect(leaks).toEqual([]);

        a.remove();
        expect(document.adoptedStyleSheets.length).toBe(before + 1);
        b.remove();
        expect(document.adoptedStyleSheets.length).toBe(before);
    });

    it('does not style a grid-looking markup outside the element', async () => {
        const outside = document.createElement('div');
        outside.innerHTML = '<div data-slot="table-cell" data-width="fixed" data-pinned="left" style="width: 33px; --ge-dt-w: 99px">x</div>';
        document.body.append(outside);
        await mountTable();
        const cell = outside.firstElementChild!;
        const style = getComputedStyle(cell);

        expect(style.position).toBe('static');
        expect(style.display).toBe('block');
        expect(style.padding).toBe('0px');
        outside.remove();
    });

    it('leaves no listener on the document or window after it disconnects', async () => {
        const live = new Map<EventListenerOrEventListenerObject, string>();
        const patched = [document, window].map((target) => {
            const { addEventListener: add, removeEventListener: remove } = target;
            target.addEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
                live.set(fn, type);
                add.call(this, type, fn, options);
            } as typeof add;
            target.removeEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {
                live.delete(fn);
                remove.call(this, type, fn, options);
            } as typeof remove;
            return () => {
                target.addEventListener = add;
                target.removeEventListener = remove;
            };
        });
        const table = await mountTable({ data: Array.from({ length: 25 }, (_, i) => ({ id: String(i), name: 'n' + i, age: i })) });
        sortButton(table, 'name').click();
        await settle(table);
        table.remove();
        await table.updateComplete;
        patched.forEach((restore) => restore());

        expect([...live.values()]).toEqual([]);
        expect(table.provider('query')).toBeUndefined();
    });

    it('rebuilds its services on reconnect', async () => {
        const table = await mountTable();
        table.remove();
        expect(table.provider('columns')).toBeUndefined();
        document.body.append(table);
        await settle(table);

        expect(table.provider('columns')).toBeDefined();
        expect(bodyRows(table)).toHaveLength(4);
    });

    it('resolves the locale: English built in, an object used as it is, rtl following the dictionary', async () => {
        const table = await mountTable({ locale: { ...(await import('./data-table.locales.js')).DATA_TABLE_LOCALES.en, code: 'xx', rtl: true, noResultsLabel: 'Keine Treffer', filterPlaceholder: 'Filtern...' }, data: [] });
        expect(table.getAttribute('dir')).toBe('rtl');
        expect(q(table, '[data-kind="empty"]').textContent).toContain('Keine Treffer');
        expect(q(table, '[data-slot="data-table-filter"] ge-input').getAttribute('placeholder')).toBe('Filtern...');
    });

    it('redraws in a dictionary registered after the first render, and in a changed page language, with no other trigger', async () => {
        const { DATA_TABLE_LOCALES, registerDataTableLocale } = await import('./data-table.locales.js');
        const placeholder = (table: Element) => q(table, '[data-slot="data-table-filter"] ge-input').getAttribute('placeholder');
        const lang = document.documentElement.lang;
        try {
            const table = await mountTable({ locale: 'de', data: [] });
            expect(placeholder(table)).toBe(DATA_TABLE_LOCALES.en.filterPlaceholder);
            registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' }); // no other render trigger
            await settle(table);
            expect(placeholder(table)).toBe('Filtern...');
            // no locale set: the page language decides, and a change of it is followed
            const follower = await mountTable({ data: [] });
            expect(placeholder(follower)).toBe(DATA_TABLE_LOCALES.en.filterPlaceholder);
            document.documentElement.lang = 'de';
            await new Promise((resolve) => setTimeout(resolve, 0)); // the attribute observer is a microtask, the render another
            await settle(follower);
            expect(placeholder(follower)).toBe('Filtern...');
        } finally {
            document.documentElement.lang = lang;
            delete DATA_TABLE_LOCALES['de'];
        }
    });

    it('tells the locale subscribers when the language changes under it, and a locale that names nothing follows the page', async () => {
        const { DATA_TABLE_LOCALES, registerDataTableLocale } = await import('./data-table.locales.js');
        const placeholder = (table: Element) => q(table, '[data-slot="data-table-filter"] ge-input').getAttribute('placeholder');
        const lang = document.documentElement.lang;
        const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
        try {
            const table = await mountTable({ locale: 'de', data: [] });
            const seen: string[] = [];
            table.topics.on('locale', () => seen.push(table.resolvedLocale.code));
            registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' });
            await settle(table);
            expect(seen).toEqual(['de']);
            // `xx` is no dictionary: it follows the page language, a change of which reaches the subscribers too
            const follower = await mountTable({ locale: 'xx', data: [] });
            const heard: string[] = [];
            follower.topics.on('locale', () => heard.push(follower.resolvedLocale.code));
            expect(placeholder(follower)).toBe(DATA_TABLE_LOCALES.en.filterPlaceholder);
            document.documentElement.lang = 'de';
            await tick();
            await settle(follower);
            expect(placeholder(follower)).toBe('Filtern...');
            expect(heard).toEqual(['de']);
        } finally {
            document.documentElement.lang = lang;
            delete DATA_TABLE_LOCALES['de'];
        }
    });

    it('does not announce the locale on the first render (what attached before it already read it), only when it changes', async () => {
        const { DATA_TABLE_LOCALES, registerDataTableLocale } = await import('./data-table.locales.js');
        const original = DATA_TABLE_LOCALES.en;
        try {
            const table = document.createElement('ge-data-table') as GeDataTable<Row>;
            Object.assign(table, { columns: COLUMNS, data: ROWS });
            let announced = 0;
            table.topics.on('locale', () => announced++);
            document.body.append(trackTable(table));
            await settle(table);
            expect(announced).toBe(0);
            registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' }); // nobody uses it: this table is English
            await settle(table);
            expect(announced).toBe(0);
            registerDataTableLocale('en', { noResultsLabel: 'Nothing here' });
            await settle(table);
            expect(announced).toBe(1);
        } finally {
            delete DATA_TABLE_LOCALES['de'];
            registerDataTableLocale('en', original);
        }
    });

    it('announces a locale set after the attach but before the first render (a framework wrapper), once', async () => {
        const { DATA_TABLE_LOCALES, registerDataTableLocale } = await import('./data-table.locales.js');
        try {
            registerDataTableLocale('de', { filterPlaceholder: 'Filtern...' });
            const table = document.createElement('ge-data-table') as GeDataTable<Row>;
            Object.assign(table, { columns: COLUMNS, data: ROWS });
            let announced = 0;
            table.topics.on('locale', () => announced++);
            document.body.append(trackTable(table));
            table.locale = 'de'; // same task: the attach has read English, the first render has not happened
            await settle(table);
            expect(announced).toBe(1);
            expect(q(table, '[data-slot="data-table-filter"] ge-input').getAttribute('placeholder')).toBe('Filtern...');
        } finally {
            delete DATA_TABLE_LOCALES['de'];
        }
    });

    it('the column header and the pager follow a registered English with no other trigger, on a table and on their own', async () => {
        const { DATA_TABLE_LOCALES, registerDataTableLocale } = await import('./data-table.locales.js');
        const original = DATA_TABLE_LOCALES.en;
        const headerLabel = (el: Element) => el.shadowRoot!.querySelector('ge-button')!.getAttribute('aria-label');
        try {
            const table = await mountTable({ data: ROWS });
            const ownHeader = trackTable(document.createElement('ge-data-table-column-header')) as HTMLElement & { title: string; updateComplete: Promise<boolean> };
            ownHeader.title = 'Name';
            document.body.append(ownHeader);
            const ownPager = trackTable(document.createElement('ge-data-table-pager')) as HTMLElement & { updateComplete: Promise<boolean> };
            document.body.append(ownPager);
            await Promise.all([ownHeader.updateComplete, ownPager.updateComplete]);
            const pagerText = (el: Element) => el.shadowRoot!.querySelector('.size-label')?.textContent;
            expect(pagerText(table.querySelector('ge-data-table-pager')!)).toBe(DATA_TABLE_LOCALES.en.rowsPerPageLabel);
            registerDataTableLocale('en', { rowsPerPageLabel: 'Per page', sortStateNone: 'Sort {title}' });
            await settle(table);
            expect(pagerText(table.querySelector('ge-data-table-pager')!)).toBe('Per page');
            expect(headerLabel(q(table, '[data-column-id="name"] ge-data-table-column-header'))).toBe('Sort Name');
            // on their own they resolve it when they draw
            ownHeader.requestUpdate();
            ownPager.requestUpdate();
            await Promise.all([ownHeader.updateComplete, ownPager.updateComplete]);
            expect(headerLabel(ownHeader)).toBe('Sort Name');
            expect(pagerText(ownPager)).toBe('Per page');
        } finally {
            registerDataTableLocale('en', original);
        }
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const table = await mountTable({ columns: [{ ...COLUMNS[0]!, footer: 'Total' }, COLUMNS[1]!], enableRowSelection: true });
        const result = await axe.run(table);

        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
});

describe('ge-data-table review fixes', () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, name: `n${i}`, age: i }));

    it('takes property writes while detached, renders nothing meanwhile, and shows them on reconnect', async () => {
        const table = await mountTable();
        table.remove();
        table.data = [{ id: 'z', name: 'Zed', age: 9 }];
        table.loading = true;
        await table.updateComplete;
        document.body.append(table);
        await settle(table);

        expect(cellTexts(table, 'name')).toEqual(['Zed']);
        expect(table.querySelector('[data-slot="data-table-loader"]')).not.toBeNull();
    });

    it('runs every after-render task, also those queued by a second update before the frame', async () => {
        const table = await mountTable();
        const ran: string[] = [];
        table.afterRender(() => ran.push('a'));
        await table.updateComplete;
        table.afterRender(() => ran.push('b'));
        await table.updateComplete;
        await frame();
        await frame();

        expect(ran).toEqual(['a', 'b']);
    });

    it('keeps model states written before the element upgraded', async () => {
        const { GeDataTable } = await import('./data-table.js');
        const tag = `ge-dt-late-${Math.random().toString(36).slice(2, 8)}`;
        const early = document.createElement(tag) as GeDataTable<Row>;
        Object.assign(early, { columns: COLUMNS, data: ROWS, rowSelection: { b: true }, enableRowSelection: true });
        document.body.append(early);
        trackTable(early);
        customElements.define(tag, class extends GeDataTable<Row> {});
        await settle(early);

        expect(cellTexts(early, 'name')).toEqual(['Carol', 'Alice', 'Bob', 'Dave']);
        expect(bodyRows(early).filter((r) => r.dataset['state'] === 'selected').map((r) => r.dataset['rowId'])).toEqual(['b']);
        expect(Object.hasOwn(early, 'data')).toBe(false);
    });

    it('goes back to the last page when the data shrinks or the page size grows, and says so', async () => {
        const table = await mountTable({ data: many(100) });
        table.paginationState = { pageIndex: 5, pageSize: 10 };
        await settle(table);
        const pages: unknown[] = [];
        table.addEventListener('page-change', (e) => pages.push((e as CustomEvent).detail));

        table.data = many(15);
        await settle(table);
        expect(table.paginationState).toEqual({ pageIndex: 1, pageSize: 10 });
        expect(pages).toEqual([{ pageIndex: 1, pageSize: 10 }]);
        expect(bodyRows(table)).toHaveLength(5);

        table.data = many(100);
        table.paginationState = { pageIndex: 4, pageSize: 50 };
        await settle(table);
        expect(table.paginationState).toEqual({ pageIndex: 1, pageSize: 50 });
    });

    it('leaves a server page alone when no total is known', async () => {
        const table = await mountTable({ data: many(10), localPagination: false });
        table.paginationState = { pageIndex: 3, pageSize: 10 };
        await settle(table);
        expect(table.paginationState.pageIndex).toBe(3);
    });

    it('lets the consumer remove or replace a slotted node, with node.remove(), removeChild or replaceChild', async () => {
        const slotted = (text: string) => Object.assign(document.createElement('button'), { slot: 'toolbar-start', textContent: text });
        const [a, b, c] = [slotted('a'), slotted('b'), slotted('c')];
        const table = document.createElement('ge-data-table') as GeDataTable<Row>;
        Object.assign(table, { columns: COLUMNS, data: ROWS });
        table.append(a, b, c);
        document.body.append(table);
        trackTable(table);
        await settle(table);
        const inToolbar = () => qa(table, '[data-slot="data-table-toolbar-start"] > button').map((n) => n.textContent);
        expect(inToolbar()).toEqual(['a', 'b', 'c']);

        a.remove();
        await settle(table);
        expect(inToolbar()).toEqual(['b', 'c']);

        expect(() => table.removeChild(b)).not.toThrow();
        await settle(table);
        expect(inToolbar()).toEqual(['c']);

        const d = slotted('d');
        expect(() => table.replaceChild(d, c)).not.toThrow();
        await settle(table);
        expect(inToolbar()).toEqual(['d']);

        table.data = [...ROWS];
        table.showToolbar = false;
        await settle(table);
        table.showToolbar = true;
        await settle(table);
        expect(inToolbar()).toEqual(['d']);
    });

    it('keeps a runtime pin, and the table stays silent, across a reconnect', async () => {
        const table = await mountTable();
        const events: string[] = [];
        const dispatch = table.dispatchEvent.bind(table);
        table.dispatchEvent = (event: Event) => (events.push(event.type), dispatch(event));
        table.pinColumn('age', 'left');
        await settle(table);
        expect(headerOf(table, 'age').dataset['pinned']).toBe('left');

        table.remove();
        document.body.append(table);
        await settle(table);
        expect(headerOf(table, 'age').dataset['pinned']).toBe('left');
        expect(events).toEqual([]);
    });

    it('draws and sorts the first of two columns that share an accessorKey, and warns once', async () => {
        const warnings: string[] = [];
        const warn = console.warn;
        console.warn = (message: string) => warnings.push(String(message));
        try {
            const table = await mountTable({ columns: [{ accessorKey: 'name', header: 'First' }, { accessorKey: 'name', header: 'Second' }, COLUMNS[1]!] });
            table.requestRender();
            await settle(table);
            expect(qa(table, '[data-slot="table-head"][role="columnheader"]').map((h) => h.dataset['columnId'])).toEqual(['name', 'age']);
            expect(q(table, '[data-column-id="name"] ge-data-table-column-header').title).toBe('First');
            expect(warnings.filter((w) => w.includes('Duplicate accessorKey'))).toHaveLength(1);
        } finally {
            console.warn = warn;
        }
    });

    it('announces a server-side filter with the server total, and stays silent without one', async () => {
        const announcement = (table: Element) => q(table, '[data-slot="data-table-announcer"]').textContent!.replaceAll('​', '').trim();
        const type = async (table: GeDataTable<Row>, text: string) => {
            const inner = q(table, '[data-slot="data-table-filter"] ge-input').shadowRoot!.querySelector('input')!;
            inner.value = text;
            inner.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
            await new Promise((resolve) => setTimeout(resolve, 650));
            await settle(table);
        };
        const withTotal = await mountTable({ data: many(10), localFiltering: false, localPagination: false, total: 77 });
        await type(withTotal, 'x');
        expect(announcement(withTotal)).toBe('77 results found for "x"');

        const without = await mountTable({ data: many(10), localFiltering: false, localPagination: false });
        await type(without, 'x');
        expect(announcement(without)).toBe('');
    });
});
