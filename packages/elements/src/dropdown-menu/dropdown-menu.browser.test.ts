import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { DropdownItem, GeDropdownMenu } from './index.js';

const MARKUP = (content = '', wrap = '') => `<div style="padding:60px 300px 300px;${wrap}">
<ge-dropdown-menu>
  <ge-dropdown-menu-trigger><ge-button id="open" variant="outline">Open</ge-button></ge-dropdown-menu-trigger>
  <ge-dropdown-menu-content ${content}>
    <ge-dropdown-menu-label>My account</ge-dropdown-menu-label>
    <ge-dropdown-menu-item id="profile" shortcut="⇧⌘P">Profile</ge-dropdown-menu-item>
    <ge-dropdown-menu-item id="billing" disabled>Billing</ge-dropdown-menu-item>
    <ge-dropdown-menu-separator></ge-dropdown-menu-separator>
    <ge-dropdown-menu-sub>
      <ge-dropdown-menu-sub-trigger id="more">More tools</ge-dropdown-menu-sub-trigger>
      <ge-dropdown-menu-sub-content>
        <ge-dropdown-menu-item id="save">Save page</ge-dropdown-menu-item>
        <ge-dropdown-menu-item id="print">Print</ge-dropdown-menu-item>
      </ge-dropdown-menu-sub-content>
    </ge-dropdown-menu-sub>
    <ge-dropdown-menu-item id="logout">Log out</ge-dropdown-menu-item>
  </ge-dropdown-menu-content>
</ge-dropdown-menu>
<button id="outside">outside</button>
</div>`;

const menu = (page: HTMLElement) => page.querySelector<GeDropdownMenu>('ge-dropdown-menu')!;
const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
const open = async (page: HTMLElement) => {
    el(page, 'open').click();
    await settle(page);
};
/** A submenu closes 100ms after it is told to. */
const afterGrace = async (page: HTMLElement) => {
    await new Promise((r) => setTimeout(r, 150));
    await settle(page);
};
const active = () => deepActive(document);
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);
const visible = (e: Element) => getComputedStyle(e).display !== 'none';

afterEach(() => vi.useRealTimers());

