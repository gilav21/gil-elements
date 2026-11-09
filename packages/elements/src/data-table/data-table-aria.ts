/**
 * Grid ARIA as a pure model the renderer reads while rendering, instead of Angular's post-render DOM stamping.
 *
 * Rules carried over from Angular and its grid-semantics spec:
 * - The header row is row 1, so data starts at 2. Decorative spacer rows and filler cells (`aria-hidden` /
 *   `role="presentation"`) are not counted: the caller numbers only the rows and cells it renders as real ones.
 * - `aria-rowcount` is the dataset's, not the rendered window's; a data row's index is absolute
 *   (`headerRows + windowStart + ordinal + 1`).
 * - When the middle columns are windowed, `aria-colindex` is left off (a gap is better than a wrong index), while
 *   `aria-colcount` is still published.
 * - The role is `treegrid` in tree mode, `grid` otherwise. Only tree rows carry `aria-level` / `aria-expanded`,
 *   and group rows `aria-expanded`. Nothing else is stamped: no `aria-selected`, no `aria-multiselectable`.
 */
export interface GridAriaInput {
    /** Tree mode (`enable-sub-rows`). */
    tree: boolean;
    /** Non-decorative header rows (the column header row, plus the floating-filter row if it is a real row). */
    headerRows: number;
    /** Data rows of the whole dataset under virtual scroll; otherwise the rows rendered. */
    totalDataRows: number;
    /** All columns, windowed or not (`aria-colcount`). */
    columnCount: number;
    /** Absolute index of the first rendered data row under virtual scroll; 0 otherwise. */
    firstRenderedRow?: number;
    /** True when the middle columns are windowed (fewer rendered than exist). */
    columnsWindowed?: boolean;
}

export interface GridAria {
    role: 'grid' | 'treegrid';
    rowCount: number;
    colCount: number;
    /** `aria-rowindex` of the header row at zero-based position `position`. */
    headerRowIndex(position: number): number;
    /** `aria-rowindex` of the data row at zero-based ordinal `ordinal` among the rendered data rows. */
    dataRowIndex(ordinal: number): number;
    /** `aria-colindex` of the cell at zero-based position among the real cells of a row, or `null` to leave it off. */
    colIndex(position: number): number | null;
}

const count = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function computeGridAria(input: GridAriaInput): GridAria {
    const headerRows = count(input.headerRows);
    const offset = count(input.firstRenderedRow ?? 0);
    return {
        role: input.tree ? 'treegrid' : 'grid',
        rowCount: headerRows + count(input.totalDataRows),
        colCount: count(input.columnCount),
        headerRowIndex: (position) => position + 1,
        dataRowIndex: (ordinal) => headerRows + offset + ordinal + 1,
        colIndex: (position) => (input.columnsWindowed ? null : position + 1),
    };
}

/** `aria-level` and `aria-expanded` of a tree row; a leaf has no `aria-expanded`. */
export function treeRowAria(row: { depth: number; isLeaf: boolean; isExpanded: boolean }): { level: number; expanded: boolean | null } {
    return { level: row.depth + 1, expanded: row.isLeaf ? null : row.isExpanded };
}

/** `aria-expanded` of a group header row. */
export function groupRowExpanded(group: { collapsed: boolean }): boolean {
    return !group.collapsed;
}
