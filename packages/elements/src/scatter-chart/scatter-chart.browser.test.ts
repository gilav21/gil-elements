import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, GeScatterChart, XYSeries } from './index.js';

const pts = (list: [number, number][]) => list.map(([x, y]) => ({ x, y }));
const SERIES: XYSeries[] = [
    { name: 'Group A', points: pts([[10, 20], [40, 38], [85, 90]]) },
    { name: 'Group B', points: pts([[15, 600], [60, 250], [40, 300]]) },
];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:500px"><ge-scatter-chart ${attrs}></ge-scatter-chart></div>`);
    const el = page.querySelector<GeScatterChart>('ge-scatter-chart')!;
    el.series = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const points = (el: Element) => [...root(el).querySelectorAll<SVGCircleElement>('[data-slot="scatter-point"]')];
const yTicks = (el: Element) => [...root(el).querySelectorAll('.tick')].map((t) => Number(t.textContent)).filter((n) => !Number.isNaN(n));
const pointer = async (el: GeScatterChart, target: Element) => {
    const box = target.getBoundingClientRect();
    root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: box.left + box.width / 2 + 3, clientY: box.top + box.height / 2 + 3 }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};

describe('ge-scatter-chart', () => {
    it('plots a button per point inside the plot area and labels each with its coordinates', async () => {
        const el = await chart();
        expect(points(el)).toHaveLength(6);
        expect(points(el)[1]!.getAttribute('aria-label')).toBe('Group A: (40, 38)');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Scatter chart with 2 data points.');
        const [low, high] = [points(el)[0]!, points(el)[2]!].map((p) => p.getBoundingClientRect());
        expect(high!.left).toBeGreaterThan(low!.right);
        expect(high!.top).toBeLessThan(low!.top);
    });

    it('rescales both axes when a series is hidden from the legend, and back when it returns', async () => {
        const el = await chart();
        const before = Math.max(...yTicks(el));
        expect(before).toBeGreaterThanOrEqual(600);
        const legend = root(el).querySelector('ge-chart-legend')!;
        legend.dispatchEvent(new CustomEvent('item-toggle', { detail: 'Group B' }));
        await el.updateComplete;
        expect(points(el)).toHaveLength(3);
        expect(Math.max(...yTicks(el))).toBeLessThan(before);
        legend.dispatchEvent(new CustomEvent('item-toggle', { detail: 'Group B' }));
        await el.updateComplete;
        expect(points(el)).toHaveLength(6);
    });

    it('highlights the point nearest the pointer, grows it, and shows its series and coordinates in the tooltip', async () => {
        const el = await chart();
        const target = points(el)[3]!;
        const r = Number(target.getAttribute('r'));
        await pointer(el, target);
        expect(Number(points(el)[3]!.getAttribute('r'))).toBe(r + 2);
        expect(points(el).filter((p) => Number(p.getAttribute('r')) === r + 2)).toHaveLength(1);
        const tip = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
        const dot = points(el)[3]!.getBoundingClientRect();
        expect(tip.getBoundingClientRect().left).toBeCloseTo(dot.left + dot.width / 2 + 10, -1);
        expect(tip.textContent).toContain('Group B');
        expect(tip.textContent).toContain('(15, 600)');
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(Number(points(el)[3]!.getAttribute('r'))).toBe(r);
    });

    it('picks the nearest point in both dimensions, and fits the axes to the data rather than to zero', async () => {
        const el = await chart('', [{ name: 'Late', points: pts([[1000, 50], [1040, 50], [1040, 90], [1100, 70]]) }]);
        const xs = [...root(el).querySelectorAll('.tick')].map((t) => Number(t.textContent)).filter((n) => n >= 100);
        expect(Math.min(...xs)).toBeGreaterThanOrEqual(1000);
        await pointer(el, points(el)[1]!);
        const sizes = points(el).map((p) => Number(p.getAttribute('r')));
        expect(sizes).toEqual([5, 7, 5, 5]);
    });

    it('emits point-click with the point and its index within the series on click and on Enter only', async () => {
        const el = await chart();
        const seen: ChartClickEvent<{ x: number; y: number }>[] = [];
        el.addEventListener('point-click', (e) => seen.push((e as CustomEvent).detail));
        points(el)[4]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        points(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        points(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(seen).toEqual([{ point: { x: 60, y: 250 }, index: 1 }, { point: { x: 40, y: 38 }, index: 1 }]);
    });

    it('honours point-radius and the legend and tooltip switches', async () => {
        const el = await chart('point-radius="8" show-legend="false" show-tooltip="false"');
        expect(points(el)[0]!.getAttribute('r')).toBe('8');
        expect(root(el).querySelector('ge-chart-legend')).toBeNull();
        expect(root(el).querySelector('ge-chart-tooltip')).toBeNull();
    });
});
