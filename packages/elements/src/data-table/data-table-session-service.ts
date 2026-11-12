import type { CellSession } from './data-table-cell-session.js';

type Declares = Pick<CellSession, 'service' | 'neutral'>;

/**
 * Adds to `base` ONE stable delegating function per key the sessions declare (on their `service` or `neutral.service`): at call time it calls that key on the owning
 * session's `service` (its `neutral.service` while it is broken, for the keys that list). The first session that declares a key owns it. Keys are OWN keys only
 * (`Object.hasOwn`): a method named `toString` or `constructor` is an ordinary key, never mistaken for an inherited one.
 */
export function mergeSessionServices(sessions: readonly Declares[], isBroken: (session: Declares) => boolean, base: Record<string, unknown>): Record<string, unknown> {
    for (const session of sessions) {
        for (const key of new Set([...Object.keys(session.service ?? {}), ...Object.keys(session.neutral?.service ?? {})])) {
            if (Object.hasOwn(base, key)) continue;
            base[key] = (...args: unknown[]): unknown => {
                // A broken session answers NEUTRALLY only for the methods its `neutral.service` lists (the ones that need its live part); the rest (its VALUE methods) keep going to the session.
                const neutral = isBroken(session) ? (session.neutral?.service as Record<string, unknown> | undefined) : undefined;
                const source = neutral && Object.hasOwn(neutral, key) ? neutral : (session.service as Record<string, unknown> | undefined);
                const method = source?.[key];
                return typeof method === 'function' ? method.apply(source, args) : undefined;
            };
        }
    }
    return base;
}
