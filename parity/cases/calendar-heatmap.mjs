import { utils, colorScale } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular calendar-heatmap.component.ts and .html: the geometry is computed with the same helpers it uses.
const DAY_MS = 86_400_000;
const LEFT = 26;
const TOP = 16;
const GAP = 3;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const run = (start, days, fn) => Array.from({ length: days }, (_, i) => ({ date: ymd(Date.UTC(...start) + i * DAY_MS), value: fn(i) }));
// Starts on a Wednesday, so the first column is partial.
const DATA = run([2025, 0, 1], 120, (i) => (i * 7) % 11);
const SPARSE = [{ date: '2025-03-05', value: 3 }, { date: '2025-03-06', value: 9 }, { date: '2025-03-20', value: 0 }, { date: '2025-04-02', value: 5 }];
const SUNDAY_START = run([2025, 0, 5], 21, (i) => i % 6);
const FLAT = run([2025, 0, 6], 10, () => 4);
const FROM = 'hsl(214, 95%, 92%)';
const TO = 'hsl(221, 83%, 38%)';
const parse = (d) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); };

const ref = ({ data = DATA, size = 13, from = FROM, to = TO, legend = true, tooltip = true, hover = null } = {}) => {
    const first = utils.extent(data.map((d) => parse(d.date)))?.[0];
    const origin = first === undefined ? 0 : first - new Date(first).getUTCDay() * DAY_MS;
    const dom = utils.extent(data.map((d) => d.value)) ?? [0, 1];
    const color = colorScale.sequentialColorScale(dom, [from, to]);
    const step = size + GAP;
    const cells = data.map((day) => {
        const ms = parse(day.date);
        return { x: LEFT + Math.floor((ms - origin) / (7 * DAY_MS)) * step, y: TOP + new Date(ms).getUTCDay() * step, color: color(day.value), day };
    });
    const right = utils.extent(cells.map((c) => c.x))?.[1];
    const weeks = right === undefined ? 0 : (right - LEFT) / step + 1;
    const used = LEFT + weeks * step;
    const height = TOP + 7 * step;
    const labels = [['Mon', 1], ['Wed', 3], ['Fri', 5]].map(([l, r]) => `<text x="0" y="${TOP + r * step + size / 2}" class="fill-muted-foreground text-[9px]">${l}</text>`).join('');
    const rects = cells.map((c) => `<rect data-slot="calendar-day" x="${c.x}" y="${c.y}" width="${size}" height="${size}" rx="2" fill="${c.color}" class="cursor-pointer" tabindex="0" role="button" aria-label="${c.day.date}: ${c.day.value}"/>`).join('');
    const [lo, hi] = dom;
    const leg = legend ? `<div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><span>Less</span>${Array.from({ length: 5 }, (_, i) => `<span class="inline-block size-3 rounded-[2px]" style="background:${color(lo + ((hi - lo) * i) / 4)}"></span>`).join('')}<span>More</span></div>` : '';
    let tip = '';
    if (hover !== null && tooltip) {
        const c = cells[hover];
        tip = tooltipRef({ x: c.x + size, y: Math.max(8, c.y - 8), title: c.day.date, rows: [{ label: 'Count', value: utils.formatChartValue(c.day.value), color: c.color }] });
    }
    return `<ui-calendar-heatmap class="block"><div class="relative w-fit max-w-full mr-auto" data-slot="calendar-heatmap" role="group" aria-label="Calendar heatmap with ${data.length} days."><svg viewBox="0 0 ${used} ${height}" width="${used}" height="${height}" class="block h-auto max-w-full">${labels}${rects}</svg>${leg}${tip}</div></ui-calendar-heatmap>`;
};
const el = ({ data = DATA, size = 13, from = FROM, to = TO, legend = true, tooltip = true, hover = null } = {}) => {
    const attrs = [size === 13 ? '' : `cell-size="${size}"`, from === FROM ? '' : `from-color="${from}"`, to === TO ? '' : `to-color="${to}"`, legend ? '' : 'show-legend="false"', tooltip ? '' : 'show-tooltip="false"', hover === null ? '' : `data-enter=".day,${hover}"`].filter(Boolean).join(' ');
    return `<ge-calendar-heatmap ${attrs} data-props='${JSON.stringify({ data })}'></ge-calendar-heatmap>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:600px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'calendar-heatmap',
    items: [
        pair('default'),
        pair('sparse-days-leave-gaps', { data: SPARSE }),
        pair('starts-on-sunday', { data: SUNDAY_START }),
        pair('flat-values', { data: FLAT }),
        pair('big-cells', { size: 20 }),
        pair('small-cells', { size: 9 }),
        pair('custom-colors', { from: '#fef3c7', to: '#b91c1c' }),
        pair('no-legend', { legend: false }),
        pair('hover-day', { hover: 40 }),
        pair('hover-first-day', { hover: 0 }),
        pair('hover-without-tooltip', { hover: 10, tooltip: false }),
    ],
};
