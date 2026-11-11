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
 *   resolves after the flag turned off, or after `dispose()`, is dropped without attaching, so nothing runs after a disconnect.
 */

/** One memoised `import()`; a rejection clears the memo so a later call tries again. */
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
    /** Starts (or joins) the load; resolves once `tag` is defined. */
    load(): Promise<void>;
    /** The tag is defined now (no load needed). */
    ready(): boolean;
}

/** A custom element that a lazy module defines as a side effect. */
export function lazyElement(tag: string, importer: () => Promise<unknown>): LazyElement {
    const once = lazyOnce(importer);
    return {
        load: async () => {
            await once();
            await customElements.whenDefined(tag);
        },
        ready: () => customElements.get(tag) !== undefined,
    };
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
export function lazyPart<P extends LazyPartInstance>(create: () => Promise<P>, onError: (error: unknown) => void = defaultOnError): LazyPart<P> {
    let current: P | null = null;
    let wanted = false;
    let loading = false;
    let generation = 0;
    const stop = (): void => {
        wanted = false;
        generation++;
        loading = false;
        const part = current;
        current = null;
        part?.detach();
    };
    return {
        get part() {
            return current;
        },
        sync(on) {
            if (!on) {
                if (wanted) stop();
                return;
            }
            if (wanted) return;
            wanted = true;
            loading = true;
            const mine = ++generation;
            create().then(
                (part) => {
                    if (mine !== generation || !wanted) return;
                    loading = false;
                    current = part;
                    part.attach();
                },
                (error: unknown) => {
                    if (mine !== generation) return;
                    // Forgotten, so the flag turning off and on again (or the next attach) tries again.
                    wanted = false;
                    loading = false;
                    onError(error);
                },
            );
        },
        dispose: () => {
            if (wanted || loading || current) stop();
        },
    };
}

function defaultOnError(error: unknown): void {
    console.error('[ge-data-table] a lazy part failed to load:', error);
}
