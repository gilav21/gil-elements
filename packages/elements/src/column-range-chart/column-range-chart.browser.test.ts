import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, GeColumnRangeChart, RangeDataPoint } from './index.js';

const DATA: RangeDataPoint[] = [
    { name: 'Jan', low: -3, high: 4 },
    { name: 'Feb', low: 12, high: 2 },
    { name: 'Mar', low: 10, high: 20 },
];
const chart = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:500px"><ge-column-range-chart ${attrs}></ge-column-range-chart></div>`);
    const el = page.querySelector<GeColumnRangeChart>('ge-column-range-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const groups = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('.bar')];
const rect = (el: Element, i: number) => groups(el)[i]!.querySelector('rect')!.getBoundingClientRect();
const labels = (el: Element, i: number) => [...groups(el)[i]!.querySelectorAll('.range')].map((t) => t.textContent);
const axis = (el: Element) => [...root(el).querySelectorAll('.axis')[0]!.querySelectorAll('text')].map((t) => t.textContent!.trim());
const tooltip = (el: Element) => root(el).querySelector<HTMLElement>('.tooltip');
const enter = async (el: GeColumnRangeChart, i: number) => {
    groups(el)[i]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
};

describe('ge-column-range-chart', () => {
    it('floats each column between its low and high on one axis, whichever end comes first, with its ends written on it', async () => {
        const el = await chart();
        const [jan, feb, mar] = [0, 1, 2].map((i) => rect(el, i));
        expect(jan!.height / mar!.height).toBeCloseTo(7 / 10, 1);
        expect(feb!.height / mar!.height).toBeCloseTo(1, 1);
        expect(feb!.bottom).toBeGreaterThan(mar!.bottom);
        expect(feb!.top).toBeGreaterThan(mar!.top);
        expect(labels(el, 1)).toEqual(['12', '2']);
        expect(labels(el, 0)).toEqual(['4', '-3']);
        expect(groups(el)[1]!.getAttribute('aria-label')).toBe('Feb: 2 to 12');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Column range chart with 3 data points.');
    });

    it('rounds the axis out to nice values, and puts the labels outside the column, the low one flipping above when it would leave the plot', async () => {
        const el = await chart('', [{ name: 'A', low: 3, high: 17 }, { name: 'B', low: 12, high: 20 }]);
        expect(axis(el)).toContain('0');
        expect(axis(el)).toContain('20');
        const label = (i: number, n: number) => groups(el)[i]!.querySelectorAll('.range')[n]!.getBoundingClientRect();
        expect(label(0, 0).bottom).toBeLessThanOrEqual(rect(el, 0).top);
        expect(label(0, 1).top).toBeGreaterThanOrEqual(rect(el, 0).bottom - 1);
        const edge = await chart('', [{ name: 'A', low: 0, high: 20 }]);
        const low = groups(edge)[0]!.querySelectorAll('.range')[1]!.getBoundingClientRect();
        expect(low.bottom).toBeLessThanOrEqual(rect(edge, 0).bottom);
    });

    it('writes the unit on labels and the axis, and drops the labels with show-range-labels="false"', async () => {
        const el = await chart('unit="°C"');
        expect(labels(el, 2)).toEqual(['20°C', '10°C']);
        expect(axis(el).every((t) => t.endsWith('°C'))).toBe(true);
        expect(groups(el)[2]!.getAttribute('aria-label')).toBe('Mar: 10°C to 20°C');
        expect(labels(await chart('show-range-labels="false"'), 2)).toEqual([]);
    });

    it('keeps a span under 1px as a 1px line centred on its value, and rounds fractions in the labels', async () => {
        const el = await chart('', [{ name: 'Same', low: 50, high: 50 }, { name: 'Wide', low: 20, high: 80 }]);
        expect(rect(el, 0).height).toBeCloseTo(1, 0);
        const lines = [...root(el).querySelectorAll('.grid line')].map((l) => l.getBoundingClientRect().top);
        const middle = rect(el, 0).top + rect(el, 0).height / 2;
        expect(Math.min(...lines.map((y) => Math.abs(y - middle)))).toBeLessThan(0.05);
        const fractions = await chart('', [{ name: 'A', low: 0.25, high: 0.75 }]);
        expect(labels(fractions, 0)).toEqual(['1', '0']);
    });

    it('lays the columns out right to left in RTL and dims the others on hover', async () => {
        const rtl = await chart('dir="rtl"');
        expect(rect(rtl, 0).left).toBeGreaterThan(rect(rtl, 2).left);
        const el = await chart();
        await enter(el, 1);
        expect(groups(el).map((g) => g.hasAttribute('data-dim'))).toEqual([true, false, true]);
        expect(groups(el)[1]!.querySelector('rect')!.hasAttribute('data-hover')).toBe(true);
        groups(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        groups(el)[2]!.dispatchEvent(new FocusEvent('focus'));
        await el.updateComplete;
        expect(groups(el)[0]!.hasAttribute('data-dim')).toBe(true);
        groups(el)[2]!.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(groups(el).some((g) => g.hasAttribute('data-dim'))).toBe(false);
    });

    it('shows the name and the range above the hovered column, and flips left of the columns at the right edge', async () => {
        const el = await chart();
        await enter(el, 1);
        const tip = tooltip(el)!;
        expect(tip.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('Feb Range: 2 – 12');
        const bar = rect(el, 1);
        expect(tip.getBoundingClientRect().left).toBeCloseTo(bar.left + bar.width / 2 + 12, -1);
        expect(tip.getBoundingClientRect().top).toBeCloseTo(bar.top - 8, -1);
        await enter(el, 2);
        const last = rect(el, 2);
        expect(tooltip(el)!.getBoundingClientRect().right).toBeCloseTo(last.left + last.width / 2 + 12, -1);
    });

    it('emits bar-click with the point on click, Enter and Space only', async () => {
        const el = await chart();
        const seen: ChartClickEvent<RangeDataPoint>[] = [];
        el.addEventListener('bar-click', (e) => seen.push((e as CustomEvent).detail));
        groups(el)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        groups(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        groups(el)[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        groups(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
        expect(seen.map((s) => [s.point.name, s.index])).toEqual([['Jan', 0], ['Feb', 1], ['Mar', 2]]);
        expect(seen[0]!.event).toBeInstanceOf(MouseEvent);
        expect(seen[1]!.event).toBeUndefined();
    });
});
