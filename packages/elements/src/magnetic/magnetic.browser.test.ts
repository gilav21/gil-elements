import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeMagnetic } from './magnetic.js';

afterEach(() => vi.restoreAllMocks());

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
const moveTo = (el: Element, dx: number, dy: number) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + dx, clientY: box.top + dy }));
};
const shift = (el: Element) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return [m.e, m.f];
};

async function magnet(attrs = '', size = 'width:100px;height:40px'): Promise<GeMagnetic> {
    const page = await mount(`<div style="padding:150px"><ge-magnetic ${attrs} style="${size}"><button style="width:100%;height:100%">Hover</button></ge-magnetic></div>`);
    return page.querySelector('ge-magnetic')!;
}

describe('ge-magnetic', () => {
    it('is an inline block, so the transform applies, and sits still until the pointer comes', async () => {
        const el = await magnet();

        expect(getComputedStyle(el).display).toBe('inline-block');
        expect(shift(el)).toEqual([0, 0]);
    });

    it('moves towards the pointer by strength times its distance from the centre, and eases back on leaving', async () => {
        const el = await magnet('smoothing="0"');
        moveTo(el, 80, 10);

        expect(shift(el)).toEqual([(80 - 50) * 0.3, (10 - 20) * 0.3]);
        el.dispatchEvent(new MouseEvent('mouseleave'));
        expect(shift(el)).toEqual([0, 0]);
    });

    it('takes strength and radius from its attributes, and holds still when the pointer is farther than the radius', async () => {
        const el = await magnet('smoothing="0" strength="0.5" radius="60"', 'width:400px;height:40px');
        moveTo(el, 380, 20);
        expect(shift(el)).toEqual([0, 0]);

        moveTo(el, 240, 20);
        expect(shift(el)).toEqual([(240 - 200) * 0.5, 0]);

        moveTo(el, 260, 20);
        expect(shift(el)).toEqual([0, 0]);

        const tall = await magnet('smoothing="0" radius="60"', 'width:100px;height:300px');
        moveTo(tall, 50, 280);
        expect(shift(tall)).toEqual([0, 0]);
    });

    it('measures from its own moved centre, as the Angular directive does', async () => {
        const el = await magnet('smoothing="0"');
        const box = el.getBoundingClientRect();
        const at = { clientX: box.left + 80, clientY: box.top + 20 };
        el.dispatchEvent(new MouseEvent('mousemove', at));
        expect(shift(el)[0]).toBe(9);

        el.dispatchEvent(new MouseEvent('mousemove', at));
        expect(shift(el)[0]).toBeCloseTo((80 - 50 - 9) * 0.3, 5);
    });

    it('eases the movement over smoothing milliseconds', async () => {
        const el = await magnet('smoothing="400"');
        expect(getComputedStyle(el).transitionDuration).toBe('0.4s');
        expect(getComputedStyle(el).transitionProperty).toBe('transform');
        expect(getComputedStyle(el).transitionTimingFunction).toBe('ease-out');

        el.smoothing = 250;
        await el.updateComplete;
        expect(getComputedStyle(el).transitionDuration).toBe('0.25s');
        moveTo(el, 90, 20);
        await settle();
        expect(shift(el)[0]).toBeGreaterThan(0);
    });

    it('stays put under reduced motion', async () => {
        const real = globalThis.matchMedia.bind(globalThis);
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('reduced-motion') ? ({ matches: true } as MediaQueryList) : real(query)));
        const el = await magnet('smoothing="0"');
        moveTo(el, 90, 5);

        expect(shift(el)).toEqual([0, 0]);
    });
});
