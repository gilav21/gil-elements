import { utils, polar } from '../lib/chart-libs.mjs';
import { colorOf, legendRef } from '../lib/chart-ref.mjs';
// shadcn-angular radar-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const AXES = ['Speed', 'Power', 'Range', 'Armor', 'Agility'];
const make = (name, values, color) => ({ name, ...(color ? { color } : {}), data: AXES.map((a, i) => ({ name: a, value: values[i] })) });
const SERIES = [make('Alpha', [80, 60, 90, 40, 70]), make('Beta', [50, 85, 40, 75, 60])];
const SINGLE = [make('Alpha', [80, 60, 90, 40, 70], '#e11d48')];
const NEGATIVE = [make('Delta', [-20, 40, 10, -5, 30])];
const THREE = [{ name: 'A', data: ['x', 'y', 'z'].map((n, i) => ({ name: n, value: [3, 8, 5][i] })) }];
const UNIT = [0, 1];

const ref = ({ series = SERIES, size = 320, levels = 4, max, fill = 0.2, legend = true, hidden = [] } = {}) => {
    const key = (s) => s.id ?? s.name;
    const axes = series[0].data.map((d) => d.name);
    const count = axes.length;
    const c = size / 2;
    const r = size / 2 - 36;
    const range = utils.extent(series.flatMap((s) => s.data.map((d) => d.value)));
    const min = Math.min(0, range?.[0] ?? 0);
    const hi = max ?? range?.[1] ?? 1;
    const rings = Array.from({ length: levels }, (_, l) => {
        const rr = (r * (l + 1)) / levels;
        return axes.map((_a, i) => polar.radarPoint(c, c, rr, i, count, 1, UNIT)).map((p) => `${p.x},${p.y}`).join(' ');
    }).map((points) => `<polygon data-slot="radar-ring" points="${points}" fill="none" class="stroke-border" stroke-width="1"/>`).join('');
    const spokes = axes.map((axis, i) => {
        const o = polar.radarPoint(c, c, r, i, count, 1, UNIT);
        const l = polar.radarPoint(c, c, r + 18, i, count, 1, UNIT);
        return `<line x1="${c}" y1="${c}" x2="${o.x}" y2="${o.y}" class="stroke-border" stroke-width="1"/><text x="${l.x}" y="${l.y}" text-anchor="middle" dominant-baseline="middle" class="fill-muted-foreground text-[10px]">${axis}</text>`;
    }).join('');
    const polys = series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.includes(key(s))).map(({ s, i }) => {
        const vertices = s.data.map((d, ai) => ({ ...polar.radarPoint(c, c, r, ai, count, d.value, [min, hi]), axis: d.name, value: d.value }));
        const color = colorOf(i, s.color);
        return `<path data-slot="radar-series" d="${polar.polygonPath(vertices)}" fill="${color}" fill-opacity="${fill}" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${vertices.map((v) => `<circle cx="${v.x}" cy="${v.y}" r="3" fill="${color}" tabindex="0" role="button" aria-label="${s.name}, ${v.axis}: ${v.value}"/>`).join('')}`;
    }).join('');
    const leg = legend ? legendRef(series.map((s, i) => ({ key: key(s), label: s.name, color: colorOf(i, s.color) })), hidden) : '';
    return `<ui-radar-chart class="block"><div class="inline-flex flex-col items-center" data-slot="radar-chart" role="group" aria-label="${utils.getChartSummary('Radar chart', count)}"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="overflow-visible">${rings}${spokes}${polys}</svg>${leg}</div></ui-radar-chart>`;
};

const el = ({ series = SERIES, size = 320, levels = 4, max, fill = 0.2, legend = true, hidden = [] } = {}) => {
    const attrs = [size === 320 ? '' : `size="${size}"`, levels === 4 ? '' : `levels="${levels}"`, max === undefined ? '' : `max-value="${max}"`, fill === 0.2 ? '' : `fill-opacity="${fill}"`, legend ? '' : 'show-legend="false"'].filter(Boolean).join(' ');
    return `<ge-radar-chart ${attrs} data-props='${JSON.stringify({ series, hiddenKeys: hidden })}'></ge-radar-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:420px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'radar-chart',
    items: [
        pair('default'),
        pair('single-series', { series: SINGLE }),
        pair('triangle', { series: THREE }),
        pair('negative', { series: NEGATIVE }),
        pair('fixed-max', { max: 100 }),
        pair('max-below-data-clamps', { max: 60 }),
        pair('levels', { levels: 6 }),
        pair('size', { size: 260 }),
        pair('outline-only', { fill: 0 }),
        pair('no-legend', { legend: false }),
        pair('hidden-series-keeps-scale', { hidden: ['Beta'] }),
    ],
};
