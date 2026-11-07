import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeAutocomplete } from './index.js';

const FRUIT = ['Apple', 'Apricot', 'Banana', 'Cherry', 'Fig (dried)'];
const PEOPLE = [
    { id: 7, name: 'Ada Lovelace' },
    { id: 9, name: 'Alan Turing' },
    { id: 12, name: 'Grace Hopper' },
];

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const box = async (markup: string, options: unknown[] = FRUIT, props: Partial<GeAutocomplete> = {}) => {
    const page = await mount(markup);
    const ac = page.querySelector<GeAutocomplete>('ge-autocomplete')!;
    ac.options = options;
    Object.assign(ac, props);
    await settle(page);
    return { page, ac };
};
const input = (ac: GeAutocomplete) => ac.shadowRoot!.querySelector<HTMLInputElement>('input')!;
const rows = (ac: GeAutocomplete) => [...ac.shadowRoot!.querySelectorAll<HTMLElement>('ge-command-item')];
const visible = (ac: GeAutocomplete) => rows(ac).filter((r) => !r.hidden).map((r) => r.textContent!.trim());
const chips = (ac: GeAutocomplete) => [...ac.shadowRoot!.querySelectorAll('ge-badge')].map((c) => c.textContent!.trim());
const press = async (page: HTMLElement, key: string) => {
    await userEvent.keyboard(key);
    await settle(page);
};

const emulateTouch = (enabled: boolean) => cdp().send('Emulation.setTouchEmulationEnabled', { enabled, maxTouchPoints: 1 });

