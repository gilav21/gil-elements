/**
 * Column layout as a pure function: which columns draw, in which order, how wide, and where the pinned ones stick.
 *
 * Angular orders by definition and gives every `sticky` column a running `left` offset, so a pinned column in the
 * middle of the list stacks wrongly. Here the result is ordered pinned-left, middle, pinned-right (each group in
 * its own order), so DOM order is visual order and `aria-colindex` is position + 1. `left` and `right` mean inline-start
 * and inline-end. Offsets are `calc()` sums of CSS lengths, not parsed integers, so `10rem` and `20%` stack correctly.
 */
import { ownElements } from './data-table-host.js';
import type { ColumnDef, EnhancedColumnDef } from './data-table.types.js';
import { isSpecialColumnKey } from './data-table.utils.js';
import { indexColumns } from './data-table-query.js';
import { applyKeyOrder } from './data-table-view-state.js';
import { parsePx, resolveColumnMinWidth } from './data-table-virtual.js';

type Pin = 'left' | 'right' | undefined;

/** A pinned column with no width of its own gets this (Angular: 150). */
export const DEFAULT_PINNED_WIDTH = '150px';

export interface ColumnLayoutInput<T> {
    columns: readonly ColumnDef<T>[];
    widths: Readonly<Record<string, string>>;
    visibility: Readonly<Record<string, boolean>>;
    order: readonly string[];
    /** An own entry (even `undefined`) overrides the column's `pin`. */
    pins: Readonly<Record<string, Pin>>;
    enableRowSelection: boolean;
    enableRowExpansion: boolean;
    /** A column of row-action buttons (addons contribute them). */
    hasActions: boolean;
    /** How many buttons each row draws there (default 1), and their size in px (default 32; 44 under a coarse pointer): the auto column fits them. */
    actionSlots?: number;
    actionButtonPx?: number;
}

export interface ColumnLayout<T> {
    /** Drawn order: pinned-left, middle, pinned-right. */
    columns: EnhancedColumnDef<T>[];
    /** True when some column is auto width, so the row fills the viewport without a filler cell. */
    hasFlexible: boolean;
}

const own = <V>(record: Readonly<Record<string, V>>, key: string): V | undefined => (Object.hasOwn(record, key) ? record[key] : undefined);

function withSpecialColumns<T>(visible: ColumnDef<T>[], i: ColumnLayoutInput<T>): ColumnDef<T>[] {
    const result = [...visible];
    // A column the consumer defined itself (`columnHelper().select()`) is the special column: a second one would draw it twice.
    const supplied = (key: string): boolean => i.columns.some((c) => c.accessorKey === key); // hidden ones too: hiding it hides the control
    if (i.enableRowSelection && !supplied('_selection')) result.unshift({ accessorKey: '_selection', header: '', pin: 'left', width: '40px', enableSorting: false });
    if (i.enableRowExpansion && !supplied('_expander')) result.unshift({ accessorKey: '_expander', header: '', pin: 'left', width: 'var(--ge-dt-expander-w, 40px)', enableSorting: false });
    // Width: each button at its drawn size (2rem, 2.75rem under a coarse pointer) plus the cell's padding (2 x 0.5rem), never under Angular's 50px.
    if (i.hasActions && !supplied('_actions')) result.push({ accessorKey: '_actions', header: '', width: `${Math.max(50, (i.actionSlots ?? 1) * (i.actionButtonPx ?? 32) + 16)}px`, enableSorting: false, enableHiding: false, enableReordering: false });
    return result;
}

/** `calc()` sum of the widths in `terms`, `0px` for none. */
const sum = (terms: readonly string[]): string => (terms.length === 0 ? '0px' : `calc(${terms.join(' + ')})`);

