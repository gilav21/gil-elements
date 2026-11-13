import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddonSet, type DataTableAddon, type DataTableAddonHost, createAddonHost, defineAddon, parseAddonIds, resolveAddonLocale } from './data-table-addon-kit.js';
import { createAddonsService } from './data-table-addon-host-controller.js';
import { resolveAddonLocale as shared } from '../shared/addon-locale.js';
import type { DataTableLocale } from './data-table.locales.js';

afterEach(() => vi.restoreAllMocks());

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
        // a record keyed with a mixed-case id is found by that id
        const regional = { en: { hello: 'Hello' }, 'pt-BR': { hello: 'Oi' }, pt: { hello: 'Ola' } };
        expect(resolveAddonLocale(regional, { resolvedLocale: { code: 'pt-BR' } }).hello).toBe('Oi');
        expect(resolveAddonLocale(regional, { resolvedLocale: { code: 'pt-PT' } }).hello).toBe('Ola');
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
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const set = new AddonSet(host, made);
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

it('warns once per TABLE (set) and id, though two tables share one registry: each table with the same typo warns for itself', () => {
        const { host } = fakeHost();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const registry = new Map<string, DataTableAddon>();
        const first = new AddonSet(host, registry);
        const second = new AddonSet(host, registry);
        for (const set of [first, second]) {
            set.start();
            set.configure('typo', {});
            set.sync();
        }
        expect(warn.mock.calls.filter((call) => String(call[0]).includes('unknown addon "typo"'))).toHaveLength(2);
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

describe('AddonSet: exposed APIs (wave 7)', () => {
    it('files what an addon exposes under its id, replaces it on a re-expose, and drops it at the teardown', () => {
        const { host } = fakeHost();
        const set = new AddonSet(host, new Map());
        set.start();
        const off = set.use({ id: 'export', setup: (h) => h.expose({ version: 1 }) });
        expect(set.api<{ version: number }>('export')).toEqual({ version: 1 });
        expect(set.api('pivot')).toBeUndefined();
        off();
        expect(set.api('export')).toBeUndefined();
    });

    it('keeps one API per addon (each gets a host of its own) and ignores an expose after the teardown', () => {
        const { host } = fakeHost();
        const set = new AddonSet(host, new Map());
        const hosts: DataTableAddonHost[] = [];
        const addon = (id: string): DataTableAddon => ({ id, setup: (h) => (hosts.push(h), h.expose({ id })) });
        set.start();
        set.use(addon('a'));
        set.use(addon('b'));
        expect(set.api('a')).toEqual({ id: 'a' });
        expect(set.api('b')).toEqual({ id: 'b' });
        expect(Object.getPrototypeOf(hosts[0])).toBe(host); // the shared host's members, with its own `expose`
        set.stop();
        hosts[0]!.expose({ late: true });
        expect(set.api('a')).toBeUndefined();
        expect(set.api('b')).toBeUndefined();
    });

    it('drops the API of an addon restarted with new options until it exposes again', () => {
        const { host } = fakeHost();
        const registry = new Map<string, DataTableAddon>([['x', { id: 'x', setup: (h, options) => (options as { on?: boolean } | undefined)?.on && h.expose({}) }]]);
        const set = new AddonSet(host, registry);
        set.start();
        set.configure('x', { x: { on: true } });
        expect(set.api('x')).toBeDefined();
        set.configure('x', { x: { on: false } });
        expect(set.api('x')).toBeUndefined();
    });
});

describe('AddonSet: which addon object runs (review)', () => {
    it('restarts an id when use() overrides it with another addon object, with equal options', () => {
        const { set, log } = (() => {
            const { host } = fakeHost();
            return { set: new AddonSet(host, new Map()), log: [] as string[] };
        })();
        const make = (name: string): DataTableAddon => ({ id: 'x', setup: () => (log.push(`start ${name}`), () => log.push(`stop ${name}`)) });
        set.start();
        set.use(make('a'));
        set.use(make('b'));
        expect(log).toEqual(['start a', 'stop a', 'start b']);
    });

    it('restarts an id whose registry entry was replaced, at the next sync', () => {
        const { host } = fakeHost();
        const log: string[] = [];
        const make = (name: string): DataTableAddon => ({ id: 'x', setup: () => (log.push(`start ${name}`), () => log.push(`stop ${name}`)) });
        const registry = new Map([['x', make('old')]]);
        const set = new AddonSet(host, registry);
        set.start();
        set.configure('x', {});
        registry.set('x', make('new'));
        set.sync();
        expect(log).toEqual(['start old', 'stop old', 'start new']);
    });

    it("the remover of an overridden use() leaves the addon that replaced it running", () => {
        const { host } = fakeHost();
        const log: string[] = [];
        const make = (name: string): DataTableAddon => ({ id: 'x', setup: () => (log.push(`start ${name}`), () => log.push(`stop ${name}`)) });
        const set = new AddonSet(host, new Map());
        set.start();
        const offA = set.use(make('a'));
        set.use(make('b'));
        log.length = 0;
        offA();
        expect(log).toEqual([]);
    });

    it('clears the busy label of an addon at its teardown, through the busy port', () => {
        const { host } = fakeHost();
        const busy: [string, string | null][] = [];
        const set = new AddonSet(host, new Map(), (owner, label) => busy.push([owner, label]));
        set.start();
        const off = set.use({ id: 'export', setup: (h) => h.setBusy('Exporting') });
        off();
        expect(busy).toEqual([['export', 'Exporting'], ['export', null]]);
    });
});

describe('AddonSet: final review', () => {
    it('keeps a use()d addon over the registry addon of the same id, also when the registry entry arrives later', () => {
        const { host } = fakeHost();
        const log: string[] = [];
        const make = (name: string): DataTableAddon => ({ id: 'export', setup: () => (log.push(`start ${name}`), () => log.push(`stop ${name}`)) });
        const registry = new Map<string, DataTableAddon>();
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const set = new AddonSet(host, registry);
        set.start();
        set.use(make('mine'));
        set.configure('export', {});
        registry.set('export', make('registry'));
        set.sync();
        expect(log).toEqual(['start mine']);
    });

    it('the remover of a use() replaced by a use() of the same addon object (new options) leaves the new one running (final review 4)', () => {
        const { host } = fakeHost();
        const log: string[] = [];
        const addon: DataTableAddon = { id: 'x', setup: (_h, options) => (log.push(`start ${JSON.stringify(options)}`), () => log.push('stop')) };
        const set = new AddonSet(host, new Map());
        set.start();
        const first = set.use(addon, { v: 1 });
        set.use(addon, { v: 2 });
        log.length = 0;
        first();
        expect(log).toEqual([]);
    });

    it('after the teardown, the addon host announces, renders and provides nothing', () => {
        const announce = vi.fn();
        const requestRender = vi.fn();
        const service = createAddonsService<unknown>(() => {});
        const base = createAddonHost<unknown>({
            root: {} as HTMLElement,
            resolvedLocale: () => ({ code: 'en' }) as DataTableLocale,
            emit: vi.fn(),
            announce,
            requestRender,
            subscribe: () => () => {},
            provider: () => ({}) as never,
            addons: () => service,
        });
        const set = new AddonSet(base, new Map());
        let kept: DataTableAddonHost | undefined;
        set.start();
        const off = set.use({ id: 'a', setup: (h) => void (kept = h) });
        expect(kept!.provider('query')).toBeDefined();
        off();
        kept!.announce('late');
        kept!.requestRender();
        expect(announce).not.toHaveBeenCalled();
        expect(requestRender).not.toHaveBeenCalled();
        expect(kept!.provider('query')).toBeUndefined();
    });
});

describe('AddonSet: an addon that throws', () => {
    const boom = (): never => {
        throw new Error('boom');
    };

    it('reports a throwing setup once, starts the other addons, does not retry it on a sync, and publishes no API from it', () => {
        const { host } = fakeHost();
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const set = new AddonSet(host, new Map());
        set.start();
        set.use({ id: 'bad', setup: (h) => (h.expose({}), boom()) });
        const good = vi.fn();
        set.use({ id: 'good', setup: good });
        set.sync();
        expect(good).toHaveBeenCalledTimes(1);
        expect(set.api('bad')).toBeUndefined();
        expect(error).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0]![0])).toContain('addon "bad" threw in setup');
        expect(() => set.stop()).not.toThrow();
    });

    it('reports a throwing teardown and still tears the other addons down', () => {
        const { host } = fakeHost();
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const set = new AddonSet(host, new Map());
        const stopped = vi.fn();
        set.start();
        set.use({ id: 'bad', setup: () => boom });
        set.use({ id: 'good', setup: () => stopped });
        expect(() => set.stop()).not.toThrow();
        expect(stopped).toHaveBeenCalledTimes(1);
        expect(String(error.mock.calls[0]![0])).toContain('addon "bad" threw in teardown');
    });

    it("catches a throwing topic listener (defineAddon's locale re-run), so the table's update goes on", () => {
        const { host, relocale } = fakeHost();
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const set = new AddonSet(host, new Map());
        let runs = 0;
        set.start();
        set.use(defineAddon('flaky', () => void (++runs > 1 && boom())));
        expect(() => relocale()).not.toThrow();
        expect(runs).toBe(2);
        expect(String(error.mock.calls[0]![0])).toContain("addon \"flaky\" threw in a 'locale' listener");
    });
});

