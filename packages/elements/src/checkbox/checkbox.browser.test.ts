import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCheckbox } from './checkbox.js';

const first = (page: HTMLElement) => page.querySelector<GeCheckbox>('ge-checkbox')!;
const box = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.box')!;

describe('ge-checkbox', () => {
    it('toggles on click, announces it once, and a click on the label text counts too', async () => {
        const page = await mount('<ge-checkbox label="Accept terms"></ge-checkbox>');
        const checkbox = first(page);
        const events: string[] = [];
        checkbox.addEventListener('input', () => events.push('input'));
        checkbox.addEventListener('change', () => events.push('change'));

        box(checkbox).click();
        expect(checkbox.checked).toBe(true);
        checkbox.shadowRoot!.querySelector<HTMLElement>('.label')!.click();
        expect(checkbox.checked).toBe(false);

        expect(events).toEqual(['input', 'change', 'input', 'change']);
    });

    it('does nothing while disabled, directly or through a disabled fieldset, and a cancelled click stops it', async () => {
        const page = await mount(`
            <ge-checkbox id="direct" disabled></ge-checkbox>
            <fieldset disabled><ge-checkbox id="inherited"></ge-checkbox></fieldset>
            <ge-checkbox id="vetoed"></ge-checkbox>`);
        const [direct, inherited, vetoed] = ['direct', 'inherited', 'vetoed'].map((id) => page.querySelector<GeCheckbox>(`#${id}`)!);
        vetoed.addEventListener('click', (event) => event.preventDefault(), { capture: true });

        for (const checkbox of [direct, inherited, vetoed]) box(checkbox).click();

        expect([direct.checked, inherited.checked, vetoed.checked]).toEqual([false, false, false]);
    });

    it('is a tab stop that Space toggles on release, Enter ignores, and a disabled one skips', async () => {
        const page = await mount(`
            <ge-checkbox id="a"></ge-checkbox><ge-checkbox id="skipped" disabled></ge-checkbox><ge-checkbox id="b"></ge-checkbox>`);
        const [a, , b] = [...page.querySelectorAll<GeCheckbox>('ge-checkbox')];

        await userEvent.tab();
        expect([document.activeElement, a.checked]).toEqual([a, false]);
        await userEvent.keyboard('{Enter}');
        expect(a.checked).toBe(false);
        await userEvent.keyboard('[Space>]');
        expect(a.checked).toBe(false);
        await userEvent.keyboard('[/Space]');
        expect(a.checked).toBe(true);

        await userEvent.tab();
        expect(document.activeElement).toBe(b);
        expect(document.activeElement).toBe(b);
    });

    it('exposes checked, unchecked and mixed to assistive technology, and mixed does not touch checked', async () => {
        const page = await mount(`
            <ge-checkbox aria-label="off"></ge-checkbox><ge-checkbox aria-label="on" checked></ge-checkbox>
            <ge-checkbox aria-label="mixed" indeterminate></ge-checkbox><ge-checkbox aria-label="gone" disabled></ge-checkbox>`);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const frameId = frameTree.childFrames?.[0]?.frame.id;
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });
        const read = (name: string) => {
            const node = nodes.find((n) => n.role?.value === 'checkbox' && n.name?.value === name);
            return Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        };

        expect(read('off').checked).toBe('false');
        expect(read('on').checked).toBe('true');
        expect(read('mixed').checked).toBe('mixed');
        expect(read('gone').disabled).toBe(true);
        expect(page.querySelector<GeCheckbox>('[aria-label=mixed]')!.checked).toBe(false);
    });

    it('draws a check for checked, a dash for mixed and nothing otherwise', async () => {
        const page = await mount('<ge-checkbox></ge-checkbox><ge-checkbox checked></ge-checkbox><ge-checkbox indeterminate></ge-checkbox>');
        const glyphs = [...page.querySelectorAll('ge-checkbox')].map((el) => box(el).querySelector('path')?.getAttribute('d') ?? '');

        expect(glyphs).toEqual(['', 'M5 13l4 4L19 7', 'M5 12h14']);
    });

    it('is named by a ge-label elsewhere in the page, and clicking that label toggles it', async () => {
        const page = await mount(`
            <ge-checkbox id="terms"></ge-checkbox> <ge-label for="terms">Accept terms and conditions</ge-label>`);

        page.querySelector<HTMLElement>('ge-label')!.click();

        expect(first(page).checked).toBe(true);
        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales the box with its density token', async () => {
        const page = await mount('<ge-checkbox style="--density-checkbox: 1.5"></ge-checkbox>');
        expect(box(first(page)).getBoundingClientRect().width).toBe(24);
    });

    it.each(['light', 'dark'])('has no accessibility violations in %s mode, labelled and bare', async (mode) => {
        useTheme(mode);
        const page = await mount(`
            <ge-checkbox label="Accept terms"></ge-checkbox>
            <ge-checkbox aria-label="Select row" checked></ge-checkbox>
            <ge-checkbox aria-label="Select all" indeterminate disabled></ge-checkbox>`);
        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('submits its value only while checked and not disabled, and a form reset restores the markup', async () => {
        const page = await mount(`
            <form>
                <ge-checkbox name="a" checked></ge-checkbox>
                <ge-checkbox name="b"></ge-checkbox>
                <ge-checkbox name="c" value="yes" checked></ge-checkbox>
                <ge-checkbox name="d" checked disabled></ge-checkbox>
                <ge-checkbox name="e" checked indeterminate></ge-checkbox>
            </form>`);
        const form = page.querySelector('form')!;
        const [a, b] = page.querySelectorAll<GeCheckbox>('ge-checkbox');
        const submitted = () => [...new FormData(form).entries()];

        expect(submitted()).toEqual([['a', 'on'], ['c', 'yes'], ['e', 'on']]);

        b.click();
        a.click();
        await Promise.all([a.updateComplete, b.updateComplete]);
        expect(submitted().map(([name]) => name)).toEqual(['b', 'c', 'e']);

        form.reset();
        await Promise.all([a.updateComplete, b.updateComplete]);
        expect([a.checked, b.checked]).toEqual([true, false]);
        expect(submitted().map(([name]) => name)).toEqual(['a', 'c', 'e']);
    });
});
