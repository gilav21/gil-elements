import { afterEach, describe, expect, it } from 'vitest';
import { fakeClipboard, type FakeClipboard } from './data-table-input-fixtures.js';

let fake: FakeClipboard | undefined;
afterEach(() => {
    fake?.restore();
    fake = undefined;
});

const realDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');

describe('fakeClipboard', () => {
    it('records writes and reads, and answers the text it holds', async () => {
        fake = fakeClipboard({ text: 'seed' });
        expect(await navigator.clipboard.readText()).toBe('seed');
        await navigator.clipboard.writeText('a\tb');
        expect(fake.text).toBe('a\tb');
        expect(fake.writes).toEqual(['a\tb']);
        expect(fake.reads.count).toBe(1);
    });

    it('rejects like a refused permission with denyWrite and denyRead', async () => {
        fake = fakeClipboard({ denyWrite: true, denyRead: true });
        await expect(navigator.clipboard.writeText('x')).rejects.toMatchObject({ name: 'NotAllowedError' });
        await expect(navigator.clipboard.readText()).rejects.toMatchObject({ name: 'NotAllowedError' });
        expect(fake.writes).toEqual([]);
    });

    it('takes the API away for real with missing: `in` is false, and restore brings the browser own back', () => {
        fake = fakeClipboard({ missing: true });
        expect('clipboard' in navigator).toBe(false);
        expect((navigator as { clipboard?: unknown }).clipboard).toBeUndefined();
        fake.restore();
        fake = undefined;
        expect('clipboard' in navigator).toBe(realDescriptor !== undefined);
        expect(Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard')?.get).toBe(realDescriptor?.get);
    });

    it('restore removes the fake after a normal install', () => {
        fake = fakeClipboard();
        expect(Object.hasOwn(navigator, 'clipboard')).toBe(true);
        fake.restore();
        fake = undefined;
        expect(Object.hasOwn(navigator, 'clipboard')).toBe(false);
    });
});
