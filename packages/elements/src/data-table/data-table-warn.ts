/** Dev warnings and error reports that speak once per OWNER (a table, a session, a registry) and key: one owner's mistake never silences another's. Plain TypeScript. */
const spokenPer = new WeakMap<object, Set<string>>();

/** True the first time `key` is used for `scope` (the entry is written only for a new scope). */
function firstFor(scope: object, key: string): boolean {
    let keys = spokenPer.get(scope);
    if (!keys) spokenPer.set(scope, (keys = new Set<string>()));
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
}

/** Like `warnOnce`, but once per `scope` (a table) and key: one table's mistake never silences another table's. */
export function warnOncePer(scope: object, key: string, message: string, ...detail: unknown[]): void {
    if (firstFor(scope, key)) console.warn(message, ...detail);
}

/** The error twin: `console.error` once per `scope` (a table, a session) and key, for a THROWN error (a bug) that would repeat at every render; one scope's failure never silences another's. */
export function reportOncePer(scope: object, key: string, message: string, ...detail: unknown[]): void {
    if (firstFor(scope, key)) console.error(message, ...detail);
}
