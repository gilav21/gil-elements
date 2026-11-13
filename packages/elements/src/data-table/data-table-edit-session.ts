/**
 * Inline editing of the grid's cells (wave 5, package B owns this file). See `data-table-cell-session.ts` for the session contract and
 * `KEY_PRIORITY` in `data-table-registry.ts` for the keys it owns: `editor` (5: every key inside the open editor's cell), `history` (25:
 * Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z) and `editStart` (60: Enter and F2 on the focused cell).
 *
 * One editor at a time. It opens by a double click, a touch double tap (300 ms, same cell), Enter / F2 on a focused cell, or
 * `startEditing(row, key)`; never on a special column, a column that is not `editable` or a disabled row. Its draft is the cell value at
 * open; a commit validates and writes through `host.writeCell` (inside `runAsCommand`, so it is one undo step), a cancel drops the draft
 * with no event. The editor follows ITS row (by id) when the rows move, and is dropped silently when the row leaves the drawn list. The
 * markup is `data-table-grid-edit.ts`, which reaches this session through `editSessionOf(host)`.
 *
 * Fixes of Angular (spec section 8): a rejected Tab does not advance (B2); the date and checkbox editors are focused and cancel on Escape
 * (B3); number and select editors report numbers and the option's own value (B4); the history and edit-start keys act only on cells (B1);
 * a window blur commits nothing (B8).
 */
import type { CellSession, InteractionContext, PointerPress } from './data-table-cell-session.js';
import {
    coerceDraft,
    commitsOnBlur,
    commitsOnEnter,
    createDoubleTap,
    decideCommit,
    editKindOf,
    type EditKind,
    historyKey,
    isBuiltInKind,
    moveError,
    reconcileEditor,
    indexOfRowId,
    tabTarget,
    textDraftFor,
    writeBackDate,
} from './data-table-edit.js';
// isTextFieldKey: a key typed in a text field is the field's own (its undo, Enter in a filter input): the history and edit-start keys never take it (B1).
import { type CellAddress, cellAddressOf, composedContains, controlInPath, FOCUSABLE, isTextFieldKey, ownClosest, ownElements, ownsTarget, requireProvider, VIEWPORT } from './data-table-host.js';
import { lazyElement } from './data-table-lazy.js';
import type { CellInteractionService } from './data-table-providers.js';
import { KEY_PRIORITY } from './data-table-registry.js';
import { interpolate } from './data-table.locales.js';
// cssString: a quoted attribute-selector value that needs no `CSS` global.
import { cssString } from './data-table.spreadsheet.js';
import type { CellEditError, ComponentOutputs, EditingCell, EnhancedColumnDef } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';

type EditService = Pick<CellInteractionService, 'editingCell' | 'cellEditError' | 'startEditing' | 'commitEdit' | 'cancelEdit' | 'isEditing' | 'editValue' | 'setEditValue'>;

/** The editing methods that do nothing: a session that is not attached answers like them, and the controller installs them when this session fails. */
export const NEUTRAL_EDIT: Readonly<EditService> = Object.freeze({
    editingCell: () => null,
    cellEditError: () => null,
    startEditing: () => false,
    commitEdit: () => undefined,
    cancelEdit: () => undefined,
    isEditing: () => false,
    editValue: () => undefined,
    setEditValue: () => undefined,
});

/** The date editor's element: loaded the first time a `editType: 'date'` editor opens (D3, J5), with the calendar it brings. */
const DATE_PICKER = lazyElement('ge-date-picker', () => import('../date-picker/define.js'));

/** What takes the focus when an editor opens: the built-in input or select, or a custom editor's own `[data-edit-input]`. */
const EDIT_INPUT = '[data-edit-input]';

/** Frames an editor's first control is given to draw the part that takes the focus. */
const FOCUS_ATTEMPTS = 4;

/**
 * Focuses `target`; a library control whose host takes no focus itself (`ge-select`: its trigger, in its shadow root, does) is focused at the first
 * candidate of its open shadow root that takes it: what the grid's FOCUSABLE rule matches, and a host that delegates its focus (`ge-select-trigger`,
 * whose own button is one shadow root further), in document order. True when the focus is inside `target`. `deepActive`: the grid's own reading
 * of the focused element (the interaction context's).
 */
function focusInto(target: HTMLElement, deepActive: () => Element | null): boolean {
    target.focus({ preventScroll: true });
    if (composedContains(target, deepActive())) return true;
    for (const el of target.shadowRoot?.querySelectorAll<HTMLElement>('*') ?? []) {
        if (!el.matches(FOCUSABLE) && !el.shadowRoot?.delegatesFocus) continue;
        el.focus({ preventScroll: true });
        if (composedContains(target, deepActive())) return true;
    }
    return false;
}

let uid = 0;

