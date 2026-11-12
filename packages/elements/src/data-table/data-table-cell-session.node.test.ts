import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { EditSession, NEUTRAL_EDIT } from './data-table-edit-session.js';
import { NEUTRAL_RANGE, RangeSession } from './data-table-range-session.js';
import { RangePart } from './lazy/range.js';

const DIRECTORY = new URL('.', import.meta.url);
const SOURCES = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const read = (name: string): string => readFileSync(new URL(name, DIRECTORY), 'utf8');
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Flags {
    enableCellRangeSelection: boolean;
    enableFillHandle: boolean;
}

/** A context with what the range shell reads: the flags, the render request, the focus, the rows and the column keys. */
function rangeContext(flags: Flags, { focused = null, rowCount = 10, keys = ['a', 'b', 'c'], visible = keys }: { focused?: { rowIndex: number; columnKey: string } | null; rowCount?: number; keys?: string[]; visible?: string[] } = {}) {
    const requestRender = vi.fn();
    // `config.columns` is every column of the table (what a range may name); `focusableKeys` only the visible ones (what is drawn)
    const config = Object.assign(flags, { columns: keys.map((accessorKey) => ({ accessorKey })) });
    const context = { host: { config, requestRender }, focused: () => focused, rowCount: () => rowCount, focusableKeys: () => visible } as unknown as InteractionContext<unknown>;
    return { context, requestRender, flags };
}
const on: Flags = { enableCellRangeSelection: true, enableFillHandle: false };
const off: Flags = { enableCellRangeSelection: false, enableFillHandle: false };
const range = { startRow: 1, startCol: 'a', endRow: 3, endCol: 'b' };

afterEach(() => vi.restoreAllMocks());

describe('the neutral services', () => {
    it('are frozen, so no table (or consumer) can patch the one object every table shares', () => {
        for (const neutral of [NEUTRAL_RANGE, NEUTRAL_EDIT]) {
            expect(Object.isFrozen(neutral)).toBe(true);
            expect(() => {
                (neutral as unknown as Record<string, unknown>)['active'] = () => true; // ES modules are strict: assigning to a frozen object throws
            }).toThrow(TypeError);
        }
        expect(NEUTRAL_RANGE.active()).toBe(false);
    });
});

