/** One row produced by a {@link CommandSource}. */
export interface CommandResult {
    /** Stable identity, for keyed rendering. */
    readonly id: string;
    /** Text the row is selected by, and the payload a `ge-command-item` emits. */
    readonly value: string;
    /** Display text, when it differs from `value`. */
    readonly label?: string;
    /** Optional grouping key the consumer can bucket rows by. */
    readonly group?: string;
    /** Whatever the consumer needs on select: the original record, a route, an id. */
    readonly data?: unknown;
}

/**
 * An async row provider, typically a server-side search. Calls are debounced and the answer of any call a newer
 * keystroke has superseded is discarded, so results never go backwards. `signal` is aborted the moment a call is
 * superseded: pass it to `fetch` and the stale request is cancelled on the wire. Throwing is fine: the results are
 * cleared and the error is exposed as `sourceError`.
 */
export type CommandSource = (query: string, signal: AbortSignal) => Promise<readonly CommandResult[]>;

/** One level of the page stack, a drill-down "submenu". */
export interface CommandPage {
    /** Identifies the page; the consumer switches its content on this. */
    readonly id: string;
    /** Human-readable name for a breadcrumb or back button. */
    readonly label?: string;
    /** Anything the page needs: the record being drilled into, for instance. */
    readonly data?: unknown;
}
