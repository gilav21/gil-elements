/** Tree (sub-row) helpers: build, filter, sort, flatten and index. Pure; rows are never mutated. */
import type { ColumnDef, FlattenedTreeRow, SortState, SubRowFilterMode } from './data-table.types.js';
import { buildFilterMatchers, buildSortComparator, type GlobalFilterFn } from './data-table-query.js';

export type GetChildren<T> = (row: T) => T[] | null | undefined;
export type SetChildren<T> = (row: T, children: T[]) => T;

/**
 * Builds a tree from a flat list. Roots are the rows whose parent id is `null` or names no row in the list (an orphan
 * surfaces at the root rather than vanishing); a cycle, which has no root, is broken at its first row in list order.
 */
export function buildTreeFromFlat<T>(
    rows: readonly T[],
    getId: (row: T) => string,
    getParentId: (row: T) => string | null,
    setChildren: (row: T, children: T[]) => T,
): T[] {
    const ids = new Set(rows.map(getId));
    const roots: T[] = [];
    const byParent = new Map<string, T[]>();
    for (const row of rows) {
        const parentId = getParentId(row);
        if (parentId === null || !ids.has(parentId)) {
            roots.push(row);
            continue;
        }
        const siblings = byParent.get(parentId);
        if (siblings) siblings.push(row);
        else byParent.set(parentId, [row]);
    }
    const placed = new Set<string>();
    const attach = (row: T): T => {
        placed.add(getId(row));
        const children = (byParent.get(getId(row)) ?? []).filter((child) => !placed.has(getId(child)));
        return children.length ? setChildren(row, children.map(attach)) : row;
    };
    const tree = roots.map(attach);
    // What is left is a cycle (or hangs off one), so it has no root: start it at its first row.
    for (const row of rows) if (!placed.has(getId(row))) tree.push(attach(row));
    return tree;
}

export interface TreeFilterInput<T> {
    columns: readonly ColumnDef<T>[];
    globalFilter: string;
    globalFilterFn?: GlobalFilterFn<T> | null;
    columnFilters: Readonly<Record<string, unknown>>;
    mode: SubRowFilterMode;
    getChildren: GetChildren<T>;
    setChildren: SetChildren<T>;
}

/**
 * Filters a tree. With no active filter the input is returned as it is.
 * - `excludeChildren`: only the top-level rows are tested; kept rows keep all their children.
 * - `includeChildren`: a matching row is kept WITH all its children; a non-matching row survives, with only its
 *   matching descendants, if any descendant matches.
 * - `includeParentOnChildMatch`: a row survives when it matches or a descendant does, with its children filtered.
 */
export function filterTree<T>(rows: T[], f: TreeFilterInput<T>): T[] {
    const { global, columns } = buildFilterMatchers(f);
    if (!global && !columns) return rows;
    const matches = (row: T): boolean => (!global || global(row)) && (!columns || columns(row));
    const kids = (row: T): T[] => f.getChildren(row) ?? [];

    const withChildren = (list: T[]): T[] =>
        list.flatMap((row) => {
            if (matches(row)) return [row];
            const filtered = withChildren(kids(row));
            return filtered.length > 0 ? [f.setChildren(row, filtered)] : [];
        });

    const withParents = (list: T[]): T[] =>
        list.flatMap((row) => {
            const children = kids(row);
            if (children.length === 0) return matches(row) ? [row] : [];
            const filtered = withParents(children);
            return matches(row) || filtered.length > 0 ? [f.setChildren(row, filtered)] : [];
        });

    if (f.mode === 'excludeChildren') return rows.filter(matches);
    return f.mode === 'includeChildren' ? withChildren(rows) : withParents(rows);
}

/** Sorts siblings at every level (a parent never moves relative to another level). */
export function sortTree<T>(
    rows: readonly T[],
    sorts: readonly SortState[],
    columns: readonly ColumnDef<T>[],
    getChildren: GetChildren<T>,
    setChildren: SetChildren<T>,
): T[] {
    if (sorts.length === 0) return [...rows];
    const compare = buildSortComparator(sorts, columns);
    const walk = (list: readonly T[]): T[] =>
        [...list].sort(compare).map((row) => {
            const children = getChildren(row);
            return children?.length ? setChildren(row, walk(children)) : row;
        });
    return walk(rows);
}

export interface FlattenOptions<T> {
    getId: (row: T) => string;
    getChildren: GetChildren<T>;
    /** Explicit expansion by id; an own entry wins over the default depth. */
    expanded: Readonly<Record<string, boolean>>;
    /** Rows shallower than this depth are expanded by default; `-1` expands everything. */
    defaultExpandedDepth: number;
}

function isNodeExpanded(id: string, depth: number, o: FlattenOptions<unknown>): boolean {
    if (Object.hasOwn(o.expanded, id)) return o.expanded[id] === true;
    return o.defaultExpandedDepth === -1 || depth < o.defaultExpandedDepth;
}

/** The visible rows of a tree in drawn order, children of collapsed rows skipped. */
export function flattenTree<T>(rows: readonly T[], o: FlattenOptions<T>): FlattenedTreeRow<T>[] {
    const result: FlattenedTreeRow<T>[] = [];
    const walk = (items: readonly T[], depth: number, parentId: string | null, parentRow: T | null, path: string[]): void => {
        for (const [position, row] of items.entries()) {
            const id = o.getId(row);
            const children = o.getChildren(row) ?? [];
            const isLeaf = children.length === 0;
            const isExpanded = !isLeaf && isNodeExpanded(id, depth, o as FlattenOptions<unknown>);
            const rowPath = [...path, id];
            result.push({ row, depth, parentId, parentRow, path: rowPath, isLeaf, childCount: children.length, isExpanded, setSize: items.length, posInSet: position + 1 });
            if (isExpanded) walk(children, depth + 1, id, row, rowPath);
        }
    };
    walk(rows, 0, null, null, []);
    return result;
}

export interface TreeIndex {
    /** Direct child ids (leaves map to `[]`). */
    children: Map<string, string[]>;
    /** All descendant ids, depth-first. */
    descendants: Map<string, string[]>;
    parent: Map<string, string>;
    /** Id to node, so a lookup is O(1) instead of a tree walk. */
    nodes: Map<string, unknown>;
}

/** One pass over the tree: parent, children, descendants and node lookups by id. */
export function buildTreeIndex<T>(rows: readonly T[], getId: (row: T) => string, getChildren: GetChildren<T>): TreeIndex {
    const index: TreeIndex = { children: new Map(), descendants: new Map(), parent: new Map(), nodes: new Map() };
    const walk = (items: readonly T[], parentId: string | null): string[] => {
        const all: string[] = [];
        for (const row of items) {
            const id = getId(row);
            if (parentId !== null) index.parent.set(id, parentId);
            index.nodes.set(id, row);
            const kids = getChildren(row) ?? [];
            index.children.set(id, kids.map(getId));
            const below = walk(kids, id);
            index.descendants.set(id, below);
            all.push(id);
            for (const descendant of below) all.push(descendant); // a spread would overflow the stack on a huge subtree
        }
        return all;
    };
    walk(rows, null);
    return index;
}
