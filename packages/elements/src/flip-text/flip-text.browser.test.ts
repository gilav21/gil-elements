import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeFlipText } from './flip-text.js';

afterEach(() => vi.restoreAllMocks());

const chars = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.char')];

describe('ge-flip-text', () => {
    it('makes one flex item per character, a no-break space for a space, each starting one delay after the last', async () => {
        const page = await mount('<ge-flip-text text="Hi you" delay="80" duration="300"></ge-flip-text>');
        const list = chars(page.firstElementChild!);

        expect(list.map((c) => c.textContent)).toEqual(['H', 'i', ' ', 'y', 'o', 'u']);
        expect(list.map((c) => c.style.animationDelay)).toEqual(['0ms', '80ms', '160ms', '240ms', '320ms', '400ms']);
        expect(list.every((c) => c.style.animationDuration === '300ms')).toBe(true);
        expect(getComputedStyle(list[0]!.parentElement!).display).toBe('inline-flex');
        expect(getComputedStyle(list[2]!).display).toBe('block');
    });

    it('turns each character up from edge-on and blurred, and renders nothing for empty text', async () => {
        const page = await mount('<ge-flip-text text="ab"></ge-flip-text><ge-flip-text></ge-flip-text>');
        const [filled, empty] = [...page.children] as GeFlipText[];
        const frames = chars(filled!)[0]!.getAnimations()[0]!.effect!.getKeyframes();

        expect(getComputedStyle(chars(filled!)[0]!).animationName).toBe('flip-in');
        expect(frames[0]).toMatchObject({ opacity: '0', transform: 'rotateX(90deg)', filter: 'blur(4px)' });
        expect(frames.at(-1)).toMatchObject({ opacity: '1', transform: 'rotateX(0deg)', filter: 'blur(0px)' });
        expect(chars(empty!)).toHaveLength(0);
    });

    it('flips each character for half a second, one every 50ms, unless told otherwise', async () => {
        const page = await mount('<ge-flip-text text="abc"></ge-flip-text>');
        const list = chars(page.firstElementChild!);
        expect(list.map((c) => c.style.animationDelay)).toEqual(['0ms', '50ms', '100ms']);
        expect(list[0]!.style.animationDuration).toBe('500ms');
    });

    it('re-flows when the text, delay or duration changes', async () => {
        const page = await mount('<ge-flip-text text="ab"></ge-flip-text>');
        const el = page.firstElementChild as GeFlipText;
        el.text = 'abc';
        el.delay = 10;
        el.duration = 90;
        await el.updateComplete;
        expect(chars(el).map((c) => [c.textContent, c.style.animationDelay, c.style.animationDuration])).toEqual([['a', '0ms', '90ms'], ['b', '10ms', '90ms'], ['c', '20ms', '90ms']]);
    });

    it('plays again on demand: the running flips are cancelled and the same keyframes restart, one delay apart', async () => {
        const page = await mount('<ge-flip-text text="abc" delay="40" duration="200"></ge-flip-text>');
        const el = page.firstElementChild as GeFlipText;
        await Promise.all(el.shadowRoot!.getAnimations().map((a) => a.finished));
        const before = el.shadowRoot!.getAnimations();

        el.playAnimation();
        const after = chars(el).map((c) => c.getAnimations().at(-1)!);

        expect(before.every((a) => a.playState === 'idle')).toBe(true);
        expect(after.map((a) => a.effect!.getTiming().delay)).toEqual([0, 40, 80]);
        expect(after.every((a) => a.effect!.getTiming().duration === 200)).toBe(true);
        expect(after[0]!.effect!.getKeyframes()[0]).toMatchObject({ opacity: '0', transform: 'rotateX(90deg)', filter: 'blur(4px)' });
        expect(chars(el).every((c) => c.style.opacity === '0')).toBe(true);
    });

    it('leaves the characters visible and plays nothing when reduced motion is asked for', async () => {
        const page = await mount('<ge-flip-text text="ab"></ge-flip-text>');
        const el = page.firstElementChild as GeFlipText;
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        el.playAnimation();
        expect(chars(el).every((c) => c.style.opacity === '1')).toBe(true);
        expect(chars(el).every((c) => c.getAnimations().length === 0)).toBe(true);
    });
});
