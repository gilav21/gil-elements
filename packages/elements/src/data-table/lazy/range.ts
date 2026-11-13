/**
 * Lazy part of `RangeSession` (wave 6, package A owns this file): range selection by pointer, key and touch, the fill handle, the
 * readout. A build entry (`data-table/lazy/range`), loaded by `lazyPart` when `enable-cell-range-selection` or `enable-fill-handle`
 * is on. The shell hands it the held range through `setRange` right BEFORE `attach` (`lazyPart`'s `beforeAttach`), so `setRange` works on a part
 * that is not attached yet, and reads it back with `getRange` before disposing it; the shell keeps the VALUE rules (columns, rows, turn-off), this
 * part draws and gestures. The fill handle and the range readout it draws over the cells carry `data-pointer-transparent` (the controller looks a
 * release through such an element; it keeps no list of slot names).
 *
 * Gestures (spec A.2):
 * - Mouse and pen: a primary press on a DATA cell is CLAIMED at its pointerdown (the controller then moves no focus: the anchor is focused here);
 *   Shift extends from `press.anchor`. NO `preventDefault` (D12: focus, `dblclick` and a native row `dragstart` keep working; the viewport is
 *   `user-select: none` in range mode). The end follows the cell under the pointer, one hit test per frame, with auto-scroll near the viewport
 *   edges (D7). The release arrives as the claimant's end callback: a pointerup (on the table or outside) commits, a pointercancel (a native row drag
 *   took over, the browser cancelled) or a null end (blur, detach) gives back the range from before the press. A 1x1 result is plain focus.
 * - Touch: a long press (500 ms, 10 px, passive until it fires) starts a range at the cell under the finger, then a non-passive `touchmove` on the
 *   window follows it without scrolling; a long press on a selected cell is left to the context menu (Angular).
 * - Fill handle: a press on it (any pointer) is claimed, the end row follows the row under the pointer, the release writes the series.
 * - Keys (`KEY_PRIORITY.range`): Shift+navigation extends the end (beyond Angular, D3), Escape clears the range (or cancels a drag), Ctrl/Cmd+A selects
 *   every drawn cell, Ctrl/Cmd+D fills the first row of the range down into the rest (the keyboard alternative to the handle drag).
 */
import { html, nothing, type TemplateResult } from 'lit';
import { startAutoScroll, type AutoScrollController } from '../../shared/auto-scroll.js';
import { onLongPress } from '../../shared/touch.js';
import type { InteractionContext, PointerPress } from '../data-table-cell-session.js';
import { CELL_SELECTOR, onGrid, rowIdsAt } from '../data-table-clipboard-grid.js';
import { buildFillValues } from '../data-table-fill.js';
import { fillOutcome, type FillInput, planFill, repeatFirst } from '../data-table-fill-apply.js';
import { type CellAddress, cellAddressOf, ownClosest, ownElements, ownsTarget, shortcutLetter, VIEWPORT } from '../data-table-host.js';
import { ensureIconElement } from '../data-table-icons.js';
import { NAVIGATION_KEYS } from '../data-table-keys.js';
import { interpolate } from '../data-table.locales.js';
import { extendRange, selectAllRange } from '../data-table-range-keys.js';
import { readoutLabels, readoutText, renderFillHandle, renderReadout } from '../data-table-range-readout.js';
import {
    fillSourceRange,
    type NormalizedRange,
    normalizeCellRange,
    rangeChartPayload,
    type RangeColumn,
    rangeEdges,
    rangeStats,
    readRangeColumns,
    sameRange,
} from '../data-table-range.js';
import { KEY_PRIORITY } from '../data-table-registry.js';
import type { CellRange, ColumnDef, RangeAggregateStats, RangeChartPayload } from '../data-table.types.js';
import { isSpecialColumnKey } from '../data-table.utils.js';

const OVERLAY = '[data-pointer-transparent]';
const HANDLE = '[data-slot="fill-handle"]';
const ROW = '[data-row-index]';
/** What a long press on a cell never starts a range on (Angular's mousedown list, plus the explicit opt-out). */
const TOUCH_CONTROLS = 'input, textarea, select, button, a, [data-table-keeps-focus], ge-checkbox, ge-input, ge-button';
/** The range announcement waits for the selection to stop changing (a drag across ten cells is one announcement, with the final size). */
const ANNOUNCE_MS = 500;
/** The auto-scroll band at the viewport's edges, as in Angular's row drag. */
const AUTO_SCROLL_EDGE = 40;

