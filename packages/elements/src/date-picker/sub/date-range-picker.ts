import { html } from 'lit';
import type { DateRange, TimeRange } from '../../calendar/calendar.utils.js';
import { PickerBase } from '../picker-base.js';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoTime = (d: Date) => `${isoDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Like `ge-date-picker`, for a start and an end. The panel closes once both are picked, unless `show-time` is
 * set. The button reads `Jan 5, 2026 - Jan 9, 2026`, or `Jan 5, 2026 - ...` while the end is missing.
 *
 * With a `name` the form gets `start/end`, each as `YYYY-MM-DD` (or `YYYY-MM-DDTHH:mm` with `show-time`), and
 * nothing until both are set.
 *
 * @fires range-change - After the user picks a day; `detail` is `{ start, end }`.
 * @fires time-range-change - After a time field changes; `detail` is `{ start, end }` as `HH:mm`.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} placeholder - Muted text while nothing is picked. Defaults to "Pick a date range".
 * @attr {boolean} disabled - Disables the button.
 * @attr {boolean} show-time - Adds start and end time fields to the calendar and times to the button's label.
 * @attr {string} locale - BCP 47 tag for the calendar's names and the button's date format. Defaults to `en`.
 * @csspart trigger - The button; style its width and border here.
 * @cssprop --density-picker - Spacing multiplier for the picker family; falls back to `--density`.
 */
export class GeDateRangePicker extends PickerBase {
    static override readonly properties = { ...PickerBase.properties, range: { attribute: false }, timeRange: { attribute: false } };

    declare range: DateRange;
    declare timeRange: TimeRange;
    private defaultRange?: DateRange;
    protected readonly slotName = 'date-range-picker';

    constructor() {
        super();
        this.placeholder = 'Pick a date range';
        this.range = { start: null, end: null };
        this.timeRange = { start: '', end: '' };
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.defaultRange ??= this.range;
    }

    private text(date: Date): string {
        return date.toLocaleDateString(this.locale, this.formatOptions({ month: 'short', day: 'numeric', year: 'numeric' }));
    }

    protected override label(): string | null {
        const { start, end } = this.range;
        if (!start) return null;
        return `${this.text(start)} - ${end ? this.text(end) : '...'}`;
    }

    protected override formValue(): string {
        const { start, end } = this.range;
        if (!start || !end) return '';
        const format = this.showTime ? isoTime : isoDay;
        return `${format(start)}/${format(end)}`;
    }

    protected override resetValue(): void {
        this.range = this.defaultRange ?? { start: null, end: null };
    }

    private readonly onSelected = (event: CustomEvent<unknown>) => {
        event.stopPropagation();
        const value = event.detail;
        if (!value || typeof value !== 'object' || !('start' in value)) return;
        this.range = value as DateRange;
        this.dispatchEvent(new CustomEvent('range-change', { detail: this.range, bubbles: true, composed: true }));
        if (this.range.start && this.range.end && !this.showTime) this.hide();
    };

    private readonly onTimeRange = (event: CustomEvent<TimeRange>) => {
        event.stopPropagation();
        this.timeRange = event.detail;
        this.dispatchEvent(new CustomEvent('time-range-change', { detail: this.timeRange, bubbles: true, composed: true }));
    };

    protected override calendar() {
        return html`<ge-calendar
            mode="range"
            show-month-select
            show-year-select
            ?show-time-select=${this.showTime}
            time-mode="range"
            locale=${this.locale}
            .selected=${this.range}
            .selectedTimeRange=${this.timeRange}
            @selected-change=${this.onSelected}
            @time-range-change=${this.onTimeRange}
        ></ge-calendar>`;
    }
}
