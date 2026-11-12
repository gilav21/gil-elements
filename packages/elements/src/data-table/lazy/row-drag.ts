/**
 * Lazy part of `RowDragController` (wave 6, package C owns this file): the native drag listeners, drop position, indicators, auto-scroll, the
 * reorder and its keyboard alternative. A build entry (`data-table/lazy/row-drag`), loaded by `lazyPart` when `enable-row-drag` is on.
 *
 * Native HTML5 drag and drop as in Angular (cmp 5903-6250), delegated on the table's root (one listener per type, own events only). Beyond
 * Angular: no live preview, the indicator only, in every mode (D14, AB6); no page `wheel` listener (AB5): `startAutoScroll` scrolls near the
 * viewport edges; the dragged row is retained in a virtual window (a native `dragend` is lost when its source node is removed); a drop onto the
 * dragged node itself or one of its descendants is refused (AB7); a drag that follows a TOUCH press is cancelled (touch row drag is
 * unsupported, as in Angular, and must not fight the touch long-press range); Alt+ArrowUp / Alt+ArrowDown and `moveRow` move the focused row
 * one step (SC 2.5.7, D4). Not undoable (D13): a drop writes `data` through the model, then `row-reorder`, then the announcement.
 */
import { type AutoScrollController, startAutoScroll } from '../../shared/auto-scroll.js';
import { CONTROLS_SELECTOR } from '../../shared/interactive-tags.js';
import { interpolate } from '../../shared/interpolate.js';
import { editorOpen, inTextField, onGrid } from '../data-table-clipboard-grid.js';
import { type DataTableCoreHost, ownClosest, ownElements, ownEvents } from '../data-table-host.js';
import type { RowDragState } from '../data-table-providers.js';
import { KEY_PRIORITY } from '../data-table-registry.js';
import { buildRowReorderEvent, dropEdge, dropPosition, siblingMove } from '../data-table-row-reorder.js';
import type { RowDragPosition, RowReorderEvent } from '../data-table.types.js';
import { reportOncePer } from '../data-table-warn.js';

const ROW = '[data-slot="table-row"][data-kind="data"]';
const VIEWPORT = '[data-slot="data-table-viewport"]';
/** The private payload type: a drop from another table or another page carries none of this table's state and is ignored anyway. */
const MIME = 'application/x-ge-data-table-row';
/** Distance from the viewport edge (px) where a drag auto-scrolls (Angular's 40 px edge zone). */
const EDGE = 40;
/** Alt + these keys move the focused row. */
const MOVE_KEYS: Readonly<Record<string, 'up' | 'down' | undefined>> = { ArrowUp: 'up', ArrowDown: 'down' };

export class RowDragPart<T> {
    /** The dragged row's id (as a string) and its drawn index at the start, while a drag of THIS table runs. */
    private dragged: { id: string; index: number } | null = null;
    /** The accepted target: its drawn index and the drop position; null over a refused target or none. */
    private over: { index: number; position: RowDragPosition } | null = null;
    /** What `dragState()` answers, built when the state changes (the renderer asks for every row). */
    private state: RowDragState | null = null;
    /** The last pointerdown on the table was a finger: the `dragstart` that follows it is cancelled. */
    private touchPress = false;
    private scroller: AutoScrollController | null = null;
    private teardown: (() => void)[] = [];
    /** Listeners that exist only while a drag runs (Escape, the document's drag over, window blur). */
    private dragTeardown: (() => void)[] = [];
    private attached = false;

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    /** The part handles drags: the shell reports it as `rowDrag.active()`, and rows are draggable only then. */
    active(): boolean {
        return this.attached;
    }

    isDragging(): boolean {
        return this.dragged !== null;
    }

    dragState(): RowDragState | null {
        return this.state;
    }

    attach(): void {
        this.attached = true;
        const { root, disposables } = this.host;
        this.teardown = [
            disposables.listen<PointerEvent>(root, 'pointerdown', (event) => (this.touchPress = event.pointerType === 'touch'), true),
            disposables.listen<DragEvent>(root, 'dragstart', ownEvents(root, (event: DragEvent) => this.onDragStart(event))),
            disposables.listen<DragEvent>(root, 'dragover', ownEvents(root, (event: DragEvent) => this.onDragOver(event))),
            disposables.listen<DragEvent>(root, 'drop', ownEvents(root, (event: DragEvent) => this.onDrop(event))),
            disposables.listen<DragEvent>(root, 'dragend', () => this.clear()),
            this.host.addKeyHandler(KEY_PRIORITY.rowMove, (event) => this.onKey(event)),
        ];
    }

