/**
 * Lazy part of `RangeSession` (wave 6, package A owns this file): range selection by pointer, key and touch, the fill handle, the
 * readout. A build entry (`data-table/lazy/range`), loaded by `lazyPart` when `enable-cell-range-selection` or `enable-fill-handle`
 * is on. Joint step 0: an inert part that only holds the range the shell hands it (`setRange` right BEFORE `attach` (`lazyPart`'s `beforeAttach`), `getRange` before the
 * shell disposes it); wave 6 keeps that contract and implements the rest. The fill handle and the range readout it draws over the cells
 * must each carry `data-pointer-transparent` (the controller looks a release through such an element; it keeps no list of slot names).
 */
import type { InteractionContext } from '../data-table-cell-session.js';
import type { CellRange } from '../data-table.types.js';

export class RangePart<T> {
    private range: CellRange | null = null;

    constructor(protected readonly context: InteractionContext<T>) {}

    /**
     * The part handles ranges (isInRange, edges, the readout, the gestures): the shell reports it as `rangeService.active()`, and
     * `aria-selected` and the range flags are drawn only then. The step 0 part does nothing, so it says false; wave 6 A turns it on.
     */
    active(): boolean {
        return false;
    }

    getRange(): CellRange | null {
        return this.range;
    }

    setRange(range: CellRange | null): void {
        this.range = range;
    }

    attach(): void {}

    detach(): void {}
}
