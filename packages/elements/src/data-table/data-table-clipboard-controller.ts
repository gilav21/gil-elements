import type { DataTableCoreHost } from './data-table-host.js';
import { lazyPart } from './data-table-lazy.js';
import type { ClipboardService } from './data-table-providers.js';
import type { PastePart } from './lazy/clipboard.js';

/**
 * Copy (eager) and paste (a lazy part) of cells (wave 6, package B owns this file). Joint step 0: it provides an inert `clipboard`
 * service; the paste part loads when `enable-clipboard-paste` is on and does nothing yet.
 */
export class ClipboardController<T> {
    private unprovide: (() => void) | undefined;
    private readonly paste = lazyPart<PastePart<T>>(() => import('./lazy/clipboard.js').then((m) => new m.PastePart(this.host)));

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: ClipboardService<T> = {
        // The step 0 copy answers like the element documents: `ignored` while the feature flag is off, `unavailable` otherwise (the real copy is wave 6 B).
        copy: () => Promise.resolve({ status: this.host.config.enableCopy ? 'unavailable' : 'ignored' }),
        // Paste answers like copy: `ignored` while `enable-clipboard-paste` is off, `unavailable` otherwise (the real paste is wave 6 B).
        paste: () => Promise.resolve({ status: this.host.config.enableClipboardPaste ? 'unavailable' : 'ignored' }),
        pasteText: () => ({ status: this.host.config.enableClipboardPaste ? 'unavailable' : 'ignored' }),
    };

    attach(): void {
        this.unprovide = this.host.provide('clipboard', this.service);
    }

    hostUpdate(): void {
        this.paste.sync(this.host.config.enableClipboardPaste);
    }

    detach(): void {
        this.paste.dispose();
        this.unprovide?.();
    }
}
