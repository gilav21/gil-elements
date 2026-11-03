import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeMenubar } from './index.js';

const MARKUP = (wrap = '') => `<div style="padding:20px;${wrap}">
<ge-menubar>
  <ge-menubar-menu id="file-menu">
    <ge-menubar-trigger id="file">File</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item id="new">New tab<ge-menubar-shortcut>⌘T</ge-menubar-shortcut></ge-menubar-item>
      <ge-menubar-item id="open-file" disabled>Open</ge-menubar-item>
      <ge-menubar-separator></ge-menubar-separator>
      <ge-menubar-sub>
        <ge-menubar-sub-trigger id="share">Share</ge-menubar-sub-trigger>
        <ge-menubar-sub-content>
          <ge-menubar-item id="email">Email link</ge-menubar-item>
          <ge-menubar-item id="messages">Messages</ge-menubar-item>
        </ge-menubar-sub-content>
      </ge-menubar-sub>
      <ge-menubar-item id="print" shortcut="⌘P">Print</ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
  <ge-menubar-menu>
    <ge-menubar-trigger id="edit">Edit</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item id="undo">Undo</ge-menubar-item>
      <ge-menubar-item id="redo">Redo</ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
  <ge-menubar-menu>
    <ge-menubar-trigger id="view">View</ge-menubar-trigger>
    <ge-menubar-content>
      <ge-menubar-item id="zoom">Zoom</ge-menubar-item>
    </ge-menubar-content>
  </ge-menubar-menu>
</ge-menubar>
<button id="outside">outside</button>
</div>`;

const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
/** A submenu closes 100ms after it is told to. */
const afterGrace = async (page: HTMLElement) => {
    await new Promise((r) => setTimeout(r, 150));
    await settle(page);
};
const active = () => deepActive(document);
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);
const visible = (e: Element) => getComputedStyle(e).display !== 'none';
const panelOf = (page: HTMLElement, trigger: string) => el(page, trigger).parentElement!.querySelector<HTMLElement>('ge-menubar-content')!;
const focusTrigger = async (page: HTMLElement, id: string) => {
    el(page, id).focus();
    await settle(page);
};
const press = async (page: HTMLElement, keys: string) => {
    await userEvent.keyboard(keys);
    await settle(page);
};

afterEach(() => vi.useRealTimers());

