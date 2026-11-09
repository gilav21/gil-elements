import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCarousel, GeCarouselContent, GeCarouselNext, GeCarouselPrevious } from './index.js';

const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
        await new Promise((r) => setTimeout(r, 0));
    }
    await new Promise((r) => setTimeout(r, 30));
};
const until = async (done: () => boolean) => {
    for (let i = 0; i < 100 && !done(); i++) await new Promise((r) => setTimeout(r, 20));
    expect(done()).toBe(true);
};
const slides = (n: number, size = 'height:80px') => Array.from({ length: n }, (...[, i]) => `<ge-carousel-item><div style="${size}">Slide ${i + 1}</div></ge-carousel-item>`).join('');
const carousel = async (attrs = '', count = 5, wrapAttrs = '', size?: string) => {
    const page = await mount(`<div ${wrapAttrs} style="padding:48px 64px;width:300px"><ge-carousel ${attrs} style="width:300px"><ge-carousel-content ${attrs.includes('vertical') ? 'style="height:160px"' : ''}>${slides(count, size)}</ge-carousel-content><ge-carousel-previous></ge-carousel-previous><ge-carousel-next></ge-carousel-next></ge-carousel></div>`);
    await settle(page);
    return {
        page,
        c: page.querySelector<GeCarousel>('ge-carousel')!,
        track: page.querySelector<GeCarouselContent>('ge-carousel-content')!,
        prev: page.querySelector<GeCarouselPrevious>('ge-carousel-previous')!.shadowRoot!.querySelector('button')!,
        next: page.querySelector<GeCarouselNext>('ge-carousel-next')!.shadowRoot!.querySelector('button')!,
    };
};
const items = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('ge-carousel-item')];

