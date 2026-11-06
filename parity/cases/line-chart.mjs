import { utils, scale, path, interaction } from '../lib/chart-libs.mjs';
import { colorOf, legendRef, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular line-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const H = 300;
const CATS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const make = (name, values, color) => ({ name, ...(color ? { color } : {}), data: CATS.map((c, i) => ({ name: c, value: values[i] })) });
const SERIES = [make('Revenue', [120, 200, 150, 280, 240, 320]), make('Costs', [90, 110, 130, 150, 140, 180])];
const GAP = [make('Revenue', [120, 200, null, 280, 240, 320])];
const NEGATIVE = [make('Delta', [-40, 20, -10, 60, 30, -20])];

// Angular scales a `null` value as 0 (`null - d0`), though its docs call it a gap; the reference applies the fix.
const lineRef = ({ series = SERIES, curve = 'linear', showPoints = true, showGrid = true, showLegend = true, showCrosshair = true, hidden = [], rtl = false, hover = null } = {}) => {
    const key = (s) => s.id ?? s.name;
    const visible = series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.includes(key(s)));
    const area = { left: rtl ? 12 : 44, right: W - (rtl ? 44 : 12), top: 12, bottom: H - 28 };
    const n = series[0].data.length;
    const xs = scale.linearScale([0, Math.max(1, n - 1)], rtl ? [area.right, area.left] : [area.left, area.right]);
    const range = utils.extent(visible.flatMap(({ s }) => s.data.map((d) => d.value)));
    const ys = scale.linearScale(range ? scale.niceDomain(Math.min(0, range[0]), range[1], 5) : [0, 1], [area.bottom, area.top]);
    const ticks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
    const grid = showGrid ? ticks.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const yText = ticks.map((g) => `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${g.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const xText = series[0].data.map((d, i) => `<text x="${xs.scale(i)}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${d.name}</text>`).join('');
    const cross = showCrosshair && hover !== null ? `<line data-slot="crosshair" x1="${xs.scale(hover)}" x2="${xs.scale(hover)}" y1="${area.top}" y2="${area.bottom}" class="stroke-muted-foreground/50" stroke-width="1"/>` : '';
    const paths = visible.map(({ s, i }) => {
        const points = s.data.map((d, index) => ({ x: xs.scale(index), y: Number.isFinite(d.value) ? ys.scale(d.value) : Number.NaN, value: d.value, name: d.name, index }));
        return { name: s.name, color: colorOf(i, s.color), d: path.linePath(points.map((p) => ({ x: p.x, y: p.y })), curve), points: points.filter((p) => Number.isFinite(p.y)) };
    });
    const lines = paths.map((p) => `<path data-slot="line-series" d="${p.d}" fill="none" stroke="${p.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const dots = showPoints ? paths.map((p) => p.points.map((pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="${hover === pt.index ? 4 : 2.5}" fill="${p.color}" class="cursor-pointer transition-[r]" tabindex="0" role="button" aria-label="${p.name}, ${pt.name}: ${pt.value}"/>`).join('')).join('') : '';
    let tooltip = '';
    if (hover !== null) {
        const px = xs.scale(hover) + 12;
        tooltip = tooltipRef({ x: px, y: 60, title: series[0].data[hover].name, rows: visible.map(({ s, i }) => ({ label: s.name, value: utils.formatChartValueOrGap(s.data[hover]?.value), color: colorOf(i, s.color) })), flipX: px > W * 0.7 });
    }
    const legend = showLegend ? legendRef(series.map((s, i) => ({ key: key(s), label: s.name, color: colorOf(i, s.color) })), hidden) : '';
    const label = utils.getChartSummary('Line chart', n);
    return `<ui-line-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="line-chart" role="group" aria-label="${label}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${grid}${yText}${xText}${cross}${lines}${dots}</svg>${tooltip}${legend}</div></ui-line-chart>`;
};

const hoverX = (series, hover, rtl) => {
    const area = { left: rtl ? 12 : 44, right: W - (rtl ? 44 : 12) };
    return scale.linearScale([0, Math.max(1, series[0].data.length - 1)], rtl ? [area.right, area.left] : [area.left, area.right]).scale(hover);
};
const elOf = ({ series = SERIES, curve, showPoints = true, showGrid = true, showLegend = true, showCrosshair = true, hidden = [], rtl = false, hover = null } = {}) => {
    const attrs = [curve ? `curve="${curve}"` : '', showPoints ? '' : 'show-points="false"', showGrid ? '' : 'show-grid="false"', showLegend ? '' : 'show-legend="false"', showCrosshair ? '' : 'show-crosshair="false"', rtl ? 'dir="rtl"' : '', hover === null ? '' : `data-hover-at="${hoverX(series, hover, rtl)},68"`].filter(Boolean).join(' ');
    return `<ge-line-chart ${attrs} data-props='${JSON.stringify({ series, hiddenKeys: hidden })}'></ge-line-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: lineRef(opts), el: elOf(opts) });

export default {
    name: 'line-chart',
    items: [
        pair('default'),
        pair('monotone', { curve: 'monotone' }),
        pair('step', { curve: 'step' }),
        pair('no-points', { showPoints: false }),
        pair('no-grid', { showGrid: false }),
        pair('no-legend', { showLegend: false }),
        pair('hidden-series', { hidden: ['Costs'] }),
        pair('gap', { series: GAP }),
        pair('negative', { series: NEGATIVE }),
        pair('rtl', { rtl: true }),
        pair('hover-crosshair-tooltip', { hover: 2 }),
        pair('hover-near-right-edge-flips', { hover: 5 }),
        pair('hover-no-crosshair', { hover: 2, showCrosshair: false }),
    ],
};
