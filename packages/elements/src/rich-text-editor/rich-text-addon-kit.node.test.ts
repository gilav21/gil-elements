import { describe, expect, it, vi } from 'vitest';
import { defineAddon, resolveAddonLocale } from './rich-text-addon-kit.js';
import type { RichTextAddonHost } from './rich-text-host.js';

interface Words {
    readonly hello: string;
    readonly rtl?: boolean;
}

const TABLE = {
    en: { hello: 'Hello' },
    he: { hello: 'שלום', rtl: true },
    ar: { hello: 'مرحبا', rtl: true },
    de: { hello: 'Hallo' },
} satisfies Record<string, Words>;

const hostFor = (code: string) => ({ resolvedLocale: { code } });

describe('resolveAddonLocale', () => {
    it.each([
        ['en', 'Hello'],
        ['de', 'Hallo'],
        ['he', 'שלום'],
        ['ar', 'مرحبا'],
    ])('follows the editor locale %s', (code, hello) => {
        expect(resolveAddonLocale<Words>(TABLE, hostFor(code)).hello).toBe(hello);
    });

    it.each(['he', 'ar'])('keeps the right-to-left flag of %s', (code) => {
        expect(resolveAddonLocale<Words>(TABLE, hostFor(code)).rtl).toBe(true);
        expect(resolveAddonLocale<Words>(TABLE, hostFor('de')).rtl).toBeUndefined();
    });

    it('falls back to English for a language the table does not have', () => {
        expect(resolveAddonLocale<Words>(TABLE, hostFor('fr')).hello).toBe('Hello');
    });

    it('lets a string override pick another entry, falling back to English when it is unknown', () => {
        expect(resolveAddonLocale<Words>(TABLE, hostFor('en'), 'de').hello).toBe('Hallo');
        expect(resolveAddonLocale<Words>(TABLE, hostFor('de'), 'zz').hello).toBe('Hello');
    });

    it('uses an object override as it is', () => {
        const custom = { hello: 'Yo' };
        expect(resolveAddonLocale<Words>(TABLE, hostFor('he'), custom)).toBe(custom);
    });
});

function fakeHost() {
    const listeners = new Set<() => void>();
    const host = {
        subscribe: (topic: string, fn: () => void) => {
            if (topic === 'locale') listeners.add(fn);
            return () => listeners.delete(fn);
        },
    } as unknown as RichTextAddonHost;
    return { host, relocale: () => [...listeners].forEach((fn) => fn()), listeners };
}

describe('defineAddon', () => {
    it('names the addon and fills in the option defaults around the addon-specific fields', () => {
        const create = vi.fn();
        const addon = defineAddon<{ upload?: string }>('demo', 40, create);
        addon.setup(fakeHost().host, { upload: 'x', order: 5 });

        expect(addon.id).toBe('demo');
        expect(create.mock.calls[0]![0].options).toEqual({ enabled: true, toolbar: true, slashCommand: true, order: 5, upload: 'x' });
    });

    it.each([undefined, '', true])('enables with defaults for %j', (setting) => {
        const create = vi.fn();
        defineAddon('demo', 40, create).setup(fakeHost().host, setting);

        expect(create.mock.calls[0]![0].options).toMatchObject({ enabled: true, toolbar: true, order: 40 });
    });

    it('does nothing when switched off', () => {
        const create = vi.fn();
        const { host, listeners } = fakeHost();

        expect(defineAddon('demo', 40, create).setup(host, false)).toBeUndefined();
        expect(create).not.toHaveBeenCalled();
        expect(listeners.size).toBe(0);
    });

    it('runs again on a locale change after releasing the previous run, and releases everything on teardown', () => {
        const log: string[] = [];
        let run = 0;
        const addon = defineAddon('demo', 40, ({ life }) => {
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
