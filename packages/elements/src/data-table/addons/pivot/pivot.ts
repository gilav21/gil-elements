/**
 * The pivot addon (Angular `uiDtPivot`): `table.addon<PivotApi>('pivot')?.getPivot(config)` pivots the table's raw `data` (filters ignored, as in
 * Angular) through its accessors, so `accessorFn` and dotted keys work (Angular promises the former but passes no column, so its `accessorFn` is
 * never called). No UI and no override of the table: bind the result to another table.
 */
import type { DataTableAddon } from '../../data-table-addon-kit.js';
import { computePivot, type PivotConfig, type PivotResult } from './pivot-utils.js';

export interface PivotApi<T = unknown> {
    /** The pivot of the table's raw `data` (in a tree table every node, children included), or of `rows` when given. */
    getPivot(config: PivotConfig, rows?: readonly T[]): PivotResult;
}

/** The pivot addon, id `pivot`. */
export const pivotAddon: DataTableAddon = {
    id: 'pivot',
    setup(host, setting) {
        if (setting === false) return;
        host.expose<PivotApi>({
            getPivot(config, rows) {
                const query = host.provider('query');
                if (!query) return computePivot(rows ?? [], config);
                // Every data column by key (hidden ones too), so a key that names a column reads through its `accessorFn`; any other key is a field or a dotted path.
                const columns = new Map(query.exportColumns({ onlyVisible: false }).map((column) => [String(column.accessorKey), column]));
                const tree = rows ? [] : query.flatTree({ unfiltered: true }); // a tree table: every node, children included
                const source = rows ?? (tree.length > 0 ? tree : query.rawRows());
                return computePivot(source, config, (row, key) => query.cellValue(row, key, columns.get(key)));
            },
        });
    },
};