/** The open editor: one object per open (handlers drawn for it compare by identity, so a stale blur of a replaced editor does nothing). */
export interface OpenEditor<T> {
    /** Where it is now: the DRAWN row index (it follows its row) and the column. */
    at: EditingCell;
    readonly rowId: string;
    /**
     * The column as drawn NOW, and the editor it opens: refreshed at every update (`hostUpdate`), so options that arrive while the editor is open
     * are shown and mapped, and a kind that changes with them (a select whose options arrive) switches the editor; the draft is kept.
     */
    column: EnhancedColumnDef<T>;
    kind: EditKind;
    /** The cell value at open: what "unchanged" is measured against, and the shape a date editor writes back in. */
    readonly original: unknown;
    /** The draft, as the validator and the setter receive it. */
    draft: unknown;
    /**
     * What the built-in input SHOWS: the draft at open, and again after a programmatic `setEditValue`. Typing changes the draft, not this, so
     * a render never writes the input's value back under the caret.
     */
    shown: unknown;
    error: CellEditError | null;
    /**
     * A number editor holds text the browser cannot read as a number (`validity.badInput`: its value reads `''`, which would commit `null`
     * and wipe the cell). Such a draft is never committed: the editor stays open with the locale's `invalidValue`. An explicitly EMPTIED field
     * is not bad input and commits `null`.
     */
    badInput: boolean;
    /** The id of the error message, for `aria-describedby`. */
    readonly errorId: string;
    // ---- the view's own state for this editor (data-table-grid-edit.ts); a programmatic `setEditValue` resets it -------------------------
    /** A component editor's listeners, built once: the component cell keeps them while their identity is unchanged. */
    outputs: ComponentOutputs | null;
    /** The date editor's `Date` for the shown value it was made from: a render that changes nothing hands the picker the same object. */
    shownDate: { readonly shown: unknown; readonly date: Date | null } | null;
    /** The select editor's list was opened by a pointer press: its next `change` (the pick) commits. */
    pointerPick: boolean;
}

/** How a commit ended: written (or skipped by the writer) and closed, cancelled (unchanged or nothing to write into), or rejected (the editor stays open). */
type CommitResult = 'closed' | 'cancelled' | 'rejected' | 'none';

/** The session of each attached table, for its editor view (`data-table-grid-edit.ts`), which has the host and not the controller. */
const sessions = new WeakMap<object, EditSession<unknown>>();

/** The edit session of `host` while it is attached. */
export const editSessionOf = <T>(host: object): EditSession<T> | undefined => sessions.get(host) as EditSession<T> | undefined;

/**
 * A popup an editor opened (a picker's panel, a listbox), or the trigger of one that is open (`aria-expanded="true"`, where the focus stays
 * while the panel shows): a key there is that popup's, whose Escape closes it from the document's listener.
 */
const POPUP = 'ge-popover-content, [popover], [role="dialog"], [role="listbox"], [role="menu"], [aria-expanded="true"]';

/** The key event comes from inside a popup that sits in the editor's cell. */
function insideOverlay(event: Event, cell: Element): boolean {
    for (const node of event.composedPath()) {
        if (node === cell) return false;
        if (node instanceof Element && node.matches(POPUP)) return true;
    }
    return false;
}

export class EditSession<T> implements CellSession {
    private open: OpenEditor<T> | null = null;
    private attached = false;
    private teardown: (() => void)[] = [];
    private readonly doubleTap = createDoubleTap();
    /** Set while the session itself moves DOM focus off the editor (to move the roving cell with it): that blur is not the user's. */
    private quiet = false;
    /** The editor whose row the running update may move in the DOM: a blur with no related target meanwhile is the move's (see `keepFocus`). */
    private moving: OpenEditor<T> | null = null;

    constructor(protected readonly context: InteractionContext<T>) {}

    readonly service: EditService = {
        editingCell: () => (this.open ? { ...this.open.at } : null),
        cellEditError: () => this.open?.error ?? null,
        startEditing: (row, columnKey) => this.startEditing(row as T, columnKey),
        commitEdit: () => void this.commit(),
        cancelEdit: () => this.cancel(),
        isEditing: (rowIndex, columnKey) => this.open !== null && this.open.at.rowIndex === rowIndex && this.open.at.columnKey === columnKey,
        editValue: () => this.open?.draft,
        setEditValue: (value) => this.setValue(this.open, value, true),
    };

    /** ONE neutral table (`NEUTRAL_EDIT`): a broken session answers from it. */
    readonly neutral = { service: NEUTRAL_EDIT };

    private get host() {
        return this.context.host;
    }

