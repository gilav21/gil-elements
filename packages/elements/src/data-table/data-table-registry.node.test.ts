import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ORDER, type ControllerSpec, KEY_PRIORITY, createAddonsService, createDataTableSlots, validatePlan } from './data-table-registry.js';
import { TopicBus } from '../shared/registry.js';
import type { DataTableTopic } from './data-table-host.js';

const spec = (id: string, p: Partial<ControllerSpec> = {}): ControllerSpec =>
    ({ id, provides: [], needs: [], uses: [], reads: [], writes: [], ...p }) as ControllerSpec;

describe('DEFAULT_ORDER', () => {
    it('is a wireable plan: needs come earlier, lazy uses exist, every topic read is published', () => {
        expect(validatePlan(DEFAULT_ORDER)).toEqual([]);
    });

    it('names the corrected split: one cell-interaction, no peer focus, edit, range, tree or grouping controllers', () => {
        const ids = DEFAULT_ORDER.map((s) => s.id) as string[];
        expect(ids).toContain('cell-interaction');
        for (const gone of ['focus', 'edit', 'range', 'tree', 'grouping']) expect(ids).not.toContain(gone);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('lets selection, expansion and resize provide their services, and cell-interaction use the first two lazily', () => {
        const plan = new Map(DEFAULT_ORDER.map((s) => [s.id, s]));
        expect(plan.get('selection')?.provides).toEqual(['selection']);
        expect(plan.get('expansion')?.provides).toEqual(['expansion']);
        expect(plan.get('resize')?.provides).toEqual(['resize']);
        expect(plan.get('cell-interaction')?.uses).toEqual(['selection', 'expansion']);
        expect(plan.get('cell-interaction')?.needs).not.toContain('selection');
    });

    it('starts with columns then query, and ends with the addon host', () => {
        expect(DEFAULT_ORDER.slice(0, 2).map((s) => s.id)).toEqual(['columns', 'query']);
        expect(DEFAULT_ORDER.at(-1)?.id).toBe('addon-host');
    });
});

describe('the plan after the joint step 0 of waves 5 and 6', () => {
    const plan = new Map(DEFAULT_ORDER.map((s) => [s.id, s]));

    it('gives every new service one provider: range with cell-interaction, the rest with their own controller', () => {
        expect(plan.get('cell-interaction')?.provides).toEqual(['interaction', 'range']);
        expect(plan.get('clipboard')?.provides).toEqual(['clipboard']);
        expect(plan.get('row-drag')?.provides).toEqual(['rowDrag']);
        expect(plan.get('filter-ui')?.provides).toEqual(['filters']);
        const providers = DEFAULT_ORDER.flatMap((s) => s.provides);
        expect(new Set(providers).size).toBe(providers.length);
    });

    it('reaches range, selection and virtual lazily from clipboard and row-drag, and the cell topic from the flash', () => {
        expect(plan.get('clipboard')?.needs).toEqual(['query', 'columns', 'interaction']);
        expect(plan.get('clipboard')?.uses).toEqual(expect.arrayContaining(['range', 'selection']));
        expect(plan.get('row-drag')?.uses).toEqual(expect.arrayContaining(['selection', 'expansion', 'virtual']));
        expect(plan.get('formatting')?.writes).toContain('cell');
    });

    it('stays valid as a whole, and flags a lazy use of a service nobody provides', () => {
        expect(validatePlan(DEFAULT_ORDER)).toEqual([]);
        const withoutRange = DEFAULT_ORDER.map((s) => (s.id === 'cell-interaction' ? { ...s, provides: ['interaction' as const] } : s));
        expect(validatePlan(withoutRange)).toEqual(["'clipboard' uses 'range', but no controller provides it"]);
        const withoutFilters = DEFAULT_ORDER.map((s) => (s.id === 'filter-ui' ? { ...s, provides: [] } : s));
        expect(validatePlan(withoutFilters)).toEqual([]);
    });
});

describe('KEY_PRIORITY', () => {
    it('is the one table, in the documented order, with distinct priorities', () => {
        const order = Object.entries(KEY_PRIORITY)
            .sort(([, a], [, b]) => a - b)
            .map(([owner]) => owner);
        expect(order).toEqual(['editor', 'clipboard', 'columnResize', 'history', 'columnDrag', 'range', 'rowMove', 'rowControls', 'editStart', 'reserved', 'navigation']);
        const values = Object.values(KEY_PRIORITY);
        expect(new Set(values).size).toBe(values.length);
    });

    it('keeps the numbers the grid had before waves 5 and 6 (addKeyHandler is public API): resize 20, column drag 30, selection and expansion 50, navigation 100', () => {
        expect(KEY_PRIORITY.columnResize).toBe(20);
        expect(KEY_PRIORITY.columnDrag).toBe(30);
        expect(KEY_PRIORITY.rowControls).toBe(50);
        expect(KEY_PRIORITY.navigation).toBe(100);
        // the new priorities sit in the gaps and move none of them
        expect([KEY_PRIORITY.history, KEY_PRIORITY.range]).toEqual([25, 35]);
    });

    it('puts the open editor before every other handler and plain navigation after them all', () => {
        const { editor, navigation, ...others } = KEY_PRIORITY;
        for (const priority of Object.values(others)) {
            expect(priority).toBeGreaterThan(editor);
            expect(priority).toBeLessThan(navigation);
        }
    });

    it('lets clipboard, history and range run before the row controls, and Enter / F2 after them but before navigation', () => {
        expect(KEY_PRIORITY.clipboard).toBeLessThan(KEY_PRIORITY.history);
        expect(KEY_PRIORITY.history).toBeLessThan(KEY_PRIORITY.range);
        expect(KEY_PRIORITY.range).toBeLessThan(KEY_PRIORITY.rowMove);
        expect(KEY_PRIORITY.rowMove).toBeLessThan(KEY_PRIORITY.rowControls);
        expect(KEY_PRIORITY.rowControls).toBeLessThan(KEY_PRIORITY.editStart);
        expect(KEY_PRIORITY.editStart).toBeLessThan(KEY_PRIORITY.navigation);
    });
});

describe('validatePlan', () => {
    it('flags a need that is provided only later, or not at all', () => {
        const plan = [spec('a', { needs: ['query'] }), spec('b', { provides: ['query'] })];
        expect(validatePlan(plan)).toEqual(["'a' needs 'query' at attach, but no earlier controller provides it"]);
        expect(validatePlan([spec('a', { needs: ['query'] })], { strict: false })).toHaveLength(1);
    });

    it('allows a lazy use of a later provider, and flags one nobody provides (strict only)', () => {
        expect(validatePlan([spec('a', { uses: ['query'] }), spec('b', { provides: ['query'] })])).toEqual([]);
        expect(validatePlan([spec('a', { uses: ['query'] })])).toHaveLength(1);
        expect(validatePlan([spec('a', { uses: ['query'] })], { strict: false })).toEqual([]);
    });

    it('flags a service with two providers and an id used twice', () => {
        const plan = [spec('a', { provides: ['query'] }), spec('a', { provides: ['query'] })];
        expect(validatePlan(plan).sort()).toEqual(["controller 'a' appears twice", "service 'query' is provided by both 'a' and 'a'"].sort());
    });

    it('flags a topic that is read and never published, but accepts the ones the element publishes', () => {
        expect(validatePlan([spec('a', { reads: ['rows'] })])).toEqual(["'a' reads topic 'rows', which nothing publishes"]);
        expect(validatePlan([spec('a', { reads: ['config', 'locale'] })])).toEqual([]);
        expect(validatePlan([spec('a', { reads: ['rows'] }), spec('b', { writes: ['rows'] })])).toEqual([]);
    });
});

describe('the default plan and the focus', () => {
    it('lets cell-interaction read the expansion topic, and flags it when nothing writes that topic', () => {
        expect(DEFAULT_ORDER.find((c) => c.id === 'cell-interaction')!.reads).toContain('expansion');
        expect(validatePlan(DEFAULT_ORDER)).toEqual([]);
        const withoutWriter = DEFAULT_ORDER.map((c) => (c.id === 'expansion' ? { ...c, writes: [] } : c));
        expect(validatePlan(withoutWriter)).toContain("'cell-interaction' reads topic 'expansion', which nothing publishes");
    });
});

describe('topics', () => {
    it('are typed names on the shared bus', () => {
        const bus = new TopicBus<DataTableTopic>();
        const fn = vi.fn();
        bus.on('rows', fn);
        bus.emit('rows');
        bus.emit('cell');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('slots', () => {
    it('keep registration order and remove exactly the slot that was added', () => {
        const slots = createDataTableSlots<{ id: number }>();
        const a = { id: 'a', onClick: vi.fn() };
        const b = { id: 'b', onClick: vi.fn() };
        const offA = slots.cellActions.register(a);
        slots.cellActions.register(b);
        slots.headerActions.register({ id: 'h', onClick: vi.fn() });

        expect(slots.cellActions.slots).toEqual([a, b]);
        offA();
        expect(slots.cellActions.slots).toEqual([b]);
        expect(slots.headerActions.slots).toHaveLength(1);
    });
});

describe('the addons service', () => {
    it('requests a render when a slot is added or removed and when the busy label changes', () => {
        const onChange = vi.fn();
        const service = createAddonsService(onChange);
        const off = service.cellActions.register({ id: 'x', onClick: vi.fn() });
        service.headerActions.register({ id: 'y', onClick: vi.fn() });
        off();
        expect(onChange).toHaveBeenCalledTimes(3);

        service.setBusy('Exporting');
        service.setBusy('Exporting');
        expect(service.busyLabel()).toBe('Exporting');
        expect(onChange).toHaveBeenCalledTimes(4);
        service.setBusy(null);
        expect(service.busyLabel()).toBeNull();
    });
});
