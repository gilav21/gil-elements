import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTimePicker } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const picker = async (attrs = '') => {
    const page = await mount(`<ge-time-picker ${attrs}></ge-time-picker>`);
    await settle(page);
    const el = page.querySelector<GeTimePicker>('ge-time-picker')!;
    const log: string[] = [];
    el.addEventListener('value-change', (e) => log.push((e as CustomEvent<string>).detail));
    return { page, el, log };
};
const root = (el: GeTimePicker) => el.shadowRoot!;
const box = (el: GeTimePicker, kind: string) => root(el).querySelector<HTMLInputElement>(`input[data-segment='${kind}']`)!;
const period = (el: GeTimePicker) => root(el).querySelector<HTMLButtonElement>('button')!;
const shown = (el: GeTimePicker) => [...root(el).querySelectorAll('input, button')].map((e) => (e as HTMLInputElement).value ?? e.textContent?.trim());
const text = (el: GeTimePicker) => [...root(el).querySelectorAll('input, button, .separator')].map((e) => (e instanceof HTMLInputElement ? e.value : e.textContent!.trim())).join('|');
const type = async (el: GeTimePicker, kind: string, value: string) => {
    const field = box(el, kind);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(el.parentElement!);
};

describe('ge-time-picker', () => {
    it('lays the segments out the way the locale writes a time, in its own digits', async () => {
        const us = await picker('value="21:05" locale="en-US"');
        expect(text(us.el).split('|').filter((part) => part.trim() !== '')).toEqual(['9', ':', '05', 'PM']);
        const de = await picker('value="21:05" locale="de-DE"');
        expect(text(de.el)).toBe('21|:|05');
        const arabic = await picker('value="21:05" locale="ar-EG"');
        expect(shown(arabic.el)[0]).toBe('٩');
        expect(shown(arabic.el)[1]).toBe('٠٥');
        const taiwan = await picker('value="21:05" locale="zh-TW"');
        expect(root(taiwan.el).querySelector('fieldset')!.querySelector('button, input')!.tagName).toBe('BUTTON');
    });

    it('describes each segment and the whole time to assistive technology, and stays left-to-right on an RTL page', async () => {
        const page = await mount('<div dir="rtl"><ge-time-picker value="21:05" locale="en-US" aria-label="Meeting"></ge-time-picker></div>');
        await settle(page);
        const el = page.querySelector<GeTimePicker>('ge-time-picker')!;
        const group = root(el).querySelector('fieldset')!;
        expect([group.getAttribute('aria-label'), group.dir]).toEqual(['Meeting', 'ltr']);
        const description = root(el).getElementById(group.getAttribute('aria-describedby')!)!;
        expect(description.textContent!.replaceAll(' ', ' ')).toBe('9:05 PM');
        const hour = box(el, 'hour');
        expect([hour.getAttribute('role'), hour.getAttribute('aria-valuenow'), hour.getAttribute('aria-valuemin'), hour.getAttribute('aria-valuemax'), hour.getAttribute('aria-valuetext')]).toEqual(['spinbutton', '9', '1', '12', '9 hour']);
        const [hourBox, minuteBox] = [box(el, 'hour'), box(el, 'minute')].map((b) => b.getBoundingClientRect().left);
        expect(hourBox).toBeLessThan(minuteBox!);
    });

    it('stays empty until both hour and minute are set, then emits HH:mm in 24-hour time', async () => {
        const { el, log } = await picker('locale="en-US"');
        await type(el, 'hour', '9');
        expect([el.value, shown(el)[0], log]).toEqual(['', '9', []]);
        await type(el, 'minute', '5');
        expect([el.value, log]).toEqual(['09:05', ['09:05']]);
        period(el).click();
        await settle(el.parentElement!);
        expect([el.value, log, period(el).textContent!.trim()]).toEqual(['21:05', ['09:05', '21:05'], 'PM']);
    });

    it('reads typed digits the way a time field does: the last two, clamped, in the locale glyphs, ignoring letters', async () => {
        const { el } = await picker('value="09:05" locale="en-US"');
        await type(el, 'minute', '594');
        expect([el.value, box(el, 'minute').value]).toEqual(['09:59', '59']);
        await type(el, 'minute', 'ab');
        expect([el.value, box(el, 'minute').value]).toEqual(['09:59', '59']);
        await type(el, 'minute', '1205');
        expect([el.value, box(el, 'minute').value]).toEqual(['09:05', '05']);
        await type(el, 'minute', '7');
        expect([el.value, box(el, 'minute').value]).toEqual(['09:07', '07']);

        const arabic = await picker('locale="ar-EG"');
        await type(arabic.el, 'hour', '٣');
        await type(arabic.el, 'minute', '٣٠');
        expect([arabic.el.value, box(arabic.el, 'minute').value]).toEqual(['03:30', '٣٠']);
    });

    it('steps a segment with the arrow keys and wraps at its bounds', async () => {
        const { page, el, log } = await picker('value="12:59" locale="en-US"');
        box(el, 'minute').focus();
        await userEvent.keyboard('{ArrowUp}');
        await settle(page);
        expect([el.value, box(el, 'minute').value]).toEqual(['12:00', '00']);
        await userEvent.keyboard('{ArrowDown}');
        await settle(page);
        expect(el.value).toBe('12:59');
        box(el, 'hour').focus();
        await userEvent.keyboard('{ArrowUp}');
        await settle(page);
        expect([box(el, 'hour').value, el.value]).toEqual(['1', '13:59']);
        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        await settle(page);
        expect([box(el, 'hour').value, el.value, log.length]).toEqual(['11', '23:59', 5]);
    });

    it('shows noon and midnight as 12 on a 12-hour clock and flips the half of the day', async () => {
        const noon = await picker('value="12:00" locale="en-US"');
        expect([box(noon.el, 'hour').value, period(noon.el).textContent!.trim()]).toEqual(['12', 'PM']);
        const midnight = await picker('value="00:05" locale="en-US"');
        expect([box(midnight.el, 'hour').value, period(midnight.el).textContent!.trim()]).toEqual(['12', 'AM']);
        period(midnight.el).click();
        await settle(midnight.page);
        expect(midnight.el.value).toBe('12:05');
    });

    it('does not echo a value set from outside, and does not wipe a half-typed hour', async () => {
        const { page, el, log } = await picker('locale="de-DE"');
        el.value = '14:30';
        await settle(page);
        expect([shown(el)[0], shown(el)[1], log]).toEqual(['14', '30', []]);
        await type(el, 'minute', '');
        expect([el.value, shown(el)[0], log]).toEqual(['', '14', ['']]);
        el.value = '09:15';
        await settle(page);
        expect([shown(el)[0], shown(el)[1], log]).toEqual(['09', '15', ['']]);
    });

    it('leaves other keys alone, and keeps the caret in place when it steps', async () => {
        const { page, el } = await picker('value="09:05" locale="en-US"');
        const press = (target: HTMLElement, key: string) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            target.dispatchEvent(event);
            return event.defaultPrevented;
        };
        expect([press(period(el), 'a'), press(box(el, 'minute'), 'a'), press(box(el, 'minute'), 'ArrowUp')]).toEqual([false, false, true]);
        await settle(page);
        expect([period(el).textContent!.trim(), el.value]).toEqual(['AM', '09:06']);
    });

    it('adds a seconds segment and widens the value to HH:mm:ss', async () => {
        const { page, el } = await picker('value="09:05:09" locale="en-GB" with-seconds');
        expect(text(el)).toBe('09|:|05|:|09');
        box(el, 'second').focus();
        await userEvent.keyboard('{ArrowUp}');
        await settle(page);
        expect(el.value).toBe('09:05:10');
        await type(el, 'second', '');
        expect(el.value).toBe('09:05:00');
        const description = root(el).getElementById('value-text')!;
        expect(description.textContent).toBe('09:05:00');
        el.value = '00:05:09';
        await settle(page);
        expect(description.textContent).toBe('00:05:09');
    });

    it('submits with its form, goes back to its first value on reset, and follows a disabled fieldset', async () => {
        const page = await mount('<form><fieldset><ge-time-picker name="start" value="09:05" locale="de-DE"></ge-time-picker></fieldset></form>');
        await settle(page);
        const el = page.querySelector<GeTimePicker>('ge-time-picker')!;
        const form = page.querySelector('form')!;
        expect(new FormData(form).get('start')).toBe('09:05');
        box(el, 'hour').focus();
        await userEvent.keyboard('{ArrowUp}');
        await settle(page);
        expect(new FormData(form).get('start')).toBe('10:05');
        form.reset();
        await settle(page);
        expect([el.value, new FormData(form).get('start')]).toEqual(['09:05', '09:05']);
        await type(el, 'minute', '');
        form.reset();
        await settle(page);
        expect([shown(el)[1], el.value]).toEqual(['05', '09:05']);

        const empty = await mount('<form><ge-time-picker locale="de-DE"></ge-time-picker></form>');
        await settle(empty);
        const blank = empty.querySelector<GeTimePicker>('ge-time-picker')!;
        await type(blank, 'hour', '14');
        empty.querySelector('form')!.reset();
        await settle(empty);
        expect(shown(blank)[0]).toBe('');
        page.querySelector('fieldset')!.disabled = true;
        await settle(page);
        expect([box(el, 'hour').disabled, root(el).querySelector('fieldset')!.getAttribute('aria-disabled')]).toEqual([true, 'true']);
    });

    it('disables every segment and the meridiem button', async () => {
        const { el } = await picker('value="21:05" locale="en-US" disabled');
        expect([box(el, 'hour').disabled, box(el, 'minute').disabled, period(el).disabled]).toEqual([true, true, true]);
    });

    it('has no axe violations in both themes', async () => {
        const { page } = await picker('value="21:05" locale="en-US"');
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            // The wrapper fades its colours over 150ms; axe would otherwise read the colours mid-fade.
            await new Promise((r) => setTimeout(r, 250));
            const result = await axe.run(page);
            expect(result.violations.map((v) => `${v.id} ${v.nodes.map((n) => n.html.slice(0, 80) + n.any.map((a) => a.message).join())}`)).toEqual([]);
        }
    });
});