interface Drag {
    readonly kind: 'range' | 'fill';
    /** The press the controller routed to us (mouse, pen, a fill on any pointer); null for the touch range, which ends by its own touch events. */
    readonly press: PointerPress | null;
    /** The fixed corner of a range drag (focused); null for a fill. */
    readonly anchor: CellAddress | null;
    /** The range before the gesture: a cancelled range drag gives it back. */
    readonly before: CellRange | null;
    readonly scroller: AutoScrollController;
    readonly off: (() => void)[];
    x: number;
    y: number;
    frame: number | null;
}

interface Hit {
    /** The data cell under the point (not a special column), or null. */
    readonly cell: CellAddress | null;
    /** The drawn row under the point (a fill follows rows), or null. */
    readonly row: number | null;
}
const NO_HIT: Hit = Object.freeze({ cell: null, row: null });

/** The data column keys as a key -> position map, per keys array. */
const indexes = new WeakMap<readonly string[], ReadonlyMap<string, number>>();
function indexOf(keys: readonly string[]): ReadonlyMap<string, number> {
    let map = indexes.get(keys);
    if (!map) indexes.set(keys, (map = new Map(keys.map((key, i) => [key, i]))));
    return map;
}

export class RangePart<T> {
    private range: CellRange | null = null;
    private drag: Drag | null = null;
    /** The fill in progress: its source and the row the pointer is over. */
    private fill: { readonly source: NormalizedRange; end: number } | null = null;
    /** Where the fill handle is drawn (px in the viewport's content), as measured after the last render. */
    private handleAt: { top: number; left: number } | null = null;
    private off: (() => void)[] = [];
    private cancelAnnounce: (() => void) | null = null;
    private handleFrame: number | null = null;
    /** Watches the grid element's size while a handle is shown (`observeLayout`); disconnected at detach. */
    private resizer: ResizeObserver | null = null;
    private observed: Element | null = null;
    /** What placed the handle when it was last measured (`followHandle`): the same inputs need no new measure. */
    private handleInputs: readonly unknown[] | null = null;
    /** The keys of the last update: a range whose column LEAVES the layout is dropped (a programmatic range on a hidden column is only not drawn). */
    private layout: readonly string[] | null = null;
    /** `navigableKeys()` builds a new array per call: memoised by the enhanced columns (a memoised array) it is derived from. */
    private keysMemo: { columns: unknown; keys: readonly string[] } | null = null;
    private normMemo: { range: CellRange | null; keys: readonly string[]; norm: NormalizedRange | null } | null = null;
    private columnsMemo: { rows: unknown; columns: unknown; keys: readonly string[]; norm: string; value: RangeColumn[]; stats?: RangeAggregateStats | null; payload?: RangeChartPayload | null } | null = null;

    constructor(protected readonly context: InteractionContext<T>) {}

    // ---- the contract with the shell ------------------------------------------------------------------------------------------------

    /** The part handles ranges: `aria-selected`, the range flags and the overlays are drawn. */
    active(): boolean {
        return true;
    }

    getRange(): CellRange | null {
        return this.range;
    }

    /** From the shell (a programmatic value, a trim, the handover before `attach`): no render here, the shell asks for one. */
    setRange(range: CellRange | null): void {
        this.range = range;
    }

    attach(): void {
        const { host } = this.context;
        const { root, disposables } = host;
        this.off = [
            host.addKeyHandler(KEY_PRIORITY.range, (event) => this.onKey(event)),
            // The viewport scrolls without a render (a plain grid): the handle of a pinned (sticky) cell moves, and a drag's end follows the cell now under the pointer.
            disposables.listen(root, 'scroll', (event) => this.onScroll(event), { capture: true, passive: true }),
            disposables.add(onLongPress(root, (event, path) => this.onLongPress(event, path))),
        ];
        // A page resize moves the handle with no render (a flexible column). (A host with no window, a node test's, has none to listen to.)
        const view = root.ownerDocument?.defaultView;
        if (view) this.off.push(disposables.listen(view, 'resize', () => this.measureSoon(), { passive: true }));
    }

