import { clipboardEventForGrid, type CopyScope, type CopySource, copyGrid, editorOpen, gridCells, inTextField, keyboardCopyGrid, onGrid, selectsGridText } from './data-table-clipboard-grid.js';
import { type DataTableCoreHost, ownElements, requireProvider } from './data-table-host.js';
import { lazyPart } from './data-table-lazy.js';
import { interpolate } from './data-table.locales.js';
import type { ClipboardResult, ClipboardService } from './data-table-providers.js';
import { normalizeCellRange } from './data-table-range.js';
import { KEY_PRIORITY } from './data-table-registry.js';
import { toClipboardText } from './data-table.spreadsheet.js';
import { isSpecialColumnKey } from './data-table.utils.js';
import type { PastePart } from './lazy/clipboard.js';

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
    /** A `readText` is in flight: a second Ctrl+V meanwhile is swallowed, not queued (a permission prompt may hold the first one). */
    private pending = false;
    /** Bumped by every attach and detach: a read that resolves after the table detached (or attached anew) pastes nothing. */
    private attachment = 0;
    private readonly paste = lazyPart<PastePart<T>>(() => import('./lazy/clipboard.js').then((m) => new m.PastePart(this.host)));

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: ClipboardService<T> = {
        copy: (scope, row) => this.copy(scope, row),
        paste: () => this.pasteFromClipboard(),
        pasteText: (text, at) => {
            if (!this.host.config.enableClipboardPaste) return { status: 'ignored' };
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
            // On the document: the browser's copy may target something outside the table (the body) while the focus is in it (`clipboardEventForGrid`).
            disposables.listen<ClipboardEvent>(root.ownerDocument, 'copy', (event) => this.onNativeCopy(event)),
        ];
    }

    hostUpdate(): void {
        this.paste.sync(this.host.config.enableClipboardPaste);
    }

    detach(): void {
        this.attachment++;
        this.pending = false;
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
            range: range?.active() ? normalizeCellRange(range.range(), navigableKeys) : null,
            drawnRows: () => {
                // A tree draws its visible nodes flattened (children under their parents): the copy follows that list (`sortedData()` holds the roots only).
                if (host.config.enableSubRows) return query.renderedRows();
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
        if (event.defaultPrevented || !host.config.enableCopy || !event.clipboardData || inTextField(host.root, event)) return;
        if (!clipboardEventForGrid(host.root, event) || this.copiesSelectedText()) return;
        const grid = keyboardCopyGrid(this.source());
        if (!grid) return;
        event.clipboardData.setData('text/plain', toClipboardText(grid));
        event.preventDefault();
        host.announce(this.copiedText(gridCells(grid)));
    }

    // ---- keys -------------------------------------------------------------------------------------------------------

    /** Ctrl/Cmd+C and Ctrl/Cmd+V (no Shift, no Alt) on the grid (a body cell, or the viewport or root), never from a text field or a header / readout control. */
    private onKey(event: KeyboardEvent): boolean {
        if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return false;
        const key = event.key.toLowerCase();
        if ((key !== 'c' && key !== 'v') || !onGrid(this.host.root, event)) return false;
        return key === 'c' ? this.keyCopy(event) : this.keyPaste(event);
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

    /** Pastes at the focused cell, read NOW (the focus may move during the await). Not while editing, not without a focused cell. */
    private keyPaste(event: KeyboardEvent): boolean {
        const { host } = this;
        if (!host.config.enableClipboardPaste || editorOpen(host) || !canRead() || !this.paste.part) return false;
        if (!host.provider('interaction')?.focusedCell()) return false;
        event.preventDefault();
        void this.pasteFromClipboard();
        return true;
    }

    /**
     * Reads the async clipboard and pastes at the focused cell; a refused read is announced, never an unhandled rejection. Nothing is read (no permission
     * prompt) while the paste part is not loaded. The target is taken NOW, as its row's id: after the await it is found again by that id, so a sort or a
     * new page that arrived meanwhile does not paste into whichever row now sits at the old index (a row that is gone pastes nothing).
     */
    private async pasteFromClipboard(): Promise<ClipboardResult> {
        const { host } = this;
        if (!host.config.enableClipboardPaste) return { status: 'ignored' };
        if (!canRead()) return { status: 'unavailable' };
        const at = host.provider('interaction')?.focusedCell() ?? null;
        if (this.pending || editorOpen(host) || !at || !this.paste.part) return { status: 'ignored' };
        const query = requireProvider(host, 'query');
        const row = query.renderedRowAt(at.rowIndex);
        if (row === undefined) return { status: 'ignored' };
        const rowId = String(host.config.getRowId(row));
        this.pending = true;
        const attachment = this.attachment;
        let text: string;
        try {
            text = (await clipboardApi()?.readText()) ?? '';
        } catch {
            if (attachment !== this.attachment) return { status: 'ignored' };
            this.pending = false;
            host.announce(host.resolvedLocale.pasteFailedAnnouncement);
            return { status: 'denied' };
        }
        if (attachment !== this.attachment) return { status: 'ignored' }; // detached meanwhile: nothing is written into a table that is gone
        this.pending = false;
        const rowIndex = rowIndexOf(requireProvider(host, 'query').renderedRows(), rowId, host.config.getRowId);
        if (rowIndex === -1) return { status: 'ignored' }; // the row left the drawn rows during the read
        return this.paste.part?.pasteText(text, { rowIndex, columnKey: at.columnKey }) ?? { status: 'ignored' };
    }
}
