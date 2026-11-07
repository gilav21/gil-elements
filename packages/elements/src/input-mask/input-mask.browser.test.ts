import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../input/define.js';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeInput } from '../input/input.js';
import type { GeInputMask } from './input-mask.js';

const PHONE = '(000) 000-0000';

async function masked(attrs: string, field = '<ge-input name="phone"></ge-input>'): Promise<{ page: HTMLElement; mask: GeInputMask; field: GeInput | HTMLInputElement }> {
    const page = await mount(`<form><ge-input-mask ${attrs}>${field}</ge-input-mask></form>`);
    const mask = page.querySelector('ge-input-mask')!;
    const el = page.querySelector<GeInput | HTMLInputElement>('ge-input, input')!;
    if ('updateComplete' in el) await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { page, mask, field: el };
}
const inner = (el: GeInput | HTMLInputElement) => ('inner' in el ? el.inner! : el);
const type = async (el: GeInput | HTMLInputElement, text: string) => {
    inner(el).focus();
    await userEvent.keyboard(text);
};
const shown = (el: GeInput | HTMLInputElement) => inner(el).value;

describe('ge-input-mask', () => {
    it('formats digits into the mask as they are typed, and the masked text is the input\'s value and form value', async () => {
        const { page, field } = await masked(`mask="${PHONE}"`);
        await type(field, '555');
        expect(shown(field)).toBe('(555) ');
        await type(field, '1234567');

        expect(shown(field)).toBe('(555) 123-4567');
        expect((field as GeInput).value).toBe('(555) 123-4567');
        expect(new FormData(page.querySelector('form')!).get('phone')).toBe('(555) 123-4567');
    });

    it('drops characters the slot does not take, and anything beyond the end of the mask', async () => {
        const { field } = await masked(`mask="${PHONE}"`);
        await type(field, 'a5b5c5-1 2.3 4567899');

        expect(shown(field)).toBe('(555) 123-4567');
    });

    it('reformats pasted text whatever punctuation it carries', async () => {
        const { field } = await masked(`mask="${PHONE}"`);
        inner(field).value = '555.123.4567';
        inner(field).dispatchEvent(new Event('input', { bubbles: true, composed: true }));

        expect(shown(field)).toBe('(555) 123-4567');
        expect((field as GeInput).value).toBe('(555) 123-4567');
    });

    it('takes digits for 0 and 9, letters for a, and either for *, keeping other characters as literals', async () => {
        const { field } = await masked('mask="aa-99-**-A"');
        await type(field, '1Qb12Z7');

        expect(shown(field)).toBe('Qb-12-Z7-A');
    });

    it('shows the whole mask while typing when asked, with the slot character for what is missing', async () => {
        const { field } = await masked(`mask="${PHONE}" show-mask-typed`);
        await type(field, '123');
        expect(shown(field)).toBe('(123) ___-____');

        const custom = await masked(`mask="99/99" show-mask-typed slot-char="#"`);
        await type(custom.field, '1');
        expect(shown(custom.field)).toBe('1#/##');

        const bare = await masked(`mask="99/99" show-mask-typed slot-char=""`);
        await type(bare.field, '12');
        expect(shown(bare.field)).toBe('12/');

        const dashes = await masked('mask="9-9-9" show-mask-typed slot-char=""');
        await type(dashes.field, '1');
        expect(shown(dashes.field)).toBe('1-');
    });

    it('keeps the caret after what was just typed, also when editing in the middle', async () => {
        const { field } = await masked(`mask="${PHONE}"`);
        await type(field, '5551234567');
        const input = inner(field);
        input.setSelectionRange(5, 5);
        await userEvent.keyboard('9');

        expect(shown(field)).toBe('(555) 912-3456');
        expect(input.selectionStart).toBe(7);

        input.setSelectionRange(11, 11);
        await userEvent.keyboard('{Backspace}');
        expect(shown(field)).toBe('(555) 912-456');
        expect(input.selectionStart).toBe(10);
    });

    it('formats a value that is already there, and again when the mask changes', async () => {
        const { mask, field } = await masked(`mask="${PHONE}"`, '<ge-input value="5551234567"></ge-input>');
        expect(shown(field)).toBe('(555) 123-4567');

        mask.mask = '000-000-0000';
        await mask.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(shown(field)).toBe('555-123-4567');
    });

    it('works on a native input too', async () => {
        const { field } = await masked('mask="99/99/9999"', '<input name="born">');
        await type(field, '31121999');

        expect((field as HTMLInputElement).value).toBe('31/12/1999');
    });

    it('lets go of the input when it is removed', async () => {
        const { mask, field } = await masked(`mask="${PHONE}"`);
        const input = inner(field);
        mask.remove();
        input.value = '5';
        input.dispatchEvent(new Event('input'));

        expect(input.value).toBe('5');
    });
});
