import { utils, scale, path, interaction } from '../lib/chart-libs.mjs';
import { colorOf, legendRef, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular area-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const H = 300;
const CATS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const make = (name, values, color) => ({ name, ...(color ? { color } : {}), data: CATS.map((c, i) => ({ name: c, value: values[i] })) });
const SERIES = [make('Revenue', [120, 200, 150, 280, 240, 320]), make('Costs', [90, 110, 130, 150, 140, 180])];
const GAP = [make('Revenue', [120, 200, null, 280, 240, 320])];
const NEGATIVE = [make('Delta', [-40, 20, -10, 60, 30, -20])];

// Angular scales a `null` value as 0 (`null - d0`), though its docs call it a gap; the reference applies the fix.
const lineRef = ({ series = SERIES, curve = 'linear', stacked = false, mode = 'absolute', opacity = 0.25, showGrid = true, showLegend = true, showCrosshair = true, hidden = [], rtl = false, hover = null } = {}) => {
    const key = (s) => s.id ?? s.name;
    const visible = series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.includes(key(s)));
    const area = { left: rtl ? 12 : 44, right: W - (rtl ? 44 : 12), top: 12, bottom: H - 28 };
    const n = series[0].data.length;
    const xs = scale.linearScale([0, Math.max(1, n - 1)], rtl ? [area.right, area.left] : [area.left, area.right]);
    const bands = stacked ? path.stackSeries(visible.map((v) => v.s), mode) : null;
    const domain = stacked ? scale.zeroBasedDomain(bands.flatMap((band) => band.flatMap((b) => [b.lower, b.upper])), 5) : scale.zeroBasedDomain(visible.flatMap(({ s }) => s.data.map((d) => d.value)), 5);
    const ys = scale.linearScale(domain, [area.bottom, area.top]);
    const ticks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
    const grid = showGrid ? ticks.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const yText = ticks.map((g) => `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${g.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const xText = series[0].data.map((d, i) => `<text x="${xs.scale(i)}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${d.name}</text>`).join('');
    const cross = showCrosshair && hover !== null ? `<line data-slot="crosshair" x1="${xs.scale(hover)}" x2="${xs.scale(hover)}" y1="${area.top}" y2="${area.bottom}" class="stroke-muted-foreground/50" stroke-width="1"/>` : '';
    const baseline = ys.scale(0);
    const paths = visible.map(({ s, i }, k) => {
        if (stacked) {
            const upper = bands[k].map((b, index) => ({ x: xs.scale(index), y: ys.scale(b.upper) }));
            const lower = bands[k].map((b, index) => ({ x: xs.scale(index), y: ys.scale(b.lower) }));
            return { color: colorOf(i, s.color), area: path.bandAreaPath(upper, lower, curve), line: path.linePath(upper, curve) };
        }
        const points = s.data.map((d, index) => ({ x: xs.scale(index), y: Number.isFinite(d.value) ? ys.scale(d.value) : Number.NaN }));
        return { color: colorOf(i, s.color), area: path.areaPath(points, baseline, curve), line: path.linePath(points, curve) };
    });
    const areas = paths.map((p) => `<path data-slot="area-series" d="${p.area}" fill="${p.color}" fill-opacity="${opacity}" stroke="none"/><path d="${p.line}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    let tooltip = '';
    if (hover !== null) {
        const px = xs.scale(hover) + 12;
        tooltip = tooltipRef({ x: px, y: 60, title: series[0].data[hover].name, rows: visible.map(({ s, i }) => ({ label: s.name, value: utils.formatChartValueOrGap(s.data[hover]?.value), color: colorOf(i, s.color) })), flipX: px > W * 0.7 });
    }
    const legend = showLegend ? legendRef(series.map((s, i) => ({ key: key(s), label: s.name, color: colorOf(i, s.color) })), hidden) : '';
    const label = utils.getChartSummary('Area chart', n);
    return `<ui-area-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="area-chart" role="group" aria-label="${label}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${grid}${yText}${xText}${areas}${cross}</svg>${tooltip}${legend}</div></ui-area-chart>`;
};

const hoverX = (series, hover, rtl) => {
    const area = { left: rtl ? 12 : 44, right: W - (rtl ? 44 : 12) };
    return scale.linearScale([0, Math.max(1, series[0].data.length - 1)], rtl ? [area.right, area.left] : [area.left, area.right]).scale(hover);
};
const elOf = ({ series = SERIES, curve, stacked = false, mode = 'absolute', opacity = 0.25, showGrid = true, showLegend = true, showCrosshair = true, hidden = [], rtl = false, hover = null } = {}) => {
    const attrs = [curve ? `curve="${curve}"` : '', stacked ? 'stacked' : '', mode === 'absolute' ? '' : `stacking-mode="${mode}"`, opacity === 0.25 ? '' : `fill-opacity="${opacity}"`, showGrid ? '' : 'show-grid="false"', showLegend ? '' : 'show-legend="false"', showCrosshair ? '' : 'show-crosshair="false"', rtl ? 'dir="rtl"' : '', hover === null ? '' : `data-hover-at="${hoverX(series, hover, rtl)},68"`].filter(Boolean).join(' ');
    return `<ge-area-chart ${attrs} data-props='${JSON.stringify({ series, hiddenKeys: hidden })}'></ge-area-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: lineRef(opts), el: elOf(opts) });

export default {
    name: 'area-chart',
    items: [
        pair('default'),
        pair('monotone', { curve: 'monotone' }),
        pair('step', { curve: 'step' }),
        pair('stacked', { stacked: true }),
        pair('stacked-monotone', { stacked: true, curve: 'monotone' }),
        pair('stacked-percent', { stacked: true, mode: 'percent' }),
        pair('fill-opacity', { opacity: 0.6 }),
        pair('no-grid', { showGrid: false }),
        pair('no-legend', { showLegend: false }),
        pair('hidden-series', { hidden: ['Costs'] }),
        pair('stacked-hidden-series', { stacked: true, hidden: ['Costs'] }),
        pair('gap', { series: GAP }),
        pair('negative', { series: NEGATIVE }),
        pair('rtl', { rtl: true }),
        pair('hover-crosshair-tooltip', { hover: 2 }),
        pair('hover-near-right-edge-flips', { hover: 5 }),
        pair('hover-no-crosshair', { hover: 2, showCrosshair: false }),
    ],
};
