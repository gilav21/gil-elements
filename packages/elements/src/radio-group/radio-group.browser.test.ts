import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeRadioGroup } from './radio-group.js';
import type { GeRadioGroupItem } from './sub/radio-group-item.js';

const group = (page: HTMLElement) => page.querySelector<GeRadioGroup>('ge-radio-group')!;
const items = (page: HTMLElement) => [...page.querySelectorAll<GeRadioGroupItem>('ge-radio-group-item')];
const FIELDS = `
    <ge-radio-group aria-label="Density">
        <ge-radio-group-item value="default" label="Default"></ge-radio-group-item>
        <ge-radio-group-item value="comfortable" label="Comfortable"></ge-radio-group-item>
        <ge-radio-group-item value="compact" label="Compact"></ge-radio-group-item>
    </ge-radio-group>`;

describe('ge-radio-group', () => {
    it('selects the clicked item, announces the change once, and ignores a click on the selected one', async () => {
        const page = await mount(FIELDS);
        const events: string[] = [];
        group(page).addEventListener('input', () => events.push('input'));
        group(page).addEventListener('change', () => events.push('change'));
        const [a, b] = items(page);

        b.shadowRoot!.querySelector<HTMLElement>('.label')!.click();
        b.click();
        a.click();

        expect(group(page).value).toBe('default');
        expect(items(page).map((item) => item.checked)).toEqual([true, false, false]);
        expect(events).toEqual(['input', 'change', 'input', 'change']);
    });

    it('does nothing for a disabled item, a disabled group or a disabled fieldset, and a cancelled click stops it', async () => {
        const page = await mount(`
            <ge-radio-group id="one"><ge-radio-group-item value="x" disabled aria-label="x"></ge-radio-group-item></ge-radio-group>
            <ge-radio-group id="two" disabled><ge-radio-group-item value="y" aria-label="y"></ge-radio-group-item></ge-radio-group>
            <fieldset disabled><ge-radio-group id="three"><ge-radio-group-item value="z" aria-label="z"></ge-radio-group-item></ge-radio-group></fieldset>
            <ge-radio-group id="four"><ge-radio-group-item value="w" aria-label="w"></ge-radio-group-item></ge-radio-group>`);
        page.querySelector('#four ge-radio-group-item')!.addEventListener('click', (event) => event.preventDefault(), { capture: true });

        for (const item of items(page)) item.click();

        expect([...page.querySelectorAll<GeRadioGroup>('ge-radio-group')].map((g) => g.value)).toEqual([undefined, undefined, undefined, undefined]);
    });

    it('puts one item in the tab order, moves and selects with the arrows, wraps, and skips disabled items', async () => {
        const page = await mount(`
            <button id="before">before</button>
            <ge-radio-group aria-label="Plan">
                <ge-radio-group-item value="a" label="A"></ge-radio-group-item>
                <ge-radio-group-item value="b" label="B" disabled></ge-radio-group-item>
                <ge-radio-group-item value="c" label="C"></ge-radio-group-item>
            </ge-radio-group>
            <button id="after">after</button>`);
        const [a, , c] = items(page);

        expect(items(page).map((item) => item.tabIndex)).toEqual([0, -1, -1]);
        await userEvent.tab();
        await userEvent.tab();
        expect([document.activeElement, group(page).value]).toEqual([a, undefined]);

        await userEvent.keyboard('{ArrowDown}');
        expect([document.activeElement, group(page).value]).toEqual([c, 'c']);
        await userEvent.keyboard('{ArrowRight}');
        expect([document.activeElement, group(page).value]).toEqual([a, 'a']);
        await userEvent.keyboard('{ArrowUp}');
        expect([document.activeElement, group(page).value]).toEqual([c, 'c']);
        await userEvent.keyboard('{ArrowLeft}');
        expect(group(page).value).toBe('a');
        expect(items(page).map((item) => item.tabIndex)).toEqual([0, -1, -1]);

        await userEvent.tab();
        expect(document.activeElement).toBe(page.querySelector('#after'));
        await userEvent.tab({ shift: true });
        expect(document.activeElement).toBe(a);
    });

    it('sends Tab to the selected item, and Space selects the focused one', async () => {
        const page = await mount(`<button>before</button>${FIELDS.replace('<ge-radio-group ', '<ge-radio-group value="compact" ')}`);
        const [, b, c] = items(page);

        expect(items(page).map((item) => item.tabIndex)).toEqual([-1, -1, 0]);
        await userEvent.tab();
        await userEvent.tab();
        expect(document.activeElement).toBe(c);

        b.focus();
        await userEvent.keyboard(' ');
        expect(group(page).value).toBe('comfortable');
    });

    it('swaps the horizontal arrows in right-to-left text but never Up and Down', async () => {
        const page = await mount(`<div dir="rtl">${FIELDS.replace('<ge-radio-group ', '<ge-radio-group orientation="horizontal" value="comfortable" ')}</div>`);
        const [a, b, c] = items(page);
        b.focus();

        await userEvent.keyboard('{ArrowLeft}');
        expect([document.activeElement, group(page).value]).toEqual([c, 'compact']);
        await userEvent.keyboard('{ArrowRight}');
        expect([document.activeElement, group(page).value]).toEqual([b, 'comfortable']);
        await userEvent.keyboard('{ArrowUp}');
        expect([document.activeElement, group(page).value]).toEqual([a, 'default']);
    });

    it('exposes a radio group with checked radios, their names and the orientation to assistive technology', async () => {
        const page = await mount(`
            <ge-radio-group aria-label="Density" orientation="horizontal" value="b">
                <ge-radio-group-item value="a" aria-label="Alpha"></ge-radio-group-item>
                <ge-radio-group-item value="b" label="Beta"></ge-radio-group-item>
                <ge-radio-group-item value="c" aria-label="Gamma" disabled></ge-radio-group-item>
            </ge-radio-group>`);
        await group(page).updateComplete;
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const frameId = frameTree.childFrames?.[0]?.frame.id;
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });
        const props = (node?: (typeof nodes)[number]) => Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        const radio = (name: string) => props(nodes.find((n) => n.role?.value === 'radio' && n.name?.value === name));
        const container = nodes.find((n) => n.role?.value === 'radiogroup');

        expect(container?.name?.value).toBe('Density');
        expect(props(container).orientation).toBe('horizontal');
        expect([radio('Alpha').checked, radio('Beta').checked, radio('Gamma').checked]).toEqual(['false', 'true', 'false']);
        expect(radio('Gamma').disabled).toBe(true);
    });

    it('builds one item per option from the data, using the display, value and disabled functions', async () => {
        const page = await mount('<ge-radio-group aria-label="Plan"></ge-radio-group>');
        const g = group(page);
        g.options = [
            { id: 1, name: 'Free', locked: false },
            { id: 2, name: 'Pro', locked: false },
            { id: 3, name: 'Team', locked: true },
        ];
        g.valueWith = (o) => String((o as { id: number }).id);
        g.displayWith = (o) => (o as { name: string }).name;
        g.disabledWith = (o) => (o as { locked: boolean }).locked;
        g.value = '2';
        await g.updateComplete;
        const rendered = [...g.shadowRoot!.querySelectorAll<GeRadioGroupItem>('ge-radio-group-item')];
        await Promise.all(rendered.map((item) => item.updateComplete));

        expect(rendered.map((item) => [item.value, item.label, item.disabled, item.checked])).toEqual([
            ['1', 'Free', false, false],
            ['2', 'Pro', false, true],
            ['3', 'Team', true, false],
        ]);
        rendered[0].click();
        rendered[2].click();
        expect(g.value).toBe('1');
    });

    it.each(['light', 'dark'])('is named by a ge-label elsewhere in the page and passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`
            <ge-label id="plan-label" for="plan">Plan</ge-label>
            <ge-radio-group id="plan" value="a">
                <ge-radio-group-item value="a" label="Starter"></ge-radio-group-item>
                <ge-radio-group-item value="b" label="Pro" disabled></ge-radio-group-item>
                <ge-radio-group-item value="c" aria-label="Team"></ge-radio-group-item>
            </ge-radio-group>`);

        expect(group(page).getAttribute('aria-labelledby')).toBe('plan-label');
        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales the circle and the dot with the density token', async () => {
        const page = await mount('<ge-radio-group value="a" style="--density-radio: 1.5"><ge-radio-group-item value="a" aria-label="a"></ge-radio-group-item></ge-radio-group>');
        const item = items(page)[0];
        await item.updateComplete;
        const box = item.shadowRoot!.querySelector('.box')!.getBoundingClientRect();
        const dot = item.shadowRoot!.querySelector('.dot')!.getBoundingClientRect();

        expect([box.width, dot.width]).toEqual([24, 15]);
    });

    it('submits the selected value, submits nothing while disabled or empty, and a form reset restores the markup', async () => {
        const page = await mount(`
            <form>
                <ge-radio-group name="plan" value="b">
                    <ge-radio-group-item value="a" aria-label="a"></ge-radio-group-item>
                    <ge-radio-group-item value="b" aria-label="b"></ge-radio-group-item>
                </ge-radio-group>
                <ge-radio-group name="unset"><ge-radio-group-item value="x" aria-label="x"></ge-radio-group-item></ge-radio-group>
                <ge-radio-group name="off" value="x" disabled><ge-radio-group-item value="x" aria-label="x"></ge-radio-group-item></ge-radio-group>
            </form>`);
        const form = page.querySelector('form')!;
        const submitted = () => [...new FormData(form).entries()];

        expect(submitted()).toEqual([['plan', 'b']]);
        items(page)[0].click();
        await group(page).updateComplete;
        expect(submitted()).toEqual([['plan', 'a']]);

        form.reset();
        await group(page).updateComplete;
        expect([group(page).value, submitted()]).toEqual(['b', [['plan', 'b']]]);
    });
});
