import { histogram, scale, utils } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular histogram.component.ts and .html; the bins come from the same computeBins it uses.
const W = 500;
const H = 300;
const SAMPLE = [12, 15, 17, 18, 21, 22, 22, 24, 25, 25, 26, 27, 29, 30, 31, 33, 35, 36, 38, 41, 44, 47, 52, 58, 63];
const SKEWED = [1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5, 6, 8, 11, 15, 22, 40];
const WITH_JUNK = [...SAMPLE, Number.NaN, Number.POSITIVE_INFINITY];
const SAME = [7, 7, 7, 7];

const ref = ({ values = SAMPLE, binCount, binEdges, rtl = false, grid = true, counts = true, tooltip = true, radius = 2, gap = 2, color, unit = '', hover = null } = {}) => {
    const bins = histogram.computeBins(values, { binCount, binEdges });
    if (bins.length === 0) return `<ui-histogram class="block"><div class="relative w-full" data-slot="histogram" role="group" aria-label="${utils.getChartSummary('Histogram', 0)}"><div data-slot="histogram-empty" class="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:p-6" style="min-height:${H}px">No data to display</div></div></ui-histogram>`;
    const area = { left: rtl ? 12 : 44, right: W - (rtl ? 44 : 12), top: 12, bottom: H - 28 };
    const max = Math.max(0, utils.extent(bins.map((b) => b.count))?.[1] ?? 0);
    const ys = scale.linearScale(max > 0 ? scale.niceDomain(0, max, 5) : [0, 1], [area.bottom, area.top]);
    const xs = scale.linearScale([bins[0].start, bins.at(-1).end], rtl ? [area.right, area.left] : [area.left, area.right]);
    const fmt = (v) => utils.formatChartValue(v, { decimals: 2 }) + unit;
    const range = (b) => `${fmt(b.start)} – ${fmt(b.end)}`;
    const whole = ys.ticks(5).filter((t) => Number.isInteger(t));
    const ticks = (whole.length > 0 ? whole : [0]).map((value) => ({ value, y: ys.scale(value) }));
    const fill = utils.getChartColor(0, color);
    const bars = bins.map((bin, index) => {
        const a = xs.scale(bin.start);
        const b = xs.scale(bin.end);
        const slot = Math.abs(b - a);
        const width = Math.max(1, slot - gap);
        const y = ys.scale(bin.count);
        return { index, bin, x: Math.min(a, b) + (slot - width) / 2, y, width, height: Math.max(0, area.bottom - y) };
    });
    const gridLines = grid ? ticks.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const countText = ticks.map((g) => `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${g.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const edgeText = [bins[0].start, ...bins.map((b) => b.end)].map((v) => `<text x="${xs.scale(v)}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${fmt(v)}</text>`).join('');
    const body = bars.map((bar) => {
        const dim = hover !== null && hover !== bar.index;
        const hot = hover === bar.index;
        const text = counts && bar.bin.count > 0 ? `<text x="${bar.x + bar.width / 2}" y="${bar.y - 4}" text-anchor="middle" class="pointer-events-none fill-foreground text-[10px] font-medium">${bar.bin.count}</text>` : '';
        return `<g data-slot="histogram-bar" class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${range(bar.bin)}: ${bar.bin.count}"><rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${radius}" fill="${fill}" class="transition-[filter] duration-200 ease-out${hot ? ' brightness-110' : ''}"/>${text}</g>`;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const bar = bars[hover];
        const x = bar.x + bar.width / 2 + 8;
        tip = tooltipRef({ x, y: Math.max(8, bar.y - 8), title: range(bar.bin), rows: [{ label: 'Count', value: utils.formatChartValue(bar.bin.count, { decimals: 0 }), color: fill }], flipX: x > W * 0.7 });
    }
    return `<ui-histogram class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="histogram" role="group" aria-label="${utils.getChartSummary('Histogram', bins.length)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible">${gridLines}${countText}${edgeText}${body}</svg>${tip}</div></ui-histogram>`;
};

const el = ({ values = SAMPLE, binCount, binEdges, rtl = false, grid = true, counts = true, tooltip = true, radius = 2, gap = 2, color, unit = '', hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', binCount ? `bin-count="${binCount}"` : '', grid ? '' : 'show-grid="false"', counts ? '' : 'show-values="false"', tooltip ? '' : 'show-tooltip="false"', radius === 2 ? '' : `bar-radius="${radius}"`, gap === 2 ? '' : `bar-gap="${gap}"`, color ? `color="${color}"` : '', unit ? `unit="${unit}"` : '', hover === null ? '' : `data-enter=".group,${hover}"`].filter(Boolean).join(' ');
    return `<ge-histogram ${attrs} data-props='${JSON.stringify({ values, ...(binEdges ? { binEdges } : {}) })}'></ge-histogram>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'histogram',
    items: [
        pair('default'),
        pair('bin-count', { binCount: 8 }),
        pair('bin-edges', { binEdges: [0, 20, 40, 80] }),
        pair('skewed-sample', { values: SKEWED }),
        pair('non-finite-dropped', { values: WITH_JUNK }),
        pair('no-variance', { values: SAME }),
        pair('empty', { values: [] }),
        pair('no-grid', { grid: false }),
        pair('no-counts', { counts: false }),
        pair('square-no-gap', { radius: 0, gap: 0 }),
        pair('custom-color-and-unit', { color: '#f59e0b', unit: 'ms' }),
        pair('rtl', { rtl: true }),
        pair('hover', { hover: 2 }),
        pair('hover-near-right-edge', { hover: 5 }),
        pair('hover-without-tooltip', { hover: 1, tooltip: false }),
    ],
};
