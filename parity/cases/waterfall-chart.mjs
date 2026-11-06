import { utils, scale, interaction } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular waterfall-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const H = 320;
const bar = (name, value, type, color) => ({ name, value, ...(type ? { type } : {}), ...(color ? { color } : {}) });
const DATA = [bar('Start', 1000, 'total'), bar('Sales', 450), bar('Refunds', -120), bar('Costs', -380), bar('Tax', -90), bar('End', 860, 'total')];
const TWO_TOTALS = [bar('Q1', 500, 'total'), bar('Growth', 200), bar('Q2', 650, 'total'), bar('Dip', -300)];
const BELOW_ZERO = [bar('Start', 100, 'total'), bar('Loss', -250), bar('Gain', 80)];
const CUSTOM = [bar('Start', 100, 'total', '#6366f1'), bar('Up', 60, undefined, '#06b6d4'), bar('Down', -30)];
const SAME_NAME = [bar('Item', 50), bar('Item', -20), bar('Item', 30)];
const ZERO = [bar('Zero', 0), bar('One', 40)];
const DEF = { pos: 'hsl(142, 71%, 45%)', neg: 'hsl(0, 84%, 60%)', total: 'hsl(221, 83%, 53%)' };

const geometry = ({ data, rtl, colors }) => {
    let running = 0;
    const levels = data.map((b) => {
        if (b.type === 'total') {
            running = b.value;
            return { from: 0, to: b.value };
        }
        const from = running;
        running += b.value;
        return { from, to: running };
    });
    const area = { left: 44, right: W - 12, top: 12, bottom: H - 28 };
    const [min, max] = utils.extent(levels.flatMap((l) => [l.from, l.to]).concat(0)) ?? [0, 0];
    const ys = scale.linearScale(scale.niceDomain(min, max, 5), [area.bottom, area.top]);
    const band = scale.bandScale(data.map((_b, i) => String(i)), rtl ? [area.right, area.left] : [area.left, area.right], 0.3, 0.15);
    const colorFor = (b) => b.color ?? (b.type === 'total' ? colors.total : b.value >= 0 ? colors.pos : colors.neg);
    const bars = data.map((b, i) => {
        const yFrom = ys.scale(levels[i].from);
        const yTo = ys.scale(levels[i].to);
        const x = band.position(String(i)) ?? 0;
        return { ...b, to: levels[i].to, color: colorFor(b), x, y: Math.min(yFrom, yTo), width: band.bandwidth, height: Math.max(1, Math.abs(yFrom - yTo)), cx: x + band.bandwidth / 2 };
    });
    return { levels, ys, bars };
};

const ref = ({ data = DATA, rtl = false, connectors = true, values = false, radius = 2, colors = DEF, hover = null, tooltip = true } = {}) => {
    const { levels, ys, bars } = geometry({ data, rtl, colors });
    const ticks = ys.ticks(5).map((value) => ({ value, y: ys.scale(value) }));
    const grid = ticks.map((g) => `<line x1="0" x2="${W}" y1="${g.y}" y2="${g.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/><text x="4" y="${g.y - 2}" class="fill-muted-foreground text-[10px]">${g.value}</text>`).join('');
    const lines = connectors ? bars.slice(0, -1).map((b, i) => { const y = ys.scale(levels[i].to); return `<line data-slot="waterfall-connector" x1="${b.x + b.width}" y1="${y}" x2="${bars[i + 1].x}" y2="${y}" class="stroke-muted-foreground/50" stroke-width="1" stroke-dasharray="3 2"/>`; }).join('') : '';
    const rects = bars.map((b, i) => `<rect data-slot="waterfall-bar" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${radius}" fill="${b.color}" fill-opacity="${hover === null || hover.index === i ? 1 : 0.6}" class="cursor-pointer transition-[fill-opacity]" tabindex="0" role="button" aria-label="${b.name}: ${b.value} (total ${b.to})"/>${values ? `<text x="${b.cx}" y="${b.y - 4}" text-anchor="middle" class="pointer-events-none fill-foreground text-[10px]">${b.value}</text>` : ''}<text x="${b.cx}" y="${H - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${b.name}</text>`).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const b = bars[hover.index];
        const x = b.cx + 12;
        tip = tooltipRef({ x, y: hover.y, title: b.name, rows: [{ label: 'Change', value: utils.formatChartValue(b.value), color: b.color }, { label: 'Total', value: utils.formatChartValue(b.to) }], flipX: x > W * 0.7 });
    }
    return `<ui-waterfall-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="waterfall-chart" role="group" aria-label="${utils.getChartSummary('Waterfall chart', data.length)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full overflow-visible" style="touch-action: none">${grid}${lines}${rects}</svg>${tip}</div></ui-waterfall-chart>`;
};

const el = ({ data = DATA, rtl = false, connectors = true, values = false, radius = 2, colors = DEF, hover = null, tooltip = true } = {}) => {
    const { bars } = geometry({ data, rtl, colors });
    const custom = colors !== DEF;
    const attrs = [connectors ? '' : 'show-connectors="false"', values ? 'show-values' : '', tooltip ? '' : 'show-tooltip="false"', radius === 2 ? '' : `bar-radius="${radius}"`, custom ? `positive-color="${colors.pos}" negative-color="${colors.neg}" total-color="${colors.total}"` : '', rtl ? 'dir="rtl"' : '', hover === null ? '' : `data-hover-at="${bars[hover.index].cx},${hover.y + 8}"`].filter(Boolean).join(' ');
    return `<ge-waterfall-chart ${attrs} data-props='${JSON.stringify({ data })}'></ge-waterfall-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'waterfall-chart',
    items: [
        pair('default'),
        pair('two-totals', { data: TWO_TOTALS }),
        pair('below-zero', { data: BELOW_ZERO }),
        pair('custom-bar-colors', { data: CUSTOM }),
        pair('same-names', { data: SAME_NAME }),
        pair('zero-change', { data: ZERO }),
        pair('no-connectors', { connectors: false }),
        pair('show-values', { values: true }),
        pair('square-bars', { radius: 0 }),
        pair('custom-palette', { colors: { pos: '#16a34a', neg: '#b91c1c', total: '#7c3aed' } }),
        pair('rtl', { rtl: true }),
        pair('hover', { hover: { index: 2, y: 60 } }),
        pair('hover-flips-near-right-edge', { hover: { index: 5, y: 90 } }),
        pair('hover-without-tooltip', { hover: { index: 1, y: 60 }, tooltip: false }),
    ],
};
