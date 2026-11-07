import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeBlurFade } from './blur-fade.js';

afterEach(() => vi.restoreAllMocks());

async function fade(attrs = '', style = ''): Promise<GeBlurFade> {
    const page = await mount(`<div style="${style}"><ge-blur-fade ${attrs}><p>Hello</p></ge-blur-fade></div>`);
    return page.querySelector<GeBlurFade>('ge-blur-fade')!;
}
const frames = (el: Element) => el.getAnimations()[0]!.effect!.getKeyframes();

describe('ge-blur-fade', () => {
    it('is a block that starts hidden and, with in-view off, plays at once: 500ms from blurred and 8px low, easing out', async () => {
        const el = await fade('in-view="false"');
        const animation = el.getAnimations()[0]!;

        expect(getComputedStyle(el).display).toBe('block');
        expect(animation.effect!.getTiming()).toMatchObject({ duration: 500, delay: 0, fill: 'forwards', easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' });
        expect(frames(el)[0]).toMatchObject({ opacity: '0', filter: 'blur(8px)', transform: 'translateY(8px)' });
        expect(frames(el)[1]).toMatchObject({ opacity: '1', filter: 'blur(0px)', transform: 'translate(0px, 0px)' });
        await animation.finished;
        expect(getComputedStyle(el).opacity).toBe('1');
    });

    it('travels towards each direction over 8px, and takes its delay and duration', async () => {
        const expected = { up: 'translateY(8px)', down: 'translateY(-8px)', left: 'translateX(8px)', right: 'translateX(-8px)' };
        for (const [direction, from] of Object.entries(expected)) {
            const el = await fade(`in-view="false" direction="${direction}" delay="120" duration="300"`);
            expect(frames(el)[0]!.transform).toBe(from);
            expect(el.getAnimations()[0]!.effect!.getTiming()).toMatchObject({ duration: 300, delay: 120 });
        }
    });

    it('waits until it is about a tenth visible, then plays once and stops watching', async () => {
        const el = await fade('', 'margin-top:3000px');
        expect(el.getAnimations()).toHaveLength(0);
        expect(getComputedStyle(el).opacity).toBe('0');

        el.scrollIntoView({ block: 'center' });
        await vi.waitFor(() => expect(el.getAnimations()).toHaveLength(1));
        await el.getAnimations()[0]!.finished;
        scrollTo(0, 0);
        el.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 100));
        expect(el.getAnimations().length).toBeLessThanOrEqual(1);
        expect(getComputedStyle(el).opacity).toBe('1');
    });

    it('starts as soon as a tenth of it shows, not only when it is mostly in view', async () => {
        const page = await mount('<div style="height:3000px"></div><ge-blur-fade><div style="height:1000px">tall</div></ge-blur-fade><div style="height:3000px"></div>');
        const el = page.querySelector<GeBlurFade>('ge-blur-fade')!;
        expect(el.getAnimations()).toHaveLength(0);
        scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight + 200);
        await vi.waitFor(() => expect(el.getAnimations()).toHaveLength(1));
    });

    it('is armed again if it is moved before it was revealed', async () => {
        const el = await fade('', 'margin-top:3000px');
        const parent = el.parentElement!;
        el.remove();
        parent.append(el);
        el.scrollIntoView({ block: 'center' });
        await vi.waitFor(() => expect(el.getAnimations()).toHaveLength(1));
    });

    it('stays silent for the first reveal, then replay() restarts it and fires replay each time', async () => {
        const el = await fade('in-view="false"');
        let replays = 0;
        el.addEventListener('replay', () => replays++);
        await el.getAnimations()[0]!.finished;
        expect(replays).toBe(0);

        el.playAnimation();
        el.playAnimation();
        expect(replays).toBe(2);
        expect(el.getAnimations()).toHaveLength(1);
        expect(getComputedStyle(el).opacity).toBe('0');
    });

    it('does not count a manual first reveal as a replay', async () => {
        const el = await fade('', 'margin-top:3000px');
        let replays = 0;
        el.addEventListener('replay', () => replays++);
        el.playAnimation();
        expect(replays).toBe(0);
    });

    it('shows the content straight away under reduced motion, and when there is no IntersectionObserver to wait for', async () => {
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);
        const reduced = await fade('in-view="false"');
        expect(getComputedStyle(reduced).opacity).toBe('1');
        expect(reduced.getAnimations()).toHaveLength(0);
        vi.restoreAllMocks();

        vi.stubGlobal('IntersectionObserver', undefined);
        const none = await fade();
        expect(getComputedStyle(none).opacity).toBe('1');
        vi.unstubAllGlobals();
    });

    it('cancels its animation when it is removed', async () => {
        const el = await fade('in-view="false" duration="5000"');
        const animation = el.getAnimations()[0]!;
        el.remove();
        expect(animation.playState).toBe('idle');
    });
});
