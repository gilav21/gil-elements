/**
 * The pure half of the AI features (wave 7, package D; Angular cmp 1146-1170, 5058-5100): the request columns, the value-shape hardening of a
 * compiled filter spec (spec D5, Angular B9), one provider call with cancel and timeout, the row projection and the AI fill loop. No DOM, no
 * lit: node-tested. The lazy AI part (`lazy/ai.ts`) wires them to the table. Also the NL spec parser (`parseNlFilterSpec`, Angular utils 16-50).
 */
// Only `import type` from shared/ai and no import of the filter module: a lazy entry that imports a module the core shares with other entries
// splits rollup's shared chunks, and every entry pays for the extra chunk boundaries (measured: about +800 B on define.js).
import type { AiProvider, AiRequest } from '../shared/ai.js';
import type { ColumnDef } from './data-table.types.js';
import { asEditableDate, isPlainObject, isSpecialColumnKey } from './data-table.utils.js';

/** A filter spec compiled from a natural-language query by an AI provider. */
export interface NlFilterSpec {
    globalFilter?: string;
    columnFilters?: Record<string, unknown>;
}

/**
 * Parses an AI provider's JSON into a safe {@link NlFilterSpec}: keeps a string `globalFilter` and only the
 * `columnFilters` whose keys are known columns. Malformed input gives an empty spec; the provider's output is never
 * trusted to address unknown columns. An explicit empty `columnFilters: {}` is kept (it clears the column filters); one whose keys are all
 * unknown is dropped.
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
        const entries = Object.entries(columnFilters);
        const kept = entries.filter(([key]) => valid.has(key));
        // fromEntries defines own properties, so a column named `__proto__` cannot rewrite the prototype.
        if (kept.length > 0 || (entries.length === 0 && isPlainObject(columnFilters))) spec.columnFilters = Object.fromEntries(kept);
    }
    return spec;
}

/** A provider that never answers is given up after this long (per request). */
export const AI_TIMEOUT_MS = 60_000;

/** A data column with `enableFiltering`: the only ones the filter pipeline reads a column filter for. */
const filterable = <T>(column: ColumnDef<T>): boolean => !!column.enableFiltering && !isSpecialColumnKey(column.accessorKey);

/** The columns an NL request describes to the provider (`context.columns`), `{ key, header }`: the filterable data columns (Angular sends all). */
export const nlColumns = <T>(columns: readonly ColumnDef<T>[]): { key: string; header: string }[] =>
    columns.filter(filterable).map((c) => ({ key: String(c.accessorKey), header: c.header }));

/** A `Date`, or an ISO date or date-time string (`YYYY-MM-DD...`) that reads as a date; never a bare number. */
const isDateish = (v: unknown): boolean => (v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))) && asEditableDate(v) !== null;
const isRangeEnd = (v: unknown): boolean => v == null || isDateish(v);

/**
 * The value fits the column's filter: the built-in multiselect panel takes an array of primitives, the date panel a date (a `Date` or an ISO string),
 * the date-range panel `{ start, end }` (dates or open ends, nothing else); a column filtered by the default text match takes a string or a finite
 * number. A consumer's own `filterFn` or panel decides its own shapes: its value passes as given.
 */
export function fitsFilter<T>(column: ColumnDef<T>, value: unknown): boolean {
    const panel = column.filterComponent?.toLowerCase(); // the built-in panels (BUILT_IN_FILTER_PANELS), whatever the tag's case
    if (panel === 'ge-data-table-multiselect-filter') return Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object');
    if (panel === 'ge-data-table-date-filter') return isDateish(value);
    if (panel === 'ge-data-table-date-range-filter') {
        return isPlainObject(value) && Object.keys(value).every((k) => k === 'start' || k === 'end') && isRangeEnd(value['start']) && isRangeEnd(value['end']);
    }
    if (column.filterFn || column.filterComponent) return true;
    return typeof value === 'string' || Number.isFinite(value);
}

/**
 * `spec` without the column filters of a column that is not filterable or whose value does not fit its filter (`fitsFilter`); a record this empties
 * is dropped, an explicit empty one (it clears) is kept.
 */
