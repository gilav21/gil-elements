import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeMorphingText } from './morphing-text.js';

afterEach(() => vi.useRealTimers());

async function morph(attrs = '', texts = ['Design', 'Build', 'Ship it']): Promise<GeMorphingText> {
    vi.useFakeTimers();
    const page = await mount(`<ge-morphing-text ${attrs}></ge-morphing-text>`);
    const el = page.firstElementChild as GeMorphingText;
    el.texts = texts;
    await el.updateComplete;
    return el;
}
const layers = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.text')];
const shown = (el: Element) => layers(el).map((l) => `${l.textContent}:${l.dataset.visible}`);
const advance = async (el: GeMorphingText, ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await el.updateComplete;
};

describe('ge-morphing-text', () => {
    it('stacks the current and the next text in one box sized by the longest, the current one sharp and the next blurred away', async () => {
        const el = await morph();
        const [current, next] = layers(el);

        expect(shown(el)).toEqual(['Design:true', 'Build:false']);
        expect(getComputedStyle(el).display).toBe('inline-block');
        expect(getComputedStyle(current!).opacity).toBe('1');
        expect(getComputedStyle(current!).filter).toBe('blur(0px)');
        expect(getComputedStyle(next!).opacity).toBe('0');
        expect(getComputedStyle(next!).filter).toBe('blur(8px)');
        expect(el.getBoundingClientRect().width).toBeGreaterThan(el.shadowRoot!.querySelector<HTMLElement>('.size')!.getBoundingClientRect().width - 1);
        expect(el.shadowRoot!.querySelector('.size')!.textContent).toBe('Ship it');
    });

    it('cross-fades every half interval and moves on to the next text each full interval, wrapping round', async () => {
        const el = await morph('interval="1000"');
        await advance(el, 500);
        expect(shown(el)).toEqual(['Design:false', 'Build:true']);
        await advance(el, 500);
        expect(shown(el)).toEqual(['Build:true', 'Ship it:false']);
        await advance(el, 1000);
        expect(shown(el)).toEqual(['Ship it:true', 'Design:false']);
        await advance(el, 1000);
        expect(shown(el)).toEqual(['Design:true', 'Build:false']);
    });

    it('caps the transition at 500ms and shortens it for a quick interval', async () => {
        const slow = await morph('interval="6000"');
        expect(layers(slow)[0]!.style.transitionDuration).toBe('500ms');
        slow.interval = 600;
        await slow.updateComplete;
        expect(layers(slow)[0]!.style.transitionDuration).toBe('200ms');
    });

    it('restarts from the first text when the texts change, and stays still with one text or none', async () => {
        const el = await morph('interval="1000"');
        await advance(el, 1500);
        el.texts = ['Alpha', 'Beta'];
        await el.updateComplete;
        expect(shown(el)).toEqual(['Alpha:true', 'Beta:false']);

        el.texts = ['Only'];
        await el.updateComplete;
        await advance(el, 5000);
        expect(shown(el)).toEqual(['Only:true', 'Only:false']);

        el.texts = [];
        await el.updateComplete;
        await advance(el, 5000);
        expect(shown(el)).toEqual([':true', ':false']);
    });

    it('stops its timer when removed', async () => {
        const el = await morph('interval="1000"');
        el.remove();
        expect(vi.getTimerCount()).toBe(0);
    });
});
