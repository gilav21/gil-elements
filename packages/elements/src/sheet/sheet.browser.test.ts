import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { page as browser, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeSheet } from './index.js';

const MARKUP = `<ge-sheet>
  <ge-sheet-trigger><ge-button id="open" variant="outline">Open</ge-button></ge-sheet-trigger>
  <ge-sheet-content heading="Edit profile" description="Make changes to your profile here.">
    <input id="name" aria-label="Name">
    <ge-sheet-footer><ge-sheet-close id="done"><ge-button>Done</ge-button></ge-sheet-close></ge-sheet-footer>
  </ge-sheet-content>
</ge-sheet>`;

const sheet = (page: HTMLElement) => page.querySelector<GeSheet>('ge-sheet')!;
const content = (page: HTMLElement) => page.querySelector('ge-sheet-content')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
    }
};
const inner = (page: HTMLElement, selector: string) => content(page).shadowRoot!.querySelector<HTMLElement>(selector);
const open = async (page: HTMLElement) => {
    page.querySelector<HTMLElement>('#open')!.click();
    await settle(page);
};

describe('ge-sheet', () => {
    it('opens from the trigger as a named modal dialog, locks the page, and puts focus on the first control', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        expect(inner(page, '.panel')).toBeNull();

        await open(page);

        const root = inner(page, '[data-slot=sheet]')!;
        expect(root.getAttribute('role')).toBe('dialog');
        expect(root.getAttribute('aria-modal')).toBe('true');
        expect(root.getAttribute('aria-label')).toBe('Edit profile');
        expect(getComputedStyle(document.body).overflow).toBe('hidden');
        expect(deepActive()).toBe(page.querySelector('#name'));
    });

    it('closes from the overlay, the close button, Escape and a slotted ge-sheet-close, and gives focus back', async () => {
        const page = await mount(MARKUP);
        const trigger = page.querySelector('#open')!.shadowRoot!.querySelector('button');

        for (const how of ['overlay', 'close', 'escape', 'slotted'] as const) {
            page.querySelector<HTMLElement>('#open')!.focus();
            await open(page);
            if (how === 'overlay') inner(page, '.overlay')!.click();
            else if (how === 'close') inner(page, '.close')!.click();
            else if (how === 'escape') await userEvent.keyboard('{Escape}');
            else page.querySelector('#done ge-button')!.shadowRoot!.querySelector('button')!.click();
            await settle(page);
            expect(sheet(page).open, how).toBe(false);
            expect(deepActive(), how).toBe(trigger);
        }
        expect(document.body.style.overflow).toBe('');
    });

    it.each([
        ['right', { ltr: 'right', rtl: 'left' }],
        ['left', { ltr: 'left', rtl: 'right' }],
    ] as const)('side=%s is a full-height strip at three quarters width up to 24rem, on the logical edge', async (side, edge) => {
        for (const dir of ['ltr', 'rtl'] as const) {
            const page = await mount(`<div dir="${dir}"><ge-sheet open><ge-sheet-content side="${side}" heading="Panel"><p>Body</p></ge-sheet-content></ge-sheet></div>`);
            await settle(page);
            const box = inner(page, '.panel')!.getBoundingClientRect();

            expect(box.height, dir).toBe(window.innerHeight);
            expect(box.width, dir).toBe(Math.min(window.innerWidth * 0.75, window.innerWidth >= 640 ? 384 : Infinity));
            if (edge[dir] === 'left') expect(box.left, dir).toBe(0);
            else expect(box.right, dir).toBe(window.innerWidth);
        }
    });

    it.each([
        ['top', 'top'],
        ['bottom', 'bottom'],
    ] as const)('side=%s spans the full width and hugs its edge, as tall as its content', async (side, edge) => {
        const page = await mount(`<ge-sheet open><ge-sheet-content side="${side}" heading="Panel"><p>Body</p></ge-sheet-content></ge-sheet>`);
        await settle(page);
        const box = inner(page, '.panel')!.getBoundingClientRect();

        expect(box.width).toBe(window.innerWidth);
        expect(box.height).toBeLessThan(window.innerHeight / 2);
        if (edge === 'top') expect(box.top).toBe(0);
        else expect(box.bottom).toBe(window.innerHeight);
    });

    it('keeps Tab inside the panel, and takes its name from a slotted title', async () => {
        const page = await mount(`<ge-sheet open><ge-sheet-content><ge-sheet-header><ge-sheet-title>Filters</ge-sheet-title></ge-sheet-header><input id="a" aria-label="A"><input id="b" aria-label="B"></ge-sheet-content></ge-sheet>`);
        await settle(page);
        expect(inner(page, '[data-slot=sheet]')!.getAttribute('aria-label')).toBe('Filters');

        expect(deepActive()).toBe(page.querySelector('#a'));
        await userEvent.tab();
        expect(deepActive()).toBe(page.querySelector('#b'));
        await userEvent.tab();
        expect(deepActive()).toBe(inner(page, '.close'));
        await userEvent.tab();
        expect(deepActive()).toBe(page.querySelector('#a'));
    });

    it('a ge-sheet-close never opens the sheet', async () => {
        const page = await mount(`<ge-sheet><ge-sheet-close id="x"><ge-button>Close</ge-button></ge-sheet-close><ge-sheet-content heading="S"></ge-sheet-content></ge-sheet>`);
        await settle(page);

        page.querySelector('#x ge-button')!.shadowRoot!.querySelector('button')!.click();
        await settle(page);

        expect(sheet(page).open).toBe(false);
    });

    it('takes three quarters of a phone-width screen', async () => {
        await browser.viewport(400, 800);
        try {
            const page = await mount(`<ge-sheet open><ge-sheet-content heading="Panel"><p>Body</p></ge-sheet-content></ge-sheet>`);
            await settle(page);
            expect(inner(page, '.panel')!.getBoundingClientRect().width).toBe(300);
        } finally {
            await browser.viewport(1280, 800);
        }
    });

    it('scrolls a long body inside the panel instead of growing past the screen', async () => {
        const page = await mount(`<ge-sheet open><ge-sheet-content heading="Terms">${'<p>Long text</p>'.repeat(80)}</ge-sheet-content></ge-sheet>`);
        await settle(page);
        const panel = inner(page, '.panel')!;

        expect(panel.getBoundingClientRect().height).toBe(window.innerHeight);
        expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
        panel.scrollTop = panel.scrollHeight;
        expect(panel.scrollTop).toBeGreaterThan(0);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations while open', async () => {
            const page = await mount(MARKUP.replace('<ge-sheet>', '<ge-sheet open>'));
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
