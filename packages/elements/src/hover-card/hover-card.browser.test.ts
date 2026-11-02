import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page as viewport } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeHoverCard } from './index.js';

const MARKUP = (attrs = '', wrap = '') => `<div style="padding:120px 300px;${wrap}">
<ge-hover-card>
  <ge-hover-card-trigger><ge-button id="t" variant="link">@gilav21</ge-button></ge-hover-card-trigger>
  <ge-hover-card-content heading="@gilav21" description="Maintains the web components port." ${attrs}><a id="inside" href="#x">Profile</a></ge-hover-card-content>
</ge-hover-card>
<button id="outside">outside</button>
</div>`;

const card = (page: HTMLElement) => page.querySelector<GeHoverCard>('ge-hover-card')!;
const panel = (page: HTMLElement) => page.querySelector('ge-hover-card-content')!.shadowRoot!.querySelector<HTMLElement>('.panel');
const base = (page: HTMLElement) => page.querySelector('ge-hover-card-trigger')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
};
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);

afterEach(() => vi.restoreAllMocks());

describe('ge-hover-card', () => {
    describe('timing', () => {
        // Fake timers make every window exact; the pointer is two synthetic events on the element it would cross.
        const enter = (el: Element) => el.dispatchEvent(new MouseEvent('mouseenter'));
        const leave = (el: Element) => el.dispatchEvent(new MouseEvent('mouseleave'));
        const fake = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        afterEach(() => vi.useRealTimers());

        it('opens after the hover dwell, stays open while the pointer is on the card, and closes after a grace period', async () => {
            fake();
            const page = await mount(MARKUP());
            enter(base(page));
            vi.advanceTimersByTime(199);
            expect(card(page).open).toBe(false);
            vi.advanceTimersByTime(1);
            await settle(page);
            expect(card(page).open).toBe(true);
            expect(panel(page)!.querySelector('h4')!.textContent).toBe('@gilav21');

            leave(base(page));
            enter(panel(page)!);
            vi.advanceTimersByTime(1000);
            expect(card(page).open).toBe(true);

            leave(panel(page)!);
            vi.advanceTimersByTime(299);
            expect(card(page).open).toBe(true);
            vi.advanceTimersByTime(1);
            await settle(page);
            expect(card(page).open).toBe(false);
            expect(panel(page)).toBeNull();
        });

        it('a pointer that leaves before the dwell ends never opens it', async () => {
            fake();
            const page = await mount(MARKUP());
            enter(base(page));
            vi.advanceTimersByTime(50);
            leave(base(page));
            // Past the dwell but before the close delay would hide it again: a cancelled open must not have fired.
            vi.advanceTimersByTime(200);
            expect(card(page).open).toBe(false);
        });

        it('coming back to the trigger during the close grace period keeps it open', async () => {
            fake();
            const page = await mount(MARKUP());
            enter(base(page));
            vi.advanceTimersByTime(200);
            leave(base(page));
            vi.advanceTimersByTime(200);
            enter(base(page));
            // Past the original close time but before a re-armed open would land: only a cancelled close keeps it up.
            vi.advanceTimersByTime(150);
            expect(card(page).open).toBe(true);
        });
    });

    it('opens when the trigger wrapper takes keyboard focus and closes when it loses it', async () => {
        const page = await mount(MARKUP());
        base(page).focus();
        await wait(300);
        expect(card(page).open).toBe(true);
        base(page).blur();
        await wait(400);
        expect(card(page).open).toBe(false);
    });

    it('places the card 8px from the trigger on the chosen side, aligned to its start, centre or end', async () => {
        for (const dir of ['ltr', 'rtl']) {
            for (const [side, align] of [['bottom', 'start'], ['bottom', 'center'], ['top', 'end'], ['top', 'center']] as const) {
                const page = await mount(`<div dir="${dir}">${MARKUP(`side="${side}" align="${align}"`)}</div>`);
                card(page).open = true;
                await settle(page);
                const host = card(page).getBoundingClientRect();
                const p = panel(page)!.getBoundingClientRect();
                near(side === 'bottom' ? p.top - host.bottom : host.top - p.bottom, 8);
                const startEdge = dir === 'ltr' ? 'left' : 'right';
                const startsAt = align === 'start' ? startEdge : align === 'end' ? (dir === 'ltr' ? 'right' : 'left') : null;
                if (startsAt) near(p[startsAt], host[startsAt]);
                else near(p.left + p.width / 2, host.left + host.width / 2);
                page.remove();
            }
        }
    });

    it('nudges a card back inside the viewport and flips it above a trigger near the bottom', async () => {
        const edge = await mount(MARKUP('', 'padding:120px 0 0;margin-left:1200px'));
        card(edge).open = true;
        await settle(edge);
        expect(panel(edge)!.getBoundingClientRect().right).toBeLessThanOrEqual(1280 - 8 + 1);

        const low = await mount(MARKUP('', 'padding:640px 300px 0'));
        card(low).open = true;
        await settle(low);
        expect(panel(low)!.dataset.side).toBe('top');
    });

    it('shows the projected body below the generated heading, or alone in custom mode', async () => {
        const page = await mount(MARKUP());
        card(page).open = true;
        await settle(page);
        const slotted = panel(page)!.querySelector('slot')!.assignedElements();
        expect(slotted.map((e) => e.id)).toEqual(['inside']);

        const custom = await mount(MARKUP().replace('heading="@gilav21" description="Maintains the web components port."', ''));
        card(custom).open = true;
        await settle(custom);
        expect(panel(custom)!.querySelector('h4')).toBeNull();
    });

    describe('on a touch screen', () => {
        const coarse = () => {
            const real = globalThis.matchMedia.bind(globalThis);
            vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('pointer: coarse') ? ({ matches: true } as MediaQueryList) : real(query)));
        };

        it('a tap toggles it at once, cancels the content default, and a tap elsewhere closes it; hover does nothing', async () => {
            coarse();
            const page = await mount(MARKUP());
            base(page).dispatchEvent(new MouseEvent('mouseenter'));
            await wait(300);
            expect(card(page).open).toBe(false);

            const tap = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
            base(page).dispatchEvent(tap);
            expect(tap.defaultPrevented).toBe(true);
            expect(card(page).open).toBe(true);

            page.querySelector<HTMLElement>('#inside')!.click();
            expect(card(page).open).toBe(true);

            page.querySelector<HTMLElement>('#outside')!.click();
            expect(card(page).open).toBe(false);

            base(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            expect(card(page).open).toBe(true);
            base(page).dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
            expect(card(page).open).toBe(false);
        });
    });

    it('leaves a click on the trigger alone on a device with a mouse', async () => {
        const page = await mount(MARKUP());
        const click = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true });
        base(page).dispatchEvent(click);
        expect(click.defaultPrevented).toBe(false);
        expect(card(page).open).toBe(false);
    });

    it('is accessible in both themes and fits a 320px phone', async () => {
        for (const dark of [false, true]) {
            useTheme(dark ? 'dark' : 'light');
            const page = await mount(MARKUP());
            card(page).open = true;
            await settle(page);
            const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(results.violations.map((v) => v.id)).toEqual([]);
        }
        await viewport.viewport(320, 640);
        const narrow = await mount(MARKUP('', 'padding:100px 0 0'));
        card(narrow).open = true;
        await settle(narrow);
        const p = panel(narrow)!.getBoundingClientRect();
        expect(p.left).toBeGreaterThanOrEqual(0);
        expect(p.right).toBeLessThanOrEqual(320);
        await viewport.viewport(1280, 800);
    });
});
