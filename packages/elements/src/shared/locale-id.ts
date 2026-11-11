const norm = (id: string): string => id.toLowerCase().replaceAll('_', '-');

/** The normalised keys of a record, built for the key count it had: records are mutable, a changed count rebuilds. */
const cache = new WeakMap<object, { count: number; byKey: Map<string, string> }>();

function keysOf(table: object): Map<string, string> {
    const own = Object.keys(table);
    const known = cache.get(table);
    if (known?.count === own.length) return known.byKey;
    const byKey = new Map<string, string>();
    // Two keys that normalise alike (`pt-BR`, `pt-br`): the first of the record is the one.
    for (const key of own) if (!byKey.has(norm(key))) byKey.set(norm(key), key);
    cache.set(table, { count: own.length, byKey });
    return byKey;
}

/**
 * The entry of `table` an id means: the whole id first, then shorter and shorter prefixes (`zh-hant-tw`, `zh-hant`, `zh`). A key
 * written exactly as asked wins; otherwise case and `_` against `-` are ignored on both sides (`pt-BR` is found by `pt-br`,
 * `PT-BR` and `pt_BR`). Only the record's own keys count, so `constructor` finds nothing. A module of its own: the addons need
 * this alone.
 */
export function lookupLocale<T>(table: Readonly<Record<string, T | undefined>>, id: string): T | undefined {
    const parts = id.split(/[-_]/);
    for (let n = parts.length; n > 0; n--) {
        const asked = parts.slice(0, n).join('-');
        const key = Object.hasOwn(table, asked) ? asked : keysOf(table).get(norm(asked));
        if (key !== undefined && table[key] !== undefined) return table[key];
    }
    return undefined;
}
