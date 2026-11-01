import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeRating } from './rating.js';

const first = (page: HTMLElement) => page.querySelector<GeRating>('ge-rating')!;
const stars = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('.star')];
const lit = (el: Element) => stars(el).map((star) => star.classList.contains('lit'));
const clickAt = (star: Element, fraction: number) => {
    const rect = star.getBoundingClientRect();
    star.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width * fraction, clientY: rect.top + 4 }));
};
const touch = (star: Element, type: string, clientX: number) => {
    const rect = star.getBoundingClientRect();
    const point = new Touch({ identifier: 1, target: star, clientX, clientY: rect.top + 4 });
    star.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [point], changedTouches: [point] }));
};

describe('ge-rating', () => {
    it('commits the clicked star once, announces it, and clicking the current value clears the rating', async () => {
        const page = await mount('<ge-rating></ge-rating>');
        const rating = first(page);
        const events: unknown[] = [];
        rating.addEventListener('rating-change', (event) => events.push((event as CustomEvent).detail));
        rating.addEventListener('input', () => events.push('input'));
        rating.addEventListener('change', () => events.push('change'));

        stars(rating)[3].click();
        await rating.updateComplete;
        expect([rating.value, lit(rating)]).toEqual([4, [true, true, true, true, false]]);
        stars(rating)[3].click();

        expect(events).toEqual([4, 'input', 'change', 0, 'input', 'change']);
        expect(rating.value).toBe(0);
    });

    it('previews the pointer position on hover without committing, and falls back when the pointer leaves', async () => {
        const page = await mount('<ge-rating value="2"></ge-rating>');
        const rating = first(page);
        const committed: number[] = [];
        rating.addEventListener('rating-change', () => committed.push(1));

        stars(rating)[4].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        await rating.updateComplete;
        expect(lit(rating)).toEqual([true, true, true, true, true]);

        rating.shadowRoot!.querySelector('.row')!.dispatchEvent(new MouseEvent('mouseleave'));
        await rating.updateComplete;

        expect([lit(rating), rating.value, committed]).toEqual([[true, true, false, false, false], 2, []]);
    });

    it('picks half stars from where the star is hit, mirrored in right-to-left text', async () => {
        const page = await mount(`
            <ge-rating id="ltr" precision="0.5"></ge-rating>
            <div dir="rtl"><ge-rating id="rtl" precision="0.5"></ge-rating></div>`);
        const [ltr, rtl] = ['ltr', 'rtl'].map((id) => page.querySelector<GeRating>(`#${id}`)!);

        clickAt(stars(ltr)[2], 0.25);
        const leftHalf = ltr.value;
        clickAt(stars(ltr)[2], 0.75);
        clickAt(stars(rtl)[2], 0.25);
        const rightHalfOfRtl = rtl.value;
        clickAt(stars(rtl)[1], 0.75);

        expect([leftHalf, ltr.value, rightHalfOfRtl, rtl.value]).toEqual([2.5, 3, 3, 1.5]);
    });

    it('renders half and rounds a fractional value down on whole-star precision', async () => {
        const page = await mount('<ge-rating value="2.5" precision="0.5"></ge-rating><ge-rating value="2.5"></ge-rating>');
        const [half, whole] = [...page.querySelectorAll('ge-rating')];

        expect([half.shadowRoot!.querySelectorAll('linearGradient').length, lit(half)]).toEqual([1, [true, true, true, false, false]]);
        expect([whole.shadowRoot!.querySelectorAll('linearGradient').length, lit(whole)]).toEqual([0, [true, true, false, false, false]]);
    });

    it('is a tab stop that the arrows step, Home clears and End fills, swapping left and right in RTL', async () => {
        const page = await mount(`
            <ge-rating id="a" value="2" max="4"></ge-rating>
            <div dir="rtl"><ge-rating id="b" precision="0.5" value="1"></ge-rating></div>`);
        const [a, b] = ['a', 'b'].map((id) => page.querySelector<GeRating>(`#${id}`)!);

        await userEvent.tab();
        await userEvent.keyboard('{ArrowRight}{ArrowUp}{ArrowUp}');
        expect(a.value).toBe(4);
        await userEvent.keyboard('{ArrowLeft}{ArrowDown}');
        expect(a.value).toBe(2);
        await userEvent.keyboard('{End}');
        expect(a.value).toBe(4);
        await userEvent.keyboard('{Home}');
        expect(a.value).toBe(0);

        b.focus();
        await userEvent.keyboard('{ArrowLeft}');
        expect(b.value).toBe(1.5);
        await userEvent.keyboard('{ArrowRight}{ArrowRight}');
        expect(b.value).toBe(0.5);
    });

    it('ignores pointer, touch and keys while readonly, disabled or in a disabled fieldset', async () => {
        const page = await mount(`
            <ge-rating id="ro" readonly value="3"></ge-rating>
            <ge-rating id="off" disabled value="3"></ge-rating>
            <fieldset disabled><ge-rating id="fs" value="3"></ge-rating></fieldset>`);
        const all = ['ro', 'off', 'fs'].map((id) => page.querySelector<GeRating>(`#${id}`)!);

        for (const rating of all) {
            stars(rating)[0].dispatchEvent(new MouseEvent('click'));
            stars(rating)[4].dispatchEvent(new MouseEvent('mousemove'));
            rating.shadowRoot!.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        }

        await Promise.all(all.map((rating) => rating.updateComplete));

        expect(all.map((rating) => rating.value)).toEqual([3, 3, 3]);
        expect(all.map((rating) => lit(rating))).toEqual(Array.from({ length: 3 }, () => [true, true, true, false, false]));
    });

    it('previews while a finger slides across the row and commits where it lifts', async () => {
        const page = await mount('<ge-rating></ge-rating>');
        const rating = first(page);
        const row = stars(rating);
        const centre = (i: number) => row[i].getBoundingClientRect().left + row[i].getBoundingClientRect().width / 2;

        touch(row[0], 'touchstart', centre(0));
        touch(row[0], 'touchmove', centre(3));
        await rating.updateComplete;
        expect(lit(rating)).toEqual([true, true, true, true, false]);
        touch(row[0], 'touchend', centre(3));
        await rating.updateComplete;

        expect(rating.value).toBe(4);
    });

    it('exposes a named slider with the value and a named button per star to assistive technology', async () => {
        const page = await mount('<ge-rating value="3" aria-label="Quality" max="4"></ge-rating>');
        await first(page).updateComplete;
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const frameId = frameTree.childFrames?.[0]?.frame.id;
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });
        const slider = nodes.find((n) => n.role?.value === 'slider');
        const buttons = nodes.filter((n) => n.role?.value === 'button').map((n) => n.name?.value);

        expect([slider?.name?.value, slider?.value?.value]).toEqual(['Quality', 3]);
        expect(buttons).toEqual(['Rate 1 out of 4', 'Rate 2 out of 4', 'Rate 3 out of 4', 'Rate 4 out of 4']);
    });

    it('scales the star box with size', async () => {
        const page = await mount('<ge-rating size="sm"></ge-rating><ge-rating></ge-rating><ge-rating size="lg"></ge-rating>');
        const widths = [...page.querySelectorAll('ge-rating')].map((el) => stars(el)[0].getBoundingClientRect().width);

        expect(widths).toEqual([16, 20, 24]);
    });

    it('submits the rating under its name and a form reset restores the markup', async () => {
        const page = await mount('<form><ge-rating name="stars" value="2"></ge-rating><ge-rating name="other"></ge-rating></form>');
        const form = page.querySelector('form')!;
        const rating = first(page);

        expect([...new FormData(form).entries()]).toEqual([['stars', '2'], ['other', '0']]);
        stars(rating)[4].click();
        await rating.updateComplete;
        expect(new FormData(form).get('stars')).toBe('5');

        form.reset();
        await rating.updateComplete;
        expect([rating.value, new FormData(form).get('stars')]).toEqual([2, '2']);
    });

    it.each(['light', 'dark'])('has no accessibility violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-rating value="3"></ge-rating><ge-rating value="2.5" precision="0.5" readonly></ge-rating><ge-rating disabled></ge-rating>');
        expect((await axe.run(page)).violations).toEqual([]);
    });
});
