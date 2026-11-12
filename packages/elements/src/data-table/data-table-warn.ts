/** Dev warnings that speak once per page per key: the one helper the table's owners of state share (read-only properties, refused ranges). Plain TypeScript. */
const spoken = new Set<string>();

/** `console.warn(message, ...detail)` the first time `key` is used on the page; later calls with the same key are silent. */
export function warnOnce(key: string, message: string, ...detail: unknown[]): void {
    if (spoken.has(key)) return;
    spoken.add(key);
    console.warn(message, ...detail);
}

/** For tests: lets `key` (or every key) speak again. */
export function resetWarnOnce(key?: string): void {
    if (key === undefined) spoken.clear();
    else spoken.delete(key);
}

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
