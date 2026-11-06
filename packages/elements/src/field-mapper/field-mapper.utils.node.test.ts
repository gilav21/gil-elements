import { describe, it, expect } from 'vitest';
import { addLink, alignEndRows, filterItems, linkPath, navigate, removeLinks, resolveMaxLinks } from './field-mapper.utils.js';
import type { FieldMapperItem, FieldMapperLink } from './field-mapper.types.js';

const orders: FieldMapperItem[] = [
    { id: 'customer_id', label: 'customer_id' },
    { id: 'region', label: 'region' },
    { id: 'order_id', label: 'order_id' },
    { id: 'placed_at', label: 'placed_at' },
];

const customers: FieldMapperItem[] = [
    { id: 'segment', label: 'segment' },
    { id: 'id', label: 'id' },
    { id: 'name', label: 'name' },
    { id: 'area', label: 'area' },
];

const link = (startId: string, endId: string): FieldMapperLink => ({ startId, endId });
const ids = (rows: readonly (FieldMapperItem | null)[]): (string | null)[] => rows.map(row => row?.id ?? null);

describe('addLink', () => {
    it('moves the oldest link out of an item at its limit instead of doubling up, on either side', () => {
        const oneToOne = resolveMaxLinks({ start: 1, end: 1 });
        const existing = [link('customer_id', 'id'), link('region', 'area')];

        // `id` already belongs to customer_id: drawing order_id → id takes it.
        const toTakenEnd = addLink(existing, link('order_id', 'id'), oneToOne);
        expect(toTakenEnd.links).toEqual([link('region', 'area'), link('order_id', 'id')]);
        expect(toTakenEnd.removed).toEqual([link('customer_id', 'id')]);

        // region already has a partner: drawing region → name replaces it.
        const fromTakenStart = addLink(existing, link('region', 'name'), oneToOne);
        expect(fromTakenStart.links).toEqual([link('customer_id', 'id'), link('region', 'name')]);

        // At a limit above one it is the oldest of the item's links that goes.
        const twoPerStart = resolveMaxLinks({ start: 2, end: 1 });
        const full = [link('region', 'area'), link('customer_id', 'id'), link('region', 'segment')];
        expect(addLink(full, link('region', 'name'), twoPerStart).links).toEqual([
            link('customer_id', 'id'),
            link('region', 'segment'),
            link('region', 'name'),
        ]);
    });

    it('holds every link when the limit is Infinity, and never duplicates an existing one', () => {
        const manyToEnd = resolveMaxLinks({ start: 1, end: Infinity });
        const existing = [link('customer_id', 'id')];

        const both = addLink(existing, link('order_id', 'id'), manyToEnd);
        expect(both.links).toEqual([link('customer_id', 'id'), link('order_id', 'id')]);
        expect(both.removed).toEqual([]);

        const again = addLink(both.links, link('order_id', 'id'), manyToEnd);
        expect(again.links).toBe(both.links);
        expect(again.added).toBeNull();
    });
});

describe('alignEndRows', () => {
    it('puts each linked end item on its partner’s row and keeps the unlinked in their order in the free rows', () => {
        const rows = alignEndRows(orders, customers, [link('customer_id', 'id'), link('order_id', 'area')]);
        expect(ids(rows)).toEqual(['id', 'segment', 'area', 'name']);
    });

    it('leaves a row empty when there are not enough unlinked items to fill above a linked one', () => {
        const twoEnds = customers.slice(1, 3); // id, name
        expect(ids(alignEndRows(orders, twoEnds, [link('placed_at', 'name')]))).toEqual(['id', null, null, 'name']);
    });

    it('sits a shared end item level with its highest partner and pushes a second partner of one start item down', () => {
        const shared = alignEndRows(orders, customers, [link('order_id', 'area'), link('region', 'area')]);
        expect(ids(shared)).toEqual(['segment', 'area', 'id', 'name']);

        const fanOut = alignEndRows(orders, customers, [link('customer_id', 'name'), link('customer_id', 'id')]);
        // Both want row 0; the one earlier in the end list wins it.
        expect(ids(fanOut)).toEqual(['id', 'name', 'segment', 'area']);
    });
});

describe('filterItems, removeLinks, linkPath and navigate', () => {
    it('filters by label ignoring case and surrounding space, and keeps everything for an empty query', () => {
        expect(filterItems(orders, '  ORDER ').map((item) => item.id)).toEqual(['order_id']);
        expect(filterItems(orders, '')).toBe(orders);
        expect(filterItems(orders, 'zzz')).toEqual([]);
    });

    it('removes exactly the matching links and reports them', () => {
        const links = [link('region', 'area'), link('order_id', 'id'), link('region', 'name')];
        const change = removeLinks(links, (l) => l.startId === 'region');
        expect(change.links).toEqual([link('order_id', 'id')]);
        expect(change.removed).toEqual([link('region', 'area'), link('region', 'name')]);
        expect(removeLinks(links, () => false).links).toBe(links);
    });

    it('draws a level pair as a straight line and an offset pair through its midpoint', () => {
        expect(linkPath(0, 10, 100, 10)).toBe('M 0 10 C 50 10 50 10 100 10');
        expect(linkPath(0, 0, 100, 40)).toBe('M 0 0 C 50 0 50 40 100 40');
    });

    it('walks the visual order, stops at both ends, and ignores keys that do not navigate', () => {
        const ids = ['a', 'b', 'c'];
        expect(navigate(ids, 'a', 'ArrowDown')).toBe('b');
        expect(navigate(ids, 'c', 'ArrowDown')).toBe('c');
        expect(navigate(ids, 'a', 'ArrowUp')).toBe('a');
        expect(navigate(ids, 'b', 'Home')).toBe('a');
        expect(navigate(ids, 'b', 'End')).toBe('c');
        expect(navigate(ids, null, 'ArrowDown')).toBe('a');
        expect(navigate(ids, 'a', 'x')).toBeNull();
        expect(navigate([], null, 'ArrowDown')).toBeNull();
    });
});
