/**
 * The value as a number, or `null` when it holds none. `Number()` alone turns `null`, `''`, whitespace and `false` into 0.
 * Its own module so an addon (the pivot) reads it without pulling the data table's utils chunk.
 */
export function toAggregatableNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
