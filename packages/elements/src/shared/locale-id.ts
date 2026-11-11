/**
 * The entry of `table` an id means: the whole id first (lowercased, `pt-br`), then shorter and shorter prefixes
 * (`zh-hant-tw`, `zh-hant`, `zh`); `_` separates like `-` (`pt_BR`). Only the table's own entries count, so a name like
 * `constructor` finds nothing. A module of its own: the addons need this alone, without the rest of the lookup.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const parts = id.toLowerCase().replaceAll('_', '-').split('-');
    for (let n = parts.length; n > 0; n--) {
        const key = parts.slice(0, n).join('-');
        if (Object.hasOwn(table, key) && table[key] !== undefined) return table[key];
    }
    return undefined;
}
