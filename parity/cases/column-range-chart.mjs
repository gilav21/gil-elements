import { utils, scale } from '../lib/chart-libs.mjs';
// shadcn-angular column-range-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
// Angular never sets the tooltip position, so the reference anchors it beside the column, as ge does.
const W = 576;
const H = 300;
const pt = (name, low, high, color) => ({ name, low, high, ...(color ? { color } : {}) });
const DATA = [pt('Jan', -3, 4), pt('Feb', -1, 7), pt('Mar', 2, 12), pt('Apr', 6, 17), pt('May', 10, 22), pt('Jun', 14, 26)];
const SWAPPED = [pt('A', 40, 10), pt('B', 5, 30), pt('C', 15, 15)];
const COLORED = [pt('Low', 10, 20, '#6366f1'), pt('High', 30, 80, '#06b6d4')];
const ALL_NEGATIVE = [pt('A', -50, -10), pt('B', -30, -20)];
const FLAT = [pt('Same', 50, 50), pt('Near', 50, 50.2), pt('Far', 20, 80)];
const FRACTION = [pt('A', 0.25, 0.75), pt('B', 0.1, 0.9)];

const ref = ({ data = DATA, rtl = false, grid = true, labels = true, radius = 4, gap = 12, unit = '', hover = null } = {}) => {
    const area = { left: rtl ? 20 : 70, right: W - (rtl ? 70 : 20), top: 30, bottom: H - 35 };
    const width = area.right - area.left;
    const bounds = utils.extent(data.flatMap((d) => [d.low, d.high]));
    const dom = bounds ? scale.niceDomain(bounds[0], bounds[1], 5) : [0, 100];
    const ys = scale.linearScale(dom, [area.bottom, area.top]);
    const ticks = ys.ticks(5);
    const size = (width - (data.length - 1) * gap) / data.length;
    const fmt = (v) => utils.formatChartValue(v, { decimals: 0 }) + unit;
    const axis = (v) => utils.formatChartValue(v, { compact: true, decimals: Number.isInteger(v) ? 0 : 6 }) + unit;
    const bars = data.map((p, i) => {
        const lo = Math.min(p.low, p.high);
        const hi = Math.max(p.low, p.high);
        const lowY = ys.scale(lo);
        const highY = ys.scale(hi);
        const x = rtl ? area.right - i * (size + gap) - size : area.left + i * (size + gap);
        const h = Math.max(1, lowY - highY);
        const y = lowY - highY < 1 ? (lowY + highY) / 2 - h / 2 : highY;
        return { i, p, lo, hi, lowY, highY, x, y, h, color: utils.getChartColor(i, p.color) };
    });
    const gridLines = grid ? `<g class="text-border">${ticks.map((t) => `<line x1="${area.left}" y1="${ys.scale(t)}" x2="${area.right}" y2="${ys.scale(t)}" stroke="currentColor" stroke-opacity="0.2" stroke-dasharray="4 4"/>`).join('')}</g>` : '';
    const tickText = `<g class="text-muted-foreground text-xs">${ticks.map((t) => `<text x="${rtl ? area.right + 12 : area.left - 12}" y="${ys.scale(t)}" text-anchor="end" dominant-baseline="middle" fill="currentColor">${axis(t)}</text>`).join('')}</g>`;
    const names = `<g class="text-muted-foreground text-xs">${bars.map((b) => `<text x="${b.x + size / 2}" y="${area.bottom + 16}" text-anchor="middle" fill="currentColor">${b.p.name}</text>`).join('')}</g>`;
    const groups = bars.map((b) => {
        const cls = `cursor-pointer outline-none${hover !== null && hover !== b.i ? ' opacity-50' : ''}`;
        const rcls = `transition-all duration-200 ease-out${hover === b.i ? ' brightness-110' : ''}`;
        const below = b.lowY + 14;
        const lowLabelY = below <= area.bottom + 2 ? below : b.lowY - 6;
        const lab = labels ? `<text x="${b.x + size / 2}" y="${b.highY - 6}" text-anchor="middle" class="text-xs font-medium fill-foreground pointer-events-none">${fmt(b.hi)}</text><text x="${b.x + size / 2}" y="${lowLabelY}" text-anchor="middle" class="text-xs font-medium fill-foreground pointer-events-none">${fmt(b.lo)}</text>` : '';
        return `<g class="${cls}" tabindex="0" role="button" aria-label="${b.p.name}: ${b.lo}${unit} to ${b.hi}${unit}"><rect x="${b.x}" y="${b.y}" width="${size}" height="${b.h}" rx="${radius}" fill="${b.color}" class="${rcls}"/>${lab}</g>`;
    }).join('');
    let tip = '';
    if (hover !== null) {
        const b = bars[hover];
        const x = b.x + size / 2 + 12;
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words${x > W * 0.7 ? ' -translate-x-full' : ''}" style="left:${x}px;top:${b.y - 8}px"><div class="font-medium">${b.p.name}</div><div class="text-muted-foreground">Range: ${fmt(b.lo)} – ${fmt(b.hi)}</div></div>`;
    }
    return `<ui-column-range-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative block w-full" data-slot="column-range-chart"><svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible" role="group" aria-label="${utils.getChartSummary('Column range chart', data.length)}">${gridLines}${tickText}${names}<g>${groups}</g></svg>${tip}</div></ui-column-range-chart>`;
};

const el = ({ data = DATA, rtl = false, grid = true, labels = true, radius = 4, gap = 12, unit = '', hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', grid ? '' : 'show-grid="false"', labels ? '' : 'show-range-labels="false"', radius === 4 ? '' : `bar-radius="${radius}"`, gap === 12 ? '' : `bar-gap="${gap}"`, unit ? `unit="${unit}"` : '', hover === null ? '' : `data-enter=".bar,${hover}"`].filter(Boolean).join(' ');
    return `<ge-column-range-chart ${attrs} data-props='${JSON.stringify({ data })}'></ge-column-range-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'column-range-chart',
    items: [
        pair('default'),
        pair('unit', { unit: '°C' }),
        pair('swapped-and-equal-ends', { data: SWAPPED }),
        pair('custom-colors', { data: COLORED }),
        pair('all-negative', { data: ALL_NEGATIVE }),
        pair('hairline-spans', { data: FLAT }),
        pair('fractions-round-in-labels', { data: FRACTION }),
        pair('no-grid', { grid: false }),
        pair('no-range-labels', { labels: false }),
        pair('square-and-tight', { radius: 0, gap: 2 }),
        pair('rtl', { rtl: true }),
        pair('hover', { hover: 2 }),
        pair('hover-flips-near-right-edge', { hover: 5, unit: '°' }),
    ],
};
