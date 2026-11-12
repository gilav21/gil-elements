import { describe, expect, it } from 'vitest';
import { buildRowReorderEvent, dropEdge, dropIndex, dropPosition, isSelfOrDescendant, neighbourIds, reorderFlat, reorderRows, reorderTree, siblingMove, type TreeAccess } from './data-table-row-reorder.js';
import type { RowReorderEvent } from './data-table.types.js';

interface NumRow {
    id: string;
    name: string;
}
// Angular's NUM_DATA names (spec 3954), ids 1..5.
const NUM: NumRow[] = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'].map((name, i) => ({ id: String(i + 1), name }));
const getId = (r: NumRow): string => r.id;
const names = (rows: readonly NumRow[]): string[] => rows.map((r) => r.name);

interface TNode {
    id: string;
    name: string;
    children?: TNode[];
}
const tree: TreeAccess<TNode> = { getRowId: (r) => r.id, getChildren: (r) => r.children, setChildren: (r, children) => ({ ...r, children }) };
const T_DATA: TNode[] = [
    { id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1' }, { id: 'a2', name: 'A2' }] },
    { id: 'b', name: 'B' },
];
const event = <T>(e: Omit<RowReorderEvent<T>, 'previousId' | 'nextId' | 'fromIndex' | 'toIndex'> & Partial<RowReorderEvent<T>>): RowReorderEvent<T> => ({ previousId: null, nextId: null, fromIndex: 0, toIndex: 0, ...e });

describe('dropPosition (Angular computeDragPosition)', () => {
    it('flat: above / below by the half', () => {
        expect(dropPosition('flat', 0.1)).toBe('above');
        expect(dropPosition('flat', 0.49)).toBe('above');
        expect(dropPosition('flat', 0.5)).toBe('below');
        expect(dropPosition('flat', 0.875)).toBe('below'); // spec 4803: clientY 135 on a 40px row at 100
    });

    it('tree: above / on / below by the quarters (spec 5285)', () => {
        expect(dropPosition('tree', 0.1)).toBe('above');
        expect(dropPosition('tree', 0.5)).toBe('on');
        expect(dropPosition('tree', 0.9)).toBe('below');
        expect([dropEdge('above'), dropEdge('on'), dropEdge('below')]).toEqual(['top', 'on', 'bottom']);
    });
});

describe('buildRowReorderEvent', () => {
    it('moving the first row below index 2 gives fromIndex 0, toIndex 2 and the neighbours of the final position (spec 4849)', () => {
        const e = buildRowReorderEvent({ rows: NUM, draggedId: '1', overIndex: 2, position: 'below', getRowId: getId, treeMode: false });
        expect(e).toMatchObject({ row: NUM[0], targetRow: NUM[2], fromIndex: 0, toIndex: 2, previousId: '3', nextId: '4', position: 'below' });
        expect(names(reorderFlat(NUM, e!, getId))).toEqual(['Bob', 'Charlie', 'Alice', 'David', 'Eve']);
    });

    it('moving upwards (from > to): the neighbours are those around the new slot', () => {
        const e = buildRowReorderEvent({ rows: NUM, draggedId: '4', overIndex: 1, position: 'above', getRowId: getId, treeMode: false })!;
        expect(e).toMatchObject({ fromIndex: 3, toIndex: 1, previousId: '1', nextId: '2' });
        expect(names(reorderFlat(NUM, e, getId))).toEqual(['Alice', 'David', 'Bob', 'Charlie', 'Eve']);
    });

    it('at both ends: no previous at the top, no next at the bottom', () => {
        const top = buildRowReorderEvent({ rows: NUM, draggedId: '3', overIndex: 0, position: 'above', getRowId: getId, treeMode: false })!;
        expect(top).toMatchObject({ toIndex: 0, previousId: null, nextId: '1' });
        expect(names(reorderFlat(NUM, top, getId))).toEqual(['Charlie', 'Alice', 'Bob', 'David', 'Eve']);
        const bottom = buildRowReorderEvent({ rows: NUM, draggedId: '2', overIndex: 4, position: 'below', getRowId: getId, treeMode: false })!;
        expect(bottom).toMatchObject({ toIndex: 4, previousId: '5', nextId: null });
        expect(names(reorderFlat(NUM, bottom, getId))).toEqual(['Alice', 'Charlie', 'David', 'Eve', 'Bob']);
    });

    it('is null for a drop where the row already is (beyond Angular, which emits a no-op event)', () => {
        expect(buildRowReorderEvent({ rows: NUM, draggedId: '2', overIndex: 1, position: 'above', getRowId: getId, treeMode: false })).toBeNull();
        expect(buildRowReorderEvent({ rows: NUM, draggedId: '2', overIndex: 0, position: 'below', getRowId: getId, treeMode: false })).toBeNull();
        expect(buildRowReorderEvent({ rows: NUM, draggedId: '2', overIndex: 1, position: 'below', getRowId: getId, treeMode: false })).toBeNull();
    });

    it('in a tree, landing on the same drawn index under ANOTHER parent is a move (the parent changes), under the same one it is none', () => {
        // drawn, A expanded: A(0) A1(1) A2(2) B(3); parents: -, a, a, -
        const drawn = [T_DATA[0]!, T_DATA[0]!.children![0]!, T_DATA[0]!.children![1]!, T_DATA[1]!];
        const parents = [null, 'a', 'a', null];
        const parentOf = (i: number): string | null => parents[i] ?? null;
        const common = { rows: drawn, getRowId: (r: TNode) => r.id, treeMode: true, parentOf };
        // B below A's last child: the same drawn index, but B becomes A's child
        const bDown = buildRowReorderEvent({ ...common, draggedId: 'b', overIndex: 2, position: 'below' })!;
        expect(bDown).toMatchObject({ fromIndex: 3, toIndex: 3, position: 'below' });
        const moved = reorderTree(T_DATA, bDown, tree);
        expect(moved.map((n) => n.id)).toEqual(['a']);
        expect(moved[0]!.children!.map((n) => n.id)).toEqual(['a1', 'a2', 'b']);
        // A2 above B: the same drawn index, but A2 moves to the root
        const a2Up = buildRowReorderEvent({ ...common, draggedId: 'a2', overIndex: 3, position: 'above' })!;
        expect(a2Up).toMatchObject({ fromIndex: 2, toIndex: 2 });
        const rooted = reorderTree(T_DATA, a2Up, tree);
        expect(rooted.map((n) => n.id)).toEqual(['a', 'a2', 'b']);
        expect(rooted[0]!.children!.map((n) => n.id)).toEqual(['a1']);
        // A1 above A2 (its own place, the same parent): no move
        expect(buildRowReorderEvent({ ...common, draggedId: 'a1', overIndex: 2, position: 'above' })).toBeNull();
    });

    it('is null when the dragged row has left the rows or the target index is out of range (spec 4878)', () => {
        expect(buildRowReorderEvent({ rows: NUM.slice(1), draggedId: '1', overIndex: 2, position: 'below', getRowId: getId, treeMode: false })).toBeNull();
        expect(buildRowReorderEvent({ rows: NUM, draggedId: '1', overIndex: 999, position: 'below', getRowId: getId, treeMode: false })).toBeNull();
    });

    it('tags parentId when dropping "on" a target in tree mode (spec 5255); not in flat mode', () => {
        const rows = [T_DATA[0]!, T_DATA[1]!];
        expect(buildRowReorderEvent({ rows, draggedId: 'b', overIndex: 0, position: 'on', getRowId: tree.getRowId, treeMode: true })).toMatchObject({ position: 'on', parentId: 'a' });
        expect(buildRowReorderEvent({ rows, draggedId: 'b', overIndex: 0, position: 'on', getRowId: tree.getRowId, treeMode: false })?.parentId).toBeUndefined();
    });

    it('compares ids as strings (getRowId may answer numbers)', () => {
        const rows = [{ n: 1 }, { n: 2 }, { n: 3 }];
        const byNumber = (r: { n: number }): string => r.n as unknown as string;
        expect(buildRowReorderEvent({ rows, draggedId: '1', overIndex: 2, position: 'below', getRowId: byNumber, treeMode: false })).toMatchObject({ previousId: '3', nextId: null });
    });
});

describe('dropIndex and neighbourIds', () => {
    it('follow Angular computeDropIndex / resolveDropNeighborIds', () => {
        expect(dropIndex(2, 0, 'below')).toBe(2);
        expect(dropIndex(2, 0, 'above')).toBe(1);
        expect(dropIndex(1, 3, 'above')).toBe(1);
        expect(dropIndex(1, 3, 'below')).toBe(2);
        expect(neighbourIds(NUM, 2, 0, getId)).toEqual({ previousId: '3', nextId: '4' });
        expect(neighbourIds(NUM, 1, 3, getId)).toEqual({ previousId: '1', nextId: '2' });
    });
});

describe('reorderFlat (Angular reorderFlatData)', () => {
    it('moves a flat row to the position implied by previousId (spec 4905)', () => {
        const result = reorderFlat(structuredClone(NUM), event({ row: NUM[0]!, targetRow: NUM[2]!, position: 'below', previousId: '3', nextId: '4', toIndex: 2 }), getId);
        expect(names(result)).toEqual(['Bob', 'Charlie', 'Alice', 'David', 'Eve']);
    });

    it('falls back to nextId, then to the end, and is a no-op for an unknown row (spec 4919)', () => {
        expect(names(reorderFlat(NUM, event({ row: NUM[0]!, targetRow: NUM[2]!, position: 'above', nextId: '3' }), getId))).toEqual(['Bob', 'Alice', 'Charlie', 'David', 'Eve']);
        expect(names(reorderFlat(NUM, event({ row: NUM[0]!, targetRow: NUM[4]!, position: 'below' }), getId))).toEqual(['Bob', 'Charlie', 'David', 'Eve', 'Alice']);
        const data = structuredClone(NUM);
        expect(reorderFlat(data, event({ row: { id: 'unknown', name: 'Ghost' }, targetRow: NUM[1]!, position: 'below' }), getId)).toBe(data);
        expect(names(reorderFlat(NUM, event({ row: NUM[0]!, targetRow: NUM[2]!, position: 'above', nextId: 'not-a-real-id' }), getId))).toEqual(['Bob', 'Charlie', 'David', 'Eve', 'Alice']);
    });

    it('never mutates its input', () => {
        const data = structuredClone(NUM);
        reorderFlat(data, event({ row: data[0]!, targetRow: data[2]!, position: 'below', previousId: '3' }), getId);
        expect(names(data)).toEqual(names(NUM));
    });

    it('with local paging the page neighbours place the row correctly in the full data (by id, not by index)', () => {
        // The drawn page is rows 3..4 (Charlie, David) of the data; David is dropped above Charlie.
        const page = NUM.slice(2, 4);
        const e = buildRowReorderEvent({ rows: page, draggedId: '4', overIndex: 0, position: 'above', getRowId: getId, treeMode: false })!;
        expect(e).toMatchObject({ fromIndex: 1, toIndex: 0, previousId: null, nextId: '3' });
        expect(names(reorderFlat(NUM, e, getId))).toEqual(['Alice', 'Bob', 'David', 'Charlie', 'Eve']);
    });
});

describe('reorderTree (Angular reorderTreeData)', () => {
    it('position "on" nests the moved node as a child of the target (spec 5204)', () => {
        const result = reorderTree(structuredClone(T_DATA), event({ row: T_DATA[1]!, targetRow: T_DATA[0]!, position: 'on' }), tree);
        expect(result.find((n) => n.id === 'a')!.children!.map((c) => c.id)).toContain('b');
        expect(result.some((n) => n.id === 'b')).toBe(false);
    });

    it('position "above" places the moved node before the target sibling (spec 5220)', () => {
        const result = reorderTree(structuredClone(T_DATA), event({ row: T_DATA[1]!, targetRow: T_DATA[0]!.children![0]!, position: 'above' }), tree);
        expect(result.find((n) => n.id === 'a')!.children!.map((c) => c.id)).toEqual(['b', 'a1', 'a2']);
    });

    it('"on" nests deep into a matching descendant, and an unknown row is a no-op (spec 5235)', () => {
        const nested = reorderTree(structuredClone(T_DATA), event({ row: T_DATA[1]!, targetRow: T_DATA[0]!.children![1]!, position: 'on' }), tree);
        expect(nested.find((n) => n.id === 'a')!.children!.find((c) => c.id === 'a2')!.children?.map((c) => c.id)).toEqual(['b']);
        const data = structuredClone(T_DATA);
        expect(reorderTree(data, event({ row: { id: 'ghost', name: 'Ghost' }, targetRow: T_DATA[0]!, position: 'on' }), tree)).toBe(data);
    });

    it('removes a deeply nested node and re-inserts it at root level (spec 6266)', () => {
        const deep: TNode[] = [{ id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1', children: [{ id: 'a1x', name: 'Deep' }] }] }, { id: 'b', name: 'B' }];
        const result = reorderTree(structuredClone(deep), event({ row: deep[0]!.children![0]!.children![0]!, targetRow: deep[1]!, position: 'below' }), tree);
        expect(result[0]!.children![0]!.children ?? []).toHaveLength(0);
        expect(result.map((n) => n.id)).toEqual(['a', 'b', 'a1x']);
    });

    it('refuses a drop onto the node itself or one of its descendants: nothing is lost (AB7, Angular drops the node silently)', () => {
        const data = structuredClone(T_DATA);
        for (const target of [data[0]!, data[0]!.children![0]!, data[0]!.children![1]!]) {
            for (const position of ['on', 'above', 'below'] as const) {
                const result = reorderTree(data, event({ row: data[0]!, targetRow: target, position }), tree);
                expect(result).toBe(data);
            }
        }
        // and three levels deep: A onto its grandchild
        const deep: TNode[] = [{ id: 'a', name: 'A', children: [{ id: 'a1', name: 'A1', children: [{ id: 'a1x', name: 'Deep' }] }] }];
        expect(reorderTree(deep, event({ row: deep[0]!, targetRow: deep[0]!.children![0]!.children![0]!, position: 'on' }), tree)).toBe(deep);
        expect(isSelfOrDescendant(deep[0]!, 'a1x', tree)).toBe(true);
        expect(isSelfOrDescendant(deep[0]!.children![0]!, 'a', tree)).toBe(false);
    });

    it('an unknown target is a no-op too (the moved node is never removed without a place to go)', () => {
        const data = structuredClone(T_DATA);
        expect(reorderTree(data, event({ row: data[1]!, targetRow: { id: 'nowhere', name: '?' }, position: 'above' }), tree)).toBe(data);
    });

    it('never mutates its input (setChildren builds new nodes)', () => {
        const data = structuredClone(T_DATA);
        reorderTree(data, event({ row: data[1]!, targetRow: data[0]!, position: 'on' }), tree);
        expect(data).toEqual(T_DATA);
    });

    it('reorderRows picks the tree reorder with sub-rows on, the flat one otherwise (Angular reads enableSubRows)', () => {
        const e = event<TNode>({ row: T_DATA[1]!, targetRow: T_DATA[0]!, position: 'on', previousId: 'a' });
        expect(reorderRows(T_DATA, e, { ...tree, enabled: true })[0]!.children!.map((c) => c.id)).toEqual(['a1', 'a2', 'b']);
        expect(reorderRows(T_DATA, e, { ...tree, enabled: false }).map((n) => n.id)).toEqual(['a', 'b']);
    });
});

describe('siblingMove (Alt+Arrow, moveRow)', () => {
    const flat = (disabled: number[] = []) => Array.from({ length: 5 }, (_, i) => ({ parentId: null, disabled: disabled.includes(i) }));

    it('steps one drawn row up (above it) or down (below it); null at the ends', () => {
        expect(siblingMove(flat(), 2, 'up')).toEqual({ overIndex: 1, position: 'above' });
        expect(siblingMove(flat(), 2, 'down')).toEqual({ overIndex: 3, position: 'below' });
        expect(siblingMove(flat(), 0, 'up')).toBeNull();
        expect(siblingMove(flat(), 4, 'down')).toBeNull();
    });

    it('skips disabled rows, and a disabled row does not move', () => {
        expect(siblingMove(flat([1]), 2, 'up')).toEqual({ overIndex: 0, position: 'above' });
        expect(siblingMove(flat([3, 4]), 2, 'down')).toBeNull();
        expect(siblingMove(flat([2]), 2, 'down')).toBeNull();
    });

    it('tree: only among the siblings (same parent), over a sibling\'s expanded children', () => {
        // a, a1, a2, b, b1 (b expanded), c
        const rows = [
            { parentId: null, disabled: false },
            { parentId: 'a', disabled: false },
            { parentId: 'a', disabled: false },
            { parentId: null, disabled: false },
            { parentId: 'b', disabled: false },
            { parentId: null, disabled: false },
        ];
        expect(siblingMove(rows, 2, 'up')).toEqual({ overIndex: 1, position: 'above' });
        expect(siblingMove(rows, 1, 'up')).toBeNull(); // the first child does not leave its parent
        expect(siblingMove(rows, 2, 'down')).toBeNull();
        expect(siblingMove(rows, 0, 'down')).toEqual({ overIndex: 3, position: 'below' });
        expect(siblingMove(rows, 5, 'up')).toEqual({ overIndex: 3, position: 'above' });
    });
});
