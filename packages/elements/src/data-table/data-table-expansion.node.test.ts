import { describe, expect, it } from 'vitest';
import { allFlagged, allNodesExpanded, collapseAllNodes, depthOf, expandAllNodes, nodeExpanded, setFlags, someFlagged, toggleFlag, treeHostKey, treeKeyAction, withFlag } from './data-table-expansion.js';
import { buildTreeIndex } from './data-table-tree.js';

interface Node {
    id: string;
    children?: Node[];
}
const node = (id: string, children?: Node[]): Node => (children ? { id, children } : { id });
const TREE = [node('a', [node('a1', [node('a1x')]), node('a2')]), node('b', [node('b1')]), node('c')];
const getId = (n: Node) => n.id;
const getChildren = (n: Node) => n.children;

describe('detail row flags', () => {
    it('toggles by adding the key and deleting it again', () => {
        const open = toggleFlag({}, 'r1');
        expect(open).toEqual({ r1: true });
        expect(Object.keys(toggleFlag(open, 'r1'))).toEqual([]);
    });

    it('reads all / some over the given ids only', () => {
        expect(allFlagged({ a: true, b: true }, ['a', 'b'])).toBe(true);
        expect(allFlagged({}, [])).toBe(false);
        expect(someFlagged({ a: true }, ['a', 'b'])).toBe(true);
        expect(someFlagged({ a: true, b: true }, ['a', 'b'])).toBe(false);
    });

    it('opens and closes a set of ids and leaves the rest alone', () => {
        expect(setFlags({ keep: true }, ['a', 'b'], true)).toEqual({ keep: true, a: true, b: true });
        expect(setFlags({ keep: true, a: true }, ['a'], false)).toEqual({ keep: true });
    });

    it('takes a key that looks like a prototype member as an ordinary key', () => {
        const next = toggleFlag({}, '__proto__');
        expect(Object.keys(next)).toEqual(['__proto__']);
        expect(withFlag(next, '__proto__', undefined)).toEqual({});
    });
});

describe('tree nodes', () => {
    it('an own entry wins over the default depth, -1 opens every level', () => {
        expect(nodeExpanded({}, 'x', 0, 1)).toBe(true);
        expect(nodeExpanded({}, 'x', 1, 1)).toBe(false);
        expect(nodeExpanded({ x: false }, 'x', 0, -1)).toBe(false);
        expect(nodeExpanded({}, 'x', 9, -1)).toBe(true);
    });

    it('expandAll replaces the record, to a depth or fully', () => {
        expect(expandAllNodes(TREE, getId, getChildren)).toEqual({ a: true, a1: true, b: true });
        expect(expandAllNodes(TREE, getId, getChildren, 1)).toEqual({ a: true, b: true });
    });

    it('collapseAll pins false on every parent', () => {
        expect(collapseAllNodes(TREE, getId, getChildren)).toEqual({ a: false, a1: false, b: false });
    });

    it('reads "all expanded" through explicit entries and the default', () => {
        expect(allNodesExpanded(TREE, getId, getChildren, {}, 0)).toBe(false);
        expect(allNodesExpanded(TREE, getId, getChildren, {}, -1)).toBe(true);
        expect(allNodesExpanded(TREE, getId, getChildren, { a1: false }, -1)).toBe(false);
        expect(allNodesExpanded([node('c')], getId, getChildren, {}, 0)).toBe(true);
    });

    it('finds depth by the parent index', () => {
        const { parent } = buildTreeIndex(TREE, getId, getChildren);
        expect([depthOf(parent, 'a'), depthOf(parent, 'a1x'), depthOf(parent, 'nope')]).toEqual([0, 2, 0]);
    });
});

describe('tree host and keys', () => {
    it('is the marked column, else the first data column', () => {
        expect(treeHostKey([{ accessorKey: '_selection', header: '' }, { accessorKey: 'a', header: 'A' }, { accessorKey: 'b', header: 'B' }])).toBe('a');
        expect(treeHostKey([{ accessorKey: 'a', header: 'A' }, { accessorKey: 'b', header: 'B', treeExpander: true }])).toBe('b');
        expect(treeHostKey([])).toBeNull();
    });

    it('opens on the inline-start-to-end arrow, closes on the other, flipped in rtl', () => {
        const closed = { isLeaf: false, isExpanded: false };
        const open = { isLeaf: false, isExpanded: true };
        expect(treeKeyAction('ArrowRight', false, closed)).toBe('expand');
        expect(treeKeyAction('ArrowRight', false, open)).toBeNull();
        expect(treeKeyAction('ArrowLeft', false, open)).toBe('collapse');
        expect(treeKeyAction('ArrowLeft', false, closed)).toBeNull();
        expect(treeKeyAction('ArrowLeft', true, closed)).toBe('expand');
        expect(treeKeyAction('ArrowRight', true, open)).toBe('collapse');
        expect(treeKeyAction('ArrowRight', false, { isLeaf: true, isExpanded: false })).toBeNull();
        expect(treeKeyAction('Enter', false, closed)).toBeNull();
    });
});