    detach(): void {
        this.attached = false;
        this.clear();
        for (const undo of this.teardown.splice(0)) undo();
        (this.hinted?.grid ?? this.grid())?.removeAttribute('aria-description');
        this.hinted = null;
    }

    /**
     * The grid element that carries the keyboard hint and the text it carries. The renderer does not write `aria-description` on the grid, so the part
     * does, once: when it attaches, when the locale's text changes, and when the grid element is a new one (the skeleton gave way to the grid). An
     * unrelated render costs one comparison, no DOM query and no queued task.
     */
    private hinted: { grid: HTMLElement; text: string } | null = null;

    /** Called by the shell before every render. */
    hostUpdate(): void {
        const text = this.host.resolvedLocale.rowDragHint;
        if (this.hinted?.text === text && this.hinted.grid.isConnected) return;
        this.host.afterRender(() => {
            if (!this.attached) return;
            const grid = this.grid();
            if (!grid) return; // not drawn yet (a skeleton): the next update tries again
            grid.setAttribute('aria-description', text);
            this.hinted = { grid, text };
        });
    }

    private grid(): HTMLElement | undefined {
        const { root } = this.host;
        return ownElements(root, root.querySelectorAll<HTMLElement>('[data-slot="table"]'))[0];
    }

    // ---- the native drag ----------------------------------------------------------------------------------------

