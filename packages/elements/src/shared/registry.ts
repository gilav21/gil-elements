/** Ordered contributions (toolbar slots) that a host renders and addons add to or remove from. */
export class SlotRegistry<S> {
    private list: readonly S[] = [];
    private readonly listeners = new Set<() => void>();

    get slots(): readonly S[] {
        return this.list;
    }

    /** Adds a slot; the returned teardown removes exactly this slot. */
    register(slot: S): () => void {
        this.list = [...this.list, slot];
        this.notify();
        return () => {
            if (!this.list.includes(slot)) return;
            this.list = this.list.filter((s) => s !== slot);
            this.notify();
        };
    }

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }

    private notify(): void {
        for (const fn of [...this.listeners]) fn();
    }
}

export class TopicBus<T extends string> {
    private readonly listeners = new Map<T, Set<() => void>>();

    on(topic: T, fn: () => void): () => void {
        const set = this.listeners.get(topic) ?? new Set<() => void>();
        set.add(fn);
        this.listeners.set(topic, set);
        return () => {
            set.delete(fn);
        };
    }

    emit(topic: T): void {
        for (const fn of [...(this.listeners.get(topic) ?? [])]) fn();
    }
}

/** Collects timers, listeners and teardowns so one `dispose()` releases them all, newest first. */
export class Disposables {
    private readonly items = new Set<() => void>();

    /** Registers a teardown; the returned function runs it now and forgets it. */
    add(teardown: () => void): () => void {
        this.items.add(teardown);
        return () => {
            if (this.items.delete(teardown)) teardown();
        };
    }

    /** Runs `fn` after `ms`; the returned function cancels it. */
    timeout(fn: () => void, ms: number): () => void {
        const id = setTimeout(() => {
            cancel();
            fn();
        }, ms);
        const cancel = this.add(() => clearTimeout(id));
        return cancel;
    }

    listen<E extends Event = Event>(
        target: EventTarget,
        type: string,
        fn: (event: E) => void,
        options?: boolean | AddEventListenerOptions,
    ): () => void {
        const listener = fn as EventListener;
        target.addEventListener(type, listener, options);
        return this.add(() => target.removeEventListener(type, listener, options));
    }

    dispose(): void {
        const teardowns = [...this.items].reverse();
        this.items.clear();
        for (const teardown of teardowns) teardown();
    }
}

interface ChainEntry<Args extends unknown[]> {
    readonly priority: number;
    readonly fn: (...args: Args) => boolean;
}

/** Handlers tried lowest priority first (ties in insertion order) until one returns true. */
export class HandlerChain<Args extends unknown[]> {
    private entries: readonly ChainEntry<Args>[] = [];

    get size(): number {
        return this.entries.length;
    }

    add(priority: number, fn: (...args: Args) => boolean): () => void {
        const entry = { priority, fn };
        const after = this.entries.findIndex((e) => e.priority > priority);
        const at = after === -1 ? this.entries.length : after;
        this.entries = [...this.entries.slice(0, at), entry, ...this.entries.slice(at)];
        return () => {
            this.entries = this.entries.filter((e) => e !== entry);
        };
    }

    run(...args: Args): boolean {
        return this.entries.some((entry) => entry.fn(...args));
    }
}
