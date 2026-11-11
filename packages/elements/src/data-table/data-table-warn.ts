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
