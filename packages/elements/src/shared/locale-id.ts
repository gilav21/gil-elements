/**
 * The entry of `table` an id means: the id as written first, then its lowercase form with `_` as `-` (`pt_BR` is `pt-br`), then
 * shorter and shorter prefixes of that (`zh-hant-tw`, `zh-hant`, `zh`). Table keys are lowercase ids (`pt-br`): a mixed-case key
 * is found only by that exact id. Only the table's own entries count, so a name like `constructor` finds nothing. A module of its
 * own: the addons need this alone, without the rest of the lookup.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const own = (key: string): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);
    const parts = id.toLowerCase().replaceAll('_', '-').split('-');
    let found = own(id);
    for (let n = parts.length; found === undefined && n > 0; n--) found = own(parts.slice(0, n).join('-'));
    return found;
}
