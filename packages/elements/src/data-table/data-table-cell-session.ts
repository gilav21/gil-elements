/**
 * The seam that splits the cell-interaction controller into per-wave sessions (joint step 0 of waves 5 and 6).
 *
 * `CellInteractionController` keeps the focus: the roving tabindex, DOM focus, the reconcile step after a render, the
 * pointer-driven focus. It creates two plain classes (not controllers: no other controller may be imported, and the boundary
 * test only looks at file names) that own the rest of the cell state:
 *
 * - `EditSession` (`data-table-edit-session.ts`, wave 5 package B): the open editor, its draft and error, commit / cancel, Tab
 *   advance, double click and double tap, the history keys, the `retain('edit', ...)` of the edited row.
 * - `RangeSession` (`data-table-range-session.ts`, wave 6 package A): the cell range, the fill handle and the readout. A thin static
 *   shell that loads its implementation lazily (`data-table-lazy.ts`).
 *
 * Contract, so the two waves never need to know each other:
 * - A session registers its OWN key handlers (`host.addKeyHandler(KEY_PRIORITY.x, ...)`) and its own listeners through
 *   `context.host.disposables`; the controller never routes keys to it.
 * - Pointer. The controller listens, all in the CAPTURE phase (a consumer's `stopPropagation` cannot hide an event):
 *   on the table's ROOT: `pointerdown` (records a press, own events only: a nested table records its own), `pointerup` and `pointercancel`
 *   (end it, whatever they landed on inside the root, a nested table and a closed shadow root included), `gotpointercapture` (records that the
 *   pointer is captured); on the DOCUMENT: `pointerdown` (a press outside the root clears the focus guard at once), `pointerup` /
 *   `pointercancel` (close what the root did not hear: a release OUTSIDE the table), `lostpointercapture` (forgets the capture), and on the
 *   window `blur` (every open press is cancelled). A press is recorded per POINTER ID (a finger and a mouse never touch each other's).
 *   At its pointerdown the sessions are OFFERED the press in the order range, edit, as `onPointerDown(event, at, press)`: `at` is the cell
 *   under the pointer (null outside any cell) and `press` is `{ anchor, pressed, startCell }` (`anchor`: the roving cell BEFORE the press
 *   moved it; `pressed`: the element of the table it began on (an overlay itself: a press that begins on one has no start cell); `startCell`: the body cell it began
 *   on, null when it began on a resize handle, a header, a popover or elsewhere), the same object content for every call of one press. The first
 *   session that returns true CLAIMS the press and moves the focus itself; if none does, the controller focuses the pressed cell (a mouse, at the
 *   pointerdown, except in the open editor's cell).
 *   A CLAIMED press is routed only to its claimant, and it is told how the press ended exactly once: `onPointerUp(event, at, press)` when the
 *   pointer was released on this table (`at`: the cell under the pointer there; a touch and a captured pointer are located by a hit test at the
 *   release point, looking through elements marked `data-pointer-transparent`, an element that floats out of its cell is not that cell), else
 *   `onPointerCancel(event, press)`: the browser cancelled it, or it was released outside the table or over a nested one (`event` is then the
 *   pointerup / pointercancel; when the same pointer presses again before the close ran it is still the real pointerup), or `event` is null:
 *   the window lost focus, the table detached (told BEFORE the sessions detach), the pointer pressed again with its pointerup lost, or the
 *   claimant itself failed. No other session sees a claimed press and the controller does not focus.
 *   An UNCLAIMED press is offered to the sessions again at its pointerup, as `onPointerUp(event, at, press)`, but only when it began on a body
 *   cell (`press.startCell`) and was released on this table; a touch tap then focuses the pressed cell if the finger is within a small slop
 *   of it (further away it was a drag). A pointerup or cancel with no press of this table behind it does nothing.
 * - `hostUpdate()` runs before every render, after the controller's own reconcile, in the order edit, range.
 * - `service` holds the methods the session adds to the one `CellInteractionService` object; `rangeService` is provided under `range`.
 * - A session that throws in `attach()` or `hostUpdate()` has a bug: the error is reported once, it is marked broken FIRST (it is never called
 *   again, not even for the presses it claimed, which just end), detached, and left out of everything until the next attach. Its `neutral`
 *   services (`NEUTRAL_RANGE`, `NEUTRAL_RANGE_CELL`, `NEUTRAL_EDIT`: one definition per session, in its file, exposed as `session.neutral`)
 *   replace its `service` / `rangeService`. While it is out `cellRange` reads null; a `cellRange` assigned meanwhile is held by the element
 *   and handed over at the next connect with a real range service; the range the failed range session held is kept by its detach and served
 *   again after the next attach. An error in any other callback is reported and the callback answers nothing.
 * - A widget in a cell that manages its own focus (a combobox, a menu button, a custom editor that is not a native control) marks itself, or an
 *   ancestor inside the cell, with `data-table-keeps-focus`: the grid then treats it like a control (it does not move the focus, does not offer the
 *   press to the sessions, and the press has no start cell). The press is still RECORDED in the capture phase, so a `stopPropagation` of a renderer
 *   can never hide a plain press from the grid; the attribute is the explicit opt-out.
 * - Cross-wave reads go through providers only: the range session reads `interaction.editingCell()`, the edit session reads
 *   `provider('range').gestureActive()` (`range` is always provided; ask `active()` whether the part handles ranges).
 *
 * After this step nobody but the lead edits `data-table-cell-interaction-controller.ts`: a wave edits its session file.
 */
