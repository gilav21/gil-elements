import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { ContextMenuItem, GeContextMenu } from './index.js';

const MARKUP = (wrap = '') => `<div style="${wrap}">
<ge-context-menu>
  <ge-context-menu-trigger>
    <div id="area" tabindex="0" style="width:300px;height:150px;border:1px dashed gray">Right click here</div>
  </ge-context-menu-trigger>
  <ge-context-menu-content>
    <ge-context-menu-label inset>Actions</ge-context-menu-label>
    <ge-context-menu-item id="back">Back<ge-context-menu-shortcut>⌘[</ge-context-menu-shortcut></ge-context-menu-item>
    <ge-context-menu-item id="forward" disabled>Forward</ge-context-menu-item>
    <ge-context-menu-item id="reload" shortcut="⌘R">Reload</ge-context-menu-item>
    <ge-context-menu-separator></ge-context-menu-separator>
    <ge-context-menu-sub>
      <ge-context-menu-sub-trigger id="more">More tools</ge-context-menu-sub-trigger>
      <ge-context-menu-sub-content>
        <ge-context-menu-item id="save">Save page</ge-context-menu-item>
        <ge-context-menu-item id="print">Print</ge-context-menu-item>
      </ge-context-menu-sub-content>
    </ge-context-menu-sub>
    <ge-context-menu-item id="delete" variant="destructive">Delete</ge-context-menu-item>
  </ge-context-menu-content>
</ge-context-menu>
<button id="outside">outside</button>
</div>`;

const menu = (page: HTMLElement) => page.querySelector<GeContextMenu>('ge-context-menu')!;
const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const panel = (page: HTMLElement) => page.querySelector<HTMLElement>('ge-context-menu-content')!;
const subPanel = (page: HTMLElement) => page.querySelector<HTMLElement>('ge-context-menu-sub-content')!;
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await frames();
    }
};
/** A right-click, the way the browser sends it. */
const contextClick = async (page: HTMLElement, x: number, y: number) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y });
    el(page, 'area').dispatchEvent(event);
    await settle(page);
    return event;
};
const afterGrace = async (page: HTMLElement) => {
    await new Promise((r) => setTimeout(r, 150));
    await settle(page);
};
const active = () => deepActive(document);
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);
const shown = (e: Element) => e.matches(':popover-open');

afterEach(() => vi.useRealTimers());

