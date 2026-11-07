import { html } from 'lit';
import { formatTime, parseDate } from '../calendar/calendar.utils.js';
import { PickerBase } from './picker-base.js';

/** Reads `date` from an attribute: a `YYYY-MM-DD` (or other parseable) date string. */
const dateConverter = { fromAttribute: (value: string | null): Date | null => parseDate(value) };

/**
 * A button that shows the picked date and opens a calendar to change it. Picking a day closes the panel, unless
 * `show-time` is set: then it stays open so the time can still be set.
 *
 * It is form-associated: with a `name` it submits the date as `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with `show-time`.
 * Escape closes the panel and puts focus back on the button; a click outside closes it. Closing never changes the value.
 *
 * @fires date-change - After the user picks a date; `detail` is the `Date`.
 * @attr {string} name - Field name; with it the value is submitted with the surrounding form.
 * @attr {string} placeholder - Muted text while no date is picked. Defaults to "Pick a date".
 * @attr {boolean} disabled - Disables the button.
 * @attr {boolean} show-time - Adds a time field to the calendar and the time to the button's label.
 * @attr {string} locale - BCP 47 tag for the calendar's names and the button's date format. Defaults to `en`.
 * @attr {string} date - Initial date as `YYYY-MM-DD`; the `date` property takes a `Date` or `null`.
 * @csspart trigger - The button; style its width and border here.
 * @cssprop --density-picker - Spacing multiplier for the picker family; falls back to `--density`.
 */
export class GeDatePicker extends PickerBase {
    static override readonly properties = { ...PickerBase.properties, date: { converter: dateConverter } };

    declare date: Date | null;
    private defaultDate: Date | null | undefined;
    protected readonly slotName = 'date-picker';

    constructor() {
        super();
        this.placeholder = 'Pick a date';
        this.date = null;
    }

    protected override label(): string | null {
        if (!this.date) return null;
        return this.date.toLocaleDateString(this.locale, this.formatOptions({ year: 'numeric', month: 'long', day: 'numeric' }));
    }

    protected override formValue(): string {
        const date = this.date;
        if (!date) return '';
        const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return this.showTime ? `${day}T${formatTime(date)}` : day;
    }

    protected override resetValue(): void {
        this.date = this.defaultDate ?? null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.defaultDate === undefined) this.defaultDate = this.date;
    }

    private readonly onSelected = (event: CustomEvent<unknown>) => {
        event.stopPropagation();
        this.date = event.detail instanceof Date ? event.detail : null;
        this.dispatchEvent(new CustomEvent('date-change', { detail: this.date, bubbles: true, composed: true }));
        if (!this.showTime) this.hide();
    };

    protected override calendar() {
        return html`<ge-calendar mode="single" show-month-select show-year-select ?show-time-select=${this.showTime} locale=${this.locale} .selected=${this.date} @selected-change=${this.onSelected}></ge-calendar>`;
    }

}
