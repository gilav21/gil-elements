import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeCardAccordion } from './card-accordion.js';
import type { GeCardAccordionItem } from './sub/card-accordion-item.js';

const root = (page: HTMLElement) => page.querySelector<GeCardAccordion>('ge-card-accordion')!;
const items = (page: HTMLElement) => [...page.querySelectorAll<GeCardAccordionItem>('ge-card-accordion-item')];
const quickButton = (item: Element) => item.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const customButton = (item: Element) => item.querySelector('ge-card-accordion-trigger')!.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
const body = (item: Element) => item.querySelector('ge-card-accordion-content')!.shadowRoot!.querySelector<HTMLElement>('.body')!;
const settle = async (page: HTMLElement) => {
    await root(page).updateComplete;
    for (const item of items(page)) {
        await item.updateComplete;
        for (const part of item.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('ge-card-accordion-trigger, ge-card-accordion-content')) await part.updateComplete;
    }
};

const QUICK = (attrs = '') => `
    <ge-card-accordion ${attrs} style="width:360px">
        <ge-card-accordion-item value="a" heading="Billing" description="Invoices and plans" content="Your next invoice is due in May."></ge-card-accordion-item>
        <ge-card-accordion-item value="b" heading="Security" content="Two-factor is on."></ge-card-accordion-item>
    </ge-card-accordion>`;
const CUSTOM = `
    <ge-card-accordion value="a" style="width:360px">
        <ge-card-accordion-item value="a">
            <ge-card-accordion-trigger>Deploys<ge-card-accordion-actions><button id="retry">Retry</button></ge-card-accordion-actions></ge-card-accordion-trigger>
            <ge-card-accordion-content><button id="inside">Open log</button></ge-card-accordion-content>
        </ge-card-accordion-item>
        <ge-card-accordion-item value="b">
            <ge-card-accordion-trigger>Backups</ge-card-accordion-trigger>
            <ge-card-accordion-content><button id="hidden">Restore</button></ge-card-accordion-content>
        </ge-card-accordion-item>
    </ge-card-accordion>`;

describe('ge-card-accordion', () => {
    it('quick form: shows heading, description and chevron; opening one card closes the other and announces change', async () => {
        const page = await mount(QUICK());
        await settle(page);
        const [a, b] = items(page);
        const seen: string[][] = [];
        root(page).addEventListener('change', () => seen.push([...root(page).value]));

        expect(a.shadowRoot!.querySelector('.title')!.textContent).toBe('Billing');
        expect(a.shadowRoot!.querySelector('.description')!.textContent).toBe('Invoices and plans');
        expect(b.shadowRoot!.querySelector('.description')).toBeNull();

        quickButton(a).click();
        await settle(page);
        expect(quickButton(a).getAttribute('aria-expanded')).toBe('true');
        expect(a.shadowRoot!.querySelector('.body')!.hasAttribute('inert')).toBe(false);
        expect(b.shadowRoot!.querySelector('.body')!.hasAttribute('inert')).toBe(true);
        expect(getComputedStyle(a.shadowRoot!.querySelector('.card')!).boxShadow).not.toBe(getComputedStyle(b.shadowRoot!.querySelector('.card')!).boxShadow);

        quickButton(b).click();
        await settle(page);
        expect([quickButton(a).getAttribute('aria-expanded'), quickButton(b).getAttribute('aria-expanded'), seen]).toEqual(['false', 'true', [['a'], ['b']]]);
    });

    it('animates the height: a closed card keeps its body in the layout at zero height, an open one grows to the text', async () => {
        const page = await mount(QUICK());
        await settle(page);
        const [a] = items(page);
        const panel = a.shadowRoot!.querySelector<HTMLElement>('.panel')!;
        expect(panel.getBoundingClientRect().height).toBe(0);

        quickButton(a).click();
        await settle(page);
        await expect.poll(() => panel.getBoundingClientRect().height, { timeout: 2000 }).toBeGreaterThan(20);
    });

    it('custom form: the actions never toggle the card, the chevron and label do, and a closed body is inert', async () => {
        const page = await mount(CUSTOM);
        await settle(page);
        const [a, b] = items(page);

        expect(body(a).hasAttribute('inert')).toBe(false);
        expect(body(b).hasAttribute('inert')).toBe(true);
        expect(a.querySelector('ge-card-accordion-actions')!.slot).toBe('actions');

        let reached = 0;
        root(page).addEventListener('click', () => reached++);
        page.querySelector<HTMLButtonElement>('#retry')!.click();
        await settle(page);
        expect(reached).toBe(0);
        expect(customButton(a).getAttribute('aria-expanded')).toBe('true');

        a.querySelector('ge-card-accordion-trigger')!.shadowRoot!.querySelector<HTMLButtonElement>('.chevron')!.click();
        await settle(page);
        expect(customButton(a).getAttribute('aria-expanded')).toBe('false');
        expect(body(a).hasAttribute('inert')).toBe(true);

        customButton(b).click();
        await settle(page);
        expect([customButton(b).getAttribute('aria-expanded'), body(b).hasAttribute('inert')]).toEqual(['true', false]);
    });

    it('lays a long title out on one line with the chevron still in view, and pads by density', async () => {
        const page = await mount(`<div style="width:240px;--density:1.5"><ge-card-accordion><ge-card-accordion-item value="a" heading="A heading far too long to fit on a single line of this card"></ge-card-accordion-item></ge-card-accordion></div>`);
        await settle(page);
        const button = quickButton(items(page)[0]!);
        const title = items(page)[0]!.shadowRoot!.querySelector('.title')!;
        expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
        expect(button.getBoundingClientRect().right - items(page)[0]!.shadowRoot!.querySelector('svg')!.getBoundingClientRect().right).toBeCloseTo(Number.parseFloat(getComputedStyle(button).paddingRight), 0);
        expect(Number.parseFloat(getComputedStyle(button).paddingTop)).toBe(window.innerWidth >= 640 ? 36 : 24);
    });

    it('skeleton shows placeholders in the card shape and has no button', async () => {
        const page = await mount('<ge-card-accordion><ge-card-accordion-item value="s" skeleton></ge-card-accordion-item></ge-card-accordion>');
        await settle(page);
        const item = items(page)[0]!;
        expect(item.shadowRoot!.querySelectorAll('ge-skeleton').length).toBe(3);
        expect(item.shadowRoot!.querySelector('button')).toBeNull();
    });

    it('has no accessibility violations open or closed', async () => {
        const page = await mount(QUICK('value="a"'));
        await settle(page);
        const result = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});