import type { TemplateResult } from 'lit';
import type { CellAddress, DataTableCoreHost } from './data-table-host.js';
import type { CellInteractionService, RangeService } from './data-table-providers.js';

/** What a session may use of the controller (the focus state is the controller's; sessions ask, never reach in). */
export interface InteractionContext<T> {
    readonly host: DataTableCoreHost<T>;
    /** The roving cell. */
    focused(): CellAddress | null;
    /** Moves the roving cell, gives it DOM focus and, with `reveal`, scrolls it into view; an invalid target is ignored. */
    setFocus(rowIndex: number, columnKey: string, reveal?: boolean): void;
    /** Data rows drawn (group headers not counted): the bound of a drawn row index. */
    rowCount(): number;
    /** The column keys keyboard navigation moves across, in drawn order. */
    focusableKeys(): readonly string[];
    /** Rows moved by a page key. */
    pageSize(): number;
    /** `host.afterRender` that is skipped when the table was detached (or attached anew) by the time the task runs. */
    afterRender(task: () => void): void;
    /**
     * An editor is open somewhere (lets range and clipboard stand down without reading each other). Not `CellInteractionService.isEditing(row, key)`,
     * which asks about ONE cell.
     */
    hasOpenEditor(): boolean;
    /** The element that has DOM focus, through open and closed shadow roots. */
    deepActive(): Element | null;
}

/** What a session knows of the press besides the event: the roving cell BEFORE the press moved it (a shift+click extends from it). */
export interface PointerPress {
    readonly anchor: CellAddress | null;
    /** The element of this table the press began on (an overlay is itself the element, not the cell under it), null when it began on none (outside any element of the table). */
    readonly pressed: Element | null;
    /** The body cell the press began on, null when it began elsewhere (a resize handle, a header, a popover, the body outside any cell). The same for every call of one press. */
    readonly startCell: CellAddress | null;
}

export interface CellSession {
    attach(): void;
    detach(): void;
    hostUpdate?(): void;
    /** Drawn over the grid inside the viewport, after the table (the range readout, the fill handle); the controller gathers the sessions' answers into its own `renderOverlay`. */
    renderOverlay?(): TemplateResult | null;
    onPointerDown?(event: PointerEvent, at: CellAddress | null, press: PointerPress): boolean | void;
    onPointerUp?(event: PointerEvent, at: CellAddress | null, press: PointerPress): boolean | void;
    /**
     * A press this session CLAIMED ended without a pointerup on the table: the browser cancelled it (`pointercancel`), or the pointer was released
     * outside the table (that arrives as the page-level `pointerup`, reported here as a cancel: the session decides whether a release outside
     * commits its gesture). A session that claims a press is always told how it ended, by `onPointerUp` or by this.
     */
    onPointerCancel?(event: PointerEvent | null, press: PointerPress): void;
    /** Methods merged into the `interaction` service. */
    readonly service?: Partial<CellInteractionService>;
    /** Provided under `range` (range session only). */
    readonly rangeService?: RangeService;
    /** What the controller installs in place of `service` / `rangeService` when this session fails: inert objects with the same keys and typed answers (false, '', null). */
    readonly neutral: { readonly service?: Partial<CellInteractionService>; readonly rangeService?: RangeService };
}
