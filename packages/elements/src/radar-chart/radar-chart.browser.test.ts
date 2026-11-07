import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartSeries, GeRadarChart } from './index.js';

const AXES = ['Speed', 'Power', 'Range', 'Armor'];
const series = (name: string, values: number[]): ChartSeries => ({ name, data: AXES.map((a, i) => ({ name: a, value: values[i]! })) });
const SERIES = [series('Alpha', [80, 60, 100, 40]), series('Beta', [50, 20, 40, 75])];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:420px"><ge-radar-chart ${attrs}></ge-radar-chart></div>`);
    const el = page.querySelector<GeRadarChart>('ge-radar-chart')!;
    el.series = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const polygons = (el: Element) => [...root(el).querySelectorAll<SVGPathElement>('[data-slot="radar-series"]')];
const vertices = (el: Element) => [...root(el).querySelectorAll<SVGCircleElement>('circle')];
const centre = (el: Element) => {
    const svg = root(el).querySelector('svg')!.getBoundingClientRect();
    return { x: svg.left + svg.width / 2, y: svg.top + svg.height / 2 };
};
const distance = (el: Element, circle: Element) => {
    const c = centre(el);
    const b = circle.getBoundingClientRect();
    return Math.hypot(b.left + b.width / 2 - c.x, b.top + b.height / 2 - c.y);
};

describe('ge-radar-chart', () => {
    it('draws the rings and one spoke and label per axis, a polygon per series and a button per vertex', async () => {
        const el = await chart('levels="3"');
        expect(root(el).querySelectorAll('[data-slot="radar-ring"]')).toHaveLength(3);
        expect([...root(el).querySelectorAll('.axis')].map((t) => t.textContent)).toEqual(AXES);
        expect(polygons(el)).toHaveLength(2);
        expect(vertices(el)).toHaveLength(8);
        expect(vertices(el)[2]!.getAttribute('aria-label')).toBe('Alpha, Range: 100');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Radar chart with 4 data points.');
    });

    it('puts the largest value on the outer ring, along its own axis, and a smaller one proportionally inside', async () => {
        const el = await chart();
        const outer = root(el).querySelectorAll('[data-slot="radar-ring"]')[3]!.getBoundingClientRect();
        const ring = outer.width / 2;
        expect(distance(el, vertices(el)[2]!)).toBeCloseTo(ring, 0);
        expect(distance(el, vertices(el)[3]!)).toBeCloseTo(ring * 0.4, 0);
        const label = root(el).querySelector('.axis')!.getBoundingClientRect();
        expect(label.top + label.height / 2).toBeCloseTo(centre(el).y - ring - 18, -1);
        const first = vertices(el)[0]!.getBoundingClientRect();
        const c = centre(el);
        expect(first.left + first.width / 2).toBeCloseTo(c.x, 0);
        expect(first.top + first.height / 2).toBeLessThan(c.y);
    });

    it('scales to max-value, clamping what exceeds it onto the outer ring', async () => {
        const el = await chart('max-value="200"');
        const ring = root(el).querySelectorAll('[data-slot="radar-ring"]')[3]!.getBoundingClientRect().width / 2;
        expect(distance(el, vertices(el)[2]!)).toBeCloseTo(ring / 2, 0);
        const clamped = await chart('max-value="50"');
        const ring2 = root(clamped).querySelectorAll('[data-slot="radar-ring"]')[3]!.getBoundingClientRect().width / 2;
        expect(distance(clamped, vertices(clamped)[2]!)).toBeCloseTo(ring2, 0);
    });

    it('moves the centre down to the lowest value when one is negative', async () => {
        const el = await chart('', [series('Delta', [-20, 40, 10, 20])]);
        expect(distance(el, vertices(el)[0]!)).toBeLessThan(1);
        const ring = root(el).querySelectorAll('[data-slot="radar-ring"]')[3]!.getBoundingClientRect().width / 2;
        expect(distance(el, vertices(el)[3]!)).toBeCloseTo((ring * 40) / 60, 0);
    });

    it('hides a series from the legend without rescaling the rings, and brings it back', async () => {
        const el = await chart();
        const legend = root(el).querySelector('ge-chart-legend')!;
        const before = distance(el, vertices(el)[7]!);
        legend.dispatchEvent(new CustomEvent('item-toggle', { detail: 'Alpha' }));
        await el.updateComplete;
        expect(polygons(el)).toHaveLength(1);
        expect(distance(el, vertices(el)[3]!)).toBeCloseTo(before, 3);
        legend.dispatchEvent(new CustomEvent('item-toggle', { detail: 'Alpha' }));
        await el.updateComplete;
        expect(polygons(el)).toHaveLength(2);
    });

    it('applies fill-opacity and size, and drops the legend with show-legend="false"', async () => {
        const el = await chart('fill-opacity="0.5" size="260" show-legend="false"');
        expect(polygons(el)[0]!.getAttribute('fill-opacity')).toBe('0.5');
        expect(root(el).querySelector('svg')!.getBoundingClientRect().width).toBe(260);
        expect(root(el).querySelector('ge-chart-legend')).toBeNull();
    });
});
