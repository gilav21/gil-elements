import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartSeries, GeAreaChart } from './index.js';

const CATS = ['Q1', 'Q2', 'Q3', 'Q4'];
const series = (name: string, values: (number | null)[]): ChartSeries => ({ name, data: CATS.map((c, i) => ({ name: c, value: values[i] as number })) });
const SERIES = [series('Desktop', [50, 55, 60, 65]), series('Mobile', [40, 50, 55, 68])];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:500px"><ge-area-chart ${attrs}></ge-area-chart></div>`);
    const el = page.querySelector<GeAreaChart>('ge-area-chart')!;
    el.series = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const areas = (el: Element) => [...root(el).querySelectorAll<SVGPathElement>('[data-slot="area-series"]')];
const ticks = (el: Element) => [...root(el).querySelectorAll('.tick')].map((t) => t.textContent);
const hover = async (el: GeAreaChart, userX: number) => {
    const svg = root(el).querySelector('svg')!;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / svg.viewBox.baseVal.width;
    svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + userX * scale, clientY: rect.top + 60 * scale }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};

describe('ge-area-chart', () => {
    it('fills each series down to the zero baseline at the fill opacity, outlined by its line, with a summary label', async () => {
        const el = await chart('fill-opacity="0.4"');
        expect(areas(el)).toHaveLength(2);
        expect(areas(el)[0]!.getAttribute('fill-opacity')).toBe('0.4');
        const box = areas(el)[0]!.getBoundingClientRect();
        const zero = [...root(el).querySelectorAll<SVGTextElement>('.tick')].find((t) => t.textContent === '0')!.getBoundingClientRect();
        expect(box.bottom).toBeCloseTo(zero.top + zero.height / 2, -1);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Area chart with 4 data points.');
    });

    it('stacks the series so the axis covers their sum, and as shares up to 100 in percent mode', async () => {
        const overlap = await chart();
        const stacked = await chart('stacked');
        const percent = await chart('stacked stacking-mode="percent"');
        const top = (el: Element) => Math.max(...ticks(el).map(Number).filter((n) => !Number.isNaN(n)));
        expect(top(stacked)).toBeGreaterThan(top(overlap));
        expect(top(stacked)).toBeGreaterThanOrEqual(130);
        expect(top(percent)).toBe(100);
        const [first, second] = areas(stacked).map((a) => a.getBoundingClientRect());
        expect(second!.bottom).toBeLessThan(first!.bottom - 20);
        expect(second!.top).toBeLessThan(first!.top);
    });

    it('breaks the area at a missing value in an overlapping chart', async () => {
        const el = await chart('', [series('Desktop', [50, null, 60, 65])]);
        expect(areas(el)[0]!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
    });

    it('hides a series from the legend: its area goes, a stacked axis rescales, and it can come back', async () => {
        const el = await chart('stacked');
        const before = ticks(el).join();
        root(el).querySelector('ge-chart-legend')!.shadowRoot!.querySelector<HTMLElement>('[data-slot="chart-legend-item"]')!.click();
        await el.updateComplete;
        expect(areas(el)).toHaveLength(1);
        expect(ticks(el).join()).not.toBe(before);
        root(el).querySelector('ge-chart-legend')!.shadowRoot!.querySelector<HTMLElement>('[data-slot="chart-legend-item"]')!.click();
        await el.updateComplete;
        expect(areas(el)).toHaveLength(2);
    });

    it('snaps a hover to the nearest category: crosshair on top, a tooltip row per visible series, and point-hover', async () => {
        const el = await chart();
        const seen: (ChartClickEvent | null)[] = [];
        el.addEventListener('point-hover', (event) => seen.push((event as CustomEvent<ChartClickEvent | null>).detail));
        await hover(el, 200);
        expect(root(el).querySelector('[data-slot="crosshair"]')).not.toBeNull();
        const text = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!.textContent!;
        expect(text).toContain('Desktop');
        expect(text).toContain('Mobile');
        expect(seen[0]).toMatchObject({ index: 1, point: { name: 'Q2', value: 55 } });
        const tip = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!.getBoundingClientRect();
        const line = root(el).querySelector('[data-slot="crosshair"]')!.getBoundingClientRect();
        expect(tip.left - line.left).toBeCloseTo(12, 0);
        el.showCrosshair = false;
        await el.updateComplete;
        expect(root(el).querySelector('[data-slot="crosshair"]')).toBeNull();
        el.showCrosshair = true;
        await el.updateComplete;
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(root(el).querySelector('[data-slot="crosshair"]')).toBeNull();
    });

    it('mirrors for a right-to-left direction: first category on the right', async () => {
        const el = await chart('dir="rtl"');
        const xs = [...root(el).querySelectorAll('.tick')].filter((t) => CATS.includes(t.textContent ?? '')).map((t) => Number(t.getAttribute('x')));
        expect(xs[0]).toBeGreaterThan(xs.at(-1)!);
    });
});
