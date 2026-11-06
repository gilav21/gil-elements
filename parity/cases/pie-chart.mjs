import { utils } from '../lib/chart-libs.mjs';
// shadcn-angular pie-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const pt = (name, value, color) => ({ name, value, ...(color ? { color } : {}) });
const DATA = [pt('Chrome', 540), pt('Safari', 210), pt('Firefox', 120), pt('Edge', 90), pt('Other', 40)];
const SKEWED = [pt('Big', 970), pt('Tiny', 20), pt('Small', 10)];
const WITH_ZERO = [pt('Alpha', 60), pt('Beta', 0), pt('Gamma', -5), pt('Delta', 40)];
const COLORED = [pt('Red', 40, '#ef4444'), pt('Green', 35, '#22c55e'), pt('Yellow', 25, 'yellow')];

// Angular puts both fill-white and fill-foreground on a light slice's label and white wins, so the dark label it intends never shows; the reference applies the fix.
const ref = ({ data = DATA, size = 300, inner = 0, labels = true, legend = true, position = 'right', hover = null } = {}) => {
    const total = data.reduce((sum, p) => sum + utils.positiveOrZero(p.value), 0);
    const outer = size / 2 - 10;
    const innerPx = outer * inner;
    let angle = -Math.PI / 2;
    const entries = data.map((point, index) => {
        const share = total === 0 ? 0 : utils.positiveOrZero(point.value) / total;
        const start = angle;
        const end = angle + share * Math.PI * 2;
        angle = end;
        return { index, point, percentage: share * 100, color: utils.getChartColor(index, point.color), path: share > 0 ? utils.describeArc(0, 0, outer, innerPx, start, end) : '', centroid: utils.getSliceCentroid(0, 0, outer, start, end) };
    });
    const slices = entries.filter((e) => e.percentage > 0);
    const horizontal = position === 'left' || position === 'right';
    const containerCls = `relative inline-flex gap-4 items-center max-w-full ${horizontal ? 'flex-col sm:flex-row' : 'flex-col'}${position === 'left' ? ' sm:flex-row-reverse' : ''}${position === 'top' ? ' flex-col-reverse' : ''}`.replace(position === 'top' ? ' flex-col flex-col-reverse' : '\u0000', ' flex-col-reverse');
    const legendCls = `flex gap-2 ${horizontal ? 'flex-row flex-wrap justify-center sm:flex-col sm:flex-nowrap sm:justify-start' : 'flex-row flex-wrap justify-center'}`;
    const paths = slices.map((s) => {
        const dim = hover !== null && hover !== s.index;
        const isHover = hover === s.index;
        const light = s.color.includes('yellow') || s.color.includes('50%)');
        const label = labels && s.percentage >= 5 ? `<text x="${s.centroid.x}" y="${s.centroid.y}" text-anchor="middle" dominant-baseline="middle" class="text-xs font-medium ${light ? 'fill-foreground' : 'fill-white'} pointer-events-none">${utils.formatPercentage(s.percentage, 1)}</text>` : '';
        return `<g class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${utils.getPointAriaLabel(s.point.name, s.point.value, s.percentage, total)}"><path d="${s.path}" fill="${s.color}" class="transition-all duration-200 ease-out${isHover ? ' scale-105' : ''}" transform-origin="0 0" style="filter: ${isHover ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none'}"/>${label}</g>`;
    }).join('');
    const empty = slices.length === 0 ? `<circle data-slot="pie-empty" r="${outer}" fill="none" stroke="currentColor" class="text-border" stroke-dasharray="4 4"/>` : '';
    const legendHtml = legend && position !== 'none'
        ? `<div class="${legendCls}">${entries.map((e) => `<button type="button" class="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity${hover !== null && hover !== e.index ? ' opacity-50' : ''}"><span class="w-3 h-3 rounded-sm shrink-0" style="background-color:${e.color}"></span><span class="text-muted-foreground truncate">${e.point.name}</span><span class="text-foreground font-medium">${utils.formatChartValue(e.point.value)}</span></button>`).join('')}</div>`
        : '';
    let tip = '';
    if (hover !== null) {
        const s = slices.find((e) => e.index === hover);
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words" style="left:${size / 2 + s.centroid.x + 12}px;top:${size / 2 + s.centroid.y - 8}px"><div class="font-medium">${s.point.name}</div><div class="text-muted-foreground">${utils.formatChartValue(s.point.value)} (${utils.formatPercentage(s.percentage, 1)})</div></div>`;
    }
    return `<ui-pie-chart class="block"><div class="${containerCls}" data-slot="pie-chart"><svg role="group" aria-label="${utils.getChartSummary('Pie chart', data.length)}" viewBox="0 0 ${size} ${size}" width="100%" height="auto" style="max-width:${size}px;aspect-ratio:1 / 1" class="overflow-visible shrink-0"><g transform="translate(${size / 2},${size / 2})">${empty}${paths}</g></svg>${legendHtml}${tip}</div></ui-pie-chart>`;
};

const el = ({ data = DATA, size = 300, inner = 0, labels = true, legend = true, position = 'right', hover = null } = {}) => {
    const attrs = [size === 300 ? '' : `size="${size}"`, inner ? `inner-radius="${inner}"` : '', labels ? '' : 'show-labels="false"', legend ? '' : 'show-legend="false"', position === 'right' ? '' : `legend-position="${position}"`, hover === null ? '' : `data-hover-slice="${hover}"`].filter(Boolean).join(' ');
    return `<ge-pie-chart ${attrs} data-props='${JSON.stringify({ data })}'></ge-pie-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:640px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'pie-chart',
    items: [
        pair('default'),
        pair('donut', { inner: 0.6 }),
        pair('small-size', { size: 200 }),
        pair('legend-left', { position: 'left' }),
        pair('legend-top', { position: 'top' }),
        pair('legend-bottom', { position: 'bottom' }),
        pair('legend-none', { position: 'none' }),
        pair('legend-hidden', { legend: false }),
        pair('no-labels', { labels: false }),
        pair('small-slices-unlabelled', { data: SKEWED }),
        pair('zero-and-negative', { data: WITH_ZERO }),
        pair('all-zero', { data: [pt('A', 0), pt('B', 0)] }),
        pair('custom-colors-light-label', { data: COLORED }),
        pair('hover-slice', { hover: 1 }),
        pair('hover-donut', { hover: 0, inner: 0.6 }),
        pair('hover-first-slice', { hover: 0 }),
    ],
};
