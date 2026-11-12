/**
 * Cell flash as pure maths (wave 6, package C): which drawn cells changed between two data sets, and in which direction. Ports Angular's
 * `diffCellValues` / `classifyChange` / `snapshotCellValues` (cmp 1764-1840) with one difference of cost: the snapshot holds the DRAWN rows
 * only (the caller passes them), so a data change costs O(drawn rows x flash columns), not O(all rows x all columns). A row that was not
 * drawn has no previous values and does not flash (Angular: the same for a new id).
 */
import type { CellFlashDirection, ColumnDef } from './data-table.types.js';
import { getCellValue } from './data-table.utils.js';

/** Row id -> column key -> the value drawn. */
export type FlashSnapshot = ReadonlyMap<string, ReadonlyMap<string, unknown>>;

/** Row id -> column key -> how it changed. */
export type FlashChanges = Map<string, Map<string, CellFlashDirection>>;

/**
 * Angular's rule, kept on purpose (D15, AB9): both values read as finite through `Number()` is a numeric change (`up` / `down`), anything else is
 * `changed`. So `null` -> 5 reads `up` and `true` -> `false` reads `down`.
 */
export function classifyChange(oldValue: unknown, newValue: unknown): CellFlashDirection {
    const before = Number(oldValue);
    const after = Number(newValue);
    if (Number.isFinite(before) && Number.isFinite(after)) return after > before ? 'up' : 'down';
    return 'changed';
}

/** The columns that flash: not opted out (`enableCellFlash: false`) and not a special (underscore) key. */
export function flashColumns<T>(columns: readonly ColumnDef<T>[]): ColumnDef<T>[] {
    return columns.filter((c) => c.enableCellFlash !== false && !String(c.accessorKey).startsWith('_'));
}

/** The values of `rows` in the flash columns, by row id (ids as strings: a `getRowId` may answer numbers). */
export function snapshotFlash<T>(rows: readonly T[], columns: readonly ColumnDef<T>[], getRowId: (row: T) => string): Map<string, Map<string, unknown>> {
    const snapshot = new Map<string, Map<string, unknown>>();
    for (const row of rows) {
        const values = new Map<string, unknown>();
        for (const column of columns) values.set(String(column.accessorKey), getCellValue(row, column.accessorKey, column));
        snapshot.set(String(getRowId(row)), values);
    }
    return snapshot;
}

/** The cells of `rows` whose value differs (`!==`) from `previous`; rows and columns `previous` does not know are skipped. */
export function diffFlashes<T>(previous: FlashSnapshot, rows: readonly T[], columns: readonly ColumnDef<T>[], getRowId: (row: T) => string): FlashChanges {
    const changes: FlashChanges = new Map();
    for (const row of rows) {
        const id = String(getRowId(row));
        const before = previous.get(id);
        if (!before) continue;
        for (const column of columns) {
            const key = String(column.accessorKey);
            if (!before.has(key)) continue;
            const old = before.get(key);
            const now = getCellValue(row, column.accessorKey, column);
            if (old === now) continue;
            let cells = changes.get(id);
            if (!cells) changes.set(id, (cells = new Map()));
            cells.set(key, classifyChange(old, now));
        }
    }
    return changes;
}
