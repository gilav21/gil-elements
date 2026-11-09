import type { CellRendering } from './data-table.types.js';

export type CellKind = 'tag' | 'renderer' | 'text';

/** How a cell is drawn, by precedence: a custom-element tag, a `cellRenderer`, else text (`cell` or the raw value). */
export function resolveCellKind<T>(column: Pick<CellRendering<T>, 'component' | 'cellRenderer'>): CellKind {
    if (typeof column.component === 'string' && column.component !== '') return 'tag';
    return column.cellRenderer ? 'renderer' : 'text';
}
