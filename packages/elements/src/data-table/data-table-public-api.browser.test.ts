import { describe, expect, it } from 'vitest';
import { mountTable } from './data-table-fixtures.js';
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
        table.provide('interaction', { focusedCell: () => null, cellRange: () => null, focusCell() {}, isCellSelected: () => false } as never);
        expect(table.startEditing(table.data[0]!, 'name')).toBe(false);
        expect(() => table.commitEdit()).not.toThrow();
        expect(() => table.cancelEdit()).not.toThrow();
        expect(table.editingCell).toBeNull();
        expect(table.cellEditError).toBeNull();
        expect(table.isEditingCell()).toBe(false);
    });
});

describe('the package index', () => {
    it('exports KEY_PRIORITY, the one public table of the key chain', () => {
        expect(KEY_PRIORITY).toBe(registry);
        expect(KEY_PRIORITY.navigation).toBeGreaterThan(KEY_PRIORITY.range);
    });
});
