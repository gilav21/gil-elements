import { utils, scale, interaction } from '../lib/chart-libs.mjs';
import { colorOf, legendRef, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular scatter-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 520 + 56; // the harness wrapper is 12px padded; the chart measures its box
const H = 320;
const PAD = { top: 12, bottom: 28, axis: 44, edge: 14 };
const pts = (list) => list.map(([x, y]) => ({ x, y }));
const SERIES = [
    { name: 'Group A', points: pts([[10, 20], [25, 45], [40, 38], [55, 70], [70, 62], [85, 90]]) },
    { name: 'Group B', points: pts([[15, 60], [30, 30], [45, 80], [60, 25], [75, 50], [90, 35]]) },
];
const NEGATIVE = [{ name: 'Delta', points: pts([[-30, -12], [-10, 8], [0, 0], [12, -20], [30, 25]]) }];
const COLORED = [{ name: 'Custom', color: '#e11d48', points: pts([[1, 2], [2, 5], [3, 3], [4, 8]]) }];

const geometry = ({ series, hidden, rtl, radius }) => {
    const key = (s) => s.id ?? s.name;
    const visible = series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.includes(key(s)));
    const area = { left: rtl ? PAD.edge : PAD.axis, right: W - (rtl ? PAD.axis : PAD.edge), top: PAD.top, bottom: H - PAD.bottom };
    const dom = (pick) => {
        const r = utils.extent(visible.flatMap(({ s }) => s.points.map(pick)));
        return r ? scale.niceDomain(r[0], r[1], 5) : [0, 1];
    };
    const xs = scale.linearScale(dom((p) => p.x), rtl ? [area.right, area.left] : [area.left, area.right]);
    const ys = scale.linearScale(dom((p) => p.y), [area.bottom, area.top]);
    const plotted = visible.flatMap(({ s, i }) => s.points.map((p, pi) => ({ cx: xs.scale(p.x), cy: ys.scale(p.y), r: radius, color: colorOf(i, s.color), si: i, pi, datum: p, name: s.name })));
    return { area, xs, ys, plotted };
};

const ref = ({ series = SERIES, hidden = [], rtl = false, radius = 5, grid = true, legend = true, hover = null } = {}) => {
    const { area, xs, ys, plotted } = geometry({ series, hidden, rtl, radius });
    const yT = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
    const xT = xs.ticks(5).map((value) => ({ value, x: xs.scale(value) }));
    const gridLines = grid ? yT.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const yText = yT.map((g) => `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${g.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const xText = xT.map((g) => `<text x="${g.x}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const circles = plotted.map((p) => `<circle data-slot="scatter-point" cx="${p.cx}" cy="${p.cy}" r="${hover && hover.s === p.si && hover.p === p.pi ? p.r + 2 : p.r}" fill="${p.color}" fill-opacity="0.75" class="cursor-pointer transition-[r]" tabindex="0" role="button" aria-label="${p.name}: (${p.datum.x}, ${p.datum.y})"/>`).join('');
    let tooltip = '';
    if (hover) {
        const p = plotted.find((q) => q.si === hover.s && q.pi === hover.p);
        const x = p.cx + 10;
        tooltip = tooltipRef({ x, y: Math.max(8, p.cy - 8), rows: [{ label: p.name, value: `(${utils.formatChartValue(p.datum.x)}, ${utils.formatChartValue(p.datum.y)})`, color: p.color }], flipX: x > W * 0.7 });
    }
    const key = (s) => s.id ?? s.name;
    const leg = legend ? legendRef(series.map((s, i) => ({ key: key(s), label: s.name, color: colorOf(i, s.color) })), hidden) : '';
    return `<ui-scatter-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="scatter-chart" role="group" aria-label="${utils.getChartSummary('Scatter chart', series.length)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${gridLines}${yText}${xText}${circles}</svg>${tooltip}${leg}</div></ui-scatter-chart>`;
};

const el = ({ series = SERIES, hidden = [], rtl = false, radius = 5, grid = true, legend = true, hover = null } = {}) => {
    const { plotted } = geometry({ series, hidden, rtl, radius });
    const target = hover ? plotted.find((q) => q.si === hover.s && q.pi === hover.p) : null;
    const attrs = [radius === 5 ? '' : `point-radius="${radius}"`, grid ? '' : 'show-grid="false"', legend ? '' : 'show-legend="false"', rtl ? 'dir="rtl"' : '', target ? `data-hover-at="${target.cx},${target.cy}"` : ''].filter(Boolean).join(' ');
    return `<ge-scatter-chart ${attrs} data-props='${JSON.stringify({ series, hiddenKeys: hidden })}'></ge-scatter-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'scatter-chart',
    items: [
        pair('default'),
        pair('negative', { series: NEGATIVE }),
        pair('custom-color', { series: COLORED }),
        pair('big-points', { radius: 8 }),
        pair('no-grid', { grid: false }),
        pair('no-legend', { legend: false }),
        pair('hidden-series', { hidden: ['Group B'] }),
        pair('rtl', { rtl: true }),
        pair('hover-point', { hover: { s: 0, p: 2 } }),
        pair('hover-near-right-edge-flips', { hover: { s: 1, p: 5 } }),
    ],
};
