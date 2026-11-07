import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';

async function sparkle(style = ''): Promise<Element> {
    const page = await mount(`<div style="position:relative;width:200px;height:200px"><ge-sparkles style="top:10px;left:20px;width:24px;height:24px;color:rgb(255,0,0);${style}"></ge-sparkles></div>`);
    return page.querySelector('ge-sparkles')!;
}

describe('ge-sparkles', () => {
    it('is an absolutely placed, click-through box that scales a four-point star in the current colour to fill it', async () => {
        const el = await sparkle();
        const svg = el.shadowRoot!.querySelector('svg')!;
        const star = el.shadowRoot!.querySelector('.star')!;
        const box = el.parentElement!.getBoundingClientRect();

        expect(getComputedStyle(el).position).toBe('absolute');
        expect(getComputedStyle(el).pointerEvents).toBe('none');
        expect(el.getBoundingClientRect().left - box.left).toBe(20);
        expect(el.getBoundingClientRect().top - box.top).toBe(10);
        expect(svg.getBoundingClientRect().width).toBe(24);
        expect(svg.getAttribute('aria-hidden')).toBe('true');
        const [ping] = star.getAnimations();
        ping!.pause();
        ping!.currentTime = 0;
        expect(star.getBoundingClientRect().width).toBeCloseTo(24, 0);
        expect(star.getBoundingClientRect().height).toBeCloseTo(24, 0);
        expect(getComputedStyle(star).fill).toBe('rgb(255, 0, 0)');
    });

    it('pings forever: a 1.5s ease-out loop that scales the star to double and fades it from three quarters on', async () => {
        const el = await sparkle('animation-delay:0.4s');
        const [animation] = el.shadowRoot!.querySelector('.star')!.getAnimations();
        const timing = animation!.effect!.getTiming();

        expect(timing).toMatchObject({ duration: 1500, iterations: Infinity, delay: 400 });
        const frames = (animation!.effect as KeyframeEffect).getKeyframes();
        expect(frames.find((f) => f.offset === 1)).toMatchObject({ opacity: '0', transform: 'scale(2)' });
        expect(frames.find((f) => f.offset === 0.75)).toMatchObject({ opacity: '0', transform: 'scale(2)' });
    });
});
