/**
 * The fill planner (wave 6, package A): which cells a fill writes and what it reports. Pure; the range part runs the plan through ONE
 * `runAsCommand(() => host.writeCells(requests))`, so a fill is one undo step and one `data-change`, and every target row is resolved before the
 * first write (Angular resolves `processedData()[row]` after each write, so filling the column the table is sorted by writes later values onto moved
 * rows: candidate bug AB3). Parity with cmp `fillDownTo` otherwise: downward only, per data column of the source that has a `valueSetter`,
 * `buildFillValues` per column, rows past the last drawn one skipped, `fill-series` once when at least one cell was written.
 */
import type { CellWriteRequest, CellWriteResult } from './data-table-cell-write.js';
import type { NormalizedRange } from './data-table-range.js';
import type { CellRange, ColumnDef, FillSeriesEvent } from './data-table.types.js';

export interface FillInput<T> {
    /** The source rectangle: the range, or the focused cell as 1x1. */
    source: NormalizedRange;
    /** The last row to fill (a drawn index); a target past the last drawn row is clamped to it. */
    target: number;
    /** The navigable column keys the source's column indexes refer to. */
    keys: readonly string[];
    rowCount: number;
    rowAt(rowIndex: number): T | undefined;
    column(key: string): ColumnDef<T> | undefined;
    value(row: T, column: ColumnDef<T>): unknown;
    /** The values for `count` rows after `source` (one column): `buildFillValues` for a drag, a plain repeat of the first value for Ctrl+D. */
    series(source: readonly unknown[], count: number): unknown[];
}

export interface FillPlan {
    readonly source: NormalizedRange;
    /** The last row filled (clamped to the drawn rows). */
    readonly target: number;
    /** Every column key of the source, in order (the range after the fill spans them). */
    readonly keys: readonly string[];
    readonly requests: readonly CellWriteRequest[];
}

/** The cells to write; null when there is nothing to fill (the target is not below the source, or no row below it is drawn). */
export function planFill<T>(input: FillInput<T>): FillPlan | null {
    const { source, keys, rowCount } = input;
    const target = Math.min(input.target, rowCount - 1);
    if (!Number.isInteger(target) || target <= source.maxRow) return null;
    const spanned = keys.slice(source.minCol, source.maxCol + 1);
    const count = target - source.maxRow;
    const requests: CellWriteRequest[] = [];
    for (const key of spanned) {
        const column = input.column(key);
        if (!column?.valueSetter) continue; // a column without a setter is never written (parity)
        const values: unknown[] = [];
        for (let r = source.minRow; r <= source.maxRow; r++) {
            const row = input.rowAt(r);
            if (row !== undefined) values.push(input.value(row, column));
        }
        const filled = input.series(values, count);
        for (let i = 0; i < count; i++) requests.push({ target: { rowIndex: source.maxRow + 1 + i, columnKey: key }, value: filled[i] });
    }
    return { source, target, keys: spanned, requests };
}

export interface FillOutcome {
    /** The range after the fill: the source's top row to the target, over the source's columns. */
    readonly range: CellRange;
    readonly event: FillSeriesEvent;
    /** Rows below the source the fill covered. */
    readonly rows: number;
}

/** What a plan did once written (`results` in request order); null when no cell was written (no event, the range stays). */
export function fillOutcome<T>(plan: FillPlan, results: readonly CellWriteResult<T>[]): FillOutcome | null {
    const written = new Set<string>();
    plan.requests.forEach((request, i) => {
        if (results[i]?.status === 'written') written.add(request.target.columnKey);
    });
    const first = plan.keys[0];
    const last = plan.keys.at(-1);
    if (written.size === 0 || first === undefined || last === undefined) return null;
    const { source, target } = plan;
    return {
        range: { startRow: source.minRow, startCol: first, endRow: target, endCol: last },
        event: {
            source: { minRow: source.minRow, maxRow: source.maxRow },
            filled: { startRow: source.maxRow + 1, endRow: target },
            columnKeys: plan.keys.filter((key) => written.has(key)),
        },
        rows: target - source.maxRow,
    };
}

/** Ctrl/Cmd+D (Excel's meaning): the first row of the range copied into the rest of it, a plain repeat, not a series. */
export const repeatFirst = (source: readonly unknown[], count: number): unknown[] => Array.from({ length: count }, () => source[0]);
