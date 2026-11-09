import { describe, expect, it, vi } from 'vitest';
import { AriaController } from './data-table-aria-controller.js';
import { ColumnsController } from './data-table-columns-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { ModelStore } from './data-table-model.js';
import type { ColumnsService } from './data-table-providers.js';
import { Disposables, TopicBus } from './data-table-registry.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    id: string;
}
const columns: ColumnDef<Row>[] = ['a', 'b', 'c'].map((key) => ({ accessorKey: key as keyof Row & string, header: key.toUpperCase(), width: '100px' }));

function setup() {
    const events: string[] = [];
    const store = new ModelStore<Row>((name) => events.push(name));
    const provided = new Map<string, unknown>();
    const announced: string[] = [];
    const disposables = new Disposables();
    const host = {
        config: { columns, enableRowSelection: false, enableRowExpansion: false, enableSubRows: false, getRowId: (row: Row) => row.id },
        model: store,
        root: {},
        provide: (key: string, value: unknown) => (provided.set(key, value), () => provided.delete(key)),
        provider: (key: string) => provided.get(key),
        topics: new TopicBus(),
        requestRender: vi.fn(),
        afterRender: vi.fn(),
        announce: (message: string) => announced.push(message),
        resolvedLocale: DATA_TABLE_LOCALES.en,
        disposables,
    } as unknown as DataTableCoreHost<Row>;
    const controller = new ColumnsController<Row>(host);
    controller.attach();
    return { host, store, events, announced, disposables, provided, service: provided.get('columns') as ColumnsService<Row> };
}

const keys = (service: ColumnsService<Row>): string[] => service.enhancedColumns().map((c) => String(c.accessorKey));

describe('the columns service', () => {
    it('shows a live width in the layout and drops it when the drag ends', () => {
        const { service } = setup();
        service.liveWidth('b', 130);
        expect(service.enhancedColumns().find((c) => c.accessorKey === 'b')?._width).toBe('130px');
        service.liveWidth('b', null);
        expect(service.enhancedColumns().find((c) => c.accessorKey === 'b')?._width).toBe('100px');
    });

    it('moves a column to a bounded position and writes only the order', () => {
        const { service, events, store } = setup();
        service.move('a', 5);
        expect(store.get('columnOrder')).toEqual(['b', 'c', 'a']);
        expect(keys(service)).toEqual(['b', 'c', 'a']);
        service.move('a', 0);
        service.move('missing', 0);
        service.move('a', 0);
        expect(keys(service)).toEqual(['a', 'b', 'c']);
        expect(events).toEqual(['column-order-change', 'column-order-change']);
    });

    it('refuses to hide the last visible data column', () => {
        const { service, store, host } = setup();
        service.setVisible('a', false);
        service.setVisible('b', false);
        expect(keys(service)).toEqual(['c']);
        service.setVisible('c', false);
        expect(store.get('columnVisibility')).toEqual({ a: false, b: false });
        expect(host.afterRender).toHaveBeenCalledTimes(1);
        service.showAll();
        expect(keys(service)).toEqual(['a', 'b', 'c']);
    });

    it('applies column state in one flush and ignores a state that changes nothing', () => {
        const { service, events, store, host } = setup();
        service.applyState([
            { columnKey: 'a', width: '80px', order: 1, visible: true },
            { columnKey: 'b', visible: false, order: 0 },
            { columnKey: 'c', order: 2, pin: 'left' },
        ]);
        expect(events).toEqual(['column-widths-change', 'column-visibility-change', 'column-order-change']);
        expect(store.get('columnOrder')).toEqual(['b', 'a', 'c']);
        expect(keys(service)).toEqual(['c', 'a']);
        expect(host.requestRender).toHaveBeenCalled();
        // A snapshot writes the declared widths and visibility it carries once; from then on it changes nothing.
        service.applyState(service.getState());
        events.length = 0;
        service.applyState(service.getState());
        service.applyState([]);
        service.applyState(null);
        expect(events).toEqual([]);
    });

    it('reads a view, restores it in one batch, and refuses a token it cannot read', () => {
        const { service, store, events } = setup();
        store.set('sortState', { column: 'b', direction: 'desc' });
        store.set('globalFilter', 'x');
        store.set('paginationState', { pageIndex: 2, pageSize: 5 });
        const token = JSON.parse(JSON.stringify(service.getViewState()));
        const other = setup();
        expect(other.service.applyViewState(token)).toBe(true);
        expect(other.store.get('sortState')).toEqual({ column: 'b', direction: 'desc' });
        expect(other.store.get('paginationState')).toEqual({ pageIndex: 2, pageSize: 5 });
        expect(other.events.at(-1)).toBe('pagination-state-change');
        const before = JSON.stringify(other.service.getViewState());
        other.events.length = 0;
        expect(other.service.applyViewState({ ...token, version: 7 })).toBe(false);
        expect(other.service.applyViewState({ ...token, pagination: { pageIndex: 'x', pageSize: 5 } })).toBe(false);
        expect(other.service.applyViewState(undefined)).toBe(false);
        expect(JSON.stringify(other.service.getViewState())).toBe(before);
        expect(other.events).toEqual([]);
        expect(events.length).toBeGreaterThan(0);
    });
});

