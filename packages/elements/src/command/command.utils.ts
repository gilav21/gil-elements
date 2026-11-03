const STORAGE_PREFIX = 'ge-command:';

// Storage throws outright in some privacy modes and sandboxed frames; a palette must degrade to recents that are not saved.

/** The saved recent values for `storageKey`; `[]` for a null key or unreadable storage. */
export function readRecentValues(storageKey: string | null, max: number): string[] {
    if (!storageKey) return [];
    try {
        const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_PREFIX + storageKey) ?? 'null');
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, max) : [];
    } catch {
        return [];
    }
}

/** Saves the recent values under `storageKey`. Does nothing for a null key. */
export function writeRecentValues(storageKey: string | null, values: readonly string[]): void {
    if (!storageKey) return;
    try {
        globalThis.localStorage?.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(values));
    } catch {
        // Quota and privacy-mode errors: persistence is best effort.
    }
}

/** `value` first, any earlier copy dropped, capped at `max`. */
export function unshiftUniqueValue(values: readonly string[], value: string, max: number): string[] {
    return [value, ...values.filter((v) => v !== value)].slice(0, Math.max(0, max));
}