    detach(): void {
        // A gesture still running is given back (as `endDrag(false)` does, without the render: the table is leaving): a range drag restores the range
        // from before its press, which the shell reads back with `getRange()` right after; a fill writes nothing.
        const drag = this.drag;
        if (drag?.kind === 'range') this.range = drag.before;
        this.stopDrag();
        this.fill = null;
        this.cancelAnnounce?.();
        this.cancelAnnounce = null;
        if (this.handleFrame !== null) cancelAnimationFrame(this.handleFrame);
        this.handleFrame = null;
        this.handleAt = null;
        this.handleInputs = null;
        this.resizer?.disconnect();
        this.resizer = null;
        this.observed = null;
        for (const off of this.off) off();
        this.off = [];
    }

    hostUpdate(): void {
        const keys = this.keys();
        if (keys !== this.layout) {
            const before = this.layout;
            this.layout = keys;
            // A column of the range left the layout (hidden, removed): the range goes (spec A.2, A.5). One named by a value set while the column was
            // already hidden was never drawn and stays held.
            if (before && this.range && normalizeCellRange(this.range, before) && !normalizeCellRange(this.range, keys)) {
                this.range = null;
                this.context.host.topics.emit('cell');
            }
        }
        this.followHandle();
    }

    /**
     * The handle is measured after a render only when what places it may have changed: its cell, the drawn rows (data, page, sort, window), the columns
     * (order, widths, pins, visibility) or the direction. An unrelated render (a hover, an announcement) reads no layout. A scroll or a resize of the
     * page measures it in the next frame (`onScroll`, the window's `resize`).
     */
    private followHandle(): void {
        const { host } = this.context;
        const cell = this.fillHandleCell();
        if (!cell) {
            // No handle: nothing to measure (the render of this update draws none, `renderOverlay` asks `fillHandleCell` too).
            this.handleInputs = null;
            this.handleAt = null;
            return;
        }
        const virtual = host.provider('virtual');
        const window = virtual?.active() ? virtual.window() : null;
        const inputs = [
            cell.rowIndex,
            cell.columnKey,
            host.provider('query')?.renderedRows(),
            host.provider('columns')?.enhancedColumns(),
            window?.start,
            window?.end,
            window?.colStart, // a column window that moves draws or drops the handle's cell
            window?.colEnd,
            host.root.getAttribute('dir'),
            host.config.columns,
        ] as const;
        const last = this.handleInputs;
        if (last?.every((value, i) => value === inputs[i])) return;
        this.handleInputs = inputs;
        this.context.afterRender(() => this.measureHandle());
    }

    /** A measure in the next frame, whenever there should be a handle: also one not drawn now (its cell was scrolled out and may be back). */
    private measureSoon(): void {
        if (!this.fillHandleCell()) return;
        this.handleFrame ??= requestAnimationFrame(() => {
            this.handleFrame = null;
            this.measureHandle();
        });
    }

    renderOverlay(): TemplateResult | null {
        const handle = this.handleAt && this.fillHandleCell() ? renderFillHandle(this.handleAt) : null;
        const stats = this.stats();
        let readout: TemplateResult | null = null;
        if (stats) {
            const chart = stats.numericCount > 0 && this.chartPayload() !== null;
            if (chart) ensureIconElement();
            readout = renderReadout(stats, readoutLabels(this.context.host.resolvedLocale), chart, this.openChart);
        }
        return handle || readout ? html`${handle ?? nothing}${readout ?? nothing}` : null;
    }

    // ---- the range service ----------------------------------------------------------------------------------------------------------

    normalized(): NormalizedRange | null {
        const range = this.range;
        const keys = this.keys();
        const memo = this.normMemo;
        // Compared by VALUE: the range may be the consumer's own object, edited in place and assigned again (`r.endRow = 9; table.cellRange = r`).
        if (memo && memo.keys === keys && sameRange(memo.range, range)) return memo.norm;
        const norm = normalizeCellRange(range, keys);
        this.normMemo = { range: range && { ...range }, keys, norm };
        return norm;
    }

    /** Asked for every drawn cell in range mode: the rectangle and the key positions are memoised, so this is a few comparisons. */
    isInRange(rowIndex: number, columnKey: string): boolean {
        const n = this.normalized();
        if (!n || rowIndex < n.minRow || rowIndex > n.maxRow) return false;
        const col = indexOf(this.keys()).get(columnKey) ?? -1;
        return col >= n.minCol && col <= n.maxCol;
    }

    edgeOf(rowIndex: number, columnKey: string): string {
        const n = this.normalized();
        const col = indexOf(this.keys()).get(columnKey);
        return n && col !== undefined ? rangeEdges(n, rowIndex, col) : '';
    }

