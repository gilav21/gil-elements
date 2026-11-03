import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../button/define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeInputGroup, GeInputGroupInput } from './index.js';

const MARKUP = `<form id="form"><ge-input-group id="group" style="width:20rem">
  <ge-input-group-addon><ge-input-group-text>https://</ge-input-group-text></ge-input-group-addon>
  <ge-input-group-input id="field" name="site" value="example.com" aria-label="Website"></ge-input-group-input>
  <ge-input-group-addon align="inline-end"><ge-button id="copy" size="sm" variant="ghost">Copy</ge-button></ge-input-group-addon>
</ge-input-group><button id="after" type="button">after</button></form>`;

const group = (page: HTMLElement) => page.querySelector<GeInputGroup>('ge-input-group')!;
const field = (page: HTMLElement) => page.querySelector<GeInputGroupInput>('ge-input-group-input')!;
const row = (page: HTMLElement) => group(page).shadowRoot!.querySelector('fieldset')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 2; round++) {
        await group(page).updateComplete;
        await field(page).updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};

describe('ge-input-group', () => {
    it('shows one focus ring while the field has focus, and not while an addon button does', async () => {
        const page = await mount(MARKUP);
        await settle(page);

        expect(row(page).hasAttribute('data-focus')).toBe(false);
        field(page).inner!.focus();
        await settle(page);
        expect(row(page).hasAttribute('data-focus')).toBe(true);
        expect(getComputedStyle(row(page)).boxShadow).not.toBe('none');

        page.querySelector<HTMLElement>('#copy')!.shadowRoot!.querySelector('button')!.focus();
        await settle(page);
        expect(row(page).hasAttribute('data-focus')).toBe(false);

        field(page).inner!.focus();
        page.querySelector<HTMLElement>('#after')!.focus();
        await settle(page);
        expect(row(page).hasAttribute('data-focus')).toBe(false);
    });

    it('disables the field and dims the row when the group is disabled, and undoes both', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        expect(field(page).inner!.disabled).toBe(false);

        group(page).disabled = true;
        await settle(page);
        expect(field(page).inner!.disabled).toBe(true);
        expect(getComputedStyle(row(page)).opacity).toBe('0.5');

        group(page).disabled = false;
        await settle(page);
        expect(field(page).inner!.disabled).toBe(false);
        expect(getComputedStyle(row(page)).opacity).toBe('1');
    });

    it('is a form field: submits its value, follows typing, resets, and takes its name from aria-label', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        const form = page.querySelector<HTMLFormElement>('#form')!;
        const sent = () => new FormData(form).get('site');

        expect(sent()).toBe('example.com');
        expect(field(page).inner!.getAttribute('aria-label')).toBe('Website');
        await userEvent.clear(field(page).inner!);
        await userEvent.type(field(page).inner!, 'gil.dev');
        expect(field(page).value).toBe('gil.dev');
        expect(sent()).toBe('gil.dev');

        form.reset();
        await settle(page);
        expect(field(page).value).toBe('example.com');
        expect(sent()).toBe('example.com');
    });

    it('re-fires change on the host when an edit is committed', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        let fired = 0;
        field(page).addEventListener('change', () => fired++);
        await userEvent.type(field(page).inner!, 'x');
        await userEvent.tab();

        expect(fired).toBe(1);
    });

    it('lays the field out between its addons and gives the underline variant no side border', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        const [start, end] = [...page.querySelectorAll('ge-input-group-addon')].map((a) => a.shadowRoot!.querySelector('.addon')!.getBoundingClientRect());
        const input = field(page).inner!.getBoundingClientRect();

        expect(input.left).toBeGreaterThanOrEqual(start.right);
        expect(input.right).toBeLessThanOrEqual(end.left);
        group(page).variant = 'underline';
        await settle(page);
        const style = getComputedStyle(row(page));
        expect([style.borderTopWidth, style.borderLeftWidth, style.borderBottomWidth]).toEqual(['0px', '0px', '1px']);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(MARKUP);
            await settle(page);
            const out = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(out.violations).toEqual([]);
        });
    });
});
