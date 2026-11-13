import { clipboardEventForGrid, type CopyScope, type CopySource, copyGrid, editorOpen, gridCells, keyboardCopyGrid, onGrid, pasteStart, selectsGridText } from './data-table-clipboard-grid.js';
import { type DataTableCoreHost, isTextFieldKey, ownElements, requireProvider, shortcutLetter } from './data-table-host.js';
import { lazyPart } from './data-table-lazy.js';
import { interpolate } from './data-table.locales.js';
import type { ClipboardResult, ClipboardService } from './data-table-providers.js';
import { KEY_PRIORITY } from './data-table-registry.js';
import { toClipboardText } from './data-table.spreadsheet.js';
import { isSpecialColumnKey } from './data-table.utils.js';
import type { PastePart } from './lazy/clipboard.js';

/** Every node of a tree, parents before their children, in the order the rows hold them (a plain depth-first walk: no expansion, no metadata). */
function depthFirst<T>(roots: readonly T[], getChildren: (row: T) => readonly T[] | undefined): T[] {
    const out: T[] = [];
    const walk = (rows: readonly T[]): void => {
        for (const row of rows) {
            out.push(row);
            const children = getChildren(row);
            if (children?.length) walk(children);
        }
    };
    walk(roots);
    return out;
}

/** The two feature flags the answers depend on (the element and the controller's `host.config` both have them). */
interface ClipboardFlags {
    readonly enableCopy: boolean;
    readonly enableClipboardPaste: boolean;
}

/** The Async Clipboard method the action needs, when the page has it (an insecure context, an old browser or Firefox's missing `readText` has not). */
const clipboardApi = (): Clipboard | undefined => (typeof navigator === 'undefined' ? undefined : (navigator as Partial<Navigator>).clipboard);
const canWrite = (): boolean => typeof clipboardApi()?.writeText === 'function';
const canRead = (): boolean => typeof clipboardApi()?.readText === 'function';

/** The drawn index of the row with this id (ids compared as strings: a `getRowId` may answer numbers), or -1. */
function rowIndexOf<T>(rows: readonly T[], id: string, getRowId: (row: T) => string): number {
    return rows.findIndex((row) => String(getRowId(row)) === id);
}

/** Whether a copy of `scope` is switched on: `enable-copy`, except the range copy, which Angular's `copyCellRangeToClipboard` does not gate (cmp 4611). */
const copyOn = (flags: ClipboardFlags, scope: CopyScope): boolean => scope === 'range' || flags.enableCopy;

/**
 * The `clipboard` answers with no live grid (the element uses them while it has no provider: detached, or before the first connect): `ignored`
 * while the feature is off, otherwise `unavailable` (nothing to copy from or paste into). ONE rule for the controller's gates and the element's
 * fallback, like `neutralRowDrag`; the controller's own service does the real work once the gates pass.
 */
export function neutralClipboard<T>(flags: () => ClipboardFlags): ClipboardService<T> {
    const status = (on: boolean): 'unavailable' | 'ignored' => (on ? 'unavailable' : 'ignored');
    return {
        copy: (scope) => Promise.resolve({ status: status(copyOn(flags(), scope)) }),
        paste: () => Promise.resolve({ status: status(flags().enableClipboardPaste) }),
        pasteText: () => ({ status: status(flags().enableClipboardPaste) }),
    };
}

/**
 * Copy (eager) and paste (a lazy part) of cells (wave 6, package B owns this file). Copy and paste go through the Async Clipboard API on
 * Ctrl/Cmd+C and Ctrl/Cmd+V (`KEY_PRIORITY.clipboard`); where the API is missing the keys are left to the browser, whose native `copy` / `paste`
 * events are answered instead (the same listeners serve the browser's own Copy and Paste menu entries). A refused permission is caught and
 * announced (Angular leaves an unhandled rejection, AB1). Results are announced at once (a discrete action, not a stream).
 */
