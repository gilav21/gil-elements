/**
 * The header's filter trigger and the floating filter row (wave 5, package A owns this file). `GridView.filters` is called from
 * `headContent` (after the sort control) and from `renderGrid` (the second row of the header rowgroup). Joint step 0: both draw
 * nothing and the row count is zero, so the grid is unchanged.
 */
import { nothing } from 'lit';
import type { DataTableViewHost } from './data-table-view.js';
import type { EnhancedColumnDef } from './data-table.types.js';

export interface FiltersView<T> {
    /** The filter trigger of a data column's header, drawn after its sort control; `nothing` for none. */
    trigger(column: EnhancedColumnDef<T>): unknown;
    /** The floating filter row (`div[table-row][data-kind=filter][role=row]`), the second row of the header rowgroup; `nothing` for none. */
    row(): unknown;
    /** Header rows drawn above the data: 0 or 1 here, so `headerRows` is `1 + rows` and the first data row is `aria-rowindex` `2 + rows`. */
    rows: number;
}

/** The step 0 view: no trigger, no floating row. A constant (wave 5 A replaces the function, not this), so a render allocates no view. */
const NO_FILTERS: FiltersView<unknown> = Object.freeze({ trigger: () => nothing, row: () => nothing, rows: 0 });

export function filtersView<T>(_host: DataTableViewHost<T>): FiltersView<T> {
    return NO_FILTERS as FiltersView<T>;
}
