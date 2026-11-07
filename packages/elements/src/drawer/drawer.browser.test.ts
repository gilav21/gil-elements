import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { page as browser, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeDrawer } from './index.js';

const MARKUP = `<ge-drawer>
  <ge-drawer-trigger><ge-button id="open" variant="outline">Open</ge-button></ge-drawer-trigger>
  <ge-drawer-content heading="Move goal" description="Set your daily activity goal.">
    <input id="name" aria-label="Goal">
    <ge-drawer-footer><ge-drawer-close id="done"><ge-button>Done</ge-button></ge-drawer-close></ge-drawer-footer>
  </ge-drawer-content>
</ge-drawer>`;

const drawer = (page: HTMLElement) => page.querySelector<GeDrawer>('ge-drawer')!;
const content = (page: HTMLElement) => page.querySelector('ge-drawer-content')!;
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
const openDrawer = async (direction: string, body = '<p>Body</p>', dir = 'ltr') => {
    const page = await mount(`<div dir="${dir}"><ge-drawer open direction="${direction}"><ge-drawer-content heading="Panel">${body}</ge-drawer-content></ge-drawer></div>`);
    await settle(page);
    return page;
};

describe('ge-drawer', () => {
    it('opens from the trigger as a named modal dialog, locks the page, and puts focus on the first control', async () => {
        const page = await mount(MARKUP);
        await settle(page);
        expect(inner(page, '.panel')).toBeNull();

        await open(page);

        const root = inner(page, '[data-slot=drawer]')!;
        expect(root.getAttribute('role')).toBe('dialog');
        expect(root.getAttribute('aria-modal')).toBe('true');
        expect(root.getAttribute('aria-label')).toBe('Move goal');
        expect(getComputedStyle(document.body).overflow).toBe('hidden');
        expect(deepActive()).toBe(page.querySelector('#name'));
        expect(inner(page, '.handle')).not.toBeNull();
    });

    it('closes from the overlay, Escape and a slotted ge-drawer-close, and gives focus back', async () => {
        const page = await mount(MARKUP);
        const trigger = page.querySelector('#open')!.shadowRoot!.querySelector('button');

        for (const how of ['overlay', 'escape', 'slotted'] as const) {
            page.querySelector<HTMLElement>('#open')!.focus();
            await open(page);
            if (how === 'overlay') inner(page, '.overlay')!.click();
            else if (how === 'escape') await userEvent.keyboard('{Escape}');
            else page.querySelector('#done ge-button')!.shadowRoot!.querySelector('button')!.click();
            await settle(page);
            expect(drawer(page).open, how).toBe(false);
            expect(deepActive(), how).toBe(trigger);
        }
        expect(document.body.style.overflow).toBe('');
    });

    it.each([
        ['right', { ltr: 'right', rtl: 'left' }],
        ['left', { ltr: 'left', rtl: 'right' }],
    ] as const)('direction=%s is a full-height strip at three quarters width up to 24rem, on the logical edge, with no handle', async (direction, edge) => {
        for (const dir of ['ltr', 'rtl'] as const) {
            const page = await openDrawer(direction, '<p>Body</p>', dir);
            const box = inner(page, '.panel')!.getBoundingClientRect();

            expect(box.height, dir).toBe(window.innerHeight);
            expect(box.width, dir).toBe(Math.min(window.innerWidth * 0.75, window.innerWidth >= 640 ? 384 : Infinity));
            if (edge[dir] === 'left') expect(box.left, dir).toBe(0);
            else expect(box.right, dir).toBe(window.innerWidth);
            expect(inner(page, '.handle'), dir).toBeNull();
        }
    });

    it.each(['top', 'bottom'] as const)('direction=%s spans the width, hugs its edge and shows the handle bar', async (direction) => {
        const page = await openDrawer(direction);
        const box = inner(page, '.panel')!.getBoundingClientRect();
        const handle = inner(page, '.handle')!.getBoundingClientRect();

        expect(box.width).toBe(window.innerWidth);
        expect(box.height).toBeLessThan(window.innerHeight / 2);
        if (direction === 'top') expect(box.top).toBe(0);
        else expect(box.bottom).toBe(window.innerHeight);
        expect(handle.width).toBe(100);
        expect(handle.height).toBe(8);
        expect(handle.left + handle.width / 2).toBeCloseTo(window.innerWidth / 2, 0);
    });

    it('rounds the corners on the open side only', async () => {
        const bottom = getComputedStyle(inner(await openDrawer('bottom'), '.panel')!);
        expect([bottom.borderTopLeftRadius, bottom.borderTopRightRadius, bottom.borderBottomLeftRadius]).toEqual(['10px', '10px', '0px']);
        const top = getComputedStyle(inner(await openDrawer('top'), '.panel')!);
        expect([top.borderBottomLeftRadius, top.borderBottomRightRadius, top.borderTopLeftRadius]).toEqual(['10px', '10px', '0px']);
    });

    it('follows a direction changed while it is open', async () => {
        const page = await openDrawer('bottom');
        drawer(page).direction = 'left';
        await settle(page);
        expect(inner(page, '.panel')!.getBoundingClientRect().left).toBe(0);
        expect(inner(page, '.handle')).toBeNull();
    });

    it.each(['top', 'bottom'] as const)('caps a tall %s drawer at 80%% of the screen and scrolls inside it', async (direction) => {
        const page = await openDrawer(direction, '<p>Long text</p>'.repeat(80));
        const panel = inner(page, '.panel')!;

        expect(panel.getBoundingClientRect().height).toBe(window.innerHeight * 0.8);
        expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
        panel.scrollTop = panel.scrollHeight;
        expect(panel.scrollTop).toBeGreaterThan(0);
    });

    it('pins the footer to the bottom of a tall left or right drawer', async () => {
        const page = await openDrawer('right', '<ge-drawer-footer id="foot">Actions</ge-drawer-footer>');
        expect(page.querySelector('#foot')!.getBoundingClientRect().bottom).toBe(window.innerHeight);
    });

    it('keeps Tab inside the panel, and takes its name from a slotted title', async () => {
        const page = await mount(`<ge-drawer open><ge-drawer-content><ge-drawer-header><ge-drawer-title>Filters</ge-drawer-title></ge-drawer-header><input id="a" aria-label="A"><input id="b" aria-label="B"></ge-drawer-content></ge-drawer>`);
        await settle(page);
        expect(inner(page, '[data-slot=drawer]')!.getAttribute('aria-label')).toBe('Filters');

        expect(deepActive()).toBe(page.querySelector('#a'));
        await userEvent.tab();
        expect(deepActive()).toBe(page.querySelector('#b'));
        await userEvent.tab();
        expect(deepActive()).toBe(page.querySelector('#a'));
    });

    it('a ge-drawer-close never opens the drawer', async () => {
        const page = await mount(`<ge-drawer><ge-drawer-close id="x"><ge-button>Close</ge-button></ge-drawer-close><ge-drawer-content heading="S"></ge-drawer-content></ge-drawer>`);
        await settle(page);

        page.querySelector('#x ge-button')!.shadowRoot!.querySelector('button')!.click();
        await settle(page);

        expect(drawer(page).open).toBe(false);
    });

    it('takes three quarters of a phone-width screen', async () => {
        await browser.viewport(400, 800);
        try {
            const page = await openDrawer('left');
            expect(inner(page, '.panel')!.getBoundingClientRect().width).toBe(300);
        } finally {
            await browser.viewport(1280, 800);
        }
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations while open', async () => {
            const page = await mount(MARKUP.replace('<ge-drawer>', '<ge-drawer open>'));
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
