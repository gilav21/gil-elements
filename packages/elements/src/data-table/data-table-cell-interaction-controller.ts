import { html, type TemplateResult } from 'lit';
import type { CellSession, InteractionContext, PointerPress } from './data-table-cell-session.js';
import { EditSession } from './data-table-edit-session.js';
import { type CellAddress, cellAddressOf, type DataTableCoreHost, ownElements, ownEvents, ownsTarget, requireProvider } from './data-table-host.js';
import { TOUCH_SLOP_PX, withinTouchSlop } from '../shared/touch.js';
import { NAVIGATION_KEYS, nearestColumn, nextFocus, pageRows } from './data-table-keys.js';
import type { CellInteractionService, RangeService } from './data-table-providers.js';
import { RangeSession } from './data-table-range-session.js';
import { KEY_PRIORITY } from './data-table-registry.js';

const VIEWPORT = '[data-slot="data-table-viewport"]';
const BODY = '[data-slot="table-body"]';
/**
 * Every element of the table that sits over its cells marks itself with this attribute. It means "look through me to find where a GESTURE is":
 * the RELEASE of a press (claimed, or begun on a cell) is located on the cell below. It does NOT mean "a tap on me is a tap on the cell under me":
 * an overlay may be interactive (the readout's buttons), so a press that BEGINS on one has no start cell, offers nothing to the sessions at its
 * pointerup and focuses no cell, for a mouse and a touch alike.
 */
const OVERLAY = '[data-pointer-transparent]';

/** What the controller keeps of a press: what the sessions are told (`PointerPress`) and the session that claimed it. */
interface Press extends PointerPress {
    /** Set in the bubble phase by the session that claimed it. */
    claimedBy: CellSession | null;
    /** The bubble-phase listener ran for this press: when it did not (a widget stopped `pointerdown`) nothing is offered at its pointerup either. */
    bubbled: boolean;
    /** Where the pointer went down: a tap on something that is not in a cell is measured from here. */
    readonly x: number;
    readonly y: number;
    /** The press was not a cell press (a control, an overlay, a popover floating out of its cell, a non-primary button): a tap on it focuses no cell either. */
    readonly bypass: boolean;
}

/** Whether the point is in the box, or within `slop` px of it. */
const inside = (box: DOMRect, x: number, y: number, slop = 0): boolean => x >= box.left - slop && x <= box.right + slop && y >= box.top - slop && y <= box.bottom + slop;

/** An element drawn inside a cell but floating outside its box (a popover or menu of the cell, positioned over other cells) is not that cell: the point is not in the cell's rect. */
function floatsOut(el: Element, x: number, y: number): boolean {
    const host = el.closest(CELL);
    if (!host || el === host) return false;
    // The point in the cell's box is the common case: not floating, and no style is read. Only a point OUTSIDE the box asks whether the element is (or sits
    // in) a positioned box (absolute / fixed, or a `popover`), the only kind that can float out of the cell.
    return !inside(host.getBoundingClientRect(), x, y) && isPositioned(el, host);
}

function isPositioned(el: Element, host: Element): boolean {
    for (let e: Element | null = el; e && e !== host; e = e.parentElement) {
        if (e.hasAttribute('popover')) return true;
        const { position } = getComputedStyle(e);
        if (position === 'absolute' || position === 'fixed') return true;
    }
    return false;
}

/** What a session is told of a press (the controller's own bookkeeping, `claimedBy`, stays out). */
const pressOf = ({ anchor, pressed, startCell }: Press): PointerPress => ({ anchor, pressed, startCell });


/** A press on one of these belongs to the control: it keeps its own focus and click. */
const CONTROLS = 'input, textarea, select, button, a[href], [role="checkbox"], ge-checkbox, ge-input, [contenteditable]:not([contenteditable="false"]), [data-table-keeps-focus]';
/** `data-table-keeps-focus` is the explicit opt-out for a widget in a cell that manages its own focus (a combobox, a menu button, a custom editor): treated like a control. */
const CELL = '[data-slot="table-cell"]';
/** Inside a cell, also an anchor used as a button or a link, and anything the content made tabbable (the cell itself is never matched: the walk stops at it). */
const CELL_CONTROLS = `${CONTROLS}, a, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])`;
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Rows moved by one page key when nothing is drawn to measure. */
const FALLBACK_PAGE = 10;

/** Whether `node` is `ancestor` or inside it, across shadow roots: Node.contains stops at a shadow boundary, this goes from a shadow root to its host. */
function composedContains(ancestor: Node | null | undefined, node: Node | null): boolean {
    if (!ancestor) return false;
    for (let at = node; at; at = at.parentNode ?? (at as ShadowRoot).host ?? null) if (at === ancestor) return true;
    return false;
}

/**
 * Focus, editing and range of the grid's cells: one owner because reconciling them after a render writes them together.
 * This controller is the focus (wave 4): the roving tabindex (exactly one cell, the focused one, is a tab stop; the viewport
 * only while no drawn cell is), arrow-key navigation over the drawn order, and keeping the focused cell on screen.
 * Tab is never handled here, so it can always leave the grid. Editing (wave 5) and range / fill (wave 6) are the two session
 * files it creates and calls (`data-table-cell-session.ts`); after the joint step 0 a wave edits its session, not this file.
 */
export class CellInteractionController<T> {
    private focused: CellAddress | null = null;
    /** Where the focused column sat in the focusable list, for the nearest one when it leaves the layout. */
    private lastColumn = 0;
    /** DOM focus is inside the grid: a render that loses it (rows moved, a row left the window) gives it back. */
    private within = false;
    /** A pointer is down: the focus it causes on the viewport is not a Tab arrival. */
    private pointer = false;
    private observer: MutationObserver | null = null;
    /** The row that held the focus when a node or group was opened or closed: the render that follows follows it. */
    private rowAtExpansion: { at: CellAddress; id: string; hadFocus: boolean } | null = null;
    private watched: Element | null = null;
    /**
     * Bumped by every attach and every detach, so it is odd while attached. The host keeps its queued tasks across a disconnect (other controllers
     * wait on theirs), so a deferred task of this controller checks that it is still running in the attach that queued it.
     */
    private attachment = 0;
    private teardown: (() => void)[] = [];