describe('the aria controller', () => {
    function withAria(rows: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]) {
        const ctx = setup();
        ctx.store.assign('data', rows);
        ctx.provided.set('query', { totalItems: () => 25, treeIndex: () => ({ nodes: new Map() }) });
        const aria = new AriaController<Row>(ctx.host);
        aria.attach();
        return { ...ctx, aria };
    }

    it('says the selection once after it settles, counting only rows that exist', () => {
        vi.useFakeTimers();
        const { store, announced, aria } = withAria();
        store.set('rowSelection', { a: true });
        vi.advanceTimersByTime(400);
        store.set('rowSelection', { a: true, b: true, gone: true });
        vi.advanceTimersByTime(499);
        expect(announced).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(announced).toEqual(['2 rows selected']);
        store.set('rowSelection', { a: true, b: false });
        vi.advanceTimersByTime(500);
        store.set('rowSelection', {});
        vi.advanceTimersByTime(500);
        expect(announced).toEqual(['2 rows selected', '1 row selected', 'Selection cleared']);
        aria.detach();
        vi.useRealTimers();
    });

    it('cancels a pending selection announcement with the element, and ignores a consumer write', () => {
        vi.useFakeTimers();
        const { store, announced, disposables } = withAria();
        store.assign('rowSelection', { a: true });
        vi.advanceTimersByTime(1000);
        store.set('rowSelection', { a: true });
        disposables.dispose();
        vi.advanceTimersByTime(1000);
        expect(announced).toEqual([]);
        vi.useRealTimers();
    });

    it('says a page change, but not one a sort or a filter caused', () => {
        const { store, announced } = withAria();
        store.set('paginationState', { pageIndex: 1, pageSize: 10 });
        store.set('paginationState', { pageIndex: 1, pageSize: 5 });
        store.assign('paginationState', { pageIndex: 3, pageSize: 5 });
        store.set('paginationState', { pageIndex: 0, pageSize: 5 });
        expect(announced).toEqual(['Page 2 of 3', 'Page 1 of 5']);
        store.batch(() => {
            store.set('paginationState', { pageIndex: 2, pageSize: 5 });
        });
        announced.length = 0;
        store.batch(() => {
            store.set('sortState', { column: 'a', direction: 'asc' });
            store.set('paginationState', { pageIndex: 0, pageSize: 5 });
        });
        expect(announced).toEqual([]);
        store.set('paginationState', { pageIndex: 1, pageSize: 5 });
        expect(announced).toEqual(['Page 2 of 5']);
    });
});
