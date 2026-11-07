import { utils } from '../lib/chart-libs.mjs';
import { colorOf } from '../lib/chart-ref.mjs';
// shadcn-angular gauge-chart.component.ts and .html: the geometry is computed with the same helpers it uses.
const ZONES = [{ value: 0, color: '#22c55e' }, { value: 60, color: '#eab308' }, { value: 85, color: '#ef4444' }];

const ref = ({ value, min = 0, max = 100, size = 220, thickness = 0.2, thresholds = [], label = '', unit = '', showValue = true } = {}) => {
    const c = size / 2;
    const outer = c - 8;
    const inner = outer * (1 - thickness);
    const h = c + 36;
    const span = max - min;
    const ratio = span <= 0 ? 0 : Math.max(0, Math.min(1, (value - min) / span));
    let color = colorOf(0);
    for (const t of [...thresholds].sort((a, b) => a.value - b.value)) if (value >= t.value) color = t.color;
    const display = `${utils.formatChartValue(value)}${unit}`;
    const aria = `Gauge. ${label ? `${label}: ` : ''}${display} of ${utils.formatChartValue(max)}${unit}.`;
    const track = utils.describeArc(c, c, outer, inner, Math.PI, Math.PI * 2);
    const val = ratio > 0 ? `<path data-slot="gauge-value" d="${utils.describeArc(c, c, outer, inner, Math.PI, Math.PI + Math.PI * ratio)}" fill="${color}" class="transition-[d]"/>` : '';
    const v = showValue ? `<text x="${c}" y="${c - 2}" text-anchor="middle" class="fill-foreground text-xl font-semibold">${display}</text>` : '';
    const l = label ? `<text x="${c}" y="${c + 18}" text-anchor="middle" class="fill-muted-foreground text-xs">${label}</text>` : '';
    return `<ui-gauge-chart class="block"><div class="block" data-slot="gauge-chart" role="img" aria-label="${aria}"><svg viewBox="0 0 ${size} ${h}" width="100%" height="${h}" class="block overflow-visible"><path data-slot="gauge-track" d="${track}" class="fill-muted"/>${val}${v}${l}</svg></div></ui-gauge-chart>`;
};
const el = ({ value, min = 0, max = 100, size = 220, thickness = 0.2, thresholds = [], label = '', unit = '', showValue = true } = {}) => {
    const attrs = [`value="${value}"`, min === 0 ? '' : `min="${min}"`, max === 100 ? '' : `max="${max}"`, size === 220 ? '' : `size="${size}"`, thickness === 0.2 ? '' : `thickness="${thickness}"`, label ? `label="${label}"` : '', unit ? `unit="${unit}"` : '', showValue ? '' : 'show-value="false"', thresholds.length ? `data-props='${JSON.stringify({ thresholds })}'` : ''].filter(Boolean).join(' ');
    return `<ge-gauge-chart ${attrs}></ge-gauge-chart>`;
};
const pair = (id, opts = {}) => ({ id, wrap: 'width:300px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'gauge-chart',
    items: [
        pair('default', { value: 65 }),
        pair('label-and-unit', { value: 72, label: 'CPU load', unit: '%' }),
        pair('thresholds-low', { value: 30, thresholds: ZONES, label: 'Healthy', unit: '%' }),
        pair('thresholds-mid', { value: 70, thresholds: ZONES, unit: '%' }),
        pair('thresholds-high', { value: 92, thresholds: ZONES, unit: '%' }),
        pair('zero', { value: 0, label: 'Idle' }),
        pair('full', { value: 100 }),
        pair('over-max-clamps', { value: 140, unit: '%' }),
        pair('below-min-clamps', { value: -20 }),
        pair('custom-range', { value: 500, min: 200, max: 1000, label: 'Speed', unit: ' rpm' }),
        pair('thin-band', { value: 40, thickness: 0.08 }),
        pair('thick-band', { value: 40, thickness: 0.5 }),
        pair('hidden-value', { value: 40, showValue: false, label: 'No readout' }),
        pair('small', { value: 55, size: 140 }),
        pair('degenerate-range', { value: 5, min: 10, max: 10 }),
    ],
};
