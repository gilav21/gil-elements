import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, GeWaterfallChart, WaterfallBar } from './index.js';

const DATA: WaterfallBar[] = [
    { name: 'Start', value: 1000, type: 'total' },
    { name: 'Sales', value: 400 },
    { name: 'Costs', value: -700 },
    { name: 'End', value: 700, type: 'total' },
];
const chart = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:520px"><ge-waterfall-chart ${attrs}></ge-waterfall-chart></div>`);
    const el = page.querySelector<GeWaterfallChart>('ge-waterfall-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const bars = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="waterfall-bar"]')];
const box = (e: Element) => e.getBoundingClientRect();
const hoverAt = async (el: GeWaterfallChart, target: Element) => {
    const b = box(target);
    root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + 20 }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('ge-waterfall-chart', () => {
    it('floats each change from the running level, a total standing on zero and resetting it', async () => {
        const el = await chart();
        const [start, sales, costs, end] = bars(el).map(box);
        expect(sales!.bottom).toBeCloseTo(start!.top, 0);
        expect(costs!.top).toBeCloseTo(sales!.top, 0);
        expect(costs!.height).toBeCloseTo(start!.height * 0.7, 0);
        expect(end!.bottom).toBeCloseTo(start!.bottom, 0);
        expect(end!.height).toBeCloseTo(start!.height * 0.7, 0);
        expect(bars(el)[2]!.getAttribute('aria-label')).toBe('Costs: -700 (total 700)');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Waterfall chart with 4 data points.');
    });

    it('colours gains, losses and totals, with a bar colour winning, and lets the palette be set', async () => {
        const el = await chart('positive-color="rgb(1, 2, 3)" negative-color="rgb(4, 5, 6)" total-color="rgb(7, 8, 9)"', [...DATA.slice(0, 3), { name: 'End', value: 700, type: 'total', color: 'rgb(9, 9, 9)' }]);
        expect(bars(el).map((b) => getComputedStyle(b).fill)).toEqual(['rgb(7, 8, 9)', 'rgb(1, 2, 3)', 'rgb(4, 5, 6)', 'rgb(9, 9, 9)']);
        const fallback = await chart();
        expect(getComputedStyle(bars(fallback)[1]!).fill).toBe('rgb(33, 196, 93)');
    });

    it('draws a connector at each running level, and only with show-connectors on', async () => {
        const el = await chart();
        const lines = [...root(el).querySelectorAll('[data-slot="waterfall-connector"]')];
        expect(lines).toHaveLength(3);
        expect(box(lines[0]!).top).toBeCloseTo(box(bars(el)[0]!).top, 0);
        expect(box(lines[1]!).top).toBeCloseTo(box(bars(el)[1]!).top, 0);
        expect(root(await chart('show-connectors="false"')).querySelectorAll('[data-slot="waterfall-connector"]')).toHaveLength(0);
    });

    it('keeps a zero change visible as a hairline, and lets two bars share a name', async () => {
        const el = await chart('', [{ name: 'Item', value: 0 }, { name: 'Item', value: 40 }]);
        expect(box(bars(el)[0]!).height).toBeCloseTo(1, 0);
        expect(bars(el)).toHaveLength(2);
        expect(box(bars(el)[1]!).left).toBeGreaterThan(box(bars(el)[0]!).right);
    });

    it('snaps a hover to the nearest bar by x: the others dim and the tooltip lists its change and the level reached', async () => {
        const el = await chart();
        await hoverAt(el, bars(el)[2]!);
        expect(bars(el).map((b) => b.getAttribute('fill-opacity'))).toEqual(['0.6', '0.6', '1', '0.6']);
        const tip = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
        const text = tip.textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain('Costs');
        expect(text).toContain('Change-700');
        expect(text).toContain('Total700');
        expect(box(tip).left).toBeCloseTo(box(bars(el)[2]!).left + box(bars(el)[2]!).width / 2 + 12, -1);
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(bars(el).every((b) => b.getAttribute('fill-opacity') === '1')).toBe(true);
    });

    it('flips the tooltip to the left of the last bar and keeps it inside the top edge', async () => {
        const el = await chart();
        const last = bars(el)[3]!;
        const b = box(last);
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.left + b.width / 2, clientY: box(root(el).querySelector('svg')!).top + 1 }));
        await el.updateComplete;
        await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
        const tip = box(root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!);
        expect(tip.right).toBeCloseTo(b.left + b.width / 2 + 12, -1);
        expect(tip.top).toBeCloseTo(box(root(el).querySelector('svg')!).top + 8, 0);
    });

    it('colours a zero change as a gain', async () => {
        const el = await chart('', [{ name: 'Flat', value: 0 }]);
        expect(getComputedStyle(bars(el)[0]!).fill).toBe('rgb(33, 196, 93)');
    });

    it('writes the values above the bars only with show-values, and emits bar-click on click and Enter only', async () => {
        const el = await chart('show-values');
        expect([...root(el).querySelectorAll('.value')].map((t) => t.textContent)).toEqual(['1000', '400', '-700', '700']);
        expect(root(await chart()).querySelectorAll('.value')).toHaveLength(0);
        const seen: ChartClickEvent[] = [];
        el.addEventListener('bar-click', (e) => seen.push((e as CustomEvent).detail));
        bars(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        bars(el)[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        bars(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(seen).toEqual([{ point: { name: 'Sales', value: 400 }, index: 1 }, { point: { name: 'Costs', value: -700 }, index: 2 }]);
    });

    it('lays the bars out right to left in RTL', async () => {
        const el = await chart('dir="rtl"');
        expect(box(bars(el)[0]!).left).toBeGreaterThan(box(bars(el)[3]!).left);
    });
});
