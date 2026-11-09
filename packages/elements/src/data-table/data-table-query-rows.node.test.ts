import { describe, expect, it } from 'vitest';
import type { DataTableCoreHost } from './data-table-host.js';
import { ModelStore } from './data-table-model.js';
import type { DataTableConfig, DataTableProviders, QueryService } from './data-table-providers.js';
import { QueryController } from './data-table-query-controller.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    id: string;
    name: string;
    team?: string;
    n?: number;
    children?: Row[];
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name', enableFiltering: true },
    { accessorKey: 'n', header: 'N', aggregateFn: 'sum' },
];

function setup(config: Partial<DataTableConfig<Row>>, data: Row[]) {
    const model = new ModelStore<Row>(() => undefined, { data });
    const providers = new Map<string, unknown>();
    const full = {
        columns: COLUMNS,
        getRowId: (r: Row) => r.id,
        getChildren: (r: Row) => r.children,
        setChildren: (r: Row, children: Row[]) => ({ ...r, children }),
        localSorting: true,
        localPagination: true,
        localFiltering: true,
        showPagination: true,
        enableSubRowSorting: true,
        subRowFilterMode: 'includeParentOnChildMatch',
        subRowSelectionMode: 'self',
        groupAggregates: true,
        ...config,
    } as DataTableConfig<Row>;
    const host = {
        config: full,
        model,
        provide: (key: string, p: unknown) => (providers.set(key, p), () => providers.delete(key)),
        provider: (key: string) => providers.get(key),
        topics: { emit: () => undefined },
        emit: () => undefined,
        announce: () => undefined,
        disposables: { timeout: () => () => undefined },
        resolvedLocale: {},
    } as unknown as DataTableCoreHost<Row>;
    const controller = new QueryController(host);
    controller.attach();
    const query = providers.get('query') as DataTableProviders<Row>['query'] & QueryService<Row>;
    return { model, query, controller };
}

const leaf = (id: string, extra: Partial<Row> = {}): Row => ({ id, name: id, ...extra });
const TREE: Row[] = [
    leaf('a', { children: [leaf('a1', { children: [leaf('a1x')] }), leaf('a2')] }),
    leaf('b', { children: [leaf('b1')] }),
    leaf('c'),
];
const ids = (rows: readonly { row: Row }[]) => rows.map((r) => r.row.id);

