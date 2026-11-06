import { treemapLayout, utils } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular treemap.component.ts and .html; the layout is the same squarify it runs. Angular anchors RTL labels with
// text-anchor="end", which SVG reads against the inherited direction, so they spill out of their rectangles; the reference
// applies the fix (the anchor is `start` under an inherited rtl direction).
const W = 500;
const PAD = 4;
const DISK = [
    { label: 'Media', children: [{ label: 'Photos', value: 420 }, { label: 'Video', value: 300 }, { label: 'Music', value: 120 }] },
    { label: 'Code', children: [{ label: 'Repos', value: 180 }, { label: 'Builds', value: 60 }] },
    { label: 'Docs', value: 90 },
    { label: 'Trash', value: 30 },
];
const COLOURED = [
    { label: 'Alpha', color: '#f59e0b', children: [{ label: 'Alpha one', value: 50 }, { label: 'Alpha two', value: 30, color: '#16a34a' }] },
    { label: 'Beta', value: 40 },
];
const FLAT = [{ label: 'North', value: 120 }, { label: 'South', value: 80 }, { label: 'East', value: 60 }, { label: 'West', value: 40 }, { label: 'Central', value: 15 }];
const BAD = [{ label: 'Good', value: 50 }, { label: 'Zero', value: 0 }, { label: 'Negative', value: -4 }, { label: 'Missing' }, { label: 'Also good', value: 25 }];

const ref = ({ nodes = DISK, height = 320, rtl = false, groupPadding = 3, labels = true, minW = 44, minH = 16, tooltip = true, radius = 2, unit = '', hover = null } = {}) => {
    const total = nodes.reduce((sum, n) => sum + treemapLayout.nodeValue(n), 0);
    const summary = utils.getChartSummary('Treemap', nodes.length);
    if (total <= 0) return `<ui-treemap class="block"><div class="relative w-full" data-slot="treemap" role="group" aria-label="${summary}"><div data-slot="treemap-empty" class="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:p-6" style="min-height:${height}px">No data to display</div></div></ui-treemap>`;
    const plot = { x: PAD, y: PAD, width: W - PAD * 2, height: height - PAD * 2 };
    const roots = treemapLayout.layoutTreemap(nodes, plot, groupPadding);
    const rootColor = new Map(roots.map((r, i) => [r.path, utils.getChartColor(i, r.node.color)]));
    const fmt = (v) => utils.formatChartValue(v, { compact: true }) + unit;
    const cells = treemapLayout.flattenLayout(roots).map((n, index) => {
        const isLeaf = n.children.length === 0;
        const x = rtl ? plot.x + plot.width - (n.rect.x - plot.x) - n.rect.width : n.rect.x;
        return { index, n, isLeaf, x, color: n.node.color ?? rootColor.get(n.path.split('/')[0]) ?? utils.getChartColor(0), show: labels && n.rect.width >= minW && n.rect.height >= minH };
    });
    const body = cells.map(({ index, n, isLeaf, x, color, show }) => {
        const dim = hover !== null && hover !== index;
        const op = isLeaf ? Math.max(0.2, 0.85 - n.depth * 0.12) : 0;
        const text = show ? `<text data-slot="treemap-label" x="${rtl ? x + n.rect.width - 5 : x + 5}" y="${n.rect.y + 13}" text-anchor="start" class="pointer-events-none fill-foreground text-[10px] font-medium">${n.node.label}</text>` : '';
        return `<g data-slot="treemap-cell" data-depth="${n.depth}" data-leaf="${isLeaf}" class="cursor-pointer outline-none${dim ? ' opacity-60' : ''}" tabindex="0" role="button" aria-label="${n.node.label}: ${fmt(n.value)}"><rect x="${x}" y="${n.rect.y}" width="${n.rect.width}" height="${n.rect.height}" rx="${radius}" fill="${color}" fill-opacity="${op}" stroke="${color}" stroke-width="${isLeaf ? 1 : 1.5}" class="transition-[filter] duration-200 ease-out${hover === index ? ' brightness-110' : ''}"/>${text}</g>`;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const c = cells[hover];
        const x = c.x + 8;
        tip = tooltipRef({ x, y: Math.max(8, c.n.rect.y + 8), title: c.n.node.label, rows: [{ label: 'Value', value: fmt(c.n.value), color: c.color }, { label: 'Share', value: `${utils.formatChartValue((c.n.value / total) * 100, { decimals: 1 })}%` }], flipX: x > W * 0.7 });
    }
    return `<ui-treemap class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="treemap" role="group" aria-label="${summary}"><svg viewBox="0 0 ${W} ${height}" width="100%" height="${height}" class="block w-full overflow-hidden">${body}</svg>${tip}</div></ui-treemap>`;
};
const el = ({ nodes = DISK, height = 320, rtl = false, groupPadding = 3, labels = true, minW = 44, minH = 16, tooltip = true, radius = 2, unit = '', hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', height === 320 ? '' : `height="${height}"`, groupPadding === 3 ? '' : `group-padding="${groupPadding}"`, labels ? '' : 'show-labels="false"', minW === 44 ? '' : `min-label-width="${minW}"`, minH === 16 ? '' : `min-label-height="${minH}"`, tooltip ? '' : 'show-tooltip="false"', radius === 2 ? '' : `cell-radius="${radius}"`, unit ? `unit="${unit}"` : '', hover === null ? '' : `data-enter="[data-slot=treemap-cell],${hover}"`].filter(Boolean).join(' ');
    return `<ge-treemap ${attrs} data-props='${JSON.stringify({ nodes })}'></ge-treemap>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'treemap',
    items: [
        pair('nested'),
        pair('flat', { nodes: FLAT }),
        pair('own-colours', { nodes: COLOURED }),
        pair('bad-values', { nodes: BAD }),
        pair('empty', { nodes: [] }),
        pair('all-zero', { nodes: [{ label: 'x', value: 0 }] }),
        pair('short', { height: 160 }),
        pair('no-labels', { labels: false }),
        pair('strict-label-sizes', { minW: 90, minH: 30 }),
        pair('group-padding-8', { groupPadding: 8 }),
        pair('square-corners', { radius: 0 }),
        pair('rtl', { rtl: true }),
        pair('hover-leaf', { hover: 1, unit: ' GB' }),
        pair('hover-group', { hover: 0 }),
        pair('hover-near-right-edge', { hover: 8 }),
        pair('hover-without-tooltip', { hover: 3, tooltip: false }),
    ],
};