describe('ge-menubar', () => {
    it('opens one menu at a time beneath its trigger with focus left on the trigger, and closes from the trigger, outside or an item', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        expect(el(page, 'file').getAttribute('aria-haspopup')).toBe('menu');
        expect(el(page, 'file').getAttribute('aria-expanded')).toBe('false');
        expect(visible(panelOf(page, 'file'))).toBe(false);

        el(page, 'file').click();
        await settle(page);
        expect(visible(panelOf(page, 'file'))).toBe(true);
        expect(el(page, 'file').getAttribute('aria-expanded')).toBe('true');
        expect(el(page, 'file').dataset.state).toBe('open');
        expect(panelOf(page, 'file').getAttribute('role')).toBe('menu');
        near(panelOf(page, 'file').getBoundingClientRect().top, el(page, 'file').parentElement!.getBoundingClientRect().bottom + 4);
        near(panelOf(page, 'file').getBoundingClientRect().left, el(page, 'file').getBoundingClientRect().left);

        el(page, 'edit').click();
        await settle(page);
        expect(visible(panelOf(page, 'file'))).toBe(false);
        expect(visible(panelOf(page, 'edit'))).toBe(true);

        el(page, 'edit').click();
        await settle(page);
        expect(visible(panelOf(page, 'edit'))).toBe(false);

        el(page, 'edit').click();
        el(page, 'outside').click();
        await settle(page);
        expect(page.querySelector<GeMenubar>('ge-menubar')!.active).toBeUndefined();
        expect(visible(panelOf(page, 'edit'))).toBe(false);
    });

    it('switches to another trigger on hover only once a menu is open', async () => {
        const page = await mount(MARKUP());
        await userEvent.hover(el(page, 'file'));
        await settle(page);
        expect(visible(panelOf(page, 'file'))).toBe(false);

        el(page, 'file').click();
        await userEvent.hover(el(page, 'view'));
        await settle(page);
        expect(visible(panelOf(page, 'file'))).toBe(false);
        expect(visible(panelOf(page, 'view'))).toBe(true);
        // The pointer stays where it is for the next test, whose bar would open under it.
        await userEvent.unhover(el(page, 'view'));
    });

    it('walks the triggers with Left and Right, wrapping, and carries an open menu along', async () => {
        const page = await mount(MARKUP());
        await focusTrigger(page, 'file');
        await press(page, '{ArrowRight}');
        expect(active()).toBe(el(page, 'edit'));
        expect(visible(panelOf(page, 'edit'))).toBe(false);
        await press(page, '{ArrowLeft}{ArrowLeft}');
        expect(active()).toBe(el(page, 'view'));

        el(page, 'view').click();
        await settle(page);
        await press(page, '{ArrowRight}');
        expect(active()).toBe(el(page, 'file'));
        expect(visible(panelOf(page, 'file'))).toBe(true);
        expect(visible(panelOf(page, 'view'))).toBe(false);
    });

    it('opens from Down or Enter into the first enabled item, while Space only toggles', async () => {
        const page = await mount(MARKUP());
        await focusTrigger(page, 'file');
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'new'));
        await press(page, '{Escape}');
        expect(active()).toBe(el(page, 'file'));

        await press(page, '{Enter}');
        expect(active()).toBe(el(page, 'new'));
        await press(page, '{Escape}');

        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        el(page, 'file').dispatchEvent(space);
        await settle(page);
        expect(space.defaultPrevented).toBe(true);
        expect(visible(panelOf(page, 'file'))).toBe(true);
        expect(active()).toBe(el(page, 'file'));
        await press(page, ' ');
        expect(visible(panelOf(page, 'file'))).toBe(false);
    });

    it('stops answering for a menu that left the bar', async () => {
        const page = await mount(MARKUP());
        el(page, 'file').click();
        await settle(page);
        el(page, 'file-menu').remove();
        await settle(page);
        await userEvent.hover(el(page, 'view'));
        await settle(page);
        expect(visible(panelOf(page, 'view'))).toBe(false);
        await userEvent.unhover(el(page, 'view'));
    });

    it('moves through the enabled items with Up and Down, wrapping, and Left and Right switch menus', async () => {
        const page = await mount(MARKUP());
        await focusTrigger(page, 'file');
        await press(page, '{ArrowDown}');
        const order = ['share', 'print', 'new'];
        for (const id of order) {
            await press(page, '{ArrowDown}');
            expect(active()).toBe(el(page, id));
        }
        await press(page, '{ArrowUp}');
        expect(active()).toBe(el(page, 'print'));

        await press(page, '{ArrowLeft}');
        expect(active()).toBe(el(page, 'view'));
        expect(visible(panelOf(page, 'view'))).toBe(true);
        expect(visible(panelOf(page, 'file'))).toBe(false);
    });

    it('runs the click once for pointer, Enter and Space, then closes and returns focus to the trigger; a disabled row does nothing', async () => {
        const page = await mount(MARKUP());
        const onClick = vi.fn();
        el(page, 'new').addEventListener('click', onClick);
        el(page, 'open-file').addEventListener('click', onClick);

        el(page, 'file').click();
        await settle(page);
        el(page, 'new').click();
        await afterGrace(page);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(visible(panelOf(page, 'file'))).toBe(false);
        expect(active()).toBe(el(page, 'file'));

        await press(page, '{Enter}');
        expect(active()).toBe(el(page, 'new'));
        await press(page, '{Enter}');
        await afterGrace(page);
        expect(onClick).toHaveBeenCalledTimes(2);
        expect(visible(panelOf(page, 'file'))).toBe(false);
        expect(active()).toBe(el(page, 'file'));
        expect(visible(panelOf(page, 'file'))).toBe(false);

        el(page, 'file').click();
        await settle(page);
        el(page, 'open-file').click();
        await settle(page);
        expect(onClick).toHaveBeenCalledTimes(2);
        expect(visible(panelOf(page, 'file'))).toBe(true);
    });

    it('opens a submenu with the forward arrow without leaving the menu, and the back arrow or Escape closes only it', async () => {
        const page = await mount(MARKUP());
        const subPanel = page.querySelector<HTMLElement>('ge-menubar-sub-content')!;
        await focusTrigger(page, 'file');
        await press(page, '{ArrowDown}');
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'share'));

        await press(page, '{ArrowRight}');
        await settle(page);
        expect(visible(subPanel)).toBe(true);
        near(subPanel.getBoundingClientRect().left, el(page, 'share').getBoundingClientRect().right + 2);
        expect(active()).toBe(el(page, 'email'));
        expect(visible(panelOf(page, 'file'))).toBe(true);
        expect(visible(panelOf(page, 'edit'))).toBe(false);

        await press(page, '{ArrowLeft}');
        await afterGrace(page);
        expect(visible(subPanel)).toBe(false);
        expect(active()).toBe(el(page, 'share'));
        expect(visible(panelOf(page, 'file'))).toBe(true);

        await press(page, '{Enter}');
        expect(active()).toBe(el(page, 'email'));
        await press(page, '{Escape}');
        await afterGrace(page);
        expect(visible(subPanel)).toBe(false);
        expect(active()).toBe(el(page, 'share'));
        expect(visible(panelOf(page, 'file'))).toBe(true);
    });

    it('reopens a menu with its submenu closed', async () => {
        const page = await mount(MARKUP());
        const subPanel = page.querySelector<HTMLElement>('ge-menubar-sub-content')!;
        el(page, 'file').click();
        await userEvent.hover(el(page, 'share'));
        await settle(page);
        expect(visible(subPanel)).toBe(true);
        await userEvent.unhover(el(page, 'share'));

        el(page, 'edit').click();
        await settle(page);
        el(page, 'file').click();
        await settle(page);
        expect(visible(panelOf(page, 'file'))).toBe(true);
        expect(visible(subPanel)).toBe(false);
    });

    it('closes the whole menu when a submenu item is activated', async () => {
        const page = await mount(MARKUP());
        el(page, 'file').click();
        await userEvent.hover(el(page, 'share'));
        await settle(page);
        el(page, 'email').click();
        await userEvent.unhover(el(page, 'share'));
        await afterGrace(page);
        expect(visible(panelOf(page, 'file'))).toBe(false);
        expect(active()).toBe(el(page, 'file'));
    });

    it('mirrors the arrows and the panel edge in right-to-left text', async () => {
        const page = await mount(MARKUP('direction:rtl;'));
        const subPanel = page.querySelector<HTMLElement>('ge-menubar-sub-content')!;
        await focusTrigger(page, 'file');
        await press(page, '{ArrowLeft}');
        expect(active()).toBe(el(page, 'edit'));
        await press(page, '{ArrowRight}');
        expect(active()).toBe(el(page, 'file'));

        el(page, 'file').click();
        await settle(page);
        near(panelOf(page, 'file').getBoundingClientRect().right, el(page, 'file').getBoundingClientRect().right);

        await press(page, '{ArrowDown}');
        await press(page, '{ArrowDown}');
        expect(active()).toBe(el(page, 'share'));
        await press(page, '{ArrowLeft}');
        expect(visible(subPanel)).toBe(true);
        expect(active()).toBe(el(page, 'email'));
        expect(subPanel.getBoundingClientRect().right).toBeLessThanOrEqual(el(page, 'share').getBoundingClientRect().left + 1);
        await press(page, '{ArrowRight}');
        await afterGrace(page);
        expect(active()).toBe(el(page, 'share'));
    });

    it('lays a row out with its shortcut at the end, inset indented, at the density the page sets', async () => {
        const page = await mount(MARKUP('--density:1.5;'));
        el(page, 'print').toggleAttribute('inset', true);
        el(page, 'file').click();
        await settle(page);
        const bar = page.querySelector('ge-menubar')!;
        near(bar.getBoundingClientRect().height, 60);
        const style = getComputedStyle(el(page, 'file'));
        near(Number.parseFloat(style.paddingLeft), 18);
        near(Number.parseFloat(style.paddingTop), 9);
        const newRow = el(page, 'new');
        const hint = newRow.querySelector('ge-menubar-shortcut')!.getBoundingClientRect();
        near(hint.right, newRow.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(newRow).paddingRight));
        near(Number.parseFloat(getComputedStyle(el(page, 'print')).paddingLeft), 32);
    });

    it('has no axe violations open', async () => {
        useTheme('light');
        const page = await mount(MARKUP());
        el(page, 'file').click();
        await settle(page);
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' | ')}`)).toEqual([]);
    });
});
