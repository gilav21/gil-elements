import { utils } from '../lib/chart-libs.mjs';
// shadcn-angular pie-chart-drilldown.component.ts and .html: the geometry is computed with the same helpers it uses. Angular
// never positions its tooltip (it stays at 0,0); the reference puts it beside the slice's centroid, as the pie chart does.
const pt = (name, value, extra = {}) => ({ name, value, ...extra });
const DATA = [pt('Fruit', 500, { drilldown: 'fruit' }), pt('Veg', 300, { drilldown: 'veg' }), pt('Dairy', 150), pt('Orphan', 50, { drilldown: 'missing' })];
const SERIES = [
    { id: 'fruit', name: 'Fruit', data: [pt('Apple', 240), pt('Pear', 160), pt('Plum', 100)] },
    { id: 'veg', name: 'Vegetables', data: [pt('Kale', 90), pt('Leek', 0), pt('Beet', 210)] },
];
const EMPTY_SERIES = [{ id: 'none', name: 'Nothing here', data: [] }];

const ref = ({ data = DATA, series = SERIES, open = null, title, size = 300, inner = 0, labels = true, legend = true, position = 'right', breadcrumb = true, back = 'Back', hover = null } = {}) => {
    const drill = (p) => !!p.drilldown && series.some((s) => s.id === p.drilldown);
    const shown = open ? (series.find((s) => s.id === open)?.data ?? []) : data;
    const name = open ? (series.find((s) => s.id === open)?.name ?? '') : (title ?? 'Overview');
    const total = shown.reduce((sum, p) => sum + utils.positiveOrZero(p.value), 0);
    const outer = size / 2 - 10;
    let angle = -Math.PI / 2;
    const entries = shown.map((point, index) => {
        const share = total === 0 ? 0 : utils.positiveOrZero(point.value) / total;
        const start = angle;
        const end = angle + share * Math.PI * 2;
        angle = end;
        return { index, point, percentage: share * 100, color: utils.getChartColor(index, point.color), path: share > 0 ? utils.describeArc(0, 0, outer, outer * inner, start, end) : '', centroid: utils.getSliceCentroid(0, 0, outer, start, end) };
    });
    const slices = entries.filter((e) => e.percentage > 0);
    const horizontal = position === 'left' || position === 'right';
    const containerCls = `relative inline-flex gap-4 items-center max-w-full ${horizontal ? 'flex-col sm:flex-row' : 'flex-col'}${position === 'left' ? ' sm:flex-row-reverse' : ''}${position === 'top' ? ' flex-col-reverse' : ''}`.replace(position === 'top' ? ' flex-col flex-col-reverse' : '\u0000', ' flex-col-reverse');
    const legendCls = `flex gap-2 ${horizontal ? 'flex-row flex-wrap justify-center sm:flex-col sm:flex-nowrap sm:justify-start' : 'flex-row flex-wrap justify-center'}`;
    const label = (p, e) => `${utils.getPointAriaLabel(p.name, p.value, e.percentage, total)}${drill(p) ? '. Press Enter to drill down.' : ''}`;
    const paths = slices.map((s) => {
        const dim = hover !== null && hover !== s.index;
        const isHover = hover === s.index;
        const light = s.color.includes('yellow') || s.color.includes('50%)');
        const text = labels && s.percentage >= 5 ? `<text x="${s.centroid.x}" y="${s.centroid.y}" text-anchor="middle" dominant-baseline="middle" class="text-xs font-medium ${light ? 'fill-foreground' : 'fill-white'} pointer-events-none">${utils.formatPercentage(s.percentage, 1)}</text>` : '';
        return `<g class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${label(s.point, s)}"><path d="${s.path}" fill="${s.color}" class="transition-all duration-200 ease-out${isHover ? ' scale-105' : ''}" transform-origin="0 0" style="filter: ${isHover ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' : 'none'}"/>${text}</g>`;
    }).join('');
    const empty = slices.length === 0 ? `<circle data-slot="pie-empty" r="${outer}" fill="none" stroke="currentColor" class="text-border" stroke-dasharray="4 4"/>` : '';
    const chevron = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>';
    const legendHtml = legend && position !== 'none'
        ? `<div class="${legendCls}">${entries.map((e) => `<button type="button" class="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity${hover !== null && hover !== e.index ? ' opacity-50' : ''}"><span class="w-3 h-3 rounded-sm shrink-0" style="background-color:${e.color}"></span><span class="text-muted-foreground truncate">${e.point.name}</span><span class="text-foreground font-medium">${utils.formatChartValue(e.point.value)}</span>${drill(e.point) ? chevron : ''}</button>`).join('')}</div>`
        : '';
    let tip = '';
    if (hover !== null) {
        const s = slices.find((e) => e.index === hover);
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words" style="left:${size / 2 + s.centroid.x + 12}px;top:${size / 2 + s.centroid.y - 8}px"><div class="font-medium">${s.point.name}</div><div class="text-muted-foreground">${utils.formatChartValue(s.point.value)} (${utils.formatPercentage(s.percentage, 1)})</div>${drill(s.point) ? '<div class="text-xs text-primary mt-1">Click to drill down</div>' : ''}</div>`;
    }
    const crumb = open && breadcrumb
        ? `<div class="flex items-center gap-2 mb-4"><button type="button" class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>${back}</button><span class="text-muted-foreground">/</span><span class="text-sm font-medium">${name}</span></div>`
        : '';
    return `<ui-pie-chart-drilldown class="block"><div class="relative inline-block max-w-full" data-slot="pie-chart-drilldown">${crumb}<div class="${containerCls}"><svg role="group" aria-label="${utils.getChartSummary('Pie chart with drilldown', shown.length, name)}" viewBox="0 0 ${size} ${size}" width="100%" height="auto" style="max-width:${size}px;aspect-ratio:1 / 1" class="overflow-visible shrink-0"><g transform="translate(${size / 2},${size / 2})">${empty}${paths}</g></svg>${legendHtml}${tip}</div></div></ui-pie-chart-drilldown>`;
};

