import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWarnOnce, warnOnce } from './data-table-warn.js';

afterEach(() => resetWarnOnce());

describe('warnOnce', () => {
    it('speaks once per key, with the detail, and stays silent for the same key afterwards', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        warnOnce('a', 'message a', 1, 2);
        warnOnce('a', 'message a again');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('message a', 1, 2);
        warnOnce('b', 'message b');
        expect(warn).toHaveBeenCalledTimes(2);
        warn.mockRestore();
    });

    it('lets one key, or every key, speak again after a reset', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        warnOnce('a', 'x');
        warnOnce('b', 'y');
        resetWarnOnce('a');
        warnOnce('a', 'x');
        warnOnce('b', 'y');
        expect(warn).toHaveBeenCalledTimes(3);
        resetWarnOnce();
        warnOnce('b', 'y');
        expect(warn).toHaveBeenCalledTimes(4);
        warn.mockRestore();
    });
});
