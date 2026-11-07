import { utils, scale, path } from '../lib/chart-libs.mjs';
import { colorOf, legendRef, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular combo-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
// Angular dims bars by `index % categories`, which is only the category when there is one bar series, and wires every
// bar's click to series 0; the reference dims by the bar's own category (and a click reports its own series), as ge does.
const W = 576;
const H = 320;
const CATS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const make = (name, values, color) => ({ name, ...(color ? { color } : {}), data: CATS.map((c, i) => ({ name: c, value: values[i] })) });
const BARS = [make('Defects', [45, 30, 18, 9, 4])];
const TWO_BARS = [make('Defects', [45, 30, 18, 9, 4]), make('Fixed', [40, 28, 10, 8, 4])];
const LINES = [make('Rate', [12, 20, 35, 28, 40])];
const NEG = [make('Net', [20, -15, 30, -5, 10])];
const GAPPY = [{ name: 'Defects', data: [{ name: 'Mon', value: 45 }, { name: 'Tue', value: Number.NaN }, { name: 'Wed', value: 18 }] }];

const ref = ({ bars = BARS, lines = [], cumulative = false, label = 'Cumulative', radius = 2, grid = true, legend = true, rtl = false, hover = null, tooltip = true } = {}) => {
    const cats = bars[0].data.map((d) => d.name);
    const area = { left: 44, right: W - 44, top: 12, bottom: H - 28 };
    const band = scale.bandScale(cats.map((_c, i) => String(i)), rtl ? [area.right, area.left] : [area.left, area.right], 0.3, 0.15);
    const prim = scale.linearScale(scale.zeroBasedDomain(bars.flatMap((s) => s.data.map((d) => d.value)), 5), [area.bottom, area.top]);
    const total = bars[0].data.reduce((a, d) => a + path.finiteOrZero(d.value), 0) || 1;
    let run = 0;
    const cum = bars[0].data.map((d) => { run += path.finiteOrZero(d.value); return (run / total) * 100; });
    const vals = lines.flatMap((s) => s.data.map((d) => d.value));
    if (cumulative) vals.push(100, ...cum);
    const sec = scale.linearScale(utils.extent(vals) ? scale.zeroBasedDomain(vals, 5) : [0, 100], [area.bottom, area.top]);
    const ticks = prim.ticks(5).map((value) => ({ value, y: prim.scale(value) }));
    const centers = cats.map((_c, i) => band.position(String(i)) + band.bandwidth / 2);
    const zero = prim.scale(0);
    const sub = band.bandwidth / Math.max(1, bars.length);
    const rects = cats.flatMap((_c, ci) => bars.map((s, si) => {
        const end = prim.scale(path.finiteOrZero(s.data[ci]?.value));
        const op = hover === null || hover === ci ? 1 : 0.55;
        return `<rect data-slot="combo-bar" x="${band.position(String(ci)) + si * sub}" y="${Math.min(zero, end)}" width="${sub}" height="${Math.abs(end - zero)}" rx="${radius}" fill="${colorOf(si, s.color)}" class="cursor-pointer transition-opacity" opacity="${op}"/>`;
    })).join('');
    const place = (list) => path.linePath(list.flatMap((v, ci) => (centers[ci] === undefined ? [] : [{ x: centers[ci], y: sec.scale(v) }])), 'linear');
    const drawn = lines.map((s, i) => ({ key: s.id ?? s.name, name: s.name, color: colorOf(bars.length + i, s.color), d: place(s.data.map((d) => d.value)) }));
    const all = cumulative ? [{ key: '__cumulative__', name: label, color: colorOf(bars.length + drawn.length), d: place(cum) }, ...drawn] : drawn;
    const gridLines = grid ? ticks.map((g) => `<line data-slot="grid-line" x1="${area.left}" x2="${area.right}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const yText = ticks.map((g) => `<text x="${area.left - 8}" y="${g.y + 3}" text-anchor="end" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const xText = cats.map((c, i) => `<text x="${centers[i]}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${c}</text>`).join('');
    const cross = hover === null ? '' : `<line data-slot="crosshair" x1="${centers[hover]}" x2="${centers[hover]}" y1="${area.top}" y2="${area.bottom}" class="stroke-muted-foreground/40" stroke-width="1"/>`;
    const lineEls = all.map((l) => `<path data-slot="combo-line" d="${l.d}" fill="none" stroke="${l.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const rows = [
            ...bars.map((s, si) => ({ label: s.name, value: utils.formatChartValueOrGap(s.data[hover]?.value), color: colorOf(si, s.color) })),
            ...lines.map((s, li) => ({ label: s.name, value: utils.formatChartValueOrGap(s.data[hover]?.value), color: colorOf(bars.length + li, s.color) })),
        ];
        if (cumulative) rows.push({ label, value: `${(cum[hover] ?? 0).toFixed(0)}%`, color: colorOf(bars.length + lines.length) });
        const x = centers[hover] + 12;
        tip = tooltipRef({ x, y: 60, title: cats[hover], rows, flipX: x > W * 0.7 });
    }
    const leg = legend ? legendRef([...bars.map((s, i) => ({ key: s.name, label: s.name, color: colorOf(i, s.color) })), ...all.map((l) => ({ key: l.key, label: l.name, color: l.color }))], [], false) : '';
    return `<ui-combo-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="combo-chart" role="group" aria-label="${utils.getChartSummary('Combo chart', cats.length)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${gridLines}${yText}${xText}${rects}${cross}${lineEls}</svg>${tip}${leg}</div></ui-combo-chart>`;
};

const el = ({ bars = BARS, lines = [], cumulative = false, label = 'Cumulative', radius = 2, grid = true, legend = true, rtl = false, hover = null, tooltip = true } = {}) => {
    const cats = bars[0].data.length;
    const band = scale.bandScale(Array.from({ length: cats }, (_c, i) => String(i)), rtl ? [W - 44, 44] : [44, W - 44], 0.3, 0.15);
    const x = hover === null ? 0 : band.position(String(hover)) + band.bandwidth / 2;
    const attrs = [cumulative ? 'show-cumulative' : '', label === 'Cumulative' ? '' : `cumulative-label="${label}"`, radius === 2 ? '' : `bar-radius="${radius}"`, grid ? '' : 'show-grid="false"', legend ? '' : 'show-legend="false"', tooltip ? '' : 'show-tooltip="false"', rtl ? 'dir="rtl"' : '', hover === null ? '' : `data-hover-at="${x},68"`].filter(Boolean).join(' ');
    return `<ge-combo-chart ${attrs} data-props='${JSON.stringify({ barSeries: bars, lineSeries: lines })}'></ge-combo-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'combo-chart',
    items: [
        pair('bars-only'),
        pair('pareto', { cumulative: true }),
        pair('pareto-custom-label', { cumulative: true, label: 'Running share' }),
        pair('bars-and-lines', { lines: LINES }),
        pair('two-bar-series', { bars: TWO_BARS }),
        pair('two-bar-series-with-lines-and-cumulative', { bars: TWO_BARS, lines: LINES, cumulative: true }),
        pair('negative-bars', { bars: NEG }),
        pair('missing-bar-value', { bars: GAPPY }),
        pair('no-grid', { grid: false }),
        pair('no-legend', { legend: false }),
        pair('square-bars', { radius: 0 }),
        pair('rtl', { rtl: true, lines: LINES }),
        pair('hover', { hover: 2, cumulative: true }),
        pair('hover-two-bar-series-dims-by-category', { hover: 1, bars: TWO_BARS, lines: LINES }),
        pair('hover-flips-near-right-edge', { hover: 4, bars: TWO_BARS }),
        pair('hover-without-tooltip', { hover: 3, tooltip: false }),
    ],
};