describe('createAddonHost', () => {
    function build() {
        const service = createAddonsService<unknown>(() => {});
        const locale = { code: 'en' } as DataTableLocale;
        const root = {} as HTMLElement;
        const emit = vi.fn();
        const announce = vi.fn();
        const requestRender = vi.fn();
        const host = createAddonHost<unknown>({ root, resolvedLocale: () => locale, emit, announce, requestRender, subscribe: () => () => {}, provider: () => undefined, addons: () => service });
        return { host, service, locale, root, emit, announce, requestRender };
    }

    it('exposes only root, registration, busy, events, announcements, locale, subscribe and provider, wired to the addons service', () => {
        const { host, service, locale, root } = build();
        expect(Object.keys(host).sort()).toEqual(['announce', 'emit', 'expose', 'provider', 'registerCellAction', 'registerHeaderAction', 'requestRender', 'resolvedLocale', 'root', 'setBusy', 'subscribe']);

        host.registerCellAction({ id: 'c', onClick: vi.fn() });
        host.registerHeaderAction({ id: 'h', onClick: vi.fn() });
        host.setBusy('Working');
        expect(service.cellActions.slots).toHaveLength(1);
        expect(service.headerActions.slots).toHaveLength(1);
        expect(service.busyLabel()).toBe('Working');
        expect(host.resolvedLocale).toBe(locale);
        expect(host.root).toBe(root);
    });

    it('passes emit, announce and requestRender through to the table', () => {
        const { host, emit, announce, requestRender } = build();
        host.requestRender();
        expect(requestRender).toHaveBeenCalledTimes(1);
        host.emit('row-menu-open', { row: 1 });
        host.emit('export-complete');
        host.announce('Done');
        expect(emit.mock.calls).toEqual([['row-menu-open', { row: 1 }], ['export-complete', undefined]]);
        expect(announce).toHaveBeenCalledWith('Done');
    });

    it('has an inert expose outside an AddonSet (no addon id to file under)', () => {
        expect(() => build().host.expose({})).not.toThrow();
    });
});
