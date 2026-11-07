import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeStreamingText } from './streaming-text.js';

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const shown = (el: Element) => el.shadowRoot!.querySelector('.base')!.textContent;
const cursor = (el: Element) => el.shadowRoot!.querySelector('.cursor');
async function stream(attrs = '', text = ''): Promise<{ el: GeStreamingText; completes: () => number }> {
    vi.useFakeTimers();
    const page = await mount(`<ge-streaming-text ${attrs}></ge-streaming-text>`);
    const el = page.firstElementChild as GeStreamingText;
    let count = 0;
    el.addEventListener('complete', () => count++);
    el.text = text;
    await el.updateComplete;
    return { el, completes: () => count };
}
const advance = async (el: GeStreamingText, ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await el.updateComplete;
};

describe('ge-streaming-text', () => {
    it('types the text one character every 30ms, with a pulsing bar while it types, and says when it has caught up', async () => {
        const { el, completes } = await stream('', 'Hello');
        await advance(el, 30);
        expect(shown(el)).toBe('H');
        expect(cursor(el)!.textContent).toBe('|');
        await advance(el, 90);
        expect(shown(el)).toBe('Hell');
        expect(completes()).toBe(0);
        await advance(el, 60);
        expect(shown(el)).toBe('Hello');
        expect(completes()).toBe(1);
        expect(cursor(el)).toBeNull();
    });

    it('carries on from where it was while each new text extends the last, and says so again when that drains', async () => {
        const { el, completes } = await stream('speed="10"', 'Hel');
        await advance(el, 100);
        expect(completes()).toBe(1);

        el.text = 'Hello wor';
        await advance(el, 30);
        expect(shown(el)).toBe('Hello ');
        el.text = 'Hello world';
        await advance(el, 200);
        expect(shown(el)).toBe('Hello world');
        expect(completes()).toBe(2);
    });

    it('starts again from empty when the text no longer extends the last one', async () => {
        const { el } = await stream('speed="10"', 'First answer');
        await advance(el, 200);
        expect(shown(el)).toBe('First answer');

        el.text = 'Another';
        await el.updateComplete;
        await el.updateComplete;
        expect(shown(el)).toBe('');
        await advance(el, 30);
        expect(shown(el)).toBe('Ano');
    });

    it('keeps newlines and runs of spaces, and escapes markup', async () => {
        const { el } = await stream('speed="1"', 'a\n  b <i>c</i>');
        await advance(el, 100);
        expect(shown(el)).toBe('a\n  b <i>c</i>');
        expect(getComputedStyle(el.shadowRoot!.querySelector('.base')!).whiteSpace).toBe('pre-wrap');
        expect(el.shadowRoot!.querySelector('i')).toBeNull();
    });

    it('hides the bar with show-cursor="false", reads speed when a run starts, and ignores a change of speed mid-run', async () => {
        const { el } = await stream('show-cursor="false" speed="100"', 'abcdef');
        await advance(el, 100);
        expect(cursor(el)).toBeNull();
        el.speed = 10;
        await advance(el, 100);
        expect(shown(el)).toBe('ab');
    });

    it('shows all of it and completes at once under reduced motion, and stops typing when removed', async () => {
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const reduced = await stream('', 'All at once');
        expect(shown(reduced.el)).toBe('All at once');
        expect(reduced.completes()).toBe(1);
        vi.restoreAllMocks();

        const { el } = await stream('speed="10"', 'abcdef');
        await advance(el, 20);
        el.remove();
        const before = shown(el);
        await vi.advanceTimersByTimeAsync(500);
        expect(shown(el)).toBe(before);
    });

    it('picks the typing up again when re-attached part way through', async () => {
        const { el } = await stream('speed="10"', 'abcdef');
        await advance(el, 20);
        const parent = el.parentElement!;
        el.remove();
        parent.append(el);
        await advance(el, 200);
        expect(shown(el)).toBe('abcdef');
    });
});