describe('ge-context-menu', () => {
    it('opens with its corner at the pointer, in the top layer, and focuses the first enabled item', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await settle(page);
        expect(shown(panel(page))).toBe(false);

        const event = await contextClick(page, 200, 120);
        expect(event.defaultPrevented).toBe(true);
        expect(menu(page).open).toBe(true);
        expect(shown(panel(page))).toBe(true);
        expect(panel(page).getAttribute('role')).toBe('menu');
        const rect = panel(page).getBoundingClientRect();
        near(rect.left, 200);
        near(rect.top, 120);
        expect(active()).toBe(el(page, 'back'));
    });

    it('keeps the panel 8px inside the viewport wherever it is asked to open', async () => {
        const page = await mount(MARKUP());
        await contextClick(page, innerWidth - 4, innerHeight - 4);
        let rect = panel(page).getBoundingClientRect();
        near(rect.right, innerWidth - 8);
        near(rect.bottom, innerHeight - 8);

        await contextClick(page, 0, 0);
        rect = panel(page).getBoundingClientRect();
        near(rect.left, 8);
        near(rect.top, 8);
    });

    it('closes on a click outside, a scroll, Tab, Escape and an item, and hands focus back only when it was inside', async () => {
        const page = await mount(MARKUP('padding:40px;height:2000px'));
        const area = el(page, 'area');
        area.focus();

        await contextClick(page, 100, 100);
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(menu(page).open).toBe(false);
        expect(active()).toBe(area);

        await contextClick(page, 100, 100);
        await userEvent.keyboard('{Tab}');
        await settle(page);
        expect(menu(page).open).toBe(false);
        expect(active()).toBe(area);

        await contextClick(page, 100, 100);
        el(page, 'reload').click();
        await settle(page);
        expect(menu(page).open).toBe(false);

        await contextClick(page, 100, 100);
        el(page, 'outside').focus();
        el(page, 'outside').click();
        await settle(page);
        expect(menu(page).open).toBe(false);
        expect(active()).toBe(el(page, 'outside'));

        await contextClick(page, 100, 100);
        document.documentElement.dispatchEvent(new Event('scroll'));
        document.dispatchEvent(new Event('scroll'));
        await settle(page);
        expect(menu(page).open).toBe(false);
    });

    it('moves through the enabled items with the arrows, Home and End, wrapping, and ignores keys held with a modifier', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, 100);
        const press = async (key: string) => {
            await userEvent.keyboard(key);
            return active()?.id;
        };
        expect(await press('{ArrowDown}')).toBe('reload');
        expect(await press('{ArrowDown}')).toBe('more');
        expect(await press('{ArrowDown}')).toBe('delete');
        expect(await press('{ArrowDown}')).toBe('back');
        expect(await press('{ArrowUp}')).toBe('delete');
        expect(await press('{Home}')).toBe('back');
        expect(await press('{End}')).toBe('delete');
        expect(await press('{Control>}{Home}{/Control}')).toBe('delete');
    });

    it('turns Enter and Space into one click on an enabled item and never on a disabled one', async () => {
        const page = await mount(MARKUP('padding:40px'));
        const clicks: string[] = [];
        page.addEventListener('click', (e) => (e.target as HTMLElement).id && clicks.push((e.target as HTMLElement).id));
        await contextClick(page, 100, 100);
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(clicks.filter((id) => id === 'back')).toHaveLength(1);
        expect(menu(page).open).toBe(false);

        await contextClick(page, 100, 100);
        el(page, 'forward').focus();
        await userEvent.keyboard('{Enter}');
        el(page, 'forward').click();
        expect(clicks).not.toContain('forward');
        expect(menu(page).open).toBe(true);
        expect(el(page, 'forward').getAttribute('aria-disabled')).toBe('true');
        el(page, 'reload').focus();
        await userEvent.keyboard(' ');
        expect(clicks.filter((id) => id === 'reload')).toHaveLength(1);
    });

    it('paints the destructive variant, the inset label, the shortcut and the row padding', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, 100);
        el(page, 'reload').focus();
        const del = getComputedStyle(el(page, 'delete'));
        const normal = getComputedStyle(el(page, 'reload'));
        expect(del.color).toBe(paintedToken('--destructive', el(page, 'delete')));
        expect(normal.color).not.toBe(del.color);
        el(page, 'reload').setAttribute('inset', '');
        expect(getComputedStyle(el(page, 'reload')).paddingLeft).toBe('32px');
        el(page, 'reload').removeAttribute('inset');
        expect(normal.paddingLeft).toBe('8px');
        expect(normal.paddingTop).toBe('6px');
        expect(getComputedStyle(page.querySelector('ge-context-menu-label')!).paddingLeft).toBe('32px');
        const row = el(page, 'back').getBoundingClientRect();
        near(el(page, 'back').querySelector('ge-context-menu-shortcut')!.getBoundingClientRect().right, row.right - 8);
        near(el(page, 'reload').shadowRoot!.querySelector('.shortcut')!.getBoundingClientRect().right, el(page, 'reload').getBoundingClientRect().right - 8);
    });

    it('opens a long press on touch as a right-click at the finger', async () => {
        const page = await mount(MARKUP('padding:40px'));
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const touch = (x: number, y: number) => new Touch({ identifier: 1, target: el(page, 'area'), clientX: x, clientY: y });
        const send = (type: string, touches: Touch[]) =>
            el(page, 'area').dispatchEvent(new TouchEvent(type, { bubbles: true, composed: true, touches, changedTouches: touches }));
        send('touchstart', [touch(150, 130)]);
        await vi.advanceTimersByTimeAsync(300);
        send('touchmove', [touch(190, 130)]);
        await vi.advanceTimersByTimeAsync(400);
        expect(menu(page).open).toBe(false);

        send('touchstart', [touch(150, 130), touch(200, 130)]);
        await vi.advanceTimersByTimeAsync(600);
        expect(menu(page).open).toBe(false);

        send('touchstart', [touch(150, 130)]);
        await vi.advanceTimersByTimeAsync(500);
        expect(menu(page).open).toBe(true);
        near(menu(page).x, 150);
        near(menu(page).y, 130);
    });

    it('opened again from the menu, keeps focus where it is and still returns it to the first target', async () => {
        const page = await mount(MARKUP('padding:40px'));
        el(page, 'area').focus();
        await contextClick(page, 100, 100);
        await userEvent.keyboard('{ArrowDown}');
        expect(active()).toBe(el(page, 'reload'));

        await contextClick(page, 160, 160);
        near(panel(page).getBoundingClientRect().left, 160);
        expect(active()).toBe(el(page, 'reload'));
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(active()).toBe(el(page, 'area'));
    });

    it('has no axe violations open', async () => {
        useTheme('light');
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, 100);
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations).toEqual([]);
    });
});

