import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GePhoneInput } from './phone-input.js';
import { buildE164, parseE164 } from './phone-input.js';
import { DEFAULT_COUNTRIES } from './phone-input.data.js';

const settle = async (el: GePhoneInput) => {
    for (let round = 0; round < 3; round++) {
        await el.updateComplete;
        for (const part of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await part.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
};
const phone = async (attrs = '', after = '') => {
    const page = await mount(`<form><ge-phone-input ${attrs}></ge-phone-input></form>${after}`);
    const el = page.querySelector<GePhoneInput>('ge-phone-input')!;
    await settle(el);
    return { page, el };
};
const field = (el: GePhoneInput) => el.shadowRoot!.querySelector('ge-input-group-input')!.shadowRoot!.querySelector<HTMLInputElement>('input')!;
const trigger = (el: GePhoneInput) => el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!;
const rows = (el: GePhoneInput) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.row')];
const names = (el: GePhoneInput) => rows(el).map((row) => row.querySelector('.name')!.textContent);
const record = (el: Element) => {
    const events: string[] = [];
    for (const type of ['input', 'change', 'open-change']) el.addEventListener(type, () => events.push(type));
    return events;
};

describe('phone numbers as E.164', () => {
    it('builds E.164 from a dial code and whatever was typed, and splits one by the longest dial code, keeping the current country on a shared code', () => {
        const [us, ca, gb, fi] = ['US', 'CA', 'GB', 'FI'].map((code) => DEFAULT_COUNTRIES.find((c) => c.code === code)!);
        expect(buildE164('+1', '(555) 123-4567')).toBe('+15551234567');
        expect(buildE164('+44', '')).toBe('');
        expect(parseE164('+442071234567', DEFAULT_COUNTRIES, us!)).toEqual({ country: gb, national: '2071234567' });
        expect(parseE164('+3584012345678', DEFAULT_COUNTRIES, us!)).toEqual({ country: fi, national: '4012345678' });
        expect(parseE164('+15551234567', DEFAULT_COUNTRIES, ca!)).toEqual({ country: ca, national: '5551234567' });
        expect(parseE164('5551234567', DEFAULT_COUNTRIES, gb!)).toEqual({ country: gb, national: '5551234567' });
        const shared = [{ ...us!, code: 'US' }, { ...us!, code: 'BS', dialCode: '+1242' }];
        expect(parseE164('+12425551234', shared, us!).country.code).toBe('BS');
        expect(parseE164('+12425551234', shared.reverse(), us!).country.code).toBe('BS');
        expect(parseE164('+9999', DEFAULT_COUNTRIES, gb!)).toEqual({ country: gb, national: '+9999' });
    });
});

describe('ge-phone-input', () => {
    it('shows the default country with its flag and dial code, and its example number as the placeholder', async () => {
        const { el } = await phone();
        expect(trigger(el).textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('🇺🇸 +1');
        expect(field(el).placeholder).toBe('(555) 000-0000');
        expect(field(el).type).toBe('tel');

        const gb = await phone('default-country="GB" placeholder="your number"');
        expect(trigger(gb.el).textContent).toContain('+44');
        expect(field(gb.el).placeholder).toBe('your number');
        const unknown = await phone('default-country="XX"');
        expect(trigger(unknown.el).textContent).toContain('+1');
    });

    it('masks what is typed to the country format, and publishes the E.164 value on each edit', async () => {
        const { el } = await phone('', '<button>next</button>');
        const events = record(el);
        await userEvent.click(field(el));
        await userEvent.keyboard('5551234567xyz89');
        expect(field(el).value).toBe('(555) 123-4567');
        expect(el.value).toBe('+15551234567');
        expect(el.nationalNumber).toBe('5551234567');
        expect(events.filter((e) => e === 'input').length).toBeGreaterThanOrEqual(10);
        expect(events.includes('change')).toBe(false);
        await userEvent.click(document.querySelector('button')!);
        expect(events.filter((e) => e === 'change')).toHaveLength(1);
    });

    it('reads an E.164 value set from outside: it picks the country by dial code and shows the national part masked', async () => {
        const { el } = await phone('value="+442071234567"');
        expect(el.selectedCountry.code).toBe('GB');
        expect(trigger(el).textContent).toContain('+44');
        expect(field(el).value).toBe('2071 234567');
        expect(el.value).toBe('+442071234567');

        el.value = '+33612345678';
        await settle(el);
        expect(el.selectedCountry.code).toBe('FR');
        expect(field(el).value).toBe('61 23 45 67 8');
        el.value = '';
        await settle(el);
        expect(field(el).value).toBe('');
        expect(el.selectedCountry.code).toBe('FR');
    });

    it('opens a searchable list of countries, filters by name or dial code, and says so when nothing matches', async () => {
        const { el } = await phone();
        await userEvent.click(trigger(el));
        await settle(el);
        expect(el.open).toBe(true);
        expect(rows(el)).toHaveLength(DEFAULT_COUNTRIES.length);
        expect(rows(el)[0]!.classList.contains('selected')).toBe(true);
        expect(rows(el)[0]!.textContent!.replaceAll(/\s+/g, ' ').trim()).toBe('🇺🇸 United States +1');

        const search = el.shadowRoot!.querySelector<HTMLInputElement>('.search input')!;
        expect(search.placeholder).toBe('Search country...');
        await userEvent.fill(search, 'ger');
        await settle(el);
        expect(names(el)).toEqual(['Germany', 'Nigeria']);
        await userEvent.fill(search, '+35');
        await settle(el);
        expect(names(el)).toEqual(['Portugal', 'Finland', 'Ireland']);
        await userEvent.fill(search, 'zzz');
        await settle(el);
        expect(rows(el)).toHaveLength(0);
        expect(el.shadowRoot!.querySelector('.empty')!.textContent).toBe('No countries found');
    });

    it('picking a country switches the mask, clears the number, closes the list and sticks over a later default-country', async () => {
        const { el } = await phone('', '<button>next</button>');
        const events = record(el);
        await userEvent.click(field(el));
        await userEvent.keyboard('5551234567');
        await userEvent.click(trigger(el));
        await settle(el);
        rows(el).find((row) => row.textContent!.includes('Japan'))!.click();
        await settle(el);

        expect(el.selectedCountry.code).toBe('JP');
        expect(el.open).toBe(false);
        expect(field(el).value).toBe('');
        expect(field(el).placeholder).toBe('090-1234-5678');
        expect(el.value).toBe('');
        expect(events.at(-1)).toBe('open-change');
        expect(events.includes('change')).toBe(true);

        await userEvent.click(field(el));
        await userEvent.keyboard('9012345678');
        expect(field(el).value).toBe('901-2345-678');
        expect(el.value).toBe('+819012345678');

        el.defaultCountry = 'DE';
        await settle(el);
        expect(el.selectedCountry.code).toBe('JP');
    });

    it('lets default-country and countries change until the user has picked, and takes a custom list', async () => {
        const { el } = await phone();
        el.defaultCountry = 'FR';
        await settle(el);
        expect(el.selectedCountry.code).toBe('FR');
        el.countries = [{ code: 'XX', name: 'Examplestan', flag: '🏳️', dialCode: '+999', mask: '000-000', placeholder: '123-456' }];
        await settle(el);
        expect(el.selectedCountry.code).toBe('XX');
        expect(field(el).placeholder).toBe('123-456');
        await userEvent.click(field(el));
        await userEvent.keyboard('123456');
        expect(el.value).toBe('+999123456');

        // Typing digits that happen to extend the dial code into another country's must not switch country under the user.
        const us = DEFAULT_COUNTRIES[0]!;
        el.countries = [us, { ...us, code: 'BS', name: 'Bahamas', dialCode: '+1242' }];
        el.defaultCountry = 'US';
        el.value = '';
        await settle(el);
        await userEvent.click(field(el));
        await userEvent.keyboard('2425551234');
        expect(el.selectedCountry.code).toBe('US');
        expect(el.value).toBe('+12425551234');
    });

    it('takes part in a form by name, resets, and follows disabled', async () => {
        const { page, el } = await phone('name="tel" value="+15551234567"');
        const form = page.querySelector('form')!;
        expect(new FormData(form).get('tel')).toBe('+15551234567');
        await userEvent.fill(field(el), '');
        await settle(el);
        expect(new FormData(form).get('tel')).toBe('');
        form.reset();
        await settle(el);
        expect(el.value).toBe('+15551234567');

        el.disabled = true;
        await settle(el);
        expect(trigger(el).disabled).toBe(true);
        expect(field(el).disabled).toBe(true);
        el.show();
        expect(el.open).toBe(false);
        const locked = await mount('<fieldset disabled><ge-phone-input></ge-phone-input></fieldset>');
        const inner = locked.querySelector<GePhoneInput>('ge-phone-input')!;
        await settle(inner);
        expect(field(inner).disabled).toBe(true);
    });

    it('is worded and laid out in the chosen locale, right to left for Hebrew', async () => {
        const { el } = await phone('locale="he"');
        expect(el.shadowRoot!.querySelector('ge-input-group')!.getAttribute('dir')).toBe('rtl');
        await userEvent.click(trigger(el));
        await settle(el);
        expect(el.shadowRoot!.querySelector<HTMLInputElement>('.search input')!.placeholder).toBe('...חיפוש מדינה');
        const de = await phone('locale="de"');
        await userEvent.click(trigger(de.el));
        await settle(de.el);
        expect(de.el.shadowRoot!.querySelector<HTMLInputElement>('.search input')!.placeholder).toBe('Land suchen...');
    });

    it('passes an axe check in both themes, with the list open', async () => {
        const { el } = await phone();
        await userEvent.click(trigger(el));
        await settle(el);
        for (const theme of ['light', 'dark'] as const) {
            useTheme(theme);
            // Colours transition over 150ms; measured mid-way they blend the two themes.
            await new Promise((resolve) => setTimeout(resolve, 300));
            const result = await axe.run(el);
            expect(result.violations).toEqual([]);
        }
        useTheme('light');
    });
});
