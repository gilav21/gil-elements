import { utils, scale } from '../lib/chart-libs.mjs';
// shadcn-angular stacked-bar-chart.component.ts and .html. The geometry uses the same helpers; the tooltip is anchored
// to the hovered segment (Angular never sets its position, an upstream defect).
const W = 576;
const H = 300;
const mk = (name, values) => ({ name, data: values.map((value, i) => ({ name: `c${i}`, value })) });
const CATS = ['Q1', 'Q2', 'Q3', 'Q4'];
const SERIES = [mk('Desktop', [120, 150, 90, 200]), mk('Mobile', [80, 60, 110, 70]), mk('Tablet', [30, 40, 25, 50])];
const MIXED = [mk('Profit', [120, -40, 90, 60]), mk('Loss', [-30, -80, -20, -50]), mk('Other', [40, 30, -10, 20])];
const COLORED = [{ ...mk('Red', [40, 50, 30, 60]), color: '#ef4444' }, { ...mk('Blue', [20, 30, 50, 10]), color: '#3b82f6' }];

const compact = (v) => utils.formatChartValue(v, { compact: true });

const geometry = ({ series, cats, rtl, gap, percent }) => {
    const p = { top: 20, right: rtl ? 70 : 20, bottom: 35, left: rtl ? 20 : 70 };
    const area = { left: p.left, right: W - p.right, top: p.top, bottom: H - p.bottom, width: W - p.left - p.right };
    const raw = (ci) => series.map((s) => s.data[ci]?.value ?? 0);
    const units = cats.map((c, ci) => {
        const r = raw(ci);
        if (!percent) return r;
        const abs = r.reduce((a, v) => a + Math.abs(v), 0);
        return r.map((v) => (abs === 0 ? 0 : (100 * v) / abs));
    });
    let up = 0;
    let down = 0;
    for (const u of units) {
        up = Math.max(up, u.reduce((a, v) => a + Math.max(0, v), 0));
        down = Math.min(down, u.reduce((a, v) => a + Math.min(0, v), 0));
    }
    const domain = percent && down === 0 ? [0, 100] : scale.zeroBasedDomain([up, down], 5);
    const vs = scale.linearScale(domain, [area.bottom, area.top]);
    const ticks = percent && domain[0] === 0 ? [0, 25, 50, 75, 100] : vs.ticks(5);
    const size = (area.width - (cats.length - 1) * gap) / cats.length;
    const stacks = cats.map((category, ci) => {
        const offset = ci * (size + gap);
        const x = rtl ? area.right - offset - size : area.left + offset;
        const r = raw(ci);
        const abs = r.reduce((a, v) => a + Math.abs(v), 0);
        let u = 0;
        let d = 0;
        const segments = series.map((s, si) => {
            const unit = units[ci][si];
            const near = unit >= 0 ? u : d;
            const far = near + unit;
            if (unit >= 0) u = far;
            else d = far;
            const top = vs.scale(Math.max(near, far));
            return { si, ci, name: s.name, value: r[si], pct: abs > 0 ? (r[si] / abs) * 100 : 0, x, y: top, width: size, height: vs.scale(Math.min(near, far)) - top, color: utils.getChartColor(si, s.color) };
        });
        return { category, segments, total: r.reduce((a, v) => a + v, 0) };
    });
    return { area, domain, vs, ticks, stacks };
};

