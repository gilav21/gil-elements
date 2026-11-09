/**
 * The dictionary a `locale` setting means: an object as it is; an id (case and region ignored, `de-DE` is `de`) looked up
 * among the table's own entries, so a name like `constructor` finds nothing; anything else follows the page's `lang`, then English.
 */
export function pickLocale<T>(table: Record<string, T | undefined> & { en: T }, input: string | T | null | undefined): T {
    if (input && typeof input === 'object') return input;
    const own = (id: string): T | undefined => (Object.hasOwn(table, id) ? table[id] : undefined);
    const page = typeof document === 'undefined' ? '' : document.documentElement.lang;
    const base = (id: string) => (id.split('-')[0] ?? '').toLowerCase();
    return own(base(typeof input === 'string' ? input : '')) ?? own(base(page)) ?? table.en;
}
