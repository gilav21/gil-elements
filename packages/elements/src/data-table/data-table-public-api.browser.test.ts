import { describe, expect, it } from 'vitest';
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
    it('answer from the controller\'s services like cellRange does: editingCell / startEditing / focusedCell reach the interaction service', async () => {
        const table = await mountTable();
        const service = table.provider('interaction') as unknown as Record<string, unknown>;
        service['editingCell'] = () => ({ rowIndex: 3, columnKey: 'name' });
        service['startEditing'] = () => true;
        service['focusedCell'] = () => ({ rowIndex: 2, columnKey: 'age' });
        table.remove(); // the provider entries are gone
        expect(table.provider('interaction')).toBeUndefined();
        expect(table.editingCell).toEqual({ rowIndex: 3, columnKey: 'name' });
        expect(table.isEditingCell()).toBe(true);
        expect(table.startEditing(table.data[0]!, 'name')).toBe(true);
        expect(table.focusedCell).toEqual({ rowIndex: 2, columnKey: 'age' });
    });
});

describe('clearAdvancedFilter', () => {
    it('writes the model: the advanced filter is cleared (rows unfiltered, one advanced-filter-change) and the page resets', async () => {
        const table = await mountTable({ data: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: i % 2 ? 'odd' : 'even', age: i })), paginationState: { pageIndex: 1, pageSize: 5 } });
        table.model.set('advancedFilter', { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'equals', value: 'odd' }] });
        await settle(table);
        const events: unknown[] = [];
        const pages: unknown[] = [];
        table.addEventListener('advanced-filter-change', (event) => events.push((event as CustomEvent).detail));
        table.addEventListener('page-change', (event) => pages.push((event as CustomEvent).detail));
        table.clearAdvancedFilter();
        await settle(table);
        expect(table.model.get('advancedFilter')).toBeNull();
        expect(events).toEqual([null]);
        expect(pages).toEqual([{ pageIndex: 0, pageSize: 5 }]);
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
