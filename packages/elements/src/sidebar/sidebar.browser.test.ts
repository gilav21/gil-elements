import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page as browser, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import { deepActive } from '../shared/overlay.js';
import type { GeSidebarProvider } from './sidebar-provider.js';
import type { GeSidebarMenuSub } from './sub/sidebar-menu-sub.js';

const KEY = 'ge-sidebar:collapsed';
const provider = (page: HTMLElement) => page.querySelector<GeSidebarProvider>('ge-sidebar-provider')!;
const aside = (page: HTMLElement) => page.querySelector('ge-sidebar')!.shadowRoot!.querySelector('aside')!;
const inner = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        await provider(page).updateComplete;
        const lit = [...page.querySelectorAll('*')].filter((el): el is HTMLElement & { updateComplete: Promise<boolean> } => 'updateComplete' in el);
        await Promise.all(lit.map((el) => el.updateComplete));
    }
};
/** Whether `el` is in the sidebar's flat tree: through slots and shadow roots alike. */
const inside = (el: Element | null, root: Element): boolean => {
    for (let node: Node | null = el; node; node = node instanceof ShadowRoot ? node.host : (node as Element).assignedSlot ?? node.parentNode) {
        if (node === root) return true;
    }
    return false;
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const trigger = (page: HTMLElement) => inner(page.querySelector('ge-sidebar-trigger')!, 'button');
const width = (page: HTMLElement) => aside(page).getBoundingClientRect().width;
const sr = (el: Element) => getComputedStyle(el).position === 'absolute' && getComputedStyle(el).width === '1px';

const SHELL = (providerAttrs = '', sidebarAttrs = '') => `
    <ge-sidebar-provider ${providerAttrs}>
        <ge-sidebar ${sidebarAttrs}>
            <ge-sidebar-header><div id="brand">Acme</div></ge-sidebar-header>
            <ge-sidebar-content>
                <ge-sidebar-group>
                    <ge-sidebar-group-label>Workspace</ge-sidebar-group-label>
                    <ge-sidebar-group-content>
                        <ge-sidebar-menu>
                            <ge-sidebar-menu-item>
                                <ge-sidebar-menu-link id="home" href="#home" active><svg id="home-icon" width="16" height="16"></svg><span>Dashboard</span></ge-sidebar-menu-link>
                            </ge-sidebar-menu-item>
                            <ge-sidebar-menu-item>
                                <ge-sidebar-menu-button id="inbox-btn" tooltip="Inbox"><svg width="16" height="16"></svg><span>Inbox</span></ge-sidebar-menu-button>
                                <ge-sidebar-menu-badge>12</ge-sidebar-menu-badge>
                            </ge-sidebar-menu-item>
                            <ge-sidebar-menu-item>
                                <ge-sidebar-menu-sub-trigger for="projects"><svg width="16" height="16"></svg><span>Projects</span></ge-sidebar-menu-sub-trigger>
                                <ge-sidebar-menu-sub id="projects">
                                    <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button id="apollo" href="#apollo" active><span>Apollo</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                                    <ge-sidebar-menu-sub-item><ge-sidebar-menu-sub-button href="#borealis"><span>Borealis</span></ge-sidebar-menu-sub-button></ge-sidebar-menu-sub-item>
                                </ge-sidebar-menu-sub>
                            </ge-sidebar-menu-item>
                            <ge-sidebar-menu-item>
                                <ge-sidebar-menu-link href="#settings"><svg width="16" height="16"></svg><span>Settings</span></ge-sidebar-menu-link>
                                <ge-sidebar-menu-action label="Settings options"><svg width="16" height="16"></svg></ge-sidebar-menu-action>
                            </ge-sidebar-menu-item>
                            <ge-sidebar-menu-skeleton seed="1"></ge-sidebar-menu-skeleton>
                        </ge-sidebar-menu>
                    </ge-sidebar-group-content>
                </ge-sidebar-group>
            </ge-sidebar-content>
            <ge-sidebar-footer>Version 1</ge-sidebar-footer>
            <ge-sidebar-rail></ge-sidebar-rail>
        </ge-sidebar>
        <ge-sidebar-inset><header><ge-sidebar-trigger></ge-sidebar-trigger></header><p>Content</p></ge-sidebar-inset>
    </ge-sidebar-provider>`;

beforeEach(() => localStorage.removeItem(KEY));
afterEach(async () => {
    localStorage.removeItem(KEY);
    await browser.viewport(1280, 800);
});

describe('ge-sidebar on a wide page', () => {
    it('collapses to a 60px icon rail and back, and every part switches to its collapsed form', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const label = page.querySelector('ge-sidebar-group-label')!;
        const link = page.querySelector('#home')!;
        const text = link.querySelector('span')!;
        expect([width(page), aside(page).dataset.collapsed, sr(inner(label, '.label'))]).toEqual([280, undefined, false]);
        expect(getComputedStyle(text).position).toBe('static');

        trigger(page).click();
        await settle(page);
        await wait(350);
        expect(width(page)).toBe(60);
        expect(sr(inner(label, '.label'))).toBe(true);
        expect(sr(page.querySelector('#brand')!)).toBe(true);
        expect(sr(text)).toBe(true);
        expect(getComputedStyle(page.querySelector('#home-icon')!).display).not.toBe('none');
        const badge = inner(page.querySelector('ge-sidebar-menu-badge')!, 'span');
        expect([badge.getBoundingClientRect().width, getComputedStyle(badge).fontSize]).toEqual([8, '0px']);
        expect(getComputedStyle(inner(page.querySelector('ge-sidebar-menu-action')!, 'button')).display).toBe('none');
        expect(page.querySelector('ge-sidebar-menu-skeleton')!.shadowRoot!.querySelectorAll('ge-skeleton')).toHaveLength(1);
        expect(inner(page.querySelector('ge-sidebar-menu-sub')!, '.wrap').dataset.state).toBe('closed');

        trigger(page).click();
        await settle(page);
        await wait(350);
        expect(width(page)).toBe(280);
        expect(page.querySelector('ge-sidebar-menu-skeleton')!.shadowRoot!.querySelectorAll('ge-skeleton')).toHaveLength(2);
    });

    it('collapse-mode hidden shrinks the sidebar to nothing, and variants change its geometry', async () => {
        const page = await mount(SHELL('', 'collapse-mode="hidden"'));
        trigger(page).click();
        await settle(page);
        await wait(350);
        expect(width(page)).toBe(0);
        const floating = await mount(SHELL('', 'variant="floating"'));
        await settle(floating);
        const box = aside(floating);
        expect([getComputedStyle(box).marginLeft, getComputedStyle(box).borderRadius !== '0px', Math.round(box.getBoundingClientRect().height)]).toEqual(['8px', true, 784]);
    });

    it('collapsible="false" pins the rail open: the trigger does nothing and a remembered collapsed flag is dropped', async () => {
        localStorage.setItem(KEY, 'true');
        const page = await mount(SHELL('', 'collapsible="false"'));
        await settle(page);
        await wait(350);
        const text = page.querySelector('#home span')!;
        expect([width(page), provider(page).isCollapsed, sr(text)]).toEqual([280, false, false]);
        trigger(page).click();
        await settle(page);
        expect([width(page), provider(page).isCollapsed, sr(text), localStorage.getItem(KEY)]).toEqual([280, false, false, 'true']);
    });

    it('remembers the collapsed flag: read once on load, written on each change, ignored when it is not exactly true or false', async () => {
        localStorage.setItem(KEY, 'true');
        const page = await mount(SHELL());
        await settle(page);
        expect(provider(page).isCollapsed).toBe(true);
        trigger(page).click();
        await settle(page);
        expect(localStorage.getItem(KEY)).toBe('false');
        localStorage.setItem(KEY, 'yes');
        const other = await mount(SHELL());
        expect(provider(other).isCollapsed).toBe(false);
        localStorage.setItem('mine', 'true');
        const keyed = await mount(SHELL('storage-key="mine"'));
        expect(provider(keyed).isCollapsed).toBe(true);
        trigger(keyed).click();
        await settle(keyed);
        expect([localStorage.getItem('mine'), localStorage.getItem(KEY)]).toEqual(['false', 'yes']);
        localStorage.removeItem('mine');
        const forgetful = await mount(SHELL('persist-collapsed="false"'));
        trigger(forgetful).click();
        await settle(forgetful);
        expect([provider(forgetful).isCollapsed, localStorage.getItem(KEY)]).toEqual([true, 'yes']);
    });

    it('leaves Escape and Tab alone on a wide page, where the sidebar is not modal', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, composed: true });
        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, composed: true });
        aside(page).dispatchEvent(escape);
        aside(page).dispatchEvent(tab);
        expect([escape.defaultPrevented, tab.defaultPrevented, provider(page).isOpen]).toEqual([false, false, true]);
    });

    it('stops watching the page width once it is removed', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const detached = provider(page);
        detached.remove();
        await browser.viewport(600, 800);
        await wait(100);
        expect(detached.isMobile).toBe(false);
    });

    it('still works when storage throws', async () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
        try {
            const page = await mount(SHELL());
            await settle(page);
            trigger(page).click();
            await settle(page);
            expect(provider(page).isCollapsed).toBe(true);
        } finally {
            Object.defineProperty(globalThis, 'localStorage', original);
        }
    });

    it('opens and closes a sub-menu with its trigger, keeps closed rows out of the tab order, and closes it on a collapsed rail', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const sub = page.querySelector<GeSidebarMenuSub>('ge-sidebar-menu-sub')!;
        const button = inner(page.querySelector('ge-sidebar-menu-sub-trigger')!, 'button');
        const events: boolean[] = [];
        sub.addEventListener('expanded-change', (e) => events.push((e as CustomEvent<boolean>).detail));
        const list = () => inner(sub, 'ul');
        expect([button.getAttribute('aria-expanded'), list().inert, sub.expanded]).toEqual(['true', false, true]);
        button.click();
        await settle(page);
        expect([button.getAttribute('aria-expanded'), list().inert, sub.expanded, events]).toEqual(['false', true, false, [false]]);
        button.click();
        await settle(page);
        trigger(page).click();
        await settle(page);
        expect([list().inert, button.getAttribute('aria-expanded'), sub.expanded]).toEqual([true, 'false', true]);
        const closed = await mount(SHELL().replace('<ge-sidebar-menu-sub id="projects">', '<ge-sidebar-menu-sub id="projects" expanded="false">'));
        await settle(closed);
        expect(inner(closed.querySelector('ge-sidebar-menu-sub')!, 'ul').inert).toBe(true);
        expect(inner(closed.querySelector('ge-sidebar-menu-sub-trigger')!, 'button').getAttribute('aria-expanded')).toBe('false');
    });

    it('shows a body-level bubble beside a collapsed button after a short hover, and never while expanded', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const button = inner(page.querySelector('#inbox-btn')!, 'button');
        const bubble = () => [...document.body.children].find((el) => el.textContent === 'Inbox' && getComputedStyle(el).position === 'fixed');
        await userEvent.hover(button);
        await wait(300);
        expect(bubble()).toBeUndefined();
        await userEvent.unhover(button);
        trigger(page).click();
        await settle(page);
        await wait(350);
        await userEvent.hover(button);
        await wait(300);
        const shown = bubble() as HTMLElement;
        const rect = shown.getBoundingClientRect();
        const anchor = button.getBoundingClientRect();
        expect([Math.round(rect.left - anchor.right), button.getAttribute('aria-label')]).toEqual([8, 'Inbox']);
        await userEvent.unhover(button);
        expect(bubble()).toBeUndefined();
    });

    it('marks the current link and sub-link, and a menu action fires triggered without following anything', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const link = inner(page.querySelector('#home')!, 'a');
        const sub = inner(page.querySelector('#apollo')!, 'a');
        expect([link.getAttribute('aria-current'), link.getAttribute('href'), sub.getAttribute('aria-current'), inner(page.querySelector('ge-sidebar-menu-link:not([active])')!, 'a').hasAttribute('aria-current')]).toEqual(['page', '#home', 'page', false]);
        const action = page.querySelector('ge-sidebar-menu-action')!;
        const seen: boolean[] = [];
        action.addEventListener('triggered', (e) => seen.push((e as CustomEvent<MouseEvent>).detail.defaultPrevented));
        const outer: string[] = [];
        page.querySelector('ge-sidebar-menu-item:nth-child(4)')!.addEventListener('click', () => outer.push('item'));
        inner(action, 'button').click();
        expect([seen, outer]).toEqual([[true], []]);
    });

    it('lets the rail collapse and expand the sidebar and name itself for the state, unless given a label', async () => {
        const page = await mount(SHELL());
        await settle(page);
        const rail = inner(page.querySelector('ge-sidebar-rail')!, 'button');
        expect([rail.getAttribute('aria-label'), rail.title, rail.getAttribute('aria-expanded')]).toEqual(['Collapse sidebar', 'Collapse sidebar', 'true']);
        rail.click();
        await settle(page);
        expect([rail.getAttribute('aria-label'), rail.getAttribute('aria-expanded'), provider(page).isCollapsed]).toEqual(['Expand sidebar', 'false', true]);
        page.querySelector('ge-sidebar-rail')!.setAttribute('label', 'Resize');
        await settle(page);
        expect([rail.getAttribute('aria-label'), rail.title]).toEqual(['Resize', 'Resize']);
    });

    it('hides a badge from assistive technology unless it is set to announce', async () => {
        const page = await mount(SHELL().replace('<ge-sidebar-menu-badge>12', '<ge-sidebar-menu-badge announce>12'));
        await settle(page);
        const quiet = await mount(SHELL());
        await settle(quiet);
        const hidden = (root: HTMLElement) => inner(root.querySelector('ge-sidebar-menu-badge')!, 'span').getAttribute('aria-hidden');
        expect([hidden(page), hidden(quiet)]).toEqual([null, 'true']);
    });

    it('picks the skeleton text bar width from the seed, wrapping and tolerating negative and fractional seeds', async () => {
        const widths = async (seed: string) => {
            const page = await mount(`<ge-sidebar-provider><ge-sidebar-menu-skeleton seed="${seed}"></ge-sidebar-menu-skeleton></ge-sidebar-provider>`);
            await settle(page);
            return inner(page.querySelector('ge-sidebar-menu-skeleton')!, '.bar').dataset.width;
        };
        expect(await Promise.all(['0', '1', '2', '3', '4', '-1', '2.9'].map(widths))).toEqual(['0', '1', '2', '3', '0', '1', '2']);
    });

    it('has no axe violations expanded and collapsed', async () => {
        const page = await mount(SHELL());
        await settle(page);
        await wait(300);
        expect((await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
        trigger(page).click();
        await settle(page);
        await wait(400);
        expect((await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
    });
});

describe('ge-sidebar as a drawer on a narrow page', () => {
    const narrow = async () => {
        await browser.viewport(600, 800);
        const page = await mount(SHELL());
        await settle(page);
        return page;
    };

    it('is off-screen until the trigger opens it, then closes from the scrim, Escape and a resize to desktop', async () => {
        const page = await narrow();
        const box = aside(page);
        expect([provider(page).isMobile, provider(page).isOpen, box.getBoundingClientRect().right <= 0]).toEqual([true, false, true]);
        expect(page.querySelector('ge-sidebar')!.shadowRoot!.querySelector('.scrim')).toBeNull();
        expect(trigger(page).getAttribute('aria-expanded')).toBe('false');
        trigger(page).click();
        await settle(page);
        await wait(350);
        expect([box.getBoundingClientRect().left, box.getBoundingClientRect().width, trigger(page).getAttribute('aria-expanded')]).toEqual([0, 280, 'true']);
        const scrim = () => page.querySelector('ge-sidebar')!.shadowRoot!.querySelector<HTMLElement>('.scrim');
        expect([scrim()!.getAttribute('role'), scrim()!.getAttribute('aria-label')]).toEqual(['button', 'Close sidebar']);
        scrim()!.click();
        await settle(page);
        expect(provider(page).isOpen).toBe(false);
        trigger(page).click();
        await settle(page);
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, composed: true }));
        await settle(page);
        expect(provider(page).isOpen).toBe(false);
        trigger(page).click();
        await settle(page);
        scrim()!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
        await settle(page);
        expect(provider(page).isOpen).toBe(false);
        await browser.viewport(1000, 800);
        await wait(100);
        await settle(page);
        expect([provider(page).isMobile, width(page)]).toEqual([false, 280]);
    });

    it('moves focus into the open drawer, wraps Tab inside it and gives focus back when it closes', async () => {
        const page = await narrow();
        trigger(page).focus();
        trigger(page).click();
        await settle(page);
        await wait(50);
        expect(inside(deepActive(), page.querySelector('ge-sidebar')!)).toBe(true);
        const stops = [] as Element[];
        for (let i = 0; i < 12; i++) {
            await userEvent.tab();
            stops.push(deepActive()!);
        }
        expect(stops.every((el) => inside(el, page.querySelector('ge-sidebar')!))).toBe(true);
        expect(new Set(stops).size).toBeGreaterThan(3);
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(deepActive()).toBe(trigger(page));
    });

    it('crossing into mobile closes an open drawer and the rail ignores the collapsed flag', async () => {
        localStorage.setItem(KEY, 'true');
        const page = await narrow();
        expect(inner(page.querySelector('ge-sidebar-menu-sub')!, '.wrap').dataset.state).toBe('open');
        expect(page.querySelector('#home')!.querySelector('span')!.checkVisibility()).toBe(true);
        trigger(page).click();
        await settle(page);
        expect(provider(page).isCollapsed).toBe(true);
        expect(provider(page).isOpen).toBe(true);
        expect(localStorage.getItem(KEY)).toBe('true');
    });
});
