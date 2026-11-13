import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCalendar } from '../calendar/index.js';
import type { GeDatePicker, GeDateRangePicker } from './index.js';

type Picker = GeDatePicker | GeDateRangePicker;
const picker = <T extends Picker>(page: HTMLElement, tag = 'ge-date-picker') => page.querySelector<T>(tag)!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const trigger = (p: Picker) => p.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
const label = (p: Picker) => trigger(p).textContent!.trim();
const calendar = (p: Picker) => p.shadowRoot!.querySelector<GeCalendar>('ge-calendar');
const day = (p: Picker, n: number) =>
    [...calendar(p)!.shadowRoot!.querySelectorAll<HTMLElement>('.day')].find((d) => d.textContent!.trim() === String(n))!.shadowRoot!.querySelector('button')!;
const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null);

describe('ge-date-picker', () => {
    it('ties invalid and error-message to its trigger, the focusable part (a host attribute cannot reach into the shadow root)', async () => {
        const page = await mount(`<ge-date-picker date="2026-05-14" invalid error-message="Pick a weekday"></ge-date-picker><ge-date-picker></ge-date-picker>`);
        await settle(page);
        const [bad, fine] = [...page.querySelectorAll<GeDatePicker>('ge-date-picker')];
        expect(trigger(bad!).getAttribute('aria-invalid')).toBe('true');
        expect(trigger(bad!).getAttribute('aria-description')).toBe('Pick a weekday');
        expect(trigger(fine!).hasAttribute('aria-invalid')).toBe(false);
        expect(trigger(fine!).hasAttribute('aria-description')).toBe(false);
        bad!.invalid = false;
        bad!.errorMessage = '';
        await settle(page);
        expect(trigger(bad!).hasAttribute('aria-invalid')).toBe(false);
        expect(trigger(bad!).hasAttribute('aria-description')).toBe(false);
    });

    it('shows the placeholder, then the date in the locale, and opens a calendar on that date', async () => {
        const page = await mount(`<ge-date-picker date="2026-05-14" locale="de"></ge-date-picker><ge-date-picker placeholder="Birth date"></ge-date-picker>`);
        await settle(page);
        const [withDate, empty] = [...page.querySelectorAll<GeDatePicker>('ge-date-picker')];

        expect(label(withDate!)).toBe('14. Mai 2026');
        expect(label(empty!)).toBe('Birth date');
        expect(trigger(withDate!).getAttribute('aria-haspopup')).toBe('dialog');
        expect(calendar(withDate!)).toBeNull();

        trigger(withDate!).click();
        await settle(page);
        expect(trigger(withDate!).getAttribute('aria-expanded')).toBe('true');
        expect(calendar(withDate!)!.shadowRoot!.querySelector('.day[data-selected]')!.textContent!.trim()).toBe('14');
    });

    it('picking a day stores it, fires date-change with a Date, and closes the panel', async () => {
        const page = await mount(`<ge-date-picker date="2026-05-14"></ge-date-picker>`);
        await settle(page);
        const p = picker<GeDatePicker>(page);
        const events: unknown[] = [];
        p.addEventListener('date-change', (e) => events.push((e as CustomEvent).detail));

        trigger(p).click();
        await settle(page);
        day(p, 20).click();
        await settle(page);

        expect(ymd(p.date)).toBe('2026-5-20');
        expect(events).toEqual([p.date]);
        expect(label(p)).toBe('May 20, 2026');
        expect(calendar(p)).toBeNull();
        expect(trigger(p).getAttribute('aria-expanded')).toBe('false');
    });

    it('stays open after a pick when show-time is on, and puts the time in the label', async () => {
        const page = await mount(`<form id="f"><ge-date-picker name="when" show-time></ge-date-picker></form>`);
        const p = picker<GeDatePicker>(page);
        await settle(page);
        trigger(p).click();
        await settle(page);
        day(p, 20).click();
        await settle(page);

        expect(calendar(p)).not.toBeNull();
        expect(calendar(p)!.shadowRoot!.querySelector('#time')).not.toBeNull();
        expect(label(p)).toMatch(/\d{2}:\d{2}/);
        expect(new FormData(page.querySelector<HTMLFormElement>('#f')!).get('when')).toMatch(/^\d{4}-\d{2}-20T\d{2}:\d{2}$/);
    });

    it('closes on Escape with focus back on the button, and on a click outside, without changing the value', async () => {
        const page = await mount(`<ge-date-picker date="2026-05-14"></ge-date-picker><button id="out">out</button>`);
        const p = picker<GeDatePicker>(page);
        await settle(page);

        trigger(p).click();
        await settle(page);
        day(p, 20).focus();
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(calendar(p)).toBeNull();
        expect(p.shadowRoot!.activeElement).toBe(trigger(p));

        trigger(p).click();
        await settle(page);
        page.querySelector<HTMLElement>('#out')!.click();
        await settle(page);
        expect(calendar(p)).toBeNull();
        expect(ymd(p.date)).toBe('2026-5-14');
    });

    it('does not open while disabled, and closes if it becomes disabled while open', async () => {
        const page = await mount(`<ge-date-picker disabled></ge-date-picker>`);
        const p = picker<GeDatePicker>(page);
        await settle(page);
        expect(trigger(p).disabled).toBe(true);
        p.show();
        await settle(page);
        expect(calendar(p)).toBeNull();

        p.disabled = false;
        // The host's own disabled attribute also drives formDisabledCallback; it is reflected on the next update.
        await p.updateComplete;
        p.show();
        await settle(page);
        expect(calendar(p)).not.toBeNull();
        p.disabled = true;
        await settle(page);
        expect(calendar(p)).toBeNull();
    });

    it('is a form field: submits the date, follows a pick, and resets to the declared date', async () => {
        const page = await mount(`<form id="f"><ge-date-picker name="when" date="2026-05-14"></ge-date-picker></form>`);
        const p = picker<GeDatePicker>(page);
        await settle(page);
        const form = page.querySelector<HTMLFormElement>('#f')!;

        expect(new FormData(form).get('when')).toBe('2026-05-14');
        trigger(p).click();
        await settle(page);
        day(p, 3).click();
        await settle(page);
        expect(new FormData(form).get('when')).toBe('2026-05-03');

        form.reset();
        await settle(page);
        expect(new FormData(form).get('when')).toBe('2026-05-14');
        expect(ymd(p.date)).toBe('2026-5-14');
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations closed', async () => {
            const page = await mount(`<ge-date-picker date="2026-05-14" aria-label="Date"></ge-date-picker>`);
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});

describe('ge-date-range-picker', () => {
    it('shows an open-ended label while the end is missing, then closes once both are picked', async () => {
        const page = await mount(`<ge-date-range-picker></ge-date-range-picker>`);
        const p = picker<GeDateRangePicker>(page, 'ge-date-range-picker');
        await settle(page);
        expect(label(p)).toBe('Pick a date range');

        p.range = { start: new Date(2026, 4, 8), end: null };
        await settle(page);
        expect(label(p)).toBe('May 8, 2026 - ...');

        trigger(p).click();
        await settle(page);
        p.range = { start: null, end: null };
        await settle(page);
        day(p, 8).click();
        await settle(page);
        expect(calendar(p)).not.toBeNull();
        const events: unknown[] = [];
        p.addEventListener('range-change', (e) => events.push((e as CustomEvent).detail));
        day(p, 15).click();
        await settle(page);

        expect(label(p)).toBe('May 8, 2026 - May 15, 2026');
        expect(events).toHaveLength(1);
        expect(calendar(p)).toBeNull();
    });

    it('stays open for the times with show-time, reports the time range, and submits start/end', async () => {
        const page = await mount(`<form id="f"><ge-date-range-picker name="stay" show-time></ge-date-range-picker></form>`);
        const p = picker<GeDateRangePicker>(page, 'ge-date-range-picker');
        await settle(page);
        trigger(p).click();
        await settle(page);
        const times: unknown[] = [];
        p.addEventListener('time-range-change', (e) => times.push((e as CustomEvent).detail));

        const input = calendar(p)!.shadowRoot!.querySelector<HTMLInputElement>('#start-time')!;
        input.value = '09:30';
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await settle(page);
        day(p, 8).click();
        await settle(page);
        day(p, 15).click();
        await settle(page);

        expect(times).toEqual([{ start: '09:30', end: '' }]);
        expect(calendar(p)).not.toBeNull();
        const form = page.querySelector<HTMLFormElement>('#f')!;
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        expect(new FormData(form).get('stay')).toMatch(new RegExp(`^\\d{4}-${month}-08T09:30/\\d{4}-${month}-15T`));
    });
});
