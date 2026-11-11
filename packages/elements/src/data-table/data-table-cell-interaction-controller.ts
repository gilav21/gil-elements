import { type CellAddress, cellAddressOf, type DataTableCoreHost, ownElements, ownEvents, requireProvider } from './data-table-host.js';
import { NAVIGATION_KEYS, nearestColumn, nextFocus, pageRows } from './data-table-keys.js';
import type { CellInteractionService } from './data-table-providers.js';
import type { CellEditError, CellRange, EditingCell } from './data-table.types.js';

const VIEWPORT = '[data-slot="data-table-viewport"]';
const BODY = '[data-slot="table-body"]';
/** A press on one of these belongs to the control: it keeps its own focus and click. */
const CONTROLS = 'input, textarea, select, button, a, [role="checkbox"], ge-checkbox, ge-input, [contenteditable]';
const TEXT_FIELD = 'input:not([type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Rows moved by one page key when nothing is drawn to measure. */
const FALLBACK_PAGE = 10;

/**
 * Focus, and later editing and range, of the grid's cells: one owner because reconciling them after a render writes
 * them together. Wave 4 is focus: the roving tabindex (exactly one cell, the focused one, is a tab stop; the viewport
 * only while no drawn cell is), arrow-key navigation over the drawn order, and keeping the focused cell on screen.
 * Tab is never handled, so it can always leave the grid.
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
    private rowAtExpansion: { at: CellAddress; id: string; cell: HTMLElement | null } | null = null;
    private watched: Element | null = null;
    private teardown: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: CellInteractionService = {
        focusedCell: () => this.focused,
        cellRange: (): CellRange | null => null, // wave 6
        editingCell: (): EditingCell | null => null, // wave 5
        cellEditError: (): CellEditError | null => null, // wave 5
        focusCell: (rowIndex, columnKey) => this.focusCell(rowIndex, columnKey, true),
        isCellSelected: () => false, // wave 6
    };

    attach(): void {
        const { host } = this;
        const { root, disposables } = host;
        this.teardown = [
            host.provide('interaction', this.service),
            host.addKeyHandler(100, (event) => this.onKey(event)),
            host.topics.on('expansion', () => this.noteFocusedRow()),
            disposables.listen<PointerEvent>(root, 'pointerdown', ownEvents(root, (event: PointerEvent) => this.onPointerDown(event))),
            disposables.listen<PointerEvent>(root, 'pointerup', ownEvents(root, (event: PointerEvent) => this.onPointerUp(event))),
            disposables.listen<PointerEvent>(root.ownerDocument, 'pointerdown', (event) => !root.contains(event.target as Node) && (this.within = false), true),
            disposables.listen(root.ownerDocument.defaultView ?? window, 'blur', () => (this.within = false)),
            disposables.listen(root, 'pointercancel', () => (this.pointer = false)),
            disposables.listen(root, 'keydown', () => (this.pointer = false), true),
            disposables.listen<FocusEvent>(root, 'focusin', ownEvents(root, (event: FocusEvent) => this.onFocusIn(event))),
            disposables.listen<FocusEvent>(root, 'focusout', ownEvents(root, (event: FocusEvent) => this.onFocusOut(event))),
            disposables.add(() => this.observer?.disconnect()),
        ];
        // wave 5: the editor's own listeners and the commit / cancel keys join the ones above.
        // wave 6: pointer range selection, Shift+arrow extension and the long-press gesture join them too.
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.observer?.disconnect();
        this.observer = this.watched = null;
        this.within = this.pointer = false;
        this.rowAtExpansion = null; // a row noted for the attach that is ending is not the next attach's
    }

    /** Before every render: the focused cell follows its row (when a node or group moved it), the data (clamped to the rows that exist) and the layout. */
    hostUpdate(): void {
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
            const group = moved ? this.collapsedGroupOf(moved.id) : undefined;
            if (moved && group !== undefined) return this.dropFocus(moved.cell, group);
            // No rows because they are loading changes nothing: the focus waits for rows, and so does the row it was following.
            this.rowAtExpansion = moved;
            return;
        }
        let row = moved ? this.followRow(at, moved.id) : at.rowIndex;
        if (row === -1) {
            // Gone with a collapsed group, the roving cell has nowhere to stay; gone for any other reason (a page, a filter) it is clamped like any cell.
            const group = moved ? this.collapsedGroupOf(moved.id) : undefined;
            if (moved && group !== undefined) return this.dropFocus(moved.cell, group, at);
            row = at.rowIndex;
        }
        const next = this.landOn(row, at.columnKey);
        if (!next) return this.clear();
        if (next.rowIndex !== at.rowIndex || next.columnKey !== at.columnKey) this.set(next);
    }

    /** The cell nearest to `rowIndex` and `columnKey` that exists (rows clamped, a hidden column left for its neighbour); null when there is none. */
    private landOn(rowIndex: number, columnKey: string): CellAddress | null {
        const rows = this.rowCount();
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const col = nearestColumn(keys, columnKey, this.lastColumn);
        if (rows === 0 || col === -1) return null;
        this.lastColumn = col;
        return { rowIndex: Math.min(rowIndex, rows - 1), columnKey: keys[col] as string };
    }

    /** A node or group opened or closed while a row held the focus: remember which row (from the drawn DOM, still the old one) and whether DOM focus sat in its cell. */
    private noteFocusedRow(): void {
        const at = this.focused;
        const id = at ? this.host.rowAt(at.rowIndex)?.dataset['rowId'] : undefined;
        if (!at) {
            this.rowAtExpansion = null;
            return;
        }
        // No row drawn at the focused index (the list is empty): a note kept waiting for rows stays, it is not replaced by nothing.
        if (id === undefined) return;
        const cell = this.host.cellAt(at.rowIndex, at.columnKey);
        const active = this.rootNode().activeElement;
        this.rowAtExpansion = { at, id, cell: cell?.contains(active) ? cell : null };
    }

    /**
     * Where the row that held the focus is now: its own index, or its nearest ancestor's when a tree node closed over it, and -1 when
     * it is not drawn. A row still at the index the focus is at costs one id read, which is every detail toggle; otherwise the ids
     * are read once, in one pass, and the ancestors are looked up in that.
     */
    private followRow(at: CellAddress, id: string): number {
        const { config } = this.host;
        const query = requireProvider(this.host, 'query');
        const idOf = (row: unknown): string => config.getRowId(row as never);
        const here = query.renderedRowAt(at.rowIndex);
        if (here !== undefined && idOf(here) === id) return at.rowIndex;
        const indexes = new Map<string, number>();
        query.renderedRows().forEach((row, i) => {
            const key = idOf(row);
            if (!indexes.has(key)) indexes.set(key, i);
        });
        let index = indexes.get(id) ?? -1;
        if (index === -1 && config.enableSubRows) {
            const parents = query.treeIndex().parent;
            for (let parent = parents.get(id); parent !== undefined && index === -1; parent = parents.get(parent)) index = indexes.get(parent) ?? -1;
        }
        return index;
    }

    /** The key of the collapsed group a row belongs to, from the query's grouping: only the collapsed groups are searched, not every row. */
    private collapsedGroupOf(id: string): string | undefined {
        const { config, model } = this.host;
        const collapsed = model.get('collapsedGroups');
        return requireProvider(this.host, 'query')
            .groupRows()
            .find((group) => collapsed[group.groupKey] === true && group.rows.some((row) => config.getRowId(row) === id))?.groupKey;
    }

    /**
     * The focused row left with its collapsed group: the roving cell has nowhere to stay. If DOM focus was on that cell the toggle of its
     * group header takes it; failing that (the header is on another page) the nearest row that is left does, in the same column, without
     * scrolling: the keyboard stays where the user was. If DOM focus was anywhere else (a toolbar button that collapsed the group, a widget
     * in a detail row) it stays there.
     */
    private dropFocus(cell: HTMLElement | null, group: string, at?: CellAddress): void {
        this.clear();
        if (!cell) return;
        this.host.afterRender(() => {
            const active = this.rootNode().activeElement;
            // Still nowhere: the cell is gone with its row (focus fell to the page) or is the viewport; something else has it by now otherwise.
            if (active && active !== this.host.root.ownerDocument.body && active !== cell && active !== this.host.root.querySelector(VIEWPORT)) return;
            const toggle = this.groupToggle(group);
            if (toggle) return toggle.focus();
            const next = at && this.landOn(at.rowIndex, at.columnKey);
            // The header is on another page: a row that is left takes the focus; with no rows at all (every group closed) any group header does.
            if (next) this.focusCell(next.rowIndex, next.columnKey, false);
            else this.groupToggle()?.focus();
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
        if (!this.hasFocus()) this.host.afterRender(() => this.focusDom());
    }

    // ---- DOM focus --------------------------------------------------------------------------------------------------

    private rootNode(): Document | ShadowRoot {
        return this.host.root.getRootNode() as Document | ShadowRoot;
    }

    private hasFocus(): boolean {
        const cell = this.focused ? this.host.cellAt(this.focused.rowIndex, this.focused.columnKey) : null;
        return cell !== null && this.rootNode().activeElement === cell;
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

    /** A render can remove or move the focused element (a sort, a row leaving the window): DOM focus then falls to the page. */
    private watchDom(): void {
        const viewport = this.host.root.querySelector(VIEWPORT);
        // A new viewport element (the skeleton gives way to the grid) is a new subtree to watch.
        if (!viewport || viewport === this.watched) return;
        this.observer?.disconnect();
        this.watched = viewport;
        this.observer = new MutationObserver(() => {
            const active = this.rootNode().activeElement;
            if (this.within && this.focused && (!active || !this.host.root.contains(active) || active === this.host.root.ownerDocument.body)) this.focusDom();
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

    private onPointerDown(event: PointerEvent): void {
        this.pointer = true;
        // A touch that scrolls is cancelled by the browser and never reaches pointerup: only a tap focuses.
        if (event.button === 0 && event.pointerType !== 'touch') this.pointerFocus(event.target as Element);
    }

    private onPointerUp(event: PointerEvent): void {
        this.pointer = false;
        if (event.pointerType === 'touch') this.pointerFocus(event.target as Element);
    }

    private pointerFocus(target: Element): void {
        if (target.closest(CONTROLS)) return;
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
