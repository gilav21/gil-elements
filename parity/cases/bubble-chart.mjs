import { utils, scale } from '../lib/chart-libs.mjs';
import { colorOf, legendRef, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular bubble-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const H = 340;
const PAD = { top: 16, bottom: 28, axis: 44, edge: 16 };
const pts = (list) => list.map(([x, y, z]) => ({ x, y, z }));
const SERIES = [
    { name: 'Europe', points: pts([[20, 30, 10], [45, 60, 40], [70, 40, 90], [85, 80, 25]]) },
    { name: 'Asia', points: pts([[15, 70, 60], [35, 20, 15], [60, 85, 100], [90, 45, 55]]) },
];
const COLORED = [{ name: 'Custom', color: '#e11d48', points: pts([[1, 2, 5], [2, 5, 20], [3, 3, 10], [4, 8, 40]]) }];
const SAME_Z = [{ name: 'Flat', points: pts([[1, 2, 7], [2, 5, 7], [3, 3, 7]]) }];

const geometry = ({ series, hidden, rtl, minR, maxR }) => {
    const key = (s) => s.id ?? s.name;
    const visible = series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.includes(key(s)));
    const area = { left: rtl ? PAD.edge : PAD.axis, right: W - (rtl ? PAD.axis : PAD.edge), top: PAD.top, bottom: H - PAD.bottom };
    const dom = (pick) => {
        const r = utils.extent(visible.flatMap(({ s }) => s.points.map(pick)));
        return r ? scale.niceDomain(r[0], r[1], 5) : [0, 1];
    };
    const xs = scale.linearScale(dom((p) => p.x), rtl ? [area.right, area.left] : [area.left, area.right]);
    const ys = scale.linearScale(dom((p) => p.y), [area.bottom, area.top]);
    const zr = utils.extent(visible.flatMap(({ s }) => s.points.map((p) => p.z))) ?? [0, 1];
    const rs = scale.sizeScale(zr, [minR, maxR]);
    const plotted = visible.flatMap(({ s, i }) => s.points.map((p, pi) => ({ cx: xs.scale(p.x), cy: ys.scale(p.y), r: rs.radius(p.z), color: colorOf(i, s.color), si: i, pi, datum: p, name: s.name })));
    return { area, ys, plotted };
};

const ref = ({ series = SERIES, hidden = [], rtl = false, minR = 6, maxR = 28, grid = true, legend = true, hover = null } = {}) => {
    const { area, ys, plotted } = geometry({ series, hidden, rtl, minR, maxR });
    const yT = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
    const gridLines = grid ? yT.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const yText = yT.map((g) => `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${g.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const circles = plotted.map((p) => `<circle data-slot="bubble-point" cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.color}" fill-opacity="${hover && hover.s === p.si && hover.p === p.pi ? 0.85 : 0.55}" stroke="${p.color}" class="cursor-pointer transition-[fill-opacity]" tabindex="0" role="button" aria-label="${p.name}: (${p.datum.x}, ${p.datum.y}, ${p.datum.z})"/>`).join('');
    let tooltip = '';
    if (hover) {
        const p = plotted.find((q) => q.si === hover.s && q.pi === hover.p);
        const x = p.cx + p.r;
        tooltip = tooltipRef({ x, y: Math.max(8, p.cy - 8), title: p.name, rows: [{ label: 'x', value: utils.formatChartValue(p.datum.x), color: p.color }, { label: 'y', value: utils.formatChartValue(p.datum.y) }, { label: 'z', value: utils.formatChartValue(p.datum.z) }], flipX: x > W * 0.7 });
    }
    const key = (s) => s.id ?? s.name;
    const leg = legend ? legendRef(series.map((s, i) => ({ key: key(s), label: s.name, color: colorOf(i, s.color) })), hidden) : '';
    return `<ui-bubble-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="bubble-chart" role="group" aria-label="${utils.getChartSummary('Bubble chart', series.length)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${gridLines}${yText}${circles}</svg>${tooltip}${leg}</div></ui-bubble-chart>`;
};

const el = ({ series = SERIES, hidden = [], rtl = false, minR = 6, maxR = 28, grid = true, legend = true, hover = null } = {}) => {
    const { plotted } = geometry({ series, hidden, rtl, minR, maxR });
    const target = hover ? plotted.find((q) => q.si === hover.s && q.pi === hover.p) : null;
    const attrs = [minR === 6 ? '' : `min-radius="${minR}"`, maxR === 28 ? '' : `max-radius="${maxR}"`, grid ? '' : 'show-grid="false"', legend ? '' : 'show-legend="false"', rtl ? 'dir="rtl"' : '', target ? `data-hover-at="${target.cx},${target.cy}"` : ''].filter(Boolean).join(' ');
    return `<ge-bubble-chart ${attrs} data-props='${JSON.stringify({ series, hiddenKeys: hidden })}'></ge-bubble-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'bubble-chart',
    items: [
        pair('default'),
        pair('custom-color', { series: COLORED }),
        pair('same-z', { series: SAME_Z }),
        pair('radius-range', { minR: 3, maxR: 40 }),
        pair('no-grid', { grid: false }),
        pair('no-legend', { legend: false }),
        pair('hidden-series-resizes', { hidden: ['Asia'] }),
        pair('rtl', { rtl: true }),
        pair('hover-bubble', { hover: { s: 0, p: 1 } }),
        pair('hover-near-right-edge-flips', { hover: { s: 1, p: 3 } }),
    ],
};
