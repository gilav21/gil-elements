/**
 * The cell-write pipeline and its undo stack, behind `host.writeCells` / `host.writeCell` / `host.runAsCommand`.
 *
 * validate (`editValidator`) -> value setter -> write `data` -> undo entry. Edit, fill, paste and AI fill all go through
 * it; it is a channel on the host rather than a controller because none of them may own it. `data` is written in
 * exactly three places in the whole table: here (`writeCells` and the undo/redo path) and the row drop. Never mutates
 * a row or the data array: the setter returns a new row and the array is copied once per call.
 *
 * Multi-cell gestures (fill, paste, AI fill) MUST use `writeCells`, inside `runAsCommand` when they should be one undo
 * step. It resolves every target row from the rendered rows BEFORE the first write, because the first write can
 * re-sort or re-filter the rendered list and a lazy `rowAt(index)` per cell would then hit the wrong row. It writes all
 * values with ONE `setData`, and `runAsCommand` wraps its work in a model batch, so a command is one `data-change`.
 * `writeCell` is the single-cell case of the same code. AI fill does not wrap in `runAsCommand`, as in Angular, so it is
 * not undoable; do not promise otherwise.
 *
 * Undo and redo find a row again by its id. With the default row id (the row's `id`, else the object itself) a value
 * setter that returns a new object changes the id, so they could not; `validateConfig` warns about that setup and
 * `undo`/`redo` report the entries they could not apply in `stale` instead of doing nothing silently.
 */
import type { CellEditErrorEvent, CellEditEvent, ColumnDef } from './data-table.types.js';

export interface CellTarget {
    /** Index in the rendered rows (`data-row-index`). */
    readonly rowIndex: number;
    readonly columnKey: string;
}

export interface CellWriteOptions {
    /** Fire `cell-edit` once a value passed validation, before the write (what a committed edit does). */
    readonly emitEdit?: boolean;
    /** Fire `edit-error` on a rejection. Default true; the editor passes false for a value it already reported. */
    readonly report?: boolean;
}

export interface CellWriteRequest {
    readonly target: CellTarget;
    readonly value: unknown;
}

export type CellWriteResult<T> =
    | { readonly status: 'written'; readonly row: T; readonly column: ColumnDef<T>; readonly oldValue: unknown }
    /** The validator refused; `message` is its string, or a default. */
    | { readonly status: 'rejected'; readonly message: string; readonly row: T; readonly column: ColumnDef<T> }
    /** Nothing to write: row or column gone, no `valueSetter`, or the row is no longer in `data`. */
    | { readonly status: 'skipped' };

interface EditChange {
    readonly rowId: string;
    readonly columnKey: string;
    /** The drawn row index of the edit, as its `cell-edit` carried it: replays report it again. */
    readonly rowIndex: number;
    readonly before: unknown;
    readonly after: unknown;
}

/** An undo/redo entry that could not be applied. */
export interface StaleChange {
    readonly rowId: string;
    readonly columnKey: string;
    /** `row`: no row has that id any more; `column`: the column is gone or has no `valueSetter`. */
    readonly reason: 'row' | 'column';
}

export interface HistoryResult {
    /** Whether there was an entry to undo/redo. */
    readonly done: boolean;
    readonly stale: readonly StaleChange[];
}

export interface CellWritePorts<T> {
    getData(): readonly T[];
    /** The one place the pipeline writes `data` back; the element routes it to the model store. */
    setData(next: T[]): void;
    /** Runs `fn` with model events held until it ends (`ModelStore.batch`). */
    batch<R>(fn: () => R): R;
    getRowId(row: T): string;
    /** The column behind a key. */
    columnByKey(key: string): ColumnDef<T> | undefined;
    rowAt(rowIndex: number): T | undefined;
    cellValue(row: T, column: ColumnDef<T>): unknown;
    historyEnabled(): boolean;
    /** The message of a rejection whose validator gave none: the table's locale `invalidValue` (the element passes it; this module knows no dictionary). */
    rejectionMessage(): string;
    emit(
        ...event:
            | [name: 'cell-edit', detail: CellEditEvent<T>]
            | [name: 'edit-error', detail: CellEditErrorEvent<T>]
            | [name: 'edit-undo' | 'edit-redo', detail: undefined]
    ): void;
}

