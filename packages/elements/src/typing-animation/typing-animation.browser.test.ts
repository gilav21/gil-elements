import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeTypingAnimation } from './typing-animation.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const shown = (el: Element) => el.shadowRoot!.querySelector('[aria-hidden="true"]')!.textContent;
const caret = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.caret');
async function typing(attrs = '', strings: string[] = ['Hi', 'Yo']): Promise<GeTypingAnimation> {
    vi.useFakeTimers();
    const page = await mount(`<ge-typing-animation ${attrs}></ge-typing-animation>`);
    const el = page.firstElementChild as GeTypingAnimation;
    el.strings = strings;
    await el.updateComplete;
    return el;
}
const advance = async (el: GeTypingAnimation, ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await el.updateComplete;
};

describe('ge-typing-animation', () => {
    it('types a phrase a character at a time, holds it, deletes it faster, waits 300ms and types the next', async () => {
        const el = await typing('type-speed="50" delete-speed="20" pause-duration="1000"');
        const log: string[] = [];
        for (const ms of [0, 50, 50, 1000, 20, 20, 300, 50, 50]) {
            await advance(el, ms);
            log.push(shown(el)!);
        }
        expect(log).toEqual(['H', 'Hi', 'Hi', 'H', '', '', 'Y', 'Yo', 'Yo']);
    });

    it('loops from the last phrase back to the first', async () => {
        const el = await typing('type-speed="10" delete-speed="10" pause-duration="10"', ['a', 'b']);
        const order: string[] = [];
        for (let i = 0; i < 200; i++) {
            await advance(el, 10);
            const now = shown(el)!;
            if (now !== '' && order.at(-1) !== now) order.push(now);
        }
        expect(order.slice(0, 5)).toEqual(['a', 'b', 'a', 'b', 'a']);
    });

    it('types at 50ms, deletes at 30ms and holds 1500ms unless told otherwise', async () => {
        const el = await typing('', ['ab']);
        await advance(el, 0);
        expect(shown(el)).toBe('a');
        await advance(el, 49);
        expect(shown(el)).toBe('a');
        await advance(el, 1);
        expect(shown(el)).toBe('ab');
        await advance(el, 1549);
        expect(shown(el)).toBe('ab');
        await advance(el, 1);
        expect(shown(el)).toBe('a');
        await advance(el, 29);
        expect(shown(el)).toBe('a');
        await advance(el, 1);
        expect(shown(el)).toBe('');
    });

    it('is not restarted by a new list part way through: the typing keeps its pace and place', async () => {
        const el = await typing('', ['abcdefghij']);
        await advance(el, 100);
        expect(shown(el)).toBe('abc');
        el.strings = ['0123456789'];
        await el.updateComplete;
        await advance(el, 50);
        expect(shown(el)).toBe('0123');
    });

    it('carries on where it was when it is re-attached', async () => {
        const el = await typing('', ['abcdef']);
        await advance(el, 100);
        const parent = el.parentElement!;
        el.remove();
        await advance(el, 1000);
        expect(shown(el)).toBe('abc');
        parent.append(el);
        await advance(el, 200);
        expect(shown(el)).toBe('abcdef');
    });

    it('with loop off stops on the last phrase and says so once; it never says so while looping', async () => {
        const el = await typing('loop="false" type-speed="10" delete-speed="10" pause-duration="10"', ['ab', 'cd']);
        let completes = 0;
        el.addEventListener('complete', () => completes++);
        await advance(el, 3000);
        expect(shown(el)).toBe('cd');
        expect(completes).toBe(1);
        await advance(el, 3000);
        expect(completes).toBe(1);

        const looping = await typing('type-speed="10" delete-speed="10" pause-duration="10"', ['ab']);
        let loops = 0;
        looping.addEventListener('complete', () => loops++);
        await advance(looping, 3000);
        expect(loops).toBe(0);
    });

    it('hides the typing from assistive technology and gives it every phrase at once', async () => {
        const el = await typing('', ['One', 'Two']);
        expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).toBe('One, Two');
        expect(shown(el)).toBe('O');
        expect(caret(el)!.getAttribute('aria-hidden')).toBe('true');
    });

    it('draws a 2px caret that is solid while characters move and blinks while idle between phrases, and cursor="false" removes it', async () => {
        const el = await typing('type-speed="50" pause-duration="500"', ['ab']);
        await advance(el, 0);
        expect(caret(el)!.hasAttribute('data-blink')).toBe(false);
        expect(getComputedStyle(caret(el)!).width).toBe('2px');
        await advance(el, 100);
        expect(shown(el)).toBe('ab');
        expect(caret(el)!.hasAttribute('data-blink')).toBe(true);
        expect(getComputedStyle(caret(el)!).animationName).toBe('caret-blink');

        const none = await typing('cursor="false"');
        expect(caret(none)).toBeNull();
    });

    it('reads the speeds and the phrase list afresh, and copes with the list being emptied mid-run', async () => {
        const el = await typing('type-speed="100"', ['abcd']);
        await advance(el, 0);
        await advance(el, 100);
        expect(shown(el)).toBe('ab');
        el.typeSpeed = 10;
        await advance(el, 100);
        await advance(el, 10);
        expect(shown(el)).toBe('abcd');

        // Emptied: the text is cleared and nothing runs; filled again, it starts over from the first phrase.
        el.strings = [];
        await advance(el, 5000);
        expect(shown(el)).toBe('');
        el.strings = ['xy'];
        await advance(el, 0);
        expect(shown(el)).toBe('x');
        await advance(el, 10);
        expect(shown(el)).toBe('xy');
    });

    it('shows the new phrase at once when the list is replaced while the old one is held, instead of the old text for the whole pause', async () => {
        const el = await typing('type-speed="10" pause-duration="1500"', ['abc', 'xyz!']);
        for (let i = 0; i < 20 && shown(el) !== 'abc'; i++) await advance(el, 10);
        await advance(el, 20);
        expect(shown(el)).toBe('abc');
        el.strings = ['uvw', 'xyz!'];
        await advance(el, 0);
        expect(shown(el)).toBe('uvw');
        // the place survives a shorter phrase too
        el.strings = ['q', 'r'];
        await advance(el, 0);
        expect(shown(el)).toBe('q');
    });

    it('a finished non-looping run types on when its last phrase is replaced by a longer one, and says `complete` once for the run', async () => {
        const el = await typing('loop="false" type-speed="10" pause-duration="10"', ['ab']);
        let completes = 0;
        el.addEventListener('complete', () => completes++);
        await advance(el, 500);
        expect(shown(el)).toBe('ab');
        expect(completes).toBe(1);
        el.strings = ['abcde'];
        await advance(el, 500);
        expect(shown(el)).toBe('abcde');
        // `complete` is once per run: the extended phrase is typed on quietly, so a one-shot handler never runs twice
        expect(completes).toBe(1);
        el.strings = ['vwxyz'];
        await advance(el, 500);
        expect(shown(el)).toBe('vwxyz');
        expect(completes).toBe(1);
    });

    it('starts again when the list is replaced by one shorter than the phrase being typed', async () => {
        const el = await typing('type-speed="10" delete-speed="10" pause-duration="10"', ['a', 'b', 'c']);
        for (let i = 0; i < 400 && shown(el) !== 'c'; i++) await advance(el, 10);
        expect(shown(el)).toBe('c');
        el.strings = ['z'];
        await advance(el, 0);
        // Typed at once, from the start of the new list (the run carries on after the short pause).
        expect(shown(el)).toBe('z');
    });

    it('under reduced motion a replaced list shows its own first phrase', async () => {
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const el = await typing('', ['A', 'B']);
        expect(shown(el)).toBe('A');
        el.strings = ['C', 'D'];
        await advance(el, 0);
        expect(shown(el)).toBe('C');
        vi.restoreAllMocks();
    });

    it('shows the first phrase at once and runs nothing under reduced motion, and starts nothing without phrases', async () => {
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const el = await typing('', ['First', 'Second']);
        await advance(el, 100);
        expect(shown(el)).toBe('First');
        await advance(el, 5000);
        expect(shown(el)).toBe('First');
        vi.restoreAllMocks();

        const empty = await typing('', []);
        await advance(empty, 1000);
        expect(shown(empty)).toBe('');
    });

    it('stops its timer when removed', async () => {
        const el = await typing('type-speed="10"', ['abcdef']);
        await advance(el, 30);
        el.remove();
        const before = shown(el);
        await vi.advanceTimersByTimeAsync(500);
        expect(shown(el)).toBe(before);
    });
});
