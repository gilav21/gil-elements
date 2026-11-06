import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken } from '../test-utils.js';
import type { GeShineBorder } from './shine-border.js';

afterEach(() => vi.restoreAllMocks());

async function shine(attrs = ''): Promise<GeShineBorder> {
    const page = await mount(`<ge-shine-border ${attrs} style="width:200px"><p style="margin:0;padding:1rem">Card</p></ge-shine-border>`);
    return page.firstElementChild as GeShineBorder;
}
const rim = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.rim')!;
const angleOf = (el: Element) => Number(/from ([\d.]+)deg/.exec(rim(el).style.background)![1]);
const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});

describe('ge-shine-border', () => {
    it('draws a rim of border-width (2px) round the content in the content-surface colour, with the default radius', async () => {
        const el = await shine();
        const content = el.shadowRoot!.querySelector<HTMLElement>('.content')!;
        const slotted = el.querySelector('p')!.getBoundingClientRect();

        expect(getComputedStyle(rim(el)).paddingTop).toBe('2px');
        expect(getComputedStyle(rim(el)).borderTopLeftRadius).toBe('8px');
        expect(getComputedStyle(content).backgroundColor).toBe(paintedToken('--background', el));
        expect(slotted.left - el.getBoundingClientRect().left).toBe(2);
        expect(el.getBoundingClientRect().width).toBe(200);
    });

    it('paints a conic gradient of the colours, three defaults, or the ones given', async () => {
        const el = await shine();
        expect(rim(el).style.background).toContain('conic-gradient');
        expect(rim(el).style.background).toContain('rgb(160, 124, 254)');
        expect(rim(el).style.background).toContain('rgb(255, 190, 123)');

        el.colors = ['red', 'blue'];
        el.borderWidth = 5;
        el.borderRadius = 20;
        await el.updateComplete;
        expect(rim(el).style.background).toMatch(/red, blue/);
        expect(rim(el).style.padding).toBe('5px');
        expect(rim(el).style.borderRadius).toBe('20px');
    });

    it('turns the gradient once per duration', async () => {
        const el = await shine('duration="2"');
        const now = vi.spyOn(performance, 'now');
        const start = performance.now();
        now.mockReturnValue(start);
        el.disconnectedCallback();
        el.connectedCallback();
        now.mockReturnValue(start + 500);
        await frames(2);
        expect(angleOf(el)).toBeCloseTo(90, 0);
        now.mockReturnValue(start + 2500);
        await frames(2);
        expect(angleOf(el)).toBeCloseTo(90, 0);
    });

    it('stops its frame loop when removed', async () => {
        const el = await shine();
        const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
        el.remove();
        expect(cancel).toHaveBeenCalled();
    });
});
