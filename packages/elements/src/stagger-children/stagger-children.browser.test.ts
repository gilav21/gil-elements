import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeStaggerChildren } from './stagger-children.js';

afterEach(() => vi.restoreAllMocks());

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
async function stagger(attrs = '', top = 0): Promise<GeStaggerChildren> {
    const page = await mount(`<div style="height:${top}px"></div><ge-stagger-children ${attrs}><p>one</p><p>two</p><p>three</p></ge-stagger-children>`);
    return page.querySelector('ge-stagger-children')!;
}
const kids = (el: Element) => [...el.children] as HTMLElement[];

describe('ge-stagger-children', () => {
    it('hides its children, then slides them in one after another once it is on screen', async () => {
        const el = await stagger('direction="up" stagger-delay="100" duration="300"');
        await frames(3);
        const animations = kids(el).map((c) => c.getAnimations()[0]!);

        expect(animations.map((a) => a.effect!.getTiming().delay)).toEqual([0, 100, 200]);
        expect(animations[0]!.effect!.getTiming()).toMatchObject({ duration: 300, fill: 'forwards' });
        const frames0 = (animations[0]!.effect as KeyframeEffect).getKeyframes();
        expect(frames0[0]).toMatchObject({ opacity: '0', transform: 'translate(0px, 20px)', filter: 'blur(4px)' });
        expect(frames0[1]).toMatchObject({ opacity: '1', transform: 'translate(0px, 0px)', filter: 'blur(0px)' });
        expect(getComputedStyle(el).display).toBe('block');
    });

    it('starts each child from the side the direction names', async () => {
        const starts: Record<string, string> = { up: 'translate(0px, 20px)', down: 'translate(0px, -20px)', left: 'translate(20px, 0px)', right: 'translate(-20px, 0px)' };
        for (const [direction, from] of Object.entries(starts)) {
            const el = await stagger(`direction="${direction}"`);
            await frames(3);
            expect((kids(el)[0]!.getAnimations()[0]!.effect as KeyframeEffect).getKeyframes()[0]!.transform).toBe(from);
            el.parentElement!.remove();
        }
    });

    it('waits while off screen, and adds its delay before the first child', async () => {
        const el = await stagger('delay="500"', 3000);
        await frames(3);
        expect(kids(el).every((c) => c.getAnimations().length === 0 && c.style.opacity === '0')).toBe(true);

        el.scrollIntoView();
        await vi.waitFor(() => expect(kids(el)[0]!.getAnimations()).toHaveLength(1));
        expect(kids(el)[0]!.getAnimations()[0]!.effect!.getTiming().delay).toBe(500);
        window.scrollTo(0, 0);
    });

    it('plays again on demand from hidden', async () => {
        const el = await stagger();
        await frames(3);
        el.play();
        expect(kids(el).map((c) => c.getAnimations().length)).toEqual([1, 1, 1]);
        expect(kids(el)[0]!.style.opacity).toBe('0');
    });

    it('does not leave an observer behind when removed before its first frame', async () => {
        const original = globalThis.IntersectionObserver;
        const made = vi.fn();
        globalThis.IntersectionObserver = class extends original { constructor(...args: ConstructorParameters<typeof original>) { super(...args); made(); } };
        const el = await stagger();
        el.remove();
        await frames(3);
        globalThis.IntersectionObserver = original;
        expect(made).not.toHaveBeenCalled();
    });
});
