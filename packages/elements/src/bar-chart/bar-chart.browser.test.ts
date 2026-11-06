import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartDataPoint, GeBarChart } from './index.js';

const DATA: ChartDataPoint[] = [
    { name: 'Jan', value: 120 },
    { name: 'Feb', value: 200 },
    { name: 'Mar', value: 150 },
    { name: 'Apr', value: 280 },
];
const chart = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:500px"><ge-bar-chart ${attrs}></ge-bar-chart></div>`);
    const el = page.querySelector<GeBarChart>('ge-bar-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const bars = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('.bar')];
const rect = (bar: Element) => bar.querySelector('rect')!.getBoundingClientRect();
const tooltip = (el: Element) => root(el).querySelector<HTMLElement>('.tooltip');

describe('ge-bar-chart', () => {
    it('draws a labelled button per datum, taller for a bigger value, with the names on the axis and a summary', async () => {
        const el = await chart();
        expect(bars(el).map((b) => b.getAttribute('aria-label'))).toEqual(['Jan: 120', 'Feb: 200', 'Mar: 150', 'Apr: 280']);
        expect(bars(el).map((b) => rect(b).height).every((h, i, all) => i === 0 || (h > all[i - 1]!) === (DATA[i]!.value > DATA[i - 1]!.value))).toBe(true);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Column chart with 4 data points.');
        expect([...root(el).querySelectorAll('.axis text')].map((t) => t.textContent)).toEqual(expect.arrayContaining(['Jan', 'Feb', 'Mar', 'Apr']));
    });

    it('lays bars out as rows growing right when horizontal, and says so in the summary', async () => {
        const el = await chart('orientation="horizontal"');
        const boxes = bars(el).map((b) => rect(b));
        expect(boxes[1]!.top).toBeGreaterThan(boxes[0]!.top);
        expect(boxes[3]!.width).toBeGreaterThan(boxes[0]!.width);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toContain('Bar chart');
    });

    it('grows a negative value below the zero line and draws that line solid', async () => {
        const el = await chart('', [{ name: 'Up', value: 100 }, { name: 'Down', value: -60 }]);
        const [up, down] = bars(el).map((b) => rect(b));
        expect(down!.top).toBeCloseTo(up!.bottom, 0);
        expect(root(el).querySelector('.zero')).not.toBeNull();
    });

    it('prints a negative value below its bar, or inside the bar end when the axis leaves no room below', async () => {
        const el = await chart('', [{ name: 'Up', value: 100 }, { name: 'Small', value: -10 }, { name: 'Deep', value: -100 }]);
        const label = (i: number) => bars(el)[i]!.querySelector('.value')!.getBoundingClientRect();
        expect(label(0).bottom).toBeLessThan(rect(bars(el)[0]!).top + 1);
        expect(label(1).top).toBeGreaterThan(rect(bars(el)[1]!).bottom - 1);
        expect(label(2).bottom).toBeLessThan(rect(bars(el)[2]!).bottom + 1);
    });

    it('dims the other bars and shows the name and value on hover, and clears on leave', async () => {
        const el = await chart();
        const seen: (ChartClickEvent | null)[] = [];
        el.addEventListener('bar-hover', (event) => seen.push((event as CustomEvent<ChartClickEvent | null>).detail));
        bars(el)[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(seen[0]).toMatchObject({ index: 1, point: { name: 'Feb' } });
        expect(tooltip(el)!.textContent).toContain('Feb');
        expect(tooltip(el)!.textContent).toContain('200');
        expect(bars(el).map((b) => b.hasAttribute('data-dim'))).toEqual([true, false, true, true]);
        bars(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(tooltip(el)).toBeNull();
    });

    it('shows the same tooltip for a bar the keyboard reaches, and activates it with Enter and Space only', async () => {
        const el = await chart();
        const clicks: ChartClickEvent[] = [];
        el.addEventListener('bar-click', (event) => clicks.push((event as CustomEvent<ChartClickEvent>).detail));
        bars(el)[2]!.focus();
        await el.updateComplete;
        expect(tooltip(el)!.textContent).toContain('Mar');
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        await userEvent.keyboard('a');
        bars(el)[0]!.dispatchEvent(new MouseEvent('click'));
        expect(clicks.map((c) => [c.point.name, c.event instanceof MouseEvent])).toEqual([['Mar', false], ['Mar', false], ['Jan', true]]);
    });

    it('puts the tooltip beside the hovered bar, and on its other side near the right edge', async () => {
        const el = await chart();
        const area = root(el).querySelector('.base')!.getBoundingClientRect();
        bars(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const first = rect(bars(el)[0]!);
        expect(tooltip(el)!.getBoundingClientRect().left - area.left).toBeCloseTo(first.left - area.left + first.width / 2 + 12, 0);
        expect(first.top - tooltip(el)!.getBoundingClientRect().top).toBeCloseTo(8, 0);
        bars(el)[3]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const last = rect(bars(el)[3]!);
        expect(tooltip(el)!.getBoundingClientRect().right - area.left).toBeCloseTo(last.left - area.left + last.width / 2 + 12, 0);
    });

    it('keeps a bar label inside the bar when too little room is left beside it, outside otherwise', async () => {
        const el = await chart('orientation="horizontal"', [{ name: 'Long', value: 1000 }, { name: 'Short', value: 100 }]);
        const [long, short] = bars(el).map((b) => b.querySelector('.value')!.getAttribute('text-anchor'));
        expect([long, short]).toEqual(['end', 'start']);
    });

    it('drops the value labels, grid and tooltip when switched off, and adds the captions when given', async () => {
        const el = await chart('show-values="false" show-grid="false" show-tooltip="false" x-axis-label="Month" y-axis-label="Units"');
        expect(root(el).querySelectorAll('.value')).toHaveLength(0);
        expect(root(el).querySelector('.grid')).toBeNull();
        bars(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(tooltip(el)).toBeNull();
        expect([...root(el).querySelectorAll('.caption')].map((t) => t.textContent)).toEqual(['Month', 'Units']);
    });

    it('mirrors for a right-to-left direction: first bar on the right, value axis on the right', async () => {
        const el = await chart('dir="rtl"');
        const boxes = bars(el).map((b) => rect(b));
        expect(boxes[0]!.left).toBeGreaterThan(boxes[3]!.left);
    });

    it('grows horizontal bars leftwards from the right-hand axis when right-to-left', async () => {
        const el = await chart('dir="rtl" orientation="horizontal"');
        const boxes = bars(el).map((b) => rect(b));
        expect(boxes[0]!.right).toBeCloseTo(boxes[3]!.right, 0);
        expect(boxes[3]!.left).toBeLessThan(boxes[0]!.left);
        expect(bars(el).map((b) => b.querySelector('.value')!.getAttribute('text-anchor'))).toEqual(['end', 'end', 'end', 'start']);
    });
});
