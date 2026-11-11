import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', () => ({ validateConfig }));

import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

/** A host whose sort state is replaced between renders, the way a header click does. */
function setup(config: Record<string, unknown>): { run(): void; sort(column: string): void } {
    let sortState = { column: 'a', direction: 'asc' };
    const data: unknown[] = [];
    const multi: unknown[] = [];
    const base = { columns: [], getRowId: (row: unknown) => String(row), localPagination: true, showPagination: true, enableVirtualScroll: false, localReorder: true, ...config };
    const host = {
        config: base,
        model: { get: (key: string) => (key === 'sortState' ? sortState : key === 'data' ? data : key === 'multiSortState' ? multi : undefined) },
        provider: () => undefined,
        afterRender: () => undefined,
    } as unknown as DataTableCoreHost<unknown>;
    const controller = new DiagnosticsController(host);
    controller.attach();
    return {
        run: () => controller.hostUpdate(),
        sort: (column) => void (sortState = { column, direction: 'desc' }),
    };
}

describe('the diagnostics snapshot', () => {
    beforeEach(() => validateConfig.mockClear());

    it('does not re-run the config check when only the sort changes and row drag is off', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        table.sort('b');
        table.run();
        table.sort('c');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it('does not re-run it for a sort while row drag is on without local reorder either', () => {
        const table = setup({ enableRowDrag: true, localReorder: false });
        table.run();
        table.sort('b');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it('re-runs it on a sort when row drag reorders locally (the one check that reads the sort)', () => {
        const table = setup({ enableRowDrag: true, localReorder: true });
        table.run();
        table.sort('b');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
    });
});
