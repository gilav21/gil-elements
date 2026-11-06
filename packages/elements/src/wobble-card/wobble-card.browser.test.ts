import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeWobbleCard } from './wobble-card.js';

async function card(attrs = ''): Promise<GeWobbleCard> {
    const page = await mount(`<ge-wobble-card ${attrs} style="width:200px;height:100px"><div style="height:100%">Card</div></ge-wobble-card>`);
    return page.firstElementChild as GeWobbleCard;
}
const hover = async (el: GeWobbleCard, x: number, y: number) => {
    const box = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + x, clientY: box.top + y }));
    await el.updateComplete;
};

describe('ge-wobble-card', () => {
    it('is a clipped, rounded block that animates its transform over 200ms', async () => {
        const el = await card();
        const style = getComputedStyle(el);

        expect(style.display).toBe('block');
        expect(style.overflow).toBe('hidden');
        expect(style.borderTopLeftRadius).toBe(`${Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.625 + 4}px`);
        expect(style.transitionDuration).toBe('0.2s');
        expect(el.style.transform).toBe('perspective(1000px) rotateX(0deg) rotateY(0deg)');
    });

    it('tilts towards the pointer: the right edge turns by the full intensity one way, the bottom edge by the full intensity the other', async () => {
        const el = await card('intensity="10"');
        await hover(el, 200, 50);
        expect(el.style.transform).toBe('perspective(1000px) rotateX(0deg) rotateY(10deg)');
        await hover(el, 100, 100);
        expect(el.style.transform).toBe('perspective(1000px) rotateX(-10deg) rotateY(0deg)');
        await hover(el, 50, 25);
        expect(el.style.transform).toBe('perspective(1000px) rotateX(5deg) rotateY(-5deg)');
    });

    it('takes its perspective, and settles flat when the pointer leaves', async () => {
        const el = await card('perspective="400"');
        await hover(el, 180, 20);
        expect(el.style.transform).toMatch(/^perspective\(400px\) rotateX\(.*\) rotateY\(.*\)$/);
        expect(el.style.transform).not.toContain('rotateX(0deg)');

        el.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(el.style.transform).toBe('perspective(400px) rotateX(0deg) rotateY(0deg)');
    });
});
