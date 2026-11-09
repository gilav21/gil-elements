import { afterEach, describe, expect, it, vi } from 'vitest';
import { findCellAdapter, registerCellAdapter, resolveCellKind, warnMissingAdapter } from './data-table-cell-adapters.js';
import type { CellAdapter, CellContext, CellInstance } from './data-table.types.js';

class FakeComponent {}
class OtherComponent {}

function fakeAdapter(id: string, matchesClass: unknown, log: string[] = []): CellAdapter {
    return {
        id,
        matches: (c) => c === matchesClass,
        mount: (_host, _component, _ctx, bindings): CellInstance => {
            log.push(`mount:${id}:${Object.keys(bindings.inputs).join(',')}`);
            return {
                update: (_c, inputs) => log.push(`update:${id}:${JSON.stringify(inputs)}`),
                dispose: () => log.push(`dispose:${id}`),
            };
        },
    };
}

const undo: (() => void)[] = [];
const reg = (a: CellAdapter) => {
    const off = registerCellAdapter(a);
    undo.push(off);
    return off;
};
afterEach(() => {
    while (undo.length) undo.pop()?.();
});

describe('cell adapters', () => {
    it('ignores strings and missing components', () => {
        reg(fakeAdapter('a', FakeComponent));
        expect(findCellAdapter('ge-badge')).toBeUndefined();
        expect(findCellAdapter(undefined)).toBeUndefined();
        expect(findCellAdapter(OtherComponent)).toBeUndefined();
    });

    it('checks the newest registration first and unregisters exactly the one given', () => {
        const older = fakeAdapter('older', FakeComponent);
        const newer = fakeAdapter('newer', FakeComponent);
        reg(older);
        const offNewer = reg(newer);
        expect(findCellAdapter(FakeComponent)?.id).toBe('newer');
        offNewer();
        offNewer();
        expect(findCellAdapter(FakeComponent)?.id).toBe('older');
    });

    it('drives an instance through mount, update and dispose', () => {
        const log: string[] = [];
        const adapter = fakeAdapter('a', FakeComponent, log);
        reg(adapter);
        const ctx = { row: {}, value: 1, column: { accessorKey: 'x', header: 'X' }, rowIndex: 0 } as CellContext<unknown>;
        const instance = findCellAdapter(FakeComponent)?.mount({} as HTMLElement, FakeComponent, ctx, { inputs: { v: 1 }, outputs: {} });
        instance?.update(ctx, { v: 2 });
        instance?.dispose();
        expect(log).toEqual(['mount:a:v', 'update:a:{"v":2}', 'dispose:a']);
    });

    it('warns once per component about a missing adapter, never for strings', () => {
        const warn = vi.fn();
        class Orphan {}
        expect(warnMissingAdapter(Orphan, warn)).toBe(true);
        expect(warnMissingAdapter(Orphan, warn)).toBe(false);
        expect(warnMissingAdapter('ge-badge', warn)).toBe(false);
        expect(warnMissingAdapter(undefined, warn)).toBe(false);
        expect(warnMissingAdapter(42, warn)).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
    });
});

describe('resolveCellKind', () => {
    const cellRenderer = () => 'x';

    it('a tag name wins over a renderer', () => {
        expect(resolveCellKind({ component: 'ge-badge', cellRenderer })).toBe('tag');
    });

    it('a framework component with an adapter is an adapter cell, and without one falls through', () => {
        expect(resolveCellKind({ component: FakeComponent, cellRenderer })).toBe('renderer');
        reg(fakeAdapter('a', FakeComponent));
        expect(resolveCellKind({ component: FakeComponent, cellRenderer })).toBe('adapter');
        expect(resolveCellKind({ component: FakeComponent })).toBe('adapter');
    });

    it('then renderer, then text', () => {
        expect(resolveCellKind({ cellRenderer })).toBe('renderer');
        expect(resolveCellKind({})).toBe('text');
        expect(resolveCellKind({ component: '' })).toBe('text');
        expect(resolveCellKind({ component: OtherComponent })).toBe('text');
    });
});
