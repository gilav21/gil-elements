import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeNavigationMenu } from './index.js';

const MARKUP = (wrap = '') => `<div style="padding:20px 100px 300px;${wrap}">
<ge-navigation-menu>
  <ge-navigation-menu-list>
    <ge-navigation-menu-item id="learn">
      <ge-navigation-menu-trigger id="learn-trigger">Getting started</ge-navigation-menu-trigger>
      <ge-navigation-menu-content id="learn-panel">
        <ge-navigation-menu-link id="intro" href="#intro">
          <div>Introduction</div>
          <p>Re-usable components built with Tailwind.</p>
        </ge-navigation-menu-link>
        <ge-navigation-menu-link id="install" href="#install"><div>Installation</div></ge-navigation-menu-link>
      </ge-navigation-menu-content>
    </ge-navigation-menu-item>
    <ge-navigation-menu-item id="comp">
      <ge-navigation-menu-trigger id="comp-trigger">Components</ge-navigation-menu-trigger>
      <ge-navigation-menu-content id="comp-panel">
        <ge-navigation-menu-link href="#alert"><div>Alert</div></ge-navigation-menu-link>
      </ge-navigation-menu-content>
    </ge-navigation-menu-item>
    <ge-navigation-menu-item id="docs">
      <ge-navigation-menu-link id="docs-link" href="#docs">Documentation</ge-navigation-menu-link>
    </ge-navigation-menu-item>
  </ge-navigation-menu-list>
</ge-navigation-menu>
<button id="outside">outside</button>
</div>`;

const el = (page: HTMLElement, id: string) => page.querySelector<HTMLElement>(`#${id}`)!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
};
/** Settles without timers, for tests that fake them. */
const flush = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
    }
};
const visible = (e: Element) => getComputedStyle(e).display !== 'none';
const button = (page: HTMLElement, id: string) => el(page, id).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const hover = async (page: HTMLElement, id: string) => {
    el(page, id).dispatchEvent(new MouseEvent('mouseenter'));
    await settle(page);
};
const leave = (id: string, page: HTMLElement) => el(page, id).dispatchEvent(new MouseEvent('mouseleave'));

// The browser's mouse keeps its position across test files. A pointer left over the trigger opens the menu by hover as soon as it
// mounts, and the click that follows then closes it again, so park the pointer in a far corner before every test.
beforeEach(async () => {
    const corner = document.createElement('div');
    corner.style.cssText = 'position:fixed;right:0;bottom:0;width:20px;height:20px';
    document.body.append(corner);
    await userEvent.hover(corner);
    corner.remove();
});
afterEach(() => vi.useRealTimers());

