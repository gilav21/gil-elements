import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeRipple } from './ripple.js';

afterEach(() => vi.restoreAllMocks());

const waves = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.wave')];
const clickAt = (el: Element, dx: number, dy: number) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', { clientX: box.left + dx, clientY: box.top + dy, detail: 1, bubbles: true, composed: true }));
};

async function ripple(attrs = ''): Promise<GeRipple> {
    const page = await mount(`<div style="padding:30px 40px"><ge-ripple ${attrs} style="width:200px;height:80px;color:rgb(255,0,0)"><button style="width:100%;height:100%">Go</button></ge-ripple></div>`);
    return page.querySelector('ge-ripple')!;
}

describe('ge-ripple', () => {
    it('clips to its own box and puts a ripple twice the box\'s longer side across, centred where it was clicked', async () => {
        const el = await ripple();
        expect(getComputedStyle(el).overflow).toBe('hidden');
        expect(getComputedStyle(el).position).toBe('relative');

        clickAt(el, 30, 20);
        const [wave] = waves(el);
        const box = el.getBoundingClientRect();
        const rect = wave!.getBoundingClientRect();

        expect(waves(el)).toHaveLength(1);
        expect([rect.width, rect.height]).toEqual([0, 0]);
        expect(wave!.style.width).toBe('400px');
        expect([wave!.offsetLeft + 200, wave!.offsetTop + 200]).toEqual([30, 20]);
        expect(getComputedStyle(wave!).pointerEvents).toBe('none');
        expect(box.width).toBe(200);
    });

    it('grows from nothing to full size while fading out, over the duration, and removes itself when done', async () => {
        const el = await ripple('duration="120"');
        clickAt(el, 100, 40);
        const animation = waves(el)[0]!.getAnimations()[0]!;
        const frames = animation.effect!.getKeyframes();

        expect(frames[0]).toMatchObject({ transform: 'scale(0)', opacity: '1' });
        expect(frames[1]).toMatchObject({ transform: 'scale(1)', opacity: '0' });
        expect(animation.effect!.getTiming()).toMatchObject({ duration: 120, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' });
        await vi.waitFor(() => expect(waves(el)).toHaveLength(0), { timeout: 2000 });
    });

    it('lets ripples from several clicks overlap, each in the colour asked for or else a tint of the text colour', async () => {
        const tinted = await ripple();
        clickAt(tinted, 10, 10);
        clickAt(tinted, 150, 60);
        expect(waves(tinted)).toHaveLength(2);
        expect(getComputedStyle(waves(tinted)[0]!).backgroundColor).toBe('color(srgb 1 0 0 / 0.35)');

        const green = await ripple('color="rgb(0, 128, 0)"');
        clickAt(green, 10, 10);
        expect(getComputedStyle(waves(green)[0]!).backgroundColor).toBe('rgb(0, 128, 0)');
    });

    it('ripples from the centre for a click made from the keyboard, which has no pointer position', async () => {
        const el = await ripple();
        el.querySelector('button')!.click();
        const wave = waves(el)[0]!;

        expect([wave.offsetLeft + 200, wave.offsetTop + 200]).toEqual([100, 40]);

        el.dispatchEvent(new MouseEvent('click', { clientX: 0, clientY: 0, detail: 1, bubbles: true, composed: true }));
        const corner = waves(el)[1]!;
        expect([corner.offsetLeft + 200, corner.offsetTop + 200]).toEqual([-40, -30]);
    });

    it('does nothing when disabled, and stops positioning and clipping its host', async () => {
        const el = await ripple('disabled');
        clickAt(el, 30, 20);

        expect(waves(el)).toHaveLength(0);
        expect(getComputedStyle(el).position).toBe('static');
        expect(getComputedStyle(el).overflow).toBe('visible');
    });

    it('draws nothing under reduced motion, and clears its ripples when removed', async () => {
        const live = await ripple('duration="5000"');
        clickAt(live, 30, 20);
        live.remove();
        expect(waves(live)).toHaveLength(0);

        const real = globalThis.matchMedia.bind(globalThis);
        vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => (query.includes('reduced-motion') ? ({ matches: true } as MediaQueryList) : real(query)));
        const still = await ripple();
        clickAt(still, 30, 20);
        expect(waves(still)).toHaveLength(0);
    });
});
