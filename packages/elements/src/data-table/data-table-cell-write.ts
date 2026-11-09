/**
 * The cell-write pipeline and its undo stack, behind `host.writeCell` / `host.runAsCommand`.
 *
 * validate (`editValidator`) -> value setter -> write `data` -> undo entry. Edit, fill, paste and AI fill all go through
 * `writeCell`; it is a channel on the host rather than a controller because none of them may own it. `data` is written
 * in exactly three places in the whole table: here (`writeCell` and `writeCellByKey`, the undo/redo path) and the row
 * drop. Never mutates a row or the data array: the setter returns a new row and the array is copied.
 *
 * Fill and paste wrap their loop in `runAsCommand` so one gesture is one undo step. AI fill does not, as in Angular, so
 * it is not undoable; do not promise otherwise.
 */
import type { CellEditErrorEvent, CellEditEvent, ColumnDef } from './data-table.types.js';

export interface CellTarget {
    /** Index in the rendered rows (`data-row-index`). */
    readonly rowIndex: number;
    readonly columnKey: string;
}

export interface CellWriteOptions {
    /** Fire `cell-edit` once the value passed validation, before the setter runs (what a committed edit does). */
    readonly emitEdit?: boolean;
    /** Fire `edit-error` on a rejection. Default true; the editor passes false for a value it already reported. */
    readonly report?: boolean;
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
    readonly before: unknown;
    readonly after: unknown;
}

export interface CellWritePorts<T> {
    getData(): readonly T[];
    /** The one place the pipeline writes `data` back; the element routes it to the model store. */
    setData(next: T[]): void;
    getRowId(row: T): string;
    /** The column behind a key. */
    columnByKey(key: string): ColumnDef<T> | undefined;
    rowAt(rowIndex: number): T | undefined;
    cellValue(row: T, column: ColumnDef<T>): unknown;
    historyEnabled(): boolean;
    emit(
        ...event:
            | [name: 'cell-edit', detail: CellEditEvent<T>]
            | [name: 'edit-error', detail: CellEditErrorEvent<T>]
            | [name: 'edit-undo' | 'edit-redo', detail: undefined]
    ): void;
}

export const DEFAULT_REJECTION_MESSAGE = 'Invalid value';

export interface CellWriter<T> {
    writeCell(target: CellTarget, value: unknown, options?: CellWriteOptions): CellWriteResult<T>;
    /** Runs `fn`; every successful write inside it becomes ONE undo step. Nested calls join the outer step. */
    runAsCommand<R>(fn: () => R): R;
    undo(): boolean;
    redo(): boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

export function createCellWriter<T>(ports: CellWritePorts<T>): CellWriter<T> {
    let undoStack: readonly (readonly EditChange[])[] = [];
    let redoStack: readonly (readonly EditChange[])[] = [];
    let recording: EditChange[] | null = null;

    /** Replaces the row holding `rowId`; false when `data` no longer has it. */
    function replaceRow(row: T, column: ColumnDef<T>, value: unknown): T | null {
        if (!column.valueSetter) return null;
        const data = [...ports.getData()];
        const id = ports.getRowId(row);
        const index = data.findIndex((r) => ports.getRowId(r) === id);
        if (index === -1) return null;
        const updated = column.valueSetter(row, value);
        data[index] = updated;
        ports.setData(data);
        return updated;
    }

    function writeCell(target: CellTarget, value: unknown, options: CellWriteOptions = {}): CellWriteResult<T> {
        const column = ports.columnByKey(target.columnKey);
        const row = ports.rowAt(target.rowIndex);
        if (!column || row === undefined) return { status: 'skipped' };
        const oldValue = ports.cellValue(row, column);

        const verdict = column.editValidator?.(value, row) ?? true;
        if (verdict !== true) {
            const message = typeof verdict === 'string' ? verdict : DEFAULT_REJECTION_MESSAGE;
            if (options.report !== false) ports.emit('edit-error', { row, column, value, rowIndex: target.rowIndex, message });
            return { status: 'rejected', message, row, column };
        }
        if (options.emitEdit) ports.emit('cell-edit', { row, column, oldValue, newValue: value, rowIndex: target.rowIndex });

        const updated = replaceRow(row, column, value);
        if (updated === null) return { status: 'skipped' };
        recording?.push({ rowId: ports.getRowId(row), columnKey: target.columnKey, before: oldValue, after: value });
        return { status: 'written', row: updated, column, oldValue };
    }

    function runAsCommand<R>(fn: () => R): R {
        if (!ports.historyEnabled() || recording) return fn();
        const batch: EditChange[] = [];
        recording = batch;
        try {
            return fn();
        } finally {
            recording = null;
            if (batch.length > 0) {
                undoStack = [...undoStack, batch];
                redoStack = [];
            }
        }
    }

    /** Undo/redo write by identity, not position: the row may have moved since. Re-emits `cell-edit`. */
    function writeCellByKey(rowId: string, columnKey: string, value: unknown): void {
        const column = ports.columnByKey(columnKey);
        if (!column?.valueSetter) return;
        const data = ports.getData();
        const index = data.findIndex((r) => ports.getRowId(r) === rowId);
        const row = data[index];
        if (row === undefined) return;
        const oldValue = ports.cellValue(row, column);
        const updated = replaceRow(row, column, value);
        if (updated !== null) ports.emit('cell-edit', { row: updated, column, oldValue, newValue: value, rowIndex: index });
    }

    return {
        writeCell,
        runAsCommand,
        undo() {
            const command = undoStack.at(-1);
            if (!command) return false;
            undoStack = undoStack.slice(0, -1);
            for (const change of [...command].reverse()) writeCellByKey(change.rowId, change.columnKey, change.before);
            redoStack = [...redoStack, command];
            ports.emit('edit-undo', undefined);
            return true;
        },
        redo() {
            const command = redoStack.at(-1);
            if (!command) return false;
            redoStack = redoStack.slice(0, -1);
            for (const change of command) writeCellByKey(change.rowId, change.columnKey, change.after);
            undoStack = [...undoStack, command];
            ports.emit('edit-redo', undefined);
            return true;
        },
        get canUndo() {
            return undoStack.length > 0;
        },
        get canRedo() {
            return redoStack.length > 0;
        },
    };
}