describe('ge-context-menu submenu', () => {
    it('opens on hover beside its row, on the other side when there is no room, and closes with the menu', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, 100);
        el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(page);
        expect(shown(subPanel(page))).toBe(true);
        let sub = subPanel(page).getBoundingClientRect();
        let row = el(page, 'more').getBoundingClientRect();
        near(sub.left, row.right + 4);
        near(sub.top, row.top);

        menu(page).close();
        await settle(page);
        expect(shown(subPanel(page))).toBe(false);

        await contextClick(page, innerWidth - 150, 100);
        el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(page);
        sub = subPanel(page).getBoundingClientRect();
        row = el(page, 'more').getBoundingClientRect();
        expect(sub.right).toBeLessThanOrEqual(row.left);
        expect(sub.width).toBeGreaterThan(0);
        expect(sub.right).toBeLessThanOrEqual(innerWidth - 8 + 0.5);
    });

    it('stays inside the viewport at the bottom edge, and a click on its row does not reach the panel', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, innerHeight - 120);
        let seen = false;
        panel(page).addEventListener('click', () => (seen = true));
        el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(page);
        el(page, 'more').click();
        expect(seen).toBe(false);
        const sub = subPanel(page).getBoundingClientRect();
        expect(sub.height).toBeGreaterThan(60);
        expect(sub.bottom).toBeLessThanOrEqual(innerHeight - 8 + 0.5);
        expect(sub.bottom).toBeGreaterThan(innerHeight - 20);
    });

    it('opens from the keyboard into its first item, and the back arrow, Escape or Tab leave it correctly', async () => {
        const page = await mount(MARKUP('padding:40px'));
        await contextClick(page, 100, 100);
        el(page, 'more').focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(page);
        expect(active()).toBe(el(page, 'save'));
        await userEvent.keyboard('{End}');
        expect(active()).toBe(el(page, 'print'));

        await userEvent.keyboard('{ArrowLeft}');
        await afterGrace(page);
        expect(shown(subPanel(page))).toBe(false);
        expect(active()).toBe(el(page, 'more'));

        await userEvent.keyboard('{Enter}');
        await settle(page);
        await userEvent.keyboard('{Escape}');
        await afterGrace(page);
        expect(shown(subPanel(page))).toBe(false);
        expect(menu(page).open).toBe(true);
        expect(active()).toBe(el(page, 'more'));

        await userEvent.keyboard('{Enter}');
        await settle(page);
        await userEvent.keyboard('{Tab}');
        await settle(page);
        expect(menu(page).open).toBe(false);
    });

    it('swaps the forward and back arrows in right-to-left text and opens on the left', async () => {
        const page = await mount(MARKUP('padding:40px;direction:rtl'));
        const narrow = await mount(MARKUP('padding:40px;direction:rtl'));
        await contextClick(narrow, 10, 100);
        el(narrow, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(narrow);
        expect(subPanel(narrow).getBoundingClientRect().left).toBeGreaterThanOrEqual(el(narrow, 'more').getBoundingClientRect().right);
        menu(narrow).close();
        await settle(narrow);

        await contextClick(page, 500, 100);
        el(page, 'more').focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(page);
        expect(shown(subPanel(page))).toBe(false);
        await userEvent.keyboard('{ArrowLeft}');
        await settle(page);
        expect(active()).toBe(el(page, 'save'));
        near(subPanel(page).getBoundingClientRect().right, el(page, 'more').getBoundingClientRect().left - 4);
        await userEvent.keyboard('{ArrowRight}');
        await afterGrace(page);
        expect(active()).toBe(el(page, 'more'));
    });

    it('closes the whole menu when a submenu item is activated, and a disabled branch never opens', async () => {
        const page = await mount(MARKUP('padding:40px').replace('id="more"', 'id="more" disabled'));
        await contextClick(page, 100, 100);
        el(page, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        el(page, 'more').focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(shown(subPanel(page))).toBe(false);

        const live = await mount(MARKUP('padding:40px'));
        await contextClick(live, 100, 100);
        el(live, 'more').dispatchEvent(new MouseEvent('mouseenter'));
        await settle(live);
        el(live, 'print').click();
        await settle(live);
        expect(menu(live).open).toBe(false);
    });
});

