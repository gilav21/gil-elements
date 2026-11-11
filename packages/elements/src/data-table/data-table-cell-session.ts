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
 * - Pointer: the controller's ONE delegated `pointerdown` / `pointerup` listener OFFERS the press to the sessions first, in the order
 *   range, edit, as `onPointerDown / onPointerUp(event, at, press)`. The first one that returns true claims the press (and moves the focus
 *   itself) and the rest are skipped; if none claims it the controller then focuses the pressed cell, except inside the open editor's cell.
 *   `at` is the cell under the pointer, null outside any cell; `press.anchor` is the roving cell BEFORE the press moved it, the same one
 *   for the pointerdown and the pointerup of one press. A press a session claimed that ends without a pointerup on the table (cancelled,
 *   or released outside) is reported to that session as `onPointerCancel(event, press)`, and so is a press still open when the table detaches
 *   (`event` is null; the claimant is told BEFORE the sessions detach). The press contract, per pointer id: the anchor is captured before the
 *   offer; a CLAIMED press is routed only to its claimant (its pointerup, its cancel; no other session sees them, the controller does not
 *   focus); an unclaimed press is offered to the sessions at its pointerup (and, for a touch, focuses the tapped cell); a pointerup or cancel
 *   with no press of this table behind it does nothing; presses of different pointers never touch each other.
 * - `hostUpdate()` runs before every render, after the controller's own reconcile, in the order edit, range.
 * - `service` holds the methods the session adds to the one `CellInteractionService` object; `rangeService` is provided under `range`.
 * - Cross-wave reads go through providers only: the range session reads `interaction.editingCell()`, the edit session reads
 *   `provider('range')?.gestureActive()`.
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
    /**
     * Called by the controller after it FAILED this session (its `attach()` or `hostUpdate()` threw) and detached it: answers the stand-in that takes
     * over everything the session contributes (`service` with the SAME keys, `rangeService` when it has one) while it is out, and what it holds that
     * must survive. The controller never checks which session it is: a session adds nothing the stand-in does not replace.
     */
    inert(): SessionStandIn;
    /** At the next attach, before `attach()`: the session takes back what its stand-in kept (`SessionStandIn.kept`). */
    adopt?(kept: unknown): void;
}

/** What replaces a failed session (see `CellSession.inert`): inert services that keep the session's state, nothing that touches the DOM. */
export interface SessionStandIn {
    readonly service?: Partial<CellInteractionService>;
    readonly rangeService?: RangeService;
    /** The state the stand-in holds now (values set while the session was out), handed to `CellSession.adopt` at the next attach. */
    kept?(): unknown;
}
