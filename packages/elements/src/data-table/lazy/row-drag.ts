/**
 * Lazy part of `RowDragController` (wave 6, package C owns this file): the native drag listeners, drop position, auto-scroll and the
 * reorder. A build entry (`data-table/lazy/row-drag`), loaded by `lazyPart` when `enable-row-drag` is on. Joint step 0: an inert part.
 */
import type { DataTableCoreHost } from '../data-table-host.js';

export class RowDragPart<T> {
    constructor(protected readonly host: DataTableCoreHost<T>) {}

    attach(): void {}

    detach(): void {}
}