    /** The wave sessions, in the order the pointer reaches them (range, then edit); `hostUpdate` runs them edit, then range. */
    private readonly edit: EditSession<T>;
    private readonly range: RangeSession<T>;
    /** The one list: attach and the pointer go through it forwards, detach and `hostUpdate` backwards. */
    private readonly sessions: readonly CellSession[];
    private readonly service: CellInteractionService;
    /** The range service of the range session: it outlives a disconnect (the controller is built once), unlike its provider entry. Undefined while the range session is failed. */
    readonly services: { readonly range: RangeService | undefined };
    /** Sessions that FAILED (their `attach()` or a `hostUpdate()` threw): detached at once and skipped by everything after, until the next attach. */
    private readonly broken = new Set<CellSession>();
    /** The sessions whose `renderOverlay` failure was already reported: it runs at every render and reports its first failure only (cleared at detach). */
    private readonly reported = new Set<CellSession>();
    /**
     * The presses in progress, one per pointer id (several fingers are several presses; a pointerdown never overwrites another pointer's):
     * the roving cell at its pointerdown, so both ends of one press see the same anchor, and the session that claimed it, which alone gets its
     * pointerup, cancel, and the cancel at detach. Ended by the pointerup on the table, or by the page-level pointerup / pointercancel
     * (a release outside), or by `detach()`.
     */
    private readonly presses = new Map<number, Press>();
    /** The pointerup / pointercancel the document saw for a press the root did not hear, until the deferred close handles it (the same pointer may press again first). */
    private readonly closing = new Map<number, { event: PointerEvent; cancel: () => void }>();
    /** The pointers that hold pointer capture on an element of this table (any depth, closed shadow roots included), from its composed capture events. */
    private readonly captured = new Set<number>();
    /**
     * The `timeStamp` of the press the document cleared `within` for, until the root hears that same event: then `within` is restored, the press
     * was inside. A bare number, so no event (and no node of its path) is kept alive between presses; cleared at detach.
     */
    private clearedAt: number | null = null;

    constructor(private readonly host: DataTableCoreHost<T>) {
        const context: InteractionContext<T> = {
            host,
            focused: () => this.focused,
            setFocus: (rowIndex, columnKey, reveal = false) => this.focusCell(rowIndex, columnKey, reveal),
            rowCount: () => this.rowCount(),
            focusableKeys: () => requireProvider(host, 'columns').focusableKeys(),
            pageSize: () => this.pageSize(),
            afterRender: (task) => this.afterRender(task),
            hasOpenEditor: () => this.service.editingCell() != null,
            deepActive: () => this.deepActive(),
        };
        this.edit = new EditSession(context);
        this.range = new RangeSession(context);
        this.sessions = [this.range, this.edit];
        // DERIVED, never written: the range service while the range session is healthy, undefined while it is broken.
        const controller = this;
        this.services = {
            get range(): RangeService | undefined {
                return controller.broken.has(controller.range) ? undefined : controller.range.rangeService;
            },
        };
        // The merged `interaction` service is a PLAIN object built once: for every key a session declares (on its `service` or its `neutral.service`) ONE
        // stable function that, at call time, calls that key on the owning session's `service` (its `neutral.service` while it is broken). So there is
        // no snapshot (a session that replaces a method on its own `service` later, in `attach()` or when its lazy part loads, is heard), the functions
        // keep their identity, spread / `in` / `Object.keys` work, and a key nobody declares is simply absent. An assignment on it still wins.
        const service: Record<string, unknown> = {
            focusedCell: () => this.focused,
            focusCell: (rowIndex: number, columnKey: string) => this.focusCell(rowIndex, columnKey, true),
        };
        for (const session of this.sessions) {
            for (const key of new Set([...Object.keys(session.service ?? {}), ...Object.keys(session.neutral.service ?? {})])) {
                if (key in service) continue; // the first session that declares a key owns it
                service[key] = (...args: unknown[]): unknown => {
                    const source = (this.broken.has(session) ? session.neutral.service : session.service) as Record<string, unknown> | undefined;
                    const method = source?.[key];
                    return typeof method === 'function' ? method.apply(source, args) : undefined;
                };
            }
        }
        this.service = service as unknown as CellInteractionService;
    }


    attach(): void {
        this.attachment++;
        const { host } = this;
        const { root, disposables } = host;
        // A failed session of an earlier attach is tried afresh (`broken` was cleared at detach): its real services are served again.
        // The services are provided first and the sessions attach after them (range, then edit): a session may read any provider in `attach()`.
        this.teardown = [
            host.provide('interaction', this.service),
            host.provide('range', this.range.rangeService),
            host.addKeyHandler(KEY_PRIORITY.navigation, (event) => this.onKey(event)),
            host.topics.on('expansion', () => this.noteFocusedRow()),
            // A press is recorded and ended in the CAPTURE phase, so a consumer cell or an inner widget that stops propagation can neither hide a press
            // (no focus, no offer) nor leave one open for ever. The start is on the table's root (own events only: a nested table records its own); the
            // end is closed by POINTER ID on the document, wherever the pointer is released (outside, over a nested table, on this table's own cells).
            disposables.listen<PointerEvent>(root, 'pointerdown', (event) => this.onRootDown(event), true),
            // What a press DOES at its pointerdown (the offer to the sessions, the focus move of a mouse or pen) runs in the BUBBLE phase: a cell widget that
            // stops `pointerdown` keeps its focus and is not offered, as before the sessions existed. A touch tap focuses at its pointerup anyway.
            disposables.listen<PointerEvent>(root, 'pointerdown', (event) => this.onRootDownBubble(event)),
            // A release the table's root hears (on its own cells, over a nested table, or by a captured pointer) is handled by the root, in the capture
            // phase: it sees the table's own nodes even inside a closed shadow root, and a consumer's stopPropagation cannot hide it.
            disposables.listen<PointerEvent>(root, 'pointerup', (event) => this.onRelease(event), true),
            disposables.listen<PointerEvent>(root, 'pointercancel', (event) => this.onRelease(event), true),
            // Pointer capture is tracked from its own (composed) events: an element inside a consumer component's closed shadow root that captures
            // cannot be asked (the path shows its host). `lostpointercapture` comes after the pointerup, so a release still sees its capture.
            disposables.listen<PointerEvent>(root, 'gotpointercapture', (event) => this.captured.add(event.pointerId), true),
            // The LOSS is heard on the document: when the capturing element is removed mid-gesture, the event goes to the document, not to the root.
            disposables.listen<PointerEvent>(root.ownerDocument, 'lostpointercapture', (event) => this.captured.delete(event.pointerId), true),
            // The document hears a press FIRST (before the root's capture listener): one whose composed path does not include the root is outside, as far as
            // it can tell, and clears `within` NOW (the focus guard must not pull the focus back into the grid while that press's own handlers change the
            // data); a press the root then hears (a table in a CLOSED shadow root, invisible to the document's path) restores it, in the same dispatch.
            disposables.listen<PointerEvent>(root.ownerDocument, 'pointerdown', (event) => this.onDocumentDown(event), true),
            disposables.listen<PointerEvent>(root.ownerDocument, 'pointerup', (event) => this.closeUnheard(event), true),
            disposables.listen<PointerEvent>(root.ownerDocument, 'pointercancel', (event) => this.closeUnheard(event), true),
            // The window lost focus (alt-tab, a release over an iframe never heard): no pointer is down any more.
            disposables.listen(root.ownerDocument.defaultView ?? window, 'blur', () => {
                this.within = false;
                this.cancelPresses();
            }),
            disposables.listen(root, 'keydown', () => (this.pointer = false), true),
            disposables.listen<FocusEvent>(root, 'focusin', ownEvents(root, (event: FocusEvent) => this.onFocusIn(event))),
            disposables.listen<FocusEvent>(root, 'focusout', ownEvents(root, (event: FocusEvent) => this.onFocusOut(event))),
            disposables.add(() => this.observer?.disconnect()),
        ];
        for (const session of this.sessions) {
            try {
                session.attach();
            } catch (error) {
                // A session that fails to attach is reported and left out of everything after (pointer, hostUpdate, overlay, detach): the controller and
                // the other controllers still attach.
                this.fail(session, error);
            }
        }
    }

