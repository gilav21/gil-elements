import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', () => ({ validateConfig, scansRowIds: () => false }));

import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

type Sort = { column: string; direction: 'asc' | 'desc' | null };

/** A host whose sort state is replaced between renders, the way a header click does. */
function setup(config: Record<string, unknown>): {
    run(): void;
    sort(column: string, direction?: Sort['direction']): void;
    multiSort(chain: Sort[]): void;
    config: Record<string, unknown>;
} {
    let sortState: Sort = { column: 'a', direction: 'asc' };
    const data: unknown[] = [];
    let multi: Sort[] = [];
    const base = {
        columns: [{ accessorKey: 'a' }, { accessorKey: 'b' }, { accessorKey: 'c' }],
        getRowId: (row: unknown) => String(row),
        localPagination: true,
        showPagination: true,
        enableVirtualScroll: false,
        enableRowDrag: false,
        localReorder: true,
        localSorting: true,
        enableMultiSort: false,
        enableSubRows: false,
        enableSubRowSorting: false,
        ...config,
    };
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
        sort: (column, direction = 'desc') => void (sortState = { column, direction }),
        multiSort: (chain) => void (multi = chain),
    };
}

const lastInput = (): Record<string, unknown> => validateConfig.mock.calls.at(-1)?.[0] as Record<string, unknown>;
const DRAG = { enableRowDrag: true, localReorder: true };

describe('the diagnostics snapshot', () => {
    beforeEach(() => validateConfig.mockClear());

    it.each([
        ['row drag off', { enableRowDrag: false }],
        ['row drag with local reorder', DRAG],
        ['row drag without local reorder', { enableRowDrag: true, localReorder: false }],
    ])('does not re-run the config check when only the sorted column changes (%s)', (_name, config) => {
        const table = setup(config);
        table.run();
        table.sort('b');
        table.run();
        table.sort('c');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it('does not re-run when a sort is cleared or applied without row drag', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        expect(lastInput()['rowDragOrderOverridden']).toBe(false);
        table.sort('a', null);
        table.run();
        table.sort('a', 'asc');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it('re-runs when the sort is cleared and re-applied during row drag with local reorder', () => {
        const table = setup(DRAG);
        table.run();
        expect(lastInput()['rowDragOrderOverridden']).toBe(true);
        table.sort('a', null);
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['rowDragOrderOverridden']).toBe(false);
        table.sort('a', 'asc');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(3);
        expect(lastInput()['rowDragOrderOverridden']).toBe(true);
    });

    it.each([
        ['a single sort, multi-sort off', { enableMultiSort: false }, null, true],
        ['a stale multi chain while multi-sort is off', { enableMultiSort: false }, [{ column: 'b', direction: 'asc' }], true],
        ['multi-sort on with an empty chain (the single sort is ignored)', { enableMultiSort: true }, [], false],
        ['multi-sort on with a chain entry', { enableMultiSort: true }, [{ column: 'b', direction: 'asc' }], true],
        ['multi-sort on with only a direction-less entry', { enableMultiSort: true }, [{ column: 'b', direction: null }], false],
        ['a server sort (localSorting off)', { localSorting: false }, null, false],
        ['tree mode without sub-row sorting', { enableSubRows: true }, null, false],
        ['tree mode with sub-row sorting', { enableSubRows: true, enableSubRowSorting: true }, null, true],
        ['local reorder off', { localReorder: false }, null, false],
    ] as const)('rowDragOrderOverridden follows the table’s own rule: %s', (_name, config, chain, expected) => {
        const table = setup({ ...DRAG, ...config });
        if (chain) table.multiSort([...chain]);
        table.run();
        expect(lastInput()['rowDragOrderOverridden']).toBe(expected);
    });

    it.each([
        ['an empty sorted column', ''],
        ['a column that is not in the columns', 'removed'],
    ])('%s is not a sort', (_name, column) => {
        const table = setup(DRAG);
        table.sort(column, 'asc');
        table.run();
        expect(lastInput()['rowDragOrderOverridden']).toBe(false);
    });

    it.each([
        ['localSorting', false],
        ['enableMultiSort', true],
    ])('re-runs with a fresh rowDragOrderOverridden when %s changes at runtime', (flag, value) => {
        const table = setup(DRAG);
        table.run();
        table.config[flag] = value;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['rowDragOrderOverridden']).toBe(false);
    });

    it('follows the columns: losing the sorted column clears it, keeping it does not', () => {
        const table = setup(DRAG);
        table.run();
        table.config['columns'] = [{ accessorKey: 'a' }];
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['rowDragOrderOverridden']).toBe(true);
        table.config['columns'] = [{ accessorKey: 'b' }];
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(3);
        expect(lastInput()['rowDragOrderOverridden']).toBe(false);
    });

    it.each([
        ['a plain group-by', {}, true],
        ['group-by with sub-rows (ignored by the table)', { enableSubRows: true }, false],
    ])('a group-by overrides the drawn order too: %s', (_name, config, expected) => {
        const table = setup({ ...DRAG, groupBy: 'a', ...config });
        table.sort('a', null);
        table.run();
        expect(lastInput()['rowDragOrderOverridden']).toBe(expected);
    });

    it('does not re-run when localReorder changes without row drag', () => {
        const table = setup({ enableRowDrag: false, localReorder: false });
        table.run();
        table.config['localReorder'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
    });

    it.each(['enableFillHandle', 'enableClipboardPaste'])('re-runs the config check when %s changes and passes it', (flag) => {
        const table = setup({ [flag]: false });
        table.run();
        table.config[flag] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()[flag]).toBe(true);
    });

    it('still re-runs it when a setting a check reads changes', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        table.config['enableRowDrag'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
    });
});
