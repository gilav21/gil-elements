import { describe, expect, it } from 'vitest';
import { mergeSessionServices } from './data-table-session-service.js';

describe('mergeSessionServices', () => {
    it('delegates a method named like an inherited one (toString, constructor, valueOf) instead of skipping it', () => {
        const session = { service: { toString: () => 'mine', valueOf: () => 42 } } as never;
        const merged = mergeSessionServices([session], () => false, { focusedCell: () => null });
        expect(merged['toString']).not.toBe(Object.prototype.toString);
        expect((merged['toString'] as () => unknown)()).toBe('mine');
        expect((merged['valueOf'] as () => unknown)()).toBe(42);
    });

    it('the first session that declares a key owns it, and a broken one answers from its neutral service for the keys that list', () => {
        const first = { service: { a: () => 'first-a', b: () => 'first-b' }, neutral: { service: { a: () => 'neutral-a' } } } as never;
        const second = { service: { a: () => 'second-a', c: () => 'second-c' } } as never;
        let broken = false;
        const merged = mergeSessionServices([first, second], (s) => broken && s === first, {});
        expect((merged['a'] as () => unknown)()).toBe('first-a');
        expect((merged['c'] as () => unknown)()).toBe('second-c');
        broken = true;
        expect((merged['a'] as () => unknown)()).toBe('neutral-a');
        expect((merged['b'] as () => unknown)()).toBe('first-b'); // not listed in the neutral service: still the session's own
    });
});
