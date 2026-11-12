import { html, nothing, type PropertyValues, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import '../../calendar/define.js';
import { type CalendarLocale, resolveCalendarLocale } from '../../shared/calendar-locales.js';
import { asEditableDate } from '../data-table.utils.js';
import css from './data-table-filters-panels.css?inline';

/**
 * The ready-made date filter panel of a data-table column (shadcn-angular `ui-data-table-date-filter`): Today and Clear over a single-date
 * calendar with month and year selects. Give its tag as the column's `filterComponent` and pair it with `dateFilterFn`; the table hands it
 * the current filter as `value` on every render and listens for `filter-change`.
 *
 * @fires filter-change - The picked day (`Date`; Today is local midnight), or `null` for Clear.
 * @attr {string} heading - Optional heading above the buttons (Angular's `title` input; not `title`, which is the global tooltip attribute).
 * @attr {string} locale - Calendar dictionary id (`en`, `he`, ...); the property also takes a dictionary. Labels and direction follow it.
 */
export class GeDataTableDateFilter extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { attribute: false },
        heading: {},
        locale: {},
        selected: { state: true },
    };

    /** The current filter, re-supplied by the table: mirrored into the calendar, which the panel also updates itself (it works uncontrolled). */
    declare value: Date | string | number | null;
    declare heading: string;
    declare locale: string | CalendarLocale | undefined;
    declare selected: Date | null;

    constructor() {
        super();
        this.value = null;
        this.heading = '';
        this.locale = undefined;
        this.selected = null;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        // Read like a cell (`asEditableDate`): a value restored from JSON (an ISO string) or a timestamp shows its day, anything else none.
        if (changed.has('value')) this.selected = asEditableDate(this.value);
    }

    private emit(value: Date | null): void {
        this.selected = value;
        this.dispatchEvent(new CustomEvent('filter-change', { detail: value, bubbles: true, composed: true }));
    }

    private readonly onSelect = (event: CustomEvent<unknown>): void => {
        event.stopPropagation();
        if (event.detail instanceof Date) this.emit(event.detail);
    };

    private readonly today = (): void => {
        const now = new Date();
        this.emit(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    };

    private readonly clear = (): void => this.emit(null);

    protected override render() {
        const locale = resolveCalendarLocale(this.locale);
        return html`<div part="base" data-slot="date-filter" dir=${locale.rtl ? 'rtl' : nothing}>
            ${this.heading ? html`<div class="title"><span>${this.heading}</span></div>` : nothing}
            <div class="actions">
                <ge-button variant="outline" size="sm" @click=${this.today}>${locale.todayLabel ?? 'Today'}</ge-button>
                <ge-button variant="ghost" size="sm" @click=${this.clear}>${locale.clearLabel ?? 'Clear'}</ge-button>
            </div>
            <ge-calendar mode="single" show-month-select show-year-select .locale=${this.locale} .selected=${this.selected} @selected-change=${this.onSelect}></ge-calendar>
        </div>`;
    }
}
