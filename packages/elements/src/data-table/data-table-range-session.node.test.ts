import { describe, expect, it, vi } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { resetBadRangeWarning } from './data-table-range.js';
import { RangeSession } from './data-table-range-session.js';

function session(columns: { accessorKey: string }[], rows = 10) {
    const requestRender = vi.fn();
    const config = { columns, enableCellRangeSelection: true, enableFillHandle: false };
    const context = { host: { config, requestRender }, rowCount: () => rows } as unknown as InteractionContext<unknown>;
    return { range: new RangeSession(context), requestRender };
}

describe('RangeSession column validation', () => {
    it('looks at the columns once per (range, columns array), not at every update', () => {
        const columns = [{ accessorKey: 'a' }, { accessorKey: 'b' }];
        const map = vi.spyOn(columns, 'map');
        const { range } = session(columns);
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' });
        for (let i = 0; i < 5; i++) range.hostUpdate();
        expect(map).toHaveBeenCalledTimes(1);
        // another range, and another columns array, are looked at again
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 2, endCol: 'b' });
        range.hostUpdate();
        range.hostUpdate();
        expect(map).toHaveBeenCalledTimes(2);
        expect(range.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 2, endCol: 'b' });
    });

    it('still drops a range that names a missing column', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { range } = session([{ accessorKey: 'a' }]);
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'zzz' });
        range.hostUpdate();
        expect(range.rangeService.range()).toBeNull();
        warn.mockRestore();
    });
});

describe('RangeSession column validation of an invalid range', () => {
    it('drops the same invalid object again when it is re-assigned (it is remembered only once valid)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { range } = session([{ accessorKey: 'a' }]);
        const bad = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'zzz' };
        range.rangeService.setRange(bad);
        range.hostUpdate();
        expect(range.rangeService.range()).toBeNull();
        range.rangeService.setRange(bad);
        range.hostUpdate();
        expect(range.rangeService.range()).toBeNull();
        warn.mockRestore();
    });
});

describe('RangeSession column validation by value', () => {
    it('sees a later mutation of the consumer\'s own range object: endCol changed to a missing column is dropped with the warning', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        resetBadRangeWarning();
        const { range } = session([{ accessorKey: 'a' }, { accessorKey: 'b' }]);
        const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' };
        range.rangeService.setRange(mine);
        range.hostUpdate();
        expect(range.rangeService.range()).toBe(mine); // valid, kept, the very object
        mine.endCol = 'zzz';
        range.hostUpdate();
        expect(range.rangeService.range()).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('RangeSession.setRange and renders', () => {
    it('requests a render for a changed range only while range mode is on', () => {
        const requestRender = vi.fn();
        const config = { columns: [{ accessorKey: 'a' }], enableCellRangeSelection: false, enableFillHandle: false };
        const range = new RangeSession({ host: { config, requestRender }, rowCount: () => 10 } as unknown as InteractionContext<unknown>);
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'a' });
        expect(requestRender).not.toHaveBeenCalled(); // mode off: held, not drawn
        config.enableCellRangeSelection = true;
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 2, endCol: 'a' });
        expect(requestRender).toHaveBeenCalledTimes(1);
    });
});

describe('RangeSession.setRange', () => {
    it('does not trim against the rows of the moment of the assignment: the update trims, with the rows it knows', () => {
        let rows = 4;
        const requestRender = vi.fn();
        const config = { columns: [{ accessorKey: 'a' }], enableCellRangeSelection: true, enableFillHandle: false };
        const range = new RangeSession({ host: { config, requestRender }, rowCount: () => rows } as unknown as InteractionContext<unknown>);
        range.attach();
        range.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 8, endCol: 'a' }); // the data of the same tick has more rows
        rows = 10;
        range.hostUpdate();
        expect(range.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 8, endCol: 'a' });
        rows = 3; // the data shrinks
        range.hostUpdate();
        expect(range.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 2, endCol: 'a' });
    });
});
