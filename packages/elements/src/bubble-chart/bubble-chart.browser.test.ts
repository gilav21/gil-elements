import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, GeBubbleChart, XYZSeries } from './index.js';

const pts = (list: [number, number, number][]) => list.map(([x, y, z]) => ({ x, y, z }));
const SERIES: XYZSeries[] = [
    { name: 'Europe', points: pts([[20, 30, 10], [45, 60, 40], [70, 40, 90]]) },
    { name: 'Asia', points: pts([[15, 70, 100], [60, 85, 55]]) },
];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:540px"><ge-bubble-chart ${attrs}></ge-bubble-chart></div>`);
    const el = page.querySelector<GeBubbleChart>('ge-bubble-chart')!;
    el.series = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const bubbles = (el: Element) => [...root(el).querySelectorAll<SVGCircleElement>('[data-slot="bubble-point"]')];
const radius = (c: SVGCircleElement) => Number(c.getAttribute('r'));
const pointer = async (el: GeBubbleChart, target: Element) => {
    const box = target.getBoundingClientRect();
    root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};

describe('ge-bubble-chart', () => {
    it('sizes bubbles by area between min and max radius, with a button per bubble labelled with x, y and z', async () => {
        const el = await chart();
        const radii = bubbles(el).map(radius);
        expect(radii[3]).toBeCloseTo(28, 5);
        expect(radii[0]).toBeCloseTo(6, 5);
        const z = (i: number) => [10, 40, 90, 100, 55][i]!;
        const expected = (i: number) => 6 + Math.sqrt((z(i) - 10) / 90) * 22;
        radii.forEach((r, i) => expect(r).toBeCloseTo(expected(i), 5));
        expect(bubbles(el)[1]!.getAttribute('aria-label')).toBe('Europe: (45, 60, 40)');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Bubble chart with 2 data points.');
    });

    it('honours min-radius and max-radius, and gives every bubble the minimum when z never varies', async () => {
        const wide = await chart('min-radius="3" max-radius="40"');
        expect(Math.min(...bubbles(wide).map(radius))).toBeCloseTo(3, 5);
        expect(Math.max(...bubbles(wide).map(radius))).toBeCloseTo(40, 5);
        const flat = await chart('', [{ name: 'Flat', points: pts([[1, 2, 7], [2, 5, 7]]) }]);
        expect(bubbles(flat).map(radius)).toEqual([6, 6]);
    });

    it('resizes the remaining bubbles when a series is hidden, since z is scaled over the visible ones', async () => {
        const el = await chart();
        const before = radius(bubbles(el)[2]!);
        root(el).querySelector('ge-chart-legend')!.dispatchEvent(new CustomEvent('item-toggle', { detail: 'Asia' }));
        await el.updateComplete;
        expect(bubbles(el)).toHaveLength(3);
        expect(radius(bubbles(el)[2]!)).toBeCloseTo(28, 5);
        expect(before).toBeLessThan(28);
    });

    it('lifts the nearest bubble and shows its series as the heading with x, y and z rows beside its edge', async () => {
        const el = await chart();
        await pointer(el, bubbles(el)[1]!);
        expect(bubbles(el).map((b) => b.getAttribute('fill-opacity'))).toEqual(['0.55', '0.85', '0.55', '0.55', '0.55']);
        const tip = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
        expect(tip.textContent).toContain('Europe');
        for (const row of ['x45', 'y60', 'z40']) expect(tip.textContent!.replaceAll(/\s+/g, '')).toContain(row);
        const box = bubbles(el)[1]!.getBoundingClientRect();
        expect(tip.getBoundingClientRect().left).toBeCloseTo(box.left + box.width, -1);
        root(el).querySelector('svg')!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(bubbles(el).every((b) => b.getAttribute('fill-opacity') === '0.55')).toBe(true);
    });

    it('emits point-click on click and on Enter only', async () => {
        const el = await chart();
        const seen: ChartClickEvent<{ z: number }>[] = [];
        el.addEventListener('point-click', (e) => seen.push((e as CustomEvent).detail));
        bubbles(el)[4]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        bubbles(el)[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        bubbles(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(seen).toEqual([{ point: { x: 60, y: 85, z: 55 }, index: 1 }, { point: { x: 70, y: 40, z: 90 }, index: 2 }]);
    });
});
