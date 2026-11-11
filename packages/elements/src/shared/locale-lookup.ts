import { lookupLocale } from './locale-id.js';

export { lookupLocale };

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

/** What a dictionary was filled into, per dictionary: the same object in gives the same object out while the base is the same. */
const completed = new WeakMap<object, { base: object; result: object }>();

/**
 * The dictionary a `locale` setting means: an object, an id looked up among the table's own entries (see {@link lookupLocale}),
 * or else the page's `lang` (`pageLang`, the global document's by default), then English. English, the table's current `en`,
 * fills what the pick leaves out, and the pick keeps its own `code`: a dictionary without one is unnamed, `''`, never taken for
 * English. Replace a custom object to change it: the filled result is remembered per object.
 */
export function pickLocale<T extends { code: string }>(
    table: Record<string, T | undefined> & { en: T },
    input: string | T | null | undefined,
    pageLang = typeof document === 'undefined' ? '' : document.documentElement.lang,
): T {
    const picked = input && typeof input === 'object' ? input : (lookupLocale(table, typeof input === 'string' ? input : '') ?? lookupLocale(table, pageLang) ?? table.en);
    const known = completed.get(picked);
    if (known?.base === table.en) return known.result as T;
    const result = withFallback(table.en, picked.code === undefined ? { ...picked, code: '' } : picked);
    completed.set(picked, { base: table.en, result });
    return result;
}
