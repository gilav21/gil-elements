import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { DateRange, GeCalendar } from './index.js';

const cal = (page: HTMLElement) => page.querySelector<GeCalendar>('ge-calendar')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 2; round++) {
        await cal(page).updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const day = (page: HTMLElement, n: number) =>
    [...cal(page).shadowRoot!.querySelectorAll<HTMLElement>('.day')].find((d) => d.textContent!.trim() === String(n))!;
const click = async (page: HTMLElement, n: number) => {
    day(page, n).shadowRoot!.querySelector('button')!.click();
    await settle(page);
};
const caption = (page: HTMLElement) => [...cal(page).shadowRoot!.querySelectorAll('.caption > span')].map((s) => s.textContent).join(' ');
const nav = (page: HTMLElement, index: number) => cal(page).shadowRoot!.querySelectorAll('.header > ge-button')[index]!.shadowRoot!.querySelector('button')!;
const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);
const marked = (page: HTMLElement, attr: string) => [...cal(page).shadowRoot!.querySelectorAll<HTMLElement>(`.day[${attr}]`)].map((d) => d.textContent!.trim());

describe('ge-calendar', () => {
    it('opens on the month of the first selection, and moves a month at a time without touching it', async () => {
        const page = await mount(`<ge-calendar selected="2026-05-14"></ge-calendar>`);
        await settle(page);
        expect(caption(page)).toBe('May 2026');
        expect(marked(page, 'data-selected')).toEqual(['14']);

        nav(page, 1).click();
        await settle(page);
        expect(caption(page)).toBe('June 2026');
        expect(marked(page, 'data-selected')).toEqual([]);
        nav(page, 0).click();
        nav(page, 0).click();
        await settle(page);
        expect(caption(page)).toBe('April 2026');
        expect(ymd(cal(page).selected as Date)).toBe('2026-5-14');

        cal(page).selected = '2026-09-01';
        await settle(page);
        expect(caption(page)).toBe('April 2026');
    });

    it('lays the month out from the chosen weekday, with blanks before the 1st and the right weekday names', async () => {
        const page = await mount(`<ge-calendar selected="2026-05-14" week-starts-on="1"></ge-calendar>`);
        await settle(page);
        const root = cal(page).shadowRoot!;
        const names = [...root.querySelectorAll('.weekdays div')].map((d) => d.textContent);
        const cells = [...root.querySelector('.days')!.children];

        expect(names).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
        expect(cells.filter((c) => c.classList.contains('filler'))).toHaveLength(4);
        expect(cells[4]!.textContent!.trim()).toBe('1');
        expect(cells.filter((c) => c.classList.contains('day'))).toHaveLength(31);
    });

    it('single mode replaces the selection, keeps its time of day, and fires selected-change with a Date', async () => {
        const page = await mount(`<ge-calendar></ge-calendar>`);
        cal(page).selected = new Date(2026, 4, 14, 9, 30);
        await settle(page);
        const events: unknown[] = [];
        cal(page).addEventListener('selected-change', (e) => events.push((e as CustomEvent).detail));

        await click(page, 20);
        const next = cal(page).selected as Date;
        expect([ymd(next), next.getHours(), next.getMinutes()]).toEqual(['2026-5-20', 9, 30]);
        expect(marked(page, 'data-selected')).toEqual(['20']);
        expect(events).toEqual([next]);
    });

    it('multi mode toggles days on and off and keeps them as Dates', async () => {
        const page = await mount(`<ge-calendar mode="multi"></ge-calendar>`);
        cal(page).selected = ['2026-05-04', '2026-05-12'];
        await settle(page);

        await click(page, 20);
        await click(page, 4);
        expect((cal(page).selected as Date[]).map(ymd)).toEqual(['2026-5-12', '2026-5-20']);
        expect(marked(page, 'data-selected')).toEqual(['12', '20']);
    });

    it('range mode fills start then end, swaps a click before the start, and starts over after two', async () => {
        const page = await mount(`<ge-calendar mode="range"></ge-calendar>`);
        cal(page).selected = { start: new Date(2026, 4, 1), end: null };
        await settle(page);
        const range = () => cal(page).selected as DateRange;

        await click(page, 15);
        expect([ymd(range().start), ymd(range().end)]).toEqual(['2026-5-1', '2026-5-15']);
        expect(marked(page, 'data-in-range')).toHaveLength(13);
        expect(marked(page, 'data-range-start')).toEqual(['1']);
        expect(marked(page, 'data-range-end')).toEqual(['15']);
        expect([1, 2, 14, 15, 16].map((n) => cal(page).isInRange(new Date(2026, 4, n)))).toEqual([false, true, true, false, false]);

        await click(page, 20);
        expect([ymd(range().start), ymd(range().end)]).toEqual(['2026-5-20', null]);
        expect(marked(page, 'data-range-start')).toEqual([]);

        await click(page, 10);
        expect([ymd(range().start), ymd(range().end)]).toEqual(['2026-5-10', '2026-5-20']);
    });

    it('stamps the time fields onto picked and existing dates', async () => {
        const page = await mount(`<ge-calendar mode="range" show-time-select time-mode="range"></ge-calendar>`);
        cal(page).selectedTimeRange = { start: '09:30', end: '17:45' };
        await settle(page);
        const field = (id: string) => cal(page).shadowRoot!.querySelector<HTMLInputElement>(`#${id}`)!;
        const set = async (id: string, value: string) => {
            field(id).value = value;
            field(id).dispatchEvent(new Event('change', { bubbles: true }));
            await settle(page);
        };
        const at = (d: Date | null) => (d ? `${d.getHours()}:${d.getMinutes()}` : null);

        await click(page, 8);
        await click(page, 15);
        const range = () => cal(page).selected as DateRange;
        expect([at(range().start), at(range().end)]).toEqual(['9:30', '17:45']);
        expect([field('start-time').value, field('end-time').value]).toEqual(['09:30', '17:45']);

        await set('end-time', '18:10');
        expect(at(range().end)).toBe('18:10');
        expect(cal(page).selectedTimeRange).toEqual({ start: '09:30', end: '18:10' });
    });

    it('turns a bare time edit into a selection in single mode, and ignores a cleared field', async () => {
        const page = await mount(`<ge-calendar show-time-select></ge-calendar>`);
        await settle(page);
        const input = cal(page).shadowRoot!.querySelector<HTMLInputElement>('#time')!;
        input.value = '';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(cal(page).selected).toBeNull();

        input.value = '14:05';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const picked = cal(page).selected as Date;
        expect([picked.getHours(), picked.getMinutes()]).toEqual([14, 5]);
    });

    it('reads names from a locale, mirrors for right-to-left ones, and takes a whole dictionary', async () => {
        const page = await mount(`<ge-calendar locale="he" selected="2026-05-14"></ge-calendar>`);
        await settle(page);
        expect(caption(page)).toBe('מאי 2026');
        expect(cal(page).hasAttribute('rtl')).toBe(true);
        expect(cal(page).shadowRoot!.querySelector('.calendar')!.getAttribute('dir')).toBe('rtl');
        expect(nav(page, 0).getAttribute('aria-label')).toBe('החודש הקודם');

        cal(page).locale = { code: 'xx', monthNames: Array.from({ length: 12 }, (...[, i]) => `M${i + 1}`), dayNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] };
        await settle(page);
        expect(caption(page)).toBe('M5 2026');
    });

    it('jumps the view from the month and year pickers', async () => {
        const page = await mount(`<ge-calendar selected="2026-05-14" show-month-select show-year-select></ge-calendar>`);
        await settle(page);
        const [month, year] = [...cal(page).shadowRoot!.querySelectorAll('ge-select')];
        month!.dispatchEvent(new CustomEvent('value-change', { detail: '1', bubbles: true, composed: true }));
        await settle(page);
        expect(month!.getAttribute('value')).toBe('1');
        expect(day(page, 28)).toBeTruthy();
        expect(day(page, 29)).toBeUndefined();
        year!.dispatchEvent(new CustomEvent('value-change', { detail: '2024', bubbles: true, composed: true }));
        await settle(page);
        expect(day(page, 29)).toBeTruthy();
        expect(year!.getAttribute('value')).toBe('2024');
        expect(year!.querySelectorAll('ge-select-item')).toHaveLength(101);
    });

    it('can be driven from the keyboard: Tab reaches a day and Enter picks it', async () => {
        const page = await mount(`<ge-calendar selected="2026-05-14"></ge-calendar>`);
        await settle(page);
        day(page, 20).shadowRoot!.querySelector('button')!.focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);

        expect(ymd(cal(page).selected as Date)).toBe('2026-5-20');
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(`<ge-calendar mode="range" selected="2026-05-14" show-month-select show-year-select show-time-select></ge-calendar>`);
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});
