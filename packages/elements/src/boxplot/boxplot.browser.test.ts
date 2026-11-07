import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import { computeStats, quantile, resolveGroupStats, type BoxplotGroup, type GeBoxplot } from './index.js';

const API = [12, 14, 15, 15, 16, 17, 18, 19, 21, 22, 24, 95];
const WEB = [30, 32, 35, 36, 38, 40, 41, 44, 47, 52];
const DB = [5, 6, 6, 7, 7, 8, 9, 9, 10, 12, 30];
const GROUPS: BoxplotGroup[] = [{ label: 'API', values: API }, { label: 'Web', values: WEB }, { label: 'DB', values: DB }];

const chart = async (attrs = '', groups: BoxplotGroup[] = GROUPS, width = 500) => {
    const page = await mount(`<div style="width:${width}px"><ge-boxplot ${attrs}></ge-boxplot></div>`);
    const el = page.querySelector<GeBoxplot>('ge-boxplot')!;
    el.groups = groups;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const boxes = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('[data-slot="boxplot-box"]')];
const rect = (g: Element) => g.querySelector('rect')!.getBoundingClientRect();
const outliers = (el: Element) => [...root(el).querySelectorAll<SVGCircleElement>('[data-slot="boxplot-outlier"]')];
const tipText = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!.textContent!;
const hover = async (el: GeBoxplot, i: number) => {
    boxes(el)[i]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('boxplot statistics', () => {
    it('interpolates quantiles linearly, clamps p, and gives NaN for nothing and the value for one sample', () => {
        expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
        expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
        expect(quantile([10, 20, 30, 40, 50], 0.9)).toBeCloseTo(46, 9);
        expect(quantile([1, 2, 3], -1)).toBe(1);
        expect(quantile([1, 2, 3], 7)).toBe(3);
        expect(quantile([], 0.5)).toBeNaN();
        expect(quantile([9], 0.3)).toBe(9);
    });

    it('puts whiskers on the furthest samples inside 1.5 x IQR and every sample beyond them in outliers, ascending', () => {
        const api = computeStats(API)!;
        expect(api.q1).toBe(15);
        expect(api.median).toBe(17.5);
        expect(api.q3).toBe(21.25);
        expect(api.min).toBe(12);
        expect(api.max).toBe(24);
        expect(api.outliers).toEqual([95]);
        const db = computeStats(DB)!;
        expect(db.outliers).toEqual([30]);
        expect(db.min).toBe(5);
        const both = computeStats([-50, 10, 11, 12, 13, 14, 80])!;
        expect(both.outliers).toEqual([-50, 80]);
        expect(both.min).toBe(10);
        expect(both.max).toBe(14);
    });

    it('keeps a sample exactly on a fence inside the whisker and calls the first one beyond it an outlier, the fence being 1.5 IQR', () => {
        const base = [10, 10, 10, 10, 20, 20, 20, 20];
        expect(computeStats([...base, 35])).toMatchObject({ q3: 20, max: 35, outliers: [] });
        expect(computeStats([-5, ...base])).toMatchObject({ q1: 10, min: -5, outliers: [] });
        expect(computeStats([...base, 36])).toMatchObject({ max: 20, outliers: [36] });
        expect(computeStats([-6, ...base])).toMatchObject({ min: 10, outliers: [-6] });
    });

    it('drops non-finite samples, skips a group with none, and keeps a flat sample whole with no outliers', () => {
        expect(computeStats([1, Number.NaN, Number.POSITIVE_INFINITY, 3])!.median).toBe(2);
        expect(computeStats([])).toBeNull();
        expect(computeStats([Number.NaN])).toBeNull();
        expect(computeStats([4, 4, 4, 4])).toEqual({ min: 4, q1: 4, median: 4, q3: 4, max: 4, outliers: [] });
    });

    it('prefers pre-computed stats over values, and gives a group with neither no summary', () => {
        const stats = { min: 1, q1: 2, median: 3, q3: 4, max: 5, outliers: [] };
        expect(resolveGroupStats({ label: 'a', stats, values: [100, 200] })).toBe(stats);
        expect(resolveGroupStats({ label: 'b', values: [1, 2, 3] })!.median).toBe(2);
        expect(resolveGroupStats({ label: 'c' })).toBeNull();
        expect(resolveGroupStats({ label: 'd', values: [] })).toBeNull();
    });
});

describe('ge-boxplot', () => {
    it('draws a box per group, quartile height proportional on the value axis, in order across the width', async () => {
        const el = await chart();
        const r = boxes(el).map(rect);
        expect(r).toHaveLength(3);
        expect(r[0]!.left).toBeLessThan(r[1]!.left);
        expect(r[1]!.left).toBeLessThan(r[2]!.left);
        expect(r[0]!.width).toBeCloseTo(r[1]!.width, 3);
        const pxPerUnit = r[0]!.height / (21.25 - 15);
        expect(r[1]!.height).toBeCloseTo((computeStats(WEB)!.q3 - computeStats(WEB)!.q1) * pxPerUnit, 0);
        const median = boxes(el)[0]!.querySelector('[data-slot="boxplot-median"]')!.getBoundingClientRect();
        expect(median.top - r[0]!.top).toBeCloseTo((21.25 - 17.5) * pxPerUnit, 0);
        expect(root(el).querySelector('svg')!.getBoundingClientRect().height).toBe(300);
        const caps = [...boxes(el)[0]!.querySelectorAll('[data-slot="boxplot-whisker-cap"]')].map((c) => c.getBoundingClientRect());
        expect(caps[0]!.width).toBeCloseTo(r[0]!.width / 2, 0);
        const whisker = boxes(el)[0]!.querySelector('[data-slot="boxplot-whisker"]')!.getBoundingClientRect();
        expect(whisker.left + whisker.width / 2).toBeCloseTo(r[0]!.left + r[0]!.width / 2, 0);
    });

    it('draws outliers as rings beyond the whisker caps, hidden with show-outliers="false" while the whiskers stay at the fence', async () => {
        const el = await chart();
        expect(outliers(el)).toHaveLength(2);
        const api = boxes(el)[0]!;
        const cap = [...api.querySelectorAll('[data-slot="boxplot-whisker-cap"]')].map((l) => l.getBoundingClientRect());
        const top = Math.min(...cap.map((c) => c.top));
        expect(outliers(el)[0]!.getBoundingClientRect().bottom).toBeLessThan(top);
        const none = await chart('show-outliers="false"');
        expect(outliers(none)).toHaveLength(0);
        expect(Math.min(...[...boxes(none)[0]!.querySelectorAll('[data-slot="boxplot-whisker-cap"]')].map((l) => l.getBoundingClientRect().top))).toBeGreaterThan(0);
        expect(outliers(el)[0]!.getAttribute('aria-label')).toBe('API: outlier 95');
    });

    it('lays out horizontally with the categories down the side and the value axis across', async () => {
        const el = await chart('orientation="horizontal"');
        const r = boxes(el).map(rect);
        expect(r[0]!.top).toBeLessThan(r[1]!.top);
        expect(r[1]!.top).toBeLessThan(r[2]!.top);
        expect(r[0]!.height).toBeCloseTo(r[2]!.height, 3);
        const labels = [...root(el).querySelectorAll('text.tick')].map((t) => t.textContent);
        expect(labels).toContain('API');
        const api = [...root(el).querySelectorAll('text.tick')].find((t) => t.textContent === 'API')!;
        expect(api.getBoundingClientRect().right).toBeLessThan(r[0]!.left);
        expect(r[0]!.width).toBeGreaterThan(0);
        const median = boxes(el)[0]!.querySelector('[data-slot="boxplot-median"]')!.getBoundingClientRect();
        expect(median.width).toBeLessThan(2);
    });

    it('mirrors the category axis in RTL, the first group on the right', async () => {
        const page = await mount('<div dir="rtl" style="width:500px"><ge-boxplot></ge-boxplot></div>');
        const el = page.querySelector<GeBoxplot>('ge-boxplot')!;
        el.groups = GROUPS;
        await el.updateComplete;
        const r = boxes(el).map(rect);
        expect(r[0]!.left).toBeGreaterThan(r[1]!.left);
        expect(r[1]!.left).toBeGreaterThan(r[2]!.left);
        const wide = page.querySelector('div')!;
        wide.style.width = '500px';
        const horizontal = await mount('<div dir="rtl" style="width:500px"><ge-boxplot orientation="horizontal"></ge-boxplot></div>');
        const h = horizontal.querySelector<GeBoxplot>('ge-boxplot')!;
        h.groups = [{ label: 'low', values: [1, 2, 3, 4, 5] }, { label: 'high', values: [20, 21, 22, 23, 24] }];
        await h.updateComplete;
        expect(rect(boxes(h)[1]!).left).toBeLessThan(rect(boxes(h)[0]!).left);
        const label = [...root(h).querySelectorAll('text.tick')].find((t) => t.textContent === 'low')!.getBoundingClientRect();
        expect(label.left).toBeGreaterThan(rect(boxes(h)[0]!).right);
        const long = await chart('orientation="horizontal"', [{ label: 'Checkout API', values: API }, { label: 'DB', values: DB }]);
        const name = [...root(long).querySelectorAll('text.tick')].find((t) => t.textContent === 'Checkout API')!.getBoundingClientRect();
        expect(name.left).toBeGreaterThanOrEqual(root(long).querySelector('svg')!.getBoundingClientRect().left);
    });

    it('lists the five-number summary with the unit for the hovered box and dims the others, then clears', async () => {
        const el = await chart('unit="ms"');
        const seen: (ChartClickEvent<BoxplotGroup> | null)[] = [];
        el.addEventListener('group-hover', (event) => seen.push((event as CustomEvent).detail));
        await hover(el, 1);
        const text = tipText(el);
        for (const part of ['Web', 'Max52ms', 'Q343.25ms', 'Median39ms', 'Q135.25ms', 'Min30ms']) expect(text.replaceAll(/\s+/g, '')).toContain(part.replaceAll(/\s+/g, ''));
        expect(getComputedStyle(boxes(el)[0]!).opacity).toBe('0.5');
        expect(getComputedStyle(boxes(el)[1]!).opacity).toBe('1');
        expect(seen[0]!.point.label).toBe('Web');
        boxes(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(boxes(el)[1]!.getAttribute('aria-label')).toBe('Web: median 39ms, Q1 35.25ms, Q3 43.25ms, min 30ms, max 52ms');
        expect(root(await chart('show-tooltip="false"')).querySelector('ge-chart-tooltip')).toBeNull();
    });

    it('activates on click, Enter and Space, from an outlier as well, and takes focus', async () => {
        const el = await chart();
        const clicks: ChartClickEvent<BoxplotGroup>[] = [];
        el.addEventListener('group-click', (event) => clicks.push((event as CustomEvent).detail));
        boxes(el)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicks[0]!.point.label).toBe('DB');
        expect(clicks[0]!.event).toBeInstanceOf(MouseEvent);
        boxes(el)[0]!.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(clicks.slice(1).map((c) => c.point.label)).toEqual(['API', 'API']);
        expect(clicks[1]!.event).toBeUndefined();
        outliers(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicks.at(-1)!.point.label).toBe('DB');
        expect(clicks.at(-1)!.index).toBe(2);
    });

    it('takes pre-computed stats as they are, numbers its colours by the source group, and skips unusable groups', async () => {
        const el = await chart('', [
            { label: 'skipped' },
            { label: 'given', stats: { min: 10, q1: 20, median: 30, q3: 40, max: 50, outliers: [90] }, color: 'rgb(1, 2, 3)' },
            { label: 'raw', values: WEB },
        ]);
        expect(boxes(el)).toHaveLength(2);
        expect(boxes(el)[0]!.querySelector('rect')!.getAttribute('stroke')).toBe('rgb(1, 2, 3)');
        expect(boxes(el)[0]!.getAttribute('aria-label')).toContain('median 30');
        expect(outliers(el)).toHaveLength(1);
        const palette = await chart('', [{ label: 'skipped' }, { label: 'raw', values: WEB }]);
        const second = boxes(palette)[0]!.querySelector('rect')!.getAttribute('stroke');
        const first = await chart('', [{ label: 'raw', values: WEB }]);
        expect(second).not.toBe(boxes(first)[0]!.querySelector('rect')!.getAttribute('stroke'));
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Box plot with 2 data points.');
    });

    it('gives a flat group a visible 1px box, and says so when no group is usable', async () => {
        const flat = await chart('', [{ label: 'flat', values: [5, 5, 5] }, { label: 'wide', values: [1, 9, 4, 6] }]);
        expect(rect(boxes(flat)[0]!).height).toBeGreaterThanOrEqual(1);
        const empty = await chart('heading="Latency"', [{ label: 'x' }, { label: 'y', values: [] }]);
        expect(root(empty).querySelector('[data-slot="boxplot-empty"]')!.textContent).toBe('No data to display');
        expect(root(empty).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Latency. Box plot with 0 data points.');
        expect(boxes(empty)).toHaveLength(0);
    });

    it('draws gridlines and tick labels for the value axis, the grid hideable on its own', async () => {
        const el = await chart();
        const grid = root(el).querySelectorAll('[data-slot="grid-line"]');
        expect(grid.length).toBeGreaterThanOrEqual(4);
        const none = await chart('show-grid="false"');
        expect(root(none).querySelectorAll('[data-slot="grid-line"]')).toHaveLength(0);
        expect([...root(none).querySelectorAll('text.tick')].length).toBeGreaterThan(3);
        const first = grid[0]!.getBoundingClientRect();
        const last = grid[grid.length - 1]!.getBoundingClientRect();
        expect(first.top).toBeGreaterThan(last.top);
    });
});
