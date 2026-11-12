import { describe, expect, it, vi } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { resetBadRangeWarning } from './data-table-range.js';
import { RangeSession } from './data-table-range-session.js';
import { RangePart } from './lazy/range.js';

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

describe('RangeSession keeps the last VALID range', () => {
    it('a valid range, then a range with a bad column: after the update the valid one is back (one warning); an explicit clear forgets it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        resetBadRangeWarning();
        const { range } = session([{ accessorKey: 'a' }, { accessorKey: 'b' }]);
        const good = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' };
        range.rangeService.setRange(good);
        range.hostUpdate();
        range.rangeService.setRange({ startRow: 2, startCol: 'a', endRow: 3, endCol: 'zzz' });
        range.hostUpdate();
        expect(range.rangeService.range()).toEqual(good);
        expect(warn).toHaveBeenCalledTimes(1);
        range.hostUpdate();
        expect(range.rangeService.range()).toEqual(good); // and it stays
        range.rangeService.setRange(null);
        range.hostUpdate();
        range.rangeService.setRange({ startRow: 2, startCol: 'a', endRow: 3, endCol: 'zzz' });
        range.hostUpdate();
        expect(range.rangeService.range()).toBeNull(); // cleared on purpose: nothing to go back to
        warn.mockRestore();
    });
});

describe('RangeSession column validation by value', () => {
    it('sees a later mutation of the consumer\'s own range object: endCol changed to a missing column is refused with the warning, and the last valid range stays', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        resetBadRangeWarning();
        const { range } = session([{ accessorKey: 'a' }, { accessorKey: 'b' }]);
        const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' };
        range.rangeService.setRange(mine);
        range.hostUpdate();
        expect(range.rangeService.range()).toBe(mine); // valid, kept, the very object
        mine.endCol = 'zzz';
        range.hostUpdate();
        expect(range.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' }); // the copy of the valid value
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('RangeSession hands the held range to its part once, after the part attached', () => {
    it('one setRange on the part, ordered after attach (not again before it)', async () => {
        const setRange = vi.spyOn(RangePart.prototype, 'setRange');
        const attach = vi.spyOn(RangePart.prototype, 'attach');
        try {
            const { range } = session([{ accessorKey: 'a' }]);
            const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'a' };
            range.rangeService.setRange(mine); // held: no part yet
            range.hostUpdate();
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(attach).toHaveBeenCalledTimes(1);
            expect(setRange).toHaveBeenCalledTimes(1);
            expect(setRange.mock.invocationCallOrder[0]).toBeGreaterThan(attach.mock.invocationCallOrder[0]!);
            expect(setRange).toHaveBeenCalledWith(mine);
            range.detach();
        } finally {
            setRange.mockRestore();
            attach.mockRestore();
        }
    });
});

describe('RangeSession with a part whose getRange throws', () => {
    it('still disposes the part at detach (the held range answers), and the next attach builds a fresh part', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const getRange = vi.spyOn(RangePart.prototype, 'getRange').mockImplementation(() => {
            throw new Error('getRange failed');
        });
        const attach = vi.spyOn(RangePart.prototype, 'attach');
        const detach = vi.spyOn(RangePart.prototype, 'detach');
        try {
            const { range } = session([{ accessorKey: 'a' }]);
            const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'a' };
            range.rangeService.setRange(mine);
            range.hostUpdate(); // the part loads
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(attach).toHaveBeenCalledTimes(1);
            expect(() => range.detach()).not.toThrow();
            expect(detach).toHaveBeenCalledTimes(1); // disposed although getRange threw
            expect(getRange).toHaveBeenCalled();
            range.hostUpdate(); // the next attach: a fresh part
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(attach).toHaveBeenCalledTimes(2);
            expect(range.rangeService.range()).toEqual(mine); // the held value survived
            range.detach();
        } finally {
            getRange.mockRestore();
            attach.mockRestore();
            detach.mockRestore();
            warn.mockRestore();
        }
    });
});

describe('RangeSession turn-off of range mode', () => {
    const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'a' };
    function make() {
        const requestRender = vi.fn();
        const config = { columns: [{ accessorKey: 'a' }], enableCellRangeSelection: true, enableFillHandle: false };
        const range = new RangeSession({ host: { config, requestRender }, rowCount: () => 10 } as unknown as InteractionContext<unknown>);
        range.hostUpdate(); // the mode is on and seen
        return { range, config };
    }
    const turnOnAgain = (range: RangeSession<unknown>, config: { enableCellRangeSelection: boolean }) => {
        config.enableCellRangeSelection = true;
        range.hostUpdate();
        return range.rangeService.range();
    };

    it('keeps a range assigned in the same tick as the turn-off, whichever property order: cellRange then flag, and flag then cellRange', () => {
        for (const order of ['range first', 'flag first']) {
            const { range, config } = make();
            if (order === 'range first') {
                range.rangeService.setRange({ ...mine });
                config.enableCellRangeSelection = false;
            } else {
                config.enableCellRangeSelection = false;
                range.rangeService.setRange({ ...mine });
            }
            range.hostUpdate();
            expect(turnOnAgain(range, config), order).toEqual(mine);
        }
    });

    it('clears a range that was held before the tick of the turn-off (the mode that ends takes its range with it)', () => {
        const { range, config } = make();
        range.rangeService.setRange({ ...mine });
        range.hostUpdate(); // an update in between: the assignment is no longer "this tick"
        config.enableCellRangeSelection = false;
        range.hostUpdate();
        expect(turnOnAgain(range, config)).toBeNull();
    });
});

describe('RangeSession.setRange of an object edited in place', () => {
    it('renders again when the consumer edits its own range object and assigns the same object again', () => {
        const { range, requestRender } = session([{ accessorKey: 'a' }]);
        const mine = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'a' };
        range.rangeService.setRange(mine);
        expect(requestRender).toHaveBeenCalledTimes(1);
        range.rangeService.setRange(mine); // unchanged: nothing new to draw
        expect(requestRender).toHaveBeenCalledTimes(1);
        mine.endRow = 5; // edited in place, assigned again
        range.rangeService.setRange(mine);
        expect(requestRender).toHaveBeenCalledTimes(2);
        expect(range.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 5, endCol: 'a' });
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
