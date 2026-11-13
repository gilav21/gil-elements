/** Wave 7 step 0: the query service additions addons and the AI read (`rawRows`, `rowId`, `applyFilters`, `exportData` with `onlyVisible: false`). */
import { describe, expect, it } from 'vitest';
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

function setup({ columns = COLUMNS, filterDebounce = 0, timeout = (fn: () => void) => (fn(), () => undefined) }: { columns?: ColumnDef<Row>[]; filterDebounce?: number; timeout?: (fn: () => void) => () => void } = {}) {
    const events: [string, unknown][] = [];
    const announced: string[] = [];
    const model = new ModelStore<Row>((name, detail) => events.push([name, detail]), { data: DATA, paginationState: { pageIndex: 2, pageSize: 1 } });
    const providers = new Map<string, unknown>();
    const config = { columns, filterDebounce, getRowId: (r: Row) => r.id, localSorting: true, localPagination: true, localFiltering: true, showPagination: true } as unknown as DataTableConfig<Row>;
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
        expect(announced).toEqual(['1 row matches the filters']);
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

    it('applyFilters keeps a typed global text still waiting on the debounce when its global text is not written (final review)', () => {
        const queue = new Set<() => void>();
        const timeout = (fn: () => void) => (queue.add(fn), () => void queue.delete(fn));
        const { query, model } = setup({ filterDebounce: 100, timeout });
        query.changeGlobalFilter('Bo'); // waits on the debounce
        query.applyFilters({ globalFilter: '', columnFilters: { team: 'x' } }); // '' is the current text: not written
        for (const fn of [...queue]) fn();
        expect(model.get('globalFilter')).toBe('Bo');
        expect(model.get('columnFilters')).toEqual({ team: 'x' });
    });

    it('exportData with onlyVisible: false draws a duplicated key once, the first column (final review)', () => {
        const { query } = setup({ columns: [...COLUMNS, { accessorKey: 'name', header: 'Name again' }] });
        expect(query.exportData({ onlyVisible: false }, [DATA[0] as Row])[0]).toEqual(['Name', 'Team', 'Id']);
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
});