    /** The dashed band of a fill drag: only rows BELOW the source, within its columns (dragging up previews nothing). */
    isFillPreview(rowIndex: number, columnKey: string): boolean {
        const fill = this.fill;
        if (!fill || rowIndex <= fill.source.maxRow || rowIndex > fill.end) return false;
        const col = indexOf(this.keys()).get(columnKey) ?? -1;
        return col >= fill.source.minCol && col <= fill.source.maxCol;
    }

    extendTo(rowIndex: number, columnKey: string): void {
        const anchor = this.range ? { rowIndex: this.range.startRow, columnKey: this.range.startCol } : this.focusedData();
        if (!anchor || !Number.isInteger(rowIndex) || !this.keys().includes(columnKey)) return;
        this.setOwn({ startRow: anchor.rowIndex, startCol: anchor.columnKey, endRow: rowIndex, endCol: columnKey });
    }

    /** Null unless `enable-range-actions` and a range of two cells or more (cmp 2626). */
    stats(): RangeAggregateStats | null {
        if (!this.context.host.config.enableRangeActions) return null;
        const memo = this.rangeColumns();
        if (!memo) return null;
        if (memo.stats === undefined) memo.stats = rangeStats(memo.value);
        return memo.stats;
    }

    chartPayload(): RangeChartPayload | null {
        const memo = this.rangeColumns();
        if (!memo) return null;
        if (memo.payload === undefined) memo.payload = rangeChartPayload(memo.value);
        return memo.payload;
    }

    /** `range-chart-open` with the payload; nothing without numeric data. A stable function: the readout's button binds it. */
    readonly openChart = (): void => {
        const payload = this.chartPayload();
        if (payload) this.context.host.emit('range-chart-open', payload);
    };

    /** Bottom-right of the range, else the focused data cell; null without the fill handle or while an editor is open. */
    fillHandleCell(): CellAddress | null {
        if (!this.context.host.config.enableFillHandle || this.context.hasOpenEditor()) return null;
        const n = this.normalized();
        if (!n) return this.focusedData();
        const key = this.keys()[n.maxCol];
        return key === undefined ? null : { rowIndex: n.maxRow, columnKey: key };
    }

    gestureActive(): boolean {
        return this.drag !== null;
    }

    /** The fill from the range (or the focused cell) down to `targetEndRow`: one undo step, `fill-series` once; false when nothing was written. */
    fillDownTo(targetEndRow: number): boolean {
        const source = fillSourceRange(this.normalized(), this.focusedData(), this.keys());
        return source !== null && this.runFill(source, targetEndRow, buildFillValues);
    }

    // ---- pointer --------------------------------------------------------------------------------------------------------------------

    onPointerDown(event: PointerEvent, at: CellAddress | null, press: PointerPress): boolean {
        if (press.pressed?.matches(HANDLE)) return this.startFill(event, press);
        // Fill handle only (no range selection): a press on a body cell moves the focus there, so the range a fill or a paste left goes (the handle and a copy follow the new cell).
        if (!this.context.host.config.enableCellRangeSelection && at && press.startCell) this.setOwn(null);
        if (event.pointerType === 'touch' || !at || !press.startCell || !this.canSelect() || isSpecialColumnKey(at.columnKey)) return false;
        const extend = event.shiftKey && press.anchor !== null && !isSpecialColumnKey(press.anchor.columnKey);
        this.startRange(extend && press.anchor ? press.anchor : at, at, press, event.clientX, event.clientY);
        return true;
    }

    /** The claimed press ended: a pointerup (on the table or outside it) commits, anything else gives the gesture back. */
    onPointerCancel(event: PointerEvent | null, press: PointerPress): void {
        if (this.drag?.press === press) this.endDrag(event?.type === 'pointerup');
    }

    private canSelect(): boolean {
        return this.context.host.config.enableCellRangeSelection && !this.context.hasOpenEditor();
    }

