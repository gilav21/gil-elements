/**
 * The entry of `table` an id means: the whole id first (lowercased, `pt-br`), then its language (`pt`). Only the table's own
 * entries count, so a name like `constructor` finds nothing.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const own = (key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
    const exact = id.toLowerCase();
    return own(exact) ?? own(exact.split('-')[0] ?? '');
}

/** A per-language dictionary table keyed by the host's locale code; `en` is the fallback. */
export type AddonLocaleTable<T extends object> = Readonly<Record<string, T | undefined>> & { readonly en: T };

/** An object override is used as it is, a string override picks its entry (case and region ignored, as the host table does), otherwise the host's locale code does. */
export function resolveAddonLocale<T extends object>(
    table: AddonLocaleTable<T>,
    host: { readonly resolvedLocale: { readonly code: string } },
    override?: string | T,
): T {
    if (typeof override === 'object' && override !== null) return override;
    const code = typeof override === 'string' ? override : host.resolvedLocale.code;
    return lookupLocale(table, code) ?? table.en;
}
