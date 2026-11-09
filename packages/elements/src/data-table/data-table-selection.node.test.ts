import { describe, expect, it } from 'vitest';
import { cascadeSelection, createIndeterminateIds, headerState, isSelectedId, patchSelection, rangeBetween, selectableIds, toggleAllSelection, toggleId } from './data-table-selection.js';
import { buildTreeIndex } from './data-table-tree.js';

interface Node {
    id: string;
    children?: Node[];
}
const node = (id: string, children?: Node[]): Node => (children ? { id, children } : { id });
const TREE = [node('a', [node('a1', [node('a1x'), node('a1y')]), node('a2')]), node('b', [node('b1')]), node('c', [])];
const index = buildTreeIndex(TREE, (n) => n.id, (n) => n.children);
const all = new Set(index.nodes.keys());

describe('toggling', () => {
    it('selects and deselects by deleting the key, never storing false', () => {
        const on = toggleId({}, 'x');
        expect(on).toEqual({ x: true });
        const off = toggleId(on, 'x');
        expect(Object.keys(off)).toEqual([]);
        expect(on).toEqual({ x: true });
    });

    it('treats a consumer-written false as unselected', () => {
        const sel = { x: false };
        expect(isSelectedId(sel, 'x')).toBe(false);
        expect(toggleId(sel, 'x')).toEqual({ x: true });
    });

    it('keeps stale ids and ids that look like prototype keys', () => {
        const sel = patchSelection({ gone: true }, ['__proto__', 'constructor'], true);
        expect(Object.keys(sel).sort()).toEqual(['__proto__', 'constructor', 'gone']);
        expect(isSelectedId(sel, '__proto__')).toBe(true);
        expect(isSelectedId({}, 'constructor')).toBe(false);
        expect(Object.keys(patchSelection(sel, ['__proto__'], false)).sort()).toEqual(['constructor', 'gone']);
    });
});

describe('the header', () => {
    it('is unchecked and inert with nothing selectable', () => {
        expect(headerState({ a: true }, [])).toEqual({ checked: false, indeterminate: false, selectableCount: 0 });
        const sel = { a: true };
        expect(toggleAllSelection(sel, [])).toEqual(sel);
    });

    it('is indeterminate for some and checked for all, counting only the selectable ids', () => {
        expect(headerState({ a: true, z: true }, ['a', 'b'])).toEqual({ checked: false, indeterminate: true, selectableCount: 2 });
        expect(headerState({ a: true, b: true }, ['a', 'b']).checked).toBe(true);
    });

    it('selects all from none and from some, clears only the selectable ids from all, leaving off-filter ids', () => {
        expect(toggleAllSelection({}, ['a', 'b'])).toEqual({ a: true, b: true });
        expect(toggleAllSelection({ a: true }, ['a', 'b'])).toEqual({ a: true, b: true });
        expect(toggleAllSelection({ a: true, b: true, hidden: true }, ['a', 'b'])).toEqual({ hidden: true });
    });

    it('leaves disabled rows out of the selectable ids', () => {
        const rows = [{ id: 'a' }, { id: 'b', off: true }, { id: 'c' }];
        expect(selectableIds(rows, (r) => r.id, (r) => 'off' in r)).toEqual(['a', 'c']);
    });
});

describe('cascade', () => {
    it('self is a plain toggle', () => {
        expect(cascadeSelection({}, 'a', 'self', index, all)).toEqual({ a: true });
    });

    it('descendants mirrors onto the whole subtree and selects a parent whose children are all selected', () => {
        const sel = cascadeSelection({}, 'a1', 'descendants', index, all);
        expect(Object.keys(sel).sort()).toEqual(['a1', 'a1x', 'a1y']);
        const up = cascadeSelection(sel, 'a2', 'descendants', index, all);
        expect(isSelectedId(up, 'a')).toBe(true);
    });

    it('deselecting a child deletes the parent keys up the chain', () => {
        const full = cascadeSelection({}, 'a', 'descendants', index, all);
        expect(Object.keys(full).sort()).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2']);
        const less = cascadeSelection(full, 'a1y', 'descendants', index, all);
        expect(isSelectedId(less, 'a1y')).toBe(false);
        expect(isSelectedId(less, 'a1')).toBe(false);
        expect(isSelectedId(less, 'a')).toBe(false);
        expect(isSelectedId(less, 'a1x')).toBe(true);
    });

    it('filteredDescendants only reaches the visible part of the subtree', () => {
        const sel = cascadeSelection({}, 'a', 'filteredDescendants', index, new Set(['a', 'a1x']));
        expect(Object.keys(sel).sort()).toEqual(['a', 'a1x']);
    });

    it('a leaf whose children list is empty and one without the key behave alike', () => {
        expect(cascadeSelection({}, 'c', 'descendants', index, all)).toEqual({ c: true });
        expect(cascadeSelection({}, 'a2', 'descendants', index, all)).toEqual({ a2: true });
    });
});

describe('indeterminate', () => {
    const indeterminate = createIndeterminateIds();
    it('marks nodes with some but not all descendants selected, never in self mode', () => {
        const sel = { a1x: true };
        expect([...indeterminate(sel, index, 'descendants')].sort()).toEqual(['a', 'a1']);
        expect(indeterminate(sel, index, 'self').size).toBe(0);
    });

    it('is remembered per selection identity', () => {
        const sel = { a1x: true };
        expect(indeterminate(sel, index, 'descendants')).toBe(indeterminate(sel, index, 'descendants'));
        expect(indeterminate({ ...sel }, index, 'descendants')).not.toBe(indeterminate(sel, index, 'descendants'));
    });
});

describe('rangeBetween', () => {
    const order = ['a', 'b', 'c', 'd'];
    it('is inclusive and direction-free', () => {
        expect(rangeBetween(order, 'b', 'd')).toEqual(['b', 'c', 'd']);
        expect(rangeBetween(order, 'c', 'a')).toEqual(['a', 'b', 'c']);
    });
    it('is null when an end is not drawn', () => {
        expect(rangeBetween(order, 'a', 'zzz')).toBeNull();
    });
});