    /**
     * A session failed (its `attach()` or a `hostUpdate()` threw): a bug. It is reported once, marked broken FIRST (nothing calls it again, not even
     * for the presses it claimed, which end without telling it), detached NOW (that removes what it registered, a key handler or a listener; a range
     * session keeps its range for the next attach) and left out of everything after (pointer, hostUpdate, overlay, detach) until the next attach, and its
     * NEUTRAL service objects (`CellSession.neutral`) replace its methods in the merged `interaction` service and its `rangeService` (provided and in
     * `services`), so nothing keeps calling a half-attached session. `cellRange` reads null and `isCellSelected` answers false while it is out; the next
     * attach restores the real services, and the range the session held is served again.
     */
    private fail(session: CellSession, error: unknown): void {
        this.report(error);
        this.broken.add(session);
        for (const [id, press] of [...this.presses]) if (press.claimedBy === session) this.endPress(id, press, null); // `notifyCancel` skips a broken claimant
        this.guarded(() => session.detach());
        const { neutral } = session;
        // (its methods of the merged `interaction` service are answered by `neutral.service` from now on: the delegation reads it while the session is broken)
        if (neutral.rangeService) {
            // (`services.range` is withdrawn by the getter while the session is broken: the element holds a cellRange itself; the neutral one is only the `range` PROVIDER)
            this.teardown.push(this.host.provide('range', neutral.rangeService));
        }
    }

    detach(): void {
        // A press still open (the table is removed mid-gesture) is cancelled for its claimant FIRST, while the session is still attached.
        this.cancelPresses();
        // The reverse of attach: the sessions go first, while the services they read are still provided.
        // A session that throws while detaching is reported (once) and the rest still detach, and the services and listeners are always removed.
        this.eachBackwards((session) => void this.guarded(() => session.detach()));
        this.broken.clear();
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.observer?.disconnect();
        this.observer = this.watched = null;
        this.within = false; // (`pointer` was reset by `endPress`)
        this.clearedAt = null;
        this.captured.clear(); // captures of pointers that had no press
        this.closing.clear();
        this.reported.clear();
        this.attachment++;
        this.rowAtExpansion = null; // a row noted for the attach that is ending is not the next attach's
    }

    /** Before every render: the focused cell follows its row (when a node or group moved it), the data (clamped to the rows that exist) and the layout. */
    hostUpdate(): void {
        this.reconcile();
        // A session whose `hostUpdate` throws is failed like one whose attach threw (reported once, left out from now on, withdrawn): it would throw at every
        // render. The others, and the rest of the update, still run.
        this.eachBackwards((session) => {
            try {
                session.hostUpdate?.();
            } catch (error) {
                this.fail(session, error);
            }
        });
    }

    private reconcile(): void {
        this.watchDom();
        // Consumed once, whatever the rest of this update does: it belongs to the render that follows its `expansion`, not to a later one.
        // And only for the cell it was taken for: a focus set since then is another cell's.
        const at = this.focused;
        const moved = this.rowAtExpansion?.at === at ? this.rowAtExpansion : null;
        this.rowAtExpansion = null;
        if (!at) return;
        const rows = this.rowCount();
        if (rows === 0) {
            // No data rows because the row's group (the last open one) is collapsed: the focus has nowhere to stay, and the group header is what is drawn.
            if (this.dropIfCollapsed(moved)) return;
            // No rows because they are loading changes nothing: the focus waits for rows, and so does the row it was following. DOM focus does not:
            // the cell is gone, and where the user put it meanwhile is theirs, so a later drop must not take it for the cell's.
            this.rowAtExpansion = moved && { ...moved, hadFocus: false };
            return;
        }
        let row = moved ? this.followRow(at, moved.id) : at.rowIndex;
        if (row === -1) {
            // Gone with a collapsed group, the roving cell has nowhere to stay; gone for any other reason (a page, a filter) it is clamped like any cell.
            if (this.dropIfCollapsed(moved, at)) return;
            row = at.rowIndex;
        }
        const next = this.landOn(row, at.columnKey);
        if (!next) return this.clear();
        this.lastColumn = requireProvider(this.host, 'columns').focusableKeys().indexOf(next.columnKey); // remembered by the one that takes the cell, as `focusCell` does
        if (next.rowIndex !== at.rowIndex || next.columnKey !== at.columnKey) this.set(next);
    }

    /** The cell nearest to `rowIndex` and `columnKey` that exists (rows clamped, a hidden column left for its neighbour); null when there is none. It changes nothing. */
    private landOn(rowIndex: number, columnKey: string): CellAddress | null {
        const rows = this.rowCount();
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const col = nearestColumn(keys, columnKey, this.lastColumn);
        if (rows === 0 || col === -1) return null;
        return { rowIndex: Math.min(rowIndex, rows - 1), columnKey: keys[col] as string };
    }