describe('ge-dropdown-menu', () => {
    it('opens beneath its trigger with focus on the first enabled item, and closes from outside, Escape or an item', async () => {
        const page = await mount(MARKUP());
        const panel = page.querySelector('ge-dropdown-menu-content')!;
        await settle(page);
        expect(visible(panel)).toBe(false);

        await open(page);
        expect(menu(page).open).toBe(true);
        expect(visible(panel)).toBe(true);
        expect(panel.getAttribute('role')).toBe('menu');
        near(panel.getBoundingClientRect().top, menu(page).getBoundingClientRect().bottom + 4);
        expect(active()).toBe(el(page, 'profile'));

        el(page, 'outside').focus();
        el(page, 'outside').click();
        await settle(page);
        expect(menu(page).open).toBe(false);
        expect(active()).toBe(el(page, 'outside'));

        await open(page);
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(menu(page).open).toBe(false);
        expect(active()).toBe(el(page, 'open').shadowRoot!.querySelector('button'));

        await open(page);
        el(page, 'logout').click();
        await settle(page);
        expect(menu(page).open).toBe(false);
    });

    it('opens from ArrowDown on the trigger and fires open-change only for changes the user made', async () => {
        const page = await mount(MARKUP());
        const changes: boolean[] = [];
        menu(page).addEventListener('open-change', (e) => changes.push((e as CustomEvent<boolean>).detail));
        el(page, 'open').focus();
        await userEvent.keyboard('{ArrowDown}');
        await settle(page);
        expect(menu(page).open).toBe(true);
        expect(active()).toBe(el(page, 'profile'));

        menu(page).open = false;
        await settle(page);
        expect(changes).toEqual([true]);
    });

    it('walks the enabled items with the arrow keys and Tab, wrapping, skipping the label, the disabled row and submenu items', async () => {
        const page = await mount(MARKUP());
        await open(page);
        const walk = async (key: string) => {
            await userEvent.keyboard(key);
            return active()?.id;
        };
        expect(await walk('{ArrowDown}')).toBe('more');
        expect(await walk('{ArrowDown}')).toBe('logout');
        expect(await walk('{ArrowDown}')).toBe('profile');
        expect(await walk('{ArrowUp}')).toBe('logout');
        expect(await walk('{Tab}')).toBe('profile');
        expect(await walk('{Shift>}{Tab}{/Shift}')).toBe('logout');
        expect(menu(page).open).toBe(true);
    });

    it('lands on the last item for Up and the first for Down when focus is on the panel itself', async () => {
        const page = await mount(MARKUP());
        await open(page);
        const panel = page.querySelector<HTMLElement>('ge-dropdown-menu-content')!;
        panel.focus();
        await userEvent.keyboard('{ArrowUp}');
        expect(active()?.id).toBe('logout');
        panel.focus();
        await userEvent.keyboard('{ArrowDown}');
        expect(active()?.id).toBe('profile');
    });

    it('leaves a key pressed in a control nested in a row to that control', async () => {
        const page = await mount(MARKUP().replace('Log out', 'Log out <input id="nested" aria-label="Note">'));
        let clicks = 0;
        el(page, 'logout').addEventListener('click', () => clicks++);
        await open(page);
        el(page, 'nested').focus();
        await userEvent.keyboard('{Enter}');
        expect(clicks).toBe(0);
        expect(menu(page).open).toBe(true);
    });

    it('turns Enter and Space into one click on an enabled row and ignores a disabled one in every way', async () => {
        const page = await mount(MARKUP());
        const clicks: string[] = [];
        page.addEventListener('click', (e) => (e.target as HTMLElement).id && clicks.push((e.target as HTMLElement).id));
        await open(page);
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(clicks.filter((id) => id === 'profile')).toHaveLength(1);
        expect(menu(page).open).toBe(false);

        await open(page);
        el(page, 'billing').focus();
        await userEvent.keyboard('{Enter}');
        el(page, 'billing').click();
        expect(clicks).not.toContain('billing');
        expect(menu(page).open).toBe(true);
        expect(el(page, 'billing').getAttribute('aria-disabled')).toBe('true');

        el(page, 'logout').focus();
        await userEvent.keyboard(' ');
        expect(clicks.filter((id) => id === 'logout')).toHaveLength(1);
    });

    it('aligns the panel to the start, centre or end of the trigger, following the text direction', async () => {
        const check = async (attrs: string, wrap: string, expectation: (p: DOMRect, t: DOMRect) => void) => {
            const page = await mount(MARKUP(attrs, wrap));
            await open(page);
            expectation(page.querySelector('ge-dropdown-menu-content')!.getBoundingClientRect(), menu(page).getBoundingClientRect());
            menu(page).open = false;
        };
        await check('', '', (p, t) => near(p.left, t.left));
        await check('align="center"', '', (p, t) => near(p.left + p.width / 2, t.left + t.width / 2));
        await check('align="end"', '', (p, t) => near(p.right, t.right));
        await check('', 'direction:rtl;', (p, t) => near(p.right, t.right));
    });

    it('lays a row out with its shortcut at the far end, inset indented, at the density the page sets', async () => {
        const page = await mount(MARKUP('', '--density:2;'));
        await open(page);
        const row = el(page, 'profile');
        expect(getComputedStyle(row).paddingLeft).toBe('16px');
        expect(getComputedStyle(row).paddingTop).toBe('12px');
        const shortcut = row.shadowRoot!.querySelector('.shortcut')!.getBoundingClientRect();
        near(shortcut.right, row.getBoundingClientRect().right - 16);
        row.setAttribute('inset', '');
        expect(getComputedStyle(row).paddingLeft).toBe('32px');
    });

    it('has no axe violations open', async () => {
        useTheme('light');
        const page = await mount(MARKUP());
        await open(page);
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations).toEqual([]);
    });
});

