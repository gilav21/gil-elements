import { describe, expect, it, vi } from 'vitest';
import { AddonSet, type DataTableAddon, type DataTableAddonHost, createAddonHost, defineAddon, parseAddonIds, resolveAddonLocale } from './data-table-addon-kit.js';
import { createAddonsService } from './data-table-registry.js';
import { resolveAddonLocale as shared } from '../shared/addon-locale.js';
import type { DataTableLocale } from './data-table.locales.js';

function fakeHost() {
    const listeners = new Set<() => void>();
    const host = {
        subscribe: (topic: string, fn: () => void) => {
            if (topic === 'locale') listeners.add(fn);
            return () => listeners.delete(fn);
        },
    } as unknown as DataTableAddonHost;
    return { host, relocale: () => [...listeners].forEach((fn) => fn()), listeners };
}

describe('resolveAddonLocale', () => {
    it('is the one shared with the rich-text editor, and follows the table locale code', () => {
        expect(resolveAddonLocale).toBe(shared);
        const table = { en: { hello: 'Hello' }, de: { hello: 'Hallo' } };
        expect(resolveAddonLocale(table, { resolvedLocale: { code: 'de' } }).hello).toBe('Hallo');
        expect(resolveAddonLocale(table, { resolvedLocale: { code: 'fr' } }).hello).toBe('Hello');
        // case and region are ignored as in the table that hosts the addon
        expect(resolveAddonLocale(table, { resolvedLocale: { code: 'de-DE' } }).hello).toBe('Hallo');
        expect(resolveAddonLocale(table, { resolvedLocale: { code: 'en' } }, 'DE').hello).toBe('Hallo');
    });
});

describe('defineAddon', () => {
    it('names the addon and hands create its options with enabled filled in', () => {
        const create = vi.fn();
        const addon = defineAddon<{ formats?: string[] }>('export', create);
        addon.setup(fakeHost().host, { formats: ['csv'] });

        expect(addon.id).toBe('export');
        expect(create.mock.calls[0]![0].options).toEqual({ enabled: true, formats: ['csv'] });
    });

    it.each([undefined, '', true])('enables with defaults for %j', (setting) => {
        const create = vi.fn();
        defineAddon('export', create).setup(fakeHost().host, setting);
        expect(create.mock.calls[0]![0].options).toEqual({ enabled: true });
    });

    it('does nothing when switched off', () => {
        const create = vi.fn();
        const { host, listeners } = fakeHost();
        expect(defineAddon('export', create).setup(host, false)).toBeUndefined();
        expect(create).not.toHaveBeenCalled();
        expect(listeners.size).toBe(0);
    });

    it('runs again on a locale change after releasing the previous run, and releases everything on teardown', () => {
        const log: string[] = [];
        let run = 0;
        const addon = defineAddon('export', ({ life }) => {
            const mine = ++run;
            log.push(`create ${mine}`);
            life.add(() => log.push(`release ${mine}`));
            return () => log.push(`teardown ${mine}`);
        });
        const { host, relocale, listeners } = fakeHost();
        const teardown = addon.setup(host, undefined) as () => void;

        relocale();
        expect(log).toEqual(['create 1', 'teardown 1', 'release 1', 'create 2']);
        teardown();
        expect(log.slice(4)).toEqual(['teardown 2', 'release 2']);
        expect(listeners.size).toBe(0);
    });
});

describe('parseAddonIds', () => {
    it('splits on spaces and commas and drops repeats', () => {
        expect(parseAddonIds(' context-menu,export  export ')).toEqual(['context-menu', 'export']);
        expect(parseAddonIds('')).toEqual([]);
    });
});