    /** A node or group opened or closed while a row held the focus: remember which row (from the drawn DOM, still the old one) and whether DOM focus sat in its cell. */
    private noteFocusedRow(): void {
        const at = this.focused;
        if (!at) {
            this.rowAtExpansion = null;
            return;
        }
        const id = this.host.rowAt(at.rowIndex)?.dataset['rowId'];
        // The one rule for an empty list: with no row drawn at the focused index, a note already waiting for rows stays, it is not replaced by nothing.
        if (id === undefined) return;
        this.rowAtExpansion = { at, id, hadFocus: composedContains(this.host.cellAt(at.rowIndex, at.columnKey), this.deepActive()) };
    }

    /**
     * Where the row that held the focus is now: its own index, or its nearest ancestor's when a tree node closed over it, and -1 when
     * it is not drawn. A row still at the index the focus is at costs one id read, which is every detail toggle; otherwise the ids
     * are read once, in one pass, and the ancestors are looked up in that.
     */
    private followRow(at: CellAddress, id: string): number {
        const { config } = this.host;
        const query = requireProvider(this.host, 'query');
        // Ids are compared as strings: the one in the DOM is one, and a consumer's `getRowId` may answer with a number.
        const idOf = (row: unknown): string => String(config.getRowId(row as never));
        const here = query.renderedRowAt(at.rowIndex);
        if (here !== undefined && idOf(here) === id) return at.rowIndex;
        const indexes = new Map<string, number>();
        query.renderedRows().forEach((row, i) => {
            const key = idOf(row);
            if (!indexes.has(key)) indexes.set(key, i);
        });
        let index = indexes.get(id) ?? -1;
        if (index === -1 && config.enableSubRows) {
            // The tree index is keyed by the ids as `getRowId` answers them: read through their strings, like everything here.
            const parents = new Map([...query.treeIndex().parent].map(([child, parent]) => [String(child), String(parent)] as const));
            for (let parent = parents.get(id); parent !== undefined && index === -1; parent = parents.get(parent)) index = indexes.get(parent) ?? -1;
        }
        return index;
    }

    /** The row's group is collapsed now, so it left with it: the roving cell has nowhere to stay. Drops the focus and says so. */
    private dropIfCollapsed(moved: { id: string; hadFocus: boolean } | null, at?: CellAddress): boolean {
        const group = moved ? this.collapsedGroupOf(moved.id) : undefined;
        if (!moved || group === undefined) return false;
        this.dropFocus(moved.hadFocus, group, at);
        return true;
    }

    /** The key of the collapsed group a row belongs to, from the query's grouping: only the collapsed groups are searched, not every row. */
    private collapsedGroupOf(id: string): string | undefined {
        const { config } = this.host;
        const expansion = requireProvider(this.host, 'expansion');
        return requireProvider(this.host, 'query')
            .groupRows()
            .find((group) => expansion.isGroupCollapsed(group.groupKey) && group.rows.some((row) => String(config.getRowId(row)) === id))?.groupKey;
    }

    /**
     * The focused row left with its collapsed group: the roving cell has nowhere to stay. If DOM focus was on that cell the toggle of its
     * group header takes it; failing that (the header is on another page) the nearest row that is left does, in the same column, without
     * scrolling: the keyboard stays where the user was. If DOM focus was anywhere else (a toolbar button that collapsed the group, a widget
     * in a detail row) it stays there.
     */
    private dropFocus(hadFocus: boolean, group: string, at?: CellAddress): void {
        this.clear();
        if (!hadFocus) return;
        this.afterRender(() => {
            // Still nowhere: focus fell to the page with the cell, or is on the viewport; something else has it by now otherwise. Unlike the
            // observer below, focus on another part of the page is not nowhere: it is the user's, and is left alone.
            if (!this.onPage() && this.deepActive() !== this.host.root.querySelector(VIEWPORT)) return;
            const toggle = this.groupToggle(group);
            if (toggle) return toggle.focus({ preventScroll: true });
            const next = at && this.landOn(at.rowIndex, at.columnKey);
            // The header is on another page: a row that is left takes the focus; with no rows at all (every group closed) any group header does.
            if (next) this.focusCell(next.rowIndex, next.columnKey, false);
            else this.groupToggle()?.focus({ preventScroll: true });
        });
    }

    /** The toggle of the header of group `key` that this table draws, or the first group toggle it draws when no key is asked for. */
    private groupToggle(key?: string): HTMLElement | undefined {
        const toggles = ownElements(this.host.root, this.host.root.querySelectorAll<HTMLElement>('[data-kind="group"] [data-toggle]'));
        return key === undefined ? toggles[0] : toggles.find((toggle) => toggle.closest('[data-kind="group"]')?.getAttribute('data-group-key') === key);
    }

    // ---- state ------------------------------------------------------------------------------------------------------

    private set(cell: CellAddress | null): void {
        this.focused = cell;
        requireProvider(this.host, 'virtual').retain('focus', cell ? [cell.rowIndex] : []);
        this.host.topics.emit('cell');
        this.host.requestRender();
    }

    private clear(): void {
        if (this.focused) this.set(null);
    }

    private rowCount(): number {
        const query = requireProvider(this.host, 'query');
        // Group headers are display rows but not data rows: the drawn index counts data rows only.
        return this.host.config.groupBy ? query.renderedRows().length : query.displayRows().length;
    }

    /** Moves the roving cell, brings it on screen (`reveal`) and gives it DOM focus. Out-of-range or non-focusable targets are ignored. */
    private focusCell(rowIndex: number, columnKey: string, reveal: boolean): void {
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const col = keys.indexOf(columnKey);
        if (col === -1 || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.rowCount()) return;
        this.lastColumn = col;
        const same = this.focused?.rowIndex === rowIndex && this.focused.columnKey === columnKey;
        if (!same) this.set({ rowIndex, columnKey });
        if (reveal) requireProvider(this.host, 'virtual').reveal(rowIndex, columnKey);
        this.focusDom();
        // The cell may not exist yet (its row is entering the window): the render that draws it runs first.
        if (!this.hasFocus()) this.afterRender(() => this.focusDom());
    }

    // ---- DOM focus --------------------------------------------------------------------------------------------------

    private rootNode(): Document | ShadowRoot {
        return this.host.root.getRootNode() as Document | ShadowRoot;
    }

    private hasFocus(): boolean {
        const cell = this.focused ? this.host.cellAt(this.focused.rowIndex, this.focused.columnKey) : null;
        return cell !== null && this.deepActive() === cell;
    }

    /** Queues `task` for after the render, unless the table is detached (or attached anew) by the time the host runs it. */
    private afterRender(task: () => void): void {
        const attachment = this.attachment;
        this.host.afterRender(() => attachment === this.attachment && task());
    }

