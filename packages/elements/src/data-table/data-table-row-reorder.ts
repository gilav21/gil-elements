/**
 * Row drag reorder as pure maths (wave 6, package C): where a drop lands, the `row-reorder` event it makes and the new `data` it implies.
 * Ports Angular's `computeDragPosition`, `buildRowReorderEvent`, `computeDropIndex`, `resolveDropNeighborIds`, `reorderFlatData` and
 * `reorderTreeData` (cmp 5903-6250). Rows are DRAWN rows (`renderedRows()`: grouped, tree, page and window all agree on that list).
 *
 * Beyond Angular: a tree drop onto the moved node itself or onto one of its descendants is refused (Angular removes the node first and
 * then never finds the target, so the node is silently lost: AB7); `siblingMove` is the keyboard alternative of a drag (Alt+Arrow).
 */
import type { RowDragPosition, RowReorderEvent } from './data-table.types.js';

/** The drop position from where the pointer is in the target row (0 = its top edge, 1 = its bottom): halves in flat mode, quarters in tree mode (`on` = become a child). */
export function dropPosition(mode: 'flat' | 'tree', relativeY: number): RowDragPosition {
    if (mode === 'tree') {
        if (relativeY < 0.25) return 'above';
        if (relativeY > 0.75) return 'below';
        return 'on';
    }
    return relativeY < 0.5 ? 'above' : 'below';
}

/** The indicator a position draws on its target row. */
export const dropEdge = (position: RowDragPosition): 'top' | 'bottom' | 'on' => {
    if (position === 'on') return 'on';
    return position === 'above' ? 'top' : 'bottom';
};

/** Where the dragged row ends up in the drawn list (Angular's `computeDropIndex`): the target index, one further below it, one less when the row came from above. */
export function dropIndex(overIndex: number, fromIndex: number, position: RowDragPosition): number {
    let toIndex = position === 'above' ? overIndex : overIndex + 1;
    if (fromIndex < toIndex) toIndex -= 1;
    return toIndex;
}

/** The ids of the drawn rows around the final position (Angular's `resolveDropNeighborIds`), as `reorderFlat` reads them back. */
export function neighbourIds<T>(rows: readonly T[], toIndex: number, fromIndex: number, getRowId: (row: T) => string): { previousId: string | null; nextId: string | null } {
    const prevIdx = toIndex > fromIndex ? toIndex : toIndex - 1;
    const nextIdx = toIndex >= fromIndex ? toIndex + 1 : toIndex;
    const previous = prevIdx >= 0 ? rows[prevIdx] : undefined;
    const next = nextIdx < rows.length ? rows[nextIdx] : undefined;
    return { previousId: previous === undefined ? null : String(getRowId(previous)), nextId: next === undefined ? null : String(getRowId(next)) };
}

export interface ReorderEventInput<T> {
    /** The drawn rows. */
    readonly rows: readonly T[];
    readonly draggedId: string;
    readonly overIndex: number;
    readonly position: RowDragPosition;
    readonly getRowId: (row: T) => string;
    /** `rowDragMode` is `tree`: a drop `on` a row names it as the new parent (`parentId`). */
    readonly treeMode: boolean;
    /**
     * In a tree table, the parent id of the drawn row at an index (null for a root). A drop `above` / `below` makes the row a SIBLING of the target, so
     * landing on its own drawn index is still a move when the target has another parent (B dropped below A's last child becomes A's child).
     */
    readonly parentOf?: (index: number) => string | null;
}

/**
 * The `row-reorder` event of a drop, or null when there is nothing to move: the dragged row is no longer drawn, the target index is past the
 * rows, or the row would land where it is (`fromIndex === toIndex` for `above` / `below` under the SAME parent: beyond Angular, which emits a
 * no-op event).
 */
export function buildRowReorderEvent<T>({ rows, draggedId, overIndex, position, getRowId, treeMode, parentOf }: ReorderEventInput<T>): RowReorderEvent<T> | null {
    const fromIndex = rows.findIndex((r) => String(getRowId(r)) === draggedId);
    const row = rows[fromIndex];
    const targetRow = rows[overIndex];
    if (row === undefined || targetRow === undefined) return null;
    const toIndex = Math.max(0, dropIndex(overIndex, fromIndex, position));
    const sameParent = !parentOf || parentOf(overIndex) === parentOf(fromIndex);
    if (position !== 'on' && toIndex === fromIndex && sameParent) return null;
    const event: RowReorderEvent<T> = { row, targetRow, position, ...neighbourIds(rows, toIndex, fromIndex, getRowId), fromIndex, toIndex };
    if (position === 'on' && treeMode) event.parentId = String(getRowId(targetRow));
    return event;
}

/** A flat reorder: the row moves next to `previousId`, else before `nextId`, else to the end. An unknown row answers the input array (Angular). */
export function reorderFlat<T>(data: readonly T[], event: RowReorderEvent<T>, getRowId: (row: T) => string): T[] {
    const id = (r: T): string => String(getRowId(r));
    const movedId = id(event.row);
    const fromIdx = data.findIndex((r) => id(r) === movedId);
    if (fromIdx === -1) return data as T[];
    const result = [...data];
    const [moved] = result.splice(fromIdx, 1) as [T];
    let insertIdx = result.length;
    if (event.previousId) insertIdx = result.findIndex((r) => id(r) === event.previousId) + 1;
    else if (event.nextId) {
        const at = result.findIndex((r) => id(r) === event.nextId);
        if (at !== -1) insertIdx = at;
    }
    result.splice(Math.max(0, insertIdx), 0, moved);
    return result;
}

