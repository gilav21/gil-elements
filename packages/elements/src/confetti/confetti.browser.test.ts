import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ConfettiOptions, GeConfetti } from './confetti.js';

afterEach(() => vi.restoreAllMocks());

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
const canvas = (el: Element) => el.shadowRoot!.querySelector('canvas')!;
/** Alpha-weighted centre and amount of ink, split into the left, middle and right thirds. */
const centre = (el: Element) => {
    const { width, height } = canvas(el);
    const data = canvas(el).getContext('2d')!.getImageData(0, 0, width, height).data;
    let sumX = 0;
    let sumY = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4) {
        const px = (i - 3) / 4;
        sumX += data[i]! * (px % width);
        sumY += data[i]! * Math.floor(px / width);
        total += data[i]!;
    }
    return { x: sumX / total + 0.5, y: sumY / total + 0.5, total };
};
/** Math.random answers per particle in the order the element asks: angle, speed, colour, shape, wobble, wobble speed, tilt. */
const oneParticle = (angleRoll: number, speedRoll: number) => {
    let call = 0;
    const rolls = [angleRoll, speedRoll, 0, 0, 0, 0.5, 0];
    vi.spyOn(Math, 'random').mockImplementation(() => rolls[call++ % rolls.length]!);
};
const SQUARE = { colors: ['#000'], shapes: ['square' as const], particleCount: 1, ticks: 800 };
const ink = (el: Element) => {
    const { width, height } = canvas(el);
    const data = canvas(el).getContext('2d')!.getImageData(0, 0, width, height).data;
    const thirds = [0, 0, 0];
    let total = 0;
    let sumY = 0;
    for (let i = 3; i < data.length; i += 4) {
        const px = (i - 3) / 4;
        thirds[Math.min(2, Math.floor(((px % width) / width) * 3))]! += data[i]!;
        sumY += data[i]! * Math.floor(px / width);
        total += data[i]!;
    }
    return { total, thirds, y: total === 0 ? Number.NaN : sumY / total };
};

async function confetti(options: ConfettiOptions = {}, attrs = ''): Promise<GeConfetti> {
    const page = await mount(`<ge-confetti ${attrs} style="width:300px;height:200px"><button id="under" style="width:100%;height:100%">Fire</button></ge-confetti>`);
    const el = page.querySelector<GeConfetti>('ge-confetti')!;
    el.options = options;
    await el.updateComplete;
    return el;
}

