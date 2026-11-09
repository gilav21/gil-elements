/** A per-language dictionary table keyed by the host's locale code; `en` is the fallback. */
export type AddonLocaleTable<T extends object> = Readonly<Record<string, T | undefined>> & { readonly en: T };

/** An object override is used as it is, a string override picks its entry, otherwise the host's locale code does. */
export function resolveAddonLocale<T extends object>(
    table: AddonLocaleTable<T>,
    host: { readonly resolvedLocale: { readonly code: string } },
    override?: string | T,
): T {
    if (typeof override === 'object' && override !== null) return override;
    const code = typeof override === 'string' ? override : host.resolvedLocale.code;
    return (Object.hasOwn(table, code) ? table[code] : undefined) ?? table.en;
}
