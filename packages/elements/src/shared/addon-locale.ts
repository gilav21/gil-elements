import { lookupLocale } from './locale-id.js';

/** A per-language dictionary table keyed by the host's locale code; `en` is the fallback. */
export type AddonLocaleTable<T extends object> = Readonly<Record<string, T | undefined>> & { readonly en: T };

/**
 * An object override is used as it is, a string override picks its entry, otherwise the host's locale code does. The id is tried as
 * written, then lowercase with `_` as `-`, then its shorter prefixes (`pt-br`, `pt`). Table keys are lowercase ids (e.g. `'pt-br'`); a
 * mixed-case key is found only by that exact id.
 */
export function resolveAddonLocale<T extends object>(
    table: AddonLocaleTable<T>,
    host: { readonly resolvedLocale: { readonly code: string } },
    override?: string | T,
): T {
    if (typeof override === 'object' && override !== null) return override;
    const code = typeof override === 'string' ? override : host.resolvedLocale.code;
    return lookupLocale(table, code) ?? table.en;
}