describe('tree stages', () => {
    it('shows only the roots by default, and the nodes the record or the default depth opens', () => {
        const { query, model } = setup({ enableSubRows: true }, TREE);
        expect(ids(query.treeRows())).toEqual(['a', 'b', 'c']);
        model.set('subRowExpandedRows', { a: true, a1: true });
        expect(ids(query.treeRows())).toEqual(['a', 'a1', 'a1x', 'a2', 'b', 'c']);
        expect(query.treeRows().map((r) => r.depth)).toEqual([0, 1, 2, 1, 0, 0]);
    });

    it('opens every level for -1 (subRowDefaultExpanded) and lets an explicit false win', () => {
        const { query, model } = setup({ enableSubRows: true, subRowDefaultExpanded: true }, TREE);
        expect(query.treeRows()).toHaveLength(7);
        model.set('subRowExpandedRows', { a: false });
        expect(ids(query.treeRows())).toEqual(['a', 'b', 'b1', 'c']);
    });

    it('counts siblings of the filtered tree for aria-setsize and posinset', () => {
        const { query, model } = setup({ enableSubRows: true, subRowDefaultExpanded: true }, TREE);
        model.set('globalFilter', 'a1');
        const rows = query.treeRows();
        expect(rows.map((r) => `${r.row.id}:${r.posInSet}/${r.setSize}`)).toEqual(['a:1/1', 'a1:1/1', 'a1x:1/1']);
    });

    it('filters by mode: excludeChildren tests only the roots and keeps their subtrees', () => {
        const { query, model } = setup({ enableSubRows: true, subRowDefaultExpanded: true, subRowFilterMode: 'excludeChildren' }, TREE);
        model.set('globalFilter', 'a1');
        expect(ids(query.treeRows())).toEqual([]);
        model.set('globalFilter', 'a');
        expect(ids(query.treeRows())).toEqual(['a', 'a1', 'a1x', 'a2']);
    });

    it('pages the roots (children follow their root) or the visible rows (subRowsPaginated)', () => {
        const roots = setup({ enableSubRows: true, subRowDefaultExpanded: true }, TREE);
        roots.model.set('paginationState', { pageIndex: 0, pageSize: 1 });
        expect(ids(roots.query.treeRows())).toEqual(['a', 'a1', 'a1x', 'a2']);
        expect(roots.query.totalItems()).toBe(3);
        expect(roots.query.treeRows()[0]?.setSize).toBe(3);
        roots.model.set('paginationState', { pageIndex: 1, pageSize: 1 });
        expect(ids(roots.query.treeRows())).toEqual(['b', 'b1']);

        const rows = setup({ enableSubRows: true, subRowDefaultExpanded: true, subRowsPaginated: true }, TREE);
        rows.model.set('paginationState', { pageIndex: 1, pageSize: 3 });
        expect(ids(rows.query.treeRows())).toEqual(['a2', 'b', 'b1']);
        expect(rows.query.totalItems()).toBe(7);
        expect(rows.query.visibleTreeRows()).toHaveLength(7);
    });

    it('sorts siblings at every level', () => {
        const { query, model } = setup({ enableSubRows: true, subRowDefaultExpanded: true }, TREE);
        model.set('sortState', { column: 'name', direction: 'desc' });
        expect(ids(query.treeRows())).toEqual(['c', 'b', 'b1', 'a', 'a2', 'a1', 'a1x']);
    });

    it('addresses a tree row by drawn index through renderedRowAt and renderedTreeRowAt', () => {
        const { query } = setup({ enableSubRows: true, subRowDefaultExpanded: true }, TREE);
        expect(query.renderedRowAt(2)?.id).toBe('a1x');
        expect(query.renderedTreeRowAt(2)?.depth).toBe(2);
        expect(query.rowWindowSource()).toBe(query.visibleTreeRows());
    });

    it('does not rerun a stage when only the selection or an unrelated state changes', () => {
        let compares = 0;
        const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', sortFn: (a, b) => (compares++, a.id.localeCompare(b.id)) }];
        const { query, model } = setup({ enableSubRows: true, subRowDefaultExpanded: true, columns }, TREE);
        model.set('sortState', { column: 'name', direction: 'asc' });
        const first = query.treeRows();
        const ran = compares;
        expect(ran).toBeGreaterThan(0);
        model.set('rowSelection', { a: true });
        model.set('columnWidths', { name: '10px' });
        expect(query.treeRows()).toBe(first);
        expect(compares).toBe(ran);
        model.set('subRowExpandedRows', { a: false });
        expect(query.treeRows()).not.toBe(first);
        expect(compares).toBe(ran);
    });

    it('builds the tree index once per data identity, keyed by id', () => {
        const { query, model } = setup({ enableSubRows: true }, TREE);
        const index = query.treeIndex();
        model.set('rowSelection', { a: true });
        expect(query.treeIndex()).toBe(index);
        expect(index.descendants.get('a')).toEqual(['a1', 'a1x', 'a2']);
        expect(index.parent.get('a1x')).toBe('a1');
    });

    it('draws nothing as a tree outside tree mode', () => {
        const { query } = setup({}, TREE);
        expect(query.treeRows()).toEqual([]);
        expect(query.visibleTreeRows()).toEqual([]);
    });
});

const FLAT: Row[] = [
    { id: '1', name: 'one', team: 'x', n: 1 },
    { id: '2', name: 'two', team: 'y', n: 2 },
    { id: '3', name: 'three', team: 'x', n: 3 },
    { id: '4', name: 'four', team: 'z', n: 4 },
    { id: '5', name: 'five', team: 'y', n: 5 },
];
const groupCols: ColumnDef<Row>[] = [{ accessorKey: 'team', header: 'Team' }, ...COLUMNS];

