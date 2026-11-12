import { html, nothing } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import { headCell, makeRows, mountTable, SAMPLE_ROWS, settle } from './data-table-fixtures.js';

const filter = vi.hoisted(() => ({ trigger: undefined as unknown }));
vi.mock('./data-table-grid-filters.js', () => ({
    filtersView: () => ({ trigger: () => filter.trigger, row: () => undefined, rows: 0 }),
}));

describe('the header of the tree-host column', () => {
    it('carries the filter trigger of its column, like any header', async () => {
        filter.trigger = html`<button data-test="trigger">filter</button>`;
        const table = await mountTable({ data: makeRows(3, { children: 2 }), enableSubRows: true });
        const head = headCell(table, 'name');
        expect(head.querySelector('[data-action="tree-all"]')).not.toBeNull();
        expect(head.querySelector('[data-slot="data-table-head-controls"] [data-test="trigger"]')).not.toBeNull();
        filter.trigger = nothing;
    });
});

describe('the header of a column with headerRenderer: null', () => {
    it('is an ordinary header (the sort control), not a bare custom one', async () => {
        filter.trigger = nothing;
        const table = await mountTable({ columns: [{ accessorKey: 'name', header: 'Name', width: '200px', headerRenderer: null }], data: SAMPLE_ROWS });
        const wrapper = headCell(table, 'name').querySelector('[data-slot="data-table-head-controls"]')!;
        expect(wrapper.hasAttribute('data-bare')).toBe(false);
        expect(wrapper.querySelector('ge-data-table-column-header')).not.toBeNull();
    });
});

describe('the header of a column with a headerRenderer', () => {
    it('keeps the consumer header element when a filter trigger appears and goes away (one template: no remount)', async () => {
        filter.trigger = nothing;
        const table = await mountTable({
            columns: [{ accessorKey: 'name', header: 'Name', width: '200px', headerRenderer: () => html`<span data-test="mine">Name!</span>` }],
            data: SAMPLE_ROWS,
        });
        const mine = headCell(table, 'name').querySelector('[data-test="mine"]');
        expect(mine).not.toBeNull();
        const wrapper = headCell(table, 'name').querySelector('[data-slot="data-table-head-controls"]')!;
        expect(wrapper.hasAttribute('data-bare')).toBe(true);
        filter.trigger = html`<button data-test="trigger">filter</button>`;
        table.requestUpdate();
        await settle(table);
        expect(headCell(table, 'name').querySelector('[data-test="mine"]')).toBe(mine);
        expect(headCell(table, 'name').querySelector('[data-slot="data-table-head-controls"]')).toBe(wrapper);
        expect(wrapper.hasAttribute('data-bare')).toBe(false);
        expect(wrapper.querySelector('[data-test="trigger"]')).not.toBeNull();
        filter.trigger = nothing;
        table.requestUpdate();
        await settle(table);
        expect(headCell(table, 'name').querySelector('[data-test="mine"]')).toBe(mine);
        expect(wrapper.hasAttribute('data-bare')).toBe(true);
    });
});
