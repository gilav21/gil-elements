import { type ConfigCheckInput, validateConfig } from './data-table-config-check.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { findDuplicateRowIds } from './data-table.utils.js';

const VIEWPORT = '[data-slot="data-table-viewport"]';

/** The settings the checks read, compared by value so an unrelated render re-runs nothing (the duplicate-id scan is O(rows)). */
type Snapshot = Record<string, unknown>;

const sameSnapshot = (a: Snapshot | null, b: Snapshot): boolean => a !== null && Object.keys(b).every((key) => Object.is(a[key], b[key]));

/**
 * Development warnings about options that conflict or do nothing, and about a table that cannot work as set up (virtual
 * scroll in a box with no height). One `console.warn` per message per element, printed when the setting that causes it
 * changes, never per render.
 */
export class DiagnosticsController<T> {
    private readonly printed = new Set<string>();
    private last: Snapshot | null = null;
    private viewportChecked = false;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    attach(): void {
        this.printed.clear();
        this.last = null;
        this.viewportChecked = false;
    }

    detach(): void {
        this.last = null;
    }

    hostUpdate(): void {
        const { config, model } = this.host;
        const virtualActive = this.host.provider('virtual')?.active() ?? false;
        const snapshot: Snapshot = {
            columns: config.columns,
            data: model.get('data'),
            getRowId: config.getRowId,
            localPagination: config.localPagination,
            showPagination: config.showPagination,
            enableVirtualScroll: config.enableVirtualScroll,
            virtualActive,
            total: config.total,
            virtualVariableRowHeight: config.virtualVariableRowHeight,
            virtualRecycleComponents: config.virtualRecycleComponents,
            enableSubRows: config.enableSubRows,
            enableRowExpansion: config.enableRowExpansion,
            groupBy: config.groupBy,
            enableCellFlash: config.enableCellFlash,
            enableFloatingFilters: config.enableFloatingFilters,
            enableRowSelection: config.enableRowSelection,
            enableRowDrag: config.enableRowDrag,
            enableEditHistory: config.enableEditHistory,
            // Only what a check reads is here: each re-run costs the O(rows) id scan.
            enableFillHandle: config.enableFillHandle,
            enableClipboardPaste: config.enableClipboardPaste,
        };
        // The row-drag checks read these; outside row drag a sort change must not re-run the checks.
        if (config.enableRowDrag) {
            snapshot.localReorder = config.localReorder;
            if (config.localReorder) {
                const sort = model.get('sortState');
                snapshot.sortActive = !!sort?.direction || model.get('multiSortState').length > 0;
            }
        }
        if (!sameSnapshot(this.last, snapshot)) {
            this.last = snapshot;
            this.check(snapshot as unknown as ConfigCheckInput<T>);
        }
        if (virtualActive && !this.viewportChecked) {
            this.viewportChecked = true;
            // After the render that draws the scroller, so its box has a size to read.
            this.host.afterRender(() => this.checkViewport());
        } else if (!virtualActive) this.viewportChecked = false;
    }

    private warn(message: string): void {
        if (this.printed.has(message)) return;
        this.printed.add(message);
        console.warn(message);
    }

    private check(input: ConfigCheckInput<T>): void {
        // The columns controller prints the duplicate-key message itself, where the columns are resolved.
        const warnings = validateConfig(input).filter((m) => !m.includes('Duplicate accessorKey'));
        for (const message of warnings) this.warn(message);
        const { data, getRowId, enableRowExpansion, virtualActive, virtualVariableRowHeight } = input;
        if (virtualActive && enableRowExpansion && !virtualVariableRowHeight) {
            this.warn('[ge-data-table] enable-row-expansion with virtual scroll: a detail row has no fixed height, so row heights are measured (as with virtual-variable-row-height) and the window uses them.');
        }
        // `validateConfig` already reports shared ids for the features that act on them; rows are KEYED by id either way.
        if (data && data.length > 1 && !warnings.some((m) => m.includes('row id(s) are shared'))) {
            const dupes = findDuplicateRowIds(data, (getRowId ?? this.host.config.getRowId) as (row: T) => string);
            if (dupes.length > 0) {
                this.warn(`[ge-data-table] ${dupes.length} row id(s) are shared by more than one row (e.g. ${dupes.slice(0, 3).map((d) => JSON.stringify(d)).join(', ')}). Rows are keyed by id, so rows sharing one are drawn and updated wrongly; provide a unique getRowId.`);
            }
        }
    }

    /** Virtual scroll needs a bounded height: with none the scroller is 0px tall and only the buffer rows are drawn. */
    private checkViewport(): void {
        const viewport = this.host.root.querySelector<HTMLElement>(VIEWPORT);
        if (viewport && viewport.clientHeight === 0) {
            this.warn('[ge-data-table] virtual scroll is active but the table has no height (its scroller is 0px tall), so only the buffer rows are drawn. Give the table or its container a fixed height, for example style="height: 400px".');
        }
    }
}
