import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeParticles } from './particles.js';

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
const canvas = (el: Element) => el.shadowRoot!.querySelector('canvas')!;
const alphaAt = (el: Element, x: number, y: number) => canvas(el).getContext('2d')!.getImageData(x, y, 1, 1).data[3]!;
const inkCentre = (el: Element) => {
    const { width, height } = canvas(el);
    const data = canvas(el).getContext('2d')!.getImageData(0, 0, width, height).data;
    let sumX = 0;
    let sumY = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4) {
        sumX += data[i]! * ((i >> 2) % width);
        sumY += data[i]! * Math.floor(i / 4 / width);
        total += data[i]!;
    }
    return total === 0 ? { x: Number.NaN, y: Number.NaN } : { x: sumX / total, y: sumY / total };
};
const inkCentreX = (el: Element) => inkCentre(el).x;
const inkOf = (el: Element) => canvas(el).getContext('2d')!.getImageData(0, 0, canvas(el).width, canvas(el).height).data.reduce((sum, v, i) => (i % 4 === 3 ? sum + v : sum), 0);

/** Math.random answers from `values` in order, then 0.5. */
const rolls = (...values: number[]) => {
    const queue = [...values];
    vi.spyOn(Math, 'random').mockImplementation(() => queue.shift() ?? 0.5);
};

afterEach(() => vi.restoreAllMocks());

async function field(attrs = '', size = 'width:100px;height:60px'): Promise<GeParticles> {
    const page = await mount(`<div style="position:relative;color:rgb(255,0,0);${size}"><ge-particles ${attrs}></ge-particles></div>`);
    await frames(2);
    return page.querySelector('ge-particles')!;
}

// Two still dots of radius 3 at (20,30) and (80,30): x, y, vx, vy, radius for each.
const TWO_DOTS = [0.2, 0.5, 0.5, 0.5, 1, 0.8, 0.5, 0.5, 0.5, 1];

