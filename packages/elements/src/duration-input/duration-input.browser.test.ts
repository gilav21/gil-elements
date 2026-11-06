import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeDurationInput } from './duration-input.js';

const first = (page: HTMLElement) => page.querySelector<GeDurationInput>('ge-duration-input')!;
const seg = (el: GeDurationInput, unit: string) => el.shadowRoot!.querySelector<HTMLInputElement>(`input[data-unit="${unit}"]`)!;
const texts = (el: GeDurationInput) => el.segmentInputs.map((input) => input.value);
const record = (el: Element) => {
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    return events;
};

describe('ge-duration-input', () => {
    it('shows hours and minutes from seconds, an hour and a half as 1:30, and empty segments for no value', async () => {
        const page = await mount('<ge-duration-input value="5400"></ge-duration-input><ge-duration-input></ge-duration-input>');
        const [set, empty] = [...page.querySelectorAll<GeDurationInput>('ge-duration-input')];
        await Promise.all([set!.updateComplete, empty!.updateComplete]);
        expect(texts(set!)).toEqual(['1', '30']);
        expect(texts(empty!)).toEqual(['', '']);
        expect(seg(empty!, 'hours').placeholder).toBe('0');
        expect(seg(empty!, 'minutes').placeholder).toBe('00');
        expect(set!.shadowRoot!.querySelector('.colon')!.textContent).toBe(':');
    });

    it('lets the leading unit absorb the ones not shown: 90 minutes is 90:00, and a segment is as wide as its digits', async () => {
        const page = await mount('<ge-duration-input units="minutes,seconds" value="5400"></ge-duration-input><ge-duration-input units="hours,minutes,seconds" value="3725"></ge-duration-input><ge-duration-input units="seconds" value="125"></ge-duration-input><ge-duration-input units="minutes,seconds" value="360000"></ge-duration-input>');
        const [ms, hms, s, long] = [...page.querySelectorAll<GeDurationInput>('ge-duration-input')];
        await Promise.all([ms!.updateComplete, hms!.updateComplete, s!.updateComplete, long!.updateComplete]);
        expect(texts(ms!)).toEqual(['90', '00']);
        expect(texts(hms!)).toEqual(['1', '02', '05']);
        expect(texts(s!)).toEqual(['125']);
        expect(texts(long!)).toEqual(['6000', '00']);
        expect(seg(long!, 'minutes').getBoundingClientRect().width).toBeGreaterThan(seg(ms!, 'minutes').getBoundingClientRect().width);
        expect(seg(ms!, 'seconds').getBoundingClientRect().width).toBeLessThan(40);
    });

    it('takes digits typed into one segment as that unit, ignores other characters, and clears a segment to zero', async () => {
        const page = await mount('<ge-duration-input value="3600"></ge-duration-input><button>next</button>');
        const el = first(page);
        const events = record(el);
        await userEvent.fill(seg(el, 'minutes'), '45');
        expect(el.value).toBe(3600 + 45 * 60);
        await userEvent.fill(seg(el, 'minutes'), '4a5');
        expect(el.value).toBe(3600 + 45 * 60);
        await userEvent.fill(seg(el, 'hours'), '');
        expect(el.value).toBe(45 * 60);
        expect(texts(el)).toEqual(['0', '45']);
        expect(events).toEqual(['input', 'input', 'input']);
    });

    it('steps the segment under the caret with the arrow keys, wrapping a bounded one and stopping the leading one at zero', async () => {
        const page = await mount('<ge-duration-input value="3540"></ge-duration-input>');
        const el = first(page);
        const events = record(el);
        await userEvent.click(seg(el, 'minutes'));
        await userEvent.keyboard('{ArrowUp}');
        expect(el.value).toBe(0);
        expect(texts(el)).toEqual(['0', '00']);
        await userEvent.keyboard('{ArrowDown}');
        expect(el.value).toBe(59 * 60);
        await userEvent.click(seg(el, 'hours'));
        await userEvent.keyboard('{ArrowDown}');
        expect(el.value).toBe(59 * 60);
        await userEvent.keyboard('{ArrowUp}{ArrowUp}');
        expect(el.value).toBe(2 * 3600 + 59 * 60);
        expect(events).toEqual(['input', 'input', 'input', 'input', 'input']);
    });

    it('announces one change when focus leaves the whole control, not when it moves between segments', async () => {
        const page = await mount('<ge-duration-input value="60"></ge-duration-input><button>next</button>');
        const el = first(page);
        const events = record(el);
        await userEvent.click(seg(el, 'hours'));
        await userEvent.keyboard('2');
        await userEvent.click(seg(el, 'minutes'));
        expect(events.includes('change')).toBe(false);
        await userEvent.click(page.querySelector('button')!);
        expect(events.filter((e) => e === 'change')).toHaveLength(1);

        const quiet = record(el);
        await userEvent.click(seg(el, 'hours'));
        await userEvent.click(page.querySelector('button')!);
        expect(quiet.includes('change')).toBe(false);
    });

    it('describes each segment and the whole value to assistive tech, in the locale', async () => {
        const page = await mount('<ge-duration-input value="5400" locale="de"></ge-duration-input><ge-duration-input value="0"></ge-duration-input>');
        const [de, zero] = [...page.querySelectorAll<GeDurationInput>('ge-duration-input')];
        await Promise.all([de!.updateComplete, zero!.updateComplete]);
        const hours = seg(de!, 'hours');
        expect(hours.getAttribute('role')).toBe('spinbutton');
        expect(hours.getAttribute('aria-label')).toBe('hours');
        expect(hours.getAttribute('aria-valuenow')).toBe('1');
        expect(hours.getAttribute('aria-valuemin')).toBe('0');
        expect(hours.getAttribute('aria-valuemax')).toBe(String(Number.MAX_SAFE_INTEGER));
        expect(seg(de!, 'minutes').getAttribute('aria-valuemax')).toBe('59');
        expect(hours.getAttribute('aria-valuetext')).toBe('1 Stunde');
        const group = de!.shadowRoot!.querySelector('fieldset')!;
        expect(group.getAttribute('aria-label')).toBe('Duration');
        expect(de!.shadowRoot!.getElementById(group.getAttribute('aria-describedby')!)!.textContent).toBe('1 Stunde, 30 Minuten');
        expect(zero!.shadowRoot!.getElementById(zero!.shadowRoot!.querySelector('fieldset')!.getAttribute('aria-describedby')!)!.textContent).toBe('0 minutes');
    });

    it('takes part in a form by name in seconds, resets, and follows disabled', async () => {
        const page = await mount('<form><ge-duration-input name="length" value="90"></ge-duration-input></form>');
        const el = first(page);
        const form = page.querySelector('form')!;
        expect(new FormData(form).get('length')).toBe('90');
        el.value = null;
        await el.updateComplete;
        expect(new FormData(form).get('length')).toBe('');
        form.reset();
        await el.updateComplete;
        expect(el.value).toBe(90);

        el.disabled = true;
        await el.updateComplete;
        expect(el.segmentInputs.every((input) => input.disabled)).toBe(true);
        expect(getComputedStyle(el.shadowRoot!.querySelector('fieldset')!).opacity).toBe('0.5');
        const fieldset = await mount('<fieldset disabled><ge-duration-input></ge-duration-input></fieldset>');
        expect(first(fieldset).segmentInputs.every((input) => input.disabled)).toBe(true);
    });

    it('is an inline outlined box with a ring on focus, an underline, or nothing', async () => {
        const page = await mount('<ge-duration-input value="60"></ge-duration-input><ge-duration-input variant="underline"></ge-duration-input><ge-duration-input variant="ghost"></ge-duration-input>');
        const [outline, underline, ghost] = [...page.querySelectorAll<GeDurationInput>('ge-duration-input')];
        await Promise.all([outline!.updateComplete, underline!.updateComplete, ghost!.updateComplete]);
        const box = (el: GeDurationInput) => getComputedStyle(el.shadowRoot!.querySelector('fieldset')!);
        expect(box(outline!).display).toBe('inline-flex');
        expect(box(outline!).borderTopWidth).toBe('1px');
        expect(Number.parseFloat(box(outline!).height)).toBeGreaterThanOrEqual(36);
        expect(box(underline!).borderTopWidth).toBe('0px');
        expect(box(underline!).borderBottomWidth).toBe('1px');
        expect(box(ghost!).borderBottomWidth).toBe('0px');
        await userEvent.click(seg(outline!, 'hours'));
        await new Promise((r) => setTimeout(r, 250));
        expect(box(outline!).boxShadow).not.toBe('none');
    });

    it('passes an axe check in both themes', async () => {
        const page = await mount('<ge-duration-input value="3725" units="hours,minutes,seconds"></ge-duration-input>');
        for (const theme of ['light', 'dark'] as const) {
            useTheme(theme);
            const result = await axe.run(page);
            expect(result.violations).toEqual([]);
        }
        useTheme('light');
    });
});
