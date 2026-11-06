import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartSeries, GeLineChart } from './index.js';

const CATS = ['Jan', 'Feb', 'Mar', 'Apr'];
const series = (name: string, values: (number | null)[], id?: string): ChartSeries => ({
    name,
    ...(id ? { id } : {}),
    data: CATS.map((c, i) => ({ name: c, value: values[i] as number })),
});
const SERIES = [series('Revenue', [120, 200, 150, 280]), series('Costs', [90, 110, 130, 150])];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:500px"><ge-line-chart ${attrs}></ge-line-chart></div>`);
    const el = page.querySelector<GeLineChart>('ge-line-chart')!;
    el.series = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const markers = (el: Element) => [...root(el).querySelectorAll<SVGCircleElement>('circle')];
const hover = async (el: GeLineChart, userX: number, userY = 60) => {
    const svg = root(el).querySelector('svg')!;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / svg.viewBox.baseVal.width;
    svg.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + userX * scale, clientY: rect.top + userY * scale }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};
const tooltip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]');

describe('ge-line-chart', () => {
    it('draws one path and one marker per point and series, with the categories on the axis and a summary label', async () => {
        const el = await chart();
        expect(root(el).querySelectorAll('[data-slot="line-series"]')).toHaveLength(2);
        expect(markers(el).map((m) => m.getAttribute('aria-label'))).toEqual([
            'Revenue, Jan: 120', 'Revenue, Feb: 200', 'Revenue, Mar: 150', 'Revenue, Apr: 280',
            'Costs, Jan: 90', 'Costs, Feb: 110', 'Costs, Mar: 130', 'Costs, Apr: 150',
        ]);
        expect([...root(el).querySelectorAll('.tick')].map((t) => t.textContent)).toEqual(expect.arrayContaining(CATS));
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Line chart with 4 data points.');
    });

    it('follows the measured width, so the viewBox is the box and nothing stretches', async () => {
        const el = await chart();
        const svg = root(el).querySelector('svg')!;
        expect(svg.viewBox.baseVal.width).toBe(500);
        el.parentElement!.style.width = '320px';
        await expect.poll(() => root(el).querySelector('svg')!.viewBox.baseVal.width).toBe(320);
    });

    it('breaks the line at a missing value and draws no marker for it', async () => {
        const el = await chart('', [series('Revenue', [120, null, 150, 280])]);
        expect(markers(el)).toHaveLength(3);
        expect(root(el).querySelector('[data-slot="line-series"]')!.getAttribute('d')!.match(/M/g)).toHaveLength(2);
    });

    it('hides a series from the legend: its path goes, the axis rescales, and it can come back', async () => {
        const el = await chart();
        const top = () => Number([...root(el).querySelectorAll('.tick')].find((t) => t.textContent === '350' || t.textContent === '300')?.textContent);
        const before = top();
        root(el).querySelector('ge-chart-legend')!.shadowRoot!.querySelector<HTMLElement>('[data-slot="chart-legend-item"]')!.click();
        await el.updateComplete;
        expect(root(el).querySelectorAll('[data-slot="line-series"]')).toHaveLength(1);
        expect(top()).not.toBe(before);
        root(el).querySelector('ge-chart-legend')!.shadowRoot!.querySelector<HTMLElement>('[data-slot="chart-legend-item"]')!.click();
        await el.updateComplete;
        expect(root(el).querySelectorAll('[data-slot="line-series"]')).toHaveLength(2);
    });

    it('snaps a hover to the nearest category: crosshair, enlarged markers, a tooltip row per visible series, and point-hover', async () => {
        const el = await chart();
        const seen: (ChartClickEvent | null)[] = [];
        el.addEventListener('point-hover', (event) => seen.push((event as CustomEvent<ChartClickEvent | null>).detail));
        await hover(el, 200);
        expect(root(el).querySelector('[data-slot="crosshair"]')).not.toBeNull();
        expect(tooltip(el)!.textContent).toContain('Revenue');
        expect(tooltip(el)!.textContent).toContain('Costs');
        expect(seen[0]).toMatchObject({ index: 1, point: { name: 'Feb', value: 200 } });
        expect(markers(el).filter((m) => m.getAttribute('r') === '4').map((m) => m.getAttribute('aria-label'))).toEqual(['Revenue, Feb: 200', 'Costs, Feb: 110']);
        const tip = tooltip(el)!.getBoundingClientRect();
        const feb = markers(el)[1]!.getBoundingClientRect();
        expect(tip.left - (feb.left + feb.width / 2)).toBeCloseTo(12, 0);
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(root(el).querySelector('[data-slot="crosshair"]')).toBeNull();
    });

    it('reports a marker click and Enter, and takes the markers away with show-points="false"', async () => {
        const el = await chart();
        const clicks: ChartClickEvent[] = [];
        el.addEventListener('point-click', (event) => clicks.push((event as CustomEvent<ChartClickEvent>).detail));
        markers(el)[2]!.dispatchEvent(new MouseEvent('click'));
        markers(el)[5]!.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard('a');
        expect(clicks.map((c) => [c.point.name, c.index])).toEqual([['Mar', 2], ['Feb', 1]]);
        el.showPoints = false;
        await el.updateComplete;
        expect(markers(el)).toHaveLength(0);
    });

    it('always includes zero on the value axis, even when every value is large', async () => {
        const el = await chart('', [series('Revenue', [500, 520, 540, 560])]);
        expect([...root(el).querySelectorAll('.tick')].map((t) => t.textContent)).toContain('0');
    });

    it('mirrors for a right-to-left direction: first category on the right, ticks on the far side', async () => {
        const el = await chart('dir="rtl"');
        const xs = [...root(el).querySelectorAll('.tick')].filter((t) => CATS.includes(t.textContent ?? '')).map((t) => Number(t.getAttribute('x')));
        expect(xs[0]).toBeGreaterThan(xs.at(-1)!);
    });
});
