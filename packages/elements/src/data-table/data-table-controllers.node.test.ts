import { describe, expect, it } from 'vitest';
import { type DataTableControllerFactory, assembleControllers } from './data-table-controllers.js';
import { DEFAULT_ORDER, type ControllerId, type ControllerSpec } from './data-table-registry.js';
import type { DataTableCoreHost } from './data-table-host.js';

const host = {} as DataTableCoreHost;

function recorder() {
    const log: string[] = [];
    const factory =
        (id: string, fail = false): DataTableControllerFactory =>
        () => ({
            attach: () => log.push(`attach ${id}`),
            detach: () => {
                log.push(`detach ${id}`);
                if (fail) throw new Error(`${id} failed`);
            },
        });
    return { log, factory };
}

describe('assembleControllers', () => {
    it('builds in plan order, attaches forward and detaches in reverse', () => {
        const { log, factory } = recorder();
        const set = assembleControllers(host, { query: factory('query'), columns: factory('columns'), loading: factory('loading') });
        expect(set.controllers).toHaveLength(3);

        set.attachAll();
        set.detachAll();
        expect(log).toEqual(['attach columns', 'attach query', 'attach loading', 'detach loading', 'detach query', 'detach columns']);
    });

    it('builds nothing for an empty factory list', () => {
        expect(assembleControllers(host, {}).controllers).toEqual([]);
    });

    it('gives every factory the host', () => {
        const seen: unknown[] = [];
        assembleControllers(host, { columns: (h) => (seen.push(h), { attach() {}, detach() {} }) });
        expect(seen).toEqual([host]);
    });

    it('fails with a message when a built controller needs a service whose controller has no factory yet', () => {
        const { factory } = recorder();
        expect(() => assembleControllers(host, { query: factory('query') })).toThrow(/'query' needs 'columns'/);
    });

    it('lets a lazily used service be absent while a wave is only partly built', () => {
        const { factory } = recorder();
        expect(() => assembleControllers(host, { columns: factory('columns'), query: factory('query'), footer: factory('footer') })).not.toThrow();
    });

    it('detaches every controller even if one throws, then rethrows the first error', () => {
        const { log, factory } = recorder();
        const set = assembleControllers(host, { columns: factory('columns'), query: factory('query', true), loading: factory('loading', true) });
        set.attachAll();
        expect(() => set.detachAll()).toThrow('loading failed');
        expect(log.filter((l) => l.startsWith('detach'))).toEqual(['detach loading', 'detach query', 'detach columns']);
    });

    it('accepts the whole default plan with a factory per controller', () => {
        const { factory } = recorder();
        const all = Object.fromEntries(DEFAULT_ORDER.map((s) => [s.id, factory(s.id)])) as Record<ControllerId, DataTableControllerFactory>;
        expect(assembleControllers(host, all).controllers).toHaveLength(DEFAULT_ORDER.length);
    });

    it('takes a custom plan', () => {
        const { log, factory } = recorder();
        const plan = [{ id: 'columns', provides: [], needs: [], uses: [], reads: [], writes: [] }] as ControllerSpec[];
        assembleControllers(host, { columns: factory('columns'), query: factory('query') }, plan).attachAll();
        expect(log).toEqual(['attach columns']);
    });
});

describe('AssembledControllers.service', () => {
    it('answers a service a controller exposes through `services`, resolving the owner of each key once at assembly (one read of each services field), and undefined when none has it', () => {
        let reads = 0;
        const range = { range: () => null } as never;
        const withServices = (): DataTableControllerFactory => () => ({
            attach() {},
            detach() {},
            get services() {
                reads++;
                return { range };
            },
        });
        const plain = (): DataTableControllerFactory => () => ({ attach() {}, detach() {} });
        const set = assembleControllers(host, { columns: plain(), 'cell-interaction': withServices() as never, query: plain() }, [
            { id: 'columns', provides: [], needs: [], uses: [], reads: [], writes: [] },
            { id: 'cell-interaction', provides: [], needs: [], uses: [], reads: [], writes: [] },
            { id: 'query', provides: [], needs: [], uses: [], reads: [], writes: [] },
        ] as ControllerSpec[]);
        expect(set.service('range')).toBe(range);
        expect(reads).toBe(2); // once at assembly (the key owners), once for the lookup
        expect(set.service('clipboard')).toBeUndefined();
        expect(assembleControllers(host, {}).service('range')).toBeUndefined();
    });
});
