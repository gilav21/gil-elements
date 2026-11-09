/** Excel-style fill series: extrapolating a drag-to-fill source into more values. Pure. */
import { dateOnlyParts, ymdToDate, type Ymd } from './data-table.utils.js';

const MS_PER_DAY = 86_400_000;

type Kind = 'date' | 'iso';
type NameForm = 'full' | 'abbr';
type NameCasing = 'upper' | 'lower' | 'title';
interface NameTable {
    full: readonly string[];
    abbr: readonly string[];
}
interface NameMatch {
    index: number;
    form: NameForm;
    casing: NameCasing;
}
interface NameSeries extends NameMatch {
    step: number;
    table: NameTable;
}
interface DateSeries {
    last: Ymd;
    kind: Kind;
    mode: 'day' | 'month';
    step: number;
}
interface TrailingNumbers {
    prefix: string;
    numbers: { value: number; width: number }[];
}

const WEEKDAYS: NameTable = {
    full: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    abbr: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};
const MONTHS: NameTable = {
    full: [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
    ],
    abbr: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;
const range = <R>(count: number, at: (i: number) => R): R[] => Array.from({ length: count }, (...[, i]) => at(i));

function toNumberSeries(source: readonly unknown[]): number[] | null {
    const nums: number[] = [];
    for (const v of source) {
        if (typeof v !== 'number' || !Number.isFinite(v)) return null;
        nums.push(v);
    }
    return nums;
}

function fillNumericSeries(nums: number[], count: number): number[] {
    const last = nums.at(-1) ?? 0;
    const step = nums.length >= 2 ? last - (nums.at(-2) ?? last) : 0;
    return range(count, (i) => last + step * (i + 1));
}

function splitTrailingDigits(v: string): { prefix: string; digits: string } | null {
    let end = v.length;
    while (end > 0 && v.charAt(end - 1) >= '0' && v.charAt(end - 1) <= '9') end--;
    return end === v.length ? null : { prefix: v.slice(0, end), digits: v.slice(end) };
}

function detectTrailingNumbers(source: readonly unknown[]): TrailingNumbers | null {
    let prefix: string | null = null;
    const numbers: TrailingNumbers['numbers'] = [];
    for (const v of source) {
        if (typeof v !== 'string') return null;
        const split = splitTrailingDigits(v);
        if (!split || (prefix !== null && prefix !== split.prefix)) return null;
        prefix = split.prefix;
        numbers.push({ value: Number.parseInt(split.digits, 10), width: split.digits.length });
    }
    return prefix === null ? null : { prefix, numbers };
}

function padNumber(n: number, width: number): string {
    const body = Math.abs(n).toString().padStart(width, '0');
    return n < 0 ? `-${body}` : body;
}

function fillTrailingNumbers({ prefix, numbers }: TrailingNumbers, count: number): string[] {
    const last = numbers.at(-1);
    if (!last) return [];
    const prev = numbers.at(-2) ?? last;
    const step = numbers.length >= 2 ? last.value - prev.value : 1;
    return range(count, (i) => prefix + padNumber(last.value + step * (i + 1), last.width));
}

const dayIndex = (ymd: Ymd): number => Math.round(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / MS_PER_DAY);
const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

function fromDayIndex(index: number): Ymd {
    const dt = new Date(index * MS_PER_DAY);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

function addMonths(ymd: Ymd, k: number): Ymd {
    const total = ymd.y * 12 + (ymd.m - 1) + k;
    const y = Math.floor(total / 12);
    const m = mod(total, 12) + 1;
    return { y, m, d: Math.min(ymd.d, daysInMonth(y, m)) };
}

function ymdToIso(ymd: Ymd): string {
    return `${ymd.y}-${String(ymd.m).padStart(2, '0')}-${String(ymd.d).padStart(2, '0')}`;
}

function parseDateCell(v: unknown): { ymd: Ymd; kind: Kind } | null {
    if (v instanceof Date) {
        if (Number.isNaN(v.getTime())) return null;
        return { ymd: { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() }, kind: 'date' };
    }
    const ymd = typeof v === 'string' ? dateOnlyParts(v) : null;
    return ymd ? { ymd, kind: 'iso' } : null;
}

function constantStep(values: number[]): number | null {
    const step = (values[1] ?? 0) - (values[0] ?? 0);
    for (let i = 1; i < values.length; i++) {
        if ((values[i] ?? 0) - (values[i - 1] ?? 0) !== step) return null;
    }
    return step;
}

function detectDateSeries(source: readonly unknown[]): DateSeries | null {
    const items: Ymd[] = [];
    let kind: Kind | null = null;
    for (const v of source) {
        const parsed = parseDateCell(v);
        if (!parsed) return null;
        kind ??= parsed.kind;
        items.push(parsed.ymd);
    }
    const last = items.at(-1);
    if (!kind || !last) return null;
    if (items.length === 1) return { last, kind, mode: 'day', step: 1 };

    const sameDom = items.every((it) => it.d === items[0]?.d);
    const monthStep = sameDom ? constantStep(items.map((it) => it.y * 12 + (it.m - 1))) : null;
    if (monthStep) return { last, kind, mode: 'month', step: monthStep };

    const dayStep = constantStep(items.map(dayIndex));
    return dayStep === null ? null : { last, kind, mode: 'day', step: dayStep };
}

function fillDateSeries(series: DateSeries, count: number): (Date | string)[] {
    const next = (i: number): Ymd => {
        const k = series.step * (i + 1);
        return series.mode === 'month' ? addMonths(series.last, k) : fromDayIndex(dayIndex(series.last) + k);
    };
    return range(count, (i) => (series.kind === 'date' ? ymdToDate(next(i)) : ymdToIso(next(i))));
}

function detectCasing(s: string): NameCasing {
    if (s === s.toUpperCase()) return 'upper';
    return s === s.toLowerCase() ? 'lower' : 'title';
}

function matchName(s: string, table: NameTable): NameMatch | null {
    const lower = s.toLowerCase();
    const full = table.full.indexOf(lower);
    if (full !== -1) return { index: full, form: 'full', casing: detectCasing(s) };
    const abbr = table.abbr.indexOf(lower);
    return abbr === -1 ? null : { index: abbr, form: 'abbr', casing: detectCasing(s) };
}

function detectNameSeries(source: readonly unknown[], table: NameTable): NameSeries | null {
    const matches: NameMatch[] = [];
    for (const v of source) {
        const match = typeof v === 'string' ? matchName(v, table) : null;
        if (!match) return null;
        matches.push(match);
    }
    const last = matches.at(-1);
    if (!last) return null;
    if (matches.length === 1) return { ...last, step: 1, table };

    const len = table.full.length;
    const step = mod((matches[1]?.index ?? 0) - (matches[0]?.index ?? 0), len);
    if (step === 0) return null;
    for (let i = 1; i < matches.length; i++) {
        if (mod((matches[i]?.index ?? 0) - (matches[i - 1]?.index ?? 0), len) !== step) return null;
    }
    return { ...last, step, table };
}

function fillNameSeries(series: NameSeries, count: number): string[] {
    const len = series.table.full.length;
    return range(count, (i) => {
        const index = mod(series.index + series.step * (i + 1), len);
        const base = (series.form === 'abbr' ? series.table.abbr : series.table.full)[index] ?? '';
        if (series.casing === 'upper') return base.toUpperCase();
        return series.casing === 'lower' ? base : base.charAt(0).toUpperCase() + base.slice(1);
    });
}

/**
 * Extrapolates `count` more values from a fill source. Detection order: arithmetic numbers, dates (day or month step,
 * ISO strings or `Date`), weekday names, month names, trailing-number text (padding kept), else the source cycles.
 * Names and date formats keep the source's style and casing.
 */
export function buildFillValues(source: readonly unknown[], count: number): unknown[] {
    if (!(count > 0)) return [];
    if (source.length === 0) return new Array<unknown>(count).fill('');

    const numeric = toNumberSeries(source);
    if (numeric) return fillNumericSeries(numeric, count);

    const dates = detectDateSeries(source);
    if (dates) return fillDateSeries(dates, count);

    const names = detectNameSeries(source, WEEKDAYS) ?? detectNameSeries(source, MONTHS);
    if (names) return fillNameSeries(names, count);

    const trailing = detectTrailingNumbers(source);
    if (trailing) return fillTrailingNumbers(trailing, count);

    return range(count, (i) => source[i % source.length]);
}
