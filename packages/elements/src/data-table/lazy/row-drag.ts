/**
 * Lazy part of `RowDragController` (wave 6, package C owns this file): the native drag listeners, drop position, auto-scroll and the
 * reorder. A build entry (`data-table/lazy/row-drag`), loaded by `lazyPart` when `enable-row-drag` is on. Joint step 0: an inert part.
 */
import type { DataTableCoreHost } from '../data-table-host.js';

export class RowDragPart<T> {
    constructor(protected readonly host: DataTableCoreHost<T>) {}

    /** The part handles drags: the shell reports it as `rowDrag.active()`, and rows are draggable only then. The step 0 part does nothing, so it says false; wave 6 C turns it on. */
    active(): boolean {
        return false;
    }

    attach(): void {}

    detach(): void {}
}
