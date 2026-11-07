import { utils, scale } from '../lib/chart-libs.mjs';
// shadcn-angular bar-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 576;
const H = 300;
const LABEL_ROOM = 32;
const pt = (name, value, color) => ({ name, value, ...(color ? { color } : {}) });
const DATA = [pt('Jan', 120), pt('Feb', 200), pt('Mar', 150), pt('Apr', 280), pt('May', 240)];
const MIXED = [pt('Jan', -40), pt('Feb', 120), pt('Mar', -90), pt('Apr', 60), pt('May', 200)];
const COLORED = [pt('Red', 40, '#ef4444'), pt('Green', 70, '#22c55e'), pt('Blue', 55, '#3b82f6')];

const compact = (v) => utils.formatChartValue(v, { compact: true });
const axisFmt = (v) => utils.formatChartValue(v, { compact: true, decimals: Number.isInteger(v) ? 0 : 6 });

const geometry = ({ data, vertical, rtl, gap, xLabel }) => {
    const p = { top: 20, right: rtl ? 80 : 20, bottom: xLabel ? 50 : 35, left: rtl ? 20 : 80 };
    const area = { left: p.left, right: W - p.right, top: p.top, bottom: H - p.bottom, width: W - p.left - p.right, height: H - p.top - p.bottom };
    const domain = scale.zeroBasedDomain(data.map((d) => d.value), 5);
    let range = [area.left, area.right];
    if (vertical) range = [area.bottom, area.top];
    else if (rtl) range = [area.right, area.left];
    const vs = scale.linearScale(domain, range);
    const size = ((vertical ? area.width : area.height) - (data.length - 1) * gap) / data.length;
    const zero = vs.scale(0);
    const growsRight = (v) => v >= 0 !== rtl;
    const bars = data.map((point, index) => {
        const end = vs.scale(point.value);
        const start = Math.min(zero, end);
        const length = Math.abs(end - zero);
        const offset = index * (size + gap);
        const color = utils.getChartColor(index, point.color);
        if (vertical) {
            const x = rtl ? area.right - offset - size : area.left + offset;
            let ly = start - 6;
            if (point.value < 0) {
                const below = start + length + 14;
                ly = below <= area.bottom + 2 ? below : start + length - 6;
            }
            return { index, data: point, x, y: start, width: size, height: length, color, lx: x + size / 2, ly, anchor: 'middle' };
        }
        const y = area.top + offset;
        const gr = growsRight(point.value);
        const freeEnd = gr ? start + length : start;
        const room = gr ? area.right - freeEnd : freeEnd - area.left;
        const outside = room >= LABEL_ROOM;
        return { index, data: point, x: start, y, width: length, height: size, color, lx: gr === outside ? freeEnd + 6 : freeEnd - 6, ly: y + size / 2, anchor: gr === outside ? 'start' : 'end' };
    });
    return { area, domain, vs, bars };
};

