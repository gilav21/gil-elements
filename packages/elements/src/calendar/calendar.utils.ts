/** A single selectable date: a `Date`, an ISO `YYYY-MM-DD` string, another string `Date` can parse, or nothing. */
export type CalendarDateValue = Date | string | null | undefined;

export interface DateRange {
    start: Date | null;
    end: Date | null;
}

export interface TimeRange {
    start: string;
    end: string;
}

export type CalendarSelection = Date | DateRange | Date[] | string | string[] | null;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `val` as a local date; a bare `YYYY-MM-DD` is local midnight, not UTC. */
export function parseDate(val: CalendarDateValue): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (ISO_DAY.test(val)) {
        const [y = 0, m = 1, d = 1] = val.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `HH:mm` of `date`'s time of day, or an empty string for none. */
export function formatTime(date: Date | null): string {
    if (!date) return '';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Sets the time of day of `date` from `HH:mm`; an empty string leaves it alone. */
export function applyTime(date: Date, time: string): void {
    if (!time) return;
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    date.setHours(hours, minutes);
}
