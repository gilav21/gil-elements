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
 * - Pointer: the controller's ONE delegated `pointerdown` / `pointerup` listener does the focus first, then calls the sessions in
 *   the order range, edit. The first one that returns true claims the press and the rest are skipped. `at` is the cell under the
 *   pointer, null outside any cell.
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
    /** The edit session has an open editor (lets range and clipboard stand down without reading each other). */
    isEditing(): boolean;
    /** The element that has DOM focus, through open and closed shadow roots. */
    deepActive(): Element | null;
}

export interface CellSession {
    attach(): void;
    detach(): void;
    hostUpdate?(): void;
    /** Drawn over the grid inside the viewport, after the table (the range readout, the fill handle); the controller gathers the sessions' answers into its own `renderOverlay`. */
    renderOverlay?(): TemplateResult | null;
    onPointerDown?(event: PointerEvent, at: CellAddress | null): boolean | void;
    onPointerUp?(event: PointerEvent, at: CellAddress | null): boolean | void;
    /** Methods merged into the `interaction` service. */
    readonly service?: Partial<CellInteractionService>;
    /** Provided under `range` (range session only). */
    readonly rangeService?: RangeService;
}

export type CellSessionFactory<T> = (context: InteractionContext<T>) => CellSession;
