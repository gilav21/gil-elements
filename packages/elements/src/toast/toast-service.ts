export type ToastVariant = 'default' | 'destructive' | 'success' | 'info' | 'warning';

export interface ToastData {
    id: string;
    heading?: string;
    description?: string;
    variant?: ToastVariant;
    /** Lifetime in ms before it dismisses itself (default 5000); `0` or less keeps it until closed. */
    duration?: number;
    action?: { label: string; onClick: () => void };
    showCountdown?: boolean;
    countdownSeconds?: number;
    createdAt?: number;
    /** Draws a spinner before the heading; set by `loading()` and cleared by `promise()` when it settles. */
    loading?: boolean;
}

/** What `update` may patch: everything but the immutable `id`. */
export type ToastPatch = Partial<Omit<ToastData, 'id'>>;

/** A result message for `promise`: a fixed string, or one derived from the settled value. */
export type ToastPromiseMessage<T> = string | ((value: T) => string);

export interface ToastPromiseOptions<T> {
    /** Shown at once, on a sticky toast, until the promise settles. */
    loading: string;
    success: ToastPromiseMessage<T>;
    error: ToastPromiseMessage<unknown>;
    /** Secondary line kept across all three phases. */
    description?: string;
    /** Auto-dismiss time of the settled toast in ms (default 5000; `0` for sticky). */
    duration?: number;
}

const DEFAULT_DURATION = 5000;

function resolveMessage<T>(message: ToastPromiseMessage<T>, value: T): string {
    return typeof message === 'function' ? message(value) : message;
}

/**
 * The app-wide toast queue. Raise toasts from anywhere, and put one `ge-toaster` on the page to show them.
 *
 * It is an `EventTarget`: a `change` event fires after every change to `toasts`. Identical toasts are not
 * coalesced, nothing is capped or evicted, and a dismissed toast leaves the DOM at once.
 */
export class ToastService extends EventTarget {
    private list: readonly ToastData[] = [];
    private counter = 0;
    private readonly timeouts = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly intervals = new Map<string, ReturnType<typeof setInterval>>();
    /** Per armed toast: the time left (`remaining`, authoritative while paused) and the absolute `deadline` (authoritative while running). */
    private readonly lifetimes = new Map<string, { showCountdown: boolean; remaining: number; deadline: number }>();
    private paused = false;

    /** The toasts on screen, oldest first. */
    get toasts(): readonly ToastData[] {
        return this.list;
    }

    private setList(next: readonly ToastData[]): void {
        this.list = next;
        this.dispatchEvent(new Event('change'));
    }

    /**
     * Queues a toast and returns its id (usable with `dismiss`). With `showCountdown`, a 1s interval ticks
     * `countdownSeconds` down from `ceil(duration / 1000)` and drives the progress bar.
     */
    toast(options: Omit<ToastData, 'id'>): string {
        const id = `toast-${++this.counter}`;
        const duration = options.duration ?? DEFAULT_DURATION;
        const countdownSeconds = options.showCountdown ? Math.ceil(duration / 1000) : undefined;
        this.setList([...this.list, { ...options, id, countdownSeconds, createdAt: Date.now() }]);
        this.scheduleLifetime(id, duration, options.showCountdown ?? false);
        return id;
    }

    /** Starts a toast's clock; while the service is paused the full duration is parked and `resume` arms it. */
    private scheduleLifetime(id: string, duration: number, showCountdown: boolean): void {
        if (duration <= 0) return;
        if (this.paused) {
            this.lifetimes.set(id, { showCountdown, remaining: duration, deadline: 0 });
            return;
        }
        this.arm(id, duration, showCountdown);
    }

    /** The countdown follows the absolute deadline, not the time since creation, so a pause shifts it with the timeout. */
    private arm(id: string, remaining: number, showCountdown: boolean): void {
        const deadline = Date.now() + remaining;
        this.lifetimes.set(id, { showCountdown, remaining, deadline });
        this.timeouts.set(id, setTimeout(() => this.dismiss(id), remaining));
        if (!showCountdown) return;
        this.intervals.set(
            id,
            setInterval(() => {
                const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
                this.setList(this.list.map((t) => (t.id === id ? { ...t, countdownSeconds: seconds } : t)));
            }, 1000),
        );
    }