const ref = ({ series = SERIES, cats = CATS, rtl = false, gap = 12, radius = 4, grid = true, total = false, legend = true, percent = false, hover = null } = {}) => {
    const { area, domain, vs, ticks, stacks } = geometry({ series, cats, rtl, gap, percent });
    const gridLines = grid
        ? `<g class="text-border">${ticks.map((tick) => {
              const zero = tick === 0 && domain[0] < 0;
              const y = vs.scale(tick);
              return `<line x1="${area.left}" y1="${y}" x2="${area.right}" y2="${y}" stroke="currentColor" stroke-opacity="${zero ? 1 : 0.2}"${zero ? '' : ' stroke-dasharray="4 4"'}${zero ? ' class="text-muted-foreground"' : ''}/>`;
          }).join('')}</g>`
        : '';
    const fmtAxis = (v) => (percent ? `${v}%` : utils.formatChartValue(v, { compact: true, decimals: Number.isInteger(v) ? 0 : 6 }));
    const tickText = `<g class="text-muted-foreground text-xs">${ticks.map((t) => `<text x="${rtl ? area.right + 12 : area.left - 12}" y="${vs.scale(t)}" text-anchor="end" dominant-baseline="middle" fill="currentColor">${fmtAxis(t)}</text>`).join('')}</g>`;
    const catText = `<g class="text-muted-foreground text-xs">${stacks.map((s) => `<text x="${s.segments[0].x + s.segments[0].width / 2}" y="${area.bottom + 16}" text-anchor="middle" fill="currentColor">${s.category}</text>`).join('')}</g>`;
    const bars = stacks.map((st) => {
        const segs = st.segments.map((g) => {
            const isHover = hover !== null && hover[0] === g.ci && hover[1] === g.si;
            const cls = `cursor-pointer outline-none${hover !== null && !isHover ? ' opacity-50' : ''}`;
            const rectCls = `transition-all duration-200 ease-out${isHover ? ' brightness-110' : ''}`;
            return `<g class="${cls}" tabindex="0" role="button" aria-label="${g.name} in ${st.category}: ${utils.formatChartValue(g.value)}"><rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="${radius}" fill="${g.color}" class="${rectCls}"/></g>`;
        }).join('');
        const top = st.segments.reduce((m, g) => Math.min(m, g.y), st.segments[0].y);
        const t = total ? `<text x="${st.segments[0].x + st.segments[0].width / 2}" y="${top - 6}" text-anchor="middle" class="text-xs font-medium fill-foreground">${compact(st.total)}</text>` : '';
        return segs + t;
    }).join('');
    const leg = legend
        ? `<div class="flex flex-wrap gap-4 mt-4 justify-center">${series.map((s, i) => `<div class="flex items-center gap-2 text-sm"><span class="w-3 h-3 rounded-sm" style="background-color:${utils.getChartColor(i, s.color)}"></span><span class="text-muted-foreground">${s.name}</span></div>`).join('')}</div>`
        : '';
    let tip = '';
    if (hover !== null) {
        const g = stacks[hover[0]].segments[hover[1]];
        const x = g.x + g.width / 2 + 12;
        const y = g.y - 8;
        const share = percent ? ` (${utils.formatPercentage(g.pct, 1)})` : '';
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words${x > W * 0.7 ? ' -translate-x-full' : ''}" style="left:${x}px;top:${y}px"><div class="font-medium">${g.name}</div><div class="text-muted-foreground">${compact(g.value)}${share}</div></div>`;
    }
    return `<ui-stacked-bar-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative block w-full" data-slot="stacked-bar-chart"><svg role="group" aria-label="${utils.getChartSummary('Stacked column chart', cats.length)}" viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible">${gridLines}${tickText}${catText}<g>${bars}</g></svg>${leg}${tip}</div></ui-stacked-bar-chart>`;
};

const el = ({ series = SERIES, cats = CATS, rtl = false, gap = 12, radius = 4, grid = true, total = false, legend = true, percent = false, hover = null } = {}) =>
    `<ge-stacked-bar-chart${rtl ? ' dir="rtl"' : ''}${gap === 12 ? '' : ` bar-gap="${gap}"`}${radius === 4 ? '' : ` bar-radius="${radius}"`}${grid ? '' : ' show-grid="false"'}${total ? ' show-total' : ''}${legend ? '' : ' show-legend="false"'}${percent ? ' stacking="percent"' : ''}${hover === null ? '' : ` data-hover-segment="${hover.join(',')}"`} data-props='${JSON.stringify({ series, categories: cats })}'></ge-stacked-bar-chart>`;
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'stacked-bar-chart',
    items: [
        pair('absolute'),
        pair('percent', { percent: true }),
        pair('negative', { series: MIXED }),
        pair('percent-negative', { series: MIXED, percent: true }),
        pair('custom-colors', { series: COLORED }),
        pair('show-total', { total: true }),
        pair('no-grid', { grid: false }),
        pair('no-legend', { legend: false }),
        pair('square', { radius: 0 }),
        pair('tight-gap', { gap: 2 }),
        pair('rtl', { rtl: true }),
        pair('hover', { hover: [1, 1] }),
        pair('hover-percent', { hover: [2, 0], percent: true }),
        pair('hover-flips-near-right-edge', { hover: [3, 2] }),
    ],
};
