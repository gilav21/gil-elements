import { describe, expect, it } from 'vitest';
import { buildTreeFromFlat, buildTreeIndex, filterTree, flattenTree, sortTree, type TreeFilterInput } from './data-table-tree.js';
import type { ColumnDef } from './data-table.types.js';

interface Node {
    id: string;
    name: string;
    parentId?: string | null;
    children?: Node[];
}

const getId = (n: Node) => n.id;
const getChildren = (n: Node) => n.children;
const setChildren = (n: Node, children: Node[]): Node => ({ ...n, children });
const leaf = (id: string, name = id): Node => ({ id, name });
const node = (id: string, children: Node[], name = id): Node => ({ id, name, children });

const COLS: ColumnDef<Node>[] = [{ accessorKey: 'name', header: 'N', enableFiltering: true }];
const TREE: Node[] = [
    node('1', [node('1-1', [leaf('1-1-1', 'deep')]), leaf('1-2', 'beta')], 'root a'),
    node('2', [leaf('2-1', 'gamma')], 'root b'),
];
const f = (mode: TreeFilterInput<Node>['mode'], text: string): TreeFilterInput<Node> => ({
    columns: COLS, globalFilter: text, columnFilters: {}, mode, getChildren, setChildren,
});
const ids = (rows: Node[]): string[] => rows.flatMap((r) => [r.id, ...ids(r.children ?? [])]);

describe('buildTreeFromFlat', () => {
    const flat: Node[] = [
        { id: '1', parentId: null, name: 'Root A' },
        { id: '2', parentId: null, name: 'Root B' },
        { id: '1-1', parentId: '1', name: 'A1' },
        { id: '1-2', parentId: '1', name: 'A2' },
        { id: '2-1', parentId: '2', name: 'B1' },
        { id: '1-1-1', parentId: '1-1', name: 'A1-1' },
    ];
    const build = (rows: Node[]) => buildTreeFromFlat(rows, getId, (r) => r.parentId ?? null, setChildren);

    it('builds nested children and leaves leaves without a children key', () => {
        const tree = build(flat);
        expect(tree.map((t) => t.id)).toEqual(['1', '2']);
        expect(tree[0]?.children?.map((c) => c.id)).toEqual(['1-1', '1-2']);
        expect(tree[0]?.children?.[0]?.children?.[0]?.name).toBe('A1-1');
        expect(tree[1]?.children?.[0]?.children).toBeUndefined();
    });
    it('returns an empty tree for empty input', () => {
        expect(build([])).toEqual([]);
    });
    it('drops orphans and pure cycles (documented)', () => {
        expect(build([{ id: 'x', parentId: 'missing', name: 'o' }])).toEqual([]);
        expect(build([{ id: 'a', parentId: 'b', name: '' }, { id: 'b', parentId: 'a', name: '' }])).toEqual([]);
    });
    it('does not mutate its input', () => {
        const copy = JSON.stringify(flat);
        build(flat);
        expect(JSON.stringify(flat)).toBe(copy);
    });
});

describe('filterTree', () => {
    it('returns the input when nothing filters', () => {
        expect(filterTree(TREE, f('includeChildren', ''))).toBe(TREE);
    });
    it('includeChildren: a match keeps all its children; a non-matching parent keeps only matching branches', () => {
        expect(ids(filterTree(TREE, f('includeChildren', 'root a')))).toEqual(['1', '1-1', '1-1-1', '1-2']);
        expect(ids(filterTree(TREE, f('includeChildren', 'deep')))).toEqual(['1', '1-1', '1-1-1']);
    });
    it('includeParentOnChildMatch: ancestors of a match survive; a matching parent keeps only matching children', () => {
        expect(ids(filterTree(TREE, f('includeParentOnChildMatch', 'gamma')))).toEqual(['2', '2-1']);
        expect(ids(filterTree(TREE, f('includeParentOnChildMatch', 'root b')))).toEqual(['2']);
    });
    it('excludeChildren: only top-level rows are tested', () => {
        expect(ids(filterTree(TREE, f('excludeChildren', 'gamma')))).toEqual([]);
        expect(ids(filterTree(TREE, f('excludeChildren', 'root b')))).toEqual(['2', '2-1']);
    });
    it('does not mutate the source rows', () => {
        const before = JSON.stringify(TREE);
        filterTree(TREE, f('includeParentOnChildMatch', 'deep'));
        expect(JSON.stringify(TREE)).toBe(before);
    });
});