const el = ({ data = DATA, series = SERIES, open = null, title, size = 300, inner = 0, labels = true, legend = true, position = 'right', breadcrumb = true, back = 'Back', hover = null } = {}) => {
    const attrs = [size === 300 ? '' : `size="${size}"`, inner ? `inner-radius="${inner}"` : '', labels ? '' : 'show-labels="false"', legend ? '' : 'show-legend="false"', position === 'right' ? '' : `legend-position="${position}"`, breadcrumb ? '' : 'show-breadcrumb="false"', back === 'Back' ? '' : `back-button-text="${back}"`, title ? `heading="${title}"` : '', hover === null ? '' : `data-hover-slice="${hover}"`].filter(Boolean).join(' ');
    return `<ge-pie-chart-drilldown ${attrs} data-props='${JSON.stringify({ data, drilldownSeries: series, currentDrilldownId: open })}'></ge-pie-chart-drilldown>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:640px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'pie-chart-drilldown',
    items: [
        pair('top-level'),
        pair('drilled-down', { open: 'fruit' }),
        pair('drilled-donut-zero-slice', { open: 'veg', inner: 0.6 }),
        pair('drilled-localised-back', { open: 'fruit', back: 'חזרה' }),
        pair('drilled-without-breadcrumb', { open: 'fruit', breadcrumb: false }),
        pair('drilled-into-empty-series', { open: 'none', series: EMPTY_SERIES, data: [pt('Zero', 5, { drilldown: 'none' })] }),
        pair('legend-bottom', { position: 'bottom' }),
        pair('legend-top-drilled', { position: 'top', open: 'fruit' }),
        pair('no-legend-no-labels', { legend: false, labels: false }),
        pair('hover-drillable-slice', { hover: 0 }),
        pair('hover-plain-slice', { hover: 2 }),
        pair('hover-orphan-drilldown-id-is-inert', { hover: 3 }),
        pair('hover-drilled-slice', { open: 'fruit', hover: 1 }),
    ],
};