    attach(): void {
        const { host } = this;
        const { root, disposables } = host;
        this.attached = true;
        sessions.set(host, this as EditSession<unknown>);
        this.teardown = [
            host.addKeyHandler(KEY_PRIORITY.editor, (event) => this.onEditorKey(event)),
            host.addKeyHandler(KEY_PRIORITY.history, (event) => this.onHistoryKey(event)),
            host.addKeyHandler(KEY_PRIORITY.editStart, (event) => this.onStartKey(event)),
            disposables.listen<MouseEvent>(root, 'dblclick', (event) => this.onDoubleClick(event)),
        ];
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        if (sessions.get(this.host) === (this as EditSession<unknown>)) sessions.delete(this.host);
        this.attached = false;
        // The edited row is no longer kept drawn: the editor is gone (a later attach starts with none).
        if (this.open) this.host.provider('virtual')?.retain('edit', []);
        this.open = null;
        this.doubleTap.reset();
    }

    /** The open editor, for the view. */
    current(): OpenEditor<T> | null {
        return this.open;
    }

    /** Before every render: the editor follows its row (or is dropped with it, or with its column). */
    hostUpdate(): void {
        const open = this.open;
        if (!open) return;
        const { host } = this;
        const focusedIn = composedContains(host.cellAt(open.at.rowIndex, open.at.columnKey), this.context.deepActive());
        const column = this.columnOf(open.at.columnKey);
        if (!column?.editable) return this.close(false);
        // The FRESH column (options that arrived, a renderer swapped): the editor draws and maps through it, keeping its draft.
        let kindChanged = false;
        if (column !== open.column) {
            open.column = column;
            const kind = editKindOf(column);
            if (kind !== open.kind) {
                open.kind = kind;
                kindChanged = true;
                if (kind === 'date') void DATE_PICKER.load();
            }
        }
        const rowsBefore = this.reconciledWith;
        if (!this.follow(open)) return this.close(false); // not a cancel: handing the focus to the grid would take it from wherever the user is now
        // The render can move (or redraw) the editor only when the drawn rows changed, the virtual window moved or the editor kind switched:
        // only then is its focus guarded across the render (an unrelated render queues nothing).
        const win = host.provider('virtual')?.window();
        const windowKey = win ? `${win.start}:${win.end}:${win.colStart}:${win.colEnd}` : '';
        const canMove = kindChanged || this.reconciledWith !== rowsBefore || windowKey !== this.lastWindow;
        this.lastWindow = windowKey;
        if (focusedIn && canMove) this.keepFocus(open);
    }

    /** The virtual window the last update saw (rows and columns drawn): a shift can move the editor's row in the DOM. */
    private lastWindow = '';

    /** The drawn cell of the record with this id in this column (this table's own, not a nested one's), or null when it is not drawn. */
    private cellOfRecord(rowId: string, columnKey: string): HTMLElement | null {
        const { root } = this.host;
        const selector = `[data-slot="table-row"][data-row-id=${cssString(rowId)}] > [data-slot="table-cell"][data-column=${cssString(columnKey)}]`;
        return ownElements(root, root.querySelectorAll<HTMLElement>(selector))[0] ?? null;
    }

    /** The column behind a key, as the grid draws it. */
    private columnOf(key: string): EnhancedColumnDef<T> | undefined {
        return requireProvider(this.host, 'columns')
            .enhancedColumns()
            .find((c) => String(c.accessorKey) === key);
    }

    /** The drawn rows the editor was last reconciled against: the same array again (a commit right after an update) needs no second scan. */
    private reconciledWith: readonly T[] | null = null;

    /** The editor follows its row (`reconcileEditor`); false when the row is gone (the caller closes it). One scan per drawn-rows array. */
    private follow(open: OpenEditor<T>): boolean {
        const rows = requireProvider(this.host, 'query').renderedRows();
        if (rows === this.reconciledWith) return true;
        const verdict = reconcileEditor(open.at, open.rowId, rows, (row) => this.host.config.getRowId(row));
        if (verdict.kind === 'drop') return false;
        if (verdict.kind === 'move') this.moveTo(open, verdict.rowIndex);
        this.reconciledWith = rows;
        return true;
    }

    /**
     * The render about to run may MOVE the editor's row in the DOM (a sort, new data, a virtual window shift), and a focused element that is
     * moved loses DOM focus with a blur that has no related target. That blur is the render's, not the user's: it is ignored (`moving`, until
     * the update is over), and after the render the editor takes the focus back and the roving cell is the editor's.
     */
    private keepFocus(open: OpenEditor<T>): void {
        this.moving = open;
        queueMicrotask(() => {
            if (this.moving === open) this.moving = null;
        });
        this.context.afterRender(() => {
            if (this.open !== open) return;
            const { at } = open;
            const cell = this.host.cellAt(at.rowIndex, at.columnKey);
            const active = this.context.deepActive();
            const inEditor = composedContains(cell?.querySelector('[data-slot="data-table-cell-editor"]'), active);
            const roving = this.context.focused();
            const rovingOk = roving?.rowIndex === at.rowIndex && roving.columnKey === at.columnKey;
            // Lost: on the page, or on a cell or the viewport of this table (where the grid put it back); a control the user went to is theirs.
            const lost = !active || active === active.ownerDocument.body || (ownsTarget(this.host.root, active) && active.matches(`[data-slot="table-cell"], ${VIEWPORT}`));
            if (inEditor ? rovingOk : !lost) return;
            this.quiet = true;
            try {
                if (!rovingOk) this.context.setFocus(at.rowIndex, at.columnKey);
                (inEditor ? (active as HTMLElement) : this.editorTarget(cell, open.kind))?.focus({ preventScroll: true });
            } finally {
                this.quiet = false;
            }
        });
    }

