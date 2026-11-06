import { utils, scale } from '../lib/chart-libs.mjs';
// shadcn-angular bullet-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
// Angular's default measure colour is `hsl(var(--primary))`, which is invalid because --primary is an oklch colour, so the
// bar loses its fill; the reference applies the fix (`var(--primary)`), as ge does.
const W = 576;
const PAD = 4;

const ref = ({ value, target, ranges = [], min = 0, height = 40, color = '', label = '', unit = '' } = {}) => {
    const track = Math.max(0, W - PAD * 2);
    const max = utils.extent([value, target ?? 0, ...ranges, min + 1])?.[1] ?? min + 1;
    const s = scale.linearScale([min, max], [0, track]);
    const sorted = [...ranges].sort((a, b) => a - b);
    let prev = min;
    const bands = sorted.map((r, i) => {
        const x = s.scale(prev);
        const width = Math.max(0, s.scale(r) - x);
        prev = r;
        return `<rect data-slot="bullet-range" x="${x}" y="0" width="${width}" height="${height}" rx="2" class="fill-muted-foreground" fill-opacity="${0.12 + (i / Math.max(1, sorted.length)) * 0.2}"/>`;
    }).join('');
    const mh = height / 3;
    const mw = Math.min(track, Math.max(0, s.scale(value)));
    const measure = `<rect data-slot="bullet-measure" x="0" y="${height / 2 - mh / 2}" width="${mw}" height="${mh}" rx="2" fill="${color || 'var(--primary)'}" class="transition-[width]"/>`;
    const tx = target === undefined ? '' : `<line data-slot="bullet-target" x1="${s.scale(target)}" x2="${s.scale(target)}" y1="${height * 0.18}" y2="${height * 0.82}" class="stroke-foreground" stroke-width="3"/>`;
    const t = target === undefined ? '' : ` (target ${utils.formatChartValue(target)}${unit})`;
    const aria = `Bullet chart. ${label ? `${label}: ` : ''}${utils.formatChartValue(value)}${unit}${t}.`;
    return `<ui-bullet-chart class="block"><div class="block w-full" data-slot="bullet-chart" role="img" aria-label="${aria}"><svg viewBox="0 0 ${W} ${height}" width="100%" height="${height}" class="block w-full"><g transform="translate(4, 0)">${bands}${measure}${tx}</g></svg></div></ui-bullet-chart>`;
};
const el = ({ value, target, ranges = [], min = 0, height = 40, color = '', label = '', unit = '' } = {}) => {
    const attrs = [`value="${value}"`, target === undefined ? '' : `target="${target}"`, min === 0 ? '' : `min="${min}"`, height === 40 ? '' : `height="${height}"`, color ? `color="${color}"` : '', label ? `label="${label}"` : '', unit ? `unit="${unit}"` : '', `data-props='${JSON.stringify({ ranges })}'`].filter(Boolean).join(' ');
    return `<ge-bullet-chart ${attrs}></ge-bullet-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'bullet-chart',
    items: [
        pair('value-only', { value: 60 }),
        pair('target-and-ranges', { value: 70, target: 80, ranges: [50, 75, 100], label: 'Revenue', unit: 'k' }),
        pair('ranges-unsorted', { value: 40, target: 55, ranges: [100, 30, 60] }),
        pair('custom-color', { value: 70, target: 80, ranges: [50, 75, 100], color: '#e11d48' }),
        pair('value-beyond-ranges', { value: 140, target: 90, ranges: [50, 75, 100] }),
        pair('target-beyond-value', { value: 20, target: 120, ranges: [50, 100] }),
        pair('negative-min', { value: 10, target: 30, ranges: [0, 25, 50], min: -50 }),
        pair('zero-value', { value: 0, target: 40, ranges: [50, 100] }),
        pair('tall', { value: 70, target: 80, ranges: [50, 75, 100], height: 72 }),
        pair('single-range', { value: 33, ranges: [100] }),
    ],
};
