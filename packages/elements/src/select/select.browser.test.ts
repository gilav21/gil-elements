import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeSelect } from './index.js';

const MARKUP = (attrs = '', wrap = '') => `<div style="padding:200px 300px;${wrap}">
<form id="form">
<ge-select id="fruit" name="fruit" placeholder="Select a fruit" ${attrs}>
  <ge-select-trigger id="trigger" style="width:200px"><ge-select-value></ge-select-value></ge-select-trigger>
  <ge-select-content>
    <ge-select-group>
      <ge-select-label>Fruits</ge-select-label>
      <ge-select-item id="apple" value="apple">Apple</ge-select-item>
      <ge-select-item id="banana" value="banana" disabled>Banana</ge-select-item>
      <ge-select-item id="blueberry" value="blueberry">Blueberry</ge-select-item>
      <ge-select-separator></ge-select-separator>
      <ge-select-item id="grapes" value="grapes">Grapes</ge-select-item>
    </ge-select-group>
  </ge-select-content>
</ge-select>
</form>
<button id="outside">outside</button>
</div>`;

const select = (page: HTMLElement) => page.querySelector<GeSelect>('ge-select')!;
const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const panel = (page: HTMLElement) => page.querySelector<HTMLElement>('ge-select-content')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('ge-select')) {
            for (const inner of e.shadowRoot?.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*') ?? []) await inner.updateComplete;
        }
        await new Promise((r) => setTimeout(r, 0));
    }
};
const button = (page: HTMLElement) => el(page, 'trigger').shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const visible = (e: Element) => getComputedStyle(e).display !== 'none';
const active = () => deepActive(document);
const text = (page: HTMLElement) => el(page, 'trigger').querySelector('ge-select-value')!.shadowRoot!.textContent!.trim();
const openByClick = async (page: HTMLElement) => {
    button(page).click();
    await settle(page);
};
const press = async (page: HTMLElement, key: string) => {
    await userEvent.keyboard(key);
    await settle(page);
};

