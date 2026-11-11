import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { EditSession } from './data-table-edit-session.js';
import { RangeSession } from './data-table-range-session.js';

const DIRECTORY = new URL('.', import.meta.url);
const SOURCES = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const read = (name: string): string => readFileSync(new URL(name, DIRECTORY), 'utf8');
const context = { focused: () => null } as unknown as InteractionContext<unknown>;

describe('the joint step 0 sessions', () => {
    it('answers "nothing is being edited" and no editor can open', () => {
        const { service } = new EditSession(context);
        expect(service.editingCell?.()).toBeNull();
        expect(service.cellEditError?.()).toBeNull();
        expect(service.startEditing?.({}, 'name')).toBe(false);
        expect(service.isEditing?.(0, 'name')).toBe(false);
        expect(service.editValue?.()).toBeUndefined();
        expect(() => [service.commitEdit?.(), service.cancelEdit?.(), service.setEditValue?.(1)]).not.toThrow();
    });

    it('derives cellRange and isCellSelected from the range service, so one pair is implemented', () => {
        const focused = { rowIndex: 1, columnKey: 'a' };
        const session = new RangeSession({ focused: () => focused } as unknown as InteractionContext<unknown>);
        expect(session.service.isCellSelected(1, 'a')).toBe(true);
        expect(session.service.isCellSelected(2, 'a')).toBe(false);
        const isInRange = vi.spyOn(session.rangeService, 'isInRange').mockImplementation((r) => r === 2);
        expect(session.service.isCellSelected(2, 'a')).toBe(true);
        expect(isInRange).toHaveBeenCalled();
        const range = { startRow: 0, startCol: 'a', endRow: 1, endCol: 'b' };
        session.rangeService.setRange(range);
        expect(session.service.cellRange()).toBe(range);
    });

    it('answers "no range" and no gesture, and fills nothing', () => {
        const session = new RangeSession(context);
        expect(session.service.cellRange()).toBeNull();
        expect(session.service.isCellSelected(0, 'name')).toBe(false);
        const range = session.rangeService;
        expect(range.range()).toBeNull();
        expect(range.normalized()).toBeNull();
        expect(range.isInRange(0, 'name')).toBe(false);
        expect(range.isFillPreview(0, 'name')).toBe(false);
        expect(range.stats()).toBeNull();
        expect(range.chartPayload()).toBeNull();
        expect(range.fillDownTo(3)).toBe(false);
        expect(range.fillHandleCell()).toBeNull();
        expect(range.gestureActive()).toBe(false);
    });
});

describe('the range held by the shell', () => {
    const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
    const range = { startRow: 1, startCol: 'a', endRow: 3, endCol: 'b' };
    const make = (flags = { enableCellRangeSelection: true, enableFillHandle: false }): { session: RangeSession<unknown>; flags: typeof flags } => ({
        session: new RangeSession({ host: { config: flags }, focused: () => null } as unknown as InteractionContext<unknown>),
        flags,
    });

    it('keeps a range set before the part is loaded, and hands it to the part when it attaches', async () => {
        const { session } = make();
        session.rangeService.setRange(range);
        expect(session.rangeService.range()).toBe(range);
        session.hostUpdate();
        await flush();
        expect(session.rangeService.range()).toEqual(range);
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

    it('lets a range set while the flags are off wait, and keeps what the live part holds when the flag stays on', async () => {
        const { session } = make({ enableCellRangeSelection: false, enableFillHandle: false });
        session.rangeService.setRange(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toBe(range);
    });

    it('answers the held range with the flags off', () => {
        const { session } = make({ enableCellRangeSelection: false, enableFillHandle: false });
        session.rangeService.setRange(range);
        session.hostUpdate();
        expect(session.rangeService.range()).toBe(range);
        session.rangeService.setRange(null);
        expect(session.rangeService.range()).toBeNull();
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
