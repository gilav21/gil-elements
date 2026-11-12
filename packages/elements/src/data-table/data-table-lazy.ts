/**
 * Lazy loading for the data table's heavy, flag-gated features (joint step 0 of waves 5 and 6).
 *
 * Mechanism (spike result, docs/data-table-wave-6-spec.md section 1): a lazy module is a build ENTRY (`data-table/lazy/*` in
 * `vite.config.ts`, so `scripts/size.mjs` budgets it) and is reached with a plain `import('./lazy/x.js')` written next to the code
 * that needs it. The built dist rewrites that relative specifier to the entry file whatever chunk the call ends up in, and the
 * published package resolves it because relative imports inside a package ignore its `exports` map.
 *
 * - `lazyOnce`: one memoised `import()`; a failed load is forgotten so the next call retries.
 * - `lazyElement`: a custom element defined by a lazy module (filter panels, the builder, `ge-date-picker`): the caller renders the
 *   tag at once (it stays an unknown element until defined) and calls `load()` early (on hover or focus of its trigger) so it is
 *   defined by the time it is shown. A caller that resolves after the table was detached must check its own attach state.
 * - `lazyPart`: a flag-gated piece of a controller or session. `sync(on)` loads it when the flag turns on (at the first update, so
 *   the first gesture does not wait), attaches it, and detaches it when the flag turns off or the table detaches. A load that
 *   resolves after the flag turned off, or after `dispose()`, is dropped without attaching, so nothing runs after a disconnect. A
 *   failed load is latched: `sync` runs on every render and must not re-import (and re-log) every time, so it tries again only
 *   after the flag turned off and on, or after `dispose()` (the next attach).
 */
import { warnOncePer } from './data-table-warn.js';

/**
 * Calls the part from a path that must never break (a render, a detach): a part that throws is reported ONCE per `key` and per `scope` (the table: one table's failure never silences another's) and answers `fallback`
 * ("inactive", the held value), so the grid still renders and the part is still disposed. `part` null (not loaded) answers `fallback` too.
 */
export function callPart<P, R>(part: P | null, scope: object, key: string, call: (part: P) => R, fallback: R): R {
    if (!part) return fallback;
    try {
        return call(part);
    } catch (error) {
        warnOncePer(scope, key, `[ge-data-table] a lazy part threw in ${key}:`, error);
        return fallback;
    }
}

/**
 * One memoised `import()`; a rejection clears the memo so a later call tries again. A retry is BEST EFFORT: a browser may keep the failed module
 * record and reject the same specifier again without refetching (so "retried at the next attach" may fail again until the page reloads).
 */
export function lazyOnce<M>(importer: () => Promise<M>): () => Promise<M> {
    let pending: Promise<M> | undefined;
    return () => {
        pending ??= importer().catch((error: unknown) => {
            pending = undefined;
            throw error;
        });
        return pending;
    };
}

export interface LazyElement {
    /**
     * Starts (or joins) the load and resolves once the module has been evaluated: with true when `tag` is defined then, with false when
     * the module did not define it (a module defines its tags while it is evaluated, so nothing is left to wait for). It never waits on a
     * tag that nothing will define and it NEVER REJECTS: a failed import is reported once through `onError` (default `console.error`) and
     * latched (every `load()` after it resolves false without importing again, so a trigger that is hovered a hundred times does not re-import
     * and re-log) until `reset()`.
     */
    load(): Promise<boolean>;
    /** The tag is defined now (no load needed). */
    ready(): boolean;
    /** A load failed and is latched (until `reset()`): `load()` would only answer false, so a hot caller can skip it without allocating a promise. */
    failed(): boolean;
    /** Forgets a latched failure: the next `load()` imports again. It also makes a load in flight stale (its failure is neither latched nor reported). */
    reset(): void;
    /** `reset()` only when a failure is latched: safe to call at every attach (a load in flight, e.g. another table's, is left alone). */
    resetIfFailed(): void;
    /** `load()` was asked for (and not reset since): the import is in flight or done. Lets a hot caller skip the call. */
    requested(): boolean;
}

