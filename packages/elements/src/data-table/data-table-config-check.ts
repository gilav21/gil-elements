/**
 * Development diagnostics: conflicting or ineffective option combinations, as plain messages. The caller decides
 * whether and how to print them (dev builds only, once per change).
 */
import type { ColumnDef } from './data-table.types.js';
import { defaultGetRowId, findDuplicateRowIds } from './data-table.utils.js';

export interface ConfigCheckInput<T> {
    columns: readonly ColumnDef<T>[];
    data?: readonly T[];
    /** Unset, or the default, counts as "no custom row id". */
    getRowId?: ((row: T) => string) | null;
    localPagination: boolean;
    showPagination: boolean;
    enableVirtualScroll: boolean | 'auto';
    /** The resolved decision (see `isVirtualScrollActive`). */
    virtualActive: boolean;
    /** Unset (`undefined`) is how a server-paginated table that forgot it looks. */
    total: number | undefined;
    virtualVariableRowHeight?: boolean;
    virtualRecycleComponents?: boolean;
    enableSubRows?: boolean;
    enableRowExpansion?: boolean;
    groupBy?: string | null;
    enableCellFlash?: boolean;
    enableFloatingFilters?: boolean;
    enableRowSelection?: boolean;
    enableRowDrag?: boolean;
    /** Undo/redo of edits; they find a row again by its id. */
    enableEditHistory?: boolean;
    /** Wave 6 checks: fill and paste write through value setters. */
    enableFillHandle?: boolean;
    enableClipboardPaste?: boolean;
    /**
     * Row drag with local reorder is on AND the table draws its own order: a sort it applies itself (`sortReordersRows`) or
     * grouping in force (`isGroupingActive`). Resolved by the diagnostics snapshot; false otherwise.
     */
    rowDragOrderOverridden?: boolean;
}

/** Whether `validateConfig` scans the row ids for duplicates (so the diagnostics need not scan them again). */
export function scansRowIds<T>(c: ConfigCheckInput<T>): boolean {
    const needsIdentity = c.enableRowSelection || c.enableRowDrag || c.enableCellFlash || c.enableSubRows || c.columns.some((col) => col.editable);
    return !!needsIdentity && !!c.data && c.data.length > 1;
}

const PREFIX = '[ge-data-table]';
const keys = <T>(cols: readonly ColumnDef<T>[]): string => cols.map((c) => String(c.accessorKey)).join(', ');

