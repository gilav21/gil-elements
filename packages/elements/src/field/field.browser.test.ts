import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../input/define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeField } from './index.js';

const field = (page: HTMLElement) => page.querySelector<GeField>('ge-field')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 2; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};

describe('ge-field', () => {
    it('keeps the ids of its descriptions and errors in document order, generating one where none is given', async () => {
        const page = await mount(`<ge-field>
            <ge-field-label for="email">Email</ge-field-label>
            <ge-input id="email"></ge-input>
            <ge-field-description id="hint">We never share it.</ge-field-description>
            <ge-field-error>Enter a valid email.</ge-field-error>
        </ge-field>`);
        await settle(page);
        const error = page.querySelector('ge-field-error')!;

        expect(error.id).toMatch(/^ge-field-error-\d+$/);
        expect(field(page).describedBy).toBe(`hint ${error.id}`);

        let events = 0;
        field(page).addEventListener('described-by-change', () => events++);
        error.remove();
        expect(field(page).describedBy).toBe('hint');
        expect(events).toBe(1);

        field(page).insertAdjacentHTML('afterbegin', '<ge-field-description id="first">Note</ge-field-description>');
        expect(field(page).describedBy).toBe('first hint');
        field(page).querySelectorAll('ge-field-description').forEach((d) => d.remove());
        expect(field(page).describedBy).toBeNull();
    });

    it('announces an error as a polite alert, and labels the control it points at', async () => {
        const page = await mount(`<ge-field><ge-field-label for="email">Email</ge-field-label><ge-input id="email"></ge-input><ge-field-error>Enter a valid email.</ge-field-error></ge-field>`);
        await settle(page);
        const alert = page.querySelector('ge-field-error')!.shadowRoot!.querySelector('p')!;

        expect([alert.getAttribute('role'), alert.getAttribute('aria-live')]).toEqual(['alert', 'polite']);
        expect(page.querySelector('#email')!.getAttribute('aria-labelledby')).toBe(page.querySelector('ge-field-label')!.id);
        await userEvent.click(page.querySelector('ge-field-label')!);
        expect(document.activeElement).toBe(page.querySelector('#email'));
    });

    it('stacks label, control and text, or lines them up in a centred row when horizontal', async () => {
        const page = await mount(`<div style="width:22rem"><ge-field id="v"><ge-field-label for="a">A</ge-field-label><ge-input id="a"></ge-input></ge-field><ge-field id="h" orientation="horizontal"><ge-field-label for="b">B</ge-field-label><ge-input id="b"></ge-input></ge-field></div>`);
        await settle(page);
        const box = (id: string) => page.querySelector<GeField>(`#${id}`)!.shadowRoot!.querySelector('.field')!;
        const label = (id: string) => page.querySelector(`#${id} ge-field-label`)!.getBoundingClientRect();
        const control = (id: string) => page.querySelector(`#${id} ge-input`)!.shadowRoot!.querySelector('input')!.getBoundingClientRect();

        expect(getComputedStyle(box('v')).display).toBe('grid');
        expect(control('v').top).toBeGreaterThanOrEqual(label('v').bottom);
        expect(getComputedStyle(box('h')).display).toBe('flex');
        expect(getComputedStyle(box('h')).columnGap).toBe('12px');
        expect(getComputedStyle(box('v')).rowGap).toBe('8px');
        expect(control('h').left).toBeGreaterThan(label('h').right);
        expect(Math.abs((control('h').top + control('h').bottom) / 2 - (label('h').top + label('h').bottom) / 2)).toBeLessThan(1);
    });
});

describe('ge-field-set', () => {
    it('names the group from its legend and draws no box of its own', async () => {
        const page = await mount(`<ge-field-set><ge-field-legend>Contact</ge-field-legend><ge-field><ge-field-label for="e">Email</ge-field-label><ge-input id="e"></ge-input></ge-field></ge-field-set><ge-field-group><ge-field><ge-input id="g"></ge-input></ge-field></ge-field-group>`);
        await settle(page);
        const set = page.querySelector('ge-field-set')!.shadowRoot!.querySelector('fieldset')!;
        const style = getComputedStyle(set);

        expect(set.ariaLabelledByElements).toEqual([page.querySelector('ge-field-legend')]);
        expect([style.borderTopWidth, style.paddingTop, style.display]).toEqual(['0px', '0px', 'grid']);
    });

    it('spaces its children 1rem apart, in a set and in a group', async () => {
        const page = await mount(`<ge-field-set id="s"><ge-field id="f1"><ge-input></ge-input></ge-field><ge-field-separator></ge-field-separator><ge-field id="f2"><ge-input></ge-input></ge-field></ge-field-set>
            <ge-field-group id="g"><ge-field><ge-input></ge-input></ge-field></ge-field-group>`);
        await settle(page);
        const sep = page.querySelector('ge-field-separator')!.shadowRoot!.querySelector('hr')!;
        const style = getComputedStyle(sep);

        expect(getComputedStyle(page.querySelector('ge-field-set')!.shadowRoot!.querySelector('fieldset')!).rowGap).toBe('16px');
        expect(getComputedStyle(page.querySelector('ge-field-group')!.shadowRoot!.querySelector('.group')!).rowGap).toBe('16px');
        expect([style.marginTop, style.marginBottom, style.borderTopWidth]).toEqual(['16px', '16px', '1px']);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(`<ge-field-set><ge-field-legend>Contact</ge-field-legend><ge-field><ge-field-label for="e">Email</ge-field-label><ge-input id="e" aria-describedby="d"></ge-input><ge-field-description id="d">Hint</ge-field-description></ge-field></ge-field-set>`);
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});
