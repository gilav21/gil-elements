/** Wave 7 step 0: the query service additions addons and the AI read (`rawRows`, `rowId`, `applyFilters`, `exportData` with `onlyVisible: false`). */
import { describe, expect, it, vi } from 'vitest';
import type { DataTableCoreHost } from './data-table-host.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import { ModelStore } from './data-table-model.js';
import type { DataTableConfig, QueryService } from './data-table-providers.js';
import { QueryController } from './data-table-query-controller.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    id: string;
    name: string;
    team: string;
    children?: Row[];
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'team', header: 'Team' },
    { accessorKey: 'id', header: 'Id' },
];
const DATA: Row[] = [
    { id: 'r1', name: 'Bo', team: 'x' },
    { id: 'r2', name: 'Al', team: 'y' },
    { id: 'r3', name: 'Cy', team: 'x' },
];

function setup({
    columns = COLUMNS,
    filterDebounce = 0,
    timeout = (fn: () => void) => (fn(), () => undefined),
    server = false,
    data = DATA,
    extra = {},
}: { columns?: ColumnDef<Row>[]; filterDebounce?: number; timeout?: (fn: () => void) => () => void; server?: boolean; data?: Row[]; extra?: Record<string, unknown> } = {}) {
    const events: [string, unknown][] = [];
    const announced: string[] = [];
    const model = new ModelStore<Row>((name, detail) => events.push([name, detail]), { data, paginationState: { pageIndex: 2, pageSize: 1 } });
    const providers = new Map<string, unknown>();
    const config = { columns, filterDebounce, getRowId: (r: Row) => r.id, localSorting: true, localPagination: true, localFiltering: !server, total: server ? 42 : undefined, showPagination: true, ...extra } as unknown as DataTableConfig<Row>;
    // The drawn columns: `team` is hidden and `id` is drawn first (a reorder), so definition order and drawn order differ.
    providers.set('columns', { enhancedColumns: () => [COLUMNS[2], COLUMNS[0]] });
    const host = {
        config,
        model,
        provide: (key: string, p: unknown) => (providers.set(key, p), () => providers.delete(key)),
        provider: (key: string) => providers.get(key),
        topics: { emit: () => undefined },
        emit: (name: string, detail: unknown) => events.push([name, detail]),
        announce: (message: string) => announced.push(message),
        requestRender: () => undefined,
        disposables: { timeout }, // by default announcements (and debounced writes) run at once
        resolvedLocale: DATA_TABLE_LOCALES.en,
    } as unknown as DataTableCoreHost<Row>;
    new QueryController(host).attach();
    return { model, query: providers.get('query') as QueryService<Row>, events, announced };
}