    private onDragStart(event: DragEvent): void {
        const { root, config } = this.host;
        // An earlier drag whose end was never heard is over now: its state and listeners go first (idempotent).
        this.clear();
        const rowEl = ownClosest<HTMLElement>(root, event.target, ROW);
        if (!rowEl) return; // not a row drag (a column header's, a consumer's own draggable)
        const index = Number(rowEl.dataset['rowIndex']);
        const row = this.host.provider('query')?.renderedRowAt(index);
        const origin = (event.composedPath()[0] ?? event.target) as Element;
        const refused =
            this.touchPress || // touch row drag is unsupported (and the long press belongs to the range gesture)
            !config.enableRowDrag ||
            config.loading ||
            row === undefined ||
            (this.host.provider('selection')?.isDisabled(row) ?? false) ||
            inTextField(root, event) || // a text selection's own drag
            origin.closest?.(CONTROLS_SELECTOR) != null || // a control's own drag
            this.host.provider('interaction')?.editingCell?.()?.rowIndex === index; // an editor is open in the row
        if (refused) {
            event.preventDefault();
            return;
        }
        const id = String(config.getRowId(row));
        this.dragged = { id, index };
        this.over = null;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(MIME, id);
        }
        // Kept drawn for the whole drag: a native `dragend` is not delivered when the source node leaves the window.
        this.host.provider('virtual')?.retain('row-drag', [index]);
        this.scroller = startAutoScroll({ edge: EDGE });
        this.watchDrag();
        this.publish();
    }

    /**
     * While a drag runs: the document's drag over outside the table stops the auto-scroll; Escape and a window blur end the drag. Its end is also heard
     * where the root cannot hear it: a `dragend` dispatched to a source row a render REMOVED never bubbles to the root (nor anywhere), so a drop anywhere on
     * the page, a `dragend` the document does see, or the first pointer event after it (none is dispatched while a native drag runs) ends it too.
     */
    private watchDrag(): void {
        const { root, disposables } = this.host;
        const doc = root.ownerDocument;
        this.dragTeardown = [
            disposables.listen(doc, 'dragend', () => this.clear(), true),
            disposables.listen(doc, 'drop', () => this.clear()), // bubble phase: this table's own drop handler (on the root) has run first
            disposables.listen(doc, 'pointermove', () => this.clear(), true),
            disposables.listen<DragEvent>(doc, 'dragover', (event) => {
                if (!event.composedPath().includes(root)) this.scroller?.stop();
            }, true),
            disposables.listen<KeyboardEvent>(doc, 'keydown', (event) => {
                if (event.key === 'Escape') this.clear();
            }, true),
            disposables.listen(doc.defaultView ?? window, 'blur', () => this.clear()),
        ];
    }

    private onDragOver(event: DragEvent): void {
        if (!this.dragged) return; // not this table's drag: not accepted, so no drop happens here
        this.scroller?.update(event.clientX, event.clientY);
        const target = this.targetOf(event);
        if (!target) return; // over the header, the toolbar: the last target stays
        const position = this.judge(target.index, target.position);
        if (position === null) {
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
            this.setOver(null);
            return;
        }
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        this.setOver({ index: target.index, position });
    }

    /** The row under the pointer and the raw position in it; below the last drawn row of the viewport it is "after the last row" (Angular's container drag over). */
    private targetOf(event: DragEvent): { index: number; position: RowDragPosition } | null {
        const { root, config } = this.host;
        const rowEl = ownClosest<HTMLElement>(root, event.target, ROW);
        if (rowEl) {
            const rect = rowEl.getBoundingClientRect();
            const relative = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5;
            return { index: Number(rowEl.dataset['rowIndex']), position: dropPosition(config.rowDragMode === 'tree' ? 'tree' : 'flat', relative) };
        }
        if (!ownClosest(root, event.target, VIEWPORT)) return null;
        const last = (this.host.provider('query')?.renderedRows().length ?? 0) - 1;
        const lastEl = last < 0 ? null : this.host.rowAt(last);
        return lastEl && event.clientY > lastEl.getBoundingClientRect().bottom ? { index: last, position: 'below' } : null;
    }

    /**
     * Whether the dragged row may land at `index` / `position`, and the position it lands with (null: refused). Refused: a disabled target; in a
     * tree table, a flat drag across depths (`on` becomes `below` in flat mode, Angular), and a tree drop onto the dragged node itself or one of
     * its descendants (AB7); and whatever `rowDragAllowDrop` vetoes (a veto that throws is a veto, reported once).
     */
    private judge(index: number, raw: RowDragPosition, draggedId = this.dragged?.id): RowDragPosition | null {
        const { config } = this.host;
        const query = this.host.provider('query');
        const rows = query?.renderedRows() ?? [];
        const target = rows[index];
        const fromIndex = rows.findIndex((r) => String(config.getRowId(r)) === draggedId);
        const dragRow = rows[fromIndex];
        if (!query || target === undefined || dragRow === undefined || draggedId === undefined) return null;
        if (this.host.provider('selection')?.isDisabled(target)) return null;
        let position = raw;
        if (config.enableSubRows) {
            const targetNode = query.renderedTreeRowAt(index);
            if (config.rowDragMode === 'tree') {
                if (targetNode?.path.some((id) => String(id) === draggedId)) return null;
            } else {
                if (targetNode?.depth !== query.renderedTreeRowAt(fromIndex)?.depth) return null;
                if (position === 'on') position = 'below';
            }
        }
        return this.allowed(dragRow, target, position) ? position : null;
    }

    private allowed(dragRow: T, target: T, position: RowDragPosition): boolean {
        const veto = this.host.config.rowDragAllowDrop;
        if (!veto) return true;
        try {
            return veto(dragRow, target, position) !== false;
        } catch (error) {
            reportOncePer(this.host, 'row-drag-allow-drop', '[ge-data-table] rowDragAllowDrop threw; the drop is refused:', error);
            return false;
        }
    }

    private onDrop(event: DragEvent): void {
        const dragged = this.dragged;
        const over = this.over;
        if (!dragged) return; // another table's or another page's drag
        event.preventDefault();
        const position = over ? this.judge(over.index, over.position) : null; // checked again: the data or the veto may have changed meanwhile
        const rows = this.host.provider('query')?.renderedRows() ?? [];
        const reorder =
            over && position
                ? buildRowReorderEvent({ rows, draggedId: dragged.id, overIndex: over.index, position, getRowId: this.host.config.getRowId, treeMode: this.host.config.rowDragMode === 'tree' })
                : null;
        this.clear();
        if (reorder) this.commit(reorder, rows.length);
    }

    /** The one drop path (a drag, a key, `moveRow`): `data` through the model with `localReorder` (one `data-change`), then `row-reorder`, then the announcement. */
    private commit(event: RowReorderEvent<T>, total: number): void {
        const { config, model } = this.host;
        if (config.localReorder) {
            // The one reorder path: the service's `reorderData` (the element's public one), which knows the flat and the tree rules.
            const reorder = this.host.provider('rowDrag');
            if (reorder) model.set('data', reorder.reorderData(model.get('data'), event));
        }
        this.host.emit('row-reorder', event);
        this.host.announce(interpolate(this.host.resolvedLocale.rowMovedAnnouncement, { position: event.toIndex + 1, total }));
    }

    private setOver(over: { index: number; position: RowDragPosition } | null): void {
        const same = over === null ? this.over === null : this.over?.index === over.index && this.over.position === over.position;
        if (same) return;
        this.over = over;
        this.publish();
    }

    /** Rebuilds `dragState()` and draws it (only when the target or position changed, never per `dragover`). */
    private publish(): void {
        const { dragged, over } = this;
        this.state = dragged ? { draggedId: dragged.id, overIndex: over?.index ?? -1, edge: over ? dropEdge(over.position) : null } : null;
        this.host.requestRender();
    }

    /** Ends a drag of this table, however it ended (drop, `dragend`, Escape, blur, the flag off, detach). */
    private clear(): void {
        for (const undo of this.dragTeardown.splice(0)) undo();
        this.scroller?.stop();
        this.scroller = null;
        if (!this.dragged) return;
        this.dragged = null;
        this.over = null;
        this.host.provider('virtual')?.retain('row-drag', []);
        this.publish();
    }

    // ---- the keyboard alternative -------------------------------------------------------------------------------

    /** Moves `row` one step among the drawn rows (flat) or among its siblings (tree), skipping disabled rows and honouring the veto; false when nothing moved. */
    moveRow(row: T, direction: 'up' | 'down'): boolean {
        const { config } = this.host;
        const query = this.host.provider('query');
        if (!query || !config.enableRowDrag || config.loading) return false;
        const rows = query.renderedRows();
        const id = String(config.getRowId(row));
        const index = rows.findIndex((r) => String(config.getRowId(r)) === id);
        if (index === -1) return false;
        const selection = this.host.provider('selection');
        const line = rows.map((r, i) => ({ parentId: config.enableSubRows ? (query.renderedTreeRowAt(i)?.parentId ?? null) : null, disabled: selection?.isDisabled(r) ?? false }));
        const step = siblingMove(line, index, direction);
        const position = step ? this.judge(step.overIndex, step.position, id) : null;
        const event = step && position ? buildRowReorderEvent({ rows, draggedId: id, overIndex: step.overIndex, position, getRowId: config.getRowId, treeMode: config.rowDragMode === 'tree' }) : null;
        if (!event) return false;
        this.commit(event, rows.length);
        return true;
    }

    /** Alt+ArrowUp / Alt+ArrowDown on a focused cell (not in a text field, no editor open): the row moves and the focus follows it. */
    private onKey(event: KeyboardEvent): boolean {
        const { root, config } = this.host;
        const direction = MOVE_KEYS[event.key];
        if (!direction || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented || event.isComposing || !config.enableRowDrag) return false;
        // The shared grid-key rule (a body cell, the viewport or the root; never a text field): a checkbox or a button in a cell is no text field, Alt+Arrow moves its row.
        if (!onGrid(root, event)) return false;
        const at = this.host.provider('interaction')?.focusedCell();
        const row = at ? this.host.provider('query')?.renderedRowAt(at.rowIndex) : undefined;
        if (!at || row === undefined || editorOpen(this.host)) return false;
        event.preventDefault(); // consumed even at an end: the keys are the row move's
        const id = String(config.getRowId(row));
        if (this.moveRow(row, direction)) {
            this.host.afterRender(() => {
                if (!this.attached) return;
                const moved = this.host.provider('query')?.renderedRows().findIndex((r) => String(config.getRowId(r)) === id) ?? -1;
                if (moved !== -1) this.host.provider('interaction')?.focusCell(moved, at.columnKey);
            });
        }
        return true;
    }
}
