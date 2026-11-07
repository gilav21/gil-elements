import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { CalendarDay, GeCalendarHeatmap } from './index.js';

// 2025-03-05 is a Wednesday.
const DATA: CalendarDay[] = [
    { date: '2025-03-05', value: 2 },
    { date: '2025-03-09', value: 8 },
    { date: '2025-03-10', value: 0 },
    { date: '2025-03-19', value: 5 },
];
const calendar = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:500px"><ge-calendar-heatmap ${attrs}></ge-calendar-heatmap></div>`);
    const el = page.querySelector<GeCalendarHeatmap>('ge-calendar-heatmap')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const days = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="calendar-day"]')];
const box = (e: Element) => e.getBoundingClientRect();
const fill = (e: Element) => getComputedStyle(e).fill;
const tip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
const enter = async (el: GeCalendarHeatmap, index: number) => {
    days(el)[index]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};

describe('ge-calendar-heatmap', () => {
    it('puts a week per column starting on Sunday and a weekday per row, the first column being the week of the earliest day', async () => {
        const el = await calendar();
        const [wed, sun, mon, nextWed] = days(el).map(box);
        const step = 16;
        expect(sun!.left - wed!.left).toBeCloseTo(step, 0);
        expect(sun!.top).toBeLessThan(wed!.top);
        expect(wed!.top - sun!.top).toBeCloseTo(3 * step, 0);
        expect(mon!.left).toBeCloseTo(sun!.left, 0);
        expect(mon!.top - sun!.top).toBeCloseTo(step, 0);
        expect(nextWed!.left - wed!.left).toBeCloseTo(2 * step, 0);
        expect(nextWed!.top).toBeCloseTo(wed!.top, 0);
        expect(days(el)[0]!.getAttribute('aria-label')).toBe('2025-03-05: 2');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Calendar heatmap with 4 days.');
    });

    it('draws only the days given, and labels Mon, Wed and Fri', async () => {
        const el = await calendar();
        expect(days(el)).toHaveLength(4);
        expect([...root(el).querySelectorAll('.weekday')].map((t) => t.textContent)).toEqual(['Mon', 'Wed', 'Fri']);
        const mon = box(root(el).querySelectorAll('.weekday')[0]!);
        const monDay = box(days(el)[2]!);
        expect(mon.top + mon.height / 2).toBeCloseTo(monDay.top + monDay.height / 2, -1);
    });

    it('colours the lowest value with from-color and the highest with to-color, sizes days by cell-size', async () => {
        const el = await calendar('from-color="rgb(255, 255, 255)" to-color="rgb(0, 0, 0)" cell-size="20"');
        expect(fill(days(el)[2]!)).toBe('rgb(255, 255, 255)');
        expect(fill(days(el)[1]!)).toBe('rgb(0, 0, 0)');
        expect(fill(days(el)[0]!)).not.toBe(fill(days(el)[3]!));
        expect(box(days(el)[0]!).width).toBeCloseTo(20, 0);
    });

    it('reads a hovered or focused day out with its date and count beside its right edge, and reports day-hover', async () => {
        const el = await calendar();
        const seen: unknown[] = [];
        el.addEventListener('day-hover', (e) => seen.push((e as CustomEvent).detail));
        await enter(el, 1);
        const text = tip(el).textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain('2025-03-09');
        expect(text).toContain('Count8');
        expect(getComputedStyle(tip(el).querySelector('span')!).backgroundColor).toBe(fill(days(el)[1]!));
        expect(box(tip(el)).left).toBeCloseTo(box(days(el)[1]!).right, -1);
        days(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        days(el)[3]!.dispatchEvent(new FocusEvent('focus'));
        days(el)[3]!.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(seen).toEqual([DATA[1], null, DATA[3], null]);
    });

    it('shows Less to More swatches unless show-legend="false", and no tooltip with show-tooltip="false"', async () => {
        const el = await calendar();
        const swatches = [...root(el).querySelectorAll<HTMLElement>('.swatch')];
        expect(swatches).toHaveLength(5);
        expect(root(el).querySelector('.legend')!.textContent).toMatch(/^Less.*More$/);
        expect(swatches[0]!.style.background).toBe(fill(days(el)[2]!));
        expect(swatches[4]!.style.background).toBe(fill(days(el)[1]!));
        expect(root(await calendar('show-legend="false"')).querySelector('.legend')).toBeNull();
        expect(root(await calendar('show-tooltip="false"')).querySelector('ge-chart-tooltip')).toBeNull();
    });

    it('draws nothing for no data', async () => {
        const el = await calendar('', []);
        expect(days(el)).toHaveLength(0);
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Calendar heatmap with 0 days.');
    });
});
