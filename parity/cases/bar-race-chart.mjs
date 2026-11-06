import { scale, utils } from '../lib/chart-libs.mjs';
import { colorOf } from '../lib/chart-ref.mjs';
// shadcn-angular bar-race-chart.component.ts and .html: the bars are placed with the same helpers; the buttons and slider
// carry the classes the template gives them.
const W = 600;
const H = 400;
const FRAMES = [
    [{ name: 'Apple', value: 120 }, { name: 'Banana', value: 80 }, { name: 'Cherry', value: 60 }, { name: 'Date', value: 20 }],
    [{ name: 'Apple', value: 130 }, { name: 'Banana', value: 160 }, { name: 'Cherry', value: 90 }, { name: 'Date', value: 40 }],
    [{ name: 'Apple', value: 150 }, { name: 'Banana', value: 170 }, { name: 'Cherry', value: 240 }, { name: 'Date', value: 75 }],
];
const LABELS = ['2021', '2022', '2023'];
const SIGNED = [[{ name: 'Revenue', value: 1200 }, { name: 'Profit', value: 300 }, { name: 'Loss', value: -450 }, { name: 'Refunds', value: -40 }]];
const COLORED = [[{ name: 'Red', value: 50, color: '#ef4444' }, { name: 'Blue', value: 30, color: '#3b82f6' }, { name: 'Green', value: 10 }]];
const MANY = [Array.from({ length: 14 }, (_, i) => ({ name: `Item ${i + 1}`, value: 140 - i * 9 }))];
const LOCALES = { en: ['Play', 'Pause', 'Reset', 'Timeline frame'], he: ['הפעל', 'השהה', 'איפוס', 'מסגרת ציר זמן'] };

const rank = (frame) => [...new Map(frame.map((p) => [p.name, p])).values()].sort((a, b) => b.value - a.value);

const ref = ({ frames = FRAMES, labels = LABELS, index = 0, max = 10, radius = 4, gap = 4, rtl = false, playing = false, locale = 'en' } = {}) => {
    const rtlLocale = locale === 'he';
    const pad = { top: 10, right: rtl ? 120 : 80, bottom: 10, left: rtl ? 80 : 120 };
    const area = { left: pad.left, right: W - pad.right, top: pad.top, height: H - pad.top - pad.bottom };
    const barH = (area.height - (max - 1) * gap) / max;
    const frame = frames[index] ?? [];
    const colors = new Map();
    for (const f of frames) for (const p of rank(f)) if (!colors.has(p.name)) colors.set(p.name, colorOf(colors.size, p.color));
    const vals = utils.extent(frame.map((d) => d.value));
    const maxV = frame.length === 0 ? 100 : Math.max(0, vals?.[1] ?? 0) * 1.1;
    const minV = Math.min(0, vals?.[0] ?? 0) * 1.1;
    const vs = scale.linearScale([minV, maxV], rtl ? [area.right, area.left] : [area.left, area.right]);
    const baseline = vs.scale(0);
    const startEdge = rtl ? area.right : area.left;
    const bars = rank(frame).slice(0, max).map((p, r) => {
        const end = vs.scale(p.value);
        const width = Math.abs(end - baseline);
        const y = area.top + r * (barH + gap);
        const growsRight = p.value >= 0 !== rtl;
        const x = Math.min(baseline, end);
        const freeEnd = growsRight ? x + width : x;
        const outside = p.value >= 0 || Math.abs(freeEnd - startEdge) >= 64;
        const labelX = growsRight === outside ? freeEnd + 12 : freeEnd - 12;
        const anchor = growsRight === outside ? 'start' : 'end';
        const mid = y + barH / 2;
        return `<g class="transition-transform duration-300 ease-out"><rect x="${x}" y="${y}" width="${width}" height="${barH}" rx="${radius}" fill="${colors.get(p.name)}" class="transition-all ease-out" style="transition-duration:500ms"/><text x="${rtl ? area.right + 12 : area.left - 12}" y="${mid}" text-anchor="${rtl ? 'start' : 'end'}" dominant-baseline="middle" class="text-sm fill-foreground font-medium transition-all ease-out" style="transition-duration:500ms">${p.name}</text><text x="${labelX}" y="${mid}" text-anchor="${anchor}" dominant-baseline="middle" class="text-sm fill-muted-foreground stroke-background stroke-2 [paint-order:stroke] transition-all ease-out" style="transition-duration:500ms">${utils.formatChartValue(p.value, { compact: true })}</text></g>`;
    }).join('');
    const [play, pause, reset, timeline] = LOCALES[locale];
    const label = labels[index] ?? `Frame ${index + 1}`;
    const icon = playing
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const ends = labels.length > 0 ? `<span>${labels[0]}</span><span>${labels.at(-1)}</span>` : '';
    return `<ui-bar-race-chart class="block"${rtl ? ' dir="rtl"' : ''}><div class="relative block w-full"${rtlLocale ? ' dir="rtl"' : ''} data-slot="bar-race-chart"><div class="flex items-center justify-between mb-4"><div class="text-2xl font-bold text-foreground">${label}</div><div class="flex items-center gap-2"><button type="button" class="p-2 rounded-md hover:bg-muted transition-colors" aria-label="${playing ? pause : play}">${icon}</button><button type="button" class="p-2 rounded-md hover:bg-muted transition-colors" aria-label="${reset}"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button></div></div><svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" style="max-width:${W}px;aspect-ratio:${W} / ${H}" class="overflow-visible" role="img" aria-label="${utils.getChartSummary('Bar race chart', frame.length)}"><g>${bars}</g></svg><div class="mt-4"><div class="flex items-center gap-2"><input type="range" min="0" max="${frames.length - 1}" value="${index}" aria-label="${timeline}" aria-valuetext="${label}" class="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"/></div><div class="flex justify-between text-xs text-muted-foreground mt-1">${ends}</div></div></div></ui-bar-race-chart>`;
};

const el = ({ frames = FRAMES, labels = LABELS, index = 0, max = 10, radius = 4, gap = 4, rtl = false, playing = false, locale = 'en' } = {}) =>
    `<ge-bar-race-chart${rtl ? ' dir="rtl"' : ''}${max === 10 ? '' : ` max-bars="${max}"`}${radius === 4 ? '' : ` bar-radius="${radius}"`}${gap === 4 ? '' : ` bar-gap="${gap}"`}${locale === 'en' ? '' : ` locale="${locale}"`} data-props='${JSON.stringify({ frames, frameLabels: labels, frameIndex: index, playing })}'></ge-bar-race-chart>`;
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'bar-race-chart',
    items: [
        pair('first-frame'),
        pair('later-frame-reordered', { index: 2 }),
        pair('no-labels', { labels: [] }),
        pair('negative-values', { frames: SIGNED, labels: [] }),
        pair('custom-colors', { frames: COLORED, labels: [] }),
        pair('more-points-than-bars', { frames: MANY, labels: [], max: 5 }),
        pair('playing', { playing: true }),
        pair('square-wide-gap', { radius: 0, gap: 12, max: 6 }),
        pair('rtl', { rtl: true, index: 1 }),
        pair('rtl-negative', { rtl: true, frames: SIGNED, labels: [] }),
        pair('hebrew-locale', { locale: 'he' }),
        pair('empty-frame', { frames: [[]], labels: ['Nothing'] }),
    ],
};