    private startRange(anchor: CellAddress, end: CellAddress, press: PointerPress | null, x: number, y: number): void {
        this.endDrag(false);
        this.context.host.root.ownerDocument.getSelection()?.removeAllRanges();
        const drag = this.newDrag('range', press, anchor, x, y);
        this.context.setFocus(anchor.rowIndex, anchor.columnKey);
        this.setOwn({ startRow: anchor.rowIndex, startCol: anchor.columnKey, endRow: end.rowIndex, endCol: end.columnKey });
        const { root, disposables } = this.context.host;
        drag.off.push(
            // A native row drag (enable-row-drag) that starts from this press takes over: the range from before the press comes back.
            disposables.listen(root, 'dragstart', () => this.endDrag(false), true),
            // The pointerdown is not prevented (D12), so the browser's own mousedown focus lands on the nearest focusable ancestor of a cell that is not the
            // anchor (a shift+click): the viewport. The focus belongs on the anchor.
            disposables.listen<FocusEvent>(root, 'focusin', (event) => {
                const target = event.target as Element;
                if (target.matches(VIEWPORT) && ownsTarget(root, target)) this.context.setFocus(anchor.rowIndex, anchor.columnKey);
            }),
        );
        if (press) this.followPointer(drag);
        else this.followTouch(drag);
    }

    private startFill(event: PointerEvent, press: PointerPress): boolean {
        if (!this.context.host.config.enableFillHandle || this.context.hasOpenEditor()) return false;
        const source = fillSourceRange(this.normalized(), this.focusedData(), this.keys());
        if (!source) return false;
        event.preventDefault(); // no text selection, no compatibility mouse events (Angular prevents the handle's mousedown too)
        this.endDrag(false);
        this.fill = { source, end: source.maxRow };
        this.followPointer(this.newDrag('fill', press, null, event.clientX, event.clientY));
        this.changed();
        return true;
    }

    private newDrag(kind: Drag['kind'], press: PointerPress | null, anchor: CellAddress | null, x: number, y: number): Drag {
        const drag: Drag = { kind, press, anchor, before: this.range, scroller: startAutoScroll({ edge: AUTO_SCROLL_EDGE }), off: [], x, y, frame: null };
        this.drag = drag;
        return drag;
    }

    /** Mouse and pen (and a fill on any pointer): the document's moves of this gesture; the end comes from the controller. */
    private followPointer(drag: Drag): void {
        const { root, disposables } = this.context.host;
        drag.off.push(disposables.listen<PointerEvent>(root.ownerDocument, 'pointermove', (event) => this.move(drag, event.clientX, event.clientY)));
    }

    /** The touch range after a long press: a NON-passive move on the window, added only now (a scroll that started never fights it), so the finger selects instead of scrolling. */
    private followTouch(drag: Drag): void {
        const { root, disposables } = this.context.host;
        const win = root.ownerDocument.defaultView ?? window;
        drag.off.push(
            disposables.listen<TouchEvent>(
                win,
                'touchmove',
                (event) => {
                    const touch = event.touches[0];
                    if (event.touches.length !== 1 || !touch) return this.endDrag(false); // a second finger: pan and zoom, the gesture is given up
                    if (event.cancelable) event.preventDefault();
                    this.move(drag, touch.clientX, touch.clientY);
                },
                { passive: false },
            ),
            disposables.listen(win, 'touchend', () => this.endDrag(true)),
            disposables.listen(win, 'touchcancel', () => this.endDrag(false)),
            // The platform's long-press menu (and the context-menu addon's) is not this gesture's.
            disposables.listen(root, 'contextmenu', (event) => event.preventDefault(), true),
        );
    }

    private move(drag: Drag, x: number, y: number): void {
        if (this.drag !== drag) return;
        drag.x = x;
        drag.y = y;
        drag.scroller.update(x, y);
        drag.frame ??= requestAnimationFrame(() => {
            drag.frame = null;
            this.track(drag);
        });
    }

    /** One hit test at the gesture's last point: the range end follows the data cell, the fill end follows the row (a group or detail row keeps the last one). */
    private track(drag: Drag): void {
        if (this.drag !== drag) return;
        const hit = this.hit(drag.x, drag.y);
        if (drag.kind === 'fill') {
            if (this.fill && hit.row !== null && hit.row !== this.fill.end) {
                this.fill.end = hit.row;
                this.changed();
            }
        } else if (drag.anchor) {
            // Over the sticky header or footer (where auto-scroll runs) no body cell is hit: the end goes to the body row nearest the pointer in that
            // direction, in the column under it, so the range keeps growing while the grid scrolls under the header.
            const cell = hit.cell ?? this.edgeCell(drag.x, drag.y);
            const { anchor } = drag;
            if (cell) this.setOwn({ startRow: anchor.rowIndex, startCol: anchor.columnKey, endRow: cell.rowIndex, endCol: cell.columnKey });
        }
    }

