/**
 * Detail rows, tree nodes and group collapse as pure functions over their records. Every write builds a NEW record.
 * Keys come from data (row ids, group values), so they are only touched through a `Map`.
 */
import type { GetChildren } from './data-table-tree.js';
import type { ColumnDef } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

export type Flags = Readonly<Record<string, boolean>>;

export const isFlagged = (flags: Flags, id: string): boolean => Object.hasOwn(flags, id) && flags[id] === true;

/** A copy with `id` set to `value`, or removed when `value` is `undefined`. */
export function withFlag(flags: Flags, id: string, value: boolean | undefined): Record<string, boolean> {
    const next = new Map(Object.entries(flags));
    if (value === undefined) next.delete(id);
    else next.set(id, value);
    return Object.fromEntries(next);
}

/** Detail rows: an open row is `true`, a closed one has no key. */
export const toggleFlag = (flags: Flags, id: string): Record<string, boolean> => withFlag(flags, id, isFlagged(flags, id) ? undefined : true);

/** Opens (`on`) or closes every id of `ids`; other keys stay. */
export function setFlags(flags: Flags, ids: readonly string[], on: boolean): Record<string, boolean> {
    const next = new Map(Object.entries(flags));
    for (const id of ids) {
        if (on) next.set(id, true);
        else next.delete(id);
    }
    return Object.fromEntries(next);
}

/** Every id is open (false for none). */
export const allFlagged = (flags: Flags, ids: readonly string[]): boolean => ids.length > 0 && ids.every((id) => isFlagged(flags, id));

export const someFlagged = (flags: Flags, ids: readonly string[]): boolean => {
    const open = ids.filter((id) => isFlagged(flags, id)).length;
    return open > 0 && open < ids.length;
};

/** A tree node is open by its own entry, else by the default depth rule (`-1` = every level). */
export function nodeExpanded(flags: Flags, id: string, depth: number, defaultDepth: number): boolean {
    if (Object.hasOwn(flags, id)) return flags[id] === true;
    return defaultDepth === -1 || depth < defaultDepth;
}

/** Depth of `id` (0 for a root or an unknown id) by walking the parent index. */
export function depthOf(parents: ReadonlyMap<string, string>, id: string): number {
    let depth = 0;
    for (let parent = parents.get(id); parent !== undefined; parent = parents.get(parent)) depth++;
    return depth;
}

/** The ids of every node with children, in depth-first order. */
export function parentIds<T>(rows: readonly T[], getId: (row: T) => string, getChildren: GetChildren<T>): string[] {
    const ids: string[] = [];
    const walk = (list: readonly T[]): void => {
        for (const row of list) {
            const children = getChildren(row);
            if (!children?.length) continue;
            ids.push(getId(row));
            walk(children);
        }
    };
    walk(rows);
    return ids;
}

/** `expandAllSubRows`: REPLACES the record, every node above `toDepth` (all when `-1`) is `true`. */
export function expandAllNodes<T>(rows: readonly T[], getId: (row: T) => string, getChildren: GetChildren<T>, toDepth = -1): Record<string, boolean> {
    const next = new Map<string, boolean>();
    const walk = (list: readonly T[], depth: number): void => {
        for (const row of list) {
            const children = getChildren(row);
            if (!children?.length) continue;
            if (toDepth === -1 || depth < toDepth) next.set(getId(row), true);
            walk(children, depth + 1);
        }
    };
    walk(rows, 0);
    return Object.fromEntries(next);
}

/** `collapseAllSubRows`: pins `false` on every parent, which beats the default depth. */
export function collapseAllNodes<T>(rows: readonly T[], getId: (row: T) => string, getChildren: GetChildren<T>): Record<string, boolean> {
    return Object.fromEntries(parentIds(rows, getId, getChildren).map((id) => [id, false] as const));
}

/** Every node with children is open (true for a tree with none). */
export function allNodesExpanded<T>(rows: readonly T[], getId: (row: T) => string, getChildren: GetChildren<T>, flags: Flags, defaultDepth: number): boolean {
    const check = (list: readonly T[], depth: number): boolean =>
        list.every((row) => {
            const children = getChildren(row);
            if (!children?.length) return true;
            return nodeExpanded(flags, getId(row), depth, defaultDepth) && check(children, depth + 1);
        });
    return check(rows, 0);
}

/** The column that draws the expander and the indentation: the one marked `treeExpander`, else the first data column. */
export function treeHostKey<T>(columns: readonly ColumnDef<T>[]): string | null {
    const data = columns.filter((c) => !isSpecialColumnKey(c.accessorKey));
    const host = data.find((c) => c.treeExpander) ?? data[0];
    return host ? String(host.accessorKey) : null;
}

/** What an arrow key does on a tree node (APG treegrid): Right (Left in rtl) opens a closed node, Left (Right) closes an open one; otherwise the key moves focus. */
export function treeKeyAction(key: string, rtl: boolean, node: { isLeaf: boolean; isExpanded: boolean }): 'expand' | 'collapse' | null {
    if (node.isLeaf) return null;
    const opens = rtl ? 'ArrowLeft' : 'ArrowRight';
    const closes = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (key === opens && !node.isExpanded) return 'expand';
    if (key === closes && node.isExpanded) return 'collapse';
    return null;
}
