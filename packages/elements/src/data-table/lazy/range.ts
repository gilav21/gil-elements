/**
 * Lazy part of `RangeSession` (wave 6, package A owns this file): range selection by pointer, key and touch, the fill handle, the
 * readout. A build entry (`data-table/lazy/range`), loaded by `lazyPart` when `enable-cell-range-selection` or `enable-fill-handle`
 * is on. Joint step 0: an inert part.
 */
import type { InteractionContext } from '../data-table-cell-session.js';

export class RangePart<T> {
    constructor(protected readonly context: InteractionContext<T>) {}

    attach(): void {}

    detach(): void {}
}