describe('sortTree', () => {
    it('sorts siblings at every level and leaves no sorts as a copy', () => {
        const sorted = sortTree(TREE, [{ column: 'name', direction: 'desc' }], COLS, getChildren, setChildren);
        expect(ids(sorted)).toEqual(['2', '2-1', '1', '1-2', '1-1', '1-1-1']);
        const same = sortTree(TREE, [], COLS, getChildren, setChildren);
        expect(same).not.toBe(TREE);
        expect(ids(same)).toEqual(ids(TREE));
    });
});

describe('flattenTree', () => {
    const o = (expanded: Record<string, boolean>, defaultExpandedDepth: number) => ({ getId, getChildren, expanded, defaultExpandedDepth });

    it('flattens expanded rows with depth, path, parent and flags', () => {
        const rows = flattenTree(TREE, o({}, -1));
        expect(rows.map((r) => r.row.id)).toEqual(['1', '1-1', '1-1-1', '1-2', '2', '2-1']);
        expect(rows[2]).toMatchObject({ depth: 2, parentId: '1-1', path: ['1', '1-1', '1-1-1'], isLeaf: true, isExpanded: false });
        expect(rows[1]).toMatchObject({ isLeaf: false, childCount: 1, isExpanded: true });
    });
    it('collapsed by default shows only roots; the depth default expands shallow levels', () => {
        expect(flattenTree(TREE, o({}, 0)).map((r) => r.row.id)).toEqual(['1', '2']);
        expect(flattenTree(TREE, o({}, 1)).map((r) => r.row.id)).toEqual(['1', '1-1', '1-2', '2', '2-1']);
    });
    it('an explicit entry beats the default, and prototype-named ids are not entries', () => {
        expect(flattenTree(TREE, o({ '1': false }, -1)).map((r) => r.row.id)).toEqual(['1', '2', '2-1']);
        expect(flattenTree(TREE, o({ '2': true }, 0)).map((r) => r.row.id)).toEqual(['1', '2', '2-1']);
        const odd = [node('constructor', [leaf('c')])];
        expect(flattenTree(odd, o({}, 0)).map((r) => r.row.id)).toEqual(['constructor']);
    });
    it('copes with empty input and null children', () => {
        expect(flattenTree([], o({}, -1))).toEqual([]);
        expect(flattenTree([{ id: 'n', name: 'n', children: undefined }], o({}, -1))).toHaveLength(1);
    });
});

describe('buildTreeIndex', () => {
    it('indexes children, descendants (pre-order), parents and nodes', () => {
        const ix = buildTreeIndex(TREE, getId, getChildren);
        expect(ix.children.get('1')).toEqual(['1-1', '1-2']);
        expect(ix.children.get('2-1')).toEqual([]);
        expect(ix.descendants.get('1')).toEqual(['1-1', '1-1-1', '1-2']);
        expect(ix.parent.get('1-1-1')).toBe('1-1');
        expect(ix.parent.has('1')).toBe(false);
        expect(ix.nodes.get('2-1')).toBe(TREE[1]?.children?.[0]);
    });
    it('handles a very deep chain without overflowing for a modest depth', () => {
        let chain: Node = leaf('n0');
        for (let i = 1; i < 2000; i++) chain = node(`n${i}`, [chain]);
        expect(buildTreeIndex([chain], getId, getChildren).descendants.get('n1999')).toHaveLength(1999);
    });
});