    private stopTimers(id: string): void {
        clearTimeout(this.timeouts.get(id));
        this.timeouts.delete(id);
        clearInterval(this.intervals.get(id));
        this.intervals.delete(id);
    }

    private clearLifetime(id: string): void {
        this.stopTimers(id);
        this.lifetimes.delete(id);
    }

    /**
     * Freezes every auto-dismiss clock and countdown, remembering the time each toast had left. `ge-toaster` calls
     * this while the pointer is over the stack or focus is inside it; toasts raised while paused start frozen.
     */
    pause(): void {
        if (this.paused) return;
        this.paused = true;
        const now = Date.now();
        for (const [id, lifetime] of this.lifetimes) {
            this.stopTimers(id);
            lifetime.remaining = Math.max(0, lifetime.deadline - now);
        }
    }

    /** Re-arms every frozen clock with the time it had left. Does nothing when not paused. */
    resume(): void {
        if (!this.paused) return;
        this.paused = false;
        for (const [id, lifetime] of this.lifetimes) this.arm(id, lifetime.remaining, lifetime.showCountdown);
    }

    /**
     * Patches a toast on screen in place: same id, same slot, no flicker. Unknown ids are ignored. Patching `duration`
     * or `showCountdown` restarts the clock from now; anything else leaves the running clock alone.
     */
    update(id: string, patch: ToastPatch): void {
        const current = this.list.find((t) => t.id === id);
        if (!current) return;
        const retimes = Object.hasOwn(patch, 'duration') || Object.hasOwn(patch, 'showCountdown');
        if (retimes) this.clearLifetime(id);
        const next: ToastData = { ...current, ...patch, id };
        if (retimes) {
            next.createdAt = Date.now();
            next.countdownSeconds = next.showCountdown ? Math.ceil((next.duration ?? DEFAULT_DURATION) / 1000) : undefined;
        }
        this.setList(this.list.map((t) => (t.id === id ? next : t)));
        if (retimes) this.scheduleLifetime(id, next.duration ?? DEFAULT_DURATION, next.showCountdown ?? false);
    }

    success(heading: string, description?: string, duration = DEFAULT_DURATION): string {
        return this.toast({ heading, description, variant: 'success', duration });
    }

    /** The `destructive` variant, which is announced assertively. Pass `0` for errors that must be acknowledged. */
    error(heading: string, description?: string, duration = DEFAULT_DURATION): string {
        return this.toast({ heading, description, variant: 'destructive', duration });
    }

    info(heading: string, description?: string, duration = DEFAULT_DURATION): string {
        return this.toast({ heading, description, variant: 'info', duration });
    }

    warning(heading: string, description?: string, duration = DEFAULT_DURATION): string {
        return this.toast({ heading, description, variant: 'warning', duration });
    }

    /** A sticky toast with a spinner for work still running; resolve it with `update` or `dismiss`. */
    loading(heading: string, description?: string): string {
        return this.toast({ heading, description, duration: 0, loading: true });
    }

    /**
     * Binds a toast to a promise: raises a sticky `loading` toast, then updates that same toast to the success or
     * error message. The returned promise settles exactly as the input does. A toast the user closed while the
     * promise ran does not come back.
     */
    promise<T>(promise: PromiseLike<T>, options: ToastPromiseOptions<T>): Promise<T> {
        const id = this.loading(options.loading, options.description);
        const duration = options.duration ?? DEFAULT_DURATION;
        return Promise.resolve(promise).then(
            (value) => {
                this.update(id, { heading: resolveMessage(options.success, value), variant: 'success', loading: false, duration });
                return value;
            },
            (error: unknown) => {
                this.update(id, { heading: resolveMessage(options.error, error), variant: 'destructive', loading: false, duration });
                throw error;
            },
        );
    }

    /** Removes one toast at once and clears its timers. Unknown ids are ignored. */
    dismiss(id: string): void {
        this.clearLifetime(id);
        if (this.list.some((t) => t.id === id)) this.setList(this.list.filter((t) => t.id !== id));
    }

    /** Clears the whole queue and every timer; the service is app-wide, so this drops other features' toasts too. */
    dismissAll(): void {
        for (const id of [...this.lifetimes.keys(), ...this.timeouts.keys(), ...this.intervals.keys()]) this.clearLifetime(id);
        this.setList([]);
    }
}

/** The shared instance every `ge-toaster` shows. */
export const toast = new ToastService();
