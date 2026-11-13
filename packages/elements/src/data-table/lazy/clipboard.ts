/**
 * Lazy part of `ClipboardController` (wave 6, package B owns this file): paste parsing, planning and writing. Copy, and the native `paste` listener
 * (which must hear a paste that arrives while this part loads), are the controller's (eager). A build entry (`data-table/lazy/clipboard`), loaded by
 * `lazyPart` when `enable-clipboard-paste` is on.
 */
import { type CellAddress, type DataTableCoreHost, requireProvider } from '../data-table-host.js';
import { pasteStart, rowIdsAt } from '../data-table-clipboard-grid.js';
import { pasteAnnouncement, pastedGrid, pasteEvent, planPasteRequests } from '../data-table-paste-apply.js';
import type { ClipboardResult } from '../data-table-providers.js';
import { rangeModeOn } from '../data-table-range.js';

export class PastePart<T> {
    constructor(protected readonly host: DataTableCoreHost<T>) {}

    attach(): void {}

    detach(): void {}

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
        if (!plan || plan.requests.length === 0) return { status: 'ignored' }; // nothing can be written there (no setter, no row): no event (spec B.2)
        const span = plan.rect ? [plan.rect.startRow, plan.rect.endRow] as const : null;
        const before = span ? rowIdsAt(host, span[0], span[1]) : [];
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
        // The write re-sorted or re-filtered the pasted rows (the column pasted into is the sort or filter key): the rectangle would now cover other
        // rows, so no range is left at all.
        // Otherwise the range becomes the pasted rectangle (D3b), and a single pasted cell is plain focus: no range (a range the paste started from goes).
        const moved = span !== null && rowIdsAt(host, span[0], span[1]).some((id, i) => id !== before[i]);
        const multi = rect !== null && (rect.endRow > rect.startRow || rect.endCol !== rect.startCol);
        if (rangeModeOn(host.config)) host.provider('range')?.setRange(!moved && multi ? rect : null);
        host.announce(pasteAnnouncement(host.resolvedLocale, detail.cellsApplied, detail.cellsRejected));
        return { status: 'done', cells: detail.cellsApplied, rejected: detail.cellsRejected };
    }
}