describe('QueryService wave 7 additions', () => {
    it('rawRows is `data` as given (unfiltered, unsorted), and rowId is getRowId', () => {
        const { query, model } = setup();
        model.set('globalFilter', 'Bo');
        model.set('sortState', { column: 'name', direction: 'asc' });
        expect(query.rawRows()).toBe(DATA);
        expect(query.sortedData().map((r) => r.id)).toEqual(['r1']);
        expect(query.rowId(DATA[1] as Row)).toBe('r2');
    });

    it('applyFilters writes both filters in one batch with the page reset, fires one filter-change, and announces the result', () => {
        const { query, model, events, announced } = setup();
        query.applyFilters({ globalFilter: 'Al', columnFilters: { team: 'y' } });
        expect(model.get('globalFilter')).toBe('Al');
        expect(model.get('columnFilters')).toEqual({ team: 'y' });
        expect(model.get('paginationState').pageIndex).toBe(0);
        expect(events.filter(([name]) => name === 'filter-change')).toEqual([['filter-change', 'Al']]);
        expect(events.filter(([name]) => name === 'page-change')).toHaveLength(1);
        expect(announced).toEqual(['1 result found for "Al"']); // a new global text speaks through the global path (final review 5)
    });

    it('applyFilters writes nothing, resets no page and fires nothing for values equal to the current ones (review)', () => {
        const { query, model, events } = setup();
        model.set('globalFilter', 'Al');
        model.set('columnFilters', { team: ['y'] });
        const before = model.get('columnFilters');
        events.length = 0;
        query.applyFilters({ globalFilter: 'Al', columnFilters: { team: ['y'] } });
        expect(model.get('columnFilters')).toBe(before);
        expect(model.get('paginationState').pageIndex).toBe(2);
        expect(events).toEqual([]);
        // only the column part changes: no filter-change (the global text is the same)
        query.applyFilters({ globalFilter: 'Al', columnFilters: { team: ['x'] } });
        expect(events.map(([name]) => name).filter((name) => name === 'filter-change')).toEqual([]);
        expect(model.get('paginationState').pageIndex).toBe(0);
    });

    it('applyFilters with a globalFilter key drops a typed global text still waiting on the debounce, even when the value equals the current one (final review)', () => {
        const queue = new Set<() => void>();
        const timeout = (fn: () => void) => (queue.add(fn), () => void queue.delete(fn));
        const { query, model } = setup({ filterDebounce: 100, timeout });
        query.changeGlobalFilter('Bo'); // waits on the debounce
        query.applyFilters({ globalFilter: '' }); // the caller sets the global filter explicitly ('' is the current text)
        for (const fn of [...queue]) fn();
        expect(model.get('globalFilter')).toBe('');
    });

    it('applyFilters without a globalFilter key keeps a typed global text still waiting on the debounce (final review)', () => {
        const queue = new Set<() => void>();
        const timeout = (fn: () => void) => (queue.add(fn), () => void queue.delete(fn));
        const { query, model } = setup({ filterDebounce: 100, timeout });
        query.changeGlobalFilter('Bo');
        query.applyFilters({ columnFilters: { team: 'x' } });
        for (const fn of [...queue]) fn();
        expect(model.get('globalFilter')).toBe('Bo');
        expect(model.get('columnFilters')).toEqual({ team: 'x' });
    });

    it('exportData with onlyVisible: false draws a duplicated key once, the first column (final review)', () => {
        const { query } = setup({ columns: [...COLUMNS, { accessorKey: 'name', header: 'Name again' }] });
        expect(query.exportData({ onlyVisible: false }, [DATA[0] as Row])[0]).toEqual(['Name', 'Team', 'Id']);
    });

    it('applyFilters announces a new global text like typing it, server mode with total included (final review 5)', () => {
        const typed = setup({ server: true });
        typed.query.changeGlobalFilter('acme');
        const applied = setup({ server: true });
        applied.query.applyFilters({ globalFilter: 'acme' });
        expect(applied.announced).toEqual(typed.announced);
        expect(applied.announced).toEqual(['42 results found for "acme"']);
    });

    it('applyFilters keeps what the spec leaves out', () => {
        const { query, model } = setup();
        model.set('globalFilter', 'keep');
        query.applyFilters({ columnFilters: { team: 'x' } });
        expect(model.get('globalFilter')).toBe('keep');
        query.applyFilters({ globalFilter: '' });
        expect(model.get('columnFilters')).toEqual({ team: 'x' });
        expect(model.get('globalFilter')).toBe('');
    });

    it('exportData draws the visible columns by default and every data column, in definition order, with onlyVisible: false', () => {
        const { query } = setup();
        expect(query.exportData({}, [DATA[0] as Row])).toEqual([['Id', 'Name'], ['r1', 'Bo']]);
        expect(query.exportData({ onlyVisible: false }, [DATA[0] as Row])).toEqual([['Name', 'Team', 'Id'], ['Bo', 'x', 'r1']]);
    });

    it('flatTree is the whole filtered, sorted tree depth-first, collapse and paging ignored, and empty outside tree mode (wave 7 export)', () => {
        const kid = (id: string, team: string): Row => ({ id, name: id, team });
        const tree: Row[] = [
            { id: 'p1', name: 'p1', team: 'x', children: [kid('c12', 'x'), kid('c11', 'x'), kid('c13', 'y')] },
            { id: 'p3', name: 'p3', team: 'x', children: [kid('c31', 'x')] },
            { id: 'p2', name: 'p2', team: 'x' },
        ];
        const extra = {
            enableSubRows: true,
            getChildren: (r: Row) => r.children,
            setChildren: (r: Row, children: Row[]) => ({ ...r, children }),
            subRowFilterMode: 'includeParentOnChildMatch',
            enableSubRowSorting: true,
            subRowDefaultExpanded: false, // everything collapsed, and the page is 1 row long on page 2
        };
        const { query, model } = setup({ data: tree, extra });
        model.set('sortState', { column: 'name', direction: 'asc' });
        model.set('globalFilter', 'x'); // matches team 'x': drops c13
        expect(query.flatTree().map((r) => r.id)).toEqual(['p1', 'c11', 'c12', 'p2', 'p3', 'c31']);
        expect(setup().query.flatTree()).toEqual([]);
    });

    it('exportColumns is the column list exportData draws, visible and all (wave 7 export)', () => {
        const { query } = setup({ columns: [...COLUMNS, { accessorKey: 'name', header: 'Name again' }] });
        for (const options of [{}, { onlyVisible: true }, { onlyVisible: false }]) {
            expect(query.exportColumns(options).map((c) => c.header)).toEqual(query.exportData(options, [])[0]);
        }
        expect(query.exportColumns().map((c) => c.accessorKey)).toEqual(['id', 'name']);
    });

    it('a cell() that throws exports an empty cell, the export carries on, and warns once per table and column (wave 7 export)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const boom = (row: Row): string => {
                if (row.id !== 'r2') throw new Error('boom');
                return 'ok';
            };
            const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', cell: boom }, { accessorKey: 'team', header: 'Team' }];
            const { query } = setup({ columns });
            const table = query.exportData({ onlyVisible: false }, DATA);
            expect(table).toEqual([['Name', 'Team'], ['', 'x'], ['ok', 'y'], ['', 'x']]);
            query.exportData({ onlyVisible: false }, DATA);
            expect(warn).toHaveBeenCalledTimes(1);
            setup({ columns }).query.exportData({ onlyVisible: false }, DATA); // another table warns for itself
            expect(warn).toHaveBeenCalledTimes(2);
        } finally {
            warn.mockRestore();
        }
    });
});
