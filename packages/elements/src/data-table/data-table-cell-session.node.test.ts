import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { EditSession } from './data-table-edit-session.js';
import { RangeSession } from './data-table-range-session.js';

const DIRECTORY = new URL('.', import.meta.url);
const SOURCES = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const read = (name: string): string => readFileSync(new URL(name, DIRECTORY), 'utf8');
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

interface Flags {
    enableCellRangeSelection: boolean;
    enableFillHandle: boolean;
}

/** A context with what the range shell reads: the flags, the render request, the focus, the rows and the column keys. */
function rangeContext(flags: Flags, { focused = null, rowCount = 10, keys = ['a', 'b', 'c'] }: { focused?: { rowIndex: number; columnKey: string } | null; rowCount?: number; keys?: string[] } = {}) {
    const requestRender = vi.fn();
    const context = { host: { config: flags, requestRender }, focused: () => focused, rowCount: () => rowCount, focusableKeys: () => keys } as unknown as InteractionContext<unknown>;
    return { context, requestRender, flags };
}
const on: Flags = { enableCellRangeSelection: true, enableFillHandle: false };
const off: Flags = { enableCellRangeSelection: false, enableFillHandle: false };
const range = { startRow: 1, startCol: 'a', endRow: 3, endCol: 'b' };

afterEach(() => vi.restoreAllMocks());

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
        vi.spyOn(session.rangeService, 'isInRange').mockImplementation((r) => r >= 3 && r <= 4);
        expect(session.service.isCellSelected(1, 'a')).toBe(false); // the focused cell is not selected once a range exists elsewhere
        expect(session.service.isCellSelected(3, 'a')).toBe(true);
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
    const make = (flags: Flags = { ...on }, options?: Parameters<typeof rangeContext>[1]) => ({ session: new RangeSession(rangeContext(flags, options).context), flags });

    it('keeps a range set before the part is loaded, and hands it to the part when it attaches', async () => {
        const { session } = make();
        session.rangeService.setRange(range);
        expect(session.rangeService.range()).toEqual(range);
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toEqual(range);
        await vi.waitFor(() => expect(session.rangeService.active()).toBe(true));
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
        flags.enableCellRangeSelection = false;
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
        flags.enableCellRangeSelection = true;
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toBeNull();
    });

    it('ignores a range assigned while range selection and fill are both off: nothing is held and the getter says null', () => {
        const { session, flags } = make({ ...off });
        session.rangeService.setRange(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toBeNull();
        expect(session.service.cellRange()).toBeNull();
        // with the fill handle alone the flags are on, so a range is accepted
        flags.enableFillHandle = true;
        session.rangeService.setRange(range);
        expect(session.rangeService.range()).toEqual(range);
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
            for (const bad of ['a1:b3', { startRow: 'x' }, { ...range, endCol: 'nope' }, 42]) session.rangeService.setRange(bad as never);
            expect(session.rangeService.range()).toEqual(range);
            expect(warn).toHaveBeenCalledTimes(1);
        });

        it('trims rows past the last drawn one, and drops a range wholly past them', () => {
            const { session } = make({ ...on }, { rowCount: 5 });
            session.rangeService.setRange({ ...range, endRow: 50 });
            expect(session.rangeService.range()).toEqual({ ...range, endRow: 4 });
            session.rangeService.setRange({ ...range, startRow: 20, endRow: 30 });
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
