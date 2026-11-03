import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveCalendarLocale, type CalendarLocale } from '../shared/calendar-locales.js';
import {
    applyTime,
    formatTime,
    isSameDay,
    parseDate,
    type CalendarDateValue,
    type CalendarSelection,
    type DateRange,
    type TimeRange,
} from './calendar.utils.js';
import css from './calendar.css?inline';

export type CalendarMode = 'single' | 'range' | 'multi';
export type CalendarTimeMode = 'single' | 'range';
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const PREVIOUS = svg`<svg class="arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>`;
const NEXT = svg`<svg class="arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>`;
const CLOCK = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

/** Reads `selected` from an attribute: a single `YYYY-MM-DD` (or other parseable) date. Ranges and lists are property-only. */
const selectedConverter = {
    fromAttribute: (value: string | null): CalendarSelection => parseDate(value),
};

/**
 * A month calendar for picking a date, several dates or a range, with optional month and year pickers and a
 * time field. The shape of `selected` follows `mode`: `single` is a `Date`, `multi` a `Date[]`, `range` a
 * `{ start, end }`. It takes `Date`s or `YYYY-MM-DD` strings in and always gives parsed `Date`s out.
 *
 * Changing `mode` later does not convert a value already set; reset `selected` with it. The first non-empty
 * `selected` moves the view to its month; later changes do not.
 *
 * @fires selected-change - After the selection changes from the UI; `detail` is the new `selected`.
 * @fires time-range-change - After the start or end time field changes; `detail` is the new `{ start, end }`.
 * @attr {'single' | 'range' | 'multi'} mode - What a click selects, and the shape of `selected`.
 * @attr {boolean} show-month-select - A month picker in place of the month name.
 * @attr {boolean} show-year-select - A year picker in place of the year, listing this year back 100 years.
 * @attr {boolean} show-time-select - A time field under the grid; see `time-mode`.
 * @attr {'single' | 'range'} time-mode - One time field, or a start and an end. Needs `show-time-select`.
 * @attr {0 | 1 | 2 | 3 | 4 | 5 | 6} week-starts-on - First column of the week as a `Date.getDay()` index. Defaults to 0, Sunday.
 * @attr {boolean} rtl - Mirrors the arrows. Set from the locale whenever it declares a direction.
 * @attr {string} locale - Id of a built-in dictionary (`en`, `he`, `ar`, `de`, `fr`, `es`, `ja`, `zh`, `ru`, `pt`); the `locale` property also takes a whole dictionary. Without it the page's `lang` decides, then English.
 * @attr {string} selected - Single-date shortcut for the `selected` property.
 * @cssprop --density-picker - Spacing multiplier for the picker family; falls back to `--density`.
 */