export function hardenSpec<T>(spec: NlFilterSpec, columns: readonly ColumnDef<T>[]): NlFilterSpec {
    if (!spec.columnFilters || Object.keys(spec.columnFilters).length === 0) return spec;
    const kept = Object.entries(spec.columnFilters).filter(([key, value]) => {
        const column = columns.find((c) => String(c.accessorKey) === key);
        return column !== undefined && filterable(column) && fitsFilter(column, value);
    });
    const { columnFilters: _, ...rest } = spec;
    return kept.length > 0 ? { ...rest, columnFilters: Object.fromEntries(kept) } : rest;
}

/** A signal that aborts, with that reason, as soon as one of `signals` does (`AbortSignal.any` without needing it: older engines lack it). */
export function anySignal(...signals: AbortSignal[]): AbortSignal {
    const any = new AbortController();
    for (const signal of signals) {
        if (signal.aborted) {
            any.abort(signal.reason);
            break;
        }
        signal.addEventListener('abort', () => any.abort(signal.reason), { once: true });
    }
    return any.signal;
}

/**
 * Runs one request and answers its LAST emission (an async iterable emits the full text so far). Rejects with the signal's reason once `signal`
 * aborts or `ms` pass, even when the provider ignores `request.signal`; the provider gets the combined signal, and a stream is stopped (its
 * iterator's `return()`), not read to its end.
 */
export async function askAi(provider: AiProvider, request: Omit<AiRequest, 'signal'>, signal: AbortSignal, ms = AI_TIMEOUT_MS): Promise<string> {
    const combined = anySignal(signal, AbortSignal.timeout(ms));
    combined.throwIfAborted();
    let iterator: AsyncIterator<string> | undefined;
    let onAbort: () => void = () => undefined;
    const aborted = new Promise<never>((_, reject) => {
        onAbort = () => {
            reject(combined.reason);
            iterator?.return?.().catch(() => undefined);
        };
        combined.addEventListener('abort', onAbort, { once: true });
    });
    const answer = (async () => {
        // `runAiTask` (shared/ai.ts) inlined: a string or a promise is the answer, an async iterable's last emission is.
        const result = provider({ ...request, signal: combined });
        if (typeof result === 'string' || result instanceof Promise) return result;
        iterator = result[Symbol.asyncIterator]();
        let last = '';
        for (let step = await iterator.next(); !step.done && !combined.aborted; step = await iterator.next()) last = step.value;
        return last;
    })();
    try {
        return await Promise.race([answer, aborted]);
    } finally {
        combined.removeEventListener('abort', onAbort);
        answer.catch(() => undefined); // a provider rejecting after the abort is not an unhandled rejection
    }
}

/** What the provider sees of a row: with `columns`, only those, each read by `read` (the table's cell value: paths, `accessorFn`); else the whole row. */
export const projectRow = (row: unknown, columns: readonly string[] | undefined, read: (row: unknown, key: string) => unknown): unknown =>
    columns ? Object.fromEntries(columns.map((key) => [key, read(row, key)])) : row;

export interface FillPorts<T> {
    /** The provider's answer for `row`. */
    ask(row: T): Promise<string>;
    /** Writes one batch (in row order) and answers each cell's status. */
    write(batch: readonly { row: T; value: string }[]): readonly ('written' | 'rejected' | 'skipped')[];
    /** After each batch: `done` rows of `total` asked. */
    progress(done: number, total: number): void;
    /** Checked after each answer: an aborted run writes nothing more. */
    readonly signal: AbortSignal;
}

export interface FillResult {
    count: number;
    rejected: number;
    skipped: number;
    failed?: boolean;
    error?: unknown;
}

/**
 * The AI fill loop: `concurrency` requests at a time, each batch written once all its answers are in (row order kept). A rejected request or an
 * abort stops the run; what was written stays. Never rejects: the failure is in the result.
 */
export async function runFill<T>(rows: readonly T[], concurrency: number, ports: FillPorts<T>): Promise<FillResult> {
    const result: FillResult = { count: 0, rejected: 0, skipped: 0 };
    const size = Math.max(1, Math.floor(concurrency) || 1);
    try {
        for (let at = 0; at < rows.length; at += size) {
            const batch = rows.slice(at, at + size);
            const values = await Promise.all(batch.map((row) => ports.ask(row)));
            ports.signal.throwIfAborted();
            for (const status of ports.write(batch.map((row, i) => ({ row, value: values[i] as string })))) {
                if (status === 'written') result.count++;
                else result[status]++;
            }
            ports.progress(at + batch.length, rows.length);
        }
    } catch (error) {
        result.failed = true;
        result.error = error;
    }
    return result;
}