    /** The focused cell's element takes DOM focus (no scrolling: `reveal` already placed it). */
    private focusDom(): void {
        const at = this.focused;
        const cell = at ? this.host.cellAt(at.rowIndex, at.columnKey) : null;
        if (!cell) return;
        // The renderer marks it tabindex=0 in the render that follows; until then -1 is enough for focus() to work.
        if (!cell.hasAttribute('tabindex')) cell.setAttribute('tabindex', '-1');
        cell.focus({ preventScroll: true });
    }

    /**
     * The element that has DOM focus, wherever it is. A table in a shadow root asks that root first: it answers for a closed one too, where
     * `document.activeElement` is only the host. Elsewhere (the table's own root has none: focus is outside it) the document's answer is
     * followed down through the open shadow roots.
     */
    private deepActive(): Element | null {
        const node = this.rootNode();
        let active = (node instanceof ShadowRoot ? node.activeElement : null) ?? this.host.root.ownerDocument.activeElement;
        while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
        return active;
    }

    /** Nothing has DOM focus, or only the page (`<body>`, `<html>`) does: what is left when the focused element is removed. */
    private onPage(): boolean {
        const active = this.deepActive();
        return !active || active === active.ownerDocument.body || active === active.ownerDocument.documentElement;
    }


    /** A render can remove or move the focused element (a sort, a row leaving the window): DOM focus then falls to the page. */
    private watchDom(): void {
        const viewport = this.host.root.querySelector(VIEWPORT);
        // A new viewport element (the skeleton gives way to the grid) is a new subtree to watch.
        if (!viewport || viewport === this.watched) return;
        this.observer?.disconnect();
        this.watched = viewport;
        this.observer = new MutationObserver(() => {
            // Lost: nothing has the focus, the page has, or something outside the table has (a removed row's focus can fall anywhere).
            if (this.within && this.focused && !composedContains(this.host.root, this.deepActive())) this.focusDom();
        });
        this.observer.observe(viewport, { childList: true, subtree: true });
    }

    private onFocusIn(event: FocusEvent): void {
        this.within = true;
        const target = event.target as Element;
        if (target.matches(VIEWPORT)) return this.onViewportFocus();
        // Focus landed in a cell (a click on its control, a script): the roving cell follows it.
        const at = cellAddressOf(target);
        if (at && (at.rowIndex !== this.focused?.rowIndex || at.columnKey !== this.focused.columnKey)) this.adopt(at);
    }

    private onFocusOut(event: FocusEvent): void {
        const target = event.target as HTMLElement;
        // A cell that took focus only to receive it carries a stray -1; the renderer owns tabindex=0.
        if (target.getAttribute('tabindex') === '-1' && target.matches('[data-slot="table-cell"]')) target.removeAttribute('tabindex');
        // A blur with no target is also what moving the focused row in the DOM looks like: the render's, not the user's.
        // The user leaving is seen elsewhere (a press outside, the window losing focus).
        if (event.relatedTarget instanceof Node && !this.host.root.contains(event.relatedTarget)) this.within = false;
    }

    /** Tab (or a script) put focus on the viewport: hand it to the roving cell, or to the first one. */
    private onViewportFocus(): void {
        if (this.pointer) return;
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const first = keys[0];
        // A drawn roving cell never leaves the viewport tabbable, so a viewport focus here means it is not on screen (or none exists).
        const drawn = this.focused !== null && this.host.cellAt(this.focused.rowIndex, this.focused.columnKey) !== null;
        if (this.focused) this.focusCell(this.focused.rowIndex, this.focused.columnKey, !drawn);
        else if (first !== undefined) this.focusCell(0, first, true);
    }

    private adopt(at: CellAddress): void {
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const col = keys.indexOf(at.columnKey);
        if (col === -1) return;
        this.lastColumn = col;
        this.set(at);
    }

    // ---- pointer ----------------------------------------------------------------------------------------------------

    /** The document hears every press first: one whose composed path does not include the root clears `within` now (the root restores it for a press it hears). */
    private onDocumentDown(event: PointerEvent): void {
        // A press of the same pointer that does NOT reach this table's `recordPress` (outside the table, or on a nested table, which records its own) ends
        // the earlier press whose release was lost (a pointerup swallowed over an iframe): its claimant is told, and "a pointer is down" ends.
        const open = this.presses.get(event.pointerId);
        if (open && !ownsTarget(this.host.root, event.target)) this.endPress(event.pointerId, open, this.closing.get(event.pointerId)?.event ?? null);
        this.clearedAt = null;
        if (!this.within || event.composedPath().includes(this.host.root)) return; // nothing to clear (the path is built only when `within` is set)
        this.clearedAt = event.timeStamp;
        this.within = false;
    }

    private onRootDown(event: PointerEvent): void {
        if (this.clearedAt === event.timeStamp) this.within = true; // the root heard it: it is a press inside
        this.clearedAt = null;
        if (ownsTarget(this.host.root, event.target)) this.recordPress(event); // a nested table records its own presses
    }

    /**
     * The press is offered to the sessions FIRST, with the roving cell as it was before the press (`press.anchor`: a shift+click builds its
     * range from it). A session that claims it (returns true) moves the focus itself; otherwise the controller focuses the pressed cell, except
     * for a press inside the open editor's cell, which never moves focus (an editor may be a custom element the tag list below does not know).
     * This runs in the BUBBLE phase of the root (see `onRootDownBubble`): a cell widget that stops `pointerdown` keeps its focus and is not offered.
     */
    private onRootDownBubble(event: PointerEvent): void {
        const press = this.presses.get(event.pointerId);
        if (!press || press.bubbled || !ownsTarget(this.host.root, event.target)) return;
        press.bubbled = true;
        if (press.bypass) return; // not a cell press: no offer, no focus
        const target = press.pressed;
        const claimant = this.offer(event, target, (session) => session.onPointerDown, pressOf(press)) ?? null;
        press.claimedBy = claimant; // recorded before any further work
        // A session's `onPointerDown` may END the press itself (it blurs the window, detaches the table): then the end path found no claimant yet, so the
        // claimant that returned true is told now, once, and the press is not routed or focused any more.
        if (this.presses.get(event.pointerId) !== press) {
            if (claimant) this.notifyCancel(press, null);
            return;
        }
        if (claimant) return; // the claimant owns the press: no focus from the controller
        // A touch that scrolls is cancelled by the browser and never reaches pointerup: only a tap focuses.
        if (event.pointerType !== 'touch' && target && !this.insideOpenEditor(target)) this.pointerFocus(target); // by the recorded element, as `tapFocus` does
    }

