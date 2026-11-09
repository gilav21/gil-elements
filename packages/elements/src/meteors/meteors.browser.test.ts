import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeMeteors } from './meteors.js';

afterEach(() => vi.restoreAllMocks());

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
const canvas = (el: Element) => el.shadowRoot!.querySelector('canvas')!;
const pixels = (el: Element) => canvas(el).getContext('2d')!.getImageData(0, 0, canvas(el).width, canvas(el).height).data;
const ink = (el: Element) => pixels(el).reduce((sum, v, i) => (i % 4 === 3 ? sum + v : sum), 0);
const inkCentre = (el: Element) => {
    const { width } = canvas(el);
    const data = pixels(el);
    let sumX = 0;
    let sumY = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4) {
        sumX += data[i]! * ((i >> 2) % width);
        sumY += data[i]! * Math.floor(i / 4 / width);
        total += data[i]!;
    }
    return { x: sumX / total, y: sumY / total };
};
/** Within two steps per channel: the most opaque pixel is not always fully opaque, and premultiplied alpha rounds its colour down by one or two. */
const expectColour = (actual: (number | undefined)[], expected: number[]) => {
    expected.forEach((channel, index) => expect(Math.abs((actual[index] ?? Number.NaN) - channel)).toBeLessThanOrEqual(2));
};
const colourOfInk = (el: Element) => {
    const data = pixels(el);
    let best = 3;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > data[best]!) best = i;
    return [data[best - 3], data[best - 2], data[best - 1]];
};

async function sky(attrs = '', size = 'width:300px;height:200px'): Promise<GeMeteors> {
    const page = await mount(`<div style="position:relative;${size}"><ge-meteors ${attrs}></ge-meteors></div>`);
    await frames(3);
    return page.querySelector('ge-meteors')!;
}

describe('ge-meteors', () => {
    it('fills the positioned box it sits in with a click-through canvas of the same size', async () => {
        const el = await sky();
        const box = el.parentElement!.getBoundingClientRect();

        expect(el.getBoundingClientRect().width).toBe(box.width);
        expect(el.getBoundingClientRect().height).toBe(box.height);
        expect(getComputedStyle(el).pointerEvents).toBe('none');
        expect(canvas(el).width).toBe(300);
        expect(canvas(el).height).toBe(200);
    });

    it('draws meteors in white, and in the colour asked for, resolving a token', async () => {
        const white = await sky('count="30"');
        expect(ink(white)).toBeGreaterThan(0);
        expectColour(colourOfInk(white), [255, 255, 255]);

        const page = await mount('<div style="position:relative;width:300px;height:200px;--meteor:rgb(255,0,0)"><ge-meteors count="30" color="var(--meteor)"></ge-meteors></div>');
        await frames(3);
        expectColour(colourOfInk(page.querySelector('ge-meteors')!), [255, 0, 0]);
    });

    it('draws nothing for count 0, and more ink for a bigger population', async () => {
        const none = await sky('count="0"');
        expect(ink(none)).toBe(0);

        const some = await sky('count="5"');
        const many = await sky('count="60"');
        expect(ink(many)).toBeGreaterThan(ink(some));
    });

    it('streaks down and to the left, a faster speed covering more ground per frame', async () => {
        const travel = async (speed: string) => {
            vi.spyOn(Math, 'random').mockReturnValue(0.5);
            const el = await sky(`count="1" speed="${speed}"`);
            const before = inkCentre(el);
            await frames(6);
            const after = inkCentre(el);
            vi.restoreAllMocks();
            return { dx: after.x - before.x, dy: after.y - before.y };
        };
        const slow = await travel('slow');
        const fast = await travel('fast');

        expect(slow.dx).toBeLessThan(0);
        expect(slow.dy).toBeGreaterThan(0);
        expect(Math.hypot(fast.dx, fast.dy)).toBeGreaterThan(Math.hypot(slow.dx, slow.dy) * 2);
    });

    it('restarts its sky when count changes and stops its loop when removed', async () => {
        const el = await sky('count="1"');
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        el.count = 0;
        await el.updateComplete;
        await frames(2);
        expect(ink(el)).toBe(0);
        el.count = 80;
        await el.updateComplete;
        await frames(2);
        expect(ink(el)).toBeGreaterThan(0);

        el.remove();
        expect(cancel).toHaveBeenCalled();
    });
});