    /** The data cell at the body's edge nearest a point outside the body (on the sticky header or footer, or outside the viewport); null for a point inside it. */
    private edgeCell(x: number, y: number): CellAddress | null {
        const { root } = this.context.host;
        const viewport = ownElements(root, root.querySelectorAll<HTMLElement>(VIEWPORT))[0];
        if (!viewport) return null;
        const box = viewport.getBoundingClientRect();
        const rectOf = (slot: string): DOMRect | undefined => ownElements(root, viewport.querySelectorAll(`[data-slot="${slot}"]`))[0]?.getBoundingClientRect();
        const top = Math.max(box.top, rectOf('table-header')?.bottom ?? box.top) + 1;
        const bottom = Math.min(box.bottom, rectOf('table-footer')?.top ?? box.bottom) - 1;
        if (y >= top && y <= bottom && x > box.left && x < box.right) return null; // inside the body: a group or detail row keeps the last cell
        const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
        return this.hit(clamp(x, box.left + 1, box.right - 1), clamp(y, top, bottom)).cell;
    }

    /** The gesture ends: `commit` keeps it (a fill writes, a 1x1 range collapses to plain focus, a range is announced), else it is given back. */
    private endDrag(commit: boolean): void {
        const drag = this.drag;
        if (!drag) return;
        if (commit && drag.frame !== null) this.track(drag); // the last move had not been drawn yet
        this.stopDrag();
        if (drag.kind === 'fill') {
            const fill = this.fill;
            this.fill = null;
            this.changed();
            if (commit && fill) this.runFill(fill.source, fill.end, buildFillValues);
            return;
        }
        if (!commit) return this.setOwn(drag.before);
        const range = this.range;
        if (range && range.startRow === range.endRow && range.startCol === range.endCol) this.setOwn(null);
        else if (range) this.announceSoon();
    }

    /** Removes what the current gesture listens to (no state change, no render): also what a detach does. */
    private stopDrag(): void {
        const drag = this.drag;
        if (!drag) return;
        this.drag = null;
        for (const off of drag.off) off();
        drag.scroller.stop();
        if (drag.frame !== null) cancelAnimationFrame(drag.frame);
    }

    private onLongPress(event: TouchEvent, path: readonly EventTarget[]): void {
        const { host } = this.context;
        const touch = event.touches[0];
        if (!touch || this.drag || !this.canSelect()) return;
        const { root } = host;
        if (path.some((node) => node instanceof Element && root.contains(node) && node !== root && node.matches(TOUCH_CONTROLS))) return;
        const { cell } = this.hit(touch.clientX, touch.clientY);
        if (!cell) return;
        // A hold on what is already selected belongs to its context menu (Angular): starting a fresh range would erase what the menu is about.
        if (this.range && this.isInRange(cell.rowIndex, cell.columnKey)) return; // inside the range (not merely the focused cell or a selected row)
        this.startRange(cell, cell, null, touch.clientX, touch.clientY);
    }

    private onScroll(event: Event): void {
        const target = event.target as Element | null;
        if (!target?.matches?.(VIEWPORT) || !ownsTarget(this.context.host.root, target)) return;
        const drag = this.drag;
        if (drag) this.track(drag); // auto-scroll moved the cells under a still pointer
        this.measureSoon(); // a pinned (sticky) cell moved with the scroll
    }

    /** The first element of THIS table at a point, looking through its overlays (the handle under the finger, the readout). */
    private hit(x: number, y: number): Hit {
        const { root } = this.context.host;
        const tree = root.getRootNode();
        const scope = tree instanceof ShadowRoot ? tree : root.ownerDocument;
        for (const el of scope.elementsFromPoint(x, y)) {
            if (!root.contains(el)) return NO_HIT;
            if (!ownsTarget(root, el)) return NO_HIT; // a nested table
            if (ownClosest(root, el, OVERLAY)) continue;
            const address = cellAddressOf(ownClosest(root, el, CELL_SELECTOR));
            const rowIndex = Number(ownClosest(root, el, ROW)?.getAttribute('data-row-index') ?? Number.NaN);
            return { cell: address && !isSpecialColumnKey(address.columnKey) ? address : null, row: Number.isInteger(rowIndex) ? rowIndex : null };
        }
        return NO_HIT;
    }

    // ---- keys -----------------------------------------------------------------------------------------------------------------------