    /**
     * Records the press in the CAPTURE phase (bookkeeping only: the press, the roving anchor, its start cell, "a pointer is down"), so a consumer's
     * `stopPropagation` can never leave a press unrecorded. What a press DOES at its pointerdown (the offer, the focus move) waits for the bubble phase.
     */
    private recordPress(event: PointerEvent): void {
        // The anchor is read BEFORE the offer: a claimant that moves the focus in its onPointerDown must not change the anchor of its own press.
        const anchor = this.focused;
        // The same pointer already has an open press (its pointerup was lost: a release over an iframe, alt-tab): that one ends first, its claimant is told.
        // Released outside a moment ago (the deferred close has not run yet): with the REAL pointerup. Otherwise the old press ended without an event
        // (like at detach and window blur); the new pointerdown is not its end.
        const lost = this.presses.get(event.pointerId);
        if (lost) this.endPress(event.pointerId, lost, this.closing.get(event.pointerId)?.event ?? null);
        this.pointer = true;
        const path = event.composedPath(); // once per event: a path is built at every call
        const target = this.targetOf(path);
        // A press that begins on an overlay is the overlay's (`pressed` = the overlay, no start cell): only the RELEASE of a gesture is looked through it.
        // A press on a control inside its cell (or a widget with `data-table-keeps-focus`) is the control's own: no start cell, no offer, no focus.
        // The release side's rules apply at the pointerdown too: an element that floats out of its cell's box (a popover or menu of the cell) is not that
        // cell, so its press is not a cell press either (and the popover keeps its focus).
        // Only the PRIMARY button (the left mouse button, a touch or pen contact) makes a cell press: a right or middle press is not offered to the sessions
        // and moves no focus (the context menu addon handles `contextmenu` itself).
        const bypass = event.button !== 0 || (target !== null && (this.controlOf(target) !== null || this.overlayOf(target) !== null || floatsOut(target, event.clientX, event.clientY)));
        this.presses.set(event.pointerId, { anchor, pressed: target, startCell: bypass ? null : cellAddressOf(target), claimedBy: null, bubbled: false, x: event.clientX, y: event.clientY, bypass });
    }

    /**
     * The pointer of a recorded press was released or cancelled, anywhere on the page: the press is closed by its pointer id. A pointerup on THIS
     * table's own cells (not outside it, not over a nested table) ends it as a pointerup: a CLAIMED press is routed only to its claimant (no other
     * session sees it, the controller does not focus), an unclaimed one is offered to the sessions and, for a touch, focuses the tapped cell. Any
     * other end (a cancel, a release outside, over a nested table in a detail row) is a cancel for the claimant. A release with no recorded press
     * (the pointer went down outside the table) does nothing.
     */
    private onRelease(event: PointerEvent): void {
        const press = this.presses.get(event.pointerId);
        if (!press) return;
        // The document's listener sees a target RETARGETED to the outermost host when this table sits in another component's shadow root: the target
        // is read from the composed path (the first node inside this table), for ownership, the cell address and the tapped cell alike. (Located BEFORE
        // the press ends: the capture of the pointer is part of the answer.)
        // A press with no claimant and no start cell (it began on a header, a handle, an overlay, a widget that keeps its focus) needs no cell at its
        // release: no hit test; only a touch tap may still focus what it pressed.
        // Nor does one that no healthy session would be offered at its release (none defines `onPointerUp`: the step-0 sessions): only `own` would matter.
        const offered = press.bubbled && press.startCell && this.sessions.some((session) => !this.broken.has(session) && session.onPointerUp);
        if (event.type === 'pointerup' && !press.claimedBy && !offered) {
            this.endPress(event.pointerId, press, event, false);
            if (event.pointerType === 'touch') this.tapFocus(event, press);
            return;
        }
        const where = event.type === 'pointerup' ? this.locateRelease(event, event.composedPath()) : { own: false, cell: null };
        this.endPress(event.pointerId, press, event, !where.own); // a release elsewhere is a cancel for the claimant; on this table it is routed below
        if (!where.own) return;
        const { claimedBy } = press;
        const info = pressOf(press);
        const cell = where.cell;
        if (claimedBy) {
            if (this.broken.has(claimedBy)) return; // a failed session is never called (its presses are ended when it fails)
            // Every claimant gets exactly ONE end callback: its pointerup, or, when it has none, the cancel.
            if (claimedBy.onPointerUp) this.guarded(() => claimedBy.onPointerUp?.(event, cellAddressOf(cell), info));
            else this.notifyCancel(press, event);
            return;
        }
        // An unclaimed press is offered at its pointerup only when it BEGAN on a body cell: a press that began on a resize handle, a header or a popover
        // and is released over a cell is not a click on that cell.
        if (press.bubbled && press.startCell && this.offer(event, cell, (session) => session.onPointerUp, info)) return;
        // A TAP does what a mouse press on the PRESSED element does (`pointerFocus`: it focuses a cell, clears the focus on the body outside any cell, and
        // does nothing on a header, a control or a popover), unless that element is in the open editor's cell. It is a tap while the finger is released
        // within the pressed cell's box plus a small slop; further away it was a drag and focuses nothing. (A claimant is told the cell under the finger.)
        if (event.pointerType === 'touch') this.tapFocus(event, press);
    }

    private tapFocus(event: PointerEvent, press: Press): void {
        const { pressed } = press;
        // Not a cell press (`bypass`), or one a cell widget stopped at its pointerdown (`!bubbled`): the widget's own, for a touch as for a mouse.
        if (press.bypass || !press.bubbled) return;
        if (!pressed?.isConnected) {
            // A renderer replaced the DOM between the down and the up: the press's start cell (an address) is still the cell that was tapped, if the finger
            // is where it went down.
            const start = press.startCell;
            if (start && !this.isEditorCell(start) && withinTouchSlop(event.clientX - press.x, event.clientY - press.y)) this.focusCell(start.rowIndex, start.columnKey, false);
            return;
        }
        // Still a tap: within the pressed DATA cell's box plus the slop (the shared touch slop). Anything else (the stretch / spacer cell, a full-width
        // or group cell, a header, the body outside any cell) is measured from where the press went down: such a box spans the row, and would make any
        // drag along it a tap.
        const cell = cellAddressOf(pressed) ? pressed.closest(CELL) : null;
        const near = cell ? inside(cell.getBoundingClientRect(), event.clientX, event.clientY, TOUCH_SLOP_PX) : withinTouchSlop(event.clientX - press.x, event.clientY - press.y);
        if (near && !this.insideOpenEditor(pressed)) this.pointerFocus(pressed);
    }

