import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartSeries, GeComboChart } from './index.js';

const CATS = ['Mon', 'Tue', 'Wed', 'Thu'];
const series = (name: string, values: number[]): ChartSeries => ({ name, data: CATS.map((c, i) => ({ name: c, value: values[i]! })) });
const BARS = [series('Defects', [40, 30, 20, 10])];
const TWO = [series('Defects', [40, 30, 20, 10]), series('Fixed', [35, 25, 15, 5])];
const LINES = [series('Rate', [10, 20, 30, 40])];
const chart = async (attrs = '', bars = BARS, lines: ChartSeries[] = []) => {
    const page = await mount(`<div style="width:540px"><ge-combo-chart ${attrs}></ge-combo-chart></div>`);
    const el = page.querySelector<GeComboChart>('ge-combo-chart')!;
    el.barSeries = bars;
    el.lineSeries = lines;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const bars = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="combo-bar"]')];
const lines = (el: Element) => [...root(el).querySelectorAll<SVGPathElement>('[data-slot="combo-line"]')];
const box = (e: Element) => e.getBoundingClientRect();
const tip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
const hoverCategory = async (el: GeComboChart, bar: Element) => {
    const b = box(bar);
    root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + 10 }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('ge-combo-chart', () => {
    it('groups one bar per series side by side inside each category, from the zero line, with category labels from the first series', async () => {
        const el = await chart('', TWO);
        expect(bars(el)).toHaveLength(8);
        const [a, b] = [box(bars(el)[0]!), box(bars(el)[1]!)];
        expect(b.left).toBeCloseTo(a.right, 0);
        expect(a.height).toBeGreaterThan(b.height);
        expect(a.bottom).toBeCloseTo(b.bottom, 0);
        expect([...root(el).querySelectorAll('.tick')].map((t) => t.textContent).slice(-4)).toEqual(CATS);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Combo chart with 4 data points.');
    });

    it('draws each line on its own hidden axis, in colours that continue after the bars, through the category centres', async () => {
        const el = await chart('', TWO, LINES);
        expect(lines(el)).toHaveLength(1);
        const stroke = (e: Element) => getComputedStyle(e).stroke;
        expect(stroke(lines(el)[0]!)).not.toBe(getComputedStyle(bars(el)[0]!).fill);
        expect(stroke(lines(el)[0]!)).not.toBe(getComputedStyle(bars(el)[1]!).fill);
        const lineBox = box(lines(el)[0]!);
        const first = box(bars(el)[0]!);
        const last = box(bars(el)[6]!);
        expect(lineBox.left).toBeCloseTo(first.left + first.width, 0);
        expect(lineBox.right).toBeCloseTo(last.left + last.width, 0);
        expect(lineBox.top).toBeLessThan(box(root(el).querySelector('svg')!).bottom);
    });

    it('adds a running-share line from the first bar series with show-cumulative, ahead of the others, labelled as set', async () => {
        const el = await chart('show-cumulative cumulative-label="Running share"', BARS, LINES);
        expect(lines(el)).toHaveLength(2);
        const legend = (root(el).querySelector('ge-chart-legend') as unknown as { items: { label: string }[] }).items.map((i) => i.label);
        expect(legend).toEqual(['Defects', 'Running share', 'Rate']);
        await hoverCategory(el, bars(el)[1]!);
        const text = tip(el).textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain('Runningshare70%');
        expect(text).toContain('Rate20');
    });

    it('snaps a hover to the nearest category: all its bars stay, the rest dim, a crosshair and a row per series show', async () => {
        const el = await chart('', TWO, LINES);
        await hoverCategory(el, bars(el)[2]!);
        const opacity = bars(el).map((b) => b.getAttribute('opacity'));
        expect(opacity).toEqual(['0.55', '0.55', '1', '1', '0.55', '0.55', '0.55', '0.55']);
        expect(root(el).querySelector('[data-slot="crosshair"]')).not.toBeNull();
        const text = tip(el).textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain('Tue');
        for (const row of ['Defects30', 'Fixed25', 'Rate20']) expect(text).toContain(row);
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(root(el).querySelector('[data-slot="crosshair"]')).toBeNull();
        expect(bars(el).every((b) => b.getAttribute('opacity') === '1')).toBe(true);
    });

    it('treats an out-of-range hover index as no hover, and a missing bar value as no bar height', async () => {
        const el = await chart('', [{ name: 'D', data: [{ name: 'Mon', value: 10 }, { name: 'Tue', value: Number.NaN }] }]);
        el.setHover(7);
        await el.updateComplete;
        expect(root(el).querySelector('[data-slot="crosshair"]')).toBeNull();
        expect(bars(el).every((b) => b.getAttribute('opacity') === '1')).toBe(true);
        expect(box(bars(el)[1]!).height).toBe(0);
        el.setHover(1);
        await el.updateComplete;
        expect(root(el).querySelector('[data-slot="crosshair"]')).not.toBeNull();
    });

    it('reports the clicked bar\'s own series point and its category on bar-click', async () => {
        const el = await chart('', TWO);
        const seen: ChartClickEvent[] = [];
        el.addEventListener('bar-click', (e) => seen.push((e as CustomEvent).detail));
        bars(el)[5]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        bars(el)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(seen).toEqual([{ point: { name: 'Wed', value: 15 }, index: 2 }, { point: { name: 'Tue', value: 30 }, index: 1 }]);
    });

    it('shows a key without toggling, and honours show-legend, show-grid and show-tooltip', async () => {
        const el = await chart('', BARS, LINES);
        const legend = root(el).querySelector('ge-chart-legend') as unknown as { interactive: boolean };
        expect(legend.interactive).toBe(false);
        const off = await chart('show-legend="false" show-grid="false" show-tooltip="false"');
        expect(root(off).querySelector('ge-chart-legend')).toBeNull();
        expect(root(off).querySelector('ge-chart-tooltip')).toBeNull();
        expect(root(off).querySelectorAll('[data-slot="grid-line"]')).toHaveLength(0);
    });
});
