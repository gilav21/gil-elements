import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries, GeBarChartDrilldown } from './index.js';

const DATA: DrilldownDataPoint[] = [{ name: 'Fruit', value: 500, drilldown: 'fruit' }, { name: 'Veg', value: 300, drilldown: 'veg' }, { name: 'Dairy', value: 150 }, { name: 'Orphan', value: 50, drilldown: 'missing' }];
const SERIES: DrilldownSeries[] = [
    { id: 'fruit', name: 'Fruit', data: [{ name: 'Apple', value: 240 }, { name: 'Pear', value: 160 }, { name: 'Nested', value: 100, drilldown: 'veg' } as DrilldownDataPoint] },
    { id: 'veg', name: 'Vegetables', data: [{ name: 'Kale', value: 90 }, { name: 'Beet', value: -40 }, { name: 'Leek', value: 0 }] },
];
const chart = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:500px"><ge-bar-chart-drilldown ${attrs}></ge-bar-chart-drilldown></div>`);
    const el = page.querySelector<GeBarChartDrilldown>('ge-bar-chart-drilldown')!;
    el.data = data;
    el.drilldownSeries = SERIES;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const groups = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('[data-slot="drilldown-bar"]')];
const rect = (g: Element) => g.querySelector('rect')!;
const names = (el: Element) => [...[...root(el).querySelectorAll('.axis')].at(-1)!.querySelectorAll('text')].map((x) => x.textContent);
const crumb = (el: Element) => root(el).querySelector('[data-slot="drilldown-breadcrumb"]');
const click = (g: Element) => g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const record = (el: Element, ...types: string[]) => {
    const seen: [string, unknown][] = [];
    for (const type of types) el.addEventListener(type, (e) => seen.push([type, (e as CustomEvent).detail]));
    return seen;
};
const summary = (el: Element) => root(el).querySelector('svg[role="group"]')!.getAttribute('aria-label');