describe('ge-carousel', () => {
    it('is a labelled carousel region of slide groups whose buttons start with only "next" enabled', async () => {
        const { page, c, track, prev, next } = await carousel();
        expect([c.getAttribute('role'), c.getAttribute('aria-roledescription')]).toEqual(['region', 'carousel']);
        expect(items(page).map((i) => [i.getAttribute('role'), i.getAttribute('aria-roledescription')])).toEqual(Array(5).fill(['group', 'slide']));
        expect(track.tabIndex).toBe(0);
        expect([prev.getAttribute('aria-label'), next.getAttribute('aria-label')]).toEqual(['Previous slide', 'Next slide']);
        expect([prev.disabled, next.disabled]).toEqual([true, false]);
        expect(items(page)[0]!.getBoundingClientRect().width).toBe(track.clientWidth);
    });

    it('pages with the buttons, reports the slide it lands on and disables each end', async () => {
        const { page, c, track, prev, next } = await carousel();
        const log: unknown[] = [];
        c.addEventListener('slide-change', (e) => log.push((e as CustomEvent).detail));
        next.click();
        await until(() => track.scrollLeft >= track.clientWidth - 1);
        await settle(page);
        expect([c.currentIndex, prev.disabled, next.disabled]).toEqual([1, false, false]);
        for (let i = 0; i < 3; i++) {
            next.click();
            await until(() => track.scrollLeft >= track.clientWidth * (i + 2) - 1);
        }
        await settle(page);
        expect([c.currentIndex, prev.disabled, next.disabled]).toEqual([4, false, true]);
        expect(log).toEqual([1, 2, 3, 4]);
        prev.click();
        await until(() => track.scrollLeft <= track.clientWidth * 3 + 1);
        await settle(page);
        expect([c.currentIndex, next.disabled]).toEqual([3, false]);
    });

    it('moves with the arrow keys when the track has focus, and Up/Down do nothing while horizontal', async () => {
        const { page, track } = await carousel();
        track.focus();
        await userEvent.keyboard('{ArrowDown}');
        await settle(page);
        expect(track.scrollLeft).toBe(0);
        await userEvent.keyboard('{ArrowRight}');
        await until(() => track.scrollLeft >= track.clientWidth - 1);
        await userEvent.keyboard('{ArrowLeft}');
        await until(() => track.scrollLeft <= 1);
    });

    it('stacks a vertical carousel: slides get a top gutter, Up/Down page it and the buttons turn above and below', async () => {
        const { page, c, track, prev, next } = await carousel('orientation="vertical"');
        expect(getComputedStyle(items(page)[0]!).paddingTop).toBe('16px');
        expect(getComputedStyle(items(page)[0]!).paddingInlineStart).toBe('0px');
        expect(getComputedStyle(track).flexDirection).toBe('column');
        const box = c.getBoundingClientRect();
        expect(prev.getBoundingClientRect().bottom).toBeLessThan(box.top);
        expect(next.getBoundingClientRect().top).toBeGreaterThan(box.bottom);
        track.focus();
        await userEvent.keyboard('{ArrowRight}');
        await settle(page);
        expect(track.scrollTop).toBe(0);
        await userEvent.keyboard('{ArrowDown}');
        await until(() => track.scrollTop >= track.clientHeight - 1);
        await settle(page);
        expect([c.currentIndex, prev.disabled]).toEqual([1, false]);
        await userEvent.keyboard('{ArrowUp}');
        await until(() => track.scrollTop <= 1);
    });

    it('keeps "next" going forward on a vertical carousel in a right-to-left page', async () => {
        const { page, track, next } = await carousel('orientation="vertical"', 5, 'dir="rtl"');
        next.click();
        await until(() => track.scrollTop >= track.clientHeight - 1);
        await settle(page);
        expect(next.disabled).toBe(false);
    });

    it('mirrors in right-to-left: the left button goes forward, the track starts at its right edge', async () => {
        const { page, c, track, prev, next } = await carousel('', 5, 'dir="rtl"');
        // "Previous" keeps its physical side (left), so on an RTL page it is the one that advances.
        expect(prev.getBoundingClientRect().left).toBeLessThan(next.getBoundingClientRect().left);
        expect([prev.disabled, next.disabled]).toEqual([false, true]);
        prev.click();
        await until(() => track.scrollLeft <= -(track.clientWidth - 1));
        await settle(page);
        expect([c.currentIndex, prev.disabled, next.disabled]).toEqual([1, false, false]);
        track.focus();
        // Like the Angular carousel, the keys mean previous and next, not left and right: ArrowLeft goes back even in RTL.
        await userEvent.keyboard('{ArrowLeft}');
        await until(() => track.scrollLeft > -1);
        await userEvent.keyboard('{ArrowRight}');
        await until(() => track.scrollLeft <= -(track.clientWidth - 1));
    });

    it('scrollToSlide brings a slide into view and ignores an index out of range', async () => {
        const { page, c, track } = await carousel();
        c.scrollToSlide(3);
        await until(() => Math.abs(track.scrollLeft - track.clientWidth * 3) < 2);
        c.scrollToSlide(9);
        await settle(page);
        expect(Math.abs(track.scrollLeft - track.clientWidth * 3)).toBeLessThan(2);
    });

    it('tracks slides added later, and a single slide leaves both buttons disabled', async () => {
        const { page, track, prev, next } = await carousel('', 1);
        expect([prev.disabled, next.disabled]).toEqual([true, true]);
        track.insertAdjacentHTML('beforeend', slides(2));
        await until(() => !next.disabled);
        await settle(page);
        expect(prev.disabled).toBe(true);
    });

    it('counts the slide that fills most of the view as current, and ignores scrolling an empty track', async () => {
        const { page, c, track } = await carousel();
        track.style.scrollSnapType = 'none';
        track.scrollTo({ left: track.clientWidth * 0.7, behavior: 'instant' });
        // The scroll event arrives a frame later: wait for the index, not for a fixed settle.
        await until(() => c.currentIndex === 1);

        const empty = await carousel('', 0);
        const log: unknown[] = [];
        empty.c.addEventListener('slide-change', (e) => log.push((e as CustomEvent).detail));
        empty.track.dispatchEvent(new Event('scroll'));
        // A negative check: wait past anything the handler could schedule (a frame or two), twice the usual settle.
        await settle(empty.page);
        await settle(empty.page);
        expect([empty.c.currentIndex, log]).toEqual([0, []]);
    });

    it('re-reads the scroll range when the track is resized', async () => {
        const page = await mount('<div style="padding:48px 64px"><ge-carousel id="c" style="width:500px"><ge-carousel-content><ge-carousel-item style="flex-basis:200px">A</ge-carousel-item><ge-carousel-item style="flex-basis:200px">B</ge-carousel-item></ge-carousel-content><ge-carousel-next></ge-carousel-next></ge-carousel></div>');
        await settle(page);
        const next = page.querySelector('ge-carousel-next')!.shadowRoot!.querySelector('button')!;
        expect(next.disabled).toBe(true);
        page.querySelector<HTMLElement>('#c')!.style.width = '300px';
        await until(() => !next.disabled);
    });

    it('lets a slide show several at once through flex-basis', async () => {
        const { page, track } = await carousel();
        for (const i of items(page)) i.style.flexBasis = '50%';
        await settle(page);
        expect(items(page)[0]!.getBoundingClientRect().width).toBe(track.clientWidth / 2);
    });

    it('takes the button labels from the locale and has no axe violations in both themes', async () => {
        const { page, c, prev, next } = await carousel();
        c.querySelector('ge-carousel-previous')!.setAttribute('locale', 'he');
        c.querySelector('ge-carousel-next')!.setAttribute('locale', 'he');
        await settle(page);
        expect([prev.getAttribute('aria-label'), next.getAttribute('aria-label')]).not.toEqual(['Previous slide', 'Next slide']);
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            const result = await axe.run(page);
            expect(result.violations.map((v) => v.id)).toEqual([]);
        }
    });
});
