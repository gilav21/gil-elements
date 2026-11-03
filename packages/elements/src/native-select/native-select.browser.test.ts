import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeNativeSelect } from './native-select.js';

const first = (page: HTMLElement) => page.querySelector<GeNativeSelect>('ge-native-select')!;
const inner = (el: Element) => el.shadowRoot!.querySelector('select')!;
const settle = (el: GeNativeSelect) => new Promise((resolve) => setTimeout(resolve, 20)).then(() => el.updateComplete);
const FRUIT = `<option value="">Select a fruit</option><option value="apple">Apple</option><optgroup label="Citrus"><option value="orange">Orange</option><option value="lemon" disabled>Lemon</option></optgroup>`;

describe('ge-native-select', () => {
    it('mirrors options and groups into the native select, with disabled options kept', async () => {
        const page = await mount(`<ge-native-select aria-label="Fruit">${FRUIT}</ge-native-select>`);
        const select = inner(first(page));

        expect([...select.options].map((o) => [o.value, o.text, o.disabled])).toEqual([
            ['', 'Select a fruit', false],
            ['apple', 'Apple', false],
            ['orange', 'Orange', false],
            ['lemon', 'Lemon', true],
        ]);
        expect(select.querySelector('optgroup')!.label).toBe('Citrus');
    });

    it('follows options added, removed and edited afterwards', async () => {
        const page = await mount(`<ge-native-select value="apple">${FRUIT}</ge-native-select>`);
        const el = first(page);
        const texts = () => [...inner(el).options].map((o) => o.text);

        el.insertAdjacentHTML('beforeend', '<option value="kiwi">Kiwi</option>');
        await settle(el);
        expect(texts()).toContain('Kiwi');

        el.querySelector('option[value="apple"]')!.textContent = 'Green apple';
        await settle(el);
        expect(texts()).toContain('Green apple');
        expect(inner(el).value).toBe('apple');

        el.querySelector('option[value="kiwi"]')!.remove();
        await settle(el);
        expect(texts()).not.toContain('Kiwi');
    });

    it('shows the option named by value, blank when nothing matches, and the empty option by default', async () => {
        const page = await mount(`<ge-native-select id="a" value="orange">${FRUIT}</ge-native-select><ge-native-select id="b" value="mango">${FRUIT}</ge-native-select><ge-native-select id="c">${FRUIT}</ge-native-select><ge-native-select id="d"><option value="x">First</option><option value="y" selected>Chosen</option></ge-native-select>`);
        const shown = (id: string) => inner(page.querySelector(`#${id}`)!).selectedOptions[0]?.text;
        await Promise.all([...page.querySelectorAll<GeNativeSelect>('ge-native-select')].map(settle));

        expect(shown('a')).toBe('Orange');
        expect(shown('b')).toBeUndefined();
        expect(shown('c')).toBe('Select a fruit');
        expect(shown('d')).toBe('Chosen');
        expect((page.querySelector('#d') as GeNativeSelect).value).toBe('y');
    });

    it('takes the picked value from the keyboard and reports input and one change on the host', async () => {
        const page = await mount(`<ge-native-select>${FRUIT}</ge-native-select>`);
        const el = first(page);
        const events: string[] = [];
        el.addEventListener('input', () => events.push('input'));
        el.addEventListener('change', () => events.push('change'));

        inner(el).focus();
        await userEvent.keyboard('{ArrowDown}');

        expect(el.value).toBe('apple');
        expect(events).toEqual(['input', 'change']);
    });

    it('submits with a form and goes back to the first value on reset', async () => {
        const page = await mount(`<form><ge-native-select name="fruit" value="apple">${FRUIT}</ge-native-select></form>`);
        const el = first(page);
        const form = page.querySelector('form')!;
        await settle(el);
        expect(new FormData(form).get('fruit')).toBe('apple');

        inner(el).focus();
        await userEvent.keyboard('{ArrowDown}');
        expect(new FormData(form).get('fruit')).toBe('orange');

        form.reset();
        await settle(el);
        expect(new FormData(form).get('fruit')).toBe('apple');
        expect(inner(el).value).toBe('apple');
    });

    it('is blocked by disabled and by a disabled fieldset, and exposes invalid and its name', async () => {
        const page = await mount(`<fieldset disabled><ge-native-select id="a" aria-label="Fruit" invalid>${FRUIT}</ge-native-select></fieldset><ge-native-select id="b" disabled>${FRUIT}</ge-native-select>`);
        const a = page.querySelector<GeNativeSelect>('#a')!;
        const b = page.querySelector<GeNativeSelect>('#b')!;
        await Promise.all([settle(a), settle(b)]);

        expect(inner(a).disabled).toBe(true);
        expect(inner(b).disabled).toBe(true);
        expect(inner(a).getAttribute('aria-invalid')).toBe('true');
        expect(inner(a).getAttribute('aria-label')).toBe('Fruit');
        expect(inner(b).hasAttribute('aria-invalid')).toBe(false);
    });

    it('has no accessibility violations', async () => {
        const page = await mount(`<ge-native-select aria-label="Fruit">${FRUIT}</ge-native-select>`);
        await settle(first(page));
        const result = await axe.run(page);
        expect(result.violations).toEqual([]);
    });
});
