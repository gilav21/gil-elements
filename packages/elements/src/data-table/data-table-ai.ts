/** A filter spec compiled from a natural-language query by an AI provider. */
export interface NlFilterSpec {
    globalFilter?: string;
    columnFilters?: Record<string, unknown>;
}

/**
 * Parses an AI provider's JSON into a safe {@link NlFilterSpec}: keeps a string `globalFilter` and only the
 * `columnFilters` whose keys are known columns. Malformed input gives an empty spec; the provider's output is never
 * trusted to address unknown columns.
 */
export function parseNlFilterSpec(raw: string, validColumnKeys: readonly string[]): NlFilterSpec {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return {};
    }
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, unknown>;
    const spec: NlFilterSpec = {};
    if (typeof obj['globalFilter'] === 'string') spec.globalFilter = obj['globalFilter'];
    const columnFilters = obj['columnFilters'];
    if (columnFilters && typeof columnFilters === 'object') {
        const valid = new Set(validColumnKeys);
        const kept = Object.entries(columnFilters).filter(([key]) => valid.has(key));
        // fromEntries defines own properties, so a column named `__proto__` cannot rewrite the prototype.
        if (kept.length > 0) spec.columnFilters = Object.fromEntries(kept);
    }
    return spec;
}
