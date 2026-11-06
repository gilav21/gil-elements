import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeMasonry } from './masonry.js';

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
const card = (id: number, height: number) => `<div id="c${id}" style="height:${height}px;background:#ccc">${id}</div>`;
// Heights chosen so the shortest column changes: with three columns the fourth card goes under card 2 (the shortest).
const HEIGHTS = [100, 60, 80, 50, 120, 40];
async function wall(attrs = '', width = 620): Promise<GeMasonry> {
    const page = await mount(`<ge-masonry ${attrs} style="width:${width}px">${HEIGHTS.map((h, i) => card(i + 1, h)).join('')}</ge-masonry>`);
    await frames(3);
    return page.firstElementChild as GeMasonry;
}
const spot = (el: Element, id: number) => {
    const box = el.querySelector(`#c${id}`)!.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    return { x: Math.round(box.left - host.left), y: Math.round(box.top - host.top), w: Math.round(box.width) };
};

describe('ge-masonry', () => {
    it('puts each item, in source order, under the shortest column, at the column width', async () => {
        const el = await wall('columns="3" gap="10"');
        // (620 - 2*10) / 3 = 200 wide columns at x = 0, 210, 420.
        expect(spot(el, 1)).toEqual({ x: 0, y: 0, w: 200 });
        expect(spot(el, 2)).toEqual({ x: 210, y: 0, w: 200 });
        expect(spot(el, 3)).toEqual({ x: 420, y: 0, w: 200 });
        // Column bottoms are 110, 70, 90: the shortest is the second.
        expect(spot(el, 4)).toEqual({ x: 210, y: 70, w: 200 });
        // 110, 130, 90: the third.
        expect(spot(el, 5)).toEqual({ x: 420, y: 90, w: 200 });
        // 110, 130, 220: the first.
        expect(spot(el, 6)).toEqual({ x: 0, y: 110, w: 200 });
        expect(el.getBoundingClientRect().height).toBe(210);
    });

    it('reads in order down the page: every item sits at or below the one before it', async () => {
        const el = await wall('columns="3" gap="10"');
        const tops = HEIGHTS.map((_, i) => spot(el, i + 1).y);
        expect(tops).toEqual([...tops].sort((a, b) => a - b));
    });

    it('takes a per-breakpoint map resolved against its own width, not the viewport', async () => {
        const map = '{"base":1,"sm":2,"lg":3}';
        for (const [width, columns] of [[500, 1], [700, 2], [1100, 3]] as const) {
            const page = await mount(`<ge-masonry columns='${map}' gap="0" style="width:${width}px">${HEIGHTS.map((h, i) => card(i + 1, h)).join('')}</ge-masonry>`);
            await frames(3);
            const el = page.firstElementChild!;
            expect(new Set(HEIGHTS.map((_, i) => spot(el, i + 1).x)).size).toBe(columns);
        }
    });

    it('switches column count at the container widths 640, 768, 1024 and 1280', async () => {
        const map = '{"base":1,"sm":2,"md":3,"lg":4,"xl":5}';
        for (const [width, columns] of [[639, 1], [640, 2], [767, 2], [768, 3], [1023, 3], [1024, 4], [1279, 4], [1280, 5]] as const) {
            const page = await mount(`<ge-masonry columns='${map}' gap="0" style="width:${width}px">${HEIGHTS.map((h, i) => card(i + 1, h)).join('')}</ge-masonry>`);
            await frames(3);
            expect(new Set(HEIGHTS.map((_, i) => spot(page.firstElementChild!, i + 1).x)).size, `${width}px`).toBe(Math.min(columns, HEIGHTS.length));
        }
    });

    it('defaults to one column on a narrow box, two from 640px and three from 1024px', async () => {
        const page = await mount(`<ge-masonry gap="0" style="width:1100px">${HEIGHTS.map((h, i) => card(i + 1, h)).join('')}</ge-masonry>`);
        await frames(3);
        const el = page.firstElementChild as GeMasonry;
        expect(new Set(HEIGHTS.map((_, i) => spot(el, i + 1).x)).size).toBe(3);
        el.style.width = '700px';
        await frames(3);
        expect(new Set(HEIGHTS.map((_, i) => spot(el, i + 1).x)).size).toBe(2);
        el.style.width = '300px';
        await frames(3);
        expect(new Set(HEIGHTS.map((_, i) => spot(el, i + 1).x)).size).toBe(1);
    });

    it('re-balances when the gap or columns change, and when an item is added or grows', async () => {
        const el = await wall('columns="2" gap="0"', 400);
        expect(spot(el, 2).x).toBe(200);

        el.gap = 20;
        await frames(3);
        expect(spot(el, 1).w).toBe(190);
        expect(spot(el, 2).x).toBe(210);

        el.columns = 3;
        await frames(3);
        expect(new Set(HEIGHTS.map((_, i) => spot(el, i + 1).x)).size).toBe(3);

        el.insertAdjacentHTML('afterbegin', '<div id="c0" style="height:500px">new</div>');
        await frames(3);
        expect(spot(el, 0)).toMatchObject({ x: 0, y: 0 });
        expect(spot(el, 1).x).toBeGreaterThan(0);

        const before = el.getBoundingClientRect().height;
        (el.querySelector('#c2') as HTMLElement).style.height = '900px';
        el.layout();
        expect(el.getBoundingClientRect().height).toBeGreaterThan(before);
    });

    it('takes its box height from the tallest column and gives it up when emptied', async () => {
        const el = await wall('columns="1" gap="10"', 300);
        expect(el.getBoundingClientRect().height).toBe(HEIGHTS.reduce((a, b) => a + b, 0) + 50);
        el.replaceChildren();
        await frames(3);
        expect(el.style.height).toBe('');
    });
});
