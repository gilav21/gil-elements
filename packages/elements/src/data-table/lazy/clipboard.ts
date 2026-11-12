/**
 * Lazy part of `ClipboardController` (wave 6, package B owns this file): paste parsing, planning and writing, and the native
 * `paste` listener. Copy is eager. A build entry (`data-table/lazy/clipboard`), loaded by `lazyPart` when
 * `enable-clipboard-paste` is on. Joint step 0: an inert part.
 */
import type { DataTableCoreHost } from '../data-table-host.js';

export class PastePart<T> {
    constructor(protected readonly host: DataTableCoreHost<T>) {}

    attach(): void {}

    detach(): void {}
}
