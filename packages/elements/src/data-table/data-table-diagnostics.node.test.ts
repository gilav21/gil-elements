import { beforeEach, describe, expect, it, vi } from 'vitest';

const validateConfig = vi.hoisted(() => vi.fn<(input: unknown) => string[]>(() => []));
vi.mock('./data-table-config-check.js', () => ({ validateConfig }));

import { DiagnosticsController } from './data-table-diagnostics-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

/** A host whose sort state is replaced between renders, the way a header click does. */
function setup(config: Record<string, unknown>): { run(): void; sort(column: string, direction?: string | null): void; config: Record<string, unknown> } {
    let sortState: { column: string; direction: string | null } | null = { column: 'a', direction: 'asc' };
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
        sort: (column, direction = 'desc') => void (sortState = { column, direction }),
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
