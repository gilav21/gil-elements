import { html, nothing, type PropertyValues, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../../button/define.js';
import '../../calendar/define.js';
import { type CalendarLocale, resolveCalendarLocale } from '../../shared/calendar-locales.js';
import { type DateRangePreset, defaultDateRangePresets, isCompleteRange } from '../data-table-filter-panels.js';
import type { DataTableDateRange } from '../data-table.types.js';
import { asEditableDate } from '../data-table.utils.js';
import css from './data-table-filters-panels.css?inline';

const EMPTY: DataTableDateRange = Object.freeze({ start: null, end: null }) as DataTableDateRange;

/**
 * The ready-made date-range filter panel of a data-table column (shadcn-angular `ui-data-table-date-range-filter`): quick ranges and
 * Clear over a range calendar. Pair it with `dateRangeFilterFn`. A range is reported only once both ends are picked (the first click is
 * kept in the panel, silent); a preset is reported at once, by reference.
 *
 * @fires filter-change - The complete range `{ start, end }`, or `null` for Clear.
 * @attr {string} heading - Optional heading above the buttons (Angular's `title` input; not `title`, which is the global tooltip attribute).
 * @attr {string} locale - Calendar dictionary id; labels, the built-in presets and direction follow it.
 */
export class GeDataTableDateRangeFilter extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { attribute: false },
        presets: { attribute: false },
        heading: {},
        locale: {},
        selected: { state: true },
    };

    declare value: DataTableDateRange | null;
    /** Replaces the built-in quick ranges; an empty list keeps them. */
    declare presets: DateRangePreset[];
    declare heading: string;
    declare locale: string | CalendarLocale | undefined;
    declare selected: DataTableDateRange;

    constructor() {
        super();
        this.value = null;
        this.presets = [];
        this.heading = '';
        this.locale = undefined;
        this.selected = EMPTY;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        // Both ends read like cells (`asEditableDate`): a range restored from JSON (ISO strings) shows its days; a value that is not a range shows none.
        if (changed.has('value')) {
            const value = this.value as { start?: unknown; end?: unknown } | null;
            const start = value && typeof value === 'object' ? asEditableDate(value.start) : null;
            const end = value && typeof value === 'object' ? asEditableDate(value.end) : null;
            this.selected = start || end ? { start, end } : EMPTY;
        }
    }

    private emit(value: DataTableDateRange | null): void {
        this.dispatchEvent(new CustomEvent('filter-change', { detail: value, bubbles: true, composed: true }));
    }

    private readonly onSelect = (event: CustomEvent<unknown>): void => {
        event.stopPropagation();
        const value = event.detail;
        if (!value || typeof value !== 'object' || !('start' in value)) return;
        this.selected = value as DataTableDateRange;
        if (isCompleteRange(value)) this.emit(value);
    };

    private apply(preset: DateRangePreset): void {
        this.selected = preset.range;
        this.emit(preset.range);
    }

    private readonly clear = (): void => {
        this.selected = EMPTY;
        this.emit(null);
    };

    protected override render() {
        const locale = resolveCalendarLocale(this.locale);
        const presets = this.presets.length > 0 ? this.presets : defaultDateRangePresets(locale);
        return html`<div part="base" data-slot="date-range-filter" dir=${locale.rtl ? 'rtl' : nothing}>
            ${this.heading ? html`<div class="title"><span>${this.heading}</span></div>` : nothing}
            <div class="actions">
                ${presets.map((preset) => html`<ge-button variant="outline" size="sm" @click=${() => this.apply(preset)}>${preset.label}</ge-button>`)}
                <ge-button variant="ghost" size="sm" @click=${this.clear}>${locale.clearLabel ?? 'Clear'}</ge-button>
            </div>
            <ge-calendar mode="range" show-month-select show-year-select .locale=${this.locale} .selected=${this.selected} @selected-change=${this.onSelect}></ge-calendar>
        </div>`;
    }
}