    // ---- open, commit, cancel -----------------------------------------------------------------------------------------

    /** The public `startEditing(row, key)`: the drawn row, found by identity, else by id. */
    private startEditing(row: T, columnKey: string): boolean {
        if (!this.attached) return false;
        const { host } = this;
        const query = requireProvider(host, 'query');
        const rows = query.renderedRows();
        let index = rows.indexOf(row);
        if (index === -1 && row != null) index = indexOfRowId(rows, String(host.config.getRowId(row)), (r) => host.config.getRowId(r));
        return index !== -1 && this.startAt(index, columnKey);
    }

    /**
     * Another cell asks for the editor while one is open: the open one is LEFT first, as if the focus left it (a text, number or select editor and a
     * consumer's component or renderer commit their draft; a checkbox or date one cancels). False when that commit is rejected: the open editor
     * stays with its error and the new one does not open.
     */
    private leaveForAnother(open: OpenEditor<T>): boolean {
        const commits = commitsOnBlur(open.kind) || !isBuiltInKind(open.kind);
        if (!commits) {
            this.close(false);
            return true;
        }
        return this.commit(false) !== 'rejected';
    }

    /**
     * Opens the editor on the cell at a drawn index (Angular `startEditing`, cmp 4778): only on an `editable` data column of an enabled row.
     * The draft is the cell value; the input takes the focus after the render. The same record and column already open: nothing to do (true).
     * COMMIT FIRST: an editor open on another cell is LEFT before this one opens (`leaveForAnother`: a text, number or select editor and a
     * consumer's component or renderer commit their draft, a checkbox or date editor cancels). A rejected commit keeps that editor open with its
     * error, and this one does not open (false). Its write may re-sort, re-filter or lock rows, so the asked RECORD is then found again by id and
     * checked again (still drawn, still enabled). Angular replaces the open editor and drops its draft: a deviation.
     */
    private startAt(rowIndex: number, columnKey: string): boolean {
        if (!this.attached || isSpecialColumnKey(columnKey)) return false;
        const { host } = this;
        const column = this.columnOf(columnKey);
        if (!column?.editable) return false;
        const query = requireProvider(host, 'query');
        let row = query.renderedRowAt(rowIndex);
        if (row === undefined || this.isDisabled(row)) return false;
        const current = this.open;
        const id = String(host.config.getRowId(row));
        // "Already open" is the same RECORD and column (an index can name another row after the rows moved and before the editor followed).
        if (current && (current.rowId !== id || current.at.columnKey !== columnKey)) {
            // The open editor is left first (its commit may re-sort the rows: the asked RECORD is found again by id after it).
            if (!this.leaveForAnother(current)) return false;
            rowIndex = indexOfRowId(query.renderedRows(), id, (r) => host.config.getRowId(r));
            row = rowIndex === -1 ? undefined : query.renderedRowAt(rowIndex);
            // The commit may have changed the asked record too (a setter that locks a row): it is checked again.
            if (row === undefined || this.isDisabled(row)) return false;
        } else if (current) {
            return true; // that cell's editor is already open
        }
        const value = query.cellValue(row, columnKey, column);
        const open: OpenEditor<T> = {
            at: { rowIndex, columnKey },
            rowId: id,
            column,
            kind: editKindOf(column),
            original: value,
            draft: value,
            shown: value,
            error: null,
            badInput: false,
            errorId: `ge-dt-${++uid}-edit-error`,
            outputs: null,
            shownDate: null,
            pointerPick: false,
        };
        this.open = open;
        this.reconciledWith = query.renderedRows(); // opened from these rows: nothing to follow until they change
        this.changed();
        if (open.kind === 'date') void DATE_PICKER.load();
        this.context.afterRender(() => void this.focusEditor(open));
        return true;
    }

    private isDisabled(row: T): boolean {
        // The element's own rule (`isRowDisabled` / `disabledRowIds`); a bare core host without one disables nothing.
        return (this.host as { isDisabled?: (row: T) => boolean }).isDisabled?.(row) ?? false;
    }

