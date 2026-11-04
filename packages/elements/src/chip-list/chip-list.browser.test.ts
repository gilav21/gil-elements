import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeChipList } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const list = async (attrs = '', value: string[] = ['Angular', 'React']) => {
    const page = await mount(`<form><ge-chip-list ${attrs}></ge-chip-list></form>`);
    const el = page.querySelector<GeChipList>('ge-chip-list')!;
    el.value = value;
    await settle(page);
    return { page, el, form: page.querySelector('form')! };
};
const texts = (el: GeChipList) => [...el.shadowRoot!.querySelectorAll('.chip-text')].map((c) => c.textContent!.trim());
const type = async (page: HTMLElement, el: GeChipList, keys: string) => {
    el.focus();
    await userEvent.keyboard(keys);
    await settle(page);
};
const record = (el: GeChipList) => {
    const log: string[] = [];
    for (const name of ['chip-added', 'chip-removed', 'value-change']) {
        el.addEventListener(name, (e) => log.push(`${name}:${JSON.stringify((e as CustomEvent).detail)}`));
    }
    return log;
};

const emulateTouch = (enabled: boolean) => cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });

describe('ge-chip-list', () => {
    afterEach(() => emulateTouch(false));

    it('keeps the chip height on touch but widens the remove tap target to 44px', async () => {
        const { page, el } = await list();
        const geometry = async (touch: boolean) => {
            await emulateTouch(touch);
            await settle(page);
            const chip = el.shadowRoot!.querySelector('.chip')!.getBoundingClientRect();
            const remove = el.shadowRoot!.querySelector('.remove')!.getBoundingClientRect();
            const probe = el.shadowRoot!.elementFromPoint(remove.left + remove.width / 2 + 20, remove.top + remove.height / 2);
            return { chipHeight: chip.height, removeSize: [remove.width, remove.height], hitsRemove: probe?.closest('.remove') != null };
        };
        const fine = await geometry(false);
        const coarse = await geometry(true);
        expect(coarse.chipHeight).toBe(fine.chipHeight);
        expect(coarse.removeSize).toEqual(fine.removeSize);
        expect(fine.hitsRemove).toBe(false);
        expect(coarse.hitsRemove).toBe(true);
    });

    it('commits trimmed text on Enter, announces it, and keeps the field empty', async () => {
        const { page, el } = await list();
        const log = record(el);
        await type(page, el, '  Vue {Enter}');
        expect(texts(el)).toEqual(['Angular', 'React', 'Vue']);
        expect(log).toEqual(['chip-added:"Vue"', 'value-change:["Angular","React","Vue"]']);
        expect((el.shadowRoot!.querySelector('ge-input') as HTMLInputElement).value).toBe('');
    });

    it('ignores a blank commit', async () => {
        const { page, el } = await list();
        const log = record(el);
        await type(page, el, '   {Enter}{Enter}');
        expect(texts(el)).toEqual(['Angular', 'React']);
        expect(log).toEqual([]);
    });

    it('commits on a separator key only when one is configured', async () => {
        const { page, el } = await list('', []);
        await type(page, el, 'a,');
        expect(texts(el)).toEqual([]);
        el.separatorKeys = [',', ' '];
        await type(page, el, '{Backspace}x,y ');
        expect(texts(el)).toEqual(['ax', 'y']);
    });

    it('drops a repeat unless allow-duplicates is set', async () => {
        const { page, el } = await list();
        const log = record(el);
        await type(page, el, 'React{Enter}');
        expect(texts(el)).toEqual(['Angular', 'React']);
        expect(log).toEqual([]);
        expect((el.shadowRoot!.querySelector('ge-input') as HTMLInputElement).value).toBe('');
        el.allowDuplicates = true;
        await type(page, el, 'React{Enter}');
        expect(texts(el)).toEqual(['Angular', 'React', 'React']);
    });

    it('removes the last chip on Backspace only from an empty field', async () => {
        const { page, el } = await list();
        const log = record(el);
        await type(page, el, 'ab{Backspace}{Backspace}');
        expect(texts(el)).toEqual(['Angular', 'React']);
        await type(page, el, '{Backspace}');
        expect(texts(el)).toEqual(['Angular']);
        expect(log).toEqual(['chip-removed:"React"', 'value-change:["Angular"]']);
    });

    it('removes a chip with its button and hands focus back to the field', async () => {
        const { page, el } = await list();
        const remove = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-slot="chip-remove"]')[0]!;
        expect(remove.getAttribute('aria-label')).toBe('Remove Angular');
        await userEvent.click(remove);
        await settle(page);
        expect(texts(el)).toEqual(['React']);
        expect(el.shadowRoot!.querySelector('ge-input')!.matches(':focus-within')).toBe(true);
    });

    it('does not commit while an IME owns the key', async () => {
        const { page, el } = await list('', []);
        el.draft = 'かな';
        await settle(page);
        const field = el.shadowRoot!.querySelector('ge-input')!;
        for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
            field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init }));
        }
        await settle(page);
        expect(texts(el)).toEqual([]);
        await type(page, el, '{Enter}');
        expect(texts(el)).toEqual(['かな']);
    });

    it('has no remove buttons and a disabled field when disabled, or inside a disabled fieldset', async () => {
        const { el } = await list('disabled');
        expect(el.shadowRoot!.querySelectorAll('[data-slot="chip-remove"]')).toHaveLength(0);
        expect(el.shadowRoot!.querySelector('ge-input')!.hasAttribute('disabled')).toBe(true);

        const page = await mount('<fieldset disabled><ge-chip-list></ge-chip-list></fieldset>');
        const inFieldset = page.querySelector<GeChipList>('ge-chip-list')!;
        inFieldset.value = ['Angular'];
        await settle(page);
        expect(inFieldset.shadowRoot!.querySelectorAll('[data-slot="chip-remove"]')).toHaveLength(0);
    });

    it('caps the box at max-rows rows and scrolls to the field after an add', async () => {
        const many = Array.from({ length: 30 }, (_, i) => `Chip ${i}`);
        const { page, el } = await list('max-rows="2" style="display:block;width:16rem"', many);
        const box = el.shadowRoot!.querySelector<HTMLElement>('.chips')!;
        const chipHeight = el.shadowRoot!.querySelector('.chip')!.getBoundingClientRect().height;
        expect(box.getBoundingClientRect().height).toBeLessThan(chipHeight * 3);
        expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);
        await type(page, el, 'Last{Enter}');
        expect(box.scrollTop).toBeGreaterThan(0);
    });

    it('picks a readable foreground for a coloured chip', async () => {
        const { el } = await list('', ['Light', 'Dark', 'Plain']);
        el.chipColors = { Light: '#fde68a', Dark: '#1e3a8a' };
        await el.updateComplete;
        const [light, dark, plain] = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.chip')];
        expect(light!.style.color).toBe('rgb(0, 0, 0)');
        expect(light!.style.backgroundColor).toBe('rgb(253, 230, 138)');
        expect(dark!.style.color).toBe('rgb(255, 255, 255)');
        expect(plain!.getAttribute('style') ?? '').toBe('');
    });

    it('submits one entry per chip and restores them on form reset', async () => {
        const { page, el, form } = await list('name="skills"', ['Angular', 'React']);
        expect(new FormData(form).getAll('skills')).toEqual(['Angular', 'React']);
        await type(page, el, 'Vue{Enter}');
        expect(new FormData(form).getAll('skills')).toEqual(['Angular', 'React', 'Vue']);
        form.reset();
        await settle(page);
        expect(texts(el)).toEqual([]);
        expect(new FormData(form).getAll('skills')).toEqual([]);
    });

    for (const theme of ['light', 'dark'] as const) {
        it(`has no axe violations in ${theme}`, async () => {
            useTheme(theme);
            const { el } = await list('badge-variant="secondary"', ['Angular', 'React']);
            el.chipColors = { React: '#1e3a8a' };
            await el.updateComplete;
            const result = await axe.run(el, { rules: { region: { enabled: false } } });
            expect(result.violations.map((v) => v.id)).toEqual([]);
        });
    }
});