describe('ge-confetti', () => {
    it('is a clipping, positioned box with a pointer-transparent canvas the size of the box over its content', async () => {
        const el = await confetti();
        const box = el.getBoundingClientRect();
        const at = (x: number, y: number) => document.elementFromPoint(box.left + x, box.top + y);

        expect(getComputedStyle(el).overflow).toBe('hidden');
        expect(getComputedStyle(el).position).toBe('relative');
        expect([canvas(el).width, canvas(el).height]).toEqual([300, 200]);
        expect(getComputedStyle(canvas(el)).zIndex).toBe('100');
        expect(at(150, 100)).toBe(el.querySelector('#under'));

        el.options = { zIndex: 7 };
        await el.updateComplete;
        expect(getComputedStyle(canvas(el)).zIndex).toBe('7');
        el.style.width = '400px';
        await frames(3);
        expect(canvas(el).width).toBe(400);
    });

    it('draws nothing until it is fired, then bursts from the centre upwards and clears when every particle has expired', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const el = await confetti({ ticks: 12, particleCount: 20 });
        await frames(2);
        expect(ink(el).total).toBe(0);

        el.fire();
        await frames(2);
        const burst = ink(el);
        expect(burst.total).toBeGreaterThan(0);
        expect(burst.thirds[1]).toBe(burst.total);
        expect(burst.y).toBeLessThan(100);

        await vi.waitFor(() => expect(ink(el).total).toBe(0), { timeout: 3000 });
    });

    it('fires two bursts from the bottom corners for side-cannons, and one from the origin otherwise', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const cannons = await confetti({ variant: 'side-cannons', ticks: 600 });
        cannons.fire();
        await frames(2);
        const sides = ink(cannons);
        expect(sides.thirds[0]).toBeGreaterThan(0);
        expect(sides.thirds[2]).toBeGreaterThan(0);
        expect(sides.thirds[1]).toBe(0);
        expect(sides.y).toBeGreaterThan(100);

        const corner = await confetti({ origin: { x: 0, y: 1 }, ticks: 600 });
        corner.fire();
        await frames(2);
        expect(ink(corner).thirds[2]).toBe(0);
    });

    it('launches particleCount particles, and treats 0 as unset like the Angular directive', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const few = await confetti({ particleCount: 1, ticks: 600 });
        few.fire();
        await frames(1);
        const one = ink(few).total;

        const dflt = await confetti({ particleCount: 0, ticks: 600 });
        dflt.fire();
        await frames(1);
        expect(ink(dflt).total / one).toBeCloseTo(1, 0);
        expect(one).toBeGreaterThan(0);
    });

    it('flies at the default angle, spread, speed, gravity and decay, each overridable, with 0 meaning the default', async () => {
        const at = async (options: ConfettiOptions, steps = 1) => {
            oneParticle(1, 0);
            const el = await confetti({ ...SQUARE, ...options });
            el.fire();
            await frames(steps);
            return centre(el);
        };
        // angleRoll 1 swings the angle by +spread/2; speedRoll 0 launches at half of startVelocity.
        const place = (angleDeg: number, speed: number) => ({ x: 150 + speed * Math.cos((angleDeg * Math.PI) / 180), y: 100 - speed * Math.sin((angleDeg * Math.PI) / 180) });

        const base = await at({ angle: 0 });
        expect(base.x).toBeCloseTo(place(22.5, 12.5).x, 0);
        expect(base.y).toBeCloseTo(place(22.5, 12.5).y, 0);
        const spread0 = await at({ angle: 0, spread: 0, startVelocity: 0 });
        expect([spread0.x, spread0.y]).toEqual([base.x, base.y]);
        const wide = await at({ angle: 0, spread: 90, startVelocity: 40 });
        expect(wide.x).toBeCloseTo(place(45, 20).x, 0);
        expect(wide.y).toBeCloseTo(place(45, 20).y, 0);
        const upward = await at({});
        expect(upward.x).toBeCloseTo(place(112.5, 12.5).x, 0);

        // The second step has gravity and decay applied to the velocity of the first.
        const v = place(22.5, 12.5);
        const vy1 = (-12.5 * Math.sin(Math.PI / 8) + 0.05 * 3) * 0.9;
        const vx1 = 12.5 * Math.cos(Math.PI / 8) * 0.9;
        const second = await at({ angle: 0 }, 2);
        expect(second.x).toBeCloseTo(v.x + vx1, 0);
        expect(second.y).toBeCloseTo(v.y + vy1, 0);
        const drifted = await at({ angle: 0, drift: 4, decay: 1, gravity: 0.5 }, 2);
        expect(drifted.x).toBeCloseTo(v.x + (12.5 * Math.cos(Math.PI / 8) + 4), 0);
        expect(drifted.y).toBeCloseTo(v.y + (-12.5 * Math.sin(Math.PI / 8) + 1.5), 0);
    });

    it('sizes squares by scalar, fades them over ticks, and launches 50 particles by default', async () => {
        const fillRect = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect');
        oneParticle(0.5, 0.5);
        const normal = await confetti({ ...SQUARE, scalar: 0 });
        normal.fire();
        await frames(1);
        expect(fillRect).toHaveBeenLastCalledWith(-5, -5, 10, 10);

        const big = await confetti({ ...SQUARE, scalar: 3 });
        big.fire();
        await frames(1);
        expect(fillRect).toHaveBeenLastCalledWith(-15, -15, 30, 30);

        const full = await confetti(SQUARE);
        full.fire();
        await frames(1);
        const bright = centre(full).total;
        const short = await confetti({ ...SQUARE, ticks: 2 });
        short.fire();
        await frames(1);
        expect(centre(short).total / bright).toBeCloseTo(0.5, 1);

        const unset = await confetti({ ...SQUARE, ticks: undefined });
        unset.fire();
        await frames(1);
        expect(centre(unset).total / bright).toBeCloseTo(1, 2);

        for (const other of [normal, big, full, short, unset]) other.remove();
        fillRect.mockClear();
        const crowd = await confetti({ colors: ['#000'], shapes: ['square'] });
        crowd.fire();
        await frames(1);
        expect(fillRect).toHaveBeenCalledTimes(50);
    });

    it('stops its frame loop once every particle has fallen out of sight, and runs one loop however often it fires', async () => {
        oneParticle(0.5, 1);
        const raf = vi.spyOn(globalThis, 'requestAnimationFrame');
        const el = await confetti({ ...SQUARE, angle: 270, startVelocity: 120, ticks: 800 });
        el.fire();
        await new Promise((resolve) => setTimeout(resolve, 300));
        const settled = raf.mock.calls.length;
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(raf.mock.calls.length).toBe(settled);

        oneParticle(1, 0);
        const twice = await confetti({ ...SQUARE, angle: 0 });
        twice.fire();
        twice.fire();
        await frames(1);
        expect(centre(twice).x).toBeCloseTo(150 + 12.5 * Math.cos(Math.PI / 8), 0);
    });

    it('fires each time manual-trigger turns on after the element is ready, but not for the value it starts with', async () => {
        const el = await confetti({ ticks: 600 }, 'manual-trigger');
        await frames(2);
        expect(ink(el).total).toBe(0);

        el.manualTrigger = false;
        await el.updateComplete;
        el.manualTrigger = true;
        await el.updateComplete;
        await frames(2);
        expect(ink(el).total).toBeGreaterThan(0);

        el.remove();
        const fillRect = vi.spyOn(CanvasRenderingContext2D.prototype, 'fillRect');
        const burst = await confetti({ colors: ['#000'], shapes: ['square'], ticks: 800 });
        burst.manualTrigger = false;
        await burst.updateComplete;
        burst.manualTrigger = true;
        await burst.updateComplete;
        await frames(1);
        fillRect.mockClear();
        await frames(1);
        const perFrame = fillRect.mock.calls.length;
        burst.manualTrigger = false;
        await burst.updateComplete;
        fillRect.mockClear();
        await frames(1);
        expect(perFrame).toBe(50);
        expect(fillRect.mock.calls.length).toBe(50);
    });

    it('skips the burst under reduced motion unless disableForReducedMotion is false, and stops its loop when removed', async () => {
        const real = globalThis.matchMedia.bind(globalThis);
        const spy = vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('reduced-motion') ? ({ matches: true } as MediaQueryList) : real(query)));
        const skipped = await confetti({ ticks: 600 });
        skipped.fire();
        await frames(2);
        expect(ink(skipped).total).toBe(0);

        const forced = await confetti({ ticks: 600, disableForReducedMotion: false });
        forced.fire();
        await frames(2);
        expect(ink(forced).total).toBeGreaterThan(0);
        spy.mockRestore();

        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        forced.remove();
        expect(cancel).toHaveBeenCalled();
    });
});