    /**
     * Validates and writes the draft (Angular `commitEdit`, cmp 4823). An unchanged draft cancels with no event; a rejection keeps the editor
     * open with its message (`edit-error` once per value); otherwise `cell-edit` fires, the setter writes (one undo step) and the editor closes.
     * Rows that moved since the editor opened are followed first, so the draft goes into ITS row even before a render.
     */
    private commit(refocus = true): CommitResult {
        const open = this.open;
        if (!open) return 'none';
        const { host } = this;
        const query = requireProvider(host, 'query');
        if (!this.follow(open)) {
            this.close(false);
            return 'cancelled';
        }
        if (open.badInput) {
            // Unreadable number text: nothing is written (its value reads '' and would wipe the cell); the editor stays open and says so. No
            // `edit-error`: that event is the validator's verdict on a value, and there is no value here.
            open.error = { rowIndex: open.at.rowIndex, columnKey: open.at.columnKey, value: open.draft, message: host.resolvedLocale.invalidValue };
            this.changed();
            return 'rejected';
        }
        const row = query.renderedRowAt(open.at.rowIndex);
        const column = this.columnOf(open.at.columnKey);
        if (row === undefined || !column) {
            this.close(refocus);
            return 'cancelled';
        }
        // "Unchanged" is measured against the value the editor OPENED with: an untouched draft never writes, even when the cell was changed under
        // the open editor (a data push), so that new value stays; a changed draft writes (the user's intent; the event's old value is the stored one).
        const decision = decideCommit(open.draft, open.original, open.error, open.at, open.kind);
        if (decision.action === 'cancel') {
            this.close(refocus);
            return 'cancelled';
        }
        const at = { ...open.at };
        const result = host.runAsCommand(() => host.writeCell(at, open.draft, { emitEdit: true, report: decision.report }));
        if (result.status === 'rejected') {
            if (this.open === open) {
                open.error = { rowIndex: at.rowIndex, columnKey: at.columnKey, value: open.draft, message: result.message };
                this.changed();
            }
            return 'rejected';
        }
        // `written`, or `skipped` (a column without a setter fired `cell-edit` and writes nothing, as in Angular): the editor closes.
        if (this.open === open) this.close(refocus);
        return 'closed';
    }

    private cancel(refocus = true): void {
        if (this.open) this.close(refocus);
    }

    /**
     * Closes the editor. The closed state is written BEFORE the render removes the editor, so the blur that removal causes never commits.
     * DOM focus goes back to the edited cell only when it was inside the editor (D17); a focus the user put elsewhere is left alone.
     */
    private close(refocus: boolean): void {
        const open = this.open;
        if (!open) return;
        const at = { ...open.at };
        const inside = refocus && composedContains(this.host.cellAt(at.rowIndex, at.columnKey), this.context.deepActive());
        this.open = null;
        this.changed();
        // The write may have re-sorted or re-filtered the rows: the focus goes to the edited RECORD where it is drawn now (by id), not to the index it had.
        if (inside) this.context.afterRender(() => this.open === null && this.context.setFocus(this.indexOfRow(open.rowId, at.rowIndex), at.columnKey));
    }

    /** Where the row with this id is drawn now; when it is not drawn any more, `fallback` clamped to the rows (the focus stays near where it was). */
    private indexOfRow(rowId: string, fallback: number): number {
        const { host } = this;
        const rows = requireProvider(host, 'query').renderedRows();
        const index = indexOfRowId(rows, rowId, (row) => host.config.getRowId(row));
        return index !== -1 ? index : Math.max(0, Math.min(fallback, rows.length - 1));
    }

    /** The editor's row is drawn at another index now: the editor and its error go with it (the roving cell follows in `keepFocus` when DOM focus is in the editor). */
    private moveTo(open: OpenEditor<T>, rowIndex: number): void {
        const from = { ...open.at };
        open.error = moveError(open.error, from, rowIndex);
        open.at = { rowIndex, columnKey: from.columnKey };
        this.host.provider('virtual')?.retain('edit', [rowIndex]);
    }

    /** The draft changed (typing, a component's `value-change`, or the API with `programmatic`): a shown error is cleared, as Angular does on every change. */
    private setValue(open: OpenEditor<T> | null, value: unknown, programmatic: boolean): void {
        if (!open || this.open !== open) return;
        open.draft = value;
        if (programmatic) {
            open.shown = value;
            open.badInput = false; // a value set by the API is readable: the unreadable text it replaces is gone
            // The view's per-editor state starts over with the new value (a pending pointer pick no longer applies to it).
            open.outputs = null;
            open.shownDate = null;
            open.pointerPick = false;
        }
        if (open.error || programmatic) {
            open.error = null;
            this.host.requestRender();
        }
    }

    /** The editor opened, closed or changed its error: the cell's markup and `data-editing` follow, and the edited row stays drawn under virtual scroll. */
    private changed(): void {
        const open = this.open;
        this.host.provider('virtual')?.retain('edit', open ? [open.at.rowIndex] : []);
        this.host.topics.emit('cell');
        this.host.requestRender();
    }