/** Returns one message per misconfiguration found; empty when the configuration is fine. */
export function validateConfig<T>(c: ConfigCheckInput<T>): string[] {
    const warnings: string[] = [];
    const warn = (cond: unknown, message: string): void => {
        if (cond) warnings.push(`${PREFIX} ${message}`);
    };
    const customId = !!c.getRowId && c.getRowId !== (defaultGetRowId as unknown);
    // The default id is `row.id` when every row has one, so that data needs no custom getRowId.
    const stableIds = customId || (!!c.data?.length && c.data.every((row) => typeof row === 'object' && row !== null && (row as { id?: unknown }).id != null));
    const dataLength = c.data?.length ?? 0;

    warn(
        c.localPagination && c.showPagination && c.enableVirtualScroll === true,
        'Both pagination and enable-virtual-scroll are enabled. They are mutually exclusive: virtual scroll is used and the pagination controls have no effect.',
    );
    warn(
        !c.localPagination && c.showPagination && !c.virtualActive && !c.total && dataLength > 0,
        'Using server-side pagination (local-pagination=false) without providing a total. Pagination may not work correctly.',
    );
    warn(c.virtualVariableRowHeight && !c.virtualActive, 'virtual-variable-row-height is enabled but virtual scroll is not active. This option has no effect.');
    warn(c.virtualRecycleComponents && !c.virtualActive, 'virtual-recycle-components is enabled but virtual scroll is not active. This option has no effect.');
    warn(
        c.enableVirtualScroll === 'auto' && c.localPagination && c.showPagination,
        'enable-virtual-scroll="auto" has no effect while pagination is active. Hide the pager or use server pagination for virtual scroll to auto-activate.',
    );
    warn(
        c.enableSubRows && c.enableRowExpansion,
        'Both enable-sub-rows and enable-row-expansion are enabled. This creates two separate expander controls per row (tree toggle and detail panel); disable one if that is unintentional.',
    );
    warn(c.groupBy && (c.enableSubRows || c.virtualActive), 'group-by is set together with enable-sub-rows or virtual scroll. Row grouping is mutually exclusive with these and is ignored.');
    warn(
        c.enableSubRows && !stableIds,
        'enable-sub-rows is active without a custom getRowId and rows without an `id`. The default id is an object identity, which does not survive replacing rows; provide a stable unique id.',
    );
    warn(
        c.enableEditHistory && !stableIds && c.columns.some((col) => col.editable && col.valueSetter),
        'enable-edit-history is active on editable columns without a custom getRowId and rows without an `id`. A value setter returns a new row object, so the object-identity id no longer resolves and undo/redo cannot find the row; provide a stable unique id.',
    );
    warn(c.enableCellFlash && !stableIds, 'enable-cell-flash is active without a custom getRowId and rows without an `id`. Flash detection needs stable row ids across data updates.');
    warn(
        c.enableFloatingFilters && !c.columns.some((col) => col.enableFiltering),
        'enable-floating-filters is true but no column has enableFiltering set. The floating filter row will be empty.',
    );

    // ---- wave 5 (filters and editing): package A and B add their `warn(...)` calls here, each in its own marked block -------------------
    // ---- wave 6 (spreadsheet and drag): packages A, B and C add theirs here, each in its own marked block -----------------------------
    // The flash + default getRowId warning is above.
    warn(
        (c.enableFillHandle || c.enableClipboardPaste) && !c.columns.some((col) => col.valueSetter),
        'enable-fill-handle or enable-clipboard-paste is on but no column has a valueSetter. Fill and paste write cells through value setters, so nothing will be written.',
    );
    warn(
        c.rowDragOrderOverridden,
        'enable-row-drag with local-reorder is on while a sort or group-by decides the drawn order. A drop reorders `data`, but the table keeps drawing its sorted or grouped order, so the row does not appear to move; clear the sort and grouping while dragging, or turn local-reorder off and reorder yourself.',
    );

    const noSetter = c.columns.filter((col) => col.editable && !col.valueSetter);
    warn(
        noSetter.length > 0,
        `Columns [${keys(noSetter)}] are editable but have no valueSetter. Edits will emit cell-edit only and will not update the data; provide a valueSetter or handle cell-edit yourself.`,
    );

    const seen = new Set<string>();
    const duplicateKeys = new Set<string>();
    for (const col of c.columns) {
        const key = String(col.accessorKey);
        if (key === 'undefined') continue;
        if (seen.has(key)) duplicateKeys.add(key);
        seen.add(key);
    }
    warn(
        duplicateKeys.size > 0,
        `Duplicate accessorKey values found: [${[...duplicateKeys].join(', ')}]. Each column needs a unique accessorKey; duplicates break sorting, visibility and width tracking.`,
    );

    const multiple = c.columns.filter((col) => [col.component, col.cellRenderer, col.cell].filter(Boolean).length > 1);
    warn(
        multiple.length > 0,
        `Columns [${keys(multiple)}] have more than one rendering strategy (component, cellRenderer, cell). Only one is used (component, then cellRenderer, then cell); remove the unused ones.`,
    );

    if (scansRowIds(c) && c.data) {
        const getId = (c.getRowId ?? defaultGetRowId) as (row: T) => string;
        const dupes = findDuplicateRowIds(c.data, getId);
        warn(
            dupes.length > 0,
            `${dupes.length} row id(s) are shared by more than one row (e.g. ${dupes.slice(0, 3).map((d) => JSON.stringify(d)).join(', ')}). Selection, editing, flash and drag act on all of them; provide a unique getRowId.`,
        );
    }
    return warnings;
}