describe('the joint step 0 sessions', () => {
    it('answers "nothing is being edited" and no editor can open', () => {
        const { service } = new EditSession({} as unknown as InteractionContext<unknown>);
        expect(service.editingCell?.()).toBeNull();
        expect(service.cellEditError?.()).toBeNull();
        expect(service.startEditing?.({}, 'name')).toBe(false);
        expect(service.isEditing?.(0, 'name')).toBe(false);
        expect(service.editValue?.()).toBeUndefined();
        expect(() => [service.commitEdit?.(), service.cancelEdit?.(), service.setEditValue?.(1)]).not.toThrow();
    });

    it('derives cellRange and isCellSelected from the range service, so one pair is implemented', () => {
        const session = new RangeSession(rangeContext({ ...on }, { focused: { rowIndex: 1, columnKey: 'a' } }).context);
        session.rangeService.setRange(range);
        expect(session.service.cellRange()).toEqual(range);
        vi.spyOn(session.rangeService, 'active').mockReturnValue(true); // the range branch needs a loaded part
        const isInRange = vi.spyOn(session.rangeService, 'isInRange').mockImplementation((r) => r === 2);
        expect(session.service.isCellSelected(2, 'a')).toBe(true);
        expect(isInRange).toHaveBeenCalled();
    });

    it('answers isCellSelected as Angular does: with a range, only its cells; with none, the focused cell', () => {
        const { context, flags } = rangeContext({ ...off }, { focused: { rowIndex: 1, columnKey: 'a' } });
        const session = new RangeSession(context);
        expect(session.service.isCellSelected(1, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
        flags.enableCellRangeSelection = true;
        expect(session.service.isCellSelected(1, 'a')).toBe(true);
        session.rangeService.setRange({ startRow: 3, startCol: 'a', endRow: 4, endCol: 'a' });
        vi.spyOn(session.rangeService, 'active').mockReturnValue(true);
        vi.spyOn(session.rangeService, 'isInRange').mockImplementation((r) => r >= 3 && r <= 4);
        expect(session.service.isCellSelected(1, 'a')).toBe(false); // the focused cell is not selected once a range exists elsewhere
        expect(session.service.isCellSelected(3, 'a')).toBe(true);
    });

    it('says a cell of a SELECTED row is selected (row selection on) whatever the range, like the aria-selected of its cells; with row selection off it is not', () => {
        const { context } = rangeContext({ ...on });
        const provide = (selectionOn: boolean) => {
            const host = context.host as unknown as { config: Record<string, unknown>; provider: (key: string) => unknown };
            Object.assign(host.config, { enableRowSelection: selectionOn, getRowId: (row: { id: string }) => row.id });
            host.provider = (key) => ({ query: { renderedRowAt: (index: number) => ({ id: `r${index}` }) }, selection: { isSelected: (id: string) => id === 'r3' } })[key as 'query' | 'selection'];
        };
        const session = new RangeSession(context);
        provide(true);
        expect(session.service.isCellSelected(3, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
        provide(false);
        expect(session.service.isCellSelected(3, 'a')).toBe(false);
    });

    it('has no neutral override for isCellSelected: with no live part (loading, or a failed session) its own service answers the focused cell', () => {
        const { context } = rangeContext({ enableCellRangeSelection: true, enableFillHandle: false }, { focused: { rowIndex: 1, columnKey: 'a' } });
        const session = new RangeSession(context);
        expect(session.neutral).toBeUndefined();
        expect(session.service.isCellSelected(1, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
    });

    it('asks the host to render when a range is set', () => {
        const { context, requestRender } = rangeContext({ ...on });
        new RangeSession(context).rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 0, endCol: 'a' });
        expect(requestRender).toHaveBeenCalledTimes(1);
    });

    it('answers "no range" and no gesture, and fills nothing', () => {
        const session = new RangeSession(rangeContext({ ...on }).context);
        expect(session.service.cellRange()).toBeNull();
        expect(session.service.isCellSelected(0, 'name')).toBe(false);
        const service = session.rangeService;
        expect(service.active()).toBe(false);
        expect(service.range()).toBeNull();
        expect(service.normalized()).toBeNull();
        expect(service.isInRange(0, 'name')).toBe(false);
        expect(service.isFillPreview(0, 'name')).toBe(false);
        expect(service.stats()).toBeNull();
        expect(service.chartPayload()).toBeNull();
        expect(service.fillDownTo(3)).toBe(false);
        expect(service.fillHandleCell()).toBeNull();
        expect(service.gestureActive()).toBe(false);
    });
});

describe('the range held by the shell', () => {
    /** An ATTACHED session (the controller attaches it before anything is assigned). */
    const make = (flags: Flags = { ...on }, options?: Parameters<typeof rangeContext>[1]) => {
        const session = new RangeSession(rangeContext(flags, options).context);
        session.attach();
        return { session, flags };
    };

    it('keeps a range set before the part is loaded, and hands it to the part when it attaches', async () => {
        const { session } = make();
        session.rangeService.setRange(range);
        expect(session.rangeService.range()).toEqual(range);
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toEqual(range);
        const loaded = (): unknown => (session as unknown as { lazy: { part: unknown } }).lazy.part;
        await vi.waitFor(() => expect(loaded()).not.toBeNull());
        // the empty step 0 part is loaded and attached but handles no range: not active, so range mode is not drawn
        expect(session.rangeService.active()).toBe(false);
    });

    it('applies a range set between attach and load to the part that is built', async () => {
        const { session } = make();
        session.hostUpdate();
        session.rangeService.setRange(range);
        await flush();
        expect(session.rangeService.range()).toEqual(range);
    });

    it('keeps the range across a detach and attach (a DOM move) and gives it to the next part', async () => {
        const { session } = make();
        session.hostUpdate();
        await flush();
        session.rangeService.setRange(range);
        session.detach();
        expect(session.rangeService.range()).toEqual(range);
        expect(session.rangeService.active()).toBe(false);
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toEqual(range);
    });

    const partOf = (session: RangeSession<unknown>) => (session as unknown as { lazy: { part: { setRange(range: unknown): void } | null } }).lazy.part!;

    it('does not bring back a range the attached part cleared: null is its answer, also at detach', async () => {
        const { session } = make();
        session.rangeService.setRange(range);
        session.hostUpdate();
        await flush();
        partOf(session).setRange(null);
        expect(session.rangeService.range()).toBeNull();
        session.detach();
        expect(session.rangeService.range()).toBeNull();
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toBeNull();
    });

    it('clears the range when the range flags turn off, so turning them on again starts empty', async () => {
        const { session, flags } = make();
        session.hostUpdate();
        await flush();
        session.rangeService.setRange(range);
        session.hostUpdate(); // the range is held by an update before the turn-off (a range assigned in the tick of the turn-off survives it: round 25)
        flags.enableCellRangeSelection = false;
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
        flags.enableCellRangeSelection = true;
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toBeNull();
    });

    it('holds a range assigned while range selection and fill are both off, reports nothing, and applies it when the mode turns on (either property order)', () => {
        const { session, flags } = make({ ...off });
        session.hostUpdate();
        session.rangeService.setRange(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
        expect(session.service.cellRange()).toBeNull();
        flags.enableCellRangeSelection = true; // `el.cellRange = r; el.enableCellRangeSelection = true`
        expect(session.rangeService.range()).toEqual(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual(range);
    });

    it('keeps the range when the mode is switched on first and the range assigned after (the other order)', () => {
        const { session, flags } = make({ ...off });
        flags.enableFillHandle = true; // the fill handle alone is a range flag
        session.hostUpdate();
        session.rangeService.setRange(range);
        expect(session.rangeService.range()).toEqual(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual(range);
    });

    it('clears the held range only on the ON to OFF transition: a value held while off survives updates, one held while on goes', () => {
        const { session, flags } = make({ ...off });
        session.rangeService.setRange(range);
        for (let update = 0; update < 3; update++) session.hostUpdate();
        flags.enableCellRangeSelection = true;
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual(range);
        flags.enableCellRangeSelection = false;
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
        flags.enableCellRangeSelection = true;
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
    });

    it('keeps a range held while off through a detach', () => {
        const { session, flags } = make({ ...off });
        session.rangeService.setRange(range);
        session.detach();
        flags.enableCellRangeSelection = true;
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual(range);
    });

    it('stores the checked value while detached without asking the services (they are gone), and clamps it at the next update', () => {
        const { context, flags } = rangeContext({ ...on }, { rowCount: 5 });
        const guard = { rowCount: () => { throw new Error('services are cleared'); }, focusableKeys: () => { throw new Error('services are cleared'); } };
        const session = new RangeSession(context);
        session.attach();
        session.detach();
        Object.assign(context, guard);
        expect(() => session.rangeService.setRange({ ...range, endRow: 50 })).not.toThrow();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 50 });
        expect(() => session.rangeService.setRange('nonsense' as never)).not.toThrow();
        // attached again, with the services back: the next update clamps what is held
        Object.assign(context, { rowCount: () => 5, focusableKeys: () => ['a', 'b', 'c'] });
        session.attach();
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 4 });
        expect(flags.enableCellRangeSelection).toBe(true);
    });

    it('reports the focused cell with the empty step 0 part LOADED too: it is not active, so isCellSelected has no range to answer from', async () => {
        const { session } = make({ ...on }, { focused: { rowIndex: 4, columnKey: 'a' } });
        session.rangeService.setRange(range);
        session.hostUpdate();
        const loaded = (): unknown => (session as unknown as { lazy: { part: unknown } }).lazy.part;
        await vi.waitFor(() => expect(loaded()).not.toBeNull());
        expect(session.rangeService.active()).toBe(false);
        expect(session.service.isCellSelected(4, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
    });

    it('accepts a range over a column that is configured but hidden, attached or detached: visibility only affects drawing', () => {
        const { context } = rangeContext({ ...on }, { keys: ['a', 'b', 'c'], visible: ['a'] });
        const session = new RangeSession(context);
        const hidden = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'c' };
        session.rangeService.setRange(hidden); // before attach
        expect(session.rangeService.range()).toEqual(hidden);
        session.attach();
        session.rangeService.setRange({ ...hidden, startCol: 'b' }); // attached, b is hidden
        expect(session.rangeService.range()).toEqual({ ...hidden, startCol: 'b' });
        session.detach();
        session.rangeService.setRange(hidden);
        expect(session.rangeService.range()).toEqual(hidden);
    });

    it('drops, at the next update and with one warning, a range that names a special column or a column that is not configured', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { session } = make({ ...on });
        for (const endCol of ['_selection', '_expander', '_actions', 'ghost']) {
            session.rangeService.setRange({ ...range, endCol });
            expect(session.rangeService.range()).toEqual({ ...range, endCol }); // held: the columns are looked up at the update
            session.hostUpdate();
            expect(session.rangeService.range()).toBeNull();
        }
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it('keeps `cellRange = r; columns = [...]` and `columns = [...]; cellRange = r` in one tick: the columns are looked up at the update, against the columns of that moment', () => {
        const { context } = rangeContext({ ...on }, { keys: ['a'] });
        const config = (context as unknown as { host: { config: { columns: { accessorKey: string }[] } } }).host.config;
        const session = new RangeSession(context);
        session.attach();
        // the range names b and c, which are not columns yet: assigned first, the columns arrive in the same tick
        session.rangeService.setRange({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'c' });
        config.columns = ['a', 'b', 'c'].map((accessorKey) => ({ accessorKey }));
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ startRow: 0, startCol: 'a', endRow: 1, endCol: 'c' });
        // the other order: the new columns first, then the range
        config.columns = ['x', 'y'].map((accessorKey) => ({ accessorKey }));
        session.rangeService.setRange({ startRow: 0, startCol: 'x', endRow: 1, endCol: 'y' });
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ startRow: 0, startCol: 'x', endRow: 1, endCol: 'y' });
        // and no columns at all yet: nothing is checked
        config.columns = [];
        session.rangeService.setRange({ startRow: 0, startCol: 'q', endRow: 0, endCol: 'q' });
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ startRow: 0, startCol: 'q', endRow: 0, endCol: 'q' });
    });

    it('turn-off only clears a value that was held in the mode BEFORE the tick of the turn-off: in that tick either property order keeps r (round 25), an earlier assignment is cleared', () => {
        const first = make({ ...on });
        first.session.hostUpdate();
        first.flags.enableCellRangeSelection = false; // the mode goes off ...
        first.session.rangeService.setRange(range); // ... and a range is assigned before the update sees the turn-off
        first.session.hostUpdate();
        expect(first.session.rangeService.range()).toBeNull(); // not reported while off
        first.flags.enableCellRangeSelection = true;
        expect(first.session.rangeService.range()).toEqual(range); // held, applies when the mode is on again

        const second = make({ ...on });
        second.session.hostUpdate();
        second.session.rangeService.setRange(range); // assigned while the mode is on, held by an update ...
        second.session.hostUpdate();
        second.flags.enableCellRangeSelection = false; // ... and the mode goes off in a later tick
        second.session.hostUpdate();
        second.flags.enableCellRangeSelection = true;
        second.session.hostUpdate();
        expect(second.session.rangeService.range()).toBeNull();
    });

    it('trims the rows of the range at the shell with a part loaded too: a data set that shrinks never leaves the range past its rows', async () => {
        const state = { rows: 10 };
        const context = rangeContext({ ...on }, { rowCount: 10 }).context;
        Object.assign(context, { rowCount: () => state.rows });
        const session = new RangeSession(context);
        session.attach();
        session.rangeService.setRange({ ...range, endRow: 8 });
        session.hostUpdate();
        const loaded = (): unknown => (session as unknown as { lazy: { part: unknown } }).lazy.part;
        await vi.waitFor(() => expect(loaded()).not.toBeNull());
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 8 });
        state.rows = 5;
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 4 });
        state.rows = 1; // the range starts at row 1: wholly past the rows, dropped
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
    });

    it('leaves the range untouched while no rows are drawn (before the data arrives, a skeleton, every group collapsed), and trims it onto the rows of a later load (the accepted edge)', () => {
        const state = { rows: 0 };
        const { context } = rangeContext({ ...on }, { rowCount: 0 });
        Object.assign(context, { rowCount: () => state.rows });
        const session = new RangeSession(context);
        session.attach();
        session.rangeService.setRange({ ...range, endRow: 8 }); // set before the data arrives
        for (let update = 0; update < 3; update++) session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 8 });
        state.rows = 20; // the data arrives, then every group is collapsed, then expanded again
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 8 });
        state.rows = 0;
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 8 });
        state.rows = 5; // a later load with fewer rows: trimmed onto them
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 4 });
    });

    it('hands the range held NOW to the part right after it attaches: a range set after the part was built but before it attached is not overwritten by the stale one of the part at the next update', async () => {
        const { session } = make();
        session.rangeService.setRange(range); // the part is built with this one ...
        const target = { ...range, endRow: 4 };
        const attach = vi.spyOn(RangePart.prototype, 'attach').mockImplementation(() => {
            (session as unknown as { held: unknown }).held = target; // ... and a setRange that reached `held` only lands before its attach completes
        });
        try {
            session.hostUpdate();
            const loaded = (): unknown => (session as unknown as { lazy: { part: unknown } }).lazy.part;
            await vi.waitFor(() => expect(loaded()).not.toBeNull());
            expect(session.rangeService.range()).toEqual(target); // the part was told right after attach
            session.hostUpdate();
            expect(session.rangeService.range()).toEqual(target); // and the update did not read the stale value back
        } finally {
            attach.mockRestore();
        }
    });

    it('keeps a held range while a column is merely hidden, and trims only its rows on update (the part checks the columns)', () => {
        const keys = ['a', 'b', 'c'];
        const context = rangeContext({ ...on }, { rowCount: 5, keys }).context;
        const session = new RangeSession(context);
        session.attach();
        session.rangeService.setRange({ ...range, endRow: 3 });
        keys.splice(0, keys.length, 'c'); // the columns a and b are hidden at this update
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 3 });
        keys.splice(0, keys.length, 'a', 'b', 'c'); // and shown again
        session.hostUpdate();
        expect(session.rangeService.range()).toEqual({ ...range, endRow: 3 });
    });

    it('reports the focused cell, not "nothing", while the range part is not active (loading, or a latched failure)', () => {
        const { session } = make({ ...on }, { focused: { rowIndex: 4, columnKey: 'a' } });
        session.rangeService.setRange(range); // held; the part is not loaded, so `isInRange` has no answer
        expect(session.rangeService.active()).toBe(false);
        expect(session.service.isCellSelected(4, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
    });

    it('reports the focused cell as selected with the flags off, whatever was assigned', () => {
        const { session } = make({ ...off }, { focused: { rowIndex: 4, columnKey: 'a' } });
        session.rangeService.setRange(range);
        expect(session.service.isCellSelected(4, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
    });

    describe('what is assigned', () => {
        it('takes undefined as no range, and replaces a range with it', () => {
            const { session } = make();
            session.rangeService.setRange(range);
            session.rangeService.setRange(undefined as never);
            expect(session.rangeService.range()).toBeNull();
        });

        it('refuses a value that is not a range, warns once, and keeps the old range', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
            const { session } = make();
            session.rangeService.setRange(range);
            for (const bad of ['a1:b3', { startRow: 'x' }, { ...range, endCol: 7 }, 42]) session.rangeService.setRange(bad as never);
            expect(session.rangeService.range()).toEqual(range);
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it('trims rows past the last drawn one, and drops a range wholly past them', () => {
            const { session } = make({ ...on }, { rowCount: 5 });
            session.rangeService.setRange({ ...range, endRow: 50 });
            expect(session.rangeService.range()).toEqual({ ...range, endRow: 50 }); // the setter does not trim: the rows of its tick are not known
            session.hostUpdate();
            expect(session.rangeService.range()).toEqual({ ...range, endRow: 4 });
            session.rangeService.setRange({ ...range, startRow: 20, endRow: 30 });
            session.hostUpdate();
            expect(session.rangeService.range()).toBeNull();
        });

        it('leaves rows alone while none are drawn yet (a table that is loading)', () => {
            const { session } = make({ ...on }, { rowCount: 0 });
            session.rangeService.setRange({ ...range, endRow: 50 });
            expect(session.rangeService.range()).toEqual({ ...range, endRow: 50 });
        });
    });
});

describe('key handlers', () => {
    it.each(SOURCES)('%s registers its handlers with KEY_PRIORITY, never a literal number', (name) => {
        expect(read(name)).not.toMatch(/addKeyHandler\(\s*\d/);
    });

    it('has every handler of the chain on a priority of the one table', () => {
        const users = SOURCES.filter((name) => /addKeyHandler\(\s*KEY_PRIORITY\./.test(read(name)));
        expect(users).toEqual(
            expect.arrayContaining([
                'data-table-cell-interaction-controller.ts',
                'data-table-column-drag-controller.ts',
                'data-table-expansion-controller.ts',
                'data-table-resize-controller.ts',
                'data-table-selection-controller.ts',
            ]),
        );
    });
});

describe('the session files', () => {
    it('import no controller (the boundary rule), only the contract and providers', () => {
        for (const name of ['data-table-edit-session.ts', 'data-table-range-session.ts', 'data-table-cell-session.ts', 'lazy/range.ts']) {
            for (const [, specifier] of read(name).matchAll(/(?:from|import\s*\()\s*['"]([^'"]+)['"]/g)) expect(specifier).not.toMatch(/controller/);
        }
    });
});