describe('ge-context-menu items', () => {
    it('builds the menu from descriptors, labels and submenus included, and runs click for the activated row', async () => {
        const picked: string[] = [];
        const items: ContextMenuItem[] = [
            { type: 'label', label: 'Actions', inset: true },
            { label: 'Copy', shortcut: '⌘C', click: (i) => picked.push(i.label!) },
            { label: 'Paste', disabled: true, click: (i) => picked.push(i.label!) },
            { type: 'separator' },
            { type: 'sub', label: 'Share', children: [{ label: 'Email', click: (i) => picked.push(i.label!) }] },
        ];
        const page = await mount('<div style="padding:40px"><ge-context-menu><ge-context-menu-trigger><div id="area" style="width:200px;height:100px">area</div></ge-context-menu-trigger></ge-context-menu></div>');
        menu(page).items = items;
        await settle(page);
        menu(page).show(100, 100);
        await settle(page);
        const root = menu(page).shadowRoot!;
        expect([...root.querySelectorAll('ge-context-menu-content > *')].map((r) => r.localName)).toEqual([
            'ge-context-menu-label', 'ge-context-menu-item', 'ge-context-menu-item', 'ge-context-menu-separator', 'ge-context-menu-sub',
        ]);
        expect(active()?.textContent).toBe('Copy');
        expect(root.querySelector('ge-context-menu-label')!.hasAttribute('inset')).toBe(true);

        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(picked).toEqual(['Copy']);
        expect(menu(page).open).toBe(false);

        menu(page).show(100, 100);
        await settle(page);
        root.querySelector('ge-context-menu-sub-trigger')!.dispatchEvent(new MouseEvent('mouseenter'));
        await settle(page);
        root.querySelector<HTMLElement>('ge-context-menu-sub-content ge-context-menu-item')!.click();
        await settle(page);
        expect(picked).toEqual(['Copy', 'Email']);
    });

    it('opens a menu elsewhere on the page for every area that names it with `for`, and leaves the browser menu alone for an unknown id', async () => {
        const page = await mount(`<div style="padding:20px">
<ge-context-menu id="shared"><ge-context-menu-content><ge-context-menu-item id="one">One</ge-context-menu-item></ge-context-menu-content></ge-context-menu>
<ge-context-menu-trigger for="shared"><p id="a" style="width:200px;height:60px">A</p></ge-context-menu-trigger>
<ge-context-menu-trigger for="shared"><p id="b" style="width:200px;height:60px">B</p></ge-context-menu-trigger>
<ge-context-menu-trigger for="missing"><p id="c" style="width:200px;height:60px">C</p></ge-context-menu-trigger>
</div>`);
        const send = async (id: string) => {
            const target = el(page, id);
            const rect = target.getBoundingClientRect();
            const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: rect.left + 30, clientY: rect.top + 20 });
            target.dispatchEvent(event);
            await settle(page);
            return { event, rect };
        };
        const shared = menu(page);
        const first = await send('a');
        expect(first.event.defaultPrevented).toBe(true);
        expect(shared.open).toBe(true);
        near(el(page, 'one').getBoundingClientRect().left, first.rect.left + 30 + 5);

        shared.close();
        await settle(page);
        const second = await send('b');
        expect(shared.open).toBe(true);
        near(el(page, 'one').getBoundingClientRect().top, second.rect.top + 20 + 5);

        shared.close();
        await settle(page);
        expect((await send('c')).event.defaultPrevented).toBe(false);
        expect(shared.open).toBe(false);
    });
});