describe('ge-navigation-menu', () => {
    it('opens an item on hover, closes it after a grace period, and keeps it open when the pointer comes back', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        await hover(page, 'learn');
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        expect(button(page, 'learn-trigger').getAttribute('aria-expanded')).toBe('true');
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        leave('learn', page);
        vi.advanceTimersByTime(149);
        await flush(page);
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        // Coming back inside the grace period keeps it open.
        el(page, 'learn').dispatchEvent(new MouseEvent('mouseenter'));
        vi.advanceTimersByTime(500);
        await flush(page);
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        leave('learn', page);
        vi.advanceTimersByTime(150);
        await flush(page);
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        vi.useRealTimers();
        expect(button(page, 'learn-trigger').getAttribute('aria-expanded')).toBe('false');
    });

    it('opens one item at a time', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        await hover(page, 'learn');
        await hover(page, 'comp');
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        expect(visible(el(page, 'comp-panel'))).toBe(true);
    });

    it('toggles on a click, which is how touch opens it, and a click outside closes it', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        button(page, 'learn-trigger').click();
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        expect(button(page, 'learn-trigger').dataset.state).toBe('open');
        button(page, 'learn-trigger').click();
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        button(page, 'learn-trigger').click();
        await settle(page);
        // A click inside the panel leaves it open, and so does activating a link.
        el(page, 'learn-panel').click();
        el(page, 'install').addEventListener('click', (e) => e.preventDefault());
        el(page, 'install').click();
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        el(page, 'outside').click();
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(false);
    });

    it('does not open on hover with a coarse pointer', async () => {
        const original = globalThis.matchMedia;
        globalThis.matchMedia = ((q: string) => ({ matches: q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} })) as typeof matchMedia;
        try {
            const page = await mount(MARKUP());
            await settle(page);
            await hover(page, 'learn');
            expect(visible(el(page, 'learn-panel'))).toBe(false);
            button(page, 'learn-trigger').click();
            await settle(page);
            expect(visible(el(page, 'learn-panel'))).toBe(true);
            leave('learn', page);
            await new Promise((r) => setTimeout(r, 200));
            expect(visible(el(page, 'learn-panel'))).toBe(true);
        } finally {
            globalThis.matchMedia = original;
        }
    });

    it('opens from the keyboard with Enter on the focused trigger, and Tab reaches the links', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        await userEvent.keyboard('{Tab}');
        await settle(page);
        // The page's first tab stop is the first trigger.
        expect(deepActive(document)).toBe(button(page, 'learn-trigger'));
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        await userEvent.keyboard('{Tab}');
        await settle(page);
        expect(deepActive(document)).toBe(el(page, 'intro').shadowRoot!.querySelector('a'));
    });

    it('draws a lone link and a panel under its trigger, start-aligned in either direction', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        await hover(page, 'learn');
        const item = el(page, 'learn').getBoundingClientRect();
        const panel = el(page, 'learn-panel').getBoundingClientRect();
        expect(Math.abs(panel.left - item.left)).toBeLessThan(1);
        expect(Math.abs(panel.top - (item.bottom + 6))).toBeLessThan(1);
        page.dir = 'rtl';
        await settle(page);
        const itemRtl = el(page, 'learn').getBoundingClientRect();
        const panelRtl = el(page, 'learn-panel').getBoundingClientRect();
        expect(Math.abs(panelRtl.right - itemRtl.right)).toBeLessThan(1);
    });

    it('builds a list from items, with links for plain entries and dropdowns for entries with children', async () => {
        const page = await mount(`<div style="padding:20px 100px"><ge-navigation-menu id="m"></ge-navigation-menu></div>`);
        const menu = page.querySelector<GeNavigationMenu>('#m')!;
        menu.items = [
            { label: 'Home', href: '#home' },
            { label: 'Guides', children: [
                { title: 'Intro', description: 'Start here.', href: '#intro' },
                { title: 'Install', href: '#install' },
            ] },
        ];
        await settle(page);
        const root = menu.shadowRoot!;
        const link = root.querySelector('ge-navigation-menu-link')!;
        expect(link.getAttribute('href')).toBe('#home');
        expect(link.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe('#home');
        expect(link.textContent!.trim()).toBe('Home');
        const trigger = root.querySelector('ge-navigation-menu-trigger')!;
        expect(trigger.textContent!.trim()).toBe('Guides');
        const links = [...root.querySelectorAll('ge-navigation-menu-content ge-navigation-menu-link')];
        expect(links.map((l) => l.getAttribute('href'))).toEqual(['#intro', '#install']);
        expect(links[0]!.textContent).toContain('Start here.');
        expect(links[1]!.querySelector('p')).toBeNull();
        trigger.shadowRoot!.querySelector('button')!.click();
        await settle(page);
        expect(visible(root.querySelector('ge-navigation-menu-content')!)).toBe(true);
    });

    it('uses a projected list over items', async () => {
        const page = await mount(`<ge-navigation-menu id="m"><ge-navigation-menu-list><ge-navigation-menu-item><ge-navigation-menu-link id="mine">Mine</ge-navigation-menu-link></ge-navigation-menu-item></ge-navigation-menu-list></ge-navigation-menu>`);
        const menu = page.querySelector<GeNavigationMenu>('#m')!;
        menu.items = [{ label: 'Built', href: '#b' }];
        await settle(page);
        expect(menu.shadowRoot!.querySelector('ge-navigation-menu-list')).toBeNull();
        expect(el(page, 'mine').isConnected).toBe(true);
    });

    it('has no axe violations open', async () => {
        useTheme('light');
        const page = await mount(MARKUP());
        await settle(page);
        await hover(page, 'learn');
        const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
        expect(results.violations.map((v) => v.id)).toEqual([]);
    });

    const key = async (page: HTMLElement, k: string) => {
        await userEvent.keyboard(k);
        await settle(page);
        await new Promise((r) => setTimeout(r, 10));
    };
    const at = () => deepActive(document);

    it('walks the bar with the left and right arrows, wrapping, carrying an open panel along, and mirrored in RTL', async () => {
        const page = await mount(MARKUP());
        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowRight}');
        expect(at()).toBe(button(page, 'comp-trigger'));
        await key(page, '{ArrowRight}');
        expect(at()).toBe(el(page, 'docs-link').shadowRoot!.querySelector('a'));
        await key(page, '{ArrowRight}');
        expect(at()).toBe(button(page, 'learn-trigger'));
        await key(page, '{ArrowLeft}');
        expect(at()).toBe(el(page, 'docs-link').shadowRoot!.querySelector('a'));
        await key(page, '{Home}');
        expect(at()).toBe(button(page, 'learn-trigger'));
        await key(page, '{End}');
        expect(at()).toBe(el(page, 'docs-link').shadowRoot!.querySelector('a'));

        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowDown}');
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowRight}');
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        expect(visible(el(page, 'comp-panel'))).toBe(true);
        expect(at()).toBe(button(page, 'comp-trigger'));

        const rtl = await mount(MARKUP('direction:rtl'));
        button(rtl, 'learn-trigger').focus();
        await key(rtl, '{ArrowLeft}');
        expect(at()).toBe(button(rtl, 'comp-trigger'));
    });

    it('opens a panel with Down onto its first link, walks the links with the arrows, and Escape closes it back onto the trigger', async () => {
        const page = await mount(MARKUP());
        const link = (id: string) => el(page, id).shadowRoot!.querySelector('a');
        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowDown}');
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        expect(at()).toBe(link('intro'));
        await key(page, '{ArrowDown}');
        expect(at()).toBe(link('install'));
        await key(page, '{ArrowDown}');
        expect(at()).toBe(link('intro'));
        await key(page, '{ArrowUp}');
        expect(at()).toBe(link('install'));
        await key(page, '{Home}');
        expect(at()).toBe(link('intro'));

        await key(page, '{Escape}');
        expect(visible(el(page, 'learn-panel'))).toBe(false);
        expect(at()).toBe(button(page, 'learn-trigger'));
    });

    it('leaves the arrow keys to a control in the panel that is not one of its links', async () => {
        const page = await mount(MARKUP());
        const field = document.createElement('input');
        field.setAttribute('aria-label', 'Search the docs');
        el(page, 'learn-panel').append(field);
        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowDown}');
        field.focus();
        for (const keys of ['{ArrowDown}', '{ArrowUp}', '{Home}', '{End}']) {
            await key(page, keys);
            expect(at()).toBe(field);
        }
    });

    it('still enters the links with Down from the panel itself in a data-driven menu, where the event is retargeted to the host', async () => {
        const page = await mount('<div style="padding:20px 100px"><ge-navigation-menu id="m"></ge-navigation-menu></div>');
        const menu = page.querySelector<GeNavigationMenu>('#m')!;
        menu.items = [{ label: 'Guides', children: [{ title: 'Intro', href: '#intro' }, { title: 'Install', href: '#install' }] }];
        await settle(page);
        const trigger = menu.shadowRoot!.querySelector('ge-navigation-menu-trigger')!;
        const panel = menu.shadowRoot!.querySelector<HTMLElement>('ge-navigation-menu-content')!;
        panel.tabIndex = -1;
        trigger.shadowRoot!.querySelector('button')!.focus();
        await key(page, '{Enter}');
        panel.focus();
        await key(page, '{ArrowDown}');
        expect(at()).toBe(menu.shadowRoot!.querySelector('ge-navigation-menu-content ge-navigation-menu-link')!.shadowRoot!.querySelector('a'));
    });

    it('still enters the links with Down when the panel itself holds focus', async () => {
        const page = await mount(MARKUP());
        const panel = el(page, 'learn-panel');
        panel.tabIndex = -1;
        button(page, 'learn-trigger').focus();
        await key(page, '{Enter}');
        panel.focus();
        await key(page, '{ArrowDown}');
        expect(at()).toBe(el(page, 'intro').shadowRoot!.querySelector('a'));
    });

    it('closes the panel when Tab leaves its item, and keeps it open under a pointer that drifts away while the keyboard is in it', async () => {
        const page = await mount(MARKUP());
        button(page, 'learn-trigger').focus();
        await key(page, '{Enter}');
        expect(visible(el(page, 'learn-panel'))).toBe(true);
        await key(page, '{Tab}');
        await key(page, '{Tab}');
        await key(page, '{Tab}');
        expect(at()).toBe(button(page, 'comp-trigger'));
        expect(visible(el(page, 'learn-panel'))).toBe(false);

        button(page, 'learn-trigger').focus();
        await key(page, '{ArrowDown}');
        leave('learn', page);
        await new Promise((r) => setTimeout(r, 250));
        expect(visible(el(page, 'learn-panel'))).toBe(true);

        el(page, 'outside').focus();
        await settle(page);
        expect(visible(el(page, 'learn-panel'))).toBe(false);
    });
});
