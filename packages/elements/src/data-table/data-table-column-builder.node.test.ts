import { describe, expect, it } from 'vitest';
import { columnHelper } from './data-table-column-builder.js';

interface Row {
    name: string;
    email: string;
    status: string;
}

describe('columnHelper', () => {
    it('creates accessor columns', () => {
        const columns = columnHelper<Row>().accessor('name', 'Name').accessor('email', 'Email').build();
        expect(columns).toEqual([
            { accessorKey: 'name', header: 'Name' },
            { accessorKey: 'email', header: 'Email' },
        ]);
    });
    it('creates the selection and expander columns pinned left, without sort/hide/reorder', () => {
        for (const [make, key] of [['select', '_selection'], ['expander', '_expander']] as const) {
            const [col] = columnHelper<Row>()[make]().build();
            expect(col).toMatchObject({ accessorKey: key, header: '', pin: 'left', width: '40px', enableSorting: false, enableHiding: false, enableReordering: false });
            expect(col).not.toHaveProperty('sticky');
        }
    });
    it('creates the actions column', () => {
        expect(columnHelper<Row>().actions().build()[0]).toMatchObject({ accessorKey: '_actions', width: '50px', enableReordering: false });
    });
    it('supports accessor options', () => {
        const sortFn = (a: Row, b: Row) => a.name.localeCompare(b.name);
        const [col] = columnHelper<Row>().accessor('name', 'Name', { enableSorting: true, sortFn, width: '200px', pin: 'left' }).build();
        expect(col).toMatchObject({ enableSorting: true, sortFn, width: '200px', pin: 'left' });
    });
    it('supports renderer and component columns', () => {
        const cellRenderer = () => 'x';
        const [r, c] = columnHelper<Row>().renderer('name', 'Name', cellRenderer, { width: '150px' }).component('status', 'Status', 'ge-badge').build();
        expect(r).toMatchObject({ accessorKey: 'name', cellRenderer, width: '150px' });
        expect(c).toMatchObject({ accessorKey: 'status', component: 'ge-badge' });
    });
    it('supports custom columns and chaining', () => {
        const columns = columnHelper<Row>().select().expander().accessor('name', 'Name').custom({ accessorKey: 'x', header: 'X' }).actions().build();
        expect(columns.map((c) => c.accessorKey)).toEqual(['_selection', '_expander', 'name', 'x', '_actions']);
    });
    it('lets options override the defaults of control columns', () => {
        const [col] = columnHelper<Row>().select({ width: '60px', enableHiding: true, pin: 'right' }).build();
        expect(col).toMatchObject({ width: '60px', enableHiding: true, pin: 'right' });
    });
    it('returns a copy of the columns, and a build does not freeze the builder', () => {
        const builder = columnHelper<Row>().accessor('name', 'Name');
        const first = builder.build();
        first.pop();
        expect(builder.build()).toHaveLength(1);
        builder.accessor('email', 'Email');
        expect(builder.build()).toHaveLength(2);
        expect(first).toHaveLength(0);
    });
});
