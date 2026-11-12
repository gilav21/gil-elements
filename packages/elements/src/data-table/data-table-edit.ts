/**
 * The pure rules of inline editing (wave 5, package B): which editor a column opens, how a raw editor value becomes the draft, what a
 * commit does, where Tab goes, how the open editor follows its row, the touch double tap and the history keys. No DOM, no host:
 * `data-table-edit-session.ts` applies them, node tests pin them.
 */
import type { CellEditError, ColumnDef, EditingCell } from './data-table.types.js';

/** The editor a column opens, in Angular's precedence (html 207-290): a component, a renderer, then `editType`, else a text input. */
export type EditKind = 'component' | 'renderer' | 'checkbox' | 'date' | 'select' | 'number' | 'text';

export function editKindOf<T>(column: Pick<ColumnDef<T>, 'editComponent' | 'editRenderer' | 'editType' | 'editOptions'>): EditKind {
    if (column.editComponent) return 'component';
    if (column.editRenderer) return 'renderer';
    switch (column.editType) {
        case 'checkbox':
        case 'date':
        case 'number':
            return column.editType;
        // A select without options draws the text input, as Angular does for a missing list; an EMPTY list too (a select with nothing to pick).
        case 'select':
            return column.editOptions?.length ? 'select' : 'text';
        default:
            return 'text';
    }
}

/** The built-in editors (not a consumer's component or renderer): the table owns their keys, blur and focus. */
export const isBuiltInKind = (kind: EditKind): boolean => kind !== 'component' && kind !== 'renderer';

/** Enter commits these editors (a date picker's trigger opens its panel on Enter; a custom editor reports its own commit). */
export const commitsOnEnter = (kind: EditKind): boolean => kind === 'text' || kind === 'number' || kind === 'select' || kind === 'checkbox';

/**
 * Focus leaving the cell commits a text, number or select editor (Angular's blur; a select's keyboard-moved draft is kept, an untouched one
 * closes with no event) and cancels a checkbox or date one: their value commits on change anyway (D16).
 */
export const commitsOnBlur = (kind: EditKind): boolean => kind === 'text' || kind === 'number' || kind === 'select';

const pad = (n: number): string => String(n).padStart(2, '0');
/** `YYYY-MM-DD` of a date in the LOCAL calendar. */
const localDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** An ISO date-time: the date part, then the rest (the time and any offset), kept as written. */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})([T ].+)$/;

/**
 * The day picked in a date editor, written back in the TYPE the cell held, so a commit never changes a column's type behind the consumer's back:
 * - a number (a timestamp) -> the timestamp of the picked local day, at the time of day the cell had;
 * - a `Date` -> a `Date` on the picked day, at the time of day the cell had;
 * - an ISO date-time string -> the same string with only its date part moved by the days picked (its time and offset are kept as written);
 * - a date-only (or unreadable) string -> `YYYY-MM-DD` of the picked local day;
 * - nothing to go on (an empty cell) -> a `Date`.
 * `null` (the picker cleared) stays `null`.
 */
