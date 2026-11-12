import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', () => ({ validateConfig }));

import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

/** A host whose sort state is replaced between renders, the way a header click does. */
type Sort = { column: string; direction: 'asc' | 'desc' | null };

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
        localReorder: true,
        localSorting: true,
        enableMultiSort: false,
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

describe('the diagnostics snapshot', () => {
    beforeEach(() => validateConfig.mockClear());

    it.each([
        ['row drag off', { enableRowDrag: false }],
        ['row drag with local reorder', { enableRowDrag: true, localReorder: true }],
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

    it('re-runs it when the sort is turned off or on during row drag with local reorder, and passes sortActive', () => {
        const table = setup({ enableRowDrag: true, localReorder: true });
        table.run();
        expect(lastInput()['sortActive']).toBe(true);
        table.sort('a', null);
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['sortActive']).toBe(false);
    });

    it.each([
        ['a single sort, multi-sort off', { enableMultiSort: false }, null, true],
        ['a stale multi chain while multi-sort is off', { enableMultiSort: false }, [{ column: 'b', direction: 'asc' }], true],
        ['multi-sort on with an empty chain (the single sort is ignored)', { enableMultiSort: true }, [], false],
        ['multi-sort on with a chain entry', { enableMultiSort: true }, [{ column: 'b', direction: 'asc' }], true],
        ['multi-sort on with only a direction-less entry', { enableMultiSort: true }, [{ column: 'b', direction: null }], false],
        ['a server sort (localSorting off)', { localSorting: false }, null, false],
    ] as const)('sortActive follows the table’s own rule: %s', (_name, config, chain, expected) => {
        const table = setup({ enableRowDrag: true, localReorder: true, ...config });
        if (chain) table.multiSort([...chain]);
        table.run();
        expect(lastInput()['sortActive']).toBe(expected);
    });

    it.each([
        ['an empty sorted column', ''],
        ['a column that is not in the columns', 'removed'],
    ])('%s is not a sort', (_name, column) => {
        const table = setup({ enableRowDrag: true, localReorder: true });
        table.sort(column, 'asc');
        table.run();
        expect(lastInput()['sortActive']).toBe(false);
    });

    it.each([
        ['without sub-row sorting', false, false],
        ['with sub-row sorting', true, true],
    ])('in tree mode a sort counts only with sub-row sorting (%s)', (_name, subRowSorting, expected) => {
        const table = setup({ enableRowDrag: true, localReorder: true, enableSubRows: true, enableSubRowSorting: subRowSorting });
        table.run();
        expect(lastInput()['sortActive']).toBe(expected);
    });

    it('re-runs when the sort is turned back on', () => {
        const table = setup({ enableRowDrag: true, localReorder: true });
        table.sort('a', null);
        table.run();
        expect(lastInput()['sortActive']).toBe(false);
        table.sort('a', 'asc');
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['sortActive']).toBe(true);
    });

    it('sortActive appears and disappears with localReorder during row drag, each a re-run', () => {
        const table = setup({ enableRowDrag: true, localReorder: false });
        table.run();
        expect(lastInput()).not.toHaveProperty('sortActive');
        table.config['localReorder'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['sortActive']).toBe(true);
        table.config['localReorder'] = false;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(3);
        expect(lastInput()).not.toHaveProperty('sortActive');
    });

    it('leaves the sort out without row drag, and localReorder too', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        expect(lastInput()).not.toHaveProperty('sortActive');
        expect(lastInput()).not.toHaveProperty('localReorder');
        table.sort('a', null);
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

    it('passes localReorder only during row drag', () => {
        const table = setup({ enableRowDrag: false, localReorder: false });
        table.run();
        table.config['localReorder'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(1);
        table.config['enableRowDrag'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
        expect(lastInput()['localReorder']).toBe(true);
    });

    it('still re-runs it when a setting a check reads changes', () => {
        const table = setup({ enableRowDrag: false });
        table.run();
        table.config['enableRowDrag'] = true;
        table.run();
        expect(validateConfig).toHaveBeenCalledTimes(2);
    });
});