    private onKey(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.isComposing || event.altKey || !this.inGrid(event)) return false;
        if (event.key === 'Escape') return this.onEscape(event);
        // A focus move WITHOUT Shift (an arrow, Home / End, a page key, Tab) ends the range, as in a spreadsheet: the next Shift+key starts a new one
        // anchored at the cell the focus moved to. The key goes on to navigation (false: not consumed here).
        if (this.range && !this.drag && (event.key === 'Tab' || (!event.shiftKey && NAVIGATION_KEYS.has(event.key)))) {
            this.setOwn(null);
            return false;
        }
        if (this.context.hasOpenEditor()) return false;
        const { config } = this.context.host;
        const mod = event.ctrlKey || event.metaKey;
        const key = shortcutLetter(event); // Ctrl/Cmd+A and D on a non-Latin layout too (the physical key)
        if (event.shiftKey && NAVIGATION_KEYS.has(event.key)) return config.enableCellRangeSelection && this.extend(event);
        if (!mod || event.shiftKey) return false;
        if (key === 'a') return config.enableCellRangeSelection && this.selectAll(event);
        if (key === 'd') return config.enableFillHandle && this.fillDownKey(event);
        return false;
    }

    /** A key typed on a cell of this table, or on its viewport or root (the roving focus): never in a text field, never on a control outside the cells. */
    private inGrid(event: KeyboardEvent): boolean {
        return onGrid(this.context.host.root, event); // the one grid-key rule (clipboard, row move and range share it)
    }

    private onEscape(event: KeyboardEvent): boolean {
        if (this.drag) this.endDrag(false);
        else if (this.range) this.setOwn(null);
        else return false;
        event.preventDefault();
        return true;
    }

    private extend(event: KeyboardEvent): boolean {
        const { host } = this.context;
        const next = extendRange(this.range, this.context.focused(), event.key, {
            rowCount: this.context.rowCount(),
            keys: this.keys(),
            pageSize: this.context.pageSize(),
            rtl: getComputedStyle(host.root).direction === 'rtl',
            ctrl: event.ctrlKey || event.metaKey,
        });
        if (next === undefined) return false;
        event.preventDefault();
        this.setOwn(next);
        // The DOM focus stays on the anchor; the END is kept on screen.
        if (next) host.provider('virtual')?.reveal(next.endRow, next.endCol);
        this.announceSoon();
        return true;
    }

    private selectAll(event: KeyboardEvent): boolean {
        const all = selectAllRange(this.context.rowCount(), this.keys());
        if (!all) return false;
        event.preventDefault();
        this.setOwn(all);
        this.announceSoon();
        return true;
    }

    /** Ctrl/Cmd+D: the first row of a range of two rows or more is copied into the rest of it (Excel), the keyboard alternative to the handle drag. */
    private fillDownKey(event: KeyboardEvent): boolean {
        const n = this.normalized();
        if (!n || n.maxRow === n.minRow) return false;
        event.preventDefault();
        this.runFill({ ...n, maxRow: n.minRow }, n.maxRow, repeatFirst);
        return true;
    }

    // ---- writing --------------------------------------------------------------------------------------------------------------------

    private runFill(source: NormalizedRange, target: number, series: FillInput<T>['series']): boolean {
        const { host } = this.context;
        const query = host.provider('query');
        const columns = host.provider('columns')?.enhancedColumns() ?? [];
        if (!query || host.config.loading) return false; // no write into rows that are being replaced (like a paste or a row drag)
        const plan = planFill<T>({
            source,
            target,
            keys: this.keys(),
            rowCount: this.context.rowCount(),
            rowAt: (rowIndex) => query.renderedRowAt(rowIndex),
            column: (key) => columns.find((c) => String(c.accessorKey) === key) as ColumnDef<T> | undefined,
            value: (row, column) => query.cellValue(row, column.accessorKey, column),
            series,
        });
        if (!plan) return false;
        // ONE command and ONE write: one undo step, one data-change, every row resolved before the first write.
        const before = rowIdsAt(host, source.minRow, plan.target);
        const outcome = fillOutcome(plan, host.runAsCommand(() => host.writeCells(plan.requests)));
        if (!outcome) return false;
        // The write re-sorted or re-filtered the filled rows (the filled column is the sort or filter key): the rectangle would cover other rows, so none is left.
        const moved = rowIdsAt(host, source.minRow, plan.target).some((id, i) => id !== before[i]);
        this.setOwn(moved ? null : outcome.range);
        host.emit('fill-series', outcome.event);
        host.announce(interpolate(host.resolvedLocale.fillAnnouncement, { count: outcome.rows }));
        return true;
    }

    // ---- state ----------------------------------------------------------------------------------------------------------------------

    /** A range this part made (a gesture, a key, a fill): drawn, and published on the `cell` topic, only when it changed. */
    private setOwn(range: CellRange | null): void {
        if (sameRange(this.range, range)) return;
        this.range = range;
        this.changed();
    }

    private changed(): void {
        this.context.host.topics.emit('cell');
        this.context.host.requestRender();
    }

    private keys(): readonly string[] {
        const service = this.context.host.provider('columns');
        if (!service) return [];
        const columns = service.enhancedColumns();
        if (this.keysMemo?.columns !== columns) this.keysMemo = { columns, keys: service.navigableKeys() };
        return this.keysMemo.keys;
    }

    /** The focused cell when it is a data cell (a special column is no fill source and no range anchor). */
    private focusedData(): CellAddress | null {
        const at = this.context.focused();
        return at && !isSpecialColumnKey(at.columnKey) ? at : null;
    }

    /** The range reshaped per column, memoised on the rows, the columns and the rectangle: the readout never reads the DOM. */
    private rangeColumns(): NonNullable<RangePart<T>['columnsMemo']> | null {
        const n = this.normalized();
        const { host } = this.context;
        const query = host.provider('query');
        if (!n || !query) return null;
        const rows = query.renderedRows();
        const columns = host.provider('columns')?.enhancedColumns() ?? [];
        const keys = this.keys();
        const norm = `${n.minRow}:${n.maxRow}:${n.minCol}:${n.maxCol}`;
        const memo = this.columnsMemo;
        if (memo?.rows === rows && memo.columns === columns && memo.keys === keys && memo.norm === norm) return memo;
        this.columnsMemo = { rows, columns, keys, norm, value: readRangeColumns(n, keys, rows, columns) };
        return this.columnsMemo;
    }

    private announceSoon(): void {
        const { host } = this.context;
        this.cancelAnnounce?.();
        this.cancelAnnounce = host.disposables.timeout(() => {
            this.cancelAnnounce = null;
            const n = this.normalized();
            if (!n) return; // read when it fires: a range cleared meanwhile says nothing
            const locale = host.resolvedLocale;
            const size = interpolate(locale.rangeAnnouncement, { rows: n.maxRow - n.minRow + 1, columns: n.maxCol - n.minCol + 1 });
            const stats = this.stats();
            host.announce(stats ? `${size}. ${readoutText(stats, readoutLabels(locale))}` : size);
        }, ANNOUNCE_MS);
    }

    /** Places the handle at the inline-end bottom corner of its cell, in the viewport's content coordinates (scroll offsets added); hidden when the cell is not drawn. */
    private measureHandle(): void {
        const next = this.handlePoint();
        const at = this.handleAt;
        if (next === at || (next && at && Math.abs(next.top - at.top) < 0.5 && Math.abs(next.left - at.left) < 0.5)) return;
        this.handleAt = next;
        this.context.host.requestRender();
    }

    /**
     * A layout change with no change of the handle's inputs (a detail row opened above it, a density change, a column's content reflowing) moves its
     * cell: the grid element is watched by a ResizeObserver while a handle is shown, which measures in the next frame.
     */
    private observeLayout(grid: HTMLElement | null): void {
        if (!grid || grid === this.observed || typeof ResizeObserver === 'undefined') return;
        this.resizer ??= new ResizeObserver(() => this.measureSoon());
        this.resizer.disconnect();
        this.resizer.observe(grid);
        this.observed = grid;
    }

    private handlePoint(): { top: number; left: number } | null {
        const { host } = this.context;
        const cell = this.fillHandleCell();
        const el = cell && host.cellAt(cell.rowIndex, cell.columnKey);
        const viewport = el && ownClosest<HTMLElement>(host.root, el, VIEWPORT);
        if (!el || !viewport) return null;
        this.observeLayout(ownClosest<HTMLElement>(host.root, el, '[data-slot="table"]'));
        const box = viewport.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        const rtl = getComputedStyle(host.root).direction === 'rtl';
        return {
            top: rect.bottom - box.top - viewport.clientTop + viewport.scrollTop,
            left: (rtl ? rect.left : rect.right) - box.left - viewport.clientLeft + viewport.scrollLeft,
        };
    }
}