    /** After the render that drew it: the editor takes DOM focus (a date picker once its element is defined: its trigger, D18). */
    private async focusEditor(open: OpenEditor<T>): Promise<void> {
        if (open.kind === 'date' && !(await DATE_PICKER.load())) return;
        if (this.open !== open) return;
        let cell = this.host.cellAt(open.at.rowIndex, open.at.columnKey);
        if (open.kind === 'date') {
            await cell?.querySelector<HTMLElement & { updateComplete?: Promise<unknown> }>(EDIT_INPUT)?.updateComplete;
            if (this.open !== open) return;
            cell = this.host.cellAt(open.at.rowIndex, open.at.columnKey);
        }
        const target = this.editorTarget(cell, open.kind);
        if (!target) return;
        focusInto(target, this.deepActive);
        if (!isBuiltInKind(open.kind)) void this.keepEditorFocus(open);
        // A text editor's caret goes to the end of its value (as F2 does in a spreadsheet); a number input has no selection to set.
        if (target instanceof HTMLInputElement && target.type === 'text') target.setSelectionRange(target.value.length, target.value.length);
    }

    /**
     * A custom editor's first control may draw the part that takes the focus later, or be drawn again (a renderer that builds a new `ge-select` on
     * the render after the open: the focused one is removed and the focus falls back to the cell). For a few frames, while this editor is open and the focus is on its cell
     * or nowhere (never when the user moved it elsewhere), the control is focused again.
     */
    private async keepEditorFocus(open: OpenEditor<T>): Promise<void> {
        for (let frame = 0; frame < FOCUS_ATTEMPTS; frame++) {
            await new Promise((resolve) => requestAnimationFrame(resolve));
            if (this.open !== open) return;
            // Found again each time: a renderer may draw a new control on a render.
            const cell = this.host.cellAt(open.at.rowIndex, open.at.columnKey);
            const target = this.editorTarget(cell, open.kind);
            const active = this.context.deepActive();
            if (!target || composedContains(target, active)) continue;
            if (active && active !== this.host.root.ownerDocument.body && active !== cell) return; // the table's own document (an iframe's too)
            focusInto(target, this.deepActive);
        }
    }

    /** The interaction context's reading of the focused element, as a stable function for `focusInto`. */
    private readonly deepActive = (): Element | null => this.context.deepActive();

    /** The element of the open editor that takes focus. */
    private editorTarget(cell: HTMLElement | null, kind: EditKind): HTMLElement | null {
        if (!cell) return null;
        // The date picker's trigger is the button in its shadow root.
        if (kind === 'date') return cell.querySelector(EDIT_INPUT)?.shadowRoot?.querySelector<HTMLElement>('button') ?? null;
        if (isBuiltInKind(kind)) return cell.querySelector<HTMLElement>(EDIT_INPUT);
        // A custom editor: its own `[data-edit-input]` (in the light DOM or its open shadow root), else the component itself, else its first focusable.
        const own = cell.querySelector<HTMLElement>(EDIT_INPUT);
        if (own) return own.shadowRoot?.querySelector<HTMLElement>(EDIT_INPUT) ?? own;
        const component = cell.querySelector<HTMLElement>('[data-slot="cell-component"]');
        if (component) return component.shadowRoot?.querySelector<HTMLElement>(EDIT_INPUT) ?? component;
        // The grid's one FOCUSABLE rule (a library control such as `ge-select` too), skipping what is kept out of the tab order on purpose.
        return [...cell.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => el.getAttribute('tabindex') !== '-1') ?? null;
    }

    // ---- what the editor view calls -----------------------------------------------------------------------------------

    /** The built-in input reported a raw value (typed); `badInput` is a number input's `validity.badInput` (text it cannot read as a number). */
    input(open: OpenEditor<T>, raw: unknown, badInput = false): void {
        if (this.open !== open) return;
        open.badInput = open.kind === 'number' && badInput;
        open.shown = raw; // what the input holds now: the `live` value binding then leaves it (and the caret) alone
        const draft = open.kind === 'text' ? textDraftFor(String(raw), open.original) : coerceDraft(open.kind, raw, open.column.editOptions);
        this.setValue(open, draft, false);
    }

    /**
     * A select or checkbox changed, a date was picked: the draft takes the value and, with `commitNow`, commits at once (Angular html 237, 253;
     * D18). A select changed from the KEYBOARD (arrows on the closed select) only moves the draft: Enter, Tab or leaving commits it.
     */
    change(open: OpenEditor<T>, raw: unknown, commitNow = true): void {
        if (this.open !== open) return;
        const value = open.kind === 'date' ? writeBackDate(raw instanceof Date ? raw : null, open.original) : coerceDraft(open.kind, raw, open.column.editOptions);
        // The control keeps showing the DRAFT (a keyboard-moved select option; a picked date the validator refused).
        if (open.kind === 'select' || open.kind === 'date' || open.kind === 'checkbox') open.shown = value;
        this.setValue(open, value, false);
        if (commitNow) this.commit();
    }

