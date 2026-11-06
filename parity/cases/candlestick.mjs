import { candlestickLib as ohlc, scale, utils } from '../lib/chart-libs.mjs';
import { tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular candlestick.component.ts and .html; the OHLC helpers and scales are the code it runs.
const W = 500;
const d = (n) => `2024-03-${String(n).padStart(2, '0')}`;
const WEEK = [
    { date: d(4), open: 100, high: 108, low: 98, close: 105 },
    { date: d(5), open: 105, high: 110, low: 101, close: 102 },
    { date: d(6), open: 102, high: 104, low: 95, close: 96 },
    { date: d(7), open: 96, high: 103, low: 94, close: 102 },
    { date: d(8), open: 102, high: 112, low: 102, close: 102 },
];
const GAPPED = [WEEK[0], WEEK[1], { ...WEEK[2], date: d(11) }, { ...WEEK[3], date: d(12) }];
const MONTH = Array.from({ length: 22 }, (_, i) => ({ date: d(i + 1), open: 100 + i, high: 106 + i, low: 96 + i, close: i % 3 === 0 ? 99 + i : 104 + i }));
const LABELS = Array.from({ length: 10 }, (_, i) => ({ date: `Week ${i + 1}`, open: 50 + i, high: 58 + i, low: 46 + i, close: 55 + i * (i % 2 ? -1 : 1) }));
const BAD = [WEEK[0], { date: 'x', open: Number.NaN, high: 1, low: 1, close: 1 }, WEEK[1]];

const ref = ({ points = WEEK, time = false, rtl = false, grid = true, tooltip = true, rising = 'hsl(142, 71%, 45%)', falling = 'hsl(0, 84%, 60%)', unit = '', locale = 'en-US', height = 300, hover = null } = {}) => {
    const clean = ohlc.normalizeOhlc(points);
    const usable = time ? clean.filter((p) => Number.isFinite(ohlc.toTimestamp(p.date))) : clean;
    const summary = utils.getChartSummary('Candlestick chart', usable.length);
    if (usable.length === 0) return `<ui-candlestick class="block"><div class="relative w-full" data-slot="candlestick" role="group" aria-label="${summary}"><div data-slot="candlestick-empty" class="flex items-center justify-center rounded-md border border-dashed p-4 text-sm text-muted-foreground sm:p-6" style="min-height:${height}px">No data to display</div></div></ui-candlestick>`;
    const a = { left: rtl ? 12 : 52, right: W - (rtl ? 52 : 12), top: 12, bottom: height - 28 };
    const dom = ohlc.ohlcExtent(usable);
    const ps = scale.linearScale(dom ? scale.niceDomain(dom[0], dom[1], 5) : [0, 1], [a.bottom, a.top]);
    const stamps = usable.map((p) => ohlc.toTimestamp(p.date));
    const [lo, hi] = utils.extent(stamps) ?? [0, 0];
    const ts = scale.timeScale([lo, hi === lo ? lo + 1 : hi], rtl ? [a.right, a.left] : [a.left, a.right]);
    let slots;
    if (time) {
        const w = Math.max(1, Math.min(28, (Math.abs(a.right - a.left) / Math.max(1, usable.length)) * 0.6));
        slots = stamps.map((t) => ({ centre: ts.scale(t), width: w }));
    } else {
        const keys = usable.map((_, i) => String(i));
        const bands = scale.bandScale(rtl ? [...keys].reverse() : keys, [a.left, a.right], 0.3, 0.15);
        const bw = Math.abs(bands.bandwidth);
        slots = keys.map((k) => ({ centre: (bands.position(k) ?? a.left) + bw / 2, width: Math.max(1, Math.min(28, bw)) }));
    }
    const fmt = (v) => utils.formatChartValue(v, { decimals: 2 }) + unit;
    const candles = usable.map((p, index) => {
        const up = ohlc.isRising(p);
        const [oa, ob, wa, wb] = [p.open, p.close, p.high, p.low].map((v) => ps.scale(v));
        const s = slots[index];
        return { index, p, up, color: up ? rising : falling, x: s.centre - s.width / 2, y: Math.min(oa, ob), w: s.width, h: Math.max(1, Math.abs(ob - oa)), c: s.centre, wt: Math.min(wa, wb), wb: Math.max(wa, wb), label: ohlc.formatPeriod(p.date, locale) };
    });
    const priceTicks = ps.ticks(5).map((value) => ({ value, y: ps.scale(value) }));
    let axis;
    if (time) axis = utils.extent(stamps) && scale.niceTimeTicks(lo, hi, 5).map((t) => ({ key: String(t), label: ohlc.formatPeriod(t, locale), x: ts.scale(t) }));
    else {
        const stride = Math.max(1, Math.ceil(candles.length / 8));
        axis = candles.filter((_, i) => i % stride === 0).map((c) => ({ key: String(c.index), label: c.label, x: c.c }));
    }
    const gridLines = grid ? priceTicks.map((t) => `<line data-slot="grid-line" x1="${a.left}" x2="${a.right}" y1="${t.y}" y2="${t.y}" class="stroke-border" stroke-width="1" stroke-dasharray="2 3"/>`).join('') : '';
    const priceText = priceTicks.map((t) => `<text x="${rtl ? a.right + 8 : a.left - 8}" y="${t.y + 3}" text-anchor="${rtl ? 'start' : 'end'}" class="fill-muted-foreground text-[10px]">${fmt(t.value)}</text>`).join('');
    const axisText = axis.map((t) => `<text x="${t.x}" y="${height - 10}" text-anchor="middle" class="fill-muted-foreground text-[10px]">${t.label}</text>`).join('');
    const body = candles.map((c) => {
        const dim = hover !== null && hover !== c.index;
        const label = `${c.label}: open ${fmt(c.p.open)}, high ${fmt(c.p.high)}, low ${fmt(c.p.low)}, close ${fmt(c.p.close)}`;
        return `<g data-slot="candlestick-candle" data-direction="${c.up ? 'rising' : 'falling'}" class="cursor-pointer outline-none${dim ? ' opacity-50' : ''}" tabindex="0" role="button" aria-label="${label}"><line data-slot="candlestick-wick" x1="${c.c}" x2="${c.c}" y1="${c.wt}" y2="${c.wb}" stroke="${c.color}" stroke-width="1"/><rect data-slot="candlestick-body" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${c.color}" stroke="${c.color}" stroke-width="1" class="transition-[filter] duration-200 ease-out${hover === c.index ? ' brightness-110' : ''}"/></g>`;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const c = candles[hover];
        const x = c.c + 8;
        tip = tooltipRef({ x, y: Math.max(8, c.wt - 8), title: c.label, rows: [{ label: 'Open', value: fmt(c.p.open), color: c.color }, { label: 'High', value: fmt(c.p.high) }, { label: 'Low', value: fmt(c.p.low) }, { label: 'Close', value: fmt(c.p.close) }], flipX: x > W * 0.7 });
    }
    return `<ui-candlestick class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative w-full" data-slot="candlestick" role="group" aria-label="${summary}"><svg viewBox="0 0 ${W} ${height}" width="100%" height="${height}" class="block w-full overflow-visible">${gridLines}${priceText}${axisText}${body}</svg>${tip}</div></ui-candlestick>`;
};
const el = ({ points = WEEK, time = false, rtl = false, grid = true, tooltip = true, rising = 'hsl(142, 71%, 45%)', falling = 'hsl(0, 84%, 60%)', unit = '', locale = 'en-US', height = 300, hover = null } = {}) => {
    const attrs = [rtl ? 'dir="rtl"' : '', time ? 'axis-mode="time"' : '', height === 300 ? '' : `height="${height}"`, grid ? '' : 'show-grid="false"', tooltip ? '' : 'show-tooltip="false"', rising === 'hsl(142, 71%, 45%)' ? '' : `rising-color="${rising}"`, falling === 'hsl(0, 84%, 60%)' ? '' : `falling-color="${falling}"`, unit ? `unit="${unit}"` : '', locale === 'en-US' ? '' : `locale="${locale}"`, hover === null ? '' : `data-enter="[data-slot=candlestick-candle],${hover}"`].filter(Boolean).join(' ');
    return `<ge-candlestick ${attrs} data-props='${JSON.stringify({ points })}'></ge-candlestick>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'candlestick',
    items: [
        pair('ordinal'),
        pair('time-axis', { time: true }),
        pair('ordinal-gap-collapsed', { points: GAPPED }),
        pair('time-axis-gap-shown', { points: GAPPED, time: true }),
        pair('month-of-candles', { points: MONTH }),
        pair('text-labels', { points: LABELS }),
        pair('bad-rows-dropped', { points: BAD }),
        pair('single-period', { points: [WEEK[0]] }),
        pair('single-period-time', { points: [WEEK[0]], time: true }),
        pair('empty', { points: [] }),
        pair('no-grid', { grid: false }),
        pair('custom-colours-unit-locale', { rising: '#2563eb', falling: '#f59e0b', unit: '$', locale: 'de-DE' }),
        pair('short', { height: 180 }),
        pair('rtl', { rtl: true }),
        pair('rtl-time', { rtl: true, time: true }),
        pair('hover', { hover: 2, unit: '$' }),
        pair('hover-near-right-edge', { hover: 4 }),
        pair('hover-without-tooltip', { hover: 1, tooltip: false }),
    ],
};
