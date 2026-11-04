import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeInputOtp } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const otp = async (attrs = '') => {
    const page = await mount(`<form><ge-input-otp ${attrs}></ge-input-otp></form>`);
    const el = page.querySelector<GeInputOtp>('ge-input-otp')!;
    await settle(page);
    return { page, el, form: page.querySelector('form')! };
};
const field = (el: GeInputOtp) => el.shadowRoot!.querySelector<HTMLInputElement>('.field')!;
const chars = (el: GeInputOtp) => [...el.shadowRoot!.querySelectorAll('.char')].map((c) => c.textContent);
const active = (el: GeInputOtp) => [...el.shadowRoot!.querySelectorAll('.slot')].findIndex((s) => s.classList.contains('active'));
const keys = async (page: HTMLElement, text: string) => {
    await userEvent.keyboard(text);
    await settle(page);
};
const record = (el: GeInputOtp) => {
    const log: string[] = [];
    el.addEventListener('value-change', (e) => log.push((e as CustomEvent<string>).detail));
    return log;
};

describe('ge-input-otp', () => {
    it('strips what is typed to upper-case letters and digits and announces each edit', async () => {
        const { page, el } = await otp();
        const log = record(el);
        el.focus();
        await keys(page, 'a-1!b');
        expect(el.value).toBe('A1B');
        expect(chars(el)).toEqual(['A', '1', 'B', '', '', '']);
        expect(log).toEqual(['A', 'A1', 'A1B']);
        expect(active(el)).toBe(3);
    });

    it('stops at max-length: typing on a full code replaces the last slot', async () => {
        const { page, el } = await otp('max-length="4" separator=""');
        el.focus();
        await keys(page, '12345678');
        expect(el.value).toBe('1238');
        expect(el.shadowRoot!.querySelectorAll('.slot')).toHaveLength(4);
        expect(active(el)).toBe(3);
    });

    it('moves the highlight with the arrows, Home and End, and a typed character replaces the highlighted slot', async () => {
        const { page, el } = await otp('value="1234"');
        el.focus();
        await settle(page);
        expect(active(el)).toBe(4);
        await keys(page, '{ArrowLeft}{ArrowLeft}');
        expect(active(el)).toBe(2);
        await keys(page, '9');
        expect(el.value).toBe('1294');
        expect(active(el)).toBe(3);
        await keys(page, '{Home}');
        expect(active(el)).toBe(0);
        await keys(page, '{End}');
        expect(active(el)).toBe(4);
        await keys(page, '{ArrowRight}{ArrowRight}');
        expect(active(el)).toBe(4);
    });

    it('Backspace removes the last character and keeps the highlight on the freed slot', async () => {
        const { page, el } = await otp('value="123"');
        el.focus();
        await keys(page, '{Backspace}');
        expect(el.value).toBe('12');
        expect(active(el)).toBe(2);
    });

    it('does not delete a selected slot when a rejected character is typed over it', async () => {
        const { page, el } = await otp('value="123"');
        el.focus();
        await keys(page, '{ArrowLeft}');
        expect(active(el)).toBe(2);
        await keys(page, '!');
        expect(el.value).toBe('123');
        expect(active(el)).toBe(2);
    });

    it('leaves the field alone while an IME composition is open and when a chord is held', async () => {
        const { page, el } = await otp('value="12"');
        el.focus();
        field(el).value = 'x9';
        field(el).dispatchEvent(new InputEvent('input', { isComposing: true, inputType: 'insertCompositionText', data: 'x9', bubbles: true }));
        expect(el.value).toBe('12');
        field(el).value = '12';
        await settle(page);
        const before = active(el);
        expect(before).toBe(2);
        const chord = new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true, bubbles: true, cancelable: true });
        field(el).dispatchEvent(chord);
        await settle(page);
        expect(chord.defaultPrevented).toBe(false);
        expect(active(el)).toBe(before);
    });

    it('a paste replaces the whole code, sanitised and cut to length', async () => {
        const { page, el } = await otp('value="12"');
        el.focus();
        const data = new DataTransfer();
        data.setData('text', ' ab-cd 12 345 ');
        field(el).dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
        await settle(page);
        expect(el.value).toBe('ABCD12');
        expect(active(el)).toBe(5);
    });

    it('a paste of the code already there changes nothing and is not announced', async () => {
        const { page, el } = await otp('value="123456"');
        const log = record(el);
        el.focus();
        const data = new DataTransfer();
        data.setData('text', '123456');
        const paste = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
        field(el).dispatchEvent(paste);
        await settle(page);
        expect(paste.defaultPrevented).toBe(true);
        expect(log).toEqual([]);
    });

    it('clicking a slot focuses the field with the highlight on that slot, clamped to the end of the code', async () => {
        const { page, el } = await otp('value="12"');
        const slots = el.shadowRoot!.querySelectorAll<HTMLElement>('.slot');
        await userEvent.click(slots[0]!);
        await settle(page);
        expect(active(el)).toBe(0);
        await userEvent.click(slots[5]!);
        await settle(page);
        expect(active(el)).toBe(2);
    });

    it('follows a value set from outside while focused', async () => {
        const { page, el } = await otp('value="123"');
        el.focus();
        el.value = 'AB';
        await settle(page);
        expect(field(el).value).toBe('AB');
        expect(active(el)).toBe(2);
    });

    it('drops the highlight when disabled while focused, and rounds the corners beside a separator', async () => {
        const { page, el } = await otp('value="123"');
        el.focus();
        await settle(page);
        expect(active(el)).toBe(3);
        el.disabled = true;
        await settle(page);
        expect(active(el)).toBe(-1);

        const radii = [...el.shadowRoot!.querySelectorAll('.slot')].map((s) => getComputedStyle(s).borderTopLeftRadius !== '0px');
        expect(radii).toEqual([true, false, false, true, false, false]);
    });

    it('draws a dot after each separator index only', async () => {
        const { el } = await otp('max-length="8" separator="1,5"');
        const row = [...el.shadowRoot!.querySelector('.row')!.children].map((c) => c.className.split(' ')[0]);
        expect(row.filter((c) => c === 'separator')).toHaveLength(2);
        expect(row.indexOf('separator')).toBe(2);
        expect(row.lastIndexOf('separator')).toBe(7);
    });

    it('submits under its name and restores the initial code on form reset', async () => {
        const { page, el, form } = await otp('name="code" value="12"');
        expect(new FormData(form).get('code')).toBe('12');
        el.focus();
        await keys(page, '34');
        expect(new FormData(form).get('code')).toBe('1234');
        form.reset();
        await settle(page);
        expect(el.value).toBe('12');
        expect(new FormData(form).get('code')).toBe('12');
    });

    it('is not focusable or clickable when disabled, also inside a disabled fieldset', async () => {
        const { page, el } = await otp('disabled value="12"');
        expect(field(el).disabled).toBe(true);
        await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>('.slot')!);
        await settle(page);
        expect(active(el)).toBe(-1);

        const holder = await mount('<fieldset disabled><ge-input-otp></ge-input-otp></fieldset>');
        await settle(holder);
        expect(field(holder.querySelector<GeInputOtp>('ge-input-otp')!).disabled).toBe(true);
    });

    it('names the field from the locale, or from aria-label', async () => {
        const { el } = await otp('locale="de"');
        expect(field(el).getAttribute('aria-label')).toBe('Einmalcode');
        const named = await otp('aria-label="Verification code"');
        expect(field(named.el).getAttribute('aria-label')).toBe('Verification code');
    });

    it('reads left to right inside an RTL page', async () => {
        const page = await mount('<div dir="rtl"><ge-input-otp value="123"></ge-input-otp></div>');
        await settle(page);
        const el = page.querySelector<GeInputOtp>('ge-input-otp')!;
        const [first, second] = [...el.shadowRoot!.querySelectorAll('.slot')].map((s) => s.getBoundingClientRect().left);
        expect(first!).toBeLessThan(second!);
    });

    for (const theme of ['light', 'dark'] as const) {
        it(`has no axe violations in ${theme}`, async () => {
            useTheme(theme);
            const { el } = await otp('value="123"');
            const result = await axe.run(el, { rules: { region: { enabled: false } } });
            expect(result.violations.map((v) => v.id)).toEqual([]);
        });
    }
});
