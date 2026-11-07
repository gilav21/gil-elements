import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeTextReveal } from './text-reveal.js';

const words = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.word')];

describe('ge-text-reveal', () => {
    it('splits the sentence at whitespace runs into words that start one delay apart', async () => {
        const page = await mount(`<ge-text-reveal text="  Build   faster\n with\tweb components  " delay="80"></ge-text-reveal>`);
        const list = words(page.firstElementChild!);

        expect(list.map((w) => w.textContent)).toEqual(['Build ', 'faster ', 'with ', 'web ', 'components ']);
        expect(list.map((w) => w.style.animationDelay)).toEqual(['0ms', '80ms', '160ms', '240ms', '320ms']);
    });

    it('keeps two words joined by a no-break space together, escapes markup, and renders nothing for empty text', async () => {
        const page = await mount(`<ge-text-reveal text="a&nbsp;b <b>x</b>"></ge-text-reveal><ge-text-reveal text="   "></ge-text-reveal>`);
        const [joined, empty] = [...page.children] as GeTextReveal[];

        expect(words(joined!).map((w) => w.textContent)).toEqual(['a b ', '<b>x</b> ']);
        expect(joined!.shadowRoot!.querySelector('b')).toBeNull();
        expect(words(empty!)).toHaveLength(0);
    });

    it('fades each word in from blurred and shifted down, and re-flows when the text or delay changes', async () => {
        const page = await mount(`<ge-text-reveal text="one two"></ge-text-reveal>`);
        const el = page.firstElementChild as GeTextReveal;
        const first = words(el)[0]!;

        expect(getComputedStyle(first).animationName).toBe('blur-in');
        expect(getComputedStyle(first).animationDuration).toBe('1s');
        const frames = first.getAnimations()[0]!.effect!.getKeyframes();
        expect(frames[0]).toMatchObject({ opacity: '0', filter: 'blur(10px)', transform: 'translateY(10px)' });
        expect(frames.at(-1)).toMatchObject({ opacity: '1', filter: 'blur(0px)', transform: 'translateY(0px)' });

        expect(words(el).map((w) => w.style.animationDelay)).toEqual(['0ms', '50ms']);

        el.text = 'one two three';
        el.delay = 200;
        await el.updateComplete;
        expect(words(el).map((w) => w.style.animationDelay)).toEqual(['0ms', '200ms', '400ms']);
    });

    it('wraps long text between words, never inside one', async () => {
        const page = await mount(`<div style="width:120px"><ge-text-reveal text="alpha beta gamma delta epsilon"></ge-text-reveal></div>`);
        const tops = new Set(words(page.querySelector('ge-text-reveal')!).map((w) => w.getBoundingClientRect().top));

        expect(tops.size).toBeGreaterThan(1);
        for (const w of words(page.querySelector('ge-text-reveal')!)) expect(w.getBoundingClientRect().height).toBeLessThan(30);
    });
});
