import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', async (importActual) => ({ ...(await importActual<typeof import('./data-table-config-check.js')>()), validateConfig }));

import { ROW_DRAG_SORT_WARNING } from './data-table-config-check.js';
import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

type Sort = { column: string; direction: 'asc' | 'desc' | null };

/** A host whose sort state is replaced between renders, the way a header click does. */
function setup(config: Record<string, unknown>, rows: unknown[] = []): {
    run(): void;
    sort(column: string, direction?: Sort['direction']): void;
    multiSort(chain: Sort[]): void;
    config: Record<string, unknown>;
} {
    let sortState: Sort = { column: 'a', direction: 'asc' };
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
        model: { get: (key: string) => (key === 'sortState' ? sortState : key === 'data' ? rows : key === 'multiSortState' ? multi : undefined) },
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
let warn: ReturnType<typeof vi.spyOn>;
const warnedDragSort = (): boolean => warn.mock.calls.some((call) => call[0] === ROW_DRAG_SORT_WARNING);

describe('the diagnostics snapshot', () => {
    beforeEach(() => {
        validateConfig.mockClear();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it.each([
        ['row drag off', { enableRowDrag: false }],
        ['row drag with local reorder', DRAG],
        ['row drag without local reorder', { enableRowDrag: true, localReorder: false }],
    ])('never re-runs the config check for a sort change (%s)', (_name, config) => {
        const table = setup(config);
        table.run();
        table.sort('b');
        table.run();
        table.sort('a', null);
        table.run();
        table.sort('c', 'asc');
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

    it('does not re-run the config check when localReorder changes (no snapshot key reads it)', () => {
        const table = setup({ enableRowDrag: true, localReorder: false });
        table.run();
        table.config['localReorder'] = true;
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

describe('the row-drag-with-sort warning', () => {
    beforeEach(() => {
        validateConfig.mockClear();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());

    it.each([
        ['a single sort, multi-sort off', { enableMultiSort: false }, null, true],
        ['multi-sort on with an empty chain (the single sort is ignored)', { enableMultiSort: true }, [], false],
        ['multi-sort on with a chain entry', { enableMultiSort: true }, [{ column: 'b', direction: 'asc' }], true],
        ['multi-sort on with only a direction-less entry', { enableMultiSort: true }, [{ column: 'b', direction: null }], false],
        ['a server sort (localSorting off)', { localSorting: false }, null, false],
        ['tree mode without sub-row sorting', { enableSubRows: true }, null, false],
        ['tree mode with sub-row sorting', { enableSubRows: true, enableSubRowSorting: true }, null, true],
        ['local reorder off', { localReorder: false }, null, false],
        ['row drag off', { enableRowDrag: false }, null, false],
    ] as const)('follows the table’s own sort rule: %s', (_name, config, chain, expected) => {
        const table = setup({ ...DRAG, ...config });
        if (chain) table.multiSort([...chain]);
        table.run();
        expect(warnedDragSort()).toBe(expected);
    });

    it('ignores a stale multi chain while multi-sort is off (the single sort decides)', () => {
        const table = setup(DRAG);
        table.sort('a', null);
        table.multiSort([{ column: 'b', direction: 'asc' }]);
        table.run();
        expect(warnedDragSort()).toBe(false);
    });

    it.each([
        ['an empty sorted column', ''],
        ['a column that is not in the columns', 'removed'],
    ])('%s is not a sort', (_name, column) => {
        const table = setup(DRAG);
        table.sort(column, 'asc');
        table.run();
        expect(warnedDragSort()).toBe(false);
    });

    it('is not about grouping (that warning is validateConfig’s): a group-by without a sort does not print it', () => {
        const table = setup({ ...DRAG, groupBy: 'a' });
        table.sort('a', null);
        table.run();
        expect(warnedDragSort()).toBe(false);
    });

    it('warns once a sort is applied later, and only once', () => {
        const table = setup(DRAG);
        table.sort('a', null);
        table.run();
        expect(warnedDragSort()).toBe(false);
        table.sort('a', 'asc');
        table.run();
        table.sort('b', 'desc');
        table.run();
        expect(warn.mock.calls.filter((call) => call[0] === ROW_DRAG_SORT_WARNING)).toHaveLength(1);
    });
});

describe('the duplicate-id scan', () => {
    beforeEach(() => {
        validateConfig.mockClear();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => warn.mockRestore());
    const dupes = ['x', 'x', 'y'];
    const shared = (): number => warn.mock.calls.filter((call) => String(call[0]).includes('row id(s) are shared')).length;

    it('scans the ids itself when no feature needs them (validateConfig does not)', () => {
        setup({}, dupes).run();
        expect(shared()).toBe(1);
    });

    it('leaves the scan to validateConfig when a feature needs ids (the real scansRowIds)', () => {
        setup({ enableRowSelection: true }, dupes).run();
        // validateConfig is mocked silent here: the controller does not scan a second time.
        expect(shared()).toBe(0);
    });
});
