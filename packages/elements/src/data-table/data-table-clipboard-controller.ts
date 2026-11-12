import type { DataTableCoreHost } from './data-table-host.js';
import { lazyPart } from './data-table-lazy.js';
import type { ClipboardService } from './data-table-providers.js';
import type { PastePart } from './lazy/clipboard.js';

/** The two feature flags the step 0 answers depend on (the element and the controller's `host.config` both have them). */
interface ClipboardFlags {
    readonly enableCopy: boolean;
    readonly enableClipboardPaste: boolean;
}

/**
 * The step 0 `clipboard` service: copy and paste do nothing yet and answer like the element documents, `ignored` while the feature flag is off and `unavailable`
 * otherwise. ONE rule for the controller's service and the element's fallback while no service is provided (detached), like `neutralRowDrag`. Wave 6 B replaces
 * the answers HERE, in this module (the controller's own service then does the real work; the element file stays frozen).
 */
export function neutralClipboard<T>(flags: () => ClipboardFlags): ClipboardService<T> {
    const status = (on: boolean): 'unavailable' | 'ignored' => (on ? 'unavailable' : 'ignored');
    return {
        copy: () => Promise.resolve({ status: status(flags().enableCopy) }),
        paste: () => Promise.resolve({ status: status(flags().enableClipboardPaste) }),
        pasteText: () => ({ status: status(flags().enableClipboardPaste) }),
    };
}

/**
 * Copy (eager) and paste (a lazy part) of cells (wave 6, package B owns this file). Joint step 0: it provides an inert `clipboard`
 * service; the paste part loads when `enable-clipboard-paste` is on and does nothing yet.
 */
export class ClipboardController<T> {
    private unprovide: (() => void) | undefined;
    private readonly paste = lazyPart<PastePart<T>>(() => import('./lazy/clipboard.js').then((m) => new m.PastePart(this.host)));

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: ClipboardService<T> = neutralClipboard<T>(() => this.host.config);
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