describe('grouping stages', () => {
    const shape = (query: QueryService<Row>) => query.displayRows().map((r) => (r.kind === 'group' ? `[${r.groupKey}:${r.count}]` : `${r.index}:${r.row.id}`));

    it('draws a header per group in insertion order and numbers the data rows as drawn', () => {
        const { query } = setup({ groupBy: 'team', columns: groupCols }, FLAT);
        expect(shape(query)).toEqual(['[x:2]', '0:1', '1:3', '[y:2]', '2:2', '3:5', '[z:1]', '4:4']);
        const header = query.displayRows()[0];
        expect(header?.kind === 'group' && Object.fromEntries(header.aggregates)).toEqual({ n: '4' });
    });

    it('counts headers toward the page size and restarts the numbering on every page', () => {
        const { query, model } = setup({ groupBy: 'team', columns: groupCols }, FLAT);
        model.set('paginationState', { pageIndex: 0, pageSize: 4 });
        expect(shape(query)).toEqual(['[x:2]', '0:1', '1:3', '[y:2]']);
        model.set('paginationState', { pageIndex: 1, pageSize: 4 });
        // A group split across pages is not repeated: the page opens on data rows.
        expect(shape(query)).toEqual(['0:2', '1:5', '[z:1]', '2:4']);
        expect(query.totalItems()).toBe(8);
    });

    it('skips the rows of a collapsed group, on a later page too, and keeps them in groupRows', () => {
        const { query, model } = setup({ groupBy: 'team', columns: groupCols }, FLAT);
        model.set('collapsedGroups', { x: true });
        expect(shape(query)).toEqual(['[x:2]', '[y:2]', '0:2', '1:5', '[z:1]', '2:4']);
        expect(query.groupRows().map((g) => `${g.groupKey}:${g.rows.length}`)).toEqual(['x:2', 'y:2', 'z:1']);
        model.set('paginationState', { pageIndex: 1, pageSize: 3 });
        expect(shape(query)).toEqual(['0:5', '[z:1]', '1:4']);
    });

    it('addresses every drawn row by its rendered index, in every page', () => {
        const { query, model } = setup({ groupBy: 'team', columns: groupCols }, FLAT);
        model.set('collapsedGroups', { y: true });
        for (const page of [{ pageIndex: 0, pageSize: 3 }, { pageIndex: 1, pageSize: 3 }, { pageIndex: 0, pageSize: 100 }]) {
            model.set('paginationState', page);
            for (const item of query.displayRows()) if (item.kind === 'data') expect(query.renderedRowAt(item.index)).toBe(item.row);
            expect(query.renderedRows()).toHaveLength(query.displayRows().filter((r) => r.kind === 'data').length);
        }
    });

    it('treats a group named after an Object member as an ordinary group', () => {
        const rows = [{ id: '1', name: 'a', team: 'constructor' }, { id: '2', name: 'b', team: '__proto__' }];
        const { query, model } = setup({ groupBy: 'team', columns: groupCols }, rows);
        expect(shape(query)).toEqual(['[constructor:1]', '0:1', '[__proto__:1]', '1:2']);
        model.set('collapsedGroups', Object.fromEntries([['__proto__', true]]));
        expect(shape(query)).toEqual(['[constructor:1]', '0:1', '[__proto__:1]']);
    });

    it('is off in tree mode and under virtual scroll, and does not rerun the partition for an unrelated change', () => {
        expect(shape(setup({ groupBy: 'team', columns: groupCols, enableSubRows: true }, FLAT).query).some((s) => s.startsWith('['))).toBe(false);
        const { query, model } = setup({ groupBy: 'team', columns: groupCols }, FLAT);
        const first = query.displayRows();
        model.set('rowSelection', { 1: true });
        expect(query.displayRows()).toBe(first);
        model.set('collapsedGroups', { x: true });
        expect(query.displayRows()).not.toBe(first);
    });
});

describe('the drawn data rows', () => {
    it('are one list per display list, and follow it when it changes', () => {
        const { query, model } = setup({ showPagination: false }, [leaf('a'), leaf('b')]);
        const first = query.renderedRows();
        expect(first.map((r) => r.id)).toEqual(['a', 'b']);
        expect(query.renderedRows()).toBe(first);
        expect(query.renderedRowAt(1)?.id).toBe('b');
        model.set('data', [leaf('c')]);
        expect(query.renderedRows().map((r) => r.id)).toEqual(['c']);
    });
});