export class ClipboardController<T> {
    private teardown: (() => void)[] = [];
    /** A programmatic `paste()` is reading the clipboard: another one meanwhile is ignored, not queued (a permission prompt may hold the first one). */
    private pending = false;
    /** Bumped by every attach and detach: a read that resolves after the table detached (or attached anew) pastes nothing. */
    private attachment = 0;
    /** A Ctrl/Cmd+V keystroke whose native `paste` event has not arrived yet (see `keyPaste`); the event marks it handled. */
    private keystroke: { handled: boolean } | null = null;
    /** A native paste that arrived before the paste part was loaded: its text and target (by row id), applied when the part attaches. */
    private early: { text: string; rowId: string; columnKey: string } | null = null;
    /** The paste part failed to load (latched until the flag turns off or the table detaches): a native paste is then left to the browser, not kept. */
    private loadFailed = false;
    private readonly paste = lazyPart<PastePart<T>>(() => import('./lazy/clipboard.js').then((m) => new m.PastePart(this.host)), {
        changed: () => this.applyEarly(),
        onError: (error) => {
            console.error('[ge-data-table] a lazy part failed to load:', error);
            if (this.early) this.host.announce(this.host.resolvedLocale.pasteFailedAnnouncement);
            this.early = null;
            this.loadFailed = true;
        },
    });

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: ClipboardService<T> = {
        copy: (scope, row) => this.copy(scope, row),
        paste: () => this.pasteFromClipboard(),
        pasteText: (text, at) => {
            if (!this.host.config.enableClipboardPaste || editorOpen(this.host)) return { status: 'ignored' }; // an open editor owns its cell's input
            return this.paste.part?.pasteText(text, at) ?? { status: 'ignored' }; // the part loads at the first update with the flag on
        },
    };

    attach(): void {
        this.attachment++;
        const { host } = this;
        const { root, disposables } = host;
        this.teardown = [
            host.provide('clipboard', this.service),
            host.addKeyHandler(KEY_PRIORITY.clipboard, (event) => this.onKey(event)),
            // On the document: the browser's copy and paste may target something outside the table (the body) while the focus is in it (`clipboardEventForGrid`).
            disposables.listen<ClipboardEvent>(root.ownerDocument, 'copy', (event) => this.onNativeCopy(event)),
            disposables.listen<ClipboardEvent>(root.ownerDocument, 'paste', (event) => this.onNativePaste(event)),
            // The browser fired its paste for a Ctrl/Cmd+V keystroke: no fallback read. Heard in the CAPTURE phase, before anything on the page can stop the
            // event (a consumer's stopPropagation must not make the fallback read the clipboard a second time).
            disposables.listen(root.ownerDocument, 'paste', () => {
                if (this.keystroke) this.keystroke.handled = true;
            }, true),
        ];
    }

    hostUpdate(): void {
        const on = this.host.config.enableClipboardPaste;
        if (!on) {
            this.early = null; // a paste kept while the part loaded belongs to a feature that is off now
            this.loadFailed = false; // the latch of `lazyPart` is released with the flag too
        }
        this.paste.sync(on);
    }

    detach(): void {
        this.attachment++;
        this.pending = false;
        this.early = null;
        this.loadFailed = false; // `dispose()` releases the latch: the next attach loads again
        this.paste.dispose();
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
    }

    // ---- copy -------------------------------------------------------------------------------------------------------

    /** What a copy reads, from the services at copy time (never the DOM). */
    private source(): CopySource<T> {
        const { host } = this;
        const query = requireProvider(host, 'query');
        const columns = requireProvider(host, 'columns');
        const range = host.provider('range');
        const navigableKeys = columns.navigableKeys();
        const selected = host.model.get('rowSelection');
        return {
            columns: columns.enhancedColumns().filter((c) => !isSpecialColumnKey(String(c.accessorKey))),
            navigableKeys,
            rowAt: (index) => query.renderedRowAt(index),
            focused: host.provider('interaction')?.focusedCell() ?? null,
            // The range counts only while the range part handles ranges (a held value of a mode that is off, or a part still loading, is no range).
            range: range?.active() ? range.normalized() : null,
            drawnRows: () => {
                // A tree: every node of the whole (filtered, sorted) tree, flattened in the drawn order (children under their parents), whatever is collapsed
                // and whatever the page, like the grouped and flat copies (`treeRoots()`: the tree the table draws, filtered and sorted, children with them).
                if (host.config.enableSubRows) return depthFirst(query.treeRoots(), host.config.getChildren);
                // Grouping draws group by group (collapsed groups included): the copy follows the screen, across pages.
                const groups = query.groupRows();
                return groups.length > 0 ? groups.flatMap((group) => group.rows) : query.sortedData();
            },
            isSelected: (row) => selected[String(host.config.getRowId(row))] === true,
            exportAll: () => query.exportData(),
        };
    }