describe('ge-particles', () => {
    it('fills the positioned box it sits in with a canvas of the same size, and keeps it in step on resize', async () => {
        const el = await field();
        const box = el.getBoundingClientRect();

        expect([box.width, box.height]).toEqual([100, 60]);
        expect([canvas(el).width, canvas(el).height]).toEqual([100, 60]);

        el.parentElement!.style.width = '160px';
        await frames(3);
        expect(canvas(el).width).toBe(160);
    });

    it('draws dots in the surrounding text colour, and joins near pairs with a line that is gone when connect-distance is 0', async () => {
        rolls(...TWO_DOTS);
        const joined = await field('count="2"');
        expect(alphaAt(joined, 20, 30)).toBeGreaterThan(100);
        expect(Array.from(canvas(joined).getContext('2d')!.getImageData(20, 30, 1, 1).data.slice(0, 3))).toEqual([255, 0, 0]);
        expect(alphaAt(joined, 50, 30)).toBeGreaterThan(0);
        expect(alphaAt(joined, 50, 10)).toBe(0);

        rolls(...TWO_DOTS);
        const dots = await field('count="2" connect-distance="0"');
        expect(alphaAt(dots, 20, 30)).toBeGreaterThan(100);
        expect(alphaAt(dots, 50, 30)).toBe(0);
    });

    it('joins pairs closer than connect-distance, and fades the line towards it', async () => {
        rolls(...TWO_DOTS);
        const exact = await field('count="2" connect-distance="60"');
        expect(alphaAt(exact, 50, 30)).toBe(0);

        rolls(...TWO_DOTS);
        const far = await field('count="2" connect-distance="90"');
        rolls(...TWO_DOTS);
        const near = await field('count="2" connect-distance="240"');
        expect(alphaAt(far, 50, 30)).toBeGreaterThan(0);
        expect(alphaAt(near, 50, 30)).toBeGreaterThan(alphaAt(far, 50, 30) * 1.5);
    });

    it('draws each dot as a 60% opaque disc of its seeded radius', async () => {
        rolls(...TWO_DOTS);
        const el = await field('count="2" connect-distance="0"');

        expect(alphaAt(el, 20, 30)).toBeGreaterThanOrEqual(150);
        expect(alphaAt(el, 20, 30)).toBeLessThanOrEqual(156);
        expect(alphaAt(el, 22, 30)).toBeGreaterThan(100);
        expect(alphaAt(el, 24, 30)).toBe(0);
    });

    it('uses a literal colour as given, and draws nothing for count 0', async () => {
        rolls(...TWO_DOTS);
        const blue = await field('count="2" color="rgb(0,0,255)"');
        expect(Array.from(canvas(blue).getContext('2d')!.getImageData(20, 30, 1, 1).data.slice(0, 3))).toEqual([0, 0, 255]);

        const none = await field('count="0"');
        expect(inkOf(none)).toBe(0);
    });

    it('moves particles at the seeded speed', async () => {
        rolls(0.5, 0.5, 1, 0.5, 1);
        const el = await field('count="1" speed="2" connect-distance="0" style="color:red"', 'width:400px;height:60px');
        const before = alphaAt(el, 200, 30);
        await frames(40);

        expect(before).toBeGreaterThan(0);
        expect(alphaAt(el, 200, 30)).toBe(0);
        expect(inkOf(el)).toBeGreaterThan(0);
    });

    it('pushes particles away from the pointer, unless mouse-interaction is off', async () => {
        const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mousemove', { clientX: el.getBoundingClientRect().left + 10, clientY: el.getBoundingClientRect().top + 30 }));

        rolls(0.5, 0.5, 0.5, 0.5, 1);
        const repelled = await field('count="1" connect-distance="0"');
        expect(alphaAt(repelled, 50, 30)).toBeGreaterThan(0);
        hover(repelled);
        await vi.waitFor(() => expect(alphaAt(repelled, 50, 30)).toBe(0), { timeout: 4000 });
        expect(inkCentreX(repelled)).toBeGreaterThan(50);

        rolls(0.5, 0.5, 0.5, 0.5, 1);
        const pushedDown = await field('count="1" connect-distance="0"');
        const box = pushedDown.getBoundingClientRect();
        pushedDown.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + 50, clientY: box.top + 10 }));
        await vi.waitFor(() => expect(inkCentre(pushedDown).y).toBeGreaterThan(40), { timeout: 4000 });
        expect(getComputedStyle(repelled).pointerEvents).toBe('auto');

        rolls(0.5, 0.5, 0.5, 0.5, 1);
        const calm = await field('count="1" connect-distance="0" mouse-interaction="false"');
        hover(calm);
        await frames(60);
        expect(alphaAt(calm, 50, 30)).toBeGreaterThan(0);
        expect(getComputedStyle(calm).pointerEvents).toBe('none');
    });

    it('bounces particles off the edges and rescales them with the box', async () => {
        rolls(0.98, 0.98, 0.75, 0.75, 0);
        const bouncing = await field('count="1" speed="2" connect-distance="0"');
        await frames(120);
        expect(inkOf(bouncing)).toBeGreaterThan(0);

        rolls(0.5, 0.5, 0.5, 0.5, 1);
        const growing = await field('count="1" connect-distance="0"');
        expect(Math.abs(inkCentreX(growing) - 50)).toBeLessThan(1);
        expect(Math.abs(inkCentre(growing).y - 30)).toBeLessThan(1);
        growing.parentElement!.style.width = '200px';
        growing.parentElement!.style.height = '180px';
        await frames(3);
        expect(Math.abs(inkCentre(growing).y - 90)).toBeLessThan(1);
        expect(Math.abs(inkCentreX(growing) - 100)).toBeLessThan(1);
    });

    it('draws nothing when the user prefers reduced motion, and stops its loop when removed', async () => {
        const real = globalThis.matchMedia.bind(globalThis);
        const spy = vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('reduced-motion') ? ({ matches: true } as MediaQueryList) : real(query)));
        const still = await field();
        expect(inkOf(still)).toBe(0);
        spy.mockRestore();

        const live = await field();
        const raf = vi.spyOn(globalThis, 'cancelAnimationFrame');
        live.remove();
        expect(raf).toHaveBeenCalled();
    });
});
