import { html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { UiElement } from '@gilav21/elements-base';
import type { ChartSeries } from '../../shared/chart/chart.types.js';
import {
    barData,
    chartCategories,
    dataTableOf,
    effectiveChartType,
    hasMultipleSeries,
    pieData,
    RANGE_CHART_TYPES,
    seriesIndexOf,
    stackedSeries,
    type RangeChartData,
    type RangeChartType,
} from './range-chart-data.js';
import { interpolate } from '../../shared/interpolate.js';
import { pickLocale } from '../../shared/locale-lookup.js';
import { RANGE_CHART_LOCALES, type RangeChartLocale } from './range-chart-locale.js';
import css from './range-chart.css?inline';

/** The chart's height (bar, stacked) and the pie's box, in px: Angular's `280`. */
const CHART_SIZE = 280;

const stop = (event: Event): void => event.stopPropagation();

/**
 * A dialog that charts a data-table range selection: bar, pie or (with several series) stacked bars. Give it the table's
 * `range-chart-open` detail as `payload` and open it, or set `for` to the table's id and it does both itself when the range
 * readout's Chart button is pressed. It imports nothing of the table.
 *
 * Bar and pie chart one series, the first unless the series picker (shown with several series) says otherwise. A pie leaves out
 * negative values and says so. The chart is a named figure with a visually hidden data table of what it draws (at most 50 rows).
 *
 * `heading` is not called `title` (Angular's input) because `title` is a native attribute: the browser would show it as a tooltip.
 *
 * @fires open-change - The user closed the dialog, or `for`'s table opened it; `detail` is the new state. Setting `open` yourself does not fire it.
 * @fires chart-type-change - The user picked another chart type; `detail` is the type.
 * @fires series-change - The user picked another series for the bar and pie chart; `detail` is its index.
 * @attr {boolean} open - Whether the dialog is showing.
 * @attr {string} heading - Dialog title; defaults to the locale's "Chart".
 * @attr {'bar' | 'pie' | 'stacked'} chart-type - The chart drawn. `stacked` with a single series draws a bar chart.
 * @attr {number} series-index - The series the bar and pie chart draw; out of range means the first.
 * @attr {string} for - Id of a `ge-data-table` in the same document or shadow root: its `range-chart-open` sets `payload` and opens the dialog.
 * @attr {string} locale - Locale id (or, as a property, a partial dictionary); an unknown id or none means the page's `lang` (`<html lang>`), then `en`, as the table resolves its own.
 * @prop {RangeChartData | null} payload - The categories and series to chart; the table's `RangeChartPayload` fits.
 * @csspart body - The wrapper of the switcher, the chart and the note (Angular's `class` input lands here).
 */
export class GeDataTableRangeChart extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        payload: { attribute: false },
        open: { type: Boolean, reflect: true },
        heading: {},
        chartType: { attribute: 'chart-type', reflect: true },
        seriesIndex: { type: Number, attribute: 'series-index' },
        for: {},
        locale: {},
    };

    declare payload: RangeChartData | null;
    declare open: boolean;
    declare heading: string;
    declare chartType: RangeChartType;
    declare seriesIndex: number;
    declare for: string;
    declare locale: string | Partial<RangeChartLocale>;

    /** The root node the `for` listener sits on; the table's event bubbles (composed) up to it. */
    private source: Document | ShadowRoot | null = null;

    constructor() {
        super();
        this.payload = null;
        this.open = false;
        this.heading = '';
        this.chartType = 'bar';
        this.seriesIndex = 0;
        this.for = '';
        this.locale = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'data-table-range-chart';
        this.listen();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unlisten();
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        // a new payload keeps the picked series index; `seriesIndexOf` clamps it to the new range when it no longer exists
        if (changed.has('for') && this.isConnected) this.listen();
    }

    /** Listens on the root node rather than on the table, so a table mounted, replaced or given its id after this element still works. */
    private listen(): void {
        this.unlisten();
        if (!this.for) return;
        const root = this.getRootNode();
        if (!(root instanceof Document || root instanceof ShadowRoot)) return;
        this.source = root;
        root.addEventListener('range-chart-open', this.onRangeChartOpen);
    }

    private unlisten(): void {
        this.source?.removeEventListener('range-chart-open', this.onRangeChartOpen);
        this.source = null;
    }

    private readonly onRangeChartOpen = (event: Event): void => {
        // the original target (first in the composed path), not the retargeted one: a table inside a nested shadow root is found
        // too, while an ancestor that happens to carry the id is not
        const origin = event.composedPath()[0];
        if (!this.for || !(origin instanceof Element) || origin.id !== this.for) return;
        const detail = (event as CustomEvent<RangeChartData | null>).detail;
        if (!detail) return;
        this.payload = detail;
        this.setOpen(true);
    };

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: next, bubbles: true, composed: true }));
    }

    private get text(): RangeChartLocale {
        // the page's language, as the table takes it (a shadow root has no `lang` to inherit); a server render has no document
        return pickLocale(RANGE_CHART_LOCALES, this.locale as string | RangeChartLocale, this.ownerDocument?.documentElement?.lang ?? '');
    }

    /** The dialog's own `open-change` becomes this element's; the series picker's (it bubbles through the dialog) is kept inside. */
    private readonly onDialogOpenChange = (event: Event): void => {
        event.stopPropagation();
        if (event.target === event.currentTarget) this.setOpen((event as CustomEvent<boolean>).detail);
    };

    private pickType(type: RangeChartType): void {
        // the user's pick wins: a click on Bar while a one-series `stacked` (or a typo) draws bar makes it `bar`; the event only for a new value
        if (this.chartType === type) return;
        this.chartType = type;
        this.dispatchEvent(new CustomEvent<RangeChartType>('chart-type-change', { detail: type, bubbles: true, composed: true }));
    }

    private readonly onSeriesChange = (event: Event): void => {
        event.stopPropagation();
        const index = Number((event as CustomEvent<unknown>).detail);
        if (!Number.isInteger(index) || index === this.seriesIndex) return;
        this.seriesIndex = index;
        this.dispatchEvent(new CustomEvent<number>('series-change', { detail: index, bubbles: true, composed: true }));
    };

    protected override render(): TemplateResult {
        const t = this.text;
        return html`<ge-dialog .open=${live(this.open)} @open-change=${this.onDialogOpenChange}>
            <ge-dialog-content heading=${this.heading || t.title} close-label=${t.close}>
                ${this.open ? this.body(t) : nothing}
            </ge-dialog-content>
        </ge-dialog>`;
    }

    private body(t: RangeChartLocale): TemplateResult {
        const payload = this.payload;
        const type = effectiveChartType(payload, this.chartType);
        const index = seriesIndexOf(payload, this.seriesIndex);
        const multiple = hasMultipleSeries(payload);
        const pie = type === 'pie' ? pieData(payload, index) : null;
        return html`<div class="body" part="body" data-slot="range-chart">
            <div class="controls">
                <div class="switcher" role="group" aria-label=${t.chartType} data-slot="range-chart-switcher">
                    ${RANGE_CHART_TYPES.filter((option) => option !== 'stacked' || multiple).map(
                        (option) => html`<ge-button
                            size="sm"
                            data-type=${option}
                            variant=${option === type ? 'default' : 'outline'}
                            aria-pressed=${option === type ? 'true' : 'false'}
                            @click=${() => this.pickType(option)}
                            >${t[option]}</ge-button
                        >`,
                    )}
                </div>
                ${multiple && type !== 'stacked' ? this.seriesPicker(t, index) : nothing}
            </div>
            <div class="scroll" data-slot="range-chart-scroll">
                <div class="canvas" role="figure" aria-label=${this.chartLabel(t, type, index)} data-slot="range-chart-canvas">
                    ${this.chart(type, index, pie)} ${this.dataTable(t, type, index)}
                </div>
                ${pie?.droppedNegatives ? html`<p class="note" data-slot="range-chart-note">${t.negativeNote}</p>` : nothing}
            </div>
        </div>`;
    }

    private seriesPicker(t: RangeChartLocale, index: number): TemplateResult {
        const series = this.payload?.series ?? [];
        return html`<div class="series" data-slot="range-chart-series">
            <span id="series-label" class="series-label">${t.series}</span>
            <ge-select
                aria-labelledby="series-label"
                position="popper"
                .options=${series.map((_, i) => i)}
                .displayWith=${(option: unknown) => series[option as number]?.name ?? ''}
                .value=${live(index)}
                @value-change=${this.onSeriesChange}
                @input=${stop}
                @change=${stop}
            ></ge-select>
        </div>`;
    }

    private chart(type: RangeChartType, index: number, pie: ReturnType<typeof pieData> | null): TemplateResult {
        const heading = this.heading || this.text.title;
        if (type === 'pie') return html`<ge-pie-chart heading=${heading} .data=${pie?.data ?? []} .size=${CHART_SIZE}></ge-pie-chart>`;
        if (type === 'stacked') {
            const series: ChartSeries[] = stackedSeries(this.payload);
            return html`<ge-stacked-bar-chart heading=${heading} .series=${series} .categories=${chartCategories(this.payload)} .height=${CHART_SIZE}></ge-stacked-bar-chart>`;
        }
        return html`<ge-bar-chart heading=${heading} .data=${barData(this.payload, index)} .height=${CHART_SIZE}></ge-bar-chart>`;
    }

    private chartLabel(t: RangeChartLocale, type: RangeChartType, index: number): string {
        const series = this.payload?.series ?? [];
        const names = type === 'stacked' ? series.map((s) => s.name) : [series[index]?.name ?? ''];
        const named = names.filter(Boolean).join(', ');
        return interpolate(named ? t.chartLabel : t.chartLabelNoSeries, { title: this.heading || t.title, type: t[type], series: named });
    }

    private dataTable(t: RangeChartLocale, type: RangeChartType, index: number): TemplateResult | typeof nothing {
        const table = dataTableOf(this.payload, type, index);
        if (table.rows.length === 0) return nothing;
        const caption = table.rows.length < table.total ? interpolate(t.dataTableCapped, { shown: table.rows.length, total: table.total }) : t.dataTable;
        // the wrapper is what is clipped: a table box does not shrink below its content
        return html`<div class="sr-only"><table data-slot="range-chart-data">
            <caption>${caption}</caption>
            <thead>
                <tr>
                    <th scope="col">${t.category}</th>
                    ${table.columns.map((name) => html`<th scope="col">${name}</th>`)}
                </tr>
            </thead>
            <tbody>
                ${table.rows.map(
                    (row) => html`<tr>
                        <th scope="row">${row.category}</th>
                        ${row.values.map((value) => html`<td>${value}</td>`)}
                    </tr>`,
                )}
            </tbody>
        </table></div>`;
    }
}
