import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', () => ({ validateConfig }));

import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

/** A host whose sort state is replaced between renders, the way a header click does. */
function setup(config: Record<string, unknown>): { run(): void; sort(column: string): void; config: Record<string, unknown> } {
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
        config: base,
        run: () => controller.hostUpdate(),
        sort: (column) => void (sortState = { column, direction: 'desc' }),
    };
}

describe('the diagnostics snapshot', () => {
    beforeEach(() => validateConfig.mockClear());

    it.each([
        ['row drag off', { enableRowDrag: false }],
        ['row drag with local reorder', { enableRowDrag: true, localReorder: true }],
        ['row drag without local reorder', { enableRowDrag: true, localReorder: false }],
    ])('does not re-run the config check when only the sort changes (%s): no check reads the sort yet', (_name, config) => {
        const table = setup(config);
        table.run();
        table.sort('b');
        table.run();
        table.sort('c');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it('still re-runs it when a setting a check reads changes', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        table.config['enableRowDrag'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
    });
});
