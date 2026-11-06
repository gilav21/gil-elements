import { afterEach, describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeScrollProgress } from './scroll-progress.js';

afterEach(() => window.scrollTo(0, 0));

const bar = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.bar')!;
const track = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.track')!;
const settle = async (el: GeScrollProgress) => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await el.updateComplete;
};
async function inBox(attrs = ''): Promise<{ box: HTMLElement; el: GeScrollProgress }> {
    const page = await mount(`<div id="box" style="height:100px;overflow:auto"><div style="height:500px"><ge-scroll-progress ${attrs}></ge-scroll-progress></div></div>`);
    return { box: page.querySelector('#box')!, el: page.querySelector('ge-scroll-progress')! };
}

describe('ge-scroll-progress', () => {
    it('pins a 3px bar to the top of the viewport above everything, filling with the page scrolled', async () => {
        const page = await mount('<div style="height:3000px"><ge-scroll-progress></ge-scroll-progress></div>');
        const el = page.querySelector('ge-scroll-progress')!;
        const range = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        await settle(el);

        expect(getComputedStyle(track(el)).position).toBe('fixed');
        expect(track(el).getBoundingClientRect().top).toBe(0);
        expect(track(el).getBoundingClientRect().width).toBe(document.documentElement.clientWidth);
        expect(getComputedStyle(track(el)).zIndex).toBe('50');
        expect(bar(el).getBoundingClientRect().height).toBe(3);
        expect(bar(el).getBoundingClientRect().width).toBe(0);

        window.scrollTo(0, range / 4);
        await settle(el);
        expect(bar(el).getBoundingClientRect().width / track(el).getBoundingClientRect().width).toBeCloseTo(0.25, 2);
        window.scrollTo(0, range);
        await settle(el);
        expect(bar(el).getBoundingClientRect().width).toBe(track(el).getBoundingClientRect().width);
    });

    it('sits at the bottom, with the given height and colour', async () => {
        const page = await mount('<div style="height:3000px"><ge-scroll-progress position="bottom" height="6" color="rgb(255, 0, 0)"></ge-scroll-progress></div>');
        const el = page.querySelector('ge-scroll-progress')!;
        el.height = 6;
        await settle(el);

        expect(track(el).getBoundingClientRect().bottom).toBe(document.documentElement.clientHeight);
        expect(bar(el).getBoundingClientRect().height).toBe(6);
        expect(getComputedStyle(bar(el)).backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('follows the scrolling box it sits in rather than the page', async () => {
        const { box, el } = await inBox();
        await settle(el);
        box.scrollTop = 200;
        await settle(el);
        expect(el.shadowRoot!.querySelector<HTMLElement>('.bar')!.style.width).toBe('50%');
        box.scrollTop = 400;
        await settle(el);
        expect(bar(el).style.width).toBe('100%');
    });

    it('follows a container given as a selector or an element, and switches when it changes', async () => {
        const page = await mount('<div id="a" style="height:100px;overflow:auto"><div style="height:300px"></div></div><div id="b" style="height:100px;overflow:auto"><div style="height:500px"></div></div><ge-scroll-progress container="#a"></ge-scroll-progress>');
        const el = page.querySelector('ge-scroll-progress')!;
        el.container = '#a';
        await el.updateComplete;
        const a = page.querySelector<HTMLElement>('#a')!;
        const b = page.querySelector<HTMLElement>('#b')!;
        a.scrollTop = 100;
        await settle(el);
        expect(bar(el).style.width).toBe('50%');

        el.container = b;
        await el.updateComplete;
        b.scrollTop = 100;
        await settle(el);
        expect(bar(el).style.width).toBe('25%');
        a.scrollTop = 200;
        await settle(el);
        expect(bar(el).style.width).toBe('25%');
    });

    it('shows nothing when there is nothing to scroll, and survives a selector that matches nothing', async () => {
        const page = await mount('<ge-scroll-progress container="#missing"></ge-scroll-progress><ge-scroll-progress container="!!"></ge-scroll-progress>');
        for (const el of page.querySelectorAll('ge-scroll-progress')) {
            await settle(el);
            expect(bar(el).getBoundingClientRect().width).toBe(0);
        }
    });
});
