import { describe, expect, it } from 'vitest';
import { DOM_PROTOCOL, cellAddressOf, requireProvider, rowAddressOf, type DataTableCoreHost } from './data-table-host.js';

/** A stand-in with the three DOM members the protocol helpers use: attributes and `closest` by the attributes they name. */
function fakeEl(attrs: Record<string, string>, parent: ReturnType<typeof fakeEl> | null = null): {
    closest(selector: string): ReturnType<typeof fakeEl> | null;
    getAttribute(name: string): string | null;
} {
    const el = {
        getAttribute: (name: string) => attrs[name] ?? null,
        closest(selector: string): typeof el | null {
            const required = [...selector.replace(/:not\(\[[a-z-]+\]\)/g, '').matchAll(/\[([a-z-]+)\]/g)].map((m) => m[1] as string);
            const forbidden = [...selector.matchAll(/:not\(\[([a-z-]+)\]\)/g)].map((m) => m[1] as string);
            const matches = required.every((a) => a in attrs) && forbidden.every((a) => !(a in attrs));
            return matches ? el : ((parent?.closest(selector) as typeof el | null) ?? null);
        },
    };
    return el;
}

describe('the DOM protocol', () => {
    it('keeps the attribute names every feature reads back', () => {
        expect(DOM_PROTOCOL).toEqual({ rowIndex: 'data-row-index', column: 'data-column', rowId: 'data-row-id', slot: 'data-slot' });
    });

    it('reads the cell address from a node inside a cell', () => {
        const row = fakeEl({ 'data-row-index': '3', 'data-row-id': 'r3' });
        const cell = fakeEl({ 'data-row-index': '3', 'data-column': 'name' }, row);
        const inner = fakeEl({}, cell);
        expect(cellAddressOf(inner)).toEqual({ rowIndex: 3, columnKey: 'name' });
    });

    it('reads the row address, with the id, from a node inside a cell or on the row', () => {
        const row = fakeEl({ 'data-row-index': '3', 'data-row-id': 'r3' });
        const cell = fakeEl({ 'data-row-index': '3', 'data-column': 'name' }, row);
        expect(rowAddressOf(cell)).toEqual({ rowIndex: 3, rowId: 'r3' });
        expect(rowAddressOf(row)).toEqual({ rowIndex: 3, rowId: 'r3' });
    });

    it.each([null, undefined, {}, fakeEl({})])('finds no address in %j', (target) => {
        expect(cellAddressOf(target)).toBeNull();
        expect(rowAddressOf(target)).toBeNull();
    });

    it('rejects a non-numeric row index', () => {
        expect(cellAddressOf(fakeEl({ 'data-row-index': 'x', 'data-column': 'a' }))).toBeNull();
    });
});

describe('requireProvider', () => {
    const hostWith = (provided: unknown) => ({ provider: () => provided }) as unknown as DataTableCoreHost;

    it('returns what is provided', () => {
        const query = {};
        expect(requireProvider(hostWith(query), 'query')).toBe(query);
    });

    it('names the missing service, so a wrong controller order is easy to read', () => {
        expect(() => requireProvider(hostWith(undefined), 'query')).toThrow(/service 'query' is not provided yet/);
    });
});
