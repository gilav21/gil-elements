import { boxplotStats, scale, utils } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular boxplot.component.ts and .html; the summaries and scales are the code it runs.
const W = 500;
const API = [12, 14, 15, 15, 16, 17, 18, 19, 21, 22, 24, 95];
const WEB = [30, 32, 35, 36, 38, 40, 41, 44, 47, 52];
const DB = [5, 6, 6, 7, 7, 8, 9, 9, 10, 12, 30];
const GROUPS = [{ label: 'API', values: API }, { label: 'Web', values: WEB }, { label: 'DB', values: DB }];
const MIXED = [{ label: 'skipped' }, { label: 'given', stats: { min: 10, q1: 20, median: 30, q3: 40, max: 50, outliers: [90] }, color: '#f59e0b' }, { label: 'Raw', values: WEB }, { label: 'Flat', values: [5, 5, 5] }];
const FLAT = [{ label: 'flat', values: [5, 5, 5] }, { label: 'wide', values: [1, 9, 4, 6] }];

const ref = ({ groups = GROUPS, horizontal = false, rtl = false, grid = true, outliers = true, tooltip = true, radius = 2, unit = '', height = 300, hover = null } = {}) => {
    const items = groups.map((group, sourceIndex) => ({ group, stats: boxplotStats.resolveGroupStats(group), sourceIndex })).filter((r) => r.stats !== null);
    const summary = utils.getChartSummary('Box plot', items.length);
    if (items.length === 0) return `<ui-boxplot class="block"><div class="relative w-full" data-slot="boxplot" role="group" aria-label="${summary}"><div data-slot="boxplot-empty" class="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:p-6" style="min-height:${height}px">No data to display</div></div></ui-boxplot>`;
    const axisLeft = horizontal ? 72 : 48;
    const a = { left: rtl ? 16 : axisLeft, right: W - (rtl ? axisLeft : 16), top: 16, bottom: height - 28 };
    const range = utils.extent(items.flatMap(({ stats }) => [stats.min, stats.max, stats.q1, stats.q3, ...stats.outliers]));
    const domain = range ? scale.niceDomain(range[0], range[1], 5) : [0, 1];
    const vs = scale.linearScale(domain, horizontal ? (rtl ? [a.right, a.left] : [a.left, a.right]) : [a.bottom, a.top]);
    const keys = items.map((_, i) => String(i));
    const bands = scale.bandScale(!horizontal && rtl ? [...keys].reverse() : keys, horizontal ? [a.top, a.bottom] : [a.left, a.right], 0.4, 0.2);
    const band = Math.abs(bands.bandwidth);
    const fmt = (v) => utils.formatChartValue(v, { decimals: 2 }) + unit;
    const num = (n) => n;
    const boxes = items.map((r, i) => {
        const s = r.stats;
        const [q1, q3, med, min, max] = [s.q1, s.q3, s.median, s.min, s.max].map((v) => vs.scale(v));
        const start = bands.position(String(i)) ?? 0;
        const c = start + band / 2;
        const cap = (band * 0.5) / 2;
        const color = utils.getChartColor(r.sourceIndex, r.group.color);
        const base = { i, r, color, s };
        if (!horizontal) return { ...base, x: start, y: Math.min(q1, q3), w: band, h: Math.max(1, Math.abs(q1 - q3)), med: [start, start + band, med, med], whisk: [c, c, Math.min(min, max), Math.max(min, max)], minCap: [c - cap, c + cap, min, min], maxCap: [c - cap, c + cap, max, max], lx: c, ly: height - 10, la: 'middle', out: s.outliers.map((v) => [c, vs.scale(v), v]) };
        return { ...base, x: Math.min(q1, q3), y: start, w: Math.max(1, Math.abs(q3 - q1)), h: band, med: [med, med, start, start + band], whisk: [Math.min(min, max), Math.max(min, max), c, c], minCap: [min, min, c - cap, c + cap], maxCap: [max, max, c - cap, c + cap], lx: rtl ? a.right + 8 : a.left - 8, ly: c + 3, la: rtl ? 'start' : 'end', out: s.outliers.map((v) => [vs.scale(v), c, v]) };
    });
    const line = (slot, [x1, x2, y1, y2], color, w) => `<line data-slot="${slot}" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="${color}" stroke-width="${w}"/>`;
    const ticks = vs.ticks(5).map((value) => {
        const at = vs.scale(value);
        return horizontal ? { value, l: [at, at, a.top, a.bottom], lx: at, ly: a.bottom + 14, an: 'middle' } : { value, l: [a.left, a.right, at, at], lx: rtl ? a.right + 8 : a.left - 8, ly: at + 3, an: rtl ? 'start' : 'end' };
    });
    const gridLines = grid ? ticks.map((t) => `<line data-slot="grid-line" x1="${t.l[0]}" x2="${t.l[1]}" y1="${t.l[2]}" y2="${t.l[3]}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const tickText = ticks.map((t) => `<text x="${t.lx}" y="${t.ly}" text-anchor="${t.an}" class="fill-muted-foreground text-[10px]">${fmt(t.value)}</text>`).join('');
    const labels = boxes.map((b) => `<text x="${b.lx}" y="${b.ly}" text-anchor="${b.la}" class="fill-muted-foreground text-[10px]">${b.r.group.label}</text>`).join('');
    const body = boxes.map((b) => {
        const dim = hover !== null && hover !== b.i;
        const label = `${b.r.group.label}: median ${fmt(b.s.median)}, Q1 ${fmt(b.s.q1)}, Q3 ${fmt(b.s.q3)}, min ${fmt(b.s.min)}, max ${fmt(b.s.max)}`;
        const dots = outliers ? b.out.map(([cx, cy, v]) => `<circle data-slot="boxplot-outlier" cx="${cx}" cy="${cy}" r="3" fill="none" stroke="${b.color}" stroke-width="1.5" class="cursor-pointer outline-none" tabindex="0" role="button" aria-label="${b.r.group.label}: outlier ${fmt(v)}"/>`).join('') : '';
        return `<g data-slot="boxplot-box" class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${label}">${line('boxplot-whisker', b.whisk, b.color, 1.5)}${line('boxplot-whisker-cap', b.minCap, b.color, 1.5)}${line('boxplot-whisker-cap', b.maxCap, b.color, 1.5)}<rect x="${num(b.x)}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${radius}" fill="${b.color}" fill-opacity="0.35" stroke="${b.color}" stroke-width="1.5" class="transition-[filter] duration-200 ease-out${hover === b.i ? ' brightness-110' : ''}"/>${line('boxplot-median', b.med, b.color, 2.5)}</g>${dots}`;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const b = boxes[hover];
        const x = b.x + b.w / 2 + 8;
        const s = b.s;
        tip = tooltipRef({ x, y: Math.max(8, b.y - 8), title: b.r.group.label, rows: [{ label: 'Max', value: fmt(s.max), color: b.color }, { label: 'Q3', value: fmt(s.q3) }, { label: 'Median', value: fmt(s.median) }, { label: 'Q1', value: fmt(s.q1) }, { label: 'Min', value: fmt(s.min) }], flipX: x > W * 0.7 });
    }
    return `<ui-boxplot class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="boxplot" role="group" aria-label="${summary}"><svg viewBox="0 0 ${W} ${height}" width="100%" height="${height}" class="block w-full overflow-visible">${gridLines}${tickText}${labels}${body}</svg>${tip}</div></ui-boxplot>`;
};
const el = ({ groups = GROUPS, horizontal = false, rtl = false, grid = true, outliers = true, tooltip = true, radius = 2, unit = '', height = 300, hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', horizontal ? 'orientation="horizontal"' : '', height === 300 ? '' : `height="${height}"`, grid ? '' : 'show-grid="false"', outliers ? '' : 'show-outliers="false"', tooltip ? '' : 'show-tooltip="false"', radius === 2 ? '' : `box-radius="${radius}"`, unit ? `unit="${unit}"` : '', hover === null ? '' : `data-enter="[data-slot=boxplot-box],${hover}"`].filter(Boolean).join(' ');
    return `<ge-boxplot ${attrs} data-props='${JSON.stringify({ groups })}'></ge-boxplot>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'boxplot',
    items: [
        pair('vertical'),
        pair('horizontal', { horizontal: true }),
        pair('mixed-sources', { groups: MIXED }),
        pair('flat-groups', { groups: FLAT }),
        pair('empty', { groups: [{ label: 'x' }] }),
        pair('no-grid', { grid: false }),
        pair('no-outliers', { outliers: false }),
        pair('square-boxes-with-unit', { radius: 0, unit: 'ms' }),
        pair('short', { height: 180 }),
        pair('rtl', { rtl: true }),
        pair('rtl-horizontal', { rtl: true, horizontal: true }),
        pair('hover', { hover: 1, unit: 'ms' }),
        pair('hover-near-right-edge', { hover: 2 }),
        pair('hover-horizontal', { hover: 0, horizontal: true }),
        pair('hover-without-tooltip', { hover: 1, tooltip: false }),
    ],
};
