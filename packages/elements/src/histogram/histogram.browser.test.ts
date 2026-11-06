import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import { computeBins, type ChartClickEvent, type GeHistogram, type HistogramBin } from './index.js';

const SAMPLE = [12, 15, 17, 18, 21, 22, 22, 24, 25, 25, 26, 27, 29, 30, 31, 33, 35, 36, 38, 41, 44, 47, 52, 58, 63];
const chart = async (attrs = '', values: number[] = SAMPLE, extra: Partial<GeHistogram> = {}) => {
    const page = await mount(`<div style="width:500px"><ge-histogram ${attrs}></ge-histogram></div>`);
    const el = page.querySelector<GeHistogram>('ge-histogram')!;
    Object.assign(el, { values, ...extra });
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const groups = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('[data-slot="histogram-bar"]')];
const rect = (g: Element) => g.querySelector('rect')!;
const tip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
const hover = async (el: GeHistogram, i: number) => {
    groups(el)[i]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('computeBins', () => {
    it('spreads Sturges\' bins over a nice domain and counts every finite sample once, the maximum in the last bin', () => {
        const bins = computeBins(SAMPLE);
        expect(bins).toHaveLength(6);
        expect(bins[0]!.start).toBeLessThanOrEqual(12);
        expect(bins.at(-1)!.end).toBeGreaterThanOrEqual(63);
        expect(bins.reduce((n, b) => n + b.count, 0)).toBe(SAMPLE.length);
        for (let i = 1; i < bins.length; i++) expect(bins[i]!.start).toBe(bins[i - 1]!.end);
        const half = computeBins([0, 10, 20, 30], { binEdges: [0, 10, 20, 30] });
        expect(half.map((b) => b.count)).toEqual([1, 1, 2]);
    });

    it('drops non-finite samples and samples outside explicit edges, sorts the edges, and falls back from unusable ones', () => {
        expect(computeBins([...SAMPLE, Number.NaN, Number.POSITIVE_INFINITY]).reduce((n, b) => n + b.count, 0)).toBe(SAMPLE.length);
        const bins = computeBins(SAMPLE, { binEdges: [80, 0, 40, 20] });
        expect(bins.map((b) => [b.start, b.end])).toEqual([[0, 20], [20, 40], [40, 80]]);
        expect(bins.reduce((n, b) => n + b.count, 0)).toBe(SAMPLE.length);
        expect(computeBins(SAMPLE, { binEdges: [20, 40] }).map((b) => b.count)).toEqual([SAMPLE.filter((v) => v <= 40 && v >= 20).length]);
        expect(computeBins(SAMPLE, { binEdges: [5, 5] })).toEqual(computeBins(SAMPLE));
        expect(computeBins(SAMPLE, { binCount: 8.9 })).toHaveLength(8);
        expect(computeBins(SAMPLE, { binCount: 0 })).toEqual(computeBins(SAMPLE));
    });

    it('gives an empty sample no bins and a zero-variance sample one bin with a positive span', () => {
        expect(computeBins([])).toEqual([]);
        expect(computeBins([Number.NaN])).toEqual([]);
        const same = computeBins([7, 7, 7, 7]);
        expect(same.reduce((n, b) => n + b.count, 0)).toBe(4);
        expect(same.every((b) => b.end > b.start)).toBe(true);
    });
});

describe('ge-histogram', () => {
    it('draws a bar per bin whose height is proportional to its count, separated by the gap but never thinner than 1px', async () => {
        const el = await chart();
        const bins = el.bins;
        const bars = groups(el).map((g) => rect(g).getBoundingClientRect());
        expect(bars).toHaveLength(bins.length);
        const tallest = Math.max(...bins.map((b) => b.count));
        const unit = bars[bins.findIndex((b) => b.count === tallest)]!.height / tallest;
        bins.forEach((b, i) => expect(bars[i]!.height).toBeCloseTo(b.count * unit, 0));
        const gap = bars[1]!.left - bars[0]!.right;
        expect(gap).toBeCloseTo(2, 0);
        const fat = await chart('bar-gap="9999"');
        expect(Number(rect(groups(fat)[0]!).getAttribute('width'))).toBe(1);
    });

    it('labels the count axis with whole numbers, the value axis with every bin edge and the unit, and the counts above bars', async () => {
        const el = await chart('unit="ms"');
        const ticks = [...root(el).querySelectorAll('.tick')].map((t) => t.textContent!);
        const edges = ticks.filter((t) => t.endsWith('ms'));
        expect(edges).toHaveLength(el.bins.length + 1);
        expect(ticks.filter((t) => !t.endsWith('ms')).every((t) => Number.isInteger(Number(t)))).toBe(true);
        expect([...root(el).querySelectorAll('.value')].map((t) => Number(t.textContent))).toEqual(el.bins.map((b) => b.count).filter((c) => c > 0));
        const gappy = await chart('bin-count="4"', [1, 2, 3, 40, 41]);
        expect(gappy.bins.some((b) => b.count === 0)).toBe(true);
        expect(root(gappy).querySelectorAll('.value')).toHaveLength(gappy.bins.filter((b) => b.count > 0).length);
        const small = await chart('', [1, 2, 3]);
        const all = [...root(small).querySelectorAll('.tick')].map((tick) => Number(tick.textContent));
        const countTicks = all.slice(0, all.length - (small.bins.length + 1));
        expect(countTicks.length).toBeGreaterThan(1);
        expect(countTicks.every((n) => Number.isInteger(n))).toBe(true);
    });

    it('dims the other bars and shows the range and count of the hovered one, and reports it', async () => {
        const el = await chart('unit="ms"');
        const seen: (ChartClickEvent<HistogramBin> | null)[] = [];
        el.addEventListener('bin-hover', (e) => seen.push((e as CustomEvent).detail));
        await hover(el, 2);
        const bin = el.bins[2]!;
        const text = tip(el).textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain(`${bin.start}ms–${bin.end}ms`);
        expect(text).toContain(`Count${bin.count}`);
        expect(groups(el).map((g) => g.classList.contains('dim'))).toEqual(groups(el).map((...[, i]) => i !== 2));
        const bar = rect(groups(el)[2]!).getBoundingClientRect();
        const svgBox = root(el).querySelector('svg')!.getBoundingClientRect();
        expect(tip(el).getBoundingClientRect().left - svgBox.left).toBeCloseTo(bar.left - svgBox.left + bar.width / 2 + 8, 0);
        groups(el)[2]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(groups(el).some((g) => g.classList.contains('dim'))).toBe(false);
        expect(seen.map((s) => s && s.index)).toEqual([2, null]);
        expect(seen[0]!.point).toEqual(bin);
    });

    it('reports a click with its event, and Enter or Space without one; focus shows the bar as a pointer would', async () => {
        const el = await chart();
        const seen: ChartClickEvent<HistogramBin>[] = [];
        el.addEventListener('bin-click', (e) => seen.push((e as CustomEvent).detail));
        groups(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        groups(el)[3]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        groups(el)[4]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        groups(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(seen.map((s) => s.index)).toEqual([1, 3, 4]);
        expect(seen[0]!.event).toBeInstanceOf(MouseEvent);
        expect(seen[1]!.event).toBeUndefined();
        expect(seen[2]!.point).toEqual(el.bins[4]);
        groups(el)[1]!.dispatchEvent(new FocusEvent('focus'));
        await el.updateComplete;
        expect(groups(el)[0]!.classList.contains('dim')).toBe(true);
        groups(el)[1]!.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(groups(el)[0]!.classList.contains('dim')).toBe(false);
        expect(groups(el)[1]!.getAttribute('aria-label')).toBe(`${el.bins[1]!.start} – ${el.bins[1]!.end}: ${el.bins[1]!.count}`);
    });

    it('puts the lowest bin on the right in RTL while the count axis stays vertical, and shows an empty state without a sample', async () => {
        const ltr = await chart();
        const rtl = await chart('dir="rtl"');
        expect(rect(groups(rtl)[0]!).getBoundingClientRect().left).toBeGreaterThan(rect(groups(rtl).at(-1)!).getBoundingClientRect().left);
        expect(rect(groups(ltr)[0]!).getBoundingClientRect().left).toBeLessThan(rect(groups(ltr).at(-1)!).getBoundingClientRect().left);
        const empty = await chart('heading="Latency"', [Number.NaN]);
        expect(root(empty).querySelector('[data-slot="histogram-empty"]')!.textContent).toBe('No data to display');
        expect(root(empty).querySelector('svg')).toBeNull();
        expect(root(empty).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Latency. Histogram with 0 data points.');
    });
});
