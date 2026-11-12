import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportOncePer, warnOncePer } from './data-table-warn.js';

afterEach(() => vi.restoreAllMocks());

describe('warnOncePer', () => {
    it('speaks once per owner and key, with the detail; another owner speaks again', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const table = {};
        warnOncePer(table, 'a', 'message a', 1, 2);
        warnOncePer(table, 'a', 'message a again');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('message a', 1, 2);
        warnOncePer(table, 'b', 'message b');
        warnOncePer({}, 'a', 'message a');
        expect(warn).toHaveBeenCalledTimes(3);
    });
});

describe('reportOncePer', () => {
    it('is the console.error twin: once per owner and key', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const session = {};
        reportOncePer(session, 'k', 'boom', new Error('x'));
        reportOncePer(session, 'k', 'boom');
        expect(error).toHaveBeenCalledTimes(1);
        expect(warn).not.toHaveBeenCalled();
    });
});