    private async copy(scope: CopyScope, row?: T): Promise<ClipboardResult> {
        if (!copyOn(this.host.config, scope)) return { status: 'ignored' };
        if (!canWrite()) return { status: 'unavailable' };
        const grid = copyGrid(scope, this.source(), row);
        return grid ? this.write(grid) : { status: 'empty' };
    }

    /** Writes a grid as TSV; a refusal is caught (no unhandled rejection) and announced. */
    private async write(grid: readonly (readonly string[])[]): Promise<ClipboardResult> {
        const { host } = this;
        const cells = gridCells(grid);
        try {
            await clipboardApi()?.writeText(toClipboardText(grid));
        } catch {
            host.announce(host.resolvedLocale.copyFailedAnnouncement);
            return { status: 'denied' };
        }
        host.announce(this.copiedText(cells));
        return { status: 'done', cells };
    }

    private copiedText(cells: number): string {
        const locale = this.host.resolvedLocale;
        return cells === 1 ? locale.copiedAnnouncementOne : interpolate(locale.copiedAnnouncement, { count: cells });
    }

    /**
     * Text the user selected over what the grid would copy (the focused cell, the cells in the range): the copy is the browser's. Read from the drawn
     * cells: only a drawn cell can hold a selection.
     */
    private copiesSelectedText(): boolean {
        const { host } = this;
        const focused = host.provider('interaction')?.focusedCell();
        const cells = ownElements(host.root, host.root.querySelectorAll('[data-slot="table-cell"][data-in-range]'));
        const cell = focused ? host.cellAt(focused.rowIndex, focused.columnKey) : null;
        if (cell) cells.push(cell);
        return selectsGridText(host.root, cells);
    }

    /**
     * The browser's own copy (no Async Clipboard API, or its Copy menu entry) for this table: on one of its cells, or anywhere outside it while the focus is
     * inside it (heard on the document). The grid's copy goes into the event.
     */
    private onNativeCopy(event: ClipboardEvent): void {
        const { host } = this;
        if (event.defaultPrevented || !host.config.enableCopy || !event.clipboardData || isTextFieldKey(host.root, event)) return;
        if (!clipboardEventForGrid(host.root, event) || this.copiesSelectedText()) return;
        const grid = keyboardCopyGrid(this.source());
        if (!grid) return;
        event.clipboardData.setData('text/plain', toClipboardText(grid));
        event.preventDefault();
        host.announce(this.copiedText(gridCells(grid)));
    }

    // ---- keys -------------------------------------------------------------------------------------------------------

    /**
     * Ctrl/Cmd+C (no Shift, no Alt) on the grid (a body cell, or the viewport or root), never from a text field or a header / readout control.
     * Ctrl/Cmd+V is NOT handled here (D1, beyond Angular): the key is left to the browser, which fires a native `paste` event carrying the clipboard's
     * text with no permission prompt (`onNativePaste`); the Async Clipboard read is only for the programmatic `paste()`.
     */
    private onKey(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return false;
        const key = shortcutLetter(event); // the physical key on a non-Latin layout
        if ((key !== 'c' && key !== 'v') || !onGrid(this.host.root, event)) return false;
        if (key === 'v') return this.keyPaste();
        return this.keyCopy(event);
    }

    /**
     * Ctrl/Cmd+V is the browser's (not prevented): its native `paste` event pastes. An engine that fires no `paste` on non-editable content (WebKit)
     * would paste nothing, so ONE zero-delay timeout checks after the keystroke: when no native paste arrived for it, the programmatic read is the
     * fallback. Never consumed.
     */
    private keyPaste(): false {
        const { host } = this;
        if (!host.config.enableClipboardPaste || editorOpen(host) || !canRead()) return false;
        const keystroke = { handled: false };
        this.keystroke = keystroke;
        host.disposables.timeout(() => {
            if (this.keystroke === keystroke) this.keystroke = null;
            if (!keystroke.handled) void this.pasteFromClipboard();
        }, 0);
        return false;
    }

    /** Angular's precedence (cmp 4571): the range, else the focused cell, else the selected rows. Consumed only when the API can write it. */
    private keyCopy(event: KeyboardEvent): boolean {
        if (!this.host.config.enableCopy || !canWrite()) return false; // no API: the browser's own `copy` event follows and is answered there
        if (this.copiesSelectedText()) return false; // text selected over the focused cell or the range: the browser copies that text
        const grid = keyboardCopyGrid(this.source());
        if (!grid) return false;
        event.preventDefault();
        void this.write(grid);
        return true;
    }