export function computeColumnLayout<T>(i: ColumnLayoutInput<T>): ColumnLayout<T> {
    const visible = i.columns.filter((c) => own(i.visibility, String(c.accessorKey)) !== false);
    // First wins, as in the query code (indexColumns): the column that is drawn is the one that is sorted and filtered.
    const byKey = indexColumns(visible);
    const ordered = applyKeyOrder([...byKey.keys()], i.order).flatMap((key) => byKey.get(key) ?? []);
    const all = withSpecialColumns(ordered, i);

    const pinOf = (c: ColumnDef<T>): Pin => {
        const key = String(c.accessorKey);
        return Object.hasOwn(i.pins, key) ? i.pins[key] : c.pin;
    };
    const widthOf = (c: ColumnDef<T>, pin: Pin): string => own(i.widths, String(c.accessorKey)) ?? c.width ?? (pin ? DEFAULT_PINNED_WIDTH : 'auto');

    const left = all.filter((c) => pinOf(c) === 'left');
    const right = all.filter((c) => pinOf(c) === 'right');
    const middle = all.filter((c) => pinOf(c) !== 'left' && pinOf(c) !== 'right');

    const build = (c: ColumnDef<T>, pin: Pin, pinOffset?: string): EnhancedColumnDef<T> => ({
        ...c,
        ...(pin ? { _pin: pin, _pinOffset: pinOffset } : {}),
        _width: widthOf(c, pin),
        _minWidth: resolveColumnMinWidth(c),
    });

    const columns: EnhancedColumnDef<T>[] = [];
    const before: string[] = [];
    for (const c of left) {
        columns.push(build(c, 'left', sum(before)));
        before.push(widthOf(c, 'left'));
    }
    for (const c of middle) columns.push(build(c, undefined));
    const after: string[] = [];
    const rightColumns: EnhancedColumnDef<T>[] = [];
    for (const c of [...right].reverse()) {
        rightColumns.unshift(build(c, 'right', sum(after)));
        after.push(widthOf(c, 'right'));
    }
    columns.push(...rightColumns);
    return { columns, hasFlexible: columns.some((c) => c._width === 'auto') };
}

/**
 * The inline custom properties of `[data-slot=table]`: `--ge-dt-col-N` (width), `--ge-dt-colmin-N` (floor) and
 * `--ge-dt-pin-N` (pin offset) for column N, so one write moves header, body and footer together.
 */
export function columnCssVars<T>(columns: readonly EnhancedColumnDef<T>[]): string {
    return columns
        .map((c, n) => {
            const pin = c._pinOffset === undefined ? '' : `--ge-dt-pin-${n}:${c._pinOffset};`;
            return `--ge-dt-col-${n}:${c._width === 'auto' ? '0px' : c._width};--ge-dt-colmin-${n}:${c._minWidth};${pin}`;
        })
        .join('');
}

/** The inline style of one head, body or footer cell of column `n`: it points at the table's variables. */
export function cellVarsStyle<T>(column: EnhancedColumnDef<T>, n: number): string {
    return `--ge-dt-w:var(--ge-dt-col-${n});--ge-dt-min:var(--ge-dt-colmin-${n});${column._pinOffset === undefined ? '' : `--ge-dt-pin:var(--ge-dt-pin-${n})`}`;
}

/** The accessor keys that more than one column uses, in first-seen order. */
export function duplicateColumnKeys<T>(columns: readonly ColumnDef<T>[]): string[] {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const c of columns) {
        const key = String(c.accessorKey);
        if (seen.has(key)) dupes.add(key);
        seen.add(key);
    }
    return [...dupes];
}

/** Special columns draw their own content (checkbox, expander, actions) and are never data. */
export const isSpecialColumn = <T>(column: ColumnDef<T>): boolean => isSpecialColumnKey(column.accessorKey);

/** Whether a header can be dragged or moved: a data column that did not opt out. */
export const isReorderable = <T>(column: ColumnDef<T>): boolean => !isSpecialColumn(column) && column.enableReordering !== false;

/** The visible reorderable keys that share `key`'s pin group, in drawn order; null when `key` cannot move. */
export function pinGroupOf<T>(columns: readonly EnhancedColumnDef<T>[], key: string): string[] | null {
    const source = columns.find((c) => String(c.accessorKey) === key);
    if (!source || !isReorderable(source)) return null;
    return columns.filter((c) => isReorderable(c) && c._pin === source._pin).map((c) => String(c.accessorKey));
}

/** The width in px of a `<n>px` string, else null (`auto`, `rem`, `%` and `calc()` are not known without layout). */
export function pxOf(width: string): number | null {
    const px = parsePx(width);
    return px !== null && px >= 0 ? px : null;
}

export const HEAD_SELECTOR = '[data-slot="table-head"]';

/** The head cell and the rendered body cells of column `key` (footer cells carry no column attribute). */
export function columnCells(root: Element, key: string): HTMLElement[] {
    const name = CSS.escape(key);
    return ownElements(root, root.querySelectorAll<HTMLElement>(`${HEAD_SELECTOR}[data-column-id="${name}"], [data-slot="table-cell"][data-column="${name}"]`));
}
