import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { page as viewport, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { flippedSideByRoom, verticalNudge } from '../shared/anchor.js';
import { deepActive } from '../shared/overlay.js';
import type { GePopover } from './index.js';

const MARKUP = (content = '', wrap = '') => `<div style="padding:200px 300px;${wrap}">
<ge-popover>
  <ge-popover-trigger><ge-button id="open" variant="outline">Open popover</ge-button></ge-popover-trigger>
  <ge-popover-content ${content}>
    <p style="margin:0">Dimensions</p><input id="width" aria-label="Width">
    <ge-popover-close><ge-button id="done" size="sm">Done</ge-button></ge-popover-close>
  </ge-popover-content>
</ge-popover>
<button id="outside">outside</button>
</div>`;

const popover = (page: HTMLElement) => page.querySelector<GePopover>('ge-popover')!;
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
};
const panel = (page: HTMLElement) => page.querySelector('ge-popover-content')!.shadowRoot!.querySelector<HTMLElement>('.panel');
// The panel is placed against the popover's own box, which is slightly taller than the inline trigger inside it.
const host = (page: HTMLElement) => page.querySelector('ge-popover')!;
const trigger = (page: HTMLElement) => page.querySelector('ge-popover-trigger')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const open = async (page: HTMLElement) => {
    page.querySelector<HTMLElement>('#open')!.click();
    await settle(page);
};
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);

