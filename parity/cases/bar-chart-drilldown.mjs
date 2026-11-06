import { utils, scale } from '../lib/chart-libs.mjs';
// shadcn-angular bar-chart-drilldown.component.ts and .html: the geometry uses the same helpers. Angular never positions its
// tooltip (it stays at 0,0); the reference anchors it to the hovered column, as the other bar charts do.
const W = 500;
const H = 300;
const pt = (name, value, extra = {}) => ({ name, value, ...extra });
const DATA = [pt('Fruit', 500, { drilldown: 'fruit' }), pt('Veg', 300, { drilldown: 'veg' }), pt('Dairy', 150), pt('Orphan', 50, { drilldown: 'missing' })];
const SERIES = [
    { id: 'fruit', name: 'Fruit', data: [pt('Apple', 240), pt('Pear', 160), pt('Plum', 100), pt('Fig', 12000)] },
    { id: 'veg', name: 'Vegetables', data: [pt('Kale', 90, { color: '#16a34a' }), pt('Beet', -40), pt('Leek', 0)] },
];
const MIXED = [pt('Gain', 120, { drilldown: 'veg' }), pt('Loss', -80), pt('Tiny loss', -2), pt('Flat', 0)];
const compact = (v) => utils.formatChartValue(v, { compact: true });

