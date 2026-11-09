/** Value-aware cell formatting and the footer's values, as pure functions over a column and a row. */
import { type DataTableLocale, interpolate } from './data-table.locales.js';
import type { BodyView } from './data-table-grid.js';
import type { ColumnDef, ColorScale, ResolvedCellFormatting, SortDirection } from './data-table.types.js';
import { computeAggregateValue, getCellValue, stringifyValue } from './data-table.utils.js';

const hasFormatting = <T>(c: ColumnDef<T>): boolean =>
    c.cellClassRules !== undefined || c.cellStyleRules !== undefined || c.colorScale !== undefined || c.dataBar !== undefined || c.iconSet !== undefined;

/** A number, or a string that starts with one (Angular's `parseFloat`); `null` for anything else. */
function toFinite(value: unknown): number | null {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN;
    return Number.isFinite(n) ? n : null;
}

/** Where `value` sits in `[min, max]`, 0 to 100; a collapsed range is 0. */
export function positionPercent(value: number, min: number, max: number): number {
    return max === min ? 0 : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

const colorScaleBackground = (scale: ColorScale, value: unknown): string | null => {
    const n = toFinite(value);
    return n === null ? null : `color-mix(in srgb, ${scale.to} ${positionPercent(n, scale.min, scale.max)}%, ${scale.from})`;
};

/** The formatting of one cell, or `null` when its column declares none (an unformatted cell renders as plain text). */
export function resolveCellFormatting<T>(column: ColumnDef<T>, row: T): ResolvedCellFormatting | null {
    if (!hasFormatting(column)) return null;
    const value = getCellValue(row, column.accessorKey, column);
    const style = { ...column.cellStyleRules?.(value, row) };
    const background = column.colorScale ? colorScaleBackground(column.colorScale, value) : null;
    if (background) style['background-color'] = background;
    const n = column.dataBar ? toFinite(value) : null;
    return {
        class: (column.cellClassRules ?? []).filter((rule) => rule.when(value, row)).map((rule) => rule.class).join(' '),
        style,
        dataBar: column.dataBar && n !== null ? { width: `${positionPercent(n, column.dataBar.min, column.dataBar.max)}%`, color: column.dataBar.color, track: column.dataBar.track ?? null } : null,
        icon: column.iconSet?.(value, row) ?? null,
    };
}

/** A style object as an inline `style` string; custom properties and `color-mix()` values pass through. */
export function styleText(style: Readonly<Record<string, string>>): string {
    return Object.entries(style)
        .map(([name, value]) => `${name}:${value}`)
        .join(';');
}

/** The accessible name of a sort button: the current state, the sort priority in a multi-sort chain, and what activating does. */
export function sortAriaLabel(title: string, direction: SortDirection, index: number | null, locale: DataTableLocale): string {
    const priority = index === null ? '' : interpolate(locale.sortPriority, { index: index + 1 });
    const template = direction === 'asc' ? locale.sortStateAscending : direction === 'desc' ? locale.sortStateDescending : locale.sortStateNone;
    return interpolate(template, { title, priority });
}

/** The text a cell shows: the column's `cell` formatter, else the raw value stringified. */
export function cellText<T>(column: ColumnDef<T>, row: T): string {
    return column.cell ? column.cell(row) : stringifyValue(getCellValue(row, column.accessorKey, column));
}

/** Whether the footer row draws: forced by `show-footer`, else (auto) when some column has a footer or an aggregate. */
export function hasFooterRow<T>(mode: boolean | 'auto', columns: readonly ColumnDef<T>[]): boolean {
    if (mode !== 'auto') return mode;
    return columns.some((c) => c.footer || c.aggregateFn || c.footerRenderer || c.footerComponent);
}

/** Footer text per column key: the column's `footer` (text or a function of the rows), else its aggregate. */
export function footerValues<T>(columns: readonly ColumnDef<T>[], rows: readonly T[]): Map<string, string> {
    const values = new Map<string, string>();
    for (const c of columns) {
        const key = String(c.accessorKey);
        if (c.footer) values.set(key, typeof c.footer === 'function' ? c.footer([...rows]) : c.footer);
        else if (c.aggregateFn) values.set(key, computeAggregateValue(rows.map((row) => getCellValue(row, c.accessorKey, c)), c.aggregateFn));
    }
    return values;
}

/** The data row an item stands for, or `undefined` for a group header, detail or other non-data row. */
export function dataRowOf<T>(item: BodyView<T>['items'][number]): T | undefined {
    return 'kind' in item ? (item.kind === 'data' ? item.row : undefined) : item.row;
}