/** A custom element that a lazy module defines as a side effect. */
export function lazyElement(
    tag: string,
    importer: () => Promise<unknown>,
    onError: (error: unknown) => void = (error) => console.error(`[ge-data-table] could not load <${tag}>:`, error),
): LazyElement {
    const once = lazyOnce(importer);
    let failed = false;
    /** The IMPORT, failure handling included, as ONE promise (true: it imported): concurrent callers share it, so one failure is one report. */
    let loading: Promise<boolean> | undefined;
    /** Bumped by `reset()`: a run that started before it is stale and neither latches the failure nor reports it (the run after the reset does). */
    let generation = 0;
    const run = async (token: number): Promise<boolean> => {
        try {
            await once();
        } catch (error) {
            if (token === generation) {
                failed = true;
                onError(error);
            }
            return false;
        }
        return true;
    };
    return {
        // Only the import is memoised: whether the tag is defined is asked per call, so a definition that arrives later than the import is seen by a later load.
        load: () => (failed ? Promise.resolve(false) : (loading ??= run(generation)).then((imported) => imported && customElements.get(tag) !== undefined)),
        ready: () => customElements.get(tag) !== undefined,
        failed: () => failed,
        requested: () => loading !== undefined,
        reset,
        // A caller that may run at every attach cannot use `reset`: it would make a load another caller has in flight stale and swallow its failure.
        resetIfFailed: () => {
            if (failed) reset();
        },
    };
    function reset(): void {
        generation++;
        failed = false;
        loading = undefined;
    }
}

/** What a lazily built piece must offer: the lifecycle of a controller. */
export interface LazyPartInstance {
    attach(): void;
    detach(): void;
}

export interface LazyPart<P extends LazyPartInstance> {
    /** The attached part, or null while it is not loaded (or the flag is off). */
    readonly part: P | null;
    /** `true` loads and attaches the part (once); `false` detaches it. Safe to call on every update. */
    sync(on: boolean): void;
    /** Detaches the part and drops a load in flight: call from `detach()`. */
    dispose(): void;
}

/**
 * `create` imports the module and builds the part (`() => import('./lazy/x.js').then((m) => new m.XPart(context))`); the part is
 * attached here, after the flag is checked again, never inside `create`.
 */
export interface LazyPartOptions {
    /** A load or an attach failed (default: `console.error`); it is latched, see `lazyPart`. */
    onError?: (error: unknown) => void;
    /**
     * The part was attached (the load finished, outside any update), so what the render reads from it changed (`rowDrag.active()`, the range
     * overlay, the fill handle): pass the host's `requestRender`, or nothing draws the change until an unrelated update. A part that leaves
     * (`sync(false)`, `dispose()`) does not ask: those run inside an update or a detach.
     */
    changed?: () => void;
}

export function lazyPart<P extends LazyPartInstance>(
    create: () => Promise<P>,
    { onError = (error) => console.error('[ge-data-table] a lazy part failed to load:', error), changed }: LazyPartOptions = {},
): LazyPart<P> {
    let current: P | null = null;
    let wanted = false;
    /** A load failed with the flag still on: not tried again (and not logged again) until the flag turns off or `dispose()`. */
    let failed = false;
    let generation = 0;
    const stop = (): void => {
        wanted = false;
        generation++;
        const part = current;
        current = null;
        if (!part) return;
        try {
            part.detach();
        } catch (error) {
            // `sync(false)` and `dispose()` run inside the host's update and detach: a part that throws while leaving must not abort them.
            // It is gone either way (`current` is already cleared) and the failure is reported. No render is requested: `sync(false)` runs inside
            // the update that is already drawing, and `dispose()` inside the detach.
            onError(error);
        }
    };
    return {
        get part() {
            return current;
        },
        sync(on) {
            if (!on) {
                failed = false;
                if (wanted) stop();
                return;
            }
            // `sync` runs on every render: a part that is wanted, loading or failed is left alone.
            if (wanted || failed) return;
            wanted = true;
            const mine = ++generation;
            const fail = (error: unknown): void => {
                wanted = false;
                failed = true;
                onError(error);
            };
            // A `create` that throws SYNCHRONOUSLY (before it returns a promise) fails like a rejected one: reported once, latched.
            let creating: Promise<P>;
            try {
                creating = create();
            } catch (error) {
                fail(error);
                return;
            }
            creating.then(
                (part) => {
                    if (mine !== generation) return;
                    current = part; // visible while it attaches: its own setup may call back into the shell that reads it
                    try {
                        part.attach();
                    } catch (error) {
                        // A `sync(false)` / `dispose()` from inside the attach already detached this part and moved on: its failure is stale (no second detach, no latch).
                        if (mine !== generation) return;
                        // A part that threw while attaching is not left half attached: it is detached (best effort) and the failure latches like a failed load.
                        try {
                            part.detach();
                        } catch {
                            // the attach error is the one worth reporting
                        }
                        current = null;
                        fail(error);
                        return;
                    }
                    if (mine !== generation) return; // the part was disposed from inside its own attach: nothing to draw
                    try {
                        changed?.();
                    } catch (error) {
                        onError(error); // the part attached fine: it stays attached and is not latched as failed; a callback that throws is reported, never an unhandled rejection
                    }
                },
                (error: unknown) => {
                    if (mine === generation) fail(error);
                },
            );
        },
        dispose: () => {
            failed = false;
            if (wanted) stop();
        },
    };
}