    // ---- paste ------------------------------------------------------------------------------------------------------

    /** The paste target now, as its row's id and column (found again by id when the paste is applied later: a sort may move the row meanwhile); null when there is none. */
    private target(): { rowId: string; columnKey: string } | null {
        const { host } = this;
        const at = pasteStart(host);
        const row = at ? host.provider('query')?.renderedRowAt(at.rowIndex) : undefined;
        return at && row !== undefined ? { rowId: String(host.config.getRowId(row)), columnKey: at.columnKey } : null;
    }

    /** Pastes `text` at a target taken earlier, its row found again by id; `ignored` when an editor opened meanwhile or the row left the drawn rows. */
    private pasteAt(text: string, target: { rowId: string; columnKey: string }): ClipboardResult {
        const { host } = this;
        if (editorOpen(host)) return { status: 'ignored' }; // an editor opened meanwhile: the paste would write under it
        const rowIndex = rowIndexOf(requireProvider(host, 'query').renderedRows(), target.rowId, host.config.getRowId);
        if (rowIndex === -1) return { status: 'ignored' };
        return this.paste.part?.pasteText(text, { rowIndex, columnKey: target.columnKey }) ?? { status: 'ignored' };
    }

    /**
     * The browser's paste (Ctrl/Cmd+V on the grid, or its Paste menu entry) for this table: the event carries the text, so there is no permission prompt.
     * It pastes at the range's top-left, else the focused cell. When it arrives before the paste part has loaded (the flag was just switched on) the
     * text and the target are kept and applied once the part attaches.
     */
    private onNativePaste(event: ClipboardEvent): void {
        const { host } = this;
        if (event.defaultPrevented || !host.config.enableClipboardPaste || editorOpen(host) || isTextFieldKey(host.root, event)) return;
        if (!clipboardEventForGrid(host.root, event)) return;
        const target = this.target();
        if (!target || (!this.paste.part && this.loadFailed)) return; // no part will come (its load failed): the browser keeps its event
        event.preventDefault();
        const text = event.clipboardData?.getData('text/plain') ?? '';
        if (this.paste.part) this.pasteAt(text, target);
        else this.early = { text, ...target }; // the latest one wins: applied when the part attaches
    }

    /** The part attached: a native paste that arrived while it loaded is applied now. */
    private applyEarly(): void {
        const early = this.early;
        this.early = null;
        if (early) this.pasteAt(early.text, early);
    }

    /**
     * The programmatic paste (`clipboard.paste()`): reads the async clipboard and pastes at the range's top-left, else the focused cell. A refused read
     * is announced, never an unhandled rejection; a read that never settles (a permission prompt left open) is given up after `READ_TIMEOUT_MS`, so it
     * cannot block every later paste. Nothing is read while the paste part is not loaded. The target is taken NOW and found again by row id after the
     * await; an editor that opened during the read wins (nothing is written).
     */
    private async pasteFromClipboard(): Promise<ClipboardResult> {
        const { host } = this;
        if (!host.config.enableClipboardPaste) return { status: 'ignored' };
        if (!canRead()) return { status: 'unavailable' };
        const target = this.target();
        if (this.pending || editorOpen(host) || !target || !this.paste.part) return { status: 'ignored' };
        this.pending = true;
        const attachment = this.attachment;
        let text: string;
        try {
            text = await withTimeout(clipboardApi()?.readText() ?? Promise.resolve(''), READ_TIMEOUT_MS);
        } catch {
            if (attachment !== this.attachment) return { status: 'ignored' };
            this.pending = false;
            host.announce(host.resolvedLocale.pasteFailedAnnouncement);
            return { status: 'denied' };
        }
        if (attachment !== this.attachment) return { status: 'ignored' }; // detached meanwhile: nothing is written into a table that is gone
        this.pending = false;
        return this.pasteAt(text, target);
    }
}

/** How long a programmatic paste waits for the clipboard read before it gives up (a permission prompt nobody answers). */
export const READ_TIMEOUT_MS = 10_000;

/** `promise`, or a rejection after `ms`. */
function withTimeout<R>(promise: Promise<R>, ms: number): Promise<R> {
    return new Promise<R>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('clipboard read timed out')), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error instanceof Error ? error : new Error(String(error)));
            },
        );
    });
}
