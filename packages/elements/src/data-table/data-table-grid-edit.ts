/**
 * The cell editor's markup (wave 5, package B owns this file). `GridView.edit.cell` is called from the body cell for every data cell;
 * `aria-invalid` and `aria-describedby` are set on the editor's own input here. Joint step 0: no editor is ever drawn.
 */
import type { DataTableViewHost } from './data-table-view.js';
import type { EnhancedColumnDef } from './data-table.types.js';

export interface EditView<T> {
    /** The editor to draw in place of the cell's content, or `undefined` when this cell is not being edited. */
    cell(column: EnhancedColumnDef<T>, row: T, rowIndex: number): unknown | undefined;
}

export function editView<T>(_host: DataTableViewHost<T>): EditView<T> {
    return { cell: () => undefined };
}