    /** Runs `task` after the event that scheduled it has been dispatched to every listener (the document's capture listener runs before the root's). */
    private afterDispatch(task: () => void): () => void {
        return this.host.disposables.timeout(task, 0);
    }

    /**
     * The document heard a release or cancel of a recorded press. If the root hears it too (the release is on this table, or over a nested one) the
     * root has closed the press by the time the check runs; what is still open then was released OUTSIDE the table and is cancelled for its claimant.
     */
    private closeUnheard(event: PointerEvent): void {
        const press = this.presses.get(event.pointerId);
        // ALWAYS scheduled, whatever the path says: an ancestor's capture listener that stops the event keeps it from the root, and the press would stay
        // open for ever. The look below does nothing when the root already ended the press (the usual case: the document hears it first, the root right after).
        if (!press) return;
        // The event is kept only until that look (or the same pointer's next pointerdown, which hands it to the claimant): the timer, `endPress` and `detach`
        // all drop it, so no event (and no node of its path) outlives the tick.
        // At most ONE pending look per pointer id (a pointer's next pointerdown ends the earlier press first); the root's own `endPress` of the same dispatch
        // CANCELS the timer, so in the usual case nothing is left to run.
        this.closing.get(event.pointerId)?.cancel();
        const cancel = this.afterDispatch(() => {
            if (this.closing.get(event.pointerId)?.event === event) this.closing.delete(event.pointerId);
            if (this.presses.get(event.pointerId) === press) this.endPress(event.pointerId, press, event);
        });
        this.closing.set(event.pointerId, { event, cancel }); // marked NOW: the same pointer's next pointerdown may come before the deferred look
    }

    /**
     * The one place a press ends: it is forgotten with its capture and its pending close, "a pointer is down" is recomputed (another finger may still
     * be down), and, with `notify`, its claimant is told it was cancelled (`event`: the pointerup / pointercancel that ended it, null when none did).
     */
    private endPress(pointerId: number, press: Press, event: PointerEvent | null, notify = true): void {
        this.presses.delete(pointerId);
        this.captured.delete(pointerId); // its `lostpointercapture` may never reach us
        this.closing.get(pointerId)?.cancel(); // the root heard the release itself: the document's look is not needed
        this.closing.delete(pointerId);
        this.pointer = this.presses.size > 0;
        if (notify) this.notifyCancel(press, event);
    }

    /** The element (the pressed one, as recorded; or the one a hit test found) is in the cell that holds the open editor, across shadow hosts. */
    private insideOpenEditor(el: Element): boolean {
        return this.isEditorCell(cellAddressOf(el));
    }

    /** `address` is the cell that holds the open editor (the one question both the element-based guard and the replaced-DOM tap ask, by address). */
    private isEditorCell(address: CellAddress | null): boolean {
        const editing = this.service.editingCell();
        return address !== null && editing != null && editing.rowIndex === address.rowIndex && editing.columnKey === address.columnKey;
    }

    /** What the sessions draw over the grid (the range readout and fill handle); the element calls it after the table, inside the viewport. */
    renderOverlay(): TemplateResult | null {
        const drawn = this.sessions.map((session) => (this.broken.has(session) ? undefined : this.guarded(() => session.renderOverlay?.(), session)));
        return drawn.some(Boolean) ? html`${drawn}` : null; // Lit draws nothing for an undefined or null entry
    }

    /** The press goes to the sessions in order (range, edit); the first that returns true claims it and is returned. */
    private offer(event: PointerEvent, target: Element | null, handlerOf: (session: CellSession) => CellSession['onPointerDown'], press: PointerPress): CellSession | undefined {
        const at = cellAddressOf(target);
        // A session that throws is reported (once) and does not claim: the press goes on to the next session and then to the controller's own behaviour.
        return this.sessions.find((session) => !this.broken.has(session) && this.guarded(() => handlerOf(session)?.call(session, event, at, press)) === true);
    }

    /**
     * Where a pointer was released, as the root hears it: whether it is on THIS table, and the cell under it. A mouse without capture releases on the
     * element it is over: the first element of the root-local composed path. A touch (implicit capture) and any captured pointer (a gesture's
     * `setPointerCapture`; tracked from the root's `gotpointercapture` / `lostpointercapture`, which are composed: the node that holds it may be
     * inside a consumer component's closed shadow root, where it cannot be asked) deliver the pointerup to the element that was PRESSED, so for
     * those, and for a mouse released over an overlay, the point is hit-tested (`elementsFromPoint` on the table's own root node): the table's
     * overlays (every one marks itself `data-pointer-transparent`: the range readout, the fill handle, drop edges) are looked through to the first
     * CELL under them; an element of a nested table, or one outside the table that is on top, makes it not this table's release.
     */
    private locateRelease(event: PointerEvent, path: readonly EventTarget[]): { own: boolean; cell: Element | null } {
        const { root } = this.host;
        const target = this.targetOf(path);
        // An uncaptured mouse released over one of the table's overlays is looked through too, exactly as a touch at the same point is.
        const lookThrough = event.pointerType !== 'mouse' || this.captured.has(event.pointerId) || (target !== null && this.overlayOf(target) !== null);
        // The same rule for a mouse over an element floating out of its cell as for a touch: it is not that cell.
        if (!lookThrough) return { own: target !== null && ownsTarget(root, target), cell: target && floatsOut(target, event.clientX, event.clientY) ? null : target };
        return this.hitTest(event.clientX, event.clientY);
    }

    /** The first element of THIS table at a point, looking through its overlays (see `locateRelease`). */
    private hitTest(x: number, y: number): { own: boolean; cell: Element | null } {
        const { root } = this.host;
        const tree = root.getRootNode();
        const scope = tree instanceof ShadowRoot ? tree : root.ownerDocument;
        for (const el of scope.elementsFromPoint(x, y)) {
            if (!composedContains(root, el)) break; // something outside the table: on top of it (nothing of the table seen yet) or just below it (its ancestors)
            if (!ownsTarget(root, el)) return { own: false, cell: null }; // a nested table
            if (this.overlayOf(el)) continue; // looked through: every overlay marks itself (the readout, the fill handle, a drop edge)
            // The FIRST element of the table that is not an overlay decides: a cell, or something that is not one (the sticky header or footer, a popover
            // or menu of the table, the busy overlay). The cells scrolled under those are not what the pointer is on.
            // An element drawn inside a cell but floating outside its box (a popover or menu of the cell, positioned over other cells) is not that cell:
            // the point is not inside the cell's rect. (Mark it `data-pointer-transparent` to be looked through to the cell under it instead.)
            if (floatsOut(el, x, y)) return { own: true, cell: null };
            return { own: true, cell: el }; // the element the pointer is on (`cellAddressOf` says whether it is in a cell)
        }
        return { own: false, cell: null };
    }

