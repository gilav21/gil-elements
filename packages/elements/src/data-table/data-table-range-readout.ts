/**
 * The overlays of the range part (wave 6, package A): the range readout (html 1488-1515: Count, and Sum / Avg / Min / Max plus a Chart button when
 * the range holds numbers) and the fill handle. Both are drawn inside the viewport after the table and carry `data-pointer-transparent`, so the
 * interaction controller looks a release through them to the cell below (a readout BUTTON is a control and is never offered to the sessions).
 * The readout is a named group whose values are plain text: it is not a live region (a drag would flood it); the range part announces a summary,
 * debounced, through the table's live region (`readoutText`).
 */
import { html, nothing, type TemplateResult } from 'lit';
import type { DataTableLocale } from './data-table.locales.js';
import type { RangeAggregateStats } from './data-table.types.js';

export interface ReadoutLabels {
    count: string;
    sum: string;
    avg: string;
    min: string;
    max: string;
    chart: string;
    group: string;
}

/** The readout's labels from the table's locale (the optional range labels are English-filled, as in Angular's `rangeLabels`). */
export function readoutLabels(locale: DataTableLocale): ReadoutLabels {
    return {
        count: locale.rangeCount ?? 'Count',
        sum: locale.rangeSum ?? 'Sum',
        avg: locale.rangeAvg ?? 'Avg',
        min: locale.rangeMin ?? 'Min',
        max: locale.rangeMax ?? 'Max',
        chart: locale.rangeChart ?? 'Chart',
        group: locale.rangeReadoutLabel,
    };
}

/** The label / value pairs the readout shows, in order: Count always, the numeric aggregates only when the range holds a number. */
export function readoutEntries(stats: RangeAggregateStats, labels: ReadoutLabels): [label: string, value: string][] {
    const entries: [string, string][] = [[labels.count, String(stats.count)]];
    if (stats.numericCount > 0) entries.push([labels.sum, stats.sum], [labels.avg, stats.avg], [labels.min, stats.min], [labels.max, stats.max]);
    return entries;
}

/** The readout as one sentence for the live region: "Count: 6, Sum: 21, ...". */
export function readoutText(stats: RangeAggregateStats, labels: ReadoutLabels): string {
    return readoutEntries(stats, labels)
        .map(([label, value]) => `${label}: ${value}`)
        .join(', ');
}

export function renderReadout(stats: RangeAggregateStats, labels: ReadoutLabels, chart: boolean, onChart: () => void): TemplateResult {
    return html`<div data-slot="range-actions" role="group" aria-label=${labels.group} data-pointer-transparent>
        ${readoutEntries(stats, labels).map(([label, value]) => html`<span data-label>${label}: <span data-value>${value}</span></span>`)}
        ${chart && stats.numericCount > 0
            ? html`<ge-button data-slot="range-chart" size="sm" variant="outline" aria-label=${labels.chart} @click=${onChart}><ge-icon name="bar-chart-3" size="xs" aria-hidden="true"></ge-icon>${labels.chart}</ge-button>`
            : nothing}
    </div>`;
}

/** The single fill handle, at a point of the viewport's content (px; the css centres it there). `aria-hidden`: Ctrl+D is its keyboard alternative. */
export function renderFillHandle(at: { top: number; left: number }): TemplateResult {
    return html`<span data-slot="fill-handle" data-pointer-transparent aria-hidden="true" style="top: ${at.top}px; left: ${at.left}px"></span>`;
}