export interface CellWriter<T> {
    /** Results are in request order. Every row is resolved before the first write; one `setData` for all. */
    writeCells(requests: readonly CellWriteRequest[], options?: CellWriteOptions): CellWriteResult<T>[];
    writeCell(target: CellTarget, value: unknown, options?: CellWriteOptions): CellWriteResult<T>;
    /** Runs `fn`; every successful write inside it becomes ONE undo step and one `data-change`. Nested calls join the outer. */
    runAsCommand<R>(fn: () => R): R;
    undo(): HistoryResult;
    redo(): HistoryResult;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

interface Pending<T> {
    /** The DRAWN row index (`data-row-index`) of the edit: what every `cell-edit` and history entry carries. Never an index in `data`. */
    readonly rowIndex: number;
    readonly row: T;
    readonly column: ColumnDef<T>;
    readonly columnKey: string;
    readonly value: unknown;
    readonly oldValue: unknown;
}

export function createCellWriter<T>(ports: CellWritePorts<T>): CellWriter<T> {
    let undoStack: readonly (readonly EditChange[])[] = [];
    let redoStack: readonly (readonly EditChange[])[] = [];
    let recording: EditChange[] | null = null;
    // id -> index of the data array we last saw; valid while `data` is the array we wrote or read it from.
    let indexCache: { data: readonly T[]; byId: Map<string, number> } | null = null;

    function idIndex(data: readonly T[]): Map<string, number> {
        if (indexCache?.data === data) return indexCache.byId;
        const byId = new Map<string, number>();
        data.forEach((row, i) => {
            const id = ports.getRowId(row);
            if (!byId.has(id)) byId.set(id, i);
        });
        indexCache = { data, byId };
        return byId;
    }

    /** Applies the setters in order to a copy of `data`, publishes it once, and returns the new row per item (null = not written). */
    function commit(items: readonly Pending<T>[]): (T | null)[] {
        const data = ports.getData();
        const byId = idIndex(data);
        const next = [...data];
        let touched = false;
        const updated = items.map((item) => {
            const at = byId.get(ports.getRowId(item.row));
            const setter = item.column.valueSetter;
            if (at === undefined || !setter) return null;
            const row = setter(next[at] as T, item.value);
            next[at] = row;
            touched = true;
            recording?.push({ rowId: ports.getRowId(item.row), columnKey: item.columnKey, rowIndex: item.rowIndex, before: item.oldValue, after: item.value });
            return row;
        });
        if (touched) {
            ports.setData(next);
            indexCache = { data: next, byId };
        }
        return updated;
    }

    function writeCells(requests: readonly CellWriteRequest[], options: CellWriteOptions = {}): CellWriteResult<T>[] {
        // Snapshot first: nothing below may ask for a rendered row again.
        const snapshot = requests.map(({ target, value }) => {
            const column = ports.columnByKey(target.columnKey);
            const row = ports.rowAt(target.rowIndex);
            return { target, value, column, row };
        });
        const results: CellWriteResult<T>[] = snapshot.map(() => ({ status: 'skipped' }));
        const pending: { at: number; item: Pending<T> }[] = [];
        snapshot.forEach(({ target, value, column, row }, at) => {
            if (!column || row === undefined) return;
            const oldValue = ports.cellValue(row, column);
            const verdict = column.editValidator?.(value, row) ?? true;
            if (verdict !== true) {
                const message = typeof verdict === 'string' ? verdict : ports.rejectionMessage();
                if (options.report !== false) ports.emit('edit-error', { row, column, value, rowIndex: target.rowIndex, message });
                results[at] = { status: 'rejected', message, row, column };
                return;
            }
            if (options.emitEdit) ports.emit('cell-edit', { row, column, oldValue, newValue: value, rowIndex: target.rowIndex });
            pending.push({ at, item: { rowIndex: target.rowIndex, row, column, columnKey: target.columnKey, value, oldValue } });
        });
        const updated = commit(pending.map((p) => p.item));
        pending.forEach(({ at, item }, i) => {
            const row = updated[i];
            if (row) results[at] = { status: 'written', row, column: item.column, oldValue: item.oldValue };
        });
        return results;
    }

    function runAsCommand<R>(fn: () => R): R {
        if (recording || !ports.historyEnabled()) return ports.batch(fn);
        const steps: EditChange[] = [];
        recording = steps;
        try {
            return ports.batch(fn);
        } finally {
            recording = null;
            if (steps.length > 0) {
                undoStack = [...undoStack, steps];
                redoStack = [];
            }
        }
    }

    /** Applies one history entry by row id, as one `setData`, re-emitting `cell-edit` per cell. */
    function replay(command: readonly EditChange[], pick: (change: EditChange) => unknown): StaleChange[] {
        const stale: StaleChange[] = [];
        const data = ports.getData();
        const byId = idIndex(data);
        const items: Pending<T>[] = [];
        for (const change of command) {
            const column = ports.columnByKey(change.columnKey);
            const index = byId.get(change.rowId);
            if (!column?.valueSetter) stale.push({ rowId: change.rowId, columnKey: change.columnKey, reason: 'column' });
            else if (index === undefined) stale.push({ rowId: change.rowId, columnKey: change.columnKey, reason: 'row' });
            else {
                const row = data[index] as T;
                items.push({ rowIndex: change.rowIndex, row, column, columnKey: change.columnKey, value: pick(change), oldValue: ports.cellValue(row, column) });
            }
        }
        const updated = commit(items);
        // The index the edit itself carried (where the user edited), not where the row sits after this replay re-sorts it.
        items.forEach((item, i) => {
            const row = updated[i];
            if (row) ports.emit('cell-edit', { row, column: item.column, oldValue: item.oldValue, newValue: item.value, rowIndex: item.rowIndex });
        });
        return stale;
    }

    return {
        writeCells,
        writeCell: (target, value, options) => writeCells([{ target, value }], options)[0] as CellWriteResult<T>,
        runAsCommand,
        undo() {
            const command = undoStack.at(-1);
            if (!command) return { done: false, stale: [] };
            undoStack = undoStack.slice(0, -1);
            const stale = ports.batch(() => replay([...command].reverse(), (c) => c.before));
            redoStack = [...redoStack, command];
            ports.emit('edit-undo', undefined);
            return { done: true, stale };
        },
        redo() {
            const command = redoStack.at(-1);
            if (!command) return { done: false, stale: [] };
            redoStack = redoStack.slice(0, -1);
            const stale = ports.batch(() => replay(command, (c) => c.after));
            undoStack = [...undoStack, command];
            ports.emit('edit-redo', undefined);
            return { done: true, stale };
        },
        get canUndo() {
            return undoStack.length > 0;
        },
        get canRedo() {
            return redoStack.length > 0;
        },
    };
}
