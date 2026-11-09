/**
 * Column reordering as pure functions over key lists, so the drag, the keyboard and `moveColumn` share one rule.
 *
 * `base` is the full drawn order (hidden columns included), `group` the visible, reorderable keys that may swap places
 * (the caller passes one pin group, so a drop never crosses a pin boundary). The new order of `group` is written back
 * into the slots `group` held in `base`, so hidden, special and differently pinned columns keep theirs (Angular's merge).
 */
import { applyKeyOrder } from './data-table-view-state.js';

export type DropSide = 'before' | 'after';

/** The full drawn order the moves start from: the definitions' keys (a duplicated key counts once) in the user's `columnOrder`. */
export const baseColumnOrder = (columns: readonly { accessorKey: PropertyKey }[], order: readonly string[]): string[] =>
    applyKeyOrder([...new Set(columns.map((c) => String(c.accessorKey)))], order);

function mergeIntoSlots(base: readonly string[], group: readonly string[], next: readonly string[]): string[] {
    const slots = new Set(group);
    let cursor = 0;
    return base.map((key) => (slots.has(key) ? (next[cursor++] ?? key) : key));
}

/** The order after dropping `source` on `target`'s `side`; `null` when nothing would move. */
export function moveColumnKey(base: readonly string[], group: readonly string[], source: string, target: string, side: DropSide): string[] | null {
    const from = group.indexOf(source);
    if (from === -1 || group.indexOf(target) === -1 || source === target) return null;
    const rest = group.filter((key) => key !== source);
    const at = rest.indexOf(target) + (side === 'after' ? 1 : 0);
    const next = [...rest.slice(0, at), source, ...rest.slice(at)];
    return next.every((key, i) => key === group[i]) ? null : mergeIntoSlots(base, group, next);
}

/** The order after moving `key` by `delta` places inside `group`, stopping at its ends; `null` when it cannot move. */
export function moveByOffset(base: readonly string[], group: readonly string[], key: string, delta: number): string[] | null {
    const from = group.indexOf(key);
    const target = group[from + delta];
    if (from === -1 || target === undefined) return null;
    return moveColumnKey(base, group, key, target, delta > 0 ? 'after' : 'before');
}

/** Which side of a header the pointer is over: the start half is `before` (the start is the right in rtl). */
export function dropSide(pointerX: number, rect: { left: number; width: number }, rtl: boolean): DropSide {
    const inLeftHalf = pointerX < rect.left + rect.width / 2;
    return inLeftHalf !== rtl ? 'before' : 'after';
}

/** `moveColumn(key, index)`: `key` goes to `index` of `group` (clamped), landing on the side that keeps its direction of travel. */
export function moveToIndex(base: readonly string[], group: readonly string[], key: string, index: number): string[] | null {
    const from = group.indexOf(key);
    if (from === -1) return null;
    const to = Math.max(0, Math.min(Math.trunc(index), group.length - 1));
    return moveByOffset(base, group, key, to - from);
}
