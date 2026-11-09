/**
 * Row selection as pure functions over the `rowSelection` record (id -> true). A write always builds a NEW record
 * (identity is the change signal) and deselecting deletes the key, so the record never stores `false` of its own; a
 * `false` a consumer wrote counts as unselected. Nothing prunes stale ids: they stay until the consumer clears them.
 * Ids come from data, so keys are only touched through a `Map` (an id named `__proto__` is an ordinary key).
 */
import { type Flags, isFlagged, setFlags } from './data-table-expansion.js';
import { memoLast } from './data-table-query.js';
import type { TreeIndex } from './data-table-tree.js';
import type { SubRowSelectionMode } from './data-table.types.js';

/** The same record as an expansion's: an id is selected as `true`, deselecting deletes the key. */
export type Selection = Flags;

export const isSelectedId = isFlagged;

/** A copy of `selection` with every id of `ids` selected (`on`) or removed. */
export const patchSelection = setFlags;

/** The ids of the rows a header action may touch: disabled rows are left out. */
export function selectableIds<R>(rows: readonly R[], getId: (row: R) => string, isDisabled: (row: R) => boolean): string[] {
    return rows.filter((row) => !isDisabled(row)).map(getId);
}

export interface HeaderState {
    checked: boolean;
    indeterminate: boolean;
    selectableCount: number;
}

/** Checked when every selectable id is selected (and there is one); indeterminate when some but not all are. */
export function headerState(selection: Selection, selectable: readonly string[]): HeaderState {
    const selected = selectable.filter((id) => isSelectedId(selection, id)).length;
    return { checked: selectable.length > 0 && selected === selectable.length, indeterminate: selected > 0 && selected < selectable.length, selectableCount: selectable.length };
}

/** The header action: from "all selected" it clears the selectable ids, from anything else it selects them all. Other ids are untouched. */
export function toggleAllSelection(selection: Selection, selectable: readonly string[]): Record<string, boolean> {
    return patchSelection(selection, selectable, !headerState(selection, selectable).checked);
}

export function toggleId(selection: Selection, id: string): Record<string, boolean> {
    return patchSelection(selection, [id], !isSelectedId(selection, id));
}

/**
 * The tree checkbox. `descendants` mirrors the new state of `id` onto its whole subtree, `filteredDescendants` onto the
 * part of it in `visible`; then every ancestor is selected exactly when all its children are. `self` is a plain toggle.
 */
export function cascadeSelection(selection: Selection, id: string, mode: SubRowSelectionMode, index: TreeIndex, visible: ReadonlySet<string>): Record<string, boolean> {
    if (mode === 'self') return toggleId(selection, id);
    const on = !isSelectedId(selection, id);
    const below = index.descendants.get(id) ?? [];
    const scope = mode === 'descendants' ? below : below.filter((d) => visible.has(d));
    const next = new Map(Object.entries(patchSelection(selection, [id, ...scope], on)));
    let parent = index.parent.get(id);
    while (parent !== undefined) {
        const everyChild = (index.children.get(parent) ?? []).every((child) => next.get(child) === true);
        if (everyChild) next.set(parent, true);
        else next.delete(parent);
        parent = index.parent.get(parent);
    }
    return Object.fromEntries(next);
}

/** The nodes with some but not all of their descendants selected; none in `self` mode. One memo per table: it remembers the last selection and index. */
export function createIndeterminateIds(): (selection: Selection, index: TreeIndex, mode: SubRowSelectionMode) => ReadonlySet<string> {
    return memoLast((selection: Selection, index: TreeIndex, mode: SubRowSelectionMode): ReadonlySet<string> => {
        const result = new Set<string>();
        if (mode === 'self') return result;
        for (const [id, below] of index.descendants) {
            if (below.length === 0) continue;
            const count = below.filter((d) => isSelectedId(selection, d)).length;
            if (count > 0 && count < below.length) result.add(id);
        }
        return result;
    });
}

/** The ids from `a` to `b` inclusive in drawn `order`, or `null` when either is not in it (an anchor on another page). */
export function rangeBetween(order: readonly string[], a: string, b: string): string[] | null {
    const from = order.indexOf(a);
    const to = order.indexOf(b);
    if (from === -1 || to === -1) return null;
    return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}
