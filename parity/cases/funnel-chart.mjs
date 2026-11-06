import { utils } from '../lib/chart-libs.mjs';
import { colorOf, tooltipRef } from '../lib/chart-ref.mjs';
// shadcn-angular funnel-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const W = 440;
const H = 300;
const PAD = 8;
const pt = (name, value, color) => ({ name, value, ...(color ? { color } : {}) });
const DATA = [pt('Visitors', 5000), pt('Signups', 3200), pt('Trials', 1800), pt('Paid', 640), pt('Retained', 410)];
const COLORED = [pt('Top', 100, '#6366f1'), pt('Mid', 60, '#06b6d4'), pt('Low', 20, '#f59e0b')];
const ODD = [pt('Start', 100), pt('Negative', -30), pt('Zero', 0), pt('Tail', 40)];
const ZEROS = [pt('A', 0), pt('B', 0)];

const ref = ({ data = DATA, mode = 'first', gap = 2, values = true, tooltip = true, hover = null } = {}) => {
    const n = data.length;
    const max = utils.extent(data.map((d) => utils.positiveOrZero(d.value)))?.[1] ?? 0;
    const share = (v) => (max === 0 ? 0 : utils.positiveOrZero(v) / max);
    const percent = (i) => {
        if (i === 0) return 100;
        const base = utils.positiveOrZero((mode === 'first' ? data[0] : data[i - 1]).value);
        return base === 0 ? 0 : (utils.positiveOrZero(data[i].value) / base) * 100;
    };
    const innerW = W - PAD * 2;
    const cx = W / 2;
    const sh = (H - PAD * 2 - gap * (n - 1)) / n;
    const stages = data.map((d, i) => {
        const top = share(d.value) * innerW;
        const bottom = share(i < n - 1 ? data[i + 1].value : d.value) * innerW;
        const yTop = PAD + i * (sh + gap);
        const yBottom = yTop + sh;
        return { i, d, top, midY: yTop + sh / 2, pct: percent(i), color: colorOf(i, d.color), points: [`${cx - top / 2},${yTop}`, `${cx + top / 2},${yTop}`, `${cx + bottom / 2},${yBottom}`, `${cx - bottom / 2},${yBottom}`].join(' ') };
    });
    const body = stages.map((s) => {
        const op = hover === null || hover === s.i ? 0.9 : 0.55;
        const poly = `<polygon data-slot="funnel-stage" points="${s.points}" fill="${s.color}" fill-opacity="${op}" class="cursor-pointer transition-[fill-opacity]" tabindex="0" role="button" aria-label="${s.d.name}: ${s.d.value} (${utils.formatPercentage(s.pct)})"/>`;
        const text = values && s.top > 0 ? `<text x="${cx}" y="${s.midY}" text-anchor="middle" dominant-baseline="middle" class="pointer-events-none fill-primary-foreground text-xs font-medium">${s.d.name} · ${utils.formatPercentage(s.pct)}</text>` : '';
        return poly + text;
    }).join('');
    let tip = '';
    if (hover !== null && tooltip) {
        const s = stages[hover];
        tip = tooltipRef({ x: cx, y: Math.max(8, s.midY - 8), title: s.d.name, rows: [{ label: 'Value', value: utils.formatChartValue(s.d.value), color: s.color }, { label: 'Share', value: utils.formatPercentage(s.pct) }] });
    }
    return `<ui-funnel-chart class="block"><div class="relative w-full" data-slot="funnel-chart" role="group" aria-label="${utils.getChartSummary('Funnel chart', n)}"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" class="block w-full">${body}</svg>${tip}</div></ui-funnel-chart>`;
};

const el = ({ data = DATA, mode = 'first', gap = 2, values = true, tooltip = true, hover = null } = {}) => {
    const attrs = [mode === 'first' ? '' : `percentage-mode="${mode}"`, gap === 2 ? '' : `gap="${gap}"`, values ? '' : 'show-values="false"', tooltip ? '' : 'show-tooltip="false"', hover === null ? '' : `data-enter=".stage,${hover}"`].filter(Boolean).join(' ');
    return `<ge-funnel-chart ${attrs} data-props='${JSON.stringify({ data })}'></ge-funnel-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: `width:${W + 24}px;`, ref: ref(opts), el: el(opts) });

export default {
    name: 'funnel-chart',
    items: [
        pair('default'),
        pair('previous-mode', { mode: 'previous' }),
        pair('custom-colors', { data: COLORED }),
        pair('negative-and-zero-stages', { data: ODD }),
        pair('all-zero', { data: ZEROS }),
        pair('no-gap', { gap: 0 }),
        pair('wide-gap', { gap: 12 }),
        pair('no-values', { values: false }),
        pair('hover-stage', { hover: 2 }),
        pair('hover-first-stage-previous-mode', { hover: 3, mode: 'previous' }),
        pair('hover-without-tooltip', { hover: 1, tooltip: false }),
    ],
};
