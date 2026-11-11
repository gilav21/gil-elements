import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyElement, lazyOnce, lazyPart, type LazyPartInstance } from './data-table-lazy.js';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function part(): LazyPartInstance & { attach: ReturnType<typeof vi.fn>; detach: ReturnType<typeof vi.fn> } {
    return { attach: vi.fn(), detach: vi.fn() };
}

/** A promise settled by hand, so a test decides when the "import" resolves. */
function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
}

describe('lazyOnce', () => {
    it('imports once however many callers ask, and hands every one the same module', async () => {
        const importer = vi.fn(() => Promise.resolve({ ok: true }));
        const load = lazyOnce(importer);
        const [a, b] = await Promise.all([load(), load()]);
        expect(a).toBe(b);
        await load();
        expect(importer).toHaveBeenCalledTimes(1);
    });

    it('forgets a failed import so the next call tries again', async () => {
        const importer = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('module');
        const load = lazyOnce(importer);
        await expect(load()).rejects.toThrow('offline');
        await expect(load()).resolves.toBe('module');
        expect(importer).toHaveBeenCalledTimes(2);
    });
});

describe('lazyElement', () => {
    const defined = new Set<string>();
    const original = globalThis.customElements;
    afterEach(() => {
        defined.clear();
        Object.defineProperty(globalThis, 'customElements', { value: original, configurable: true });
    });
    const fakeRegistry = (): void =>
        void Object.defineProperty(globalThis, 'customElements', {
            configurable: true,
            value: { get: (tag: string) => (defined.has(tag) ? class {} : undefined), whenDefined: (tag: string) => Promise.resolve(defined.has(tag) ? class {} : undefined) },
        });

    it('loads once, resolves when the tag is defined, and says whether it is ready', async () => {
        fakeRegistry();
        const importer = vi.fn(async () => void defined.add('ge-x'));
        const element = lazyElement('ge-x', importer);
        expect(element.ready()).toBe(false);
        await expect(Promise.all([element.load(), element.load()])).resolves.toEqual([true, true]);
        expect(element.ready()).toBe(true);
        expect(importer).toHaveBeenCalledTimes(1);
    });

    it('settles with false when the module is loaded but does not define the tag, instead of waiting for ever', async () => {
        fakeRegistry();
        const element = lazyElement('ge-never', async () => ({}));
        await expect(element.load()).resolves.toBe(false);
        expect(element.ready()).toBe(false);
    });

    it('rejects when the import fails', async () => {
        fakeRegistry();
        const element = lazyElement('ge-x', () => Promise.reject(new Error('404')));
        await expect(element.load()).rejects.toThrow('404');
    });
});

