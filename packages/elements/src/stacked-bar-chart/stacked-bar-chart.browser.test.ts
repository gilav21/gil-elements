import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartSeries, GeStackedBarChart } from './index.js';

const CATS = ['Q1', 'Q2', 'Q3'];
const series = (name: string, values: number[]): ChartSeries => ({ name, data: values.map((value, i) => ({ name: CATS[i]!, value })) });
const SERIES = [series('Desktop', [100, 150, 90]), series('Mobile', [100, 50, 110])];
const chart = async (attrs = '', data = SERIES) => {
    const page = await mount(`<div style="width:500px"><ge-stacked-bar-chart ${attrs}></ge-stacked-bar-chart></div>`);
    const el = page.querySelector<GeStackedBarChart>('ge-stacked-bar-chart')!;
    el.series = data;
    el.categories = CATS;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const segments = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('.segment')];
const axis = (el: Element) => [...root(el).querySelectorAll('.axis')[0]!.querySelectorAll('text')].map((t) => t.textContent!.trim());

describe('ge-stacked-bar-chart', () => {
    it('stacks the series per category with the larger total reaching the top, labelled for assistive tech', async () => {
        const el = await chart();
        expect(segments(el)).toHaveLength(6);
        const [desktop, mobile] = [0, 1].map((i) => segments(el)[i]!.querySelector('rect')!.getBoundingClientRect());
        expect(mobile!.bottom).toBeCloseTo(desktop!.top, 0);
        expect(desktop!.height).toBeCloseTo(mobile!.height, 0);
        expect(segments(el)[0]!.getAttribute('aria-label')).toBe('Desktop in Q1: 100');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Stacked column chart with 3 data points.');
    });

    it('normalises every stack to the full height with a % axis in percent mode, and shows the share in the tooltip', async () => {
        const el = await chart('stacking="percent"');
        expect(axis(el)).toEqual(['0%', '25%', '50%', '75%', '100%']);
        const tops = [0, 2, 4].map((i) => segments(el)[i + 1]!.querySelector('rect')!.getBoundingClientRect().top);
        expect(tops[0]).toBeCloseTo(tops[1]!, 0);
        segments(el)[2]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const tip = root(el).querySelector('.tooltip')!;
        expect(tip.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('Desktop 150 (75.0%)');
    });

    it('grows negative segments below the zero line and extends the axis down', async () => {
        const el = await chart('', [series('Profit', [100, -50, 80]), series('Loss', [-40, -60, 20])]);
        const zero = root(el).querySelector('.grid .zero')!.getBoundingClientRect();
        const rect = (i: number) => segments(el)[i]!.querySelector('rect')!.getBoundingClientRect();
        expect(rect(0).bottom).toBeCloseTo(zero.top, 0);
        expect(rect(1).top).toBeCloseTo(zero.top, 0);
        expect(axis(el).some((t) => t.startsWith('-'))).toBe(true);
    });

    it('prints each stack total only when asked', async () => {
        expect(root(await chart()).querySelectorAll('.total')).toHaveLength(0);
        const el = await chart('show-total');
        expect([...root(el).querySelectorAll('.total')].map((t) => t.textContent)).toEqual(['200', '200', '200']);
    });

    it('anchors the tooltip to the segment and follows keyboard focus, then hides on blur', async () => {
        const el = await chart();
        const seg = segments(el)[3]!;
        seg.dispatchEvent(new FocusEvent('focus'));
        await el.updateComplete;
        const tip = root(el).querySelector<HTMLElement>('.tooltip')!;
        const box = seg.querySelector('rect')!.getBoundingClientRect();
        expect(tip.getBoundingClientRect().left).toBeGreaterThan(box.left + box.width / 2);
        expect(tip.getBoundingClientRect().top).toBeCloseTo(box.top - 8, 0);
        expect(segments(el).filter((s) => s.hasAttribute('data-dim'))).toHaveLength(5);
        seg.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')).toBeNull();
    });

    it('emits segment-click with the raw value on click and on Enter or Space', async () => {
        const el = await chart('stacking="percent"');
        const seen: unknown[] = [];
        el.addEventListener('segment-click', (e) => seen.push((e as CustomEvent).detail));
        segments(el)[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        segments(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        segments(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(seen).toEqual([
            { series: 'Mobile', category: 'Q2', value: 50 },
            { series: 'Mobile', category: 'Q1', value: 100 },
        ]);
    });

    it('draws a legend swatch per series and drops it with show-legend="false"', async () => {
        const el = await chart();
        expect([...root(el).querySelectorAll('.legend .label')].map((l) => l.textContent)).toEqual(['Desktop', 'Mobile']);
        expect(root(await chart('show-legend="false"')).querySelector('.legend')).toBeNull();
    });
});
