import { describe, expect, it } from 'vitest';
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

describe('the package index', () => {
    it('exports KEY_PRIORITY, the one public table of the key chain', () => {
        expect(KEY_PRIORITY).toBe(registry);
        expect(KEY_PRIORITY.navigation).toBeGreaterThan(KEY_PRIORITY.range);
    });
});
