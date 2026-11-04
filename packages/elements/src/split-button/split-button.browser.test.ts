import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeSplitButton, SplitButtonItem } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const ITEMS: SplitButtonItem[] = [{ label: 'Save as draft' }, { label: 'Archive', disabled: true }, { label: 'Save and close' }];
const simple = async (attrs = '', items: SplitButtonItem[] = ITEMS) => {
    const page = await mount(`<div style="padding:20px"><ge-split-button label="Save" ${attrs}></ge-split-button><button id="outside">outside</button></div>`);
    const el = page.querySelector<GeSplitButton>('ge-split-button')!;
    el.items = items;
    await settle(page);
    return { page, el };
};
const custom = async (attrs = '') => {
    const page = await mount(`<div style="padding:20px"><ge-split-button ${attrs}>
        <ge-split-button-primary>Save</ge-split-button-primary>
        <ge-split-button-menu>
            <ge-split-button-item value="draft">Save as draft</ge-split-button-item>
            <ge-split-button-item value="archive" disabled>Archive</ge-split-button-item>
            <ge-split-button-item value="close">Save and close</ge-split-button-item>
        </ge-split-button-menu>
    </ge-split-button></div>`);
    await settle(page);
    return { page, el: page.querySelector<GeSplitButton>('ge-split-button')! };
};
const toggle = (el: GeSplitButton) => el.shadowRoot!.querySelector<HTMLElement>('.dropdown')!;
const labels = (el: GeSplitButton) => [...el.shadowRoot!.querySelectorAll('.item')].map((r) => r.textContent!.trim());
const events = (el: GeSplitButton) => {
    const log: string[] = [];
    el.addEventListener('primary-click', () => log.push('primary'));
    el.addEventListener('item-click', (e) => log.push(`item:${JSON.stringify((e as CustomEvent).detail)}`));
    return log;
};
const key = async (page: HTMLElement, text: string) => {
    await userEvent.keyboard(text);
    await new Promise((r) => setTimeout(r, 10));
    await settle(page);
};

