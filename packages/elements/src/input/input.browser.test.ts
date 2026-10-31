import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeInput } from './input.js';

const first = (page: HTMLElement) => page.querySelector<GeInput>('ge-input')!;
const inner = (el: Element) => el.shadowRoot!.querySelector<HTMLInputElement>('input')!;

describe('ge-input', () => {
    it('reports typing as input events on the host and a commit as one change event', async () => {
        const page = await mount('<ge-input></ge-input>');
        const input = first(page);
        const events: string[] = [];
        input.addEventListener('input', () => events.push('input'));
        input.addEventListener('change', () => events.push('change'));

        inner(input).focus();
        await userEvent.keyboard('Gil');
        expect(events).toEqual(['input', 'input', 'input']);
        expect(input.value).toBe('Gil');

        await userEvent.keyboard('{Enter}');
        expect(events.filter((e) => e === 'change')).toEqual(['change']);
    });

    it('takes its text from the value attribute and shows the placeholder only while empty', async () => {
        const page = await mount('<ge-input id="a" value="Gil" placeholder="Name"></ge-input><ge-input id="b" placeholder="Name"></ge-input>');
        const filled = page.querySelector<GeInput>('#a')!;
        const empty = page.querySelector<GeInput>('#b')!;

        expect(inner(filled).value).toBe('Gil');
        expect(inner(empty).matches(':placeholder-shown')).toBe(true);
        expect(inner(filled).matches(':placeholder-shown')).toBe(false);
    });

    it('clears from the clear button, announces it, and returns focus to the field', async () => {
        const page = await mount('<ge-input clearable value="Gil"></ge-input><ge-input clearable></ge-input>');
        const [filled, empty] = page.querySelectorAll<GeInput>('ge-input');
        const events: string[] = [];
        filled.addEventListener('input', () => events.push('input'));
        filled.addEventListener('change', () => events.push('change'));

        expect(empty.shadowRoot!.querySelector('.clear')).toBeNull();
        filled.shadowRoot!.querySelector<HTMLButtonElement>('.clear')!.click();
        await filled.updateComplete;

        expect(filled.value).toBe('');
        expect(inner(filled).value).toBe('');
        expect(events).toEqual(['input', 'change']);
        expect(filled.shadowRoot!.activeElement).toBe(inner(filled));
        expect(filled.shadowRoot!.querySelector('.clear')).toBeNull();
    });

    it('floats the label up on focus or when filled, and a click on it reaches the field', async () => {
        const page = await mount(`
            <ge-input id="rest" floating label="Email" placeholder="you@example.com"></ge-input>
            <ge-input id="full" floating label="Email" value="gil@example.com"></ge-input>`);
        const rest = page.querySelector<GeInput>('#rest')!;
        const full = page.querySelector<GeInput>('#full')!;
        const label = (el: GeInput) => el.shadowRoot!.querySelector<HTMLElement>('.floating-label')!;

        expect(label(rest).classList.contains('active')).toBe(false);
        expect(label(full).classList.contains('active')).toBe(true);
        expect(inner(rest).placeholder).toBe('');

        label(rest).click();
        await rest.updateComplete;

        expect(label(rest).classList.contains('active')).toBe(true);
        expect(inner(rest).placeholder).toBe('you@example.com');
        // The floated label sits above the field once its transition ends, the resting one over it.
        await vi.waitFor(() => expect(label(rest).getBoundingClientRect().bottom).toBeLessThanOrEqual(inner(rest).getBoundingClientRect().top + 1));
    });

    it('is named by a ge-label and described by an element in the page, across the shadow boundary', async () => {
        const page = await mount(`
            <ge-label for="email">Email address</ge-label>
            <ge-input id="email" aria-describedby="hint"></ge-input>
            <p id="hint">We never share it.</p>
            <ge-input id="plain" aria-label="Search"></ge-input>`);
        const session = cdp();
        await session.send('Accessibility.enable');
        const { frameTree } = await session.send('Page.getFrameTree');
        const frameId = frameTree.childFrames?.[0]?.frame.id;
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });
        const boxes = nodes.filter((n) => n.role?.value === 'textbox');
        const byName = (name: string) => boxes.find((n) => n.name?.value === name);

        expect(byName('Email address')?.description?.value).toBe('We never share it.');
        expect(byName('Search')).toBeDefined();
    });

    it('is a tab stop whose focus lands on the inner input, and disabled ones are skipped', async () => {
        const page = await mount('<ge-input id="a" disabled></ge-input><fieldset disabled><ge-input id="b"></ge-input></fieldset><ge-input id="c"></ge-input>');
        const c = page.querySelector<GeInput>('#c')!;

        await userEvent.tab();

        expect(document.activeElement).toBe(c);
        expect(c.shadowRoot!.activeElement).toBe(inner(c));
        expect(inner(page.querySelector('#a')!).disabled).toBe(true);
        expect(inner(page.querySelector('#b')!).disabled).toBe(true);
    });

    it('focuses itself on first render with autofocus', async () => {
        const page = await mount('<ge-input autofocus></ge-input>');
        const input = first(page);

        expect(input.shadowRoot!.activeElement).toBe(inner(input));
    });

    it('swaps in affixes and a spinner that hides the suffix, and shows a bar for skeleton', async () => {
        const page = await mount(`
            <ge-input id="affix" prefix="$" suffix="kg"></ge-input>
            <ge-input id="busy" loading suffix="kg"></ge-input>
            <ge-input id="bone" skeleton></ge-input>`);
        const root = (id: string) => page.querySelector(`#${id}`)!.shadowRoot!;

        expect(root('affix').querySelector('.prefix')!.textContent).toBe('$');
        expect(root('affix').querySelector('.suffix')!.textContent).toBe('kg');
        expect(root('busy').querySelector('.spinner')).not.toBeNull();
        expect(root('busy').querySelector('.suffix')).toBeNull();
        expect(root('bone').querySelector('input')).toBeNull();
        expect(root('bone').querySelector('.skeleton')).not.toBeNull();
    });

    it('is 36px tall, scales with density, and uses the compact font size on wide screens', async () => {
        const page = await mount(`
            <ge-input id="base"></ge-input>
            <div style="--density: 0.75"><ge-input id="dense"></ge-input></div>
            <div style="--density: 0.75; --density-input: 1.25"><ge-input id="override"></ge-input></div>`);
        const height = (id: string) => inner(page.querySelector(`#${id}`)!).getBoundingClientRect().height;

        expect([height('base'), height('dense'), height('override')]).toEqual([36, 27, 45]);
        expect(Number.parseFloat(getComputedStyle(inner(first(page))).fontSize)).toBe(window.innerWidth >= 768 ? 14 : 16);
    });

    it('draws the focus ring only for keyboard focus, and not for the underline variant', async () => {
        const page = await mount('<ge-input></ge-input><ge-input variant="underline"></ge-input>');
        const [outline, underline] = [...page.querySelectorAll<GeInput>('ge-input')].map(inner);

        await userEvent.tab();
        expect(outline.matches(':focus-visible')).toBe(true);
        expect(getComputedStyle(outline).boxShadow).toMatch(/0px 0px 0px 3px/);

        await userEvent.tab();
        expect(underline.matches(':focus-visible')).toBe(true);
        expect(getComputedStyle(underline).boxShadow).toBe('none');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`
            <ge-input aria-label="Name" value="Gil"></ge-input>
            <ge-input aria-label="Search" clearable value="x" prefix="$"></ge-input>
            <ge-input aria-label="Disabled" disabled placeholder="Locked"></ge-input>`);
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });

    it('submits what was typed under its name, skips a disabled one, and a form reset restores the markup', async () => {
        const page = await mount(`
            <form>
                <ge-input name="first" value="Gil"></ge-input>
                <ge-input name="off" value="x" disabled></ge-input>
                <ge-input value="nameless"></ge-input>
            </form>`);
        const form = page.querySelector('form')!;
        const input = first(page);
        const submitted = () => Object.fromEntries(new FormData(form).entries());

        expect(submitted()).toEqual({ first: 'Gil' });

        inner(input).focus();
        await userEvent.keyboard('{Control>}a{/Control}Avraham');
        expect(submitted()).toEqual({ first: 'Avraham' });

        form.reset();
        await input.updateComplete;
        expect(submitted()).toEqual({ first: 'Gil' });
        expect(inner(input).value).toBe('Gil');
    });
});