describe('ge-select (projected)', () => {
    it('shows the placeholder, opens on a click with focus on the first row when none is selected, and picks a row', async () => {
        const page = await mount(MARKUP());
        const events: string[] = [];
        select(page).addEventListener('input', () => events.push('input'));
        select(page).addEventListener('change', () => events.push('change'));
        select(page).addEventListener('value-change', (e) => events.push(`value-change:${(e as CustomEvent).detail}`));
        await settle(page);
        expect(text(page)).toBe('Select a fruit');
        expect(visible(panel(page))).toBe(false);
        await openByClick(page);
        expect(visible(panel(page))).toBe(true);
        expect(button(page).getAttribute('aria-expanded')).toBe('true');
        expect(active()).toBe(panel(page));
        el(page, 'blueberry').click();
        await settle(page);
        expect(select(page).value).toBe('blueberry');
        expect(text(page)).toBe('blueberry');
        expect(el(page, 'blueberry').getAttribute('aria-selected')).toBe('true');
        expect(el(page, 'apple').getAttribute('aria-selected')).toBe('false');
        expect(visible(panel(page))).toBe(false);
        await new Promise((r) => setTimeout(r, 10));
        expect(active()).toBe(button(page));
        expect(events).toEqual(['input', 'change', 'value-change:blueberry']);
        // Picking the value it already has closes without announcing a change.
        await openByClick(page);
        el(page, 'blueberry').click();
        await settle(page);
        expect(events).toHaveLength(3);
    });

    it('opens from the keyboard and walks the rows with wraparound, skipping disabled ones', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        button(page).focus();
        await press(page, '{ArrowUp}');
        expect(visible(panel(page))).toBe(false);
        await press(page, '{ArrowDown}');
        expect(visible(panel(page))).toBe(true);
        await press(page, '{Escape}');
        expect(visible(panel(page))).toBe(false);
        await new Promise((r) => setTimeout(r, 10));
        expect(active()).toBe(button(page));
        await press(page, '{Enter}');
        expect(visible(panel(page))).toBe(true);
        // The panel itself has focus, so the first Down lands on the first row.
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'apple'));
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'blueberry'));
        await press(page, '{ArrowDown}');
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'apple'));
        await press(page, '{ArrowUp}');
        expect(active()).toBe(el(page, 'grapes'));
        await press(page, '{Enter}');
        expect(select(page).value).toBe('grapes');
        expect(visible(panel(page))).toBe(false);
    });

    it('opens with Space, puts focus on the selected row and picks with Space', async () => {
        const page = await mount(MARKUP('value="blueberry"'));
        await settle(page);
        button(page).focus();
        await press(page, ' ');
        expect(visible(panel(page))).toBe(true);
        expect(active()).toBe(el(page, 'blueberry'));
        await press(page, '{ArrowDown}');
        await press(page, ' ');
        expect(select(page).value).toBe('grapes');
        expect(visible(panel(page))).toBe(false);
    });

    it('ignores a disabled row and a disabled select, and closes from outside', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        await openByClick(page);
        el(page, 'banana').click();
        await settle(page);
        expect(select(page).value).toBeUndefined();
        expect(visible(panel(page))).toBe(true);
        el(page, 'outside').click();
        await settle(page);
        expect(visible(panel(page))).toBe(false);
        select(page).disabled = true;
        await settle(page);
        expect(button(page).disabled).toBe(true);
        select(page).show();
        await settle(page);
        expect(visible(panel(page))).toBe(false);
    });

    it('takes part in a form: submits its value, resets to the default, and follows a disabled fieldset', async () => {
        const page = await mount(MARKUP('default-value="grapes"'));
        const form = page.querySelector<HTMLFormElement>('#form')!;
        await settle(page);
        expect(select(page).value).toBe('grapes');
        expect(new FormData(form).get('fruit')).toBe('grapes');
        await openByClick(page);
        el(page, 'apple').click();
        await settle(page);
        expect(new FormData(form).get('fruit')).toBe('apple');
        form.reset();
        await settle(page);
        expect(select(page).value).toBe('grapes');
        expect(text(page)).toBe('grapes');
        const fieldset = document.createElement('fieldset');
        form.append(fieldset);
        fieldset.append(select(page));
        fieldset.disabled = true;
        await settle(page);
        expect(button(page).disabled).toBe(true);
        expect(new FormData(form).has('fruit')).toBe(false);
    });

    it('resets to the value the markup declared when there is no default-value', async () => {
        const page = await mount(MARKUP('value="apple"'));
        await settle(page);
        await openByClick(page);
        el(page, 'grapes').click();
        await settle(page);
        page.querySelector<HTMLFormElement>('#form')!.reset();
        await settle(page);
        expect(select(page).value).toBe('apple');
    });

    it('aligns the selected row over the trigger, and opens beside it when that would run off the screen', async () => {
        const page = await mount(MARKUP('value="blueberry"'));
        await settle(page);
        await openByClick(page);
        await new Promise((r) => setTimeout(r, 20));
        expect(panel(page).dataset.position).toBe('item-aligned');
        const row = el(page, 'blueberry').getBoundingClientRect();
        const trigger = button(page).getBoundingClientRect();
        // shadcn-angular's rule: the panel starts (offset + 4px) above the trigger, which leaves the row 3px higher than the trigger.
        expect(Math.abs(row.top - (trigger.top - 3))).toBeLessThan(1);
        select(page).hide();
        await settle(page);
        // A trigger at the very top leaves no room above the first row.
        page.firstElementChild!.setAttribute('style', 'padding:0 300px');
        await settle(page);
        await openByClick(page);
        await new Promise((r) => setTimeout(r, 20));
        expect(panel(page).dataset.position).toBe('popper');
        expect(panel(page).getBoundingClientRect().top).toBeGreaterThanOrEqual(trigger.top - 400);
        const popper = panel(page).getBoundingClientRect();
        expect(popper.top).toBeGreaterThanOrEqual(button(page).getBoundingClientRect().bottom);
    });

    it('mirrors to the right edge in right-to-left text', async () => {
        const page = await mount(MARKUP('position="popper"', 'direction:rtl'));
        page.dir = 'rtl';
        el(page, 'trigger').style.width = '60px';
        await settle(page);
        await openByClick(page);
        expect(Math.abs(panel(page).getBoundingClientRect().right - select(page).getBoundingClientRect().right)).toBeLessThan(1);
        el(page, 'apple').click();
        await settle(page);
        select(page).show();
        await settle(page);
        const mark = el(page, 'apple').shadowRoot!.querySelector('.mark')!.getBoundingClientRect();
        expect(mark.left - el(page, 'apple').getBoundingClientRect().left).toBeLessThan(16);
    });

    it('names the trigger from the select or from an element it points at', async () => {
        const page = await mount(`<span id="lbl">Favourite fruit</span>${MARKUP('aria-labelledby="lbl"')}`);
        await settle(page);
        expect(button(page).ariaLabelledByElements?.[0]).toBe(page.querySelector('#lbl'));
        expect(button(page).hasAttribute('aria-label')).toBe(false);
        const plain = await mount(MARKUP('aria-label="Fruit"'));
        await settle(plain);
        expect(button(plain).getAttribute('aria-label')).toBe('Fruit');
    });

    it('has no axe violations open', async () => {
        useTheme('light');
        const page = await mount(MARKUP('aria-label="Fruit"'));
        await settle(page);
        await openByClick(page);
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => v.id)).toEqual([]);
    });
});