export class GeCalendar extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        mode: { reflect: true },
        showMonthSelect: { type: Boolean, attribute: 'show-month-select', reflect: true },
        showYearSelect: { type: Boolean, attribute: 'show-year-select', reflect: true },
        showTimeSelect: { type: Boolean, attribute: 'show-time-select', reflect: true },
        timeMode: { attribute: 'time-mode', reflect: true },
        weekStartsOn: { type: Number, attribute: 'week-starts-on' },
        rtl: { type: Boolean, reflect: true },
        locale: {},
        selected: { converter: selectedConverter },
        selectedTimeRange: { attribute: false },
        viewDate: { state: true },
    };

    declare mode: CalendarMode;
    declare showMonthSelect: boolean;
    declare showYearSelect: boolean;
    declare showTimeSelect: boolean;
    declare timeMode: CalendarTimeMode;
    declare weekStartsOn: WeekStart;
    declare rtl: boolean;
    declare locale: string | CalendarLocale | undefined;
    declare selected: CalendarSelection;
    declare selectedTimeRange: TimeRange;
    declare viewDate: Date;
    private viewInitialised = false;

    constructor() {
        super();
        this.mode = 'single';
        this.showMonthSelect = false;
        this.showYearSelect = false;
        this.showTimeSelect = false;
        this.timeMode = 'single';
        this.weekStartsOn = 0;
        this.rtl = false;
        this.locale = undefined;
        this.selected = null;
        this.selectedTimeRange = { start: '', end: '' };
        this.viewDate = new Date();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'calendar-host';
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('selected')) this.followFirstSelection();
        if (changed.has('locale')) {
            const rtl = this.dictionary.rtl;
            if (rtl !== undefined) this.rtl = rtl;
        }
    }

    private followFirstSelection(): void {
        if (this.viewInitialised) return;
        const first = this.firstSelectedDate();
        if (!first) return;
        this.viewDate = new Date(first);
        this.viewInitialised = true;
    }

    private firstSelectedDate(): Date | null {
        const value = this.selected;
        if (!value) return null;
        if (Array.isArray(value)) return value.length > 0 ? parseDate(value[0]) : null;
        if (typeof value === 'object' && 'start' in value) return value.start;
        return parseDate(value);
    }

    private get dictionary(): CalendarLocale {
        return resolveCalendarLocale(this.locale);
    }

    /** Weekday names in the order the grid shows them. */
    private get orderedDayNames(): string[] {
        const names = this.dictionary.dayNames;
        return [...names.slice(this.weekStartsOn), ...names.slice(0, this.weekStartsOn)];
    }

    private get monthIndex(): number {
        return this.viewDate.getMonth();
    }

    private get year(): number {
        return this.viewDate.getFullYear();
    }

    /** The cells of the visible month: `null` for the blank cells before the 1st, then each day. */
    private get cells(): (Date | null)[] {
        const first = new Date(this.year, this.monthIndex, 1);
        const lead = (first.getDay() - this.weekStartsOn + 7) % 7;
        const count = new Date(this.year, this.monthIndex + 1, 0).getDate();
        const cells: (Date | null)[] = new Array<Date | null>(lead).fill(null);
        for (let day = 1; day <= count; day++) cells.push(new Date(this.year, this.monthIndex, day));
        return cells;
    }

    private get years(): number[] {
        const now = new Date().getFullYear();
        return Array.from({ length: 101 }, (...[, offset]) => now - offset);
    }

    /** Whether `day` is a selected date; in a range only the two ends count. */
    isSelected(day: Date): boolean {
        const value = this.selected;
        if (!value) return false;
        if (this.mode === 'single') {
            const date = parseDate(value as CalendarDateValue);
            return date ? isSameDay(day, date) : false;
        }
        if (this.mode === 'multi') return (value as (Date | string)[]).some((item) => this.sameAs(item, day));
        const range = value as DateRange;
        return Boolean((range.start && isSameDay(day, range.start)) || (range.end && isSameDay(day, range.end)));
    }

    private sameAs(item: CalendarDateValue, day: Date): boolean {
        const date = parseDate(item);
        return date ? isSameDay(date, day) : false;
    }

    /** Whether `day` lies strictly between the ends of a complete range. */
    isInRange(day: Date): boolean {
        const range = this.completeRange();
        if (!range) return false;
        const time = day.getTime();
        const [low, high] = [Math.min(range.start.getTime(), range.end.getTime()), Math.max(range.start.getTime(), range.end.getTime())];
        return time > low && time < high;
    }

    private completeRange(): { start: Date; end: Date } | null {
        if (this.mode !== 'range') return null;
        const range = this.selected as DateRange | null;
        return range?.start && range.end ? { start: range.start, end: range.end } : null;
    }

    private isRangeEdge(day: Date, edge: 'start' | 'end'): boolean {
        const range = this.completeRange();
        return Boolean(range && isSameDay(day, range[edge]));
    }

    private setSelected(value: CalendarSelection): void {
        this.selected = value;
        this.dispatchEvent(new CustomEvent('selected-change', { detail: value, bubbles: true, composed: true }));
    }

    /**
     * Applies a day click for the current `mode`: single replaces, multi toggles, range fills start then end and
     * starts over once both are set (a click before the start swaps the two). The argument is not mutated.
     */
    selectDay(date: Date): void {
        const day = new Date(date);
        const timed = this.showTimeSelect && this.timeMode === 'range';
        if (this.mode === 'single') this.setSelected(this.pickSingle(day, timed));
        else if (this.mode === 'multi') this.setSelected(this.pickMulti(day, timed));
        else this.setSelected(this.pickRange(day, timed));
    }

    private pickSingle(day: Date, timed: boolean): Date {
        if (timed) {
            applyTime(day, this.selectedTimeRange.start);
            return day;
        }
        const current = parseDate(this.selected as CalendarDateValue);
        if (current) day.setHours(current.getHours(), current.getMinutes());
        return day;
    }

    private pickMulti(day: Date, timed: boolean): Date[] {
        const current = ((this.selected as (Date | string)[] | null) ?? []).map((item) => parseDate(item)).filter((d): d is Date => d !== null);
        if (current.some((d) => isSameDay(d, day))) return current.filter((d) => !isSameDay(d, day));
        if (timed) applyTime(day, this.selectedTimeRange.start);
        return [...current, day];
    }

    private pickRange(day: Date, timed: boolean): DateRange {
        const current = (this.selected as DateRange | null) ?? { start: null, end: null };
        const { start, end: time } = this.selectedTimeRange;
        if (!current.start || current.end) {
            if (timed) applyTime(day, start);
            return { start: day, end: null };
        }
        if (day < current.start) {
            if (timed) {
                applyTime(day, start);
                applyTime(current.start, time);
            }
            return { start: day, end: current.start };
        }
        if (timed) applyTime(day, time);
        return { start: current.start, end: day };
    }

    /** Moves the visible month back one without touching `selected`. */
    previousMonth(): void {
        this.viewDate = new Date(this.year, this.monthIndex - 1, 1);
    }

    /** Moves the visible month forward one without touching `selected`. */
    nextMonth(): void {
        this.viewDate = new Date(this.year, this.monthIndex + 1, 1);
    }

    private readonly onMonth = (event: CustomEvent<string>) => {
        this.viewDate = new Date(this.year, Number.parseInt(event.detail, 10), 1);
    };

    private readonly onYear = (event: CustomEvent<string>) => {
        this.viewDate = new Date(Number.parseInt(event.detail, 10), this.monthIndex, 1);
    };

    private setTimeRange(next: TimeRange): void {
        this.selectedTimeRange = next;
        this.dispatchEvent(new CustomEvent('time-range-change', { detail: next, bubbles: true, composed: true }));
    }

    private singleDate(): Date {
        return parseDate(this.selected as CalendarDateValue) ?? new Date(this.viewDate);
    }

    /** `HH:mm` of the single time field: the selected date's, or empty. */
    private get singleTime(): string {
        return formatTime(parseDate(this.selected as CalendarDateValue));
    }

    private get startTime(): string {
        const own = this.mode === 'range' ? formatTime((this.selected as DateRange | null)?.start ?? null) : formatTime(parseDate(this.selected as CalendarDateValue));
        return this.mode === 'multi' ? this.selectedTimeRange.start : own || this.selectedTimeRange.start;
    }

    private get endTime(): string {
        const own = this.mode === 'range' ? formatTime((this.selected as DateRange | null)?.end ?? null) : '';
        return own || this.selectedTimeRange.end;
    }

    private readonly onTime = (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        if (!value) return;
        const date = new Date(this.singleDate());
        applyTime(date, value);
        this.setSelected(date);
    };

    private readonly onStartTime = (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        if (!value) return;
        this.setTimeRange({ ...this.selectedTimeRange, start: value });
        if (this.mode === 'range') {
            const range = (this.selected as DateRange | null) ?? { start: null, end: null };
            if (!range.start) return;
            const start = new Date(range.start);
            applyTime(start, value);
            this.setSelected({ ...range, start });
        } else if (this.mode === 'single') {
            const date = new Date(this.singleDate());
            applyTime(date, value);
            this.setSelected(date);
        }
    };

    // In single and multi mode the end time lives only in the time range: a `Date` carries one time of day,
    // already claimed by the start field.
    private readonly onEndTime = (event: Event) => {
        const value = (event.target as HTMLInputElement).value;
        if (!value) return;
        this.setTimeRange({ ...this.selectedTimeRange, end: value });
        const range = this.selected as DateRange | null;
        if (this.mode !== 'range' || !range?.end) return;
        const end = new Date(range.end);
        applyTime(end, value);
        this.setSelected({ ...range, end });
    };

    private renderMonth(names: string[]) {
        if (!this.showMonthSelect) return html`<span>${names[this.monthIndex]}</span>`;
        return html`<ge-select position="popper" value=${String(this.monthIndex)} @value-change=${this.onMonth}>
            <ge-select-trigger class="month-trigger" aria-label="Month"><ge-select-value placeholder=${names[this.monthIndex]} display-value=${names[this.monthIndex]}></ge-select-value></ge-select-trigger>
            <ge-select-content>${names.map((name, index) => html`<ge-select-item value=${String(index)}>${name}</ge-select-item>`)}</ge-select-content>
        </ge-select>`;
    }

    private renderYear() {
        if (!this.showYearSelect) return html`<span>${this.year}</span>`;
        return html`<ge-select position="popper" value=${String(this.year)} @value-change=${this.onYear}>
            <ge-select-trigger class="year-trigger" aria-label="Year"><ge-select-value placeholder=${String(this.year)}></ge-select-value></ge-select-trigger>
            <ge-select-content class="year-list">${this.years.map((year) => html`<ge-select-item value=${String(year)}>${year}</ge-select-item>`)}</ge-select-content>
        </ge-select>`;
    }

    private renderDay(day: Date) {
        const selected = this.isSelected(day);
        const today = isSameDay(day, new Date());
        return html`<ge-button
            class="day"
            variant="ghost"
            aria-label=${String(day.getDate())}
            ?data-today=${today && !selected}
            ?data-selected=${selected}
            ?data-in-range=${this.isInRange(day) && !selected}
            ?data-range-start=${this.isRangeEdge(day, 'start')}
            ?data-range-end=${this.isRangeEdge(day, 'end')}
            @click=${() => this.selectDay(day)}
            >${day.getDate()}</ge-button
        >`;
    }

    private timeField(id: string, label: string, value: string, handler: (event: Event) => void) {
        return html`<div class="time-field">
            <label for=${id}>${label}</label>
            <div class="time-box">
                <input id=${id} type="time" dir=${this.rtl ? 'rtl' : nothing} .value=${value} @change=${handler} />
                <div class="time-icon">${CLOCK}</div>
            </div>
        </div>`;
    }

    private renderTime(t: CalendarLocale) {
        if (!this.showTimeSelect) return nothing;
        const body =
            this.timeMode === 'range'
                ? html`<div class="time-pair">${this.timeField('start-time', t.startTimeLabel ?? 'Start time', this.startTime, this.onStartTime)}${this.timeField('end-time', t.endTimeLabel ?? 'End time', this.endTime, this.onEndTime)}</div>`
                : this.timeField('time', t.timeLabel ?? 'Time', this.singleTime, this.onTime);
        return html`<div class="time">${body}</div>`;
    }

    protected override render() {
        const t = this.dictionary;
        return html`<div class="calendar" part="calendar" data-slot="calendar" dir=${this.rtl ? 'rtl' : nothing}>
            <div class="header">
                <ge-button variant="outline" size="icon-sm" aria-label=${t.prevMonthLabel ?? 'Previous month'} @click=${this.previousMonth}>${PREVIOUS}</ge-button>
                <div class="caption">${this.renderMonth(t.monthNames)}${this.renderYear()}</div>
                <ge-button variant="outline" size="icon-sm" aria-label=${t.nextMonthLabel ?? 'Next month'} @click=${this.nextMonth}>${NEXT}</ge-button>
            </div>
            <div class="weekdays">${this.orderedDayNames.map((name) => html`<div>${name}</div>`)}</div>
            <div class="days">${this.cells.map((day) => (day ? this.renderDay(day) : html`<div class="filler" data-slot="calendar-filler"></div>`))}</div>
            ${this.renderTime(t)}
        </div>`;
    }
}
