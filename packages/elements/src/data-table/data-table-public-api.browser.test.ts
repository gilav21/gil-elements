import { describe, expect, it, vi } from 'vitest';
import { mountTable, settle } from './data-table-fixtures.js';
import { KEY_PRIORITY, type CellAddress, type ClipboardResult, type GeDataTable, type HistoryResult, type StaleChange } from './index.js';
import { KEY_PRIORITY as registry } from './data-table-registry.js';

describe('the types of the public methods', () => {
    it('are exported from the index: undoEdit / redoEdit return a HistoryResult, focusedCell a CellAddress, copy a ClipboardResult (a type-level check: it compiles)', () => {
        const history: HistoryResult = { done: false, stale: [] satisfies readonly StaleChange[] };
        const address: CellAddress | null = null;
        const copied: ClipboardResult = { status: 'done' };
        type Methods = Pick<GeDataTable, 'undoEdit' | 'redoEdit' | 'copyAllToClipboard' | 'focusedCell'>;
        const check: { [K in keyof Methods]: unknown } = {} as Methods;
        expect([history.done, address, copied.status, typeof check]).toEqual([false, null, 'done', 'object']);
    });
});

describe('the edit methods of the element with an old-shaped interaction provider', () => {
    it('do not throw when the provider has no edit methods: startEditing answers false, the rest do nothing, the read-outs answer null', async () => {
        const table = await mountTable();
        // the controller's service (what the element methods read) of an older shape: no edit methods
        const service = table.provider('interaction') as unknown as Record<string, unknown>;
        for (const key of ['startEditing', 'commitEdit', 'cancelEdit', 'editingCell', 'cellEditError', 'isEditing', 'editValue', 'setEditValue']) delete service[key];
        expect(table.startEditing(table.data[0]!, 'name')).toBe(false);
        expect(() => table.commitEdit()).not.toThrow();
        expect(() => table.cancelEdit()).not.toThrow();
        expect(table.editingCell).toBeNull();
        expect(table.cellEditError).toBeNull();
        expect(table.isEditingCell()).toBe(false);
    });
});


describe('the element methods on a DETACHED table', () => {
    it('that need the LIVE grid are inert: focusCell does not throw, focusedCell / editingCell are null, startEditing is false; the held cellRange still works', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        table.focusCell(1, 'name');
        await settle(table);
        const range = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };
        table.cellRange = range;
        table.remove(); // the provider entries are gone
        expect(() => table.focusCell(1, 'name')).not.toThrow(); // no "service 'columns' is not provided yet"
        expect(table.focusedCell).toBeNull(); // not a stale address
        expect(table.editingCell).toBeNull();
        expect(table.isEditingCell()).toBe(false);
        expect(table.startEditing(table.data[0]!, 'name')).toBe(false);
        expect(() => table.commitEdit()).not.toThrow();
        expect(table.cellRange).toEqual(range); // the VALUE survives
    });
});

describe('a cellRange assigned to a live range service', () => {
    it('clears a value held from an earlier gap: it cannot overwrite the newer one at a reconnect', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        const older = { startRow: 0, startCol: 'name', endRow: 0, endCol: 'name' };
        const newer = { startRow: 1, startCol: 'name', endRow: 2, endCol: 'age' };
        (table as unknown as { earlyRange: unknown }).earlyRange = older; // held from a gap in which no real range service existed
        table.cellRange = newer;
        table.remove();
        document.body.append(table);
        await settle(table);
        expect(table.cellRange).toEqual(newer);
    });
});

describe('a controller that throws while drawing', () => {
    it('is reported once and draws nothing (toolbar and overlay alike): the table still renders', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const table = await mountTable();
        const controller = (table as unknown as { assembled: { controllers: Record<string, () => unknown>[] } }).assembled.controllers[0]!;
        controller['renderToolbar'] = () => {
            throw new Error('toolbar failed');
        };
        controller['renderOverlay'] = () => {
            throw new Error('overlay failed');
        };
        table.requestUpdate();
        await settle(table);
        table.requestUpdate();
        await settle(table);
        expect(table.querySelectorAll('[data-slot="table-row"][data-kind="data"]').length).toBeGreaterThan(0);
        const spoken = warn.mock.calls.map((call) => String(call[0]));
        expect(spoken.filter((m) => m.includes('renderToolbar')).length).toBe(1);
        expect(spoken.filter((m) => m.includes('renderOverlay')).length).toBe(1);
        warn.mockRestore();
    });
});

describe('clearAdvancedFilter', () => {
    it('writes the model through the query service: the filter is cleared (one advanced-filter-change) and the page resets BEFORE it, like applyGlobalFilter', async () => {
        const table = await mountTable({ data: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: i % 2 ? 'odd' : 'even', age: i })), paginationState: { pageIndex: 1, pageSize: 5 } });
        table.model.set('advancedFilter', { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'equals', value: 'odd' }] });
        await settle(table);
        const events: unknown[] = [];
        const pages: unknown[] = [];
        const order: string[] = [];
        table.addEventListener('advanced-filter-change', (event) => (events.push((event as CustomEvent).detail), order.push('advanced-filter-change')));
        table.addEventListener('page-change', (event) => (pages.push((event as CustomEvent).detail), order.push('page-change')));
        table.clearAdvancedFilter();
        await settle(table);
        expect(table.model.get('advancedFilter')).toBeNull();
        expect(events).toEqual([null]);
        expect(pages).toEqual([{ pageIndex: 0, pageSize: 5 }]);
        expect(order).toEqual(['page-change', 'advanced-filter-change']);
        table.clearAdvancedFilter(); // nothing to clear: nothing emitted
        expect(events).toHaveLength(1);
    });
});

describe('the package index', () => {
    it('exports KEY_PRIORITY, the one public table of the key chain', () => {
        expect(KEY_PRIORITY).toBe(registry);
        expect(KEY_PRIORITY.navigation).toBeGreaterThan(KEY_PRIORITY.range);
    });
});
