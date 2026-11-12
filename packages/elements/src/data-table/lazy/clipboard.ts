/**
 * Lazy part of `ClipboardController` (wave 6, package B owns this file): paste parsing, planning and writing, and the native `paste`
 * listener. Copy is eager. A build entry (`data-table/lazy/clipboard`), loaded by `lazyPart` when `enable-clipboard-paste` is on. It draws
 * nothing, so its `lazyPart` has no `changed`.
 */
import { cellAddressOf, type CellAddress, type DataTableCoreHost, ownClosest, requireProvider } from '../data-table-host.js';
import { CELL_SELECTOR, clipboardEventForGrid, editorOpen, inTextField, pasteStart } from '../data-table-clipboard-grid.js';
import { pasteAnnouncement, pastedGrid, pasteEvent, planPasteRequests } from '../data-table-paste-apply.js';
import type { ClipboardResult } from '../data-table-providers.js';
import { rangeModeOn } from '../data-table-range.js';

export class PastePart<T> {
    private unlisten: (() => void) | null = null;

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    attach(): void {
        const { root, disposables } = this.host;
        // The browser's own Paste (its menu, or Ctrl/Cmd+V when the async clipboard is missing or the key handler left it): the text comes with the event.
        // Heard on the document: the event may target something outside the table while the focus is in it (`clipboardEventForGrid`).
        this.unlisten = disposables.listen<ClipboardEvent>(root.ownerDocument, 'paste', (event) => this.onNativePaste(event));
    }

    detach(): void {
        this.unlisten?.();
        this.unlisten = null;
    }

    private onNativePaste(event: ClipboardEvent): void {
        const { host } = this;
        if (event.defaultPrevented || !host.config.enableClipboardPaste || editorOpen(host) || inTextField(host.root, event)) return;
        if (!clipboardEventForGrid(host.root, event)) return;
        const at = pasteStart(host) ?? cellAddressOf(ownClosest(host.root, event.target, CELL_SELECTOR));
        if (!at) return;
        event.preventDefault();
        this.pasteText(event.clipboardData?.getData('text/plain') ?? '', at);
    }

    /**
     * Pastes `text` from `at` (default: the focused cell): one undo step, one `data-change`, `cells-paste` once, an `edit-error` per rejected cell,
     * the pasted rectangle becomes the range (D3b, range mode only, two cells or more) and the result is announced. `ignored` while the table is
     * loading, with no target cell or a start column that takes no paste; `empty` for empty text.
     */
    pasteText(text: string, at?: CellAddress): ClipboardResult {
        const { host } = this;
        const target = at ?? pasteStart(host); // the range's top-left, else the focused cell
        if (host.config.loading || !target) return { status: 'ignored' };
        const grid = pastedGrid(text);
        if (grid.length === 0) return { status: 'empty' };
        const query = requireProvider(host, 'query');
        const columns = requireProvider(host, 'columns');
        const all = columns.enhancedColumns();
        const plan = planPasteRequests(grid, target.rowIndex, target.columnKey, {
            navigableKeys: columns.navigableKeys(),
            rowCount: query.renderedRows().length,
            rowAt: (index) => query.renderedRowAt(index),
            columnByKey: (key) => all.find((c) => String(c.accessorKey) === key),
            cellValue: (row, column) => query.cellValue(row, column.accessorKey, column),
        });
        if (!plan) return { status: 'ignored' };
        const results = host.runAsCommand(() => host.writeCells(plan.requests));
        const detail = pasteEvent(plan, results);
        if (detail.cellsApplied === 0) {
            // Nothing written (every target skipped or rejected), like a fill that wrote nothing: no `cells-paste`, the range stays. Rejections were
            // reported per cell (`edit-error`) and are said in the live region.
            if (detail.cellsRejected > 0) host.announce(pasteAnnouncement(host.resolvedLocale, 0, detail.cellsRejected));
            return { status: 'done', cells: 0, rejected: detail.cellsRejected };
        }
        host.emit('cells-paste', detail);
        const { rect } = plan;
        if (rect && rangeModeOn(host.config) && (rect.endRow > rect.startRow || rect.endCol !== rect.startCol)) host.provider('range')?.setRange(rect);
        host.announce(pasteAnnouncement(host.resolvedLocale, detail.cellsApplied, detail.cellsRejected));
        return { status: 'done', cells: detail.cellsApplied, rejected: detail.cellsRejected };
    }
}