    /**
     * The element the press landed on, in the tree of this table's own cells: the first element of the composed path whose root node is the table's
     * root node. That is the real target for a table inside another component's shadow root (the document sees it retargeted to the outermost host),
     * and the cell content's host for a consumer component with its own shadow root in a cell (the text inside it is in another tree, where
     * `closest()` stops). A nested table is in the same tree, so its elements are found and then refused by `ownsTarget`.
     */
    private targetOf(path: readonly EventTarget[]): Element | null {
        const tree = this.host.root.getRootNode();
        const node = path.find((n) => n instanceof Element && n.getRootNode() === tree && composedContains(this.host.root, n));
        return (node as Element | undefined) ?? null;
    }

    /** A session error is a bug, not noise: every one is reported (`console.error`). */
    private report(error: unknown): void {
        console.error('[ge-data-table] a session threw:', error);
    }

    /**
     * Runs a session callback (a pointer handler, a cancel, a detach); one that throws is reported and answers nothing, so no press is ever broken by it.
     * A callback that runs at every render (`renderOverlay`) passes its session and reports its FIRST failure only.
     */
    private guarded<R>(call: () => R, every?: CellSession): R | undefined {
        try {
            return call();
        } catch (error) {
            if (!every || !this.reported.has(every)) this.report(error);
            if (every) this.reported.add(every);
            return undefined;
        }
    }

    /** Tells the claimant its press ended without a pointerup on the table; a claimant that throws is reported and never stops the caller. */
    private notifyCancel(press: Press, event: PointerEvent | null): void {
        const { claimedBy } = press;
        if (claimedBy && !this.broken.has(claimedBy)) this.guarded(() => claimedBy.onPointerCancel?.(event, pressOf(press)));
    }

    /** The table detaches (or the window loses focus) mid-press: every claimant is told (`event` null) before the sessions detach; one that throws does not abort the detach. */
    private cancelPresses(): void {
        for (const [id, press] of [...this.presses]) this.endPress(id, press, null);
    }

    private eachBackwards(visit: (session: CellSession) => void): void {
        for (let i = this.sessions.length - 1; i >= 0; i--) {
            const session = this.sessions[i] as CellSession;
            if (!this.broken.has(session)) visit(session);
        }
    }

    /**
     * The control a press landed on INSIDE its cell: the first element from the target up, bounded to the nearest cell (a press in no cell is bounded by
     * the table's root), that is a control or carries `data-table-keeps-focus`. The cell itself and anything above it (an outer widget that hosts a
     * nested table, a link around the table) do not count. The one answer for the press, the offer and the focus.
     */
    private controlOf(target: Element | null): Element | null {
        const cell = target?.closest(CELL) ?? null;
        // Inside a cell anything the content makes focusable or interactive counts (an anchor used as a button, a custom focusable widget); outside a
        // cell only the native controls do (the viewport and the rows have a tabindex of their own).
        const selector = cell ? CELL_CONTROLS : CONTROLS;
        for (let el = target; el && el !== (cell ?? this.host.root); el = el.parentElement) if (el.matches(selector)) return el;
        return null;
    }

    /** The `data-pointer-transparent` overlay a target is (or sits in), bounded to THIS table (an ancestor of the whole table never counts). */
    private overlayOf(target: Element): Element | null {
        for (let el: Element | null = target; el && el !== this.host.root; el = el.parentElement) if (el.matches(OVERLAY)) return el;
        return null;
    }

    /** Focuses what a cell press landed on (the caller has excluded controls: `Press.bypass`). */
    private pointerFocus(target: Element): void {
        const at = cellAddressOf(target);
        if (at) return this.focusCell(at.rowIndex, at.columnKey, false);
        // A click on the body outside any cell (a group row, the stretch row) clears the focus; the toolbar, header and pager do not.
        if (target.closest(BODY) && !target.closest('[data-kind="detail"]')) this.clear();
    }

    // ---- keyboard ---------------------------------------------------------------------------------------------------

    private pageSize(): number {
        const viewport = this.host.root.querySelector<HTMLElement>(VIEWPORT);
        if (!viewport) return FALLBACK_PAGE;
        const height = (selector: string): number => viewport.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;
        const rows = ownElements(this.host.root, viewport.querySelectorAll<HTMLElement>(`${BODY} > [data-kind="data"]`));
        if (rows.length === 0) return FALLBACK_PAGE;
        const mean = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) / rows.length;
        return pageRows(viewport.clientHeight - height('[data-slot="table-header"]') - height('[data-slot="table-footer"]'), mean);
    }

    private onKey(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.isComposing || event.altKey) return false;
        const target = event.target as Element;
        if (target.closest(TEXT_FIELD) || (event.composedPath()[0] as Element | undefined)?.matches?.(TEXT_FIELD)) return false;
        if (!NAVIGATION_KEYS.has(event.key)) return false;
        const query = requireProvider(this.host, 'query');
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const at = cellAddressOf(target) ?? (target.matches(VIEWPORT) || target === this.host.root ? this.focused : null);
        // A key pressed on a control outside any cell (a header button, a group toggle, a detail widget) is the control's own.
        if (!at && !target.matches(VIEWPORT) && target !== this.host.root) return false;
        // Nothing focused yet: the first navigation key lands on the first cell.
        if (!at) {
            const first = keys[0];
            if (first === undefined || this.rowCount() === 0) return false;
            event.preventDefault();
            this.focusCell(0, first, true);
            return true;
        }
        const rows = query.renderedRows();
        const selection = this.host.provider('selection');
        const next = nextFocus(event.key, {
            row: at.rowIndex,
            col: nearestColumn(keys, at.columnKey, this.lastColumn),
            rowCount: rows.length,
            colCount: keys.length,
            isDisabled: (row) => {
                const data = rows[row];
                return data !== undefined && (selection?.isDisabled(data) ?? false);
            },
            pageSize: this.pageSize(),
            rtl: getComputedStyle(this.host.root).direction === 'rtl',
            ctrl: event.ctrlKey || event.metaKey,
        });
        const key = next ? keys[next.col] : undefined;
        if (!next || key === undefined) return false;
        event.preventDefault();
        this.focusCell(next.row, key, true);
        return true;
    }
}