describe('lazyPart', () => {
    it('builds and attaches the part once when the flag turns on, however often it is synced', async () => {
        const instance = part();
        const create = vi.fn(() => Promise.resolve(instance));
        const lazy = lazyPart(create);
        expect(lazy.part).toBeNull();
        lazy.sync(true);
        lazy.sync(true);
        await flush();
        expect(create).toHaveBeenCalledTimes(1);
        expect(instance.attach).toHaveBeenCalledTimes(1);
        expect(lazy.part).toBe(instance);
    });

    it('does nothing while the flag is off', async () => {
        const create = vi.fn(() => Promise.resolve(part()));
        const lazy = lazyPart(create);
        lazy.sync(false);
        await flush();
        expect(create).not.toHaveBeenCalled();
        expect(lazy.part).toBeNull();
    });

    it('detaches the part when the flag turns off, and builds a fresh one when it turns on again', async () => {
        const first = part();
        const second = part();
        const create = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
        const lazy = lazyPart<LazyPartInstance>(create);
        lazy.sync(true);
        await flush();
        lazy.sync(false);
        expect(first.detach).toHaveBeenCalledTimes(1);
        expect(lazy.part).toBeNull();
        lazy.sync(true);
        await flush();
        expect(lazy.part).toBe(second);
        expect(second.attach).toHaveBeenCalledTimes(1);
    });

    it('drops a load that resolves after the flag turned off: nothing is attached', async () => {
        const load = deferred<ReturnType<typeof part>>();
        const lazy = lazyPart(() => load.promise);
        lazy.sync(true);
        lazy.sync(false);
        const late = part();
        load.resolve(late);
        await flush();
        expect(late.attach).not.toHaveBeenCalled();
        expect(lazy.part).toBeNull();
    });

    it('drops a load that resolves after dispose (the table was detached): nothing is attached, nothing throws', async () => {
        const load = deferred<ReturnType<typeof part>>();
        const lazy = lazyPart(() => load.promise);
        lazy.sync(true);
        lazy.dispose();
        const late = part();
        load.resolve(late);
        await flush();
        expect(late.attach).not.toHaveBeenCalled();
        expect(lazy.part).toBeNull();
        lazy.dispose();
    });

    it('detaches an attached part on dispose, once', async () => {
        const instance = part();
        const lazy = lazyPart(() => Promise.resolve(instance));
        lazy.sync(true);
        await flush();
        lazy.dispose();
        lazy.dispose();
        expect(instance.detach).toHaveBeenCalledTimes(1);
    });

    it('does not let a stale load win after off then on: only the load of the latest sync attaches', async () => {
        const slow = deferred<ReturnType<typeof part>>();
        const fast = part();
        const create = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValueOnce(fast);
        const lazy = lazyPart<LazyPartInstance>(create);
        lazy.sync(true);
        lazy.sync(false);
        lazy.sync(true);
        await flush();
        const stale = part();
        slow.resolve(stale);
        await flush();
        expect(fast.attach).toHaveBeenCalledTimes(1);
        expect(stale.attach).not.toHaveBeenCalled();
        expect(lazy.part).toBe(fast);
    });

    it('latches a failed load: one import and one error across many syncs (one per render), while the flag stays on', async () => {
        const onError = vi.fn();
        const create = vi.fn().mockRejectedValue(new Error('chunk 404'));
        const lazy = lazyPart<LazyPartInstance>(create, { onError });
        for (let render = 0; render < 5; render++) {
            lazy.sync(true);
            await flush();
        }
        expect(create).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(lazy.part).toBeNull();
    });

    it('tries a failed load again after the flag turned off and on', async () => {
        const instance = part();
        const create = vi.fn().mockRejectedValueOnce(new Error('chunk 404')).mockResolvedValueOnce(instance);
        const lazy = lazyPart<LazyPartInstance>(create, { onError: vi.fn() });
        lazy.sync(true);
        await flush();
        lazy.sync(false);
        lazy.sync(true);
        await flush();
        expect(create).toHaveBeenCalledTimes(2);
        expect(lazy.part).toBe(instance);
    });

    it('tries a failed load again after dispose (the next attach)', async () => {
        const instance = part();
        const create = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(instance);
        const lazy = lazyPart<LazyPartInstance>(create, { onError: vi.fn() });
        lazy.sync(true);
        await flush();
        lazy.dispose();
        lazy.sync(true);
        await flush();
        expect(lazy.part).toBe(instance);
    });

    it('asks the host to render once the part is attached, and again when an attached part is detached', async () => {
        const changed = vi.fn();
        const instance = part();
        const lazy = lazyPart(() => Promise.resolve(instance), { changed });
        lazy.sync(true);
        expect(changed).not.toHaveBeenCalled();
        await flush();
        expect(changed).toHaveBeenCalledTimes(1);
        // what a render reads from the part is already true when the host is asked
        expect(instance.attach).toHaveBeenCalledTimes(1);
        lazy.sync(false);
        expect(changed).toHaveBeenCalledTimes(2);
        lazy.dispose();
        expect(changed).toHaveBeenCalledTimes(2);
    });

    it('does not ask for a render for a load that failed, was dropped, or never had a part', async () => {
        const changed = vi.fn();
        const lazy = lazyPart(() => Promise.reject(new Error('404')), { changed, onError: vi.fn() });
        lazy.sync(true);
        await flush();
        lazy.dispose();
        expect(changed).not.toHaveBeenCalled();
    });

    it('does not leave a part half attached when attach throws: it is detached, forgotten, reported once and latched', async () => {
        const onError = vi.fn();
        const changed = vi.fn();
        const broken = part();
        broken.attach.mockImplementation(() => {
            throw new Error('attach failed');
        });
        const create = vi.fn(() => Promise.resolve(broken));
        const unhandled = vi.fn();
        process.on('unhandledRejection', unhandled);
        const lazy = lazyPart(create, { onError, changed });
        for (let render = 0; render < 4; render++) {
            lazy.sync(true);
            await flush();
        }
        process.off('unhandledRejection', unhandled);
        expect(unhandled).not.toHaveBeenCalled();
        expect(lazy.part).toBeNull();
        expect(broken.detach).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(create).toHaveBeenCalledTimes(1);
        expect(changed).not.toHaveBeenCalled();
        lazy.sync(false);
        lazy.sync(true);
        await flush();
        expect(create).toHaveBeenCalledTimes(2);
    });

    it('lets a part that reads the shell during attach see itself', async () => {
        let lazy!: ReturnType<typeof lazyPart<LazyPartInstance>>;
        let seen: unknown;
        const instance = { attach: () => void (seen = lazy.part), detach: vi.fn() };
        lazy = lazyPart<LazyPartInstance>(() => Promise.resolve(instance));
        lazy.sync(true);
        await flush();
        expect(seen).toBe(instance);
    });
});
