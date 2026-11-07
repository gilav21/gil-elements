import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeMarquee } from './marquee.js';

const ITEMS = `<span style="display:inline-block;width:100px;height:20px">A</span><span style="display:inline-block;width:60px;height:20px">B</span>`;
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const track = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.track')!;
const run = (el: Element) => track(el).getAnimations()[0];
const slide = (el: Element) => {
    const [from, to] = run(el)!.effect!.getKeyframes().map((k) => k.transform as string);
    return { from, to, timing: run(el)!.effect!.getTiming() };
};

afterEach(() => vi.restoreAllMocks());

async function marquee(attrs = '', body = ITEMS): Promise<GeMarquee> {
    const page = await mount(`<div style="width:200px;height:50px"><ge-marquee ${attrs}>${body}</ge-marquee></div>`);
    await frame();
    return page.querySelector('ge-marquee')!;
}

describe('ge-marquee', () => {
    it('slides the track by one copy of the content plus the gap, linearly for the speed in seconds, and copies the content once for an invisible seam', async () => {
        const el = await marquee('speed="8" gap="10"');

        expect(slide(el)).toMatchObject({ from: 'translateX(0px)', to: 'translateX(-180px)', timing: { duration: 8000, iterations: Infinity, easing: 'linear', direction: 'normal' } });
        const copy = el.shadowRoot!.querySelector('.copy')!;
        expect(copy.getAttribute('aria-hidden')).toBe('true');
        expect(copy.textContent).toBe('AB');
        expect(copy.getBoundingClientRect().left).toBeCloseTo(el.shadowRoot!.querySelector('.segment')!.getBoundingClientRect().right + 10, 0);
    });

    it('runs the other way for right and down, and vertically for up and down', async () => {
        const right = await marquee('direction="right"');
        const up = await marquee('direction="up" style="height:100px"', `<div style="height:30px">A</div><div style="height:40px">B</div>`);
        const down = await marquee('direction="down"', `<div style="height:30px">A</div>`);

        expect(slide(right).timing.direction).toBe('reverse');
        expect(slide(up)).toMatchObject({ from: 'translateY(0px)', to: 'translateY(-102px)', timing: { direction: 'normal' } });
        expect(getComputedStyle(track(up)).flexDirection).toBe('column');
        expect(up.shadowRoot!.querySelector('.viewport')!.getBoundingClientRect().height).toBe(100);
        expect(slide(down)).toMatchObject({ to: 'translateY(-46px)', timing: { direction: 'reverse' } });
    });

    it('pauses under the pointer or a held touch only when asked to, and resumes from where it stopped', async () => {
        const plain = await marquee();
        const hover = await marquee('pause-on-hover');
        const viewport = (el: Element) => el.shadowRoot!.querySelector('.viewport')!;

        viewport(plain).dispatchEvent(new MouseEvent('mouseenter'));
        expect(run(plain)!.playState).toBe('running');

        viewport(hover).dispatchEvent(new MouseEvent('mouseenter'));
        expect(run(hover)!.playState).toBe('paused');
        viewport(hover).dispatchEvent(new MouseEvent('mouseleave'));
        expect(run(hover)!.playState).toBe('running');
        viewport(hover).dispatchEvent(new Event('touchstart'));
        expect(run(hover)!.playState).toBe('paused');
        viewport(hover).dispatchEvent(new Event('touchend'));
        expect(run(hover)!.playState).toBe('running');
    });

    it('rebuilds from the new settings and content, never leaving two copies, and stops when removed', async () => {
        const el = await marquee('speed="10"');
        el.speed = 4;
        await el.updateComplete;
        await frame();
        expect(slide(el)).toMatchObject({ to: 'translateX(-192px)', timing: { duration: 4000 } });
        el.gap = 0;
        await el.updateComplete;
        await frame();
        expect(slide(el)).toMatchObject({ to: 'translateX(-160px)', timing: { duration: 4000 } });
        expect(el.shadowRoot!.querySelectorAll('.copy')).toHaveLength(1);

        el.append(Object.assign(document.createElement('span'), { textContent: 'C', style: 'display:inline-block;width:40px' }));
        await frame();
        await frame();
        expect(slide(el).to).toBe('translateX(-200px)');
        expect(el.shadowRoot!.querySelector('.copy')!.textContent).toBe('ABC');
        expect(el.shadowRoot!.querySelectorAll('.copy')).toHaveLength(1);

        const animation = run(el)!;
        el.remove();
        expect(animation.playState).toBe('idle');
    });

    it('does not move or copy anything when the user prefers reduced motion', async () => {
        const real = globalThis.matchMedia.bind(globalThis);
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('reduced-motion') ? ({ matches: true } as MediaQueryList) : real(query)));
        const el = await marquee();

        expect(run(el)).toBeUndefined();
        expect(el.shadowRoot!.querySelector('.copy')).toBeNull();
    });
});