describe('ge-select (options)', () => {
    const DATA = `<div style="padding:200px 300px"><ge-select id="s" name="s" style="width:200px"></ge-select></div>`;
    const people = [
        { id: 7, name: 'Ada' },
        { id: 8, name: 'Grace', off: true },
        { id: 9, name: 'Linus' },
    ];
    const build = async () => {
        const page = await mount(DATA);
        const s = select(page);
        s.options = people;
        s.setAttribute('value-attribute', 'id');
        s.displayWith = (o) => (o as (typeof people)[number]).name;
        s.disabledWith = (o) => !!(o as (typeof people)[number]).off;
        await settle(page);
        return { page, s };
    };
    const trig = (s: GeSelect) => s.shadowRoot!.querySelector('ge-select-trigger')!.shadowRoot!.querySelector('button')!;
    const rows = (s: GeSelect) => [...s.shadowRoot!.querySelectorAll<HTMLElement>('ge-select-item')];

    it('builds the trigger and rows, shows the label of the selected option and announces the raw value', async () => {
        const { page, s } = await build();
        let detail: unknown;
        s.addEventListener('value-change', (e) => (detail = (e as CustomEvent).detail));
        expect(s.shadowRoot!.querySelector('ge-select-value')!.shadowRoot!.textContent!.trim()).toBe('Select...');
        trig(s).click();
        await settle(page);
        expect(rows(s).map((r) => r.textContent!.trim())).toEqual(['Ada', 'Grace', 'Linus']);
        expect(Math.abs(trig(s).getBoundingClientRect().width - 200)).toBeLessThan(1);
        rows(s)[2]!.click();
        await settle(page);
        expect(detail).toBe(9);
        expect(s.value).toBe(9);
        expect(s.shadowRoot!.querySelector('ge-select-value')!.shadowRoot!.textContent!.trim()).toBe('Linus');
        expect(rows(s)[2]!.getAttribute('aria-selected')).toBe('true');
    });

    it('opens with Up too, stops at the ends instead of wrapping, and closes on Tab', async () => {
        const { page, s } = await build();
        trig(s).focus();
        await press(page, '{ArrowUp}');
        expect(s.open).toBe(true);
        await settle(page);
        expect(deepActive(document)).toBe(rows(s)[0]);
        await press(page, '{ArrowUp}');
        expect(deepActive(document)).toBe(rows(s)[0]);
        await press(page, '{ArrowDown}');
        // The disabled row is skipped over, so the second enabled row is the third.
        expect(deepActive(document)).toBe(rows(s)[2]);
        await press(page, '{ArrowDown}');
        expect(deepActive(document)).toBe(rows(s)[2]);
        await press(page, '{Tab}');
        expect(s.open).toBe(false);
    });
});
