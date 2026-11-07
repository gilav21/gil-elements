import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCurrencyInput } from './currency-input.js';
import { formatCurrency } from './currency-input.format.js';

const first = (page: HTMLElement) => page.querySelector<GeCurrencyInput>('ge-currency-input')!;
const inner = (el: GeCurrencyInput) => el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
const record = (el: Element) => {
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    return events;
};
const settle = (el: GeCurrencyInput) => el.updateComplete;

describe('ge-currency-input', () => {
    it('shows the amount formatted for its locale and currency at rest, and the plain editable number while focused', async () => {
        const page = await mount('<ge-currency-input value="12345.6" locale="en-US"></ge-currency-input><ge-currency-input value="12345.6" locale="de-DE" currency="EUR"></ge-currency-input><ge-currency-input value="12345.6" locale="ja-JP" currency="JPY"></ge-currency-input><button>next</button>');
        const [us, de, jp] = [...page.querySelectorAll<GeCurrencyInput>('ge-currency-input')];
        await Promise.all([us!.updateComplete, de!.updateComplete, jp!.updateComplete]);

        expect(inner(us!).value).toBe('$12,345.60');
        expect(inner(de!).value).toBe('12.345,60 €');
        expect(inner(jp!).value).toMatch(/^[￥¥]12,346$/);
        expect(inner(us!).getAttribute('inputmode')).toBe('decimal');
        expect(inner(us!).lang).toBe('en-US');

        await userEvent.click(inner(de!));
        await settle(de!);
        expect(inner(de!).value).toBe('12345,6');
        await userEvent.click(page.querySelector('button')!);
        await settle(de!);
        expect(inner(de!).value).toBe('12.345,60 €');
    });

    it('takes what is typed in the locale, keeps a half-typed decimal, and rounds to the currency scale only on blur', async () => {
        const page = await mount('<ge-currency-input locale="de-DE" currency="EUR" placeholder="0,00"></ge-currency-input><button>next</button>');
        const field = first(page);
        const events = record(field);
        expect(inner(field).value).toBe('');
        expect(inner(field).placeholder).toBe('0,00');

        await userEvent.click(inner(field));
        await userEvent.keyboard('12,');
        expect(field.value).toBe(12);
        expect(inner(field).value).toBe('12,');
        await userEvent.keyboard('345');
        expect(field.value).toBe(12.345);
        expect(inner(field).value).toBe('12,345');
        expect(events).toEqual(new Array(6).fill('input'));

        await userEvent.click(page.querySelector('button')!);
        await settle(field);
        expect(field.value).toBe(12.35);
        expect(inner(field).value).toBe('12,35 €');
        expect(events.at(-2)).toBe('input');
        expect(events.at(-1)).toBe('change');
        expect(field.minorUnits).toBe(1235);
        expect(field.scale).toBe(2);
    });

    it('writes in the page language when it has no locale of its own', async () => {
        document.documentElement.lang = 'de';
        try {
            const page = await mount('<ge-currency-input value="1234.5" currency="EUR"></ge-currency-input>');
            await first(page).updateComplete;
            expect(inner(first(page)).value).toBe('1.234,50\u00a0€');
        } finally {
            document.documentElement.lang = '';
        }
    });

    it('reads a pasted formatted amount, including Arabic-Indic digits, and treats unreadable text as empty', async () => {
        const page = await mount('<ge-currency-input locale="ar-EG" currency="EGP"></ge-currency-input><ge-currency-input locale="en-US"></ge-currency-input><button>next</button>');
        const [arabic, us] = [...page.querySelectorAll<GeCurrencyInput>('ge-currency-input')];

        await userEvent.click(inner(arabic!));
        await userEvent.fill(inner(arabic!), formatCurrency(12345.6, 'ar-EG', 'EGP'));
        expect(arabic!.value).toBe(12345.6);

        await userEvent.click(inner(us!));
        await userEvent.fill(inner(us!), '$1,234.50');
        expect(us!.value).toBe(1234.5);
        await userEvent.clear(inner(us!));
        expect(us!.value).toBeNull();
        await userEvent.keyboard('1.2.3');
        expect(us!.value).toBeNull();
    });

    it('clamps to min and max on blur, never while typing', async () => {
        const page = await mount('<ge-currency-input min="10" max="100" locale="en-US"></ge-currency-input><button>next</button>');
        const field = first(page);
        const events = record(field);
        await userEvent.click(inner(field));
        await userEvent.keyboard('500');
        expect(field.value).toBe(500);
        await userEvent.click(page.querySelector('button')!);
        expect(field.value).toBe(100);
        expect(events.at(-1)).toBe('change');

        await userEvent.click(inner(field));
        await userEvent.clear(inner(field));
        await userEvent.keyboard('2');
        expect(field.value).toBe(2);
        await userEvent.click(page.querySelector('button')!);
        expect(field.value).toBe(10);
    });

    it('does not announce a change when editing ends where it began, and keeps a typed value over a programmatic write', async () => {
        const page = await mount('<ge-currency-input value="5" locale="en-US"></ge-currency-input><button>next</button>');
        const field = first(page);
        const events = record(field);
        await userEvent.click(inner(field));
        await userEvent.click(page.querySelector('button')!);
        expect(events).toEqual([]);

        await userEvent.click(inner(field));
        await userEvent.keyboard('{End}7');
        field.value = 99;
        await settle(field);
        expect(inner(field).value).toBe('57');
        await userEvent.click(page.querySelector('button')!);
        expect(field.value).toBe(99);
        expect(inner(field).value).toBe('$99.00');
    });

    it('takes part in a form by name, resets to its first value, and follows disabled', async () => {
        const page = await mount('<form><ge-currency-input name="price" value="3.5" locale="en-US"></ge-currency-input></form>');
        const field = first(page);
        const form = page.querySelector('form')!;
        expect(new FormData(form).get('price')).toBe('3.5');
        field.value = null;
        await settle(field);
        expect(new FormData(form).get('price')).toBe('');
        form.reset();
        await settle(field);
        expect(field.value).toBe(3.5);

        field.disabled = true;
        await settle(field);
        expect(inner(field).disabled).toBe(true);
        expect(getComputedStyle(field.shadowRoot!.querySelector('.wrap')!).opacity).toBe('0.5');
        const fieldset = await mount('<fieldset disabled><ge-currency-input></ge-currency-input></fieldset>');
        expect(inner(first(fieldset)).disabled).toBe(true);
    });

    it('draws the same outlined box as the number input, or only an underline', async () => {
        const page = await mount('<ge-currency-input></ge-currency-input><ge-currency-input variant="underline"></ge-currency-input>');
        const [outline, underline] = [...page.querySelectorAll<GeCurrencyInput>('ge-currency-input')];
        const box = (el: GeCurrencyInput) => getComputedStyle(el.shadowRoot!.querySelector('.wrap')!);
        await Promise.all([outline!.updateComplete, underline!.updateComplete]);
        expect(box(outline!).borderTopWidth).toBe('1px');
        expect(box(outline!).height).toBe('36px');
        expect(box(underline!).borderTopWidth).toBe('0px');
        expect(box(underline!).borderBottomWidth).toBe('1px');
    });

    it('has an accessible name, and passes an axe check in both themes', async () => {
        const page = await mount('<ge-currency-input value="12"></ge-currency-input><label id="l">Price</label><ge-currency-input id="b" aria-labelledby="l"></ge-currency-input>');
        const [plain, labelled] = [...page.querySelectorAll<GeCurrencyInput>('ge-currency-input')];
        await Promise.all([plain!.updateComplete, labelled!.updateComplete]);
        expect(inner(plain!).getAttribute('aria-label')).toBe('Amount');
        expect(inner(labelled!).ariaLabelledByElements?.[0]?.id).toBe('l');
        for (const theme of ['light', 'dark'] as const) {
            useTheme(theme);
            const result = await axe.run(page);
            expect(result.violations).toEqual([]);
        }
        useTheme('light');
    });
});
