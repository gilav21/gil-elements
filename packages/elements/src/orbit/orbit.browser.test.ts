import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeOrbit } from './orbit.js';

async function orbit(attrs = ''): Promise<GeOrbit> {
    const page = await mount(`<div style="position:relative;width:300px;height:300px"><ge-orbit ${attrs}><span id="dot" style="display:block;width:20px;height:20px">x</span></ge-orbit></div>`);
    return page.querySelector('ge-orbit')!;
}
const timing = (el: Element) => el.getAnimations()[0]!.effect!.getTiming();
const dot = (el: Element) => el.querySelector('#dot')!.getBoundingClientRect();
const centre = (el: Element) => {
    const box = el.parentElement!.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

describe('ge-orbit', () => {
    it('fills its positioned box without catching clicks, but keeps its item clickable', async () => {
        const el = await orbit();
        const box = el.parentElement!.getBoundingClientRect();

        expect(el.getBoundingClientRect().width).toBe(box.width);
        expect(el.getBoundingClientRect().height).toBe(box.height);
        expect(getComputedStyle(el).pointerEvents).toBe('none');
        expect(getComputedStyle(el.shadowRoot!.querySelector('.item')!).pointerEvents).toBe('auto');
    });

    it('puts the item one radius from the centre (100px by default) and spins it round once per duration, linearly, forever', async () => {
        const el = await orbit();
        el.getAnimations()[0]!.pause();
        el.getAnimations()[0]!.currentTime = 0;
        const c = centre(el);
        const d = dot(el);

        expect(d.left + d.width / 2).toBeCloseTo(c.x + 100, 0);
        expect(d.top + d.height / 2).toBeCloseTo(c.y, 0);
        expect(timing(el)).toMatchObject({ duration: 10000, iterations: Infinity, easing: 'linear', direction: 'normal', delay: 0 });

        el.getAnimations()[0]!.currentTime = 2500;
        const quarter = dot(el);
        expect(quarter.left + quarter.width / 2).toBeCloseTo(c.x, 0);
        expect(quarter.top + quarter.height / 2).toBeCloseTo(c.y + 100, 0);
    });

    it('takes radius, duration, delay and reverse, and re-times the spin when they change', async () => {
        const el = await orbit('radius="60" duration="4" delay="1" reverse');
        expect(timing(el)).toMatchObject({ duration: 4000, delay: 1000, direction: 'reverse' });
        el.getAnimations()[0]!.pause();
        el.getAnimations()[0]!.currentTime = 1000;
        const c = centre(el);
        const d = dot(el);
        expect(Math.hypot(d.left + d.width / 2 - c.x, d.top + d.height / 2 - c.y)).toBeCloseTo(60, 0);

        el.duration = 8;
        el.reverse = false;
        await el.updateComplete;
        expect(el.getAnimations()).toHaveLength(1);
        expect(timing(el)).toMatchObject({ duration: 8000, direction: 'normal' });

        el.radius = 30;
        await el.updateComplete;
        expect(el.shadowRoot!.querySelector<HTMLElement>('.item')!.style.transform).toBe('translate(-50%, -50%) translateX(30px)');
    });

    it('stops spinning when removed', async () => {
        const el = await orbit();
        el.remove();
        expect(el.getAnimations()).toHaveLength(0);
    });
});
