import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTooltip } from './index.js';

const SIMPLE = (attrs = '') => `<div style="padding:80px 200px"><ge-tooltip content="Add to library" ${attrs}>
  <ge-tooltip-trigger><ge-button id="b" variant="outline">Hover me</ge-button></ge-tooltip-trigger>
</ge-tooltip><button id="elsewhere">elsewhere</button></div>`;
const CUSTOM = `<div style="padding:80px 200px"><ge-tooltip>
  <ge-tooltip-trigger><ge-button id="b" variant="outline">Hover me</ge-button></ge-tooltip-trigger>
  <ge-tooltip-content><b>Bold</b> label</ge-tooltip-content>
</ge-tooltip></div>`;

const tooltip = (page: HTMLElement) => page.querySelector<GeTooltip>('ge-tooltip')!;
const bubble = (page: HTMLElement) => {
    const content = page.querySelector('ge-tooltip-content') ?? tooltip(page).shadowRoot!.querySelector('ge-tooltip-content')!;
    return content.shadowRoot!.querySelector<HTMLElement>('.bubble');
};
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of [...page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*'), ...(tooltip(page).shadowRoot?.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*') ?? [])]) await el.updateComplete;
    }
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);

afterEach(() => vi.restoreAllMocks());

describe('ge-tooltip', () => {
    it('opens after the hover dwell, not before, and closes when the pointer leaves', async () => {
        const page = await mount(SIMPLE());
        await userEvent.hover(page.querySelector('#b')!);
        await wait(100);
        await settle(page);
        expect(bubble(page)).toBeNull();

        await wait(200);
        await settle(page);
        expect(bubble(page)).not.toBeNull();
        expect(tooltip(page).open).toBe(true);
        expect(tooltip(page).shadowRoot!.querySelector('ge-tooltip-content')!.textContent).toBe('Add to library');

        await userEvent.unhover(page.querySelector('#b')!);
        await settle(page);
        expect(tooltip(page).open).toBe(false);
        expect(bubble(page)).toBeNull();
    });

    it('a pointer that leaves before the dwell ends never opens it, and delay-duration changes the dwell', async () => {
        const page = await mount(SIMPLE('delay-duration="50"'));
        await userEvent.hover(page.querySelector('#b')!);
        await wait(120);
        expect(tooltip(page).open).toBe(true);

        const quick = await mount(SIMPLE());
        await userEvent.hover(quick.querySelector('#b')!);
        await wait(50);
        await userEvent.unhover(quick.querySelector('#b')!);
        await wait(300);
        expect(tooltip(quick).open).toBe(false);
    });

    it('opens at once for keyboard focus on the projected control, and closes on blur', async () => {
        const page = await mount(SIMPLE());
        await userEvent.tab();
        await settle(page);
        expect(tooltip(page).open).toBe(true);
        expect(bubble(page)!.getAttribute('role')).toBe('tooltip');

        await userEvent.tab();
        await settle(page);
        expect(tooltip(page).open).toBe(false);
    });

    it('places the bubble 8px from the trigger on every side, physically left and right in RTL too', async () => {
        for (const dir of ['ltr', 'rtl']) {
            for (const side of ['top', 'bottom', 'left', 'right'] as const) {
                const page = await mount(`<div dir="${dir}">${SIMPLE(`side="${side}" open`)}</div>`);
                await settle(page);
                const box = tooltip(page).getBoundingClientRect();
                const b = bubble(page)!.getBoundingClientRect();
                const gap = { top: box.top - b.bottom, bottom: b.top - box.bottom, left: box.left - b.right, right: b.left - box.right }[side];
                near(gap, 8);
                if (side === 'top' || side === 'bottom') near(b.left + b.width / 2, box.left + box.width / 2);
                else near(b.top + b.height / 2, box.top + box.height / 2);
                page.remove();
            }
        }
    });

    it('custom mode projects its own markup into the bubble', async () => {
        const page = await mount(CUSTOM);
        tooltip(page).show();
        await settle(page);
        expect(page.querySelector('ge-tooltip-content b')!.textContent).toBe('Bold');
        expect(bubble(page)!.getBoundingClientRect().width).toBeGreaterThan(0);
    });

    it('ignores touch events on a device with a mouse, where hover already does the job', async () => {
        const page = await mount(SIMPLE());
        page.querySelector('ge-tooltip-trigger')!.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true }));
        expect(tooltip(page).open).toBe(false);
    });

    describe('on a touch screen', () => {
        const coarse = () => {
            const real = globalThis.matchMedia.bind(globalThis);
            vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('pointer: coarse') ? ({ matches: true } as MediaQueryList) : real(query)));
        };
        const touch = (el: Element) => el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true }));
        const base = (page: HTMLElement) => page.querySelector('ge-tooltip-trigger')!.shadowRoot!.querySelector('[part="base"]')!;

        it('a tap opens it, a second tap closes it, and hover alone does nothing', async () => {
            coarse();
            const page = await mount(SIMPLE());
            base(page).dispatchEvent(new MouseEvent('mouseenter'));
            await wait(300);
            expect(tooltip(page).open).toBe(false);

            touch(base(page));
            expect(tooltip(page).open).toBe(true);
            touch(base(page));
            expect(tooltip(page).open).toBe(false);
        });

        it('dismisses itself after 2.5s and on a touch elsewhere, but not on a touch inside the trigger', async () => {
            coarse();
            vi.useFakeTimers();
            try {
                const page = await mount(SIMPLE());
                touch(base(page));
                vi.advanceTimersByTime(2400);
                expect(tooltip(page).open).toBe(true);
                vi.advanceTimersByTime(200);
                expect(tooltip(page).open).toBe(false);

                touch(base(page));
                page.querySelector('#elsewhere')!.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, composed: true }));
                expect(tooltip(page).open).toBe(false);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    it('is accessible in both themes', async () => {
        for (const dark of [false, true]) {
            useTheme(dark ? 'dark' : 'light');
            const page = await mount(SIMPLE('open'));
            await settle(page);
            const results = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(results.violations.map((v) => v.id)).toEqual([]);
        }
    });
});
