/** Row grouping (`group-by`): partition, display list with collapsible headers, rendered-index numbering. Pure. */
import type { ColumnDef, DataTableDisplayRow, GroupRow } from './data-table.types.js';
import { computeAggregateValue, getCellValue } from './data-table.utils.js';

export interface RowGroup<T> {
    readonly groupKey: string;
    readonly groupValue: unknown;
    readonly rows: T[];
}

/**
 * Grouping drives rendering only when a `groupBy` column is set and neither tree mode nor virtual scroll is active
 * (the three are mutually exclusive; a virtual list draws rows, not headers).
 */
export function isGroupingActive(groupBy: string | null | undefined, subRows: boolean, virtualActive: boolean): boolean {
    return !!groupBy && !subRows && !virtualActive;
}

/** Partitions rows into insertion-ordered groups keyed by the stringified group value. */
export function partitionIntoGroups<T>(rows: readonly T[], getGroupValue: (row: T) => unknown): RowGroup<T>[] {
    const groups = new Map<string, { groupValue: unknown; rows: T[] }>();
    for (const row of rows) {
        const groupValue = getGroupValue(row);
        const groupKey = String(groupValue);
        const existing = groups.get(groupKey);
        if (existing) existing.rows.push(row);
        else groups.set(groupKey, { groupValue, rows: [row] });
    }
    return Array.from(groups, ([groupKey, value]) => ({ groupKey, groupValue: value.groupValue, rows: value.rows }));
}

/**
 * Numbers the data rows of a display list from 0, leaving group headers unnumbered. A page slice keeps the index its
 * rows had before paging, so this restarts the count to match the rows the page actually draws.
 */
export function renumberDataRows<T>(rows: readonly DataTableDisplayRow<T>[]): DataTableDisplayRow<T>[] {
    let index = 0;
    return rows.map((row) => (row.kind === 'group' ? row : { ...row, index: index++ }));
}

/** Per-column aggregate strings for one group, in column order. Empty unless `withAggregates`. */
export function groupAggregates<T>(rows: readonly T[], columns: readonly ColumnDef<T>[], withAggregates: boolean): Map<string, string> {
    const out = new Map<string, string>();
    if (!withAggregates) return out;
    for (const col of columns) {
        if (!col.aggregateFn) continue;
        const values = rows.map((row) => getCellValue(row, col.accessorKey, col));
        out.set(String(col.accessorKey), computeAggregateValue(values, col.aggregateFn));
    }
    return out;
}

/**
 * The flat display list: a header per group followed by its rows unless collapsed. Data rows carry their running
 * rendered index (headers excluded; collapsed groups' rows are skipped).
 */
export function buildGroupedDisplayRows<T>(
    groups: readonly RowGroup<T>[],
    collapsed: Readonly<Record<string, boolean>>,
    columns: readonly ColumnDef<T>[],
    withAggregates: boolean,
): DataTableDisplayRow<T>[] {
    const result: DataTableDisplayRow<T>[] = [];
    let index = 0;
    for (const group of groups) {
        // The keys come from data, so only an own property counts (a group named `constructor` is not collapsed).
        const isCollapsed = Object.hasOwn(collapsed, group.groupKey) && collapsed[group.groupKey] === true;
        const header: GroupRow = {
            kind: 'group',
            groupKey: group.groupKey,
            groupValue: group.groupValue,
            count: group.rows.length,
            aggregates: groupAggregates(group.rows, columns, withAggregates),
            collapsed: isCollapsed,
        };
        result.push(header);
        if (isCollapsed) continue;
        for (const row of group.rows) result.push({ kind: 'data', row, index: index++ });
    }
    return result;
}

/** The data rows of a display list, in drawn order. */
export function dataRowsOf<T>(rows: readonly DataTableDisplayRow<T>[]): T[] {
    return rows.flatMap((r) => (r.kind === 'data' ? [r.row] : []));
}