describe('AddonSet', () => {
    function setup() {
        const { host } = fakeHost();
        const log: string[] = [];
        const made = new Map<string, DataTableAddon>();
        const addon = (id: string, covers?: string[]): DataTableAddon => {
            const a: DataTableAddon = {
                id,
                covers,
                setup: (_h, options) => {
                    log.push(`start ${id} ${JSON.stringify(options)}`);
                    return () => log.push(`stop ${id}`);
                },
            };
            made.set(id, a);
            return a;
        };
        const warn = vi.fn();
        const set = new AddonSet(host, made, warn);
        return { set, addon, log, warn };
    }

    it('starts nothing before start(), then starts the listed addons with their options', () => {
        const { set, addon, log } = setup();
        addon('export');
        set.configure('export', { export: { formats: ['csv'] } });
        expect(log).toEqual([]);
        set.start();
        expect(log).toEqual(['start export {"formats":["csv"]}']);
    });

    it('warns about an unknown id, and starts it once its module registers', () => {
        const { set, addon, log, warn } = setup();
        set.start();
        set.configure('later', {});
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown addon "later"'));
        addon('later');
        set.sync();
        expect(log).toEqual(['start later undefined']);
    });

    it('restarts an addon whose options changed, and stops one removed from the attribute', () => {
        const { set, addon, log } = setup();
        addon('a');
        addon('b');
        set.start();
        set.configure('a b', { a: 1 });
        set.configure('a b', { a: 2 });
        set.configure('a', { a: 2 });
        expect(log).toEqual(['start a 1', 'start b undefined', 'stop a', 'start a 2', 'stop b']);
    });

    it('does not restart an addon whose options kept their identity', () => {
        const { set, addon, log } = setup();
        addon('a');
        set.start();
        const options = { a: { x: 1 } };
        set.configure('a', options);
        set.configure('a', options);
        expect(log).toHaveLength(1);
    });

    it('use() adds an addon without the attribute, with options, and its teardown removes it', () => {
        const { set, log } = setup();
        set.start();
        const off = set.use({ id: 'u', setup: () => () => log.push('stop u') }, { y: 1 });
        off();
        expect(log).toEqual(['stop u']);
    });

    it('lets an enabled bundle stand in for the ids it covers, and a disabled one not', () => {
        const { set, addon, log } = setup();
        addon('a');
        addon('b');
        addon('full', ['a', 'b']);
        set.start();
        set.configure('a b full', {});
        expect(log).toEqual(['start full {}']);

        log.length = 0;
        set.configure('a b full', { full: false });
        expect(log).toEqual(['stop full', 'start a undefined', 'start b undefined']);
    });

    it('does not re-run setup or teardown when re-configured with equal options, even freshly built ones', () => {
        const { set, addon, log } = setup();
        addon('a');
        set.start();
        set.configure('a', { a: { formats: ['csv'] } });
        set.configure('a', { a: { formats: ['csv'] } });
        set.use({ id: 'u', setup: () => undefined });
        expect(log).toEqual(['start a {"formats":["csv"]}']);
    });

    it('keeps an enabled bundle running across configure() and use()', () => {
        const { set, addon, log } = setup();
        addon('a');
        addon('full', ['a']);
        set.start();
        set.configure('full', { full: { x: 1 } });
        set.configure('full', { full: { x: 1 } });
        const off = set.use({ id: 'other', setup: () => undefined });
        off();
        expect(log).toEqual(['start full {"full":{"x":1}}']);
    });

    it('warns once per unknown id however often it syncs', () => {
        const { set, warn } = setup();
        set.start();
        set.configure('nope', {});
        set.configure('nope', { nope: true });
        set.sync();
        set.sync();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('stop() tears everything down', () => {
        const { set, addon, log } = setup();
        addon('a');
        set.start();
        set.configure('a', {});
        set.stop();
        expect(log).toEqual(['start a undefined', 'stop a']);
    });
});

describe('createAddonHost', () => {
    it('exposes only registration, busy, locale, subscribe and provider, wired to the addons service', () => {
        const service = createAddonsService<unknown>(() => {});
        const locale = { code: 'en' } as DataTableLocale;
        const host = createAddonHost<unknown>({
            resolvedLocale: () => locale,
            subscribe: () => () => {},
            provider: () => undefined,
            addons: () => service,
        });
        expect(Object.keys(host).sort()).toEqual(['provider', 'registerCellAction', 'registerHeaderAction', 'resolvedLocale', 'setBusy', 'subscribe']);

        host.registerCellAction({ id: 'c', onClick: vi.fn() });
        host.registerHeaderAction({ id: 'h', onClick: vi.fn() });
        host.setBusy('Working');
        expect(service.cellActions.slots).toHaveLength(1);
        expect(service.headerActions.slots).toHaveLength(1);
        expect(service.busyLabel()).toBe('Working');
        expect(host.resolvedLocale).toBe(locale);
    });
});
