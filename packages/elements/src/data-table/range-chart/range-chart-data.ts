import type { ChartDataPoint, ChartSeries } from '../../shared/chart/chart.types.js';

/**
 * What the dialog charts: row labels plus one numeric series per column. Declared here, not imported from the table, so the range
 * chart depends only on the chart and dialog elements; the table's `RangeChartPayload` (the `range-chart-open` detail) is the same
 * shape and passes straight in.
 */
export interface RangeChartData {
    categories: string[];
    series: { name: string; values: number[] }[];
}

export type RangeChartType = 'bar' | 'pie' | 'stacked';

export const RANGE_CHART_TYPES: readonly RangeChartType[] = ['bar', 'pie', 'stacked'];

/** At most this many rows go into the visually hidden data table; a range is usually small, a whole column is not. */
export const DATA_TABLE_ROW_CAP = 50;

/** A value the charts can draw: a missing or non-finite one (`NaN`, `Infinity`, a stray string) is 0, as Angular's `?? 0` for a missing one. */
const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** The payload's categories, or none. */
export const chartCategories = (payload: RangeChartData | null | undefined): string[] => payload?.categories ?? [];

/** Whether stacked means anything: more than one series. */
export const hasMultipleSeries = (payload: RangeChartData | null | undefined): boolean => (payload?.series.length ?? 0) > 1;

/** The series index actually used: the asked one when it exists, else the first (a new, smaller payload keeps working). */
export function seriesIndexOf(payload: RangeChartData | null | undefined, index: number): number {
    const count = payload?.series.length ?? 0;
    return Number.isInteger(index) && index >= 0 && index < count ? index : 0;
}

/** The chart type drawn: stacked needs several series, so with one it falls back to bar (whose switch is the one shown pressed). */
export const effectiveChartType = (payload: RangeChartData | null | undefined, type: RangeChartType): RangeChartType =>
    type === 'stacked' && !hasMultipleSeries(payload) ? 'bar' : type;

/** Bar data: one series (the first by default, as Angular) mapped onto the categories. */
export function barData(payload: RangeChartData | null | undefined, index = 0): ChartDataPoint[] {
    const series = payload?.series[seriesIndexOf(payload, index)];
    if (!payload || !series) return [];
    return payload.categories.map((name, i) => ({ name, value: finite(series.values[i]) }));
}

/**
 * Pie data: the bar data without the negative values, which a pie cannot draw (Angular passes them through and the pie breaks), and
 * whether any were dropped, so the dialog can say so. Zeros stay: the pie draws no slice for them.
 */
export function pieData(payload: RangeChartData | null | undefined, index = 0): { data: ChartDataPoint[]; droppedNegatives: boolean } {
    const all = barData(payload, index);
    const data = all.filter((point) => point.value >= 0);
    return { data, droppedNegatives: data.length < all.length };
}

/** Stacked data: every series across the categories. */
export function stackedSeries(payload: RangeChartData | null | undefined): ChartSeries[] {
    if (!payload) return [];
    return payload.series.map((series) => ({
        name: series.name,
        data: payload.categories.map((name, i) => ({ name, value: finite(series.values[i]) })),
    }));
}

/** The visually hidden data table: the charted series as columns, at most `cap` category rows, and the row count before the cap. */
export function dataTableOf(
    payload: RangeChartData | null | undefined,
    type: RangeChartType,
    index = 0,
    cap = DATA_TABLE_ROW_CAP,
): { columns: string[]; rows: { category: string; values: number[] }[]; total: number } {
    if (!payload) return { columns: [], rows: [], total: 0 };
    const shown = effectiveChartType(payload, type) === 'stacked' ? payload.series : payload.series.slice(seriesIndexOf(payload, index)).slice(0, 1);
    const rows = payload.categories.slice(0, Math.max(0, cap)).map((category, i) => ({ category, values: shown.map((series) => finite(series.values[i])) }));
    return { columns: shown.map((series) => series.name), rows, total: payload.categories.length };
}
