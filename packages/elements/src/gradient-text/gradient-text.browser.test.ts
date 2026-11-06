import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeGradientText } from './gradient-text.js';

afterEach(() => vi.restoreAllMocks());

const text = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.text')!;
async function gradient(attrs = '', inner = 'Shimmer'): Promise<GeGradientText> {
    const page = await mount(`<ge-gradient-text ${attrs}>${inner}</ge-gradient-text>`);
    return page.firstElementChild as GeGradientText;
}

describe('ge-gradient-text', () => {
    it('paints the glyphs with a linear gradient of the default four colours, sized to twice the box so it can pan', async () => {
        const el = await gradient();
        const style = getComputedStyle(text(el));

        expect(getComputedStyle(el).display).toBe('inline-block');
        expect(style.backgroundImage).toContain('linear-gradient(to right');
        for (const colour of ['rgb(255, 107, 107)', 'rgb(78, 205, 196)', 'rgb(69, 183, 209)', 'rgb(150, 206, 180)']) expect(style.backgroundImage).toContain(colour);
        expect(style.backgroundSize).toBe('200% 200%');
        expect(style.backgroundClip).toBe('text');
        expect(style.webkitTextFillColor).toBe('rgba(0, 0, 0, 0)');
        expect(el.textContent).toBe('Shimmer');
    });

    it('takes the stops and the direction it is given, and re-paints when they change', async () => {
        const el = await gradient('direction="to bottom"');
        el.colors = ['#000000', '#ffffff'];
        await el.updateComplete;
        expect(getComputedStyle(text(el)).backgroundImage).toBe('linear-gradient(rgb(0, 0, 0), rgb(255, 255, 255))');

        el.direction = 'to left';
        await el.updateComplete;
        expect(getComputedStyle(text(el)).backgroundImage).toContain('to left');
    });

    it('pans the gradient back and forth around the middle: speed seconds per sweep, read on every frame', async () => {
        let now = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const el = await gradient('speed="4"');
        const at = async (ms: number) => {
            now = 1000 + ms;
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            return Number.parseFloat(text(el).style.backgroundPosition);
        };

        expect(await at(1000)).toBeCloseTo(100, 3);
        expect(await at(2000)).toBeCloseTo(50, 3);
        expect(await at(3000)).toBeCloseTo(0, 3);
        expect(await at(4000)).toBeCloseTo(50, 3);
        expect(text(el).style.backgroundPosition).toMatch(/ 50%$/);

        el.speed = 8;
        expect(await at(2000)).toBeCloseTo(100, 3);
    });

    it('sweeps once every three seconds unless told otherwise, and picks the sweep up again when it is re-attached', async () => {
        let now = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const el = await gradient();
        const settle = async () => {
            await new Promise((r) => requestAnimationFrame(() => r(null)));
            await new Promise((r) => requestAnimationFrame(() => r(null)));
        };
        now = 1750;
        await settle();
        expect(Number.parseFloat(text(el).style.backgroundPosition)).toBeCloseTo(100, 3);

        const parent = el.parentElement!;
        el.remove();
        now = 5000;
        parent.append(el);
        now = 5375;
        await settle();
        expect(Number.parseFloat(text(el).style.backgroundPosition)).toBeCloseTo(85.355, 2);
    });

    it('keeps the gradient still under reduced motion, and stops sweeping once it is removed', async () => {
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const still = await gradient();
        await new Promise((r) => setTimeout(r, 80));
        expect(text(still).style.backgroundPosition).toBe('');
        vi.restoreAllMocks();

        const el = await gradient();
        await vi.waitFor(() => expect(text(el).style.backgroundPosition).not.toBe(''));
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        el.remove();
        expect(cancel).toHaveBeenCalled();
    });
});
