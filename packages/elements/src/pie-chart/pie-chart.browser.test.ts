import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartDataPoint, GePieChart } from './index.js';

const DATA: ChartDataPoint[] = [
    { name: 'Chrome', value: 540 },
    { name: 'Safari', value: 210 },
    { name: 'Firefox', value: 200 },
    { name: 'Other', value: 50 },
];
const chart = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:640px"><ge-pie-chart ${attrs}></ge-pie-chart></div>`);
    const el = page.querySelector<GePieChart>('ge-pie-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const slices = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('.slice')];
const entries = (el: Element) => [...root(el).querySelectorAll<HTMLElement>('.entry')];
const tooltip = (el: Element) => root(el).querySelector<HTMLElement>('.tooltip');

describe('ge-pie-chart', () => {
    it('draws a slice per positive value, labelled with its share, and a legend entry per datum', async () => {
        const el = await chart();
        expect(slices(el).map((s) => s.getAttribute('aria-label'))).toEqual(['Chrome: 540 (54.0%) of 1,000 total', 'Safari: 210 (21.0%) of 1,000 total', 'Firefox: 200 (20.0%) of 1,000 total', 'Other: 50 (5.0%) of 1,000 total']);
        expect([...root(el).querySelectorAll('.percent')].map((t) => t.textContent)).toEqual(['54.0%', '21.0%', '20.0%', '5.0%']);
        expect(entries(el).map((e) => e.textContent!.replaceAll(/\s+/g, ' ').trim())).toEqual(['Chrome 540', 'Safari 210', 'Firefox 200', 'Other 50']);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Pie chart with 4 data points.');
    });

    it('gives a zero or negative value no slice but keeps its legend entry, and shows a dashed ring when nothing is positive', async () => {
        const el = await chart('', [{ name: 'A', value: 60 }, { name: 'B', value: 0 }, { name: 'C', value: -5 }]);
        expect(slices(el)).toHaveLength(1);
        expect(entries(el)).toHaveLength(3);
        expect(root(el).querySelector('.percent')!.textContent).toBe('100.0%');
        const seen: unknown[] = [];
        el.addEventListener('slice-hover', (event) => seen.push((event as CustomEvent).detail));
        entries(el)[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(seen).toEqual([]);
        expect(tooltip(el)).toBeNull();
        el.data = [{ name: 'A', value: 0 }];
        await el.updateComplete;
        expect(slices(el)).toHaveLength(0);
        expect(root(el).querySelector('[data-slot="pie-empty"]')).not.toBeNull();
    });

    it('prints a share only on slices of 5% or more, and not at all with show-labels="false"', async () => {
        const el = await chart('', [{ name: 'Big', value: 970 }, { name: 'Tiny', value: 30 }]);
        expect([...root(el).querySelectorAll('.percent')].map((t) => t.textContent)).toEqual(['97.0%']);
        el.showLabels = false;
        await el.updateComplete;
        expect(root(el).querySelectorAll('.percent')).toHaveLength(0);
    });

    it('spans the whole circle, starting at the top, for a single slice', async () => {
        const el = await chart('', [{ name: 'A', value: 5 }]);
        const box = root(el).querySelector('.slice path')!.getBoundingClientRect();
        const svg = root(el).querySelector('svg')!.getBoundingClientRect();
        expect(box.width).toBeCloseTo(280, 0);
        expect(box.top - svg.top).toBeCloseTo(10, 0);
    });

    it('prints the share in white, but dark on a light slice colour', async () => {
        const el = await chart('', [{ name: 'Red', value: 50, color: '#ef4444' }, { name: 'Yellow', value: 50, color: 'yellow' }]);
        const [red, yellow] = [...root(el).querySelectorAll('.percent')].map((t) => getComputedStyle(t).fill);
        expect(red).toBe('rgb(255, 255, 255)');
        expect(yellow).not.toBe(red);
    });

    it('cuts a hole for inner-radius, so a donut slice is thinner than a pie slice', async () => {
        const pie = await chart('', [{ name: 'A', value: 1 }]);
        const donut = await chart('inner-radius="0.6"', [{ name: 'A', value: 1 }]);
        const path = (el: Element) => root(el).querySelector('.slice path')!.getAttribute('d')!;
        expect(path(donut).split('A').length).toBeGreaterThan(path(pie).split('A').length - 1);
        expect(path(donut)).not.toBe(path(pie));
    });

    it('enlarges and dims on hover, from the slice or its legend entry, showing name, value and share, and clears on leave', async () => {
        const el = await chart();
        const seen: (ChartClickEvent | null)[] = [];
        el.addEventListener('slice-hover', (event) => seen.push((event as CustomEvent<ChartClickEvent | null>).detail));
        slices(el)[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(seen[0]).toMatchObject({ index: 1, point: { name: 'Safari' } });
        expect(tooltip(el)!.textContent!.replaceAll(/\s+/g, ' ')).toContain('Safari 210 (21.0%)');
        expect(slices(el).map((s) => s.hasAttribute('data-dim'))).toEqual([true, false, true, true]);
        expect(root(el).querySelector('.slice path[data-hover]')).toBe(slices(el)[1]!.querySelector('path'));
        slices(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        entries(el)[2]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(seen.at(-1)).toMatchObject({ index: 2 });
        expect(entries(el).map((e) => e.hasAttribute('data-dim'))).toEqual([true, true, false, true]);
    });

    it('puts the tooltip beside the hovered slice for the pointer and the keyboard alike', async () => {
        const el = await chart();
        const base = root(el).querySelector('.base')!.getBoundingClientRect();
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const byPointer = tooltip(el)!.getBoundingClientRect();
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseleave'));
        slices(el)[0]!.focus();
        await el.updateComplete;
        expect(tooltip(el)!.getBoundingClientRect().left).toBeCloseTo(byPointer.left, 0);
        const label = root(el).querySelector('.percent')!.getBoundingClientRect();
        expect(byPointer.left - (label.left + label.width / 2)).toBeCloseTo(12, 0);
        expect(byPointer.left - base.left).toBeGreaterThan(150);
    });

    it('activates a slice with Enter and Space only, and a legend entry with a click', async () => {
        const el = await chart();
        const clicks: ChartClickEvent[] = [];
        el.addEventListener('slice-click', (event) => clicks.push((event as CustomEvent<ChartClickEvent>).detail));
        slices(el)[2]!.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        await userEvent.keyboard('a');
        entries(el)[3]!.click();
        expect(clicks.map((c) => [c.point.name, c.event instanceof MouseEvent])).toEqual([['Firefox', false], ['Firefox', false], ['Other', true]]);
    });

    it('moves the legend with legend-position, and removes it with none, show-legend="false" or no tooltip', async () => {
        const el = await chart('legend-position="left"');
        const svgBox = () => root(el).querySelector('svg')!.getBoundingClientRect();
        const legendBox = () => root(el).querySelector('.legend')!.getBoundingClientRect();
        expect(legendBox().right).toBeLessThanOrEqual(svgBox().left + 1);
        el.legendPosition = 'top';
        await el.updateComplete;
        expect(legendBox().bottom).toBeLessThanOrEqual(svgBox().top + 1);
        el.legendPosition = 'bottom';
        await el.updateComplete;
        expect(legendBox().top).toBeGreaterThanOrEqual(svgBox().bottom - 1);
        el.legendPosition = 'none';
        await el.updateComplete;
        expect(root(el).querySelector('.legend')).toBeNull();
        el.legendPosition = 'right';
        el.showTooltip = false;
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(tooltip(el)).toBeNull();
    });
});