    /** `setValue` of an `EditContext` or a component's `value-change`: the draft, without a commit. */
    setDraft(open: OpenEditor<T>, value: unknown): void {
        this.setValue(open, value, false);
    }

    commitFrom(open: OpenEditor<T>): void {
        if (this.open === open) this.commit();
    }

    cancelFrom(open: OpenEditor<T>): void {
        if (this.open === open) this.cancel();
    }

    /**
     * Focus left a built-in editor (`focusout` of its container, `event.currentTarget`). It commits a text, number or select editor (Angular's
     * blur; a select's draft moved by the keyboard is kept, an untouched one closes with no event) and cancels a checkbox or date one (D16); a WINDOW blur (alt-tab: no related target and the document lost focus) does nothing
     * (B8), and neither does a move of the focus inside the editor (a picker's panel) or one the session made itself.
     */
    leave(open: OpenEditor<T>, event: FocusEvent): void {
        if (this.open !== open || this.quiet) return;
        const related = event.relatedTarget as Node | null;
        if (related === null && (this.moving === open || !this.host.root.ownerDocument.hasFocus())) return;
        if (composedContains(event.currentTarget as Node | null, related)) return;
        if (commitsOnBlur(open.kind)) this.commit(false);
        else this.cancel(false);
    }

    /** The accessible name of the open editor (`editCell`, "Edit {column}"). */
    label(open: OpenEditor<T>): string {
        return interpolate(this.host.resolvedLocale.editCell, { column: open.column.header });
    }

    // ---- keys --------------------------------------------------------------------------------------------------------