describe('ge-popover', () => {
    it('opens from the trigger beneath it, centred and 4px away, and closes from a click outside, Escape or the close part', async () => {
        const page = await mount(MARKUP());
        await settle(page);
        expect(panel(page)).toBeNull();

        await open(page);
        const p = panel(page)!.getBoundingClientRect();
        const t = host(page).getBoundingClientRect();
        expect(popover(page).open).toBe(true);
        close(p.top, t.bottom + 4);
        close(p.left + p.width / 2, t.left + t.width / 2);
        expect(p.width).toBe(288);

        panel(page)!.querySelector('slot')!.assignedElements()[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
        await settle(page);
        expect(popover(page).open).toBe(true);

        page.querySelector<HTMLElement>('#outside')!.click();
        await settle(page);
        expect(popover(page).open).toBe(false);

        await open(page);
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(popover(page).open).toBe(false);

        await open(page);
        page.querySelector<HTMLElement>('#done')!.click();
        await settle(page);
        expect(popover(page).open).toBe(false);
    });

    it('gives focus back to the trigger on close unless the user already moved it elsewhere', async () => {
        const page = await mount(MARKUP());
        await open(page);
        page.querySelector<HTMLElement>('#width')!.focus();
        await userEvent.keyboard('{Escape}');
        await settle(page);
        expect(deepActive(document)).toBe(page.querySelector('#open')!.shadowRoot!.querySelector('button'));

        await open(page);
        page.querySelector<HTMLElement>('#outside')!.focus();
        page.querySelector<HTMLElement>('#outside')!.click();
        await settle(page);
        expect(deepActive(document)).toBe(page.querySelector('#outside'));
    });

    it('places the panel on every side and alignment the way Angular does', async () => {
        const expectations: Record<string, (p: DOMRect, t: DOMRect) => void> = {
            'side="top" align="start"': (p, t) => { close(p.bottom, t.top - 4); close(p.left, t.left); },
            'side="top" align="end"': (p, t) => { close(p.bottom, t.top - 4); close(p.right, t.right); },
            'side="bottom" align="start"': (p, t) => { close(p.top, t.bottom + 4); close(p.left, t.left); },
            'side="left"': (p, t) => { close(p.right, t.left - 4); close(p.top, t.top); },
            'side="right"': (p, t) => { close(p.left, t.right + 4); close(p.top, t.top); },
            'side-offset="12"': (p, t) => { close(p.top, t.bottom + 12); },
        };
        for (const [attrs, check] of Object.entries(expectations)) {
            const page = await mount(MARKUP(attrs));
            await open(page);
            check(panel(page)!.getBoundingClientRect(), host(page).getBoundingClientRect());
            // Each case must start from the top of an empty page, or later ones sit below the fold and flip.
            page.remove();
        }
    });

    it('keeps the panel inside the viewport: nudged off a side edge, flipped above when there is no room below', async () => {
        const page = await mount(MARKUP('align="end"', 'padding:0'));
        await open(page);
        expect(panel(page)!.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);

        const edge = await mount(MARKUP('', 'padding:0;margin-left:1180px'));
        await open(edge);
        const right = panel(edge)!.getBoundingClientRect();
        expect(right.right).toBeLessThanOrEqual(1280 - 8 + 1);

        const low = await mount(MARKUP('', 'padding:640px 300px 0'));
        await open(low);
        const p = panel(low)!.getBoundingClientRect();
        const t = host(low).getBoundingClientRect();
        expect(panel(low)!.dataset.side).toBe('top');
        close(p.bottom, t.top - 4);
    });

    it('still sees the screen edge when a tall page clips sideways, as the demo page does with overflow-x: clip on body', async () => {
        document.body.style.overflowX = 'clip';
        try {
            const low = await mount(MARKUP('', 'padding:720px 300px 0;height:3000px'));
            await open(low);
            expect(panel(low)!.dataset.side).toBe('top');
        } finally {
            document.body.style.overflowX = '';
        }
    });

    it('stays on its preferred side when neither side has room for it', async () => {
        await viewport.viewport(1280, 150);
        const page = await mount(MARKUP('', 'padding:40px 300px 0'));
        await open(page);
        expect(panel(page)!.dataset.side).toBe('bottom');
        await viewport.viewport(1280, 800);
    });

    it('does not move a panel that would clip when collisions are off', async () => {
        const page = await mount(MARKUP('no-collisions', 'padding:640px 300px 0'));
        await open(page);
        expect(panel(page)!.dataset.side).toBe('bottom');
    });

    it('in fixed mode renders in the top layer, escapes an overflow:hidden ancestor and follows the trigger', async () => {
        const page = await mount(MARKUP('strategy="fixed"', 'overflow:hidden;height:120px;position:relative'));
        await open(page);
        const el = panel(page)!;
        const t = trigger(page).getBoundingClientRect();
        const p = el.getBoundingClientRect();
        expect(el.matches(':popover-open')).toBe(true);
        close(p.top, t.bottom + 4);
        close(p.left + p.width / 2, t.left + t.width / 2);
        expect(getComputedStyle(el).position).toBe('fixed');
        // One case at a time: a trigger pushed below the fold would have its panel pinned inside the viewport.
        page.remove();

        const top = await mount(MARKUP('strategy="fixed" side="top" align="end"', 'padding:300px'));
        await open(top);
        const tp = panel(top)!.getBoundingClientRect();
        const tt = trigger(top).getBoundingClientRect();
        close(tp.bottom, tt.top - 4);
        close(tp.right, tt.right);
        top.remove();

        const side = await mount(MARKUP('strategy="fixed" side="right"', 'padding:300px'));
        await open(side);
        const sp = panel(side)!.getBoundingClientRect();
        const st = trigger(side).getBoundingClientRect();
        close(sp.left, st.right + 4);
        close(sp.top, st.top);
    });

    it('a fixed panel flips below a trigger near the top instead of covering it, and exposes its offset and the trigger width', async () => {
        const page = await mount(MARKUP('strategy="fixed" side="top" side-offset="10"', 'padding:8px 300px 400px'));
        await open(page);
        const el = panel(page)!;
        const t = trigger(page).getBoundingClientRect();
        const p = el.getBoundingClientRect();
        expect(p.top).toBeGreaterThanOrEqual(t.bottom);
        close(p.top, t.bottom + 10);
        expect(el.dataset['side']).toBe('bottom');
        expect(el.style.getPropertyValue('--_offset')).toBe('10px');
        // The public property wins over the attribute when set on the panel part, and does not leak in from an ancestor.
        page.style.setProperty('--popover-offset', '60px');
        await settle(page);
        close(el.getBoundingClientRect().top, t.bottom + 10);
        const rule = document.createElement('style');
        rule.textContent = 'ge-popover-content::part(panel){--popover-offset:30px}';
        page.append(rule);
        await settle(page);
        close(el.getBoundingClientRect().top, t.bottom + 30);
        close(Number.parseFloat(el.style.getPropertyValue('--trigger-width')), t.width);
    });

    it('a fixed panel that fits on neither side is flipped to the roomier one and clamped 8px inside the viewport', () => {
        const bounds = new DOMRect(0, 0, 800, 600);
        const anchor = new DOMRect(100, 150, 80, 30);
        expect(flippedSideByRoom('top', new DOMRect(100, -520, 200, 700), anchor, bounds, 4)).toBe('bottom');
        expect(flippedSideByRoom('bottom', new DOMRect(100, 184, 200, 700), anchor, bounds, 4)).toBe('bottom');
        expect(flippedSideByRoom('top', new DOMRect(100, 20, 200, 100), anchor, bounds, 4)).toBe('top');
        expect(verticalNudge(new DOMRect(0, 300, 10, 400), bounds)).toBe(-108);
        expect(verticalNudge(new DOMRect(0, 100, 10, 700), bounds)).toBe(-92);
        expect(verticalNudge(new DOMRect(0, 3, 10, 700), bounds)).toBe(0);
        expect(verticalNudge(new DOMRect(0, -30, 10, 100), bounds)).toBe(38);
        expect(verticalNudge(new DOMRect(0, 10, 10, 100), bounds)).toBe(0);
    });

    it('a fixed panel that fits on neither side settles, whatever gap is drawn, instead of flipping every frame', async () => {
        const tall = '<div style="height:345px">tall</div>';
        const page = await mount(`<div style="padding:383px 300px 0"><ge-popover><ge-popover-trigger><ge-button id="open">Open</ge-button></ge-popover-trigger><ge-popover-content strategy="fixed" side="bottom" side-offset="4">${tall}</ge-popover-content></ge-popover></div><style>ge-popover-content::part(panel){--popover-offset:30px}</style>`);
        page.querySelector<HTMLElement>('#open')!.click();
        const frames = async (n: number) => { for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(null))); };
        await frames(8);
        const sides: (string | undefined)[] = [];
        // Every frame: sampling every other one would land on the same side of an oscillation each time.
        for (let i = 0; i < 8; i++) {
            await frames(1);
            sides.push(panel(page)!.dataset['side']);
        }
        expect(new Set(sides).size).toBe(1);
    });

    it('fires open-change for user changes only, and close-on-scroll closes it when the page scrolls', async () => {
        const page = await mount(MARKUP('', 'height:2000px'));
        popover(page).setAttribute('close-on-scroll', '');
        const events: boolean[] = [];
        popover(page).addEventListener('open-change', (e) => events.push((e as CustomEvent<boolean>).detail));
        popover(page).open = true;
        await settle(page);
        expect(events).toEqual([]);
        await new Promise((r) => setTimeout(r, 20));
        window.scrollTo(0, 100);
        await new Promise((r) => setTimeout(r, 50));
        await settle(page);
        expect(popover(page).open).toBe(false);
        expect(events).toEqual([false]);
        window.scrollTo(0, 0);
    });

    it('stays open through a page scroll unless close-on-scroll is set', async () => {
        const page = await mount(MARKUP('', 'height:2000px'));
        popover(page).open = true;
        await settle(page);
        await new Promise((r) => setTimeout(r, 20));
        window.scrollTo(0, 100);
        await new Promise((r) => setTimeout(r, 50));
        expect(popover(page).open).toBe(true);
        window.scrollTo(0, 0);
    });

    it('a plain-text trigger becomes a button that Enter and Space operate', async () => {
        const page = await mount(MARKUP().replace('<ge-button id="open" variant="outline">Open popover</ge-button>', 'Open'));
        const base = trigger(page);
        expect(base.getAttribute('role')).toBe('button');
        base.focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(popover(page).open).toBe(true);
        await userEvent.keyboard(' ');
        await settle(page);
        expect(popover(page).open).toBe(false);
    });

    it('is accessible in both themes, and shrinks to the viewport on a phone', async () => {
        for (const dark of [false, true]) {
            useTheme(dark ? 'dark' : 'light');
            const page = await mount(MARKUP());
            await open(page);
            const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(results.violations.map((v) => v.id)).toEqual([]);
        }
        await viewport.viewport(320, 640);
        const narrow = await mount(MARKUP('', 'padding:100px 0 0'));
        await open(narrow);
        const p = panel(narrow)!.getBoundingClientRect();
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.right).toBeLessThanOrEqual(320);
        await viewport.viewport(1280, 800);
    });
});
