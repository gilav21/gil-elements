import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeAccordion } from './accordion.js';
import type { GeAccordionItem } from './sub/accordion-item.js';

const accordion = (page: HTMLElement) => page.querySelector<GeAccordion>('ge-accordion')!;
const items = (page: HTMLElement) => [...page.querySelectorAll<GeAccordionItem>('ge-accordion-item')];
const trigger = (item: Element) => item.querySelector('ge-accordion-trigger')!.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const panel = (item: Element) => item.querySelector('ge-accordion-content')!.shadowRoot!.querySelector('.panel');
const expanded = (page: HTMLElement) => items(page).map((item) => trigger(item).getAttribute('aria-expanded'));
const settle = async (page: HTMLElement) => {
    await accordion(page).updateComplete;
    for (const item of items(page)) {
        await item.updateComplete;
        await item.querySelector('ge-accordion-trigger')?.updateComplete;
        await item.querySelector('ge-accordion-content')?.updateComplete;
    }
};
const CUSTOM = (attrs = '') => `
    <ge-accordion ${attrs}>
        <ge-accordion-item value="a"><ge-accordion-trigger>Is it accessible?</ge-accordion-trigger><ge-accordion-content>Yes.</ge-accordion-content></ge-accordion-item>
        <ge-accordion-item value="b"><ge-accordion-trigger>Is it styled?</ge-accordion-trigger><ge-accordion-content>Yes.</ge-accordion-content></ge-accordion-item>
        <ge-accordion-item value="c"><ge-accordion-trigger>Is it animated?</ge-accordion-trigger><ge-accordion-content>No.</ge-accordion-content></ge-accordion-item>
    </ge-accordion>`;

describe('ge-accordion', () => {
    it('single: opening one closes the other, pressing the open one closes it, and each change is announced once', async () => {
        const page = await mount(CUSTOM());
        const [a, b] = items(page);
        const seen: string[][] = [];
        accordion(page).addEventListener('change', () => seen.push([...accordion(page).value]));

        trigger(a).click();
        trigger(b).click();
        await settle(page);
        expect([expanded(page), panel(a), panel(b) === null]).toEqual([['false', 'true', 'false'], null, false]);
        trigger(b).click();
        await settle(page);

        expect([expanded(page), panel(b)]).toEqual([['false', 'false', 'false'], null]);
        expect(seen).toEqual([['a'], ['b'], []]);
    });

    it('single with collapsible="false" keeps one item open and says nothing when pressing it changes nothing', async () => {
        const page = await mount(CUSTOM('value="b" collapsible="false"'));
        await settle(page);
        let announced = 0;
        accordion(page).addEventListener('change', () => announced++);

        trigger(items(page)[1]).click();
        await settle(page);
        expect([expanded(page), announced]).toEqual([['false', 'true', 'false'], 0]);
        trigger(items(page)[0]).click();
        await settle(page);

        expect([expanded(page), announced]).toEqual([['true', 'false', 'false'], 1]);

        const stated = await mount(CUSTOM('value="a" collapsible="true"'));
        await settle(stated);
        trigger(items(stated)[0]).click();
        await settle(stated);
        expect(expanded(stated)).toEqual(['false', 'false', 'false']);
    });

    it('multiple: items open and close independently, and value lists every open one', async () => {
        const page = await mount(CUSTOM('type="multiple" value="a"'));
        await settle(page);
        const [a, b, c] = items(page);

        trigger(c).click();
        trigger(b).click();
        trigger(a).click();
        await settle(page);

        expect([expanded(page), accordion(page).value]).toEqual([['false', 'true', 'true'], ['c', 'b']]);
    });

    it('honours only the first value in single mode, and follows a value set from outside', async () => {
        const page = await mount(CUSTOM('value="c,a"'));
        await settle(page);
        expect([expanded(page), accordion(page).value]).toEqual([['false', 'false', 'true'], ['c']]);

        accordion(page).value = ['a'];
        await settle(page);

        expect(expanded(page)).toEqual(['true', 'false', 'false']);
    });

    it('builds the trigger and panel from heading and content, and a skeleton item shows neither', async () => {
        const page = await mount(`
            <ge-accordion value="q">
                <ge-accordion-item value="q" heading="Quick" content="Short answer."></ge-accordion-item>
                <ge-accordion-item value="s" skeleton></ge-accordion-item>
            </ge-accordion>`);
        await settle(page);
        const [quick, skeleton] = items(page);
        const quickTrigger = quick.shadowRoot!.querySelector('ge-accordion-trigger')!;
        await quickTrigger.updateComplete;

        expect(quickTrigger.shadowRoot!.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
        expect(quick.shadowRoot!.querySelector('ge-accordion-content')!.textContent).toBe('Short answer.');
        expect(skeleton.shadowRoot!.querySelectorAll('ge-skeleton')).toHaveLength(2);
        expect(skeleton.shadowRoot!.querySelector('ge-accordion-trigger')).toBeNull();
    });

    it('is reached by Tab one trigger at a time, toggled by Enter and Space, and follows the value across nested accordions', async () => {
        const page = await mount(CUSTOM());
        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        await userEvent.tab();
        await userEvent.keyboard(' ');
        await settle(page);

        expect([document.activeElement, expanded(page)]).toEqual([items(page)[1].querySelector('ge-accordion-trigger'), ['false', 'true', 'false']]);

        const nested = await mount(`
            <ge-accordion value="outer"><ge-accordion-item value="outer"><ge-accordion-trigger>Outer</ge-accordion-trigger><ge-accordion-content>${CUSTOM()}</ge-accordion-content></ge-accordion-item></ge-accordion>`);
        await settle(nested);
        const inner = nested.querySelectorAll<GeAccordion>('ge-accordion')[1];
        trigger(inner.querySelector('ge-accordion-item')!).click();
        await inner.updateComplete;

        expect([inner.value, nested.querySelector<GeAccordion>('ge-accordion')!.value]).toEqual([['a'], ['outer']]);
    });

    it('exposes a heading per item and a button with its expanded state to assistive technology', async () => {
        const page = await mount(CUSTOM('value="b"'));
        await settle(page);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const props = (node?: (typeof nodes)[number]) => Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        const button = (name: string) => props(nodes.find((n) => n.role?.value === 'button' && n.name?.value === name));

        expect(nodes.filter((n) => n.role?.value === 'heading')).toHaveLength(3);
        expect(['Is it accessible?', 'Is it styled?'].map((name) => button(name).expanded)).toEqual([false, true]);
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(CUSTOM('value="a"'));
        await settle(page);

        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales the trigger padding with the accordion density token, and draws a divider under every item', async () => {
        const page = await mount(CUSTOM('style="--density-accordion: 1.5"'));
        await settle(page);
        const style = getComputedStyle(trigger(items(page)[0]));
        const divider = getComputedStyle(items(page)[0].shadowRoot!.querySelector('.item')!);

        expect([style.paddingTop, style.paddingBottom, divider.borderBottomWidth]).toEqual(['24px', '24px', '1px']);
    });
});
