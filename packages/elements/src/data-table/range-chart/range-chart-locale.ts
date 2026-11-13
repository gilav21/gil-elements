/** The strings of `ge-data-table-range-chart`. Angular prints the raw `bar|pie|stacked` identifiers and an English title; here they are strings. */
export interface RangeChartLocale {
    /** The dictionary's language id. */
    code: string;
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
    /** The same when no charted series has a name: `{title}` and `{type}`. */
    chartLabelNoSeries: string;
    /** Caption of the visually hidden data table. `{shown}` and `{total}` are filled in when the table is capped. */
    dataTable: string;
    dataTableCapped: string;
    /** Header of the category column of the data table. */
    category: string;
    /** Accessible name of the dialog's close button. */
    close: string;
}

/**
 * Per-language dictionaries; `en` is the fallback. A plain mutable object: a later locale module adds `he` etc. Resolved like the
 * table's (`pickLocale`): the `locale` setting, then the page's `lang`, then `en`, which also fills what a dictionary leaves out.
 */
export const RANGE_CHART_LOCALES: Record<string, RangeChartLocale | undefined> & { en: RangeChartLocale } = {
    en: {
        code: 'en',
        title: 'Chart',
        bar: 'Bar',
        pie: 'Pie',
        stacked: 'Stacked',
        chartType: 'Chart type',
        series: 'Series',
        negativeNote: 'Negative values are left out of the pie.',
        chartLabel: '{title}, {type} chart: {series}',
        chartLabelNoSeries: '{title}, {type} chart',
        dataTable: 'Chart data',
        dataTableCapped: 'Chart data, first {shown} of {total} rows',
        category: 'Category',
        close: 'Close',
    },
};
