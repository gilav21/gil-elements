import { type CellAddress, cellAddressOf, type DataTableCoreHost, requireProvider } from './data-table-host.js';
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
            disposables.listen<PointerEvent>(root, 'pointerdown', (event) => this.onPointerDown(event)),
            disposables.listen<PointerEvent>(root, 'pointerup', (event) => this.onPointerUp(event)),
            disposables.listen<PointerEvent>(root.ownerDocument, 'pointerdown', (event) => !root.contains(event.target as Node) && (this.within = false), true),
            disposables.listen(root.ownerDocument.defaultView ?? window, 'blur', () => (this.within = false)),
            disposables.listen(root, 'pointercancel', () => (this.pointer = false)),
            disposables.listen(root, 'keydown', () => (this.pointer = false), true),
            disposables.listen<FocusEvent>(root, 'focusin', (event) => this.onFocusIn(event)),
            disposables.listen<FocusEvent>(root, 'focusout', (event) => this.onFocusOut(event)),
            disposables.add(() => this.observer?.disconnect()),
        ];
        // wave 5: the editor's own listeners and the commit / cancel keys join the ones above.
        // wave 6: pointer range selection, Shift+arrow extension and the long-press gesture join them too.
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.observer?.disconnect();
        this.observer = null;
        this.within = this.pointer = false;
    }

    /** Before every render: the focused cell follows the data (clamped to the rows that exist) and the layout. */
    hostUpdate(): void {
        this.watchDom();
        const at = this.focused;
        if (!at) return;
        const rows = this.rowCount();
        // An empty list (a server page loading) changes nothing: the focus waits for rows.
        if (rows === 0) return;
        const keys = requireProvider(this.host, 'columns').focusableKeys();
        const col = nearestColumn(keys, at.columnKey, this.lastColumn);
        if (col === -1) return this.clear();
        const next = { rowIndex: Math.min(at.rowIndex, rows - 1), columnKey: keys[col] as string };
        this.lastColumn = col;
        if (next.rowIndex !== at.rowIndex || next.columnKey !== at.columnKey) this.set(next);
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
        if (!viewport || this.observer) return;
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
        const rows = [...viewport.querySelectorAll<HTMLElement>(`${BODY} > [data-kind="data"]`)];
        if (rows.length === 0) return FALLBACK_PAGE;
        const mean = rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) / rows.length;
        return pageRows(viewport.clientHeight - height('[data-slot="table-header"]') - height('[data-slot="table-footer"]'), mean);
    }

    private onKey(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.isComposing || event.altKey) return false;
        const target = event.target as Element;
        if (target.closest(TEXT_FIELD) || (event.composedPath()[0] as Element | undefined)?.matches?.(TEXT_FIELD)) return false;
        if (this.activate(event, target)) return true;
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

    /** Enter or Space on the cell of a detail expander presses its button; the selection cell is the selection controller's (Space). */
    private activate(event: KeyboardEvent, target: Element): boolean {
        if ((event.key !== 'Enter' && event.key !== ' ') || event.ctrlKey || event.metaKey || event.shiftKey) return false;
        if (!target.matches('[data-slot="table-cell"][data-special="expander"]')) return false;
        event.preventDefault();
        target.querySelector<HTMLElement>('[data-toggle]')?.click();
        return true;
    }
}