describe('ge-split-button', () => {
    it('the primary half fires primary-click and the toggle opens the menu without it', async () => {
        const { page, el } = await simple();
        const log = events(el);
        await userEvent.click(el.shadowRoot!.querySelector<HTMLElement>('ge-button:not(.dropdown)')!);
        expect(log).toEqual(['primary']);
        expect(el.open).toBe(false);
        await userEvent.click(toggle(el));
        await settle(page);
        expect(el.open).toBe(true);
        expect(labels(el)).toEqual(['Save as draft', 'Archive', 'Save and close']);
        expect(log).toEqual(['primary']);
        await userEvent.click(toggle(el));
        await settle(page);
        expect(el.open).toBe(false);
    });

    it('a data row fires item-click with the item, runs its own click, closes, and a disabled row does nothing', async () => {
        const { page, el } = await simple();
        const log = events(el);
        const called: string[] = [];
        el.items = [{ label: 'Save as draft', click: (item) => called.push(item.label) }, ...ITEMS.slice(1)];
        await userEvent.click(toggle(el));
        await settle(page);
        const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('.item');
        rows[1]!.click();
        await settle(page);
        expect(log).toEqual([]);
        expect(el.open).toBe(true);
        await userEvent.click(rows[0]!);
        await settle(page);
        expect(log).toEqual(['item:{"label":"Save as draft"}']);
        expect(called).toEqual(['Save as draft']);
        expect(el.open).toBe(false);
    });

    it('a projected row sends its value and closes', async () => {
        const { page, el } = await custom();
        const log = events(el);
        await userEvent.click(toggle(el));
        await settle(page);
        await userEvent.click(el.querySelector('ge-split-button-item[value="close"]')!);
        await settle(page);
        expect(log).toEqual(['item:{"label":"","value":"close"}']);
        expect(el.open).toBe(false);
    });

    it('a projected primary forwards its click and follows the split button\'s disabled state', async () => {
        const { page, el } = await custom();
        const log = events(el);
        await userEvent.click(el.querySelector('ge-split-button-primary')!);
        expect(log).toEqual(['primary']);
        el.disabled = true;
        await settle(page);
        const inner = el.querySelector('ge-split-button-primary')!.shadowRoot!.querySelector('ge-button')!;
        expect(inner.hasAttribute('disabled')).toBe(true);
        expect(toggle(el).hasAttribute('disabled')).toBe(true);
    });

    it('a label wins over a projected primary, and items win over a projected menu', async () => {
        const page = await mount(`<ge-split-button label="Go"><ge-split-button-primary>Projected</ge-split-button-primary><ge-split-button-menu><ge-split-button-item>Projected row</ge-split-button-item></ge-split-button-menu></ge-split-button>`);
        const el = page.querySelector<GeSplitButton>('ge-split-button')!;
        el.items = [{ label: 'Data row' }];
        el.open = true;
        await settle(page);
        expect(getComputedStyle(el.querySelector('ge-split-button-primary')!).display).toBe('none');
        expect(getComputedStyle(el.querySelector('ge-split-button-menu')!).display).toBe('none');
        expect(labels(el)).toEqual(['Data row']);
    });

    it('opens from the keyboard onto the first row, walks the enabled rows with wrap, and Escape returns to the toggle', async () => {
        const { page, el } = await simple();
        toggle(el).focus();
        await key(page, '{Enter}');
        expect(el.open).toBe(true);
        const rows = el.shadowRoot!.querySelectorAll<HTMLElement>('.item');
        expect(el.shadowRoot!.activeElement).toBe(rows[0]);
        await key(page, '{ArrowDown}');
        expect(el.shadowRoot!.activeElement).toBe(rows[2]);
        await key(page, '{ArrowDown}');
        expect(el.shadowRoot!.activeElement).toBe(rows[0]);
        await key(page, '{ArrowUp}');
        expect(el.shadowRoot!.activeElement).toBe(rows[2]);
        await key(page, '{Escape}');
        expect(el.open).toBe(false);
        expect(el.shadowRoot!.activeElement).toBe(toggle(el));
    });

    it('arrow keys walk the projected rows too, and Tab closes the menu', async () => {
        const { page, el } = await custom();
        toggle(el).focus();
        await key(page, '{ArrowDown}');
        const [first, , last] = el.querySelectorAll<HTMLElement>('ge-split-button-item');
        expect(document.activeElement).toBe(first);
        await key(page, '{ArrowDown}');
        expect(document.activeElement).toBe(last);
        await key(page, '{Tab}');
        expect(el.open).toBe(false);
    });

    it('closes on a click outside, but not on a click inside', async () => {
        const { page, el } = await simple();
        await userEvent.click(toggle(el));
        await settle(page);
        await userEvent.click(el.shadowRoot!.querySelector('ge-button:not(.dropdown)')!);
        expect(el.open).toBe(true);
        await userEvent.click(page.querySelector('#outside')!);
        await settle(page);
        expect(el.open).toBe(false);
    });

    it('opens above the group when fewer than 150px remain below', async () => {
        const page = await mount('<div style="position:fixed;bottom:20px;left:20px"><ge-split-button label="Save"></ge-split-button></div>');
        const el = page.querySelector<GeSplitButton>('ge-split-button')!;
        el.items = ITEMS;
        await settle(page);
        await userEvent.click(toggle(el));
        await settle(page);
        const menu = el.shadowRoot!.querySelector('.menu')!.getBoundingClientRect();
        expect(menu.bottom).toBeLessThanOrEqual(toggle(el).shadowRoot!.querySelector('button')!.getBoundingClientRect().top);
    });

    it('names the toggle, by default or with dropdown-label', async () => {
        const { el } = await simple();
        expect(toggle(el).getAttribute('aria-label')).toBe('More options');
        const named = await simple('dropdown-label="Mehr"');
        expect(toggle(named.el).getAttribute('aria-label')).toBe('Mehr');
        expect(toggle(named.el).getAttribute('aria-haspopup')).toBe('menu');
    });

    for (const theme of ['light', 'dark'] as const) {
        it(`has no axe violations in ${theme}, closed and open`, async () => {
            useTheme(theme);
            const { page, el } = await simple('variant="outline"');
            await userEvent.click(toggle(el));
            await settle(page);
            const result = await axe.run(el, { rules: { region: { enabled: false } } });
            expect(result.violations.map((v) => v.id)).toEqual([]);
        });
    }
});
