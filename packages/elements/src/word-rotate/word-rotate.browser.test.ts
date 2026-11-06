import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeWordRotate } from './word-rotate.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const positions = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.word')].map((w) => w.dataset.position);
async function rotate(attrs = '', words = ['one', 'two', 'three']): Promise<GeWordRotate> {
    vi.useFakeTimers();
    const page = await mount(`<ge-word-rotate ${attrs} style="width:120px;height:30px"></ge-word-rotate>`);
    const el = page.firstElementChild as GeWordRotate;
    el.words = words;
    await el.updateComplete;
    return el;
}
const advance = async (el: GeWordRotate, ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await el.updateComplete;
};

describe('ge-word-rotate', () => {
    it('stacks every word in the same box, clipped: the first at rest, the one before it parked above, the rest waiting below', async () => {
        const el = await rotate();
        const words = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.word')];

        expect(getComputedStyle(el).overflow).toBe('hidden');
        expect(getComputedStyle(el).display).toBe('inline-block');
        expect(words.map((w) => w.textContent)).toEqual(['one', 'two', 'three']);
        expect(positions(el)).toEqual(['current', 'next', 'previous']);
        expect(words.map((w) => getComputedStyle(w).opacity)).toEqual(['1', '0', '0']);
        expect(new Set(words.map((w) => w.offsetTop)).size).toBe(1);
        expect(getComputedStyle(words[0]!).transitionDuration).toBe('0.3s');
    });

    it('moves on every duration (2000ms by default), wrapping round to the first word', async () => {
        const el = await rotate();
        await advance(el, 1999);
        expect(positions(el)).toEqual(['current', 'next', 'previous']);
        await advance(el, 1);
        expect(positions(el)).toEqual(['previous', 'current', 'next']);
        await advance(el, 2000);
        expect(positions(el)).toEqual(['next', 'previous', 'current']);
        await advance(el, 2000);
        expect(positions(el)).toEqual(['current', 'next', 'previous']);
    });

    it('takes its duration, and restarts the timer when the duration or the words change', async () => {
        const el = await rotate('duration="500"');
        await advance(el, 500);
        expect(positions(el)[1]).toBe('current');

        el.duration = 100;
        await el.updateComplete;
        await advance(el, 100);
        expect(positions(el)[2]).toBe('current');

        el.words = ['a', 'b'];
        await el.updateComplete;
        await advance(el, 100);
        expect(positions(el)).toEqual(['previous', 'current']);
    });

    it('goes back to the first word when the list shrinks past the one showing', async () => {
        const el = await rotate();
        await advance(el, 4000);
        expect(positions(el)[2]).toBe('current');
        el.words = ['x', 'y'];
        await el.updateComplete;
        await el.updateComplete;
        expect(positions(el)).toEqual(['current', 'previous']);
    });

    it('starts no timer for zero or one word, or under reduced motion, and stops it when removed', async () => {
        const one = await rotate('', ['only']);
        await advance(one, 10000);
        expect(positions(one)).toEqual(['current']);

        const none = await rotate('', []);
        await advance(none, 10000);
        expect(positions(none)).toEqual([]);

        const el = await rotate();
        el.remove();
        await vi.advanceTimersByTimeAsync(10000);
        expect(positions(el)[0]).toBe('current');

        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const reduced = await rotate();
        await advance(reduced, 10000);
        expect(positions(reduced)[0]).toBe('current');
    });

    it('picks the rotation up again when it is re-attached', async () => {
        const el = await rotate();
        const parent = el.parentElement!;
        el.remove();
        parent.append(el);
        await advance(el, 2000);
        expect(positions(el)[1]).toBe('current');
    });
});