describe('ge-autocomplete', () => {
    afterEach(() => emulateTouch(false));

    it('keeps the chip height on touch but widens the remove tap target to 44px', async () => {
        const { page, ac } = await box('<ge-autocomplete multiple></ge-autocomplete>', FRUIT, { value: ['Apple', 'Cherry'] });
        const geometry = async (touch: boolean) => {
            await emulateTouch(touch);
            await settle(page);
            const chip = ac.shadowRoot!.querySelector('ge-badge')!.getBoundingClientRect();
            const remove = ac.shadowRoot!.querySelector('.chip-remove')!.getBoundingClientRect();
            const probe = ac.shadowRoot!.elementFromPoint(remove.left + remove.width / 2 + 20, remove.top + remove.height / 2);
            return { chipHeight: chip.height, removeSize: [remove.width, remove.height], hitsRemove: probe?.closest('.chip-remove') != null };
        };
        const fine = await geometry(false);
        const coarse = await geometry(true);
        expect(coarse.chipHeight).toBe(fine.chipHeight);
        expect(coarse.removeSize).toEqual(fine.removeSize);
        expect(fine.hitsRemove).toBe(false);
        expect(coarse.hitsRemove).toBe(true);
    });

    it('opens on focus, filters as the user types and highlights what matched', async () => {
        const { page, ac } = await box('<div style="width:300px"><ge-autocomplete></ge-autocomplete></div>');
        const searches: string[] = [];
        ac.addEventListener('search-change', (e) => searches.push((e as CustomEvent<string>).detail));

        await userEvent.click(input(ac));
        await settle(page);
        expect(input(ac).getAttribute('aria-expanded')).toBe('true');
        expect(visible(ac)).toHaveLength(5);
        const panel = ac.shadowRoot!.querySelector('ge-popover-content')!.shadowRoot!.querySelector('.panel')!;
        const container = ac.shadowRoot!.querySelector('.container')!;
        expect(panel.getBoundingClientRect().width).toBeCloseTo(container.getBoundingClientRect().width, 0);

        await userEvent.type(input(ac), 'ap');
        await settle(page);
        expect(visible(ac)).toEqual(['Apple', 'Apricot']);
        expect([...rows(ac)[0]!.querySelectorAll('.hit')].map((h) => h.textContent)).toEqual(['Ap']);
        expect(searches).toEqual(['a', 'ap']);
    });

    it('matches what the user typed as text, so brackets and dots never break the list', async () => {
        const { page, ac } = await box('<ge-autocomplete></ge-autocomplete>');
        input(ac).focus();
        await userEvent.type(input(ac), '(dried');
        await settle(page);
        expect(visible(ac)).toEqual(['Fig (dried)']);
        expect(rows(ac)[4]!.querySelector('.hit')!.textContent).toBe('(dried');
    });

    it('says so when nothing matches, and no-filter keeps every option', async () => {
        const { page, ac } = await box('<ge-autocomplete></ge-autocomplete>');
        input(ac).focus();
        await userEvent.type(input(ac), 'zzz');
        await settle(page);
        const empty = ac.shadowRoot!.querySelector<HTMLElement>('ge-command-empty')!;
        expect(empty.hidden).toBe(false);
        expect(empty.textContent!.trim()).toBe('No results found.');

        ac.noFilter = true;
        await settle(page);
        expect(visible(ac)).toHaveLength(5);
        expect(empty.hidden).toBe(true);
    });

    it('picks with the arrow keys and Enter, closes, shows the label and submits it', async () => {
        const { page, ac } = await box('<form id="f"><ge-autocomplete name="fruit"></ge-autocomplete></form>');
        const picks: unknown[] = [];
        ac.addEventListener('value-change', (e) => picks.push((e as CustomEvent).detail));

        input(ac).focus();
        await settle(page);
        await press(page, '{ArrowDown}');
        await press(page, '{ArrowDown}');
        await press(page, '{Enter}');

        expect(picks).toEqual(['Apricot']);
        expect(ac.value).toBe('Apricot');
        expect(input(ac).getAttribute('aria-expanded')).toBe('false');
        expect(input(ac).value).toBe('Apricot');
        expect(new FormData(page.querySelector<HTMLFormElement>('#f')!).get('fruit')).toBe('Apricot');
    });

    it('closes on Escape and puts the picked label back over whatever was typed', async () => {
        const { page, ac } = await box('<ge-autocomplete></ge-autocomplete>', FRUIT, { value: 'Banana' });
        expect(input(ac).value).toBe('Banana');

        input(ac).focus();
        await settle(page);
        expect(input(ac).value).toBe('');
        await userEvent.type(input(ac), 'ch');
        await press(page, '{Escape}');

        expect(input(ac).getAttribute('aria-expanded')).toBe('false');
        expect(input(ac).value).toBe('Banana');
        expect(ac.searchTerm).toBe('');
    });

    it('names the highlighted option for assistive technology', async () => {
        const { page, ac } = await box('<ge-autocomplete></ge-autocomplete>');
        input(ac).focus();
        await settle(page);
        expect(input(ac).hasAttribute('aria-activedescendant')).toBe(false);
        await press(page, '{ArrowDown}');
        const id = input(ac).getAttribute('aria-activedescendant')!;
        expect(ac.shadowRoot!.getElementById(id)!.textContent!.trim()).toBe('Apple');
        expect(ac.shadowRoot!.getElementById(input(ac).getAttribute('aria-controls')!)!.localName).toBe('ge-command-list');

        await press(page, '{ArrowUp}');
        expect(ac.shadowRoot!.getElementById(input(ac).getAttribute('aria-activedescendant')!)!.textContent!.trim()).toBe('Fig (dried)');
    });

    it('multiple: toggles chips, stays open, clears the box, and Backspace removes the last chip', async () => {
        const { page, ac } = await box('<form id="f"><ge-autocomplete multiple name="fruit"></ge-autocomplete></form>');
        const picks: unknown[] = [];
        ac.addEventListener('value-change', (e) => picks.push((e as CustomEvent).detail));

        input(ac).focus();
        await settle(page);
        expect(input(ac).getAttribute('aria-expanded')).toBe('false');
        await userEvent.type(input(ac), 'an');
        await settle(page);
        await press(page, '{ArrowDown}');
        await press(page, '{Enter}');
        expect(chips(ac)[0]).toContain('Banana');
        expect(input(ac).value).toBe('');
        expect(input(ac).getAttribute('aria-expanded')).toBe('true');
        expect(ac.shadowRoot!.activeElement).toBe(input(ac));

        rows(ac)[0]!.click();
        await settle(page);
        expect(ac.value).toEqual(['Banana', 'Apple']);
        expect(new FormData(page.querySelector<HTMLFormElement>('#f')!).getAll('fruit')).toEqual(['Banana', 'Apple']);
        expect(rows(ac)[0]!.getAttribute('aria-selected')).toBe('true');

        rows(ac)[0]!.click();
        await settle(page);
        expect(ac.value).toEqual(['Banana']);

        await press(page, '{Backspace}');
        expect(ac.value).toEqual([]);
        expect(picks).toEqual([['Banana'], ['Banana', 'Apple'], ['Banana'], []]);
    });

    it('multiple: the chip x removes that chip only, and Backspace is ignored while text is typed', async () => {
        const { page, ac } = await box('<ge-autocomplete multiple></ge-autocomplete>', FRUIT, { value: ['Apple', 'Cherry'] });
        expect(chips(ac)).toHaveLength(2);
        expect(input(ac).value).toBe('');

        input(ac).focus();
        await userEvent.type(input(ac), 'b');
        await press(page, '{Backspace}');
        expect(ac.value).toEqual(['Apple', 'Cherry']);

        input(ac).blur();
        ac.shadowRoot!.querySelectorAll<HTMLButtonElement>('.chip-remove')[0]!.click();
        await settle(page);
        expect(ac.value).toEqual(['Cherry']);
        expect(chips(ac)).toHaveLength(1);
        expect(ac.shadowRoot!.activeElement).toBeNull();
    });

    it('works with objects: shows displayWith, compares and submits value-attribute, and reads a value set from outside', async () => {
        const { page, ac } = await box(
            '<form id="f"><ge-autocomplete name="who" value-attribute="id"></ge-autocomplete></form>',
            PEOPLE,
            { displayWith: (p) => (p as (typeof PEOPLE)[number]).name, value: { id: 9, name: 'Alan Turing' } },
        );
        expect(input(ac).value).toBe('Alan Turing');
        expect(new FormData(page.querySelector<HTMLFormElement>('#f')!).get('who')).toBe('9');

        input(ac).focus();
        await settle(page);
        expect(rows(ac).map((r) => r.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
        rows(ac)[2]!.click();
        await settle(page);
        expect(ac.value).toEqual(PEOPLE[2]);
        expect(new FormData(page.querySelector<HTMLFormElement>('#f')!).get('who')).toBe('12');
    });

    it('opens upwards when less than a full list fits below the box, even if this short list would fit', async () => {
        const { page, ac } = await box('<div style="position:fixed;top:calc(100vh - 220px);left:0;width:300px"><ge-autocomplete></ge-autocomplete></div>', ['Apple', 'Fig']);
        input(ac).focus();
        await settle(page);
        const panel = ac.shadowRoot!.querySelector('ge-popover-content')!.shadowRoot!.querySelector('.panel')!;
        expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(ac.shadowRoot!.querySelector('.container')!.getBoundingClientRect().top);
    });

    it('debounce-time delays search-change to the last keystroke', async () => {
        const { page, ac } = await box('<ge-autocomplete debounce-time="60"></ge-autocomplete>');
        const searches: string[] = [];
        ac.addEventListener('search-change', (e) => searches.push((e as CustomEvent<string>).detail));
        input(ac).focus();
        await userEvent.type(input(ac), 'app');
        expect(searches).toEqual([]);
        await new Promise((r) => setTimeout(r, 120));
        expect(searches).toEqual(['app']);
        await settle(page);
    });

    it('does nothing while disabled, and closes if it becomes disabled while open', async () => {
        const { page, ac } = await box('<ge-autocomplete disabled></ge-autocomplete>');
        expect(input(ac).disabled).toBe(true);
        ac.shadowRoot!.querySelector<HTMLElement>('.container')!.click();
        ac.show();
        await settle(page);
        expect(input(ac).getAttribute('aria-expanded')).toBe('false');

        ac.disabled = false;
        await ac.updateComplete;
        ac.show();
        await settle(page);
        expect(input(ac).getAttribute('aria-expanded')).toBe('true');
        ac.disabled = true;
        await settle(page);
        expect(input(ac).getAttribute('aria-expanded')).toBe('false');
    });

    it('a form reset clears the pick and what is submitted', async () => {
        const { page, ac } = await box('<form id="f"><ge-autocomplete name="fruit"></ge-autocomplete></form>', FRUIT, { value: 'Fig (dried)' });
        const form = page.querySelector<HTMLFormElement>('#f')!;
        ac.value = 'Cherry';
        await settle(page);
        form.reset();
        await settle(page);
        expect(ac.value).toBeNull();
        expect(new FormData(form).has('fruit')).toBe(false);
    });

    it('follows the locale: placeholder, empty message and direction', async () => {
        const { page, ac } = await box('<ge-autocomplete locale="he"></ge-autocomplete>');
        expect(input(ac).placeholder).toBe('...בחר');
        expect(ac.shadowRoot!.querySelector('.container')!.getAttribute('dir')).toBe('rtl');
        input(ac).focus();
        await userEvent.type(input(ac), 'zzz');
        await settle(page);
        expect(ac.shadowRoot!.querySelector('ge-command-empty')!.textContent!.trim()).toBe('לא נמצאו תוצאות.');
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations closed or open', async () => {
            const { page, ac } = await box('<ge-autocomplete aria-label="Fruit"></ge-autocomplete>');
            const closed = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(closed.violations).toEqual([]);
            input(ac).focus();
            await settle(page);
            const open = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(open.violations).toEqual([]);
        });
    });
});