const ref = ({ data = DATA, series = SERIES, open = null, title, rtl = false, grid = true, values = true, tooltip = true, radius = 4, gap = 8, breadcrumb = true, back = 'Back', hover = null } = {}) => {
    const drill = (p) => !!p.drilldown && series.some((s) => s.id === p.drilldown);
    const shown = open ? (series.find((s) => s.id === open)?.data ?? []) : data;
    const name = open ? (series.find((s) => s.id === open)?.name ?? '') : (title ?? 'Overview');
    const pad = { top: 20, right: rtl ? 70 : 20, bottom: 35, left: rtl ? 20 : 70 };
    const area = { left: pad.left, right: W - pad.right, top: pad.top, bottom: H - pad.bottom, width: W - pad.left - pad.right };
    const domain = scale.zeroBasedDomain(shown.map((d) => d.value), 5);
    const vs = scale.linearScale(domain, [area.bottom, area.top]);
    const ticks = vs.ticks(5);
    const bw = (area.width - (shown.length - 1) * gap) / shown.length;
    const zero = vs.scale(0);
    const bars = shown.map((p, index) => {
        const end = vs.scale(p.value);
        const y = Math.min(zero, end);
        const height = Math.abs(end - zero);
        const x = rtl ? area.right - index * (bw + gap) - bw : area.left + index * (bw + gap);
        const below = y + height + 14;
        let labelY = y - 6;
        if (p.value < 0) labelY = below <= area.bottom + 2 ? below : y + height - 6;
        return { index, p, x, y, height, labelY, color: utils.getChartColor(index, p.color) };
    });
    const neg = domain[0] < 0;
    const gridLines = grid ? `<g class="text-border">${ticks.map((t) => { const z = t === 0 && neg; const y = vs.scale(t); return `<line x1="${area.left}" y1="${y}" x2="${area.right}" y2="${y}" stroke="currentColor" stroke-opacity="${z ? 1 : 0.2}"${z ? '' : ' stroke-dasharray="4 4"'}${z ? ' class="text-muted-foreground"' : ''}/>`; }).join('')}</g>` : '';
    const axis = `<g class="text-muted-foreground text-xs">${ticks.map((t) => `<text x="${rtl ? area.right + 12 : area.left - 12}" y="${vs.scale(t)}" text-anchor="end" dominant-baseline="middle" fill="currentColor">${utils.formatChartValue(t, { compact: true, decimals: Number.isInteger(t) ? 0 : 6 })}</text>`).join('')}</g>`;
    const cats = `<g class="text-muted-foreground text-xs">${bars.map((b) => `<text x="${b.x + bw / 2}" y="${area.bottom + 16}" text-anchor="middle" fill="currentColor">${b.p.name}</text>`).join('')}</g>`;
    const groups = bars.map((b) => {
        const dim = hover !== null && hover !== b.index;
        const hot = hover === b.index;
        const label = `${utils.getPointAriaLabel(b.p.name, b.p.value)}${drill(b.p) ? '. Press Enter to drill down.' : ''}`;
        const text = values ? `<text x="${b.x + bw / 2}" y="${b.labelY}" text-anchor="middle" class="text-xs font-medium fill-foreground pointer-events-none stroke-background stroke-2 [paint-order:stroke]">${compact(b.p.value)}</text>` : '';
        return `<g class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${label}"><rect x="${b.x}" y="${b.y}" width="${bw}" height="${b.height}" rx="${radius}" fill="${b.color}" class="transition-all duration-200 ease-out${hot ? ' brightness-110' : ''}"/>${text}</g>`;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const b = bars[hover];
        const x = b.x + bw / 2 + 12;
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words${x > W * 0.7 ? ' -translate-x-full' : ''}" style="left:${x}px;top:${Math.max(8, b.y - 8)}px"><div class="font-medium">${b.p.name}</div><div class="text-muted-foreground">${compact(b.p.value)}</div>${drill(b.p) ? '<div class="text-xs text-primary mt-1">Click to drill down</div>' : ''}</div>`;
    }
    const chev = rtl ? '<path d="m9 18 6-6-6-6"/>' : '<path d="m15 18-6-6 6-6"/>';
    const crumb = open && breadcrumb
        ? `<div class="flex items-center gap-2 mb-4"><button type="button" class="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${chev}</svg>${back}</button><span class="text-muted-foreground">/</span><span class="text-sm font-medium">${name}</span></div>`
        : '';
    return `<ui-bar-chart-drilldown class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative block w-full" data-slot="bar-chart-drilldown">${crumb}<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible" role="group" aria-label="${utils.getChartSummary('Column chart with drilldown', shown.length, name)}">${gridLines}${axis}${cats}<g>${groups}</g></svg>${tip}</div></ui-bar-chart-drilldown>`;
};

const el = ({ data = DATA, series = SERIES, open = null, title, rtl = false, grid = true, values = true, tooltip = true, radius = 4, gap = 8, breadcrumb = true, back = 'Back', hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', grid ? '' : 'show-grid="false"', values ? '' : 'show-values="false"', tooltip ? '' : 'show-tooltip="false"', radius === 4 ? '' : `bar-radius="${radius}"`, gap === 8 ? '' : `bar-gap="${gap}"`, breadcrumb ? '' : 'show-breadcrumb="false"', back === 'Back' ? '' : `back-button-text="${back}"`, title ? `heading="${title}"` : '', hover === null ? '' : `data-enter=".bar-group,${hover}"`].filter(Boolean).join(' ');
    return `<ge-bar-chart-drilldown ${attrs} data-props='${JSON.stringify({ data, drilldownSeries: series, currentDrilldownId: open })}'></ge-bar-chart-drilldown>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'bar-chart-drilldown',
    items: [
        pair('top-level'),
        pair('drilled-down', { open: 'fruit' }),
        pair('drilled-negative-and-zero', { open: 'veg' }),
        pair('mixed-signs', { data: MIXED }),
        pair('drilled-localised-back', { open: 'fruit', back: 'חזרה' }),
        pair('drilled-without-breadcrumb', { open: 'fruit', breadcrumb: false }),
        pair('rtl', { rtl: true }),
        pair('rtl-drilled', { rtl: true, open: 'veg' }),
        pair('no-grid-no-values', { grid: false, values: false }),
        pair('square-tight', { radius: 0, gap: 2 }),
        pair('hover-drillable-column', { hover: 0 }),
        pair('hover-plain-column', { hover: 2 }),
        pair('hover-orphan-drilldown-id-is-inert', { hover: 3 }),
        pair('hover-near-right-edge-flips', { hover: 3, data: [pt('A', 5), pt('B', 9), pt('C', 3), pt('D', 8, { drilldown: 'veg' })] }),
        pair('hover-drilled-column', { open: 'fruit', hover: 1 }),
        pair('hover-without-tooltip', { hover: 0, tooltip: false }),
    ],
};
