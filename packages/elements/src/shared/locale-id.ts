/**
 * The entry of `table` an id means: the whole id first (lowercased, `pt-br`), then its language (`pt`); `_` separates like `-`
 * (`pt_BR`). Only the table's own entries count, so a name like `constructor` finds nothing. A module of its own: the addons need
 * this alone, without the rest of the lookup.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const own = (key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
    const exact = id.toLowerCase().replaceAll('_', '-');
    return own(exact) ?? own(exact.split('-')[0] ?? '');
}
