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

/** What a custom dictionary was filled into, per dictionary: the same object in gives the same object out while the base is the same. */
const filled = new WeakMap<object, { base: object; result: object }>();

/**
 * The dictionary a `locale` setting means: an object (English fills what it leaves out, and it keeps its own `code`: a
 * dictionary without one is unnamed, `''`, never taken for English); an id looked up among the table's own entries (see
 * {@link lookupLocale}); anything else follows the page's `lang`, then English.
 */
export function pickLocale<T extends { code: string }>(table: Record<string, T | undefined> & { en: T }, input: string | T | null | undefined): T {
    if (input && typeof input === 'object') {
        const known = filled.get(input);
        if (known?.base === table.en) return known.result as T;
        const result = withFallback(table.en, input.code === undefined ? { ...input, code: '' } : input);
        filled.set(input, { base: table.en, result });
        return result;
    }
    const page = typeof document === 'undefined' ? '' : document.documentElement.lang;
    return lookupLocale(table, typeof input === 'string' ? input : '') ?? lookupLocale(table, page) ?? table.en;
}