const ref = ({ data = DATA, vertical = true, rtl = false, gap = 8, radius = 4, grid = true, values = true, xLabel = '', yLabel = '', hover = null } = {}) => {
    const { area, domain, vs, bars } = geometry({ data, vertical, rtl, gap, xLabel });
    const ticks = vs.ticks(5);
    const gridLines = grid
        ? `<g class="text-border">${ticks.map((tick) => {
              const zero = tick === 0 && domain[0] < 0;
              const pos = vs.scale(tick);
              const [x1, y1, x2, y2] = vertical ? [area.left, pos, area.right, pos] : [pos, area.top, pos, area.bottom];
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity="${zero ? 1 : 0.2}"${zero ? '' : ' stroke-dasharray="4 4"'}${zero ? ' class="text-muted-foreground"' : ''}/>`;
          }).join('')}</g>`
        : '';
    const tickText = `<g class="text-muted-foreground text-xs">${ticks.map((tick) => (vertical ? `<text x="${rtl ? area.right + 8 : area.left - 8}" y="${vs.scale(tick)}" text-anchor="end" dominant-baseline="middle" fill="currentColor">${axisFmt(tick)}</text>` : `<text x="${vs.scale(tick)}" y="${area.bottom + 16}" text-anchor="middle" fill="currentColor">${axisFmt(tick)}</text>`)).join('')}</g>`;
    const nameText = `<g class="text-muted-foreground text-xs">${bars.map((b) => (vertical ? `<text x="${b.x + b.width / 2}" y="${area.bottom + 16}" text-anchor="middle" fill="currentColor" class="truncate">${b.data.name}</text>` : `<text x="${rtl ? area.right + 12 : area.left - 12}" y="${b.y + b.height / 2}" text-anchor="end" dominant-baseline="middle" fill="currentColor">${b.data.name}</text>`)).join('')}</g>`;
    const groups = bars.map((b) => {
        const cls = `cursor-pointer outline-none${hover !== null && hover !== b.index ? ' opacity-50' : ''}`;
        const rectCls = `transition-all duration-200 ease-out${hover === b.index ? ' brightness-110' : ''}`;
        const label = values ? `<text x="${b.lx}" y="${b.ly}" text-anchor="${b.anchor}" dominant-baseline="${vertical ? 'auto' : 'middle'}" class="text-xs font-medium pointer-events-none stroke-background stroke-2 [paint-order:stroke] fill-foreground">${compact(b.data.value)}</text>` : '';
        return `<g class="${cls}" tabindex="0" role="button" aria-label="${utils.getPointAriaLabel(b.data.name, b.data.value)}"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${radius}" fill="${b.color}" class="${rectCls}"/>${label}</g>`;
    }).join('');
    const xText = xLabel ? `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="text-sm fill-muted-foreground">${xLabel}</text>` : '';
    const yText = yLabel ? `<text x="${rtl ? W - 12 : 12}" y="${H / 2}" text-anchor="middle" transform="${rtl ? `rotate(90 ${W - 12} ${H / 2})` : `rotate(-90 12 ${H / 2})`}" class="text-sm fill-muted-foreground">${yLabel}</text>` : '';
    let tip = '';
    if (hover !== null) {
        const b = bars[hover];
        const x = vertical ? b.x + b.width / 2 + 12 : b.x + b.width + 12;
        const y = vertical ? Math.max(8, b.y - 8) : b.y + b.height / 2;
        tip = `<div class="absolute z-50 px-3 py-2 text-sm bg-popover text-popover-foreground rounded-md shadow-lg border pointer-events-none max-w-[calc(100vw-2rem)] break-words${x > W * 0.7 ? ' -translate-x-full' : ''}" style="left:${x}px;top:${y}px"><div class="font-medium">${b.data.name}</div><div class="text-muted-foreground">${compact(b.data.value)}</div></div>`;
    }
    const type = vertical ? 'Column chart' : 'Bar chart';
    return `<ui-bar-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative block w-full" data-slot="bar-chart"><svg role="group" aria-label="${utils.getChartSummary(type, data.length)}" viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible">${gridLines}${tickText}${nameText}<g>${groups}</g>${xText}${yText}</svg>${tip}</div></ui-bar-chart>`;
};

const el = ({ data = DATA, vertical = true, rtl = false, gap = 8, radius = 4, grid = true, values = true, xLabel = '', yLabel = '', hover = null } = {}) =>
    `<ge-bar-chart${vertical ? '' : ' orientation="horizontal"'}${rtl ? ' dir="rtl"' : ''}${gap === 8 ? '' : ` bar-gap="${gap}"`}${radius === 4 ? '' : ` bar-radius="${radius}"`}${grid ? '' : ' show-grid="false"'}${values ? '' : ' show-values="false"'}${xLabel ? ` x-axis-label="${xLabel}"` : ''}${yLabel ? ` y-axis-label="${yLabel}"` : ''}${hover === null ? '' : ` data-hover-bar="${hover}"`} data-props='${JSON.stringify({ data })}'></ge-bar-chart>`;
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'bar-chart',
    items: [
        pair('vertical'),
        pair('horizontal', { vertical: false }),
        pair('vertical-negative', { data: MIXED }),
        pair('horizontal-negative', { data: MIXED, vertical: false }),
        pair('custom-colors', { data: COLORED }),
        pair('no-grid', { grid: false }),
        pair('no-values', { values: false }),
        pair('square-bars', { radius: 0 }),
        pair('tight-gap', { gap: 2 }),
        pair('axis-captions', { xLabel: 'Month', yLabel: 'Units' }),
        pair('rtl-vertical', { rtl: true }),
        pair('rtl-horizontal', { rtl: true, vertical: false }),
        pair('hover-vertical', { hover: 1 }),
        pair('hover-horizontal', { hover: 3, vertical: false }),
        pair('hover-flips-near-right-edge', { hover: 4 }),
    ],
};