describe('ge-bar-chart-drilldown', () => {
    it('drills into the series a column names: bar-click first, then drilldown, rescaling the axis, with a breadcrumb that leads back', async () => {
        const el = await chart();
        const seen = record(el, 'bar-click', 'drilldown', 'drillup');
        const topTick = () => [...root(el).querySelectorAll('.axis')][0]!.lastElementChild!.textContent;
        const before = topTick();
        expect(crumb(el)).toBeNull();
        expect(summary(el)).toBe('Overview. Column chart with drilldown with 4 data points.');
        click(groups(el)[1]!);
        await el.updateComplete;
        expect(seen.map(([type]) => type)).toEqual(['bar-click', 'drilldown']);
        expect(seen[1]![1]).toEqual({ seriesId: 'veg', parentPoint: DATA[1] } satisfies DrilldownEvent);
        expect((seen[0]![1] as ChartClickEvent<DrilldownDataPoint>).index).toBe(1);
        expect(names(el)).toEqual(['Kale', 'Beet', 'Leek']);
        expect(topTick()).not.toBe(before);
        expect(crumb(el)!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('Back / Vegetables');
        expect(summary(el)).toBe('Vegetables. Column chart with drilldown with 3 data points.');
        root(el).querySelector<HTMLButtonElement>('[data-slot="drilldown-back"]')!.click();
        await el.updateComplete;
        expect(seen.at(-1)).toEqual(['drillup', null]);
        expect(names(el)).toEqual(['Fruit', 'Veg', 'Dairy', 'Orphan']);
        expect(crumb(el)).toBeNull();
    });

    it('stays put for a column with no drilldown, an id no series has, and any column once drilled down, but still reports the click', async () => {
        const el = await chart();
        const seen = record(el, 'bar-click', 'drilldown');
        click(groups(el)[2]!);
        click(groups(el)[3]!);
        expect(seen.map(([type]) => type)).toEqual(['bar-click', 'bar-click']);
        expect(el.isDrilledDown).toBe(false);
        click(groups(el)[0]!);
        await el.updateComplete;
        seen.length = 0;
        click(groups(el)[2]!);
        await el.updateComplete;
        expect(seen.map(([type]) => type)).toEqual(['bar-click']);
        expect(names(el)).toEqual(['Apple', 'Pear', 'Nested']);
    });

    it('activates with Enter or Space but not other keys, and a mouse click carries its event while a key does not', async () => {
        const el = await chart();
        const seen = record(el, 'bar-click');
        groups(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
        expect(seen).toHaveLength(0);
        groups(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect((seen[0]![1] as ChartClickEvent).event).toBeUndefined();
        el.drillUp();
        await el.updateComplete;
        click(groups(el)[2]!);
        expect((seen.at(-1)![1] as ChartClickEvent).event).toBeInstanceOf(MouseEvent);
        groups(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await el.updateComplete;
        expect(names(el)).toEqual(['Kale', 'Beet', 'Leek']);
    });

    it('grows columns from the zero baseline, hangs a negative one below it, and puts its label where it fits', async () => {
        const el = await chart('', [{ name: 'Gain', value: 120 }, { name: 'Loss', value: -80 }, { name: 'Tiny', value: -2 }, { name: 'Flat', value: 0 }]);
        const boxes = groups(el).map((g) => rect(g).getBoundingClientRect());
        expect(boxes[0]!.bottom).toBeCloseTo(boxes[1]!.top, 0);
        expect(boxes[3]!.height).toBe(0);
        expect(boxes[1]!.height).toBeGreaterThan(boxes[2]!.height);
        const labels = [...root(el).querySelectorAll<SVGTextElement>('.value')].map((t) => t.getBoundingClientRect());
        expect(labels[0]!.bottom).toBeLessThanOrEqual(boxes[0]!.top + 1);
        expect(labels[1]!.top).toBeGreaterThanOrEqual(boxes[1]!.bottom - 1);
        const dashes = [...root(el).querySelectorAll('.grid line')];
        expect(dashes.filter((l) => !l.hasAttribute('stroke-dasharray'))).toHaveLength(1);
        const flat = labels[3]!;
        expect(flat.bottom).toBeLessThanOrEqual(boxes[3]!.top + 1);
        const full = await chart('', [{ name: 'Up', value: 100 }, { name: 'Down', value: -100 }]);
        const [, down] = groups(full).map((g) => rect(g).getBoundingClientRect());
        const downLabel = [...root(full).querySelectorAll<SVGTextElement>('.value')][1]!.getBoundingClientRect();
        expect(downLabel.bottom).toBeLessThanOrEqual(down!.bottom + 1);
        expect([...root(await chart()).querySelectorAll('.grid line')].every((l) => l.hasAttribute('stroke-dasharray'))).toBe(true);
    });

    it('marks what can drill in the tooltip and the accessible name, and anchors the tooltip to the active column', async () => {
        const el = await chart();
        expect(groups(el).map((g) => g.getAttribute('aria-label')!.endsWith('. Press Enter to drill down.'))).toEqual([true, true, false, false]);
        groups(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        const tip = root(el).querySelector('.tooltip')!;
        expect(tip.textContent).toContain('Click to drill down');
        const bar = rect(groups(el)[0]!).getBoundingClientRect();
        const svgBox = root(el).querySelector('svg[role="group"]')!.getBoundingClientRect();
        expect(tip.getBoundingClientRect().left - svgBox.left).toBeCloseTo(bar.left - svgBox.left + bar.width / 2 + 12, 0);
        expect(groups(el).map((g) => g.hasAttribute('data-dim'))).toEqual([false, true, true, true]);
        groups(el)[0]!.dispatchEvent(new MouseEvent('mouseleave'));
        groups(el)[2]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')!.textContent).not.toContain('drill');
        groups(el)[3]!.dispatchEvent(new FocusEvent('focus'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')!.hasAttribute('data-flip')).toBe(true);
        groups(el)[3]!.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')).toBeNull();
    });

    it('clears the hover on drilling, honours the breadcrumb and label settings, and mirrors in RTL', async () => {
        const el = await chart('back-button-text="Zurück" heading="Sales"');
        expect(summary(el)).toBe('Sales. Column chart with drilldown with 4 data points.');
        groups(el)[0]!.dispatchEvent(new MouseEvent('mouseenter'));
        click(groups(el)[0]!);
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')).toBeNull();
        expect(groups(el).some((g) => g.hasAttribute('data-dim'))).toBe(false);
        expect(root(el).querySelector('[data-slot="drilldown-back"]')!.textContent!.trim()).toBe('Zurück');
 
        groups(el)[1]!.dispatchEvent(new MouseEvent('mouseenter'));
        await el.updateComplete;
        el.drillUp();
        await el.updateComplete;
        expect(root(el).querySelector('.tooltip')).toBeNull();
        expect(groups(el).some((g) => g.hasAttribute('data-dim'))).toBe(false);
        const bare = await chart('show-breadcrumb="false" show-values="false" show-grid="false"');
        click(groups(bare)[0]!);
        await bare.updateComplete;
        expect(crumb(bare)).toBeNull();
        expect(root(bare).querySelectorAll('.value')).toHaveLength(0);
        expect(root(bare).querySelector('.grid')).toBeNull();
        const seen = record(bare, 'drillup');
        bare.drillUp();
        expect(seen).toHaveLength(1);
        const ltr = await chart();
        const rtl = await chart('dir="rtl"');
        expect(rect(groups(rtl)[0]!).getBoundingClientRect().left).toBeGreaterThan(rect(groups(rtl)[3]!).getBoundingClientRect().left);
        const frame = root(rtl).querySelector('svg[role="group"]')!.getBoundingClientRect();
        expect(rect(groups(rtl)[3]!).getBoundingClientRect().left - frame.left).toBeCloseTo(20, 0);
        expect(frame.right - rect(groups(rtl)[0]!).getBoundingClientRect().right).toBeCloseTo(70, 0);
        const tickBox = (e: Element) => root(e).querySelector('.axis text')!.getBoundingClientRect();
        expect(tickBox(rtl).left).toBeGreaterThanOrEqual(rect(groups(rtl)[0]!).getBoundingClientRect().right);
        expect(tickBox(ltr).right).toBeLessThanOrEqual(rect(groups(ltr)[0]!).getBoundingClientRect().left);
        expect(rect(groups(ltr)[0]!).getBoundingClientRect().left).toBeLessThan(rect(groups(ltr)[3]!).getBoundingClientRect().left);
        click(groups(rtl)[0]!);
        await rtl.updateComplete;
        const arrow = (e: Element) => root(e).querySelector('[data-slot="drilldown-back"] path')!.getAttribute('d');
        click(groups(ltr)[0]!);
        await ltr.updateComplete;
        expect(arrow(rtl)).toBe('m9 18 6-6-6-6');
        expect(arrow(ltr)).toBe('m15 18-6-6 6-6');
    });
});
