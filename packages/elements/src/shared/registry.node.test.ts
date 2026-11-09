import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disposables, HandlerChain, SlotRegistry, TopicBus } from './registry.js';

describe('SlotRegistry', () => {
    it('keeps slots in registration order', () => {
        const registry = new SlotRegistry<string>();
        registry.register('a');
        registry.register('b');
        expect(registry.slots).toEqual(['a', 'b']);
    });

    it('teardown removes exactly its slot and is idempotent', () => {
        const registry = new SlotRegistry<{ id: string }>();
        const a = { id: 'a' };
        const b = { id: 'b' };
        const removeA = registry.register(a);
        registry.register(b);
        const notified = vi.fn();
        registry.subscribe(notified);
        removeA();
        removeA();
        expect(registry.slots).toEqual([b]);
        expect(notified).toHaveBeenCalledTimes(1);
    });

    it('treats a repeated equal value as two slots and removes one per teardown', () => {
        const registry = new SlotRegistry<string>();
        const first = registry.register('x');
        registry.register('x');
        first();
        expect(registry.slots).toEqual([]);
    });

    it('notifies subscribers on register, until they unsubscribe', () => {
        const registry = new SlotRegistry<string>();
        const fn = vi.fn();
        const off = registry.subscribe(fn);
        registry.register('a');
        off();
        registry.register('b');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('replaces the snapshot instead of mutating it', () => {
        const registry = new SlotRegistry<string>();
        const before = registry.slots;
        registry.register('a');
        expect(before).toEqual([]);
        expect(registry.slots).not.toBe(before);
    });
});

describe('TopicBus', () => {
    it('emits only to listeners of that topic', () => {
        const bus = new TopicBus<'a' | 'b'>();
        const onA = vi.fn();
        const onB = vi.fn();
        bus.on('a', onA);
        bus.on('b', onB);
        bus.emit('a');
        expect(onA).toHaveBeenCalledTimes(1);
        expect(onB).not.toHaveBeenCalled();
    });

    it('stops notifying after unsubscribe', () => {
        const bus = new TopicBus<'a'>();
        const fn = vi.fn();
        bus.on('a', fn)();
        bus.emit('a');
        expect(fn).not.toHaveBeenCalled();
    });

    it('tolerates a listener unsubscribing another during emit', () => {
        const bus = new TopicBus<'a'>();
        const second = vi.fn();
        let offSecond = (): void => undefined;
        bus.on('a', () => offSecond());
        offSecond = bus.on('a', second);
        bus.emit('a');
        expect(second).toHaveBeenCalledTimes(1);
        bus.emit('a');
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('emitting a topic nobody listens to is a no-op', () => {
        expect(() => new TopicBus<'a'>().emit('a')).not.toThrow();
    });
});

describe('Disposables', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('runs teardowns newest first on dispose, once', () => {
        const order: number[] = [];
        const bag = new Disposables();
        bag.add(() => order.push(1));
        bag.add(() => order.push(2));
        bag.dispose();
        bag.dispose();
        expect(order).toEqual([2, 1]);
    });

    it('the returned release runs the teardown now and not again on dispose', () => {
        const fn = vi.fn();
        const bag = new Disposables();
        const release = bag.add(fn);
        release();
        release();
        bag.dispose();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('fires a timeout once and forgets it', () => {
        const fn = vi.fn();
        const bag = new Disposables();
        bag.timeout(fn, 200);
        vi.advanceTimersByTime(199);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fn).toHaveBeenCalledTimes(1);
        bag.dispose();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels a pending timeout via its handle and via dispose', () => {
        const cancelled = vi.fn();
        const disposed = vi.fn();
        const bag = new Disposables();
        bag.timeout(cancelled, 100)();
        bag.timeout(disposed, 100);
        bag.dispose();
        vi.advanceTimersByTime(500);
        expect(cancelled).not.toHaveBeenCalled();
        expect(disposed).not.toHaveBeenCalled();
    });

    it('removes listeners on dispose with the options they were added with', () => {
        const target = new EventTarget();
        const fn = vi.fn();
        const bag = new Disposables();
        bag.listen(target, 'ping', fn, { capture: true });
        target.dispatchEvent(new Event('ping'));
        bag.dispose();
        target.dispatchEvent(new Event('ping'));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('can be reused after dispose', () => {
        const fn = vi.fn();
        const bag = new Disposables();
        bag.dispose();
        bag.add(fn);
        bag.dispose();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('HandlerChain', () => {
    it('runs lower priorities first, ties in insertion order', () => {
        const calls: string[] = [];
        const chain = new HandlerChain<[]>();
        chain.add(10, () => !calls.push('late'));
        chain.add(0, () => !calls.push('first'));
        chain.add(10, () => !calls.push('late2'));
        expect(chain.run()).toBe(false);
        expect(calls).toEqual(['first', 'late', 'late2']);
    });

    it('stops at the first handler that returns true', () => {
        const after = vi.fn(() => true);
        const chain = new HandlerChain<[number]>();
        chain.add(1, (n) => n > 1);
        chain.add(2, after);
        expect(chain.run(5)).toBe(true);
        expect(after).not.toHaveBeenCalled();
        expect(chain.run(0)).toBe(true);
        expect(after).toHaveBeenCalledWith(0);
    });

    it('passes every argument through and is false when empty', () => {
        const chain = new HandlerChain<[string, number]>();
        expect(chain.run('a', 1)).toBe(false);
        const fn = vi.fn(() => false);
        chain.add(0, fn);
        chain.run('a', 1);
        expect(fn).toHaveBeenCalledWith('a', 1);
    });

    it('removes a handler through its unsubscribe', () => {
        const fn = vi.fn(() => true);
        const chain = new HandlerChain<[]>();
        const off = chain.add(0, fn);
        off();
        expect(chain.size).toBe(0);
        expect(chain.run()).toBe(false);
    });
});