describe('ge-dropdown-menu submenu', () => {
    const subPanel = (page: HTMLElement) => page.querySelector('ge-dropdown-menu-sub-content')!;

    it('opens on hover and survives the pointer crossing to the panel, closing 100ms after it leaves', async () => {
        const page = await mount(MARKUP());
        await open(page);
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const more = el(page, 'more');
        more.dispatchEvent(new MouseEvent('mouseenter'));
        await vi.advanceTimersByTimeAsync(0);
        expect(visible(subPanel(page))).toBe(true);
        expect(more.getAttribute('aria-expanded')).toBe('true');

        more.dispatchEvent(new MouseEvent('mouseleave'));
        await vi.advanceTimersByTimeAsync(60);
        subPanel(page).dispatchEvent(new MouseEvent('mouseenter'));
        await vi.advanceTimersByTimeAsync(200);
        expect(visible(subPanel(page))).toBe(true);

        subPanel(page).dispatchEvent(new MouseEvent('mouseleave'));
        await vi.advanceTimersByTimeAsync(99);
        expect(visible(subPanel(page))).toBe(true);
        await vi.advanceTimersByTimeAsync(2);
        expect(visible(subPanel(page))).toBe(false);
        expect(more.getAttribute('aria-expanded')).toBe('false');
    });

    it('sits beside its trigger row, mirrored in right-to-left text', async () => {
        for (const dir of ['ltr', 'rtl']) {
            const page = await mount(MARKUP('', `direction:${dir};`));
            await open(page);
            el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
            await settle(page);
            const sub = subPanel(page).getBoundingClientRect();
            const row = el(page, 'more').getBoundingClientRect();
            near(sub.top, row.top);
            if (dir === 'ltr') near(sub.left, row.right + 4);
            else near(sub.right, row.left - 4);
            menu(page).open = false;
        }
    });

    it('opens with the forward arrow or Enter into its first item, and the back arrow or Escape closes only it', async () => {
        const page = await mount(MARKUP());
        await open(page);
        el(page, 'more').focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(page);
        expect(active()).toBe(el(page, 'save'));
        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        expect(active()).toBe(el(page, 'save'));

        await userEvent.keyboard('{ArrowLeft}');
        await afterGrace(page);
        expect(visible(subPanel(page))).toBe(false);
        expect(active()).toBe(el(page, 'more'));

        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(active()).toBe(el(page, 'save'));
        await userEvent.keyboard('{Escape}');
        await afterGrace(page);
        expect(visible(subPanel(page))).toBe(false);
        expect(menu(page).open).toBe(true);
        expect(active()).toBe(el(page, 'more'));
    });

    it('swaps the forward and back arrows in right-to-left text', async () => {
        const page = await mount(MARKUP('', 'direction:rtl;'));
        await open(page);
        el(page, 'more').focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(page);
        expect(visible(subPanel(page))).toBe(false);
        await userEvent.keyboard('{ArrowLeft}');
        await settle(page);
        expect(active()).toBe(el(page, 'save'));
        await userEvent.keyboard('{ArrowRight}');
        await afterGrace(page);
        expect(active()).toBe(el(page, 'more'));
    });

    it('closes the whole menu when a submenu item is activated, and a disabled trigger never opens', async () => {
        const page = await mount(MARKUP().replace('id="more"', 'id="more" disabled'));
        await open(page);
        el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        el(page, 'more').focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(visible(subPanel(page))).toBe(false);

        const live = await mount(MARKUP());
        await open(live);
        el(live, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(live);
        el(live, 'print').click();
        await settle(live);
        expect(menu(live).open).toBe(false);
    });
});

describe('ge-dropdown-menu items', () => {
    it('builds the whole menu from descriptors, nested submenus included, and runs click for the row that was activated', async () => {
        const picked: string[] = [];
        const items: DropdownItem[] = [
            { type: 'label', label: 'My account' },
            { label: 'Profile', shortcut: '⇧⌘P', click: (i) => picked.push(i.label!) },
            { label: 'Billing', disabled: true, inset: true, click: (i) => picked.push(i.label!) },
            { type: 'separator' },
            { type: 'sub', label: 'More tools', children: [{ label: 'Save page', click: (i) => picked.push(i.label!) }] },
        ];
        const page = await mount(`<div style="padding:60px 300px 300px"><ge-dropdown-menu><ge-dropdown-menu-trigger><ge-button id="open">Open</ge-button></ge-dropdown-menu-trigger></ge-dropdown-menu></div>`);
        menu(page).items = items;
        await settle(page);
        await open(page);
        const rows = [...menu(page).shadowRoot!.querySelectorAll('ge-dropdown-menu-content > *')].map((r) => r.localName);
        expect(rows).toEqual(['ge-dropdown-menu-label', 'ge-dropdown-menu-item', 'ge-dropdown-menu-item', 'ge-dropdown-menu-separator', 'ge-dropdown-menu-sub']);
        expect(active()?.textContent).toBe('Profile');
        expect(menu(page).shadowRoot!.querySelectorAll('ge-dropdown-menu-item')[1].hasAttribute('inset')).toBe(true);

        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(picked).toEqual(['Profile']);
        expect(menu(page).open).toBe(false);

        await open(page);
        const sub = menu(page).shadowRoot!.querySelector('ge-dropdown-menu-sub-trigger')!;
        sub.dispatchEvent(new MouseEvent('mouseenter'));
        await settle(page);
        menu(page).shadowRoot!.querySelector<HTMLElement>('ge-dropdown-menu-sub-content ge-dropdown-menu-item')!.click();
        await settle(page);
        expect(picked).toEqual(['Profile', 'Save page']);
        expect(menu(page).open).toBe(false);
    });
});
