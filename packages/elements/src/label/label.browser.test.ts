import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeLabel } from './label.js';

describe('ge-label', () => {
    it('names the control it points at, keeps names already on it, and stops when the target changes', async () => {
        const page = await mount(`
            <ge-label id="l" for="email">Email address</ge-label>
            <input id="email" aria-labelledby="hint">
            <input id="other">
            <span id="hint">(required)</span>`);
        const label = page.querySelector<GeLabel>('#l')!;
        const email = page.querySelector('#email')!;

        expect(email.getAttribute('aria-labelledby')).toBe(`hint ${label.id}`);

        label.htmlFor = 'other';
        await label.updateComplete;
        expect(email.getAttribute('aria-labelledby')).toBe('hint');
        expect(page.querySelector('#other')!.getAttribute('aria-labelledby')).toBe(label.id);

        label.remove();
        expect(page.querySelector('#other')!.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('forwards a click to the control like a native label: focuses a text field and toggles a checkbox', async () => {
        const page = await mount(`
            <ge-label id="a" for="name">Name</ge-label><input id="name">
            <ge-label id="b" for="agree">I agree</ge-label><input id="agree" type="checkbox">
            <ge-label id="c" for="off">Disabled</ge-label><input id="off" type="checkbox" disabled>`);

        page.querySelector<HTMLElement>('#a')!.click();
        expect(document.activeElement).toBe(page.querySelector('#name'));

        page.querySelector<HTMLElement>('#b')!.click();
        expect(page.querySelector<HTMLInputElement>('#agree')!.checked).toBe(true);

        const agree = page.querySelector<HTMLElement>('#b')!;
        page.addEventListener('click', (event) => event.preventDefault(), { once: true, capture: true });
        agree.click();
        expect(page.querySelector<HTMLInputElement>('#agree')!.checked).toBe(true);

        page.querySelector<HTMLElement>('#c')!.click();
        expect(page.querySelector<HTMLInputElement>('#off')!.checked).toBe(false);
    });

    it.each(['light', 'dark'])('gives the control an accessible name per axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-label for="email">Email address</ge-label> <input id="email" type="email">');

        const { violations } = await axe.run(page);
        expect(violations.map((v) => v.id)).toEqual([]);
    });
});
