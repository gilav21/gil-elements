// Reference markup shared by the chart cases: the legend and tooltip as shadcn-angular renders them inside a chart.
import { utils } from './chart-libs.mjs';

export const colorOf = (index, color) => utils.getChartColor(index, color);

export const legendRef = (items, hidden = [], interactive = true) => {
    const body = items
        .map((item) => {
            const off = hidden.includes(item.key);
            return `<span data-slot="chart-legend-item" class="inline-flex items-center gap-1.5 ${interactive ? 'cursor-pointer select-none ' : ''}${off ? 'opacity-70' : ''}"${interactive ? ` role="button" tabindex="0" aria-pressed="${!off}"` : ''} aria-label="${item.label}"><span class="inline-block size-2.5 shrink-0 rounded-[2px]" style="background:${item.color}"></span><span class="${off ? 'line-through' : ''}">${item.label}</span></span>`;
        })
        .join('');
    return `<ui-chart-legend class="mt-2 justify-center contents"><div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2 justify-center" data-slot="chart-legend">${body}</div></ui-chart-legend>`;
};

export const tooltipRef = ({ x, y, title, rows, flipX = false }) => {
    const cls = `pointer-events-none absolute z-50 max-w-[calc(100vw-2rem)] rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg${flipX ? ' -translate-x-full' : ''}`;
    const head = title ? `<div class="mb-1 font-medium">${title}</div>` : '';
    const body = rows
        .map((row) => `<div class="flex items-center gap-2">${row.color ? `<span class="inline-block size-2 shrink-0 rounded-full" style="background:${row.color}"></span>` : ''}<span class="text-muted-foreground">${row.label}</span><span class="ml-auto font-medium tabular-nums">${row.value}</span></div>`)
        .join('');
    return `<ui-chart-tooltip class="contents"><div class="${cls}" data-slot="chart-tooltip" role="tooltip" style="left:${x}px;top:${y}px">${head}${body}</div></ui-chart-tooltip>`;
};
