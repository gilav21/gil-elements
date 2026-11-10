import { lookupLocale } from './addon-locale.js';

const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `partial` with every entry it leaves out taken from `base` (nested dictionaries too), so a partial custom dictionary never
 * renders `undefined`. A dictionary that leaves nothing out is returned as it is.
 */
export function withFallback<T extends object>(base: T, partial: T): T {
    const own = partial as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...own };
    let filled = false;
    for (const [key, fallback] of Object.entries(base)) {
        const value = own[key];
        if (value === undefined) {
            merged[key] = fallback;
            filled = true;
        } else if (isPlain(value) && isPlain(fallback)) {
            const inner = withFallback(fallback, value);
            if (inner !== value) {
                merged[key] = inner;
                filled = true;
            }
        }
    }
    return filled ? (merged as T) : partial;
}

/**
 * The dictionary a `locale` setting means: an object (English fills what it leaves out); an id looked up among the table's own
 * entries (see {@link lookupLocale}); anything else follows the page's `lang`, then English.
 */
export function pickLocale<T extends object>(table: Record<string, T | undefined> & { en: T }, input: string | T | null | undefined): T {
    if (input && typeof input === 'object') return withFallback(table.en, input);
    const page = typeof document === 'undefined' ? '' : document.documentElement.lang;
    return lookupLocale(table, typeof input === 'string' ? input : '') ?? lookupLocale(table, page) ?? table.en;
}
