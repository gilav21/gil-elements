/**
 * Lazy part of `RangeSession` (wave 6, package A owns this file): range selection by pointer, key and touch, the fill handle, the
 * readout. A build entry (`data-table/lazy/range`), loaded by `lazyPart` when `enable-cell-range-selection` or `enable-fill-handle`
 * is on. Joint step 0: an inert part that only holds the range the shell hands it (`setRange` before `attach`, `getRange` before the
 * shell disposes it); wave 6 keeps that contract and implements the rest.
 */
import type { InteractionContext } from '../data-table-cell-session.js';
import type { CellRange } from '../data-table.types.js';

export class RangePart<T> {
    private range: CellRange | null = null;

    constructor(protected readonly context: InteractionContext<T>) {}

    getRange(): CellRange | null {
        return this.range;
    }

    setRange(range: CellRange | null): void {
        this.range = range;
    }

    attach(): void {}

    detach(): void {}
}