    /**
     * Priority `editor` (5): every key whose composed path is inside the open editor's cell is the editor's, so nothing below acts on it
     * (selection Space, history, clipboard, range, navigation). Only Escape, Enter and Tab are acted on and prevented; typing, native copy and
     * paste and a date picker keep their own behaviour. Escape that a popover or picker panel already used (`defaultPrevented`) is left alone.
     */
    private onEditorKey(event: KeyboardEvent): boolean {
        const open = this.open;
        if (!open) return false;
        const cell = this.host.cellAt(open.at.rowIndex, open.at.columnKey);
        if (!cell || !event.composedPath().includes(cell)) return false;
        // A popup of the editor (a date picker's panel) owns its keys: its Escape closes it (from the document's listener), Tab moves inside it.
        if (event.isComposing || event.defaultPrevented || insideOverlay(event, cell)) return true;
        if (event.key === 'Escape') {
            event.preventDefault();
            this.cancel();
        } else if (event.key === 'Enter' && commitsOnEnter(open.kind) && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            // The auto-repeat of the Enter that opened the editor (still held) commits nothing: only a fresh press does.
            if (!event.repeat) this.commit();
        } else if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
            this.onTab(event, open);
        }
        return true;
    }

    /**
     * Tab commits, then moves to the next navigable cell (Shift+Tab: the previous; across the end of a row to the next one), opening an editor
     * there when that column is editable (Angular cmp 5113). A REJECTED commit keeps the editor open and focused and does not move (B2). At the
     * edge of the grid the commit happens and the key is not prevented, so the focus can leave the grid.
     */
    private onTab(event: KeyboardEvent, open: OpenEditor<T>): void {
        const { host } = this;
        const query = requireProvider(host, 'query');
        const keys = requireProvider(host, 'columns').navigableKeys();
        // The editor follows its row first (one scan, skipped when nothing moved): `open.at.rowIndex` is then where it is drawn.
        if (!this.follow(open)) {
            this.close(false);
            return;
        }
        const rows = query.renderedRows();
        const next = tabTarget(event.shiftKey, open.at.rowIndex, keys.indexOf(open.at.columnKey), keys.length, this.context.rowCount());
        const nextRow = next ? rows[next.row] : undefined;
        // The edited RECORD's own cell in the DOM as drawn now (by row id: the drawn index may already name another record), taken before the commit.
        const cell = this.cellOfRecord(open.rowId, open.at.columnKey);
        const result = this.commit(false);
        if (result === 'rejected') {
            event.preventDefault();
            return;
        }
        if (!next) {
            // The edge of the grid: the key is not prevented, so the browser moves the focus on. Shift+Tab from the input would land on its own
            // cell (the roving tab stop, the input's container) and need a second press; the cell takes the focus FIRST, synchronously, so the
            // default Shift+Tab starts from it and leaves the grid's cells in one press. No such cell drawn: the viewport takes it instead.
            if (event.shiftKey) (cell ?? this.host.root.querySelector<HTMLElement>(VIEWPORT))?.focus({ preventScroll: true });
            return;
        }
        event.preventDefault();
        const key = keys[next.col] as string;
        // The target is a RECORD: only when the commit changed the drawn rows (a re-sort, a re-filter) is it looked up again, by id.
        const moved = query.renderedRows() !== rows && nextRow !== undefined;
        const row = moved ? this.indexOfRow(String(host.config.getRowId(nextRow)), next.row) : next.row;
        this.context.setFocus(row, key, true);
        this.startAt(row, key);
    }

    /**
     * Priority `history` (25): Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo, with `enable-edit-history`, never while an editor is
     * open, and only for a key pressed on a cell or the viewport: a text field's own undo (a floating filter, a header control) is never taken
     * (B1). Undo and redo are announced, with the entries that could no longer be applied (D20).
     */
    private onHistoryKey(event: KeyboardEvent): boolean {
        if (!this.host.config.enableEditHistory || event.defaultPrevented) return false;
        const action = historyKey(event);
        if (!action || this.context.hasOpenEditor() || !this.onGrid(event)) return false;
        event.preventDefault();
        const result = action === 'undo' ? this.host.undo() : this.host.redo();
        if (result.done) {
            const locale = this.host.resolvedLocale;
            const base = action === 'undo' ? locale.undoAnnouncement : locale.redoAnnouncement;
            this.host.announce(result.stale.length > 0 ? `${base}. ${interpolate(locale.historyStaleAnnouncement, { count: result.stale.length })}` : base);
        }
        return true;
    }

    /**
     * Priority `editStart` (60): Enter or F2 on the focused cell opens its editor (Angular cmp 4590). Only for the cell itself (or the viewport,
     * meaning the roving cell): a key on a control inside the cell is the control's, and no editor opens while one is open elsewhere.
     */
    private onStartKey(event: KeyboardEvent): boolean {
        if ((event.key !== 'Enter' && event.key !== 'F2') || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        // A held key's auto-repeat starts nothing: the Enter that just committed an editor, still held, must not reopen it on every repeat.
        if (event.repeat || this.context.hasOpenEditor()) return false;
        const target = event.composedPath()[0] as Element | undefined;
        if (!target || !ownsTarget(this.host.root, target)) return false;
        let at: CellAddress | null = null;
        if (target.matches('[data-slot="table-cell"]')) at = cellAddressOf(target);
        else if (target.matches(VIEWPORT) || target === this.host.root) at = this.context.focused();
        if (!at || !this.startAt(at.rowIndex, at.columnKey)) return false;
        event.preventDefault();
        return true;
    }

    /** A key pressed on a cell (not a text field inside it) or on the viewport. */
    private onGrid(event: KeyboardEvent): boolean {
        const target = event.composedPath()[0] as Element | undefined;
        const { root } = this.host;
        if (!target?.matches || !ownsTarget(root, target) || isTextFieldKey(root, event)) return false;
        return target.matches(VIEWPORT) || target === root || ownClosest(root, target, '[data-slot="table-cell"][data-row-index][data-column]') !== null;
    }

    // ---- pointer -----------------------------------------------------------------------------------------------------

    /**
     * A double click on a data cell opens its editor (Angular `onCellDblClick`, cmp 4471), not on a control inside the cell (D22: a button, a
     * link, an input), and not inside the open editor (selecting a word in it). The event goes on bubbling: a consumer's own `dblclick`
     * listener on the table or the page still hears it (nothing in the table needs it stopped).
     */
    private onDoubleClick(event: MouseEvent): void {
        const { root } = this.host;
        // The cell from the event's target as THIS tree sees it (retargeted to a component's host when the double click is inside its shadow root).
        if (!ownsTarget(root, event.target)) return;
        const cell = ownClosest<HTMLElement>(root, event.target, '[data-slot="table-cell"][data-row-index][data-column]');
        const at = cellAddressOf(cell);
        if (!cell || !at || this.service.isEditing?.(at.rowIndex, at.columnKey)) return;
        // D22: a control between the pressed node and the cell keeps the double click: the pointer press's own rule (`CELL_CONTROLS` in this table's
        // tree, any anchor and widget role included; the real form controls inside a component's shadow root).
        if (controlInPath(event.composedPath(), cell, root.getRootNode())) return;
        this.startAt(at.rowIndex, at.columnKey);
    }

    /**
     * The touch double tap (Angular `onCellTouchEnd`, cmp 4492; D23): the second tap of the same cell within 300 ms and 10 px opens its editor
     * and claims the release. A tap that ends a range or fill gesture is not a tap (`range.gestureActive()`).
     */
    onPointerUp(event: PointerEvent, at: CellAddress | null, press: PointerPress): boolean {
        if (event.pointerType !== 'touch' || !at || !press.startCell) return false;
        if (press.startCell.rowIndex !== at.rowIndex || press.startCell.columnKey !== at.columnKey) return false;
        if (this.host.provider('range')?.gestureActive() || this.service.isEditing?.(at.rowIndex, at.columnKey)) return false;
        if (!this.doubleTap.tap(`${at.rowIndex}\u0000${at.columnKey}`, event.clientX, event.clientY, performance.now())) return false;
        if (!this.startAt(at.rowIndex, at.columnKey)) return false;
        event.preventDefault();
        return true;
    }
}