export function writeBackDate(picked: Date | null, previous: unknown): unknown {
    if (picked === null) return null;
    const onPickedDay = (time: Date): Date => new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(), time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
    if (typeof previous === 'number') return (Number.isFinite(previous) ? onPickedDay(new Date(previous)) : picked).getTime();
    if (previous instanceof Date) return Number.isNaN(previous.getTime()) ? new Date(picked) : onPickedDay(previous);
    if (typeof previous === 'string') {
        const dateTime = DATE_ONLY.test(previous) ? null : DATE_TIME.exec(previous);
        const shown = dateTime ? new Date(previous) : null;
        if (!dateTime || !shown || Number.isNaN(shown.getTime())) return localDay(picked);
        // The editor showed the instant's LOCAL day; the string's date part may be another day (a `Z` time near midnight). Moving the written
        // date by the days the user moved keeps the string's own calendar, time and offset exact.
        const midnight = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const days = Math.round((midnight(picked) - midnight(shown)) / 86_400_000);
        const [y, m, d] = (dateTime[1] as string).split('-').map(Number) as [number, number, number];
        const moved = new Date(Date.UTC(y, m - 1, d + days));
        return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}${dateTime[2]}`;
    }
    return new Date(picked);
}

/**
 * A raw editor value as the draft the validator and the setter receive (fixes B4: Angular hands strings). A number input gives a number
 * (`''`, or text the browser cannot read as one, is `null`); a select gives the VALUE of the picked option, of whatever type it has (the
 * option element carries its index); a checkbox gives a boolean. Anything else is passed through.
 */
export function coerceDraft(kind: EditKind, raw: unknown, options?: readonly { readonly value: unknown }[]): unknown {
    switch (kind) {
        case 'number': {
            if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
            const text = String(raw ?? '').trim();
            if (text === '') return null;
            const n = Number(text);
            return Number.isNaN(n) ? null : n;
        }
        case 'select': {
            if (raw === '') return raw; // the placeholder of a value no option holds
            const index = Number(raw);
            return Number.isInteger(index) && options?.[index] ? options[index].value : raw;
        }
        case 'checkbox':
            return !!raw;
        default:
            return raw;
    }
}

/** The index of the option that holds `value` (the select draws it selected), -1 for none. Strict first, then by string, as a native select compares. */
export function optionIndexOf(options: readonly { readonly value: unknown }[], value: unknown): number {
    const strict = options.findIndex((o) => Object.is(o.value, value));
    return strict !== -1 ? strict : options.findIndex((o) => String(o.value) === String(value));
}

/** The draft equals the stored value: `Object.is`, and two dates of the same instant are equal (a picker hands a new `Date`). */
export function sameEditValue(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
}

/**
 * What a commit does before it writes: `cancel` for a draft equal to the stored value (no event, Angular cmp 4836), else `write`; `report`
 * says whether a rejection may fire `edit-error` (false for the value of the cell already reported: a repeated rejection is reported once).
 */
export function decideCommit(draft: unknown, stored: unknown, error: CellEditError | null, at: EditingCell): { action: 'cancel' } | { action: 'write'; report: boolean } {
    if (sameEditValue(draft, stored)) return { action: 'cancel' };
    const reported = error !== null && error.rowIndex === at.rowIndex && error.columnKey === at.columnKey && sameEditValue(error.value, draft);
    return { action: 'write', report: !reported };
}

/**
 * Where Tab moves from the edited cell (Angular `computeTabTarget`, cmp 4670): the next column, wrapping to the first column of the next row
 * (Shift: the previous, wrapping to the last of the previous row). Null at the edge of the grid (the first or last cell): the browser then
 * moves the focus out, so the keyboard is never trapped.
 */
export function tabTarget(shift: boolean, rowIndex: number, colIndex: number, colCount: number, rowCount: number): { row: number; col: number } | null {
    if (colIndex < 0 || colCount === 0) return null;
    if (shift) {
        if (colIndex > 0) return { row: rowIndex, col: colIndex - 1 };
        return rowIndex > 0 ? { row: rowIndex - 1, col: colCount - 1 } : null;
    }
    if (colIndex < colCount - 1) return { row: rowIndex, col: colIndex + 1 };
    return rowIndex < rowCount - 1 ? { row: rowIndex + 1, col: 0 } : null;
}

/** What the open editor does after the rows changed: stay, move to its row's new index, or be dropped (its row is not drawn any more). */
export type EditorReconcile = { kind: 'keep' } | { kind: 'move'; rowIndex: number } | { kind: 'drop' };

/**
 * The editor follows ITS row (by id, compared as strings) rather than the index it was opened at (Angular `keepEditorOnItsRow`, cmp 2994):
 * a row still at its index keeps it, a row drawn elsewhere moves it, a row that left the drawn list drops it (silently: its draft is not
 * written into whatever row now sits there). An empty list (loading, a server page in flight) changes nothing.
 */
export function reconcileEditor<T>(at: EditingCell, rowId: string, rows: readonly T[], getId: (row: T) => string): EditorReconcile {
    if (rows.length === 0) return { kind: 'keep' };
    const here = rows[at.rowIndex];
    if (here !== undefined && String(getId(here)) === rowId) return { kind: 'keep' };
    const moved = rows.findIndex((row) => String(getId(row)) === rowId);
    return moved === -1 ? { kind: 'drop' } : { kind: 'move', rowIndex: moved };
}

/** The validation message that moves with the editor: an error on the edited cell takes the editor's new row. */
export function moveError(error: CellEditError | null, from: EditingCell, rowIndex: number): CellEditError | null {
    return error && error.rowIndex === from.rowIndex && error.columnKey === from.columnKey ? { ...error, rowIndex } : error;
}

export interface DoubleTap {
    /** A tap on cell `key` at (`x`, `y`) at `time` (ms): true when it completes a double tap (the state then restarts). */
    tap(key: string, x: number, y: number, time: number): boolean;
    reset(): void;
}

/**
 * The touch double tap (Angular `onCellTouchEnd`, cmp 4492, D23): two taps on the SAME cell within `delay` ms (300) and `slop` px (10) of
 * each other. A tap on another cell, a late tap or a far one restarts the sequence, so a fast tap across two cells never edits.
 */
export function createDoubleTap(delay = 300, slop = 10): DoubleTap {
    let last: { key: string; x: number; y: number; time: number } | null = null;
    return {
        tap(key, x, y, time) {
            const prev = last;
            if (prev && prev.key === key && time - prev.time < delay && Math.hypot(x - prev.x, y - prev.y) <= slop) {
                last = null;
                return true;
            }
            last = { key, x, y, time };
            return false;
        },
        reset() {
            last = null;
        },
    };
}

/**
 * The history key of a keydown (Angular cmp 4440-4460): Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo. Alt, a plain `z` and any
 * other key are not history keys. Matched on `key`, case-insensitively (Shift makes it `Z`).
 */
export function historyKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): 'undo' | 'redo' | null {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
    const key = event.key.toLowerCase();
    if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && !event.shiftKey) return 'redo';
    return null;
}