export interface TreeAccess<T> {
    readonly getRowId: (row: T) => string;
    readonly getChildren: (row: T) => readonly T[] | undefined;
    readonly setChildren: (row: T, children: T[]) => T;
}

/** The node with this id, anywhere in the tree. */
function findNode<T>(nodes: readonly T[], id: string, tree: TreeAccess<T>): T | undefined {
    for (const node of nodes) {
        if (String(tree.getRowId(node)) === id) return node;
        const found = findNode(tree.getChildren(node) ?? [], id, tree);
        if (found !== undefined) return found;
    }
    return undefined;
}

/** `id` is `node` itself or one of its descendants: a drop there would put the node inside itself (AB7). */
export function isSelfOrDescendant<T>(node: T, id: string, tree: TreeAccess<T>): boolean {
    return String(tree.getRowId(node)) === id || findNode(tree.getChildren(node) ?? [], id, tree) !== undefined;
}

function removeFromTree<T>(nodes: readonly T[], id: string, tree: TreeAccess<T>): { remaining: T[]; removed: T | null } {
    const idx = nodes.findIndex((n) => String(tree.getRowId(n)) === id);
    if (idx !== -1) return { remaining: [...nodes.slice(0, idx), ...nodes.slice(idx + 1)], removed: nodes[idx] as T };
    for (const [i, node] of nodes.entries()) {
        const children = tree.getChildren(node);
        if (!children?.length) continue;
        const inner = removeFromTree(children, id, tree);
        if (inner.removed !== null) {
            const updated = [...nodes];
            updated[i] = tree.setChildren(node, inner.remaining);
            return { remaining: updated, removed: inner.removed };
        }
    }
    return { remaining: [...nodes], removed: null };
}

function insertIntoTree<T>(nodes: readonly T[], moved: T, targetId: string, position: RowDragPosition, tree: TreeAccess<T>): T[] {
    const recurse = (node: T): T => {
        const kids = tree.getChildren(node);
        return kids?.length ? tree.setChildren(node, insertIntoTree(kids, moved, targetId, position, tree)) : node;
    };
    if (position === 'on') return nodes.map((n) => (String(tree.getRowId(n)) === targetId ? tree.setChildren(n, [...(tree.getChildren(n) ?? []), moved]) : recurse(n)));
    const result: T[] = [];
    for (const node of nodes) {
        if (String(tree.getRowId(node)) !== targetId) result.push(recurse(node));
        else if (position === 'above') result.push(moved, node);
        else result.push(node, moved);
    }
    return result;
}

/**
 * A tree reorder (immutable, through `setChildren`): the node is removed from its parent and inserted above, below or inside the target. An unknown
 * row, an unknown target, or a target that is the node itself or one of its descendants answers the input array: nothing is lost (AB7).
 */
export function reorderTree<T>(data: readonly T[], event: RowReorderEvent<T>, tree: TreeAccess<T>): T[] {
    const movedId = String(tree.getRowId(event.row));
    const targetId = String(tree.getRowId(event.targetRow));
    const moved = findNode(data, movedId, tree);
    if (moved === undefined || findNode(data, targetId, tree) === undefined || isSelfOrDescendant(moved, targetId, tree)) return data as T[];
    const { remaining, removed } = removeFromTree(data, movedId, tree);
    return removed === null ? (data as T[]) : insertIntoTree(remaining, removed, targetId, event.position, tree);
}

/** `reorderData` of the element: the tree reorder when sub-rows are on (Angular reads `enableSubRows`, not the drag mode), else the flat one. */
export function reorderRows<T>(data: readonly T[], event: RowReorderEvent<T>, tree: TreeAccess<T> & { readonly enabled: boolean }): T[] {
    return tree.enabled ? reorderTree(data, event, tree) : reorderFlat(data, event, tree.getRowId);
}

export interface SiblingRow {
    /** The parent's id in a tree (null at the root, and for every row of a flat table). */
    readonly parentId: string | null;
    readonly disabled: boolean;
}

/**
 * The keyboard move (Alt+ArrowUp / Alt+ArrowDown, `moveRow`): the drawn index of the row to drop next to, and on which side, or null at an end.
 * The neighbour is the next drawn row in that direction with the same parent (every row of a flat table has none), skipping disabled rows.
 */
export function siblingMove(rows: readonly SiblingRow[], index: number, direction: 'up' | 'down'): { overIndex: number; position: 'above' | 'below' } | null {
    const self = rows[index];
    if (!self || self.disabled) return null;
    const step = direction === 'up' ? -1 : 1;
    for (let i = index + step; i >= 0 && i < rows.length; i += step) {
        const row = rows[i] as SiblingRow;
        if (row.parentId === self.parentId && !row.disabled) return { overIndex: i, position: direction === 'up' ? 'above' : 'below' };
    }
    return null;
}
