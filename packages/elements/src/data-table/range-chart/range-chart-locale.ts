import { lookupLocale } from '../../shared/locale-id.js';

/** The strings of `ge-data-table-range-chart`. Angular prints the raw `bar|pie|stacked` identifiers and an English title; here they are strings. */
export interface RangeChartLocale {
    /** Dialog title when `heading` is not set. */
    title: string;
    bar: string;
    pie: string;
    stacked: string;
    /** Name of the group of chart-type switches. */
    chartType: string;
    /** Label of the series picker (bar and pie chart one series). */
    series: string;
    /** Shown under a pie whose series has negative values, which a pie cannot draw. */
    negativeNote: string;
    /** Accessible name of the chart; `{title}`, `{type}` and `{series}` (the charted series names) are filled in. */
    chartLabel: string;
    /** Caption of the visually hidden data table. `{shown}` and `{total}` are filled in when the table is capped. */
    dataTable: string;
    dataTableCapped: string;
    /** Header of the category column of the data table. */
    category: string;
    /** Accessible name of the dialog's close button. */
    close: string;
}

/** Per-language dictionaries; `en` is the fallback. A plain mutable object: a later locale module adds `he` etc. */
export const RANGE_CHART_LOCALES: Record<string, RangeChartLocale | undefined> & { en: RangeChartLocale } = {
    en: {
        title: 'Chart',
        bar: 'Bar',
        pie: 'Pie',
        stacked: 'Stacked',
        chartType: 'Chart type',
        series: 'Series',
        negativeNote: 'Negative values are left out of the pie.',
        chartLabel: '{title}, {type} chart: {series}',
        dataTable: 'Chart data',
        dataTableCapped: 'Chart data, first {shown} of {total} rows',
        category: 'Category',
        close: 'Close',
    },
};

/** An object is used as it is; a string picks its entry (`pt-BR`, then `pt`); otherwise `lang` decides; `en` is the fallback. */
export function resolveRangeChartLocale(override: string | RangeChartLocale | null | undefined, lang: string): RangeChartLocale {
    if (typeof override === 'object' && override !== null) return { ...RANGE_CHART_LOCALES.en, ...override };
    const code = override || lang;
    return (code ? lookupLocale(RANGE_CHART_LOCALES, code) : undefined) ?? RANGE_CHART_LOCALES.en;
}

/** Fills `{name}` placeholders; an unknown one stays as written. */
export const fill = (text: string, values: Record<string, string | number>): string =>
    text.replaceAll(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : match));
