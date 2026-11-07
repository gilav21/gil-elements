import { utils, colorScale } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular heatmap.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const ROW_W = 48;
const COL_H = 22;
const GAP = 2;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const HOURS = ['9', '10', '11', '12', '13', '14'];
const grid = (fn) => DAYS.flatMap((row, r) => HOURS.map((col, c) => ({ row, col, value: fn(r, c) })));
const DATA = grid((r, c) => (r * 7 + c * 5 + ((r * c) % 4) * 3) % 23);
const SMALL = [{ row: 'A', col: 'x', value: 1 }, { row: 'A', col: 'y', value: 4 }, { row: 'B', col: 'x', value: 9 }, { row: 'B', col: 'y', value: 2 }];
const FLAT = [{ row: 'A', col: 'x', value: 5 }, { row: 'A', col: 'y', value: 5 }];
const WIDE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'aa', 'bb'].map((col, i) => ({ row: 'R', col, value: i }));
const FROM = 'hsl(214, 95%, 93%)';
const TO = 'hsl(221, 83%, 40%)';

const ref = ({ data = DATA, max = 52, min = 18, from = FROM, to = TO, values = false, legend = true, tooltip = true, hover = null } = {}) => {
    const uniq = (pick) => [...new Set(data.map(pick))];
    const rows = uniq((c) => c.row);
    const cols = uniq((c) => c.col);
    const dom = utils.extent(data.map((c) => c.value)) ?? [0, 1];
    const color = colorScale.sequentialColorScale(dom, [from, to]);
    const ideal = (W - ROW_W - GAP * cols.length) / cols.length;
    const size = cols.length === 0 ? max : Math.max(min, Math.min(max, ideal));
    const used = ROW_W + cols.length * (size + GAP);
    const height = COL_H + rows.length * (size + GAP);
    const cells = data.map((cell) => ({ x: ROW_W + cols.indexOf(cell.col) * (size + GAP), y: COL_H + rows.indexOf(cell.row) * (size + GAP), color: color(cell.value), cell }));
    const colText = cols.map((c, ci) => `<text x="${ROW_W + ci * (size + GAP) + size / 2}" y="14" text-anchor="middle" class="fill-muted-foreground text-[10px]">${c}</text>`).join('');
    const rowText = rows.map((r, ri) => `<text x="0" y="${COL_H + ri * (size + GAP) + size / 2 + 3}" class="fill-muted-foreground text-[10px]">${r}</text>`).join('');
    const rects = cells.map((p) => `<rect data-slot="heatmap-cell" x="${p.x}" y="${p.y}" width="${size}" height="${size}" rx="3" fill="${p.color}" class="cursor-pointer" tabindex="0" role="button" aria-label="${p.cell.row}, ${p.cell.col}: ${p.cell.value}"/>${values ? `<text x="${p.x + size / 2}" y="${p.y + size / 2 + 3}" text-anchor="middle" class="pointer-events-none fill-foreground text-[10px]">${p.cell.value}</text>` : ''}`).join('');
    const [lo, hi] = dom;
    const leg = legend ? `<div class="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><span>Low</span>${Array.from({ length: 5 }, (_, i) => `<span class="inline-block size-3 rounded-[2px]" style="background:${color(lo + ((hi - lo) * i) / 4)}"></span>`).join('')}<span>High</span></div>` : '';
    let tip = '';
    if (hover !== null && tooltip) {
        const p = cells[hover];
        const x = p.x + size / 2;
        tip = tooltipRef({ x, y: Math.max(8, p.y - 8), title: `${p.cell.row} · ${p.cell.col}`, rows: [{ label: p.cell.col, value: utils.formatChartValue(p.cell.value), color: p.color }], flipX: x > W * 0.7 });
    }
    return `<ui-heatmap class="block"><div class="relative w-fit max-w-full mr-auto" data-slot="heatmap" role="group" aria-label="Heatmap with ${rows.length} rows and ${cols.length} columns."><svg viewBox="0 0 ${used} ${height}" width="${used}" height="${height}" class="block h-auto max-w-full">${colText}${rowText}${rects}</svg>${leg}${tip}</div></ui-heatmap>`;
};

const el = ({ data = DATA, max = 52, min = 18, from = FROM, to = TO, values = false, legend = true, tooltip = true, hover = null } = {}) => {
    const attrs = [max === 52 ? '' : `max-cell-size="${max}"`, min === 18 ? '' : `min-cell-size="${min}"`, from === FROM ? '' : `from-color="${from}"`, to === TO ? '' : `to-color="${to}"`, values ? 'show-values' : '', legend ? '' : 'show-legend="false"', tooltip ? '' : 'show-tooltip="false"', hover === null ? '' : `data-enter=".cell,${hover}"`].filter(Boolean).join(' ');
    return `<ge-heatmap ${attrs} data-props='${JSON.stringify({ data })}'></ge-heatmap>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'heatmap',
    items: [
        pair('default'),
        pair('small-grid', { data: SMALL }),
        pair('flat-values', { data: FLAT }),
        pair('many-columns-shrink', { data: WIDE }),
        pair('min-size-overflows', { data: WIDE, min: 30 }),
        pair('max-cell-size', { data: SMALL, max: 30 }),
        pair('custom-colors', { from: '#fef3c7', to: '#b91c1c' }),
        pair('show-values', { data: SMALL, values: true }),
        pair('no-legend', { legend: false }),
        pair('hover-cell', { hover: 8 }),
        pair('hover-flips-near-right-edge', { hover: 29 }),
        pair('hover-without-tooltip', { hover: 3, tooltip: false }),
    ],
};
