import { describe, expect, it, vi } from 'vitest';
import { MODEL_EVENTS, MODEL_KEYS, ModelStore, modelDefaults, type ModelEventName } from './data-table-model.js';

function make(initial: ConstructorParameters<typeof ModelStore<{ id: number }>>[1] = {}) {
    const log: [string, unknown][] = [];
    const store = new ModelStore<{ id: number }>((name, detail) => log.push([name, detail]), initial);
    return { store, log };
}

describe('the model list', () => {
    it('has the 14 Angular model() states, each with one distinct kebab-case change event', () => {
        expect(MODEL_KEYS).toHaveLength(14);
        expect(Object.keys(MODEL_EVENTS).sort()).toEqual([...MODEL_KEYS].sort());
        const events = Object.values(MODEL_EVENTS) as ModelEventName[];
        expect(new Set(events).size).toBe(14);
        for (const name of events) expect(name).toMatch(/^[a-z]+(-[a-z]+)*-change$/);
    });

    it('starts from defaults that are never shared between stores', () => {
        const a = modelDefaults<number>();
        const b = modelDefaults<number>();
        expect(a).toEqual(b);
        expect(a.rowSelection).not.toBe(b.rowSelection);
        expect(a.paginationState).toEqual({ pageIndex: 0, pageSize: 10 });
    });
});

describe('uncontrolled use: the table changes a state', () => {
    it('holds the new value and fires the typed event', () => {
        const { store, log } = make();
        const sort = { column: 'name', direction: 'asc' as const };
        store.set('sortState', sort);

        expect(store.get('sortState')).toBe(sort);
        expect(log).toEqual([['sort-state-change', sort]]);
    });

    it('fires for every change even with nobody subscribed, and not for an identical value', () => {
        const { store, log } = make();
        const filters = { a: 1 };
        store.set('columnFilters', filters);
        store.set('columnFilters', filters);
        store.set('globalFilter', '');
        expect(log).toHaveLength(1);
    });
});

describe('property writes: the consumer changes a state', () => {
    it('replace the value silently, and later reads see it', () => {
        const { store, log } = make();
        store.assign('globalFilter', 'abc');
        expect(store.get('globalFilter')).toBe('abc');
        expect(log).toEqual([]);
    });

    it('still notify subscribers, saying where the change came from', () => {
        const { store } = make();
        const seen = vi.fn();
        store.subscribe('globalFilter', seen);
        store.assign('globalFilter', 'x');
        store.set('globalFilter', 'y');
        expect(seen.mock.calls).toEqual([['x', 'property'], ['y', 'internal']]);
    });

    it('win over an internal change made earlier in the same batch, which then announces nothing', () => {
        const { store, log } = make();
        store.batch(() => {
            store.set('globalFilter', 'table');
            store.assign('globalFilter', 'consumer');
        });
        expect(store.get('globalFilter')).toBe('consumer');
        expect(log).toEqual([]);
    });

    it('lose to nothing: an internal change after a property write is announced with the final value', () => {
        const { store, log } = make();
        store.batch(() => {
            store.assign('globalFilter', 'consumer');
            store.set('globalFilter', 'table');
        });
        expect(log).toEqual([['global-filter-change', 'table']]);
    });
});

describe('batching', () => {
    it('flushes once at the end: one event per changed state in the fixed order, then one onFlush', () => {
        const { store, log } = make();
        const flushed = vi.fn(() => log.push(['flush', null]));
        store.onFlush(flushed);
        store.batch(() => {
            store.set('paginationState', { pageIndex: 2, pageSize: 10 });
            store.set('globalFilter', 'q');
            store.set('sortState', { column: 'a', direction: 'desc' });
            expect(log).toEqual([]);
        });
        expect(log.map(([name]) => name)).toEqual(['global-filter-change', 'sort-state-change', 'pagination-state-change', 'flush']);
        expect(flushed).toHaveBeenCalledTimes(1);
    });

    it('stays silent for a state that ended where it began', () => {
        const { store, log } = make();
        const original = store.get('globalFilter');
        store.batch(() => {
            store.set('globalFilter', 'tmp');
            store.set('globalFilter', original);
        });
        expect(log).toEqual([]);
    });

    it('lets nested batches join the outer one', () => {
        const { store, log } = make();
        store.batch(() => {
            store.batch(() => store.set('globalFilter', 'a'));
            expect(log).toEqual([]);
            store.set('columnOrder', ['x']);
        });
        expect(log).toHaveLength(2);
    });

    it('flushes even if the batch throws', () => {
        const { store, log } = make();
        expect(() =>
            store.batch(() => {
                store.set('globalFilter', 'a');
                throw new Error('boom');
            }),
        ).toThrow('boom');
        expect(log).toHaveLength(1);
    });

    it('applies a patch as one batch, skipping undefined entries', () => {
        const { store, log } = make();
        const onFlush = vi.fn();
        store.onFlush(onFlush);
        store.apply({ globalFilter: 'q', columnFilters: { a: 1 }, advancedFilter: null, sortState: undefined, paginationState: { pageIndex: 3, pageSize: 5 } });

        expect(log.map(([name]) => name)).toEqual(['global-filter-change', 'column-filters-change', 'pagination-state-change']);
        expect(onFlush).toHaveBeenCalledTimes(1);
        expect(store.get('paginationState').pageIndex).toBe(3);
    });

    it('does not call onFlush for a patch that changes nothing', () => {
        const { store } = make();
        const onFlush = vi.fn();
        store.onFlush(onFlush);
        store.apply({ globalFilter: '' });
        expect(onFlush).not.toHaveBeenCalled();
    });

    it('lets a subscriber write again from inside a flush', () => {
        const { store, log } = make();
        store.subscribe('globalFilter', () => store.set('paginationState', { pageIndex: 0, pageSize: 10 }));
        store.set('paginationState', { pageIndex: 4, pageSize: 10 });
        log.length = 0;
        store.set('globalFilter', 'q');
        expect(log.map(([name]) => name)).toEqual(['global-filter-change', 'pagination-state-change']);
    });
});

describe('typed access', () => {
  it('prop() is a view of one state', () => {
        const { store, log } = make({ data: [{ id: 1 }] });
        const data = store.prop('data');
        const next = [{ id: 2 }];
        data.set(next);
        expect(data.get()).toBe(next);
        expect(log).toEqual([['data-change', next]]);
    });

    it('stops notifying after unsubscribe', () => {
        const { store } = make();
        const fn = vi.fn();
        const off = store.subscribe('globalFilter', fn);
        off();
        store.set('globalFilter', 'x');
        expect(fn).not.toHaveBeenCalled();
    });
});
