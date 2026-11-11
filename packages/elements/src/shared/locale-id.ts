/**
 * The entry of `table` an id means: the whole id first, then shorter and shorter prefixes (`zh-hant-tw`, `zh-hant`, `zh`). Case
 * and `_` against `-` are ignored on both sides: a record keyed `pt-BR` is found by `pt-br`, `PT-BR` and `pt_BR`. Only the table's
 * own keys count, so a name like `constructor` finds nothing. A module of its own: the addons need this alone, without the rest of
 * the lookup.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const keys = new Map(Object.keys(table).map((key) => [key.toLowerCase().replaceAll('_', '-'), key] as const));
    const parts = id.toLowerCase().replaceAll('_', '-').split('-');
    for (let n = parts.length; n > 0; n--) {
        const key = keys.get(parts.slice(0, n).join('-'));
        if (key !== undefined && table[key] !== undefined) return table[key];
    }
    return undefined;
}
