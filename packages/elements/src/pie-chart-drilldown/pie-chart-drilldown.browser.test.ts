import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries, GePieChartDrilldown } from './index.js';

const DATA: DrilldownDataPoint[] = [{ name: 'Fruit', value: 500, drilldown: 'fruit' }, { name: 'Veg', value: 300, drilldown: 'veg' }, { name: 'Dairy', value: 150 }, { name: 'Orphan', value: 50, drilldown: 'missing' }];
const SERIES: DrilldownSeries[] = [
    { id: 'fruit', name: 'Fruit', data: [{ name: 'Apple', value: 240 }, { name: 'Pear', value: 160 }, { name: 'Nested', value: 100, drilldown: 'veg' } as DrilldownDataPoint] },
    { id: 'veg', name: 'Vegetables', data: [{ name: 'Kale', value: 90 }, { name: 'Beet', value: 210 }] },
];
const chart = async (attrs = '') => {
    const page = await mount(`<div style="width:640px"><ge-pie-chart-drilldown ${attrs}></ge-pie-chart-drilldown></div>`);
    const el = page.querySelector<GePieChartDrilldown>('ge-pie-chart-drilldown')!;
    el.data = DATA;
    el.drilldownSeries = SERIES;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const slices = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('.slice')];
const entries = (el: Element) => [...root(el).querySelectorAll<HTMLButtonElement>('.entry')];
const names = (el: Element) => entries(el).map((e) => e.querySelector('.name')!.textContent);
const crumb = (el: Element) => root(el).querySelector('[data-slot="drilldown-breadcrumb"]');
const record = (el: Element, ...types: string[]) => {
    const seen: [string, unknown][] = [];
    for (const type of types) el.addEventListener(type, (e) => seen.push([type, (e as CustomEvent).detail]));
    return seen;
};
const summary = (el: Element) => root(el).querySelector('svg.pie')!.getAttribute('aria-label');

describe('ge-pie-chart-drilldown', () => {
    it('drills into the series a slice names: slice-click first, then drilldown, with a breadcrumb that leads back', async () => {
        const el = await chart();
        const seen = record(el, 'slice-click', 'drilldown', 'drillup');
        expect(crumb(el)).toBeNull();
        expect(summary(el)).toBe('Overview. Pie chart with drilldown with 4 data points.');
        slices(el)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await el.updateComplete;
        expect(seen.map(([type]) => type)).toEqual(['slice-click', 'drilldown']);
        expect(seen[1]![1]).toEqual({ seriesId: 'veg', parentPoint: DATA[1] } satisfies DrilldownEvent);
        expect((seen[0]![1] as ChartClickEvent<DrilldownDataPoint>).index).toBe(1);
        expect(names(el)).toEqual(['Kale', 'Beet']);
        expect(el.isDrilledDown).toBe(true);
        expect(crumb(el)!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('Back / Vegetables');
        expect(summary(el)).toBe('Vegetables. Pie chart with drilldown with 2 data points.');
        root(el).querySelector<HTMLButtonElement>('[data-slot="drilldown-back"]')!.click();
        await el.updateComplete;
        expect(seen.at(-1)).toEqual(['drillup', null]);
        expect(names(el)).toEqual(['Fruit', 'Veg', 'Dairy', 'Orphan']);
        expect(crumb(el)).toBeNull();
    });

    it('stays put for a slice with no drilldown, an id no series has, and any slice once drilled down, but still reports the click', async () => {
        const el = await chart();
        const seen = record(el, 'slice-click', 'drilldown');
        slices(el)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        slices(el)[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(seen.map(([type]) => type)).toEqual(['slice-click', 'slice-click']);
        expect(el.isDrilledDown).toBe(false);
        slices(el)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await el.updateComplete;
        seen.length = 0;
        slices(el)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await el.updateComplete;
        expect(seen.map(([type]) => type)).toEqual(['slice-click']);
        expect(names(el)).toEqual(['Apple', 'Pear', 'Nested']);
    });

    it('drills from the legend, and from Enter or Space on a slice, but not from other keys', async () => {
        const el = await chart();
        slices(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        await el.updateComplete;
        expect(el.isDrilledDown).toBe(false);
        slices(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(names(el)).toEqual(['Apple', 'Pear', 'Nested']);
        el.drillUp();
        await el.updateComplete;
        slices(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(names(el)).toEqual(['Kale', 'Beet']);
        el.drillUp();
        await el.updateComplete;
        entries(el)[0]!.click();
        await el.updateComplete;
        expect(names(el)).toEqual(['Apple', 'Pear', 'Nested']);
    });

    it('marks what can drill: a chevron in the legend, a hint in the tooltip, a suffix in the accessible name', async () => {
        const el = await chart();
        expect(entries(el).map((e) => e.querySelector('.chevron') !== null)).toEqual([true, true, false, false]);
        expect(slices(el).map((s) => s.getAttribute('aria-label')!.endsWith('. Press Enter to drill down.'))).toEqual([true, true, false, false]);
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')!.textContent).toContain('Click to drill down');
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseleave'));
        slices(el)[2]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')!.textContent).not.toContain('drill');
        expect(root(el).querySelector('.tooltip')!.textContent!.replaceAll(/\s+/g, '')).toContain('Dairy150(15.0%)');
    });

    it('clears the hover on drilling, honours show-breadcrumb and back-button-text, and names the top level with the heading', async () => {
        const el = await chart('back-button-text="Zurück" heading="Sales"');
        expect(summary(el)).toBe('Sales. Pie chart with drilldown with 4 data points.');
        slices(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        slices(el)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')).toBeNull();
        expect(slices(el).some((s) => s.hasAttribute('data-dim'))).toBe(false);
        expect(root(el).querySelector('[data-slot="drilldown-back"]')!.textContent!.trim()).toBe('Zurück');
        const bare = await chart('show-breadcrumb="false"');
        slices(bare)[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await bare.updateComplete;
        expect(bare.isDrilledDown).toBe(true);
        expect(crumb(bare)).toBeNull();
        const seen = record(bare, 'drillup');
        bare.drillUp();
        expect(seen).toHaveLength(1);
        expect(bare.isDrilledDown).toBe(false);
    });
});
