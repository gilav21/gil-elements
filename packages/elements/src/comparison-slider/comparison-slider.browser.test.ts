import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeComparisonSlider } from './comparison-slider.js';

const PX = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="4" height="2"%3E%3Crect width="4" height="2" fill="red"/%3E%3C/svg%3E';

async function slider(attrs = '', style = 'width:400px'): Promise<GeComparisonSlider> {
    const page = await mount(`<ge-comparison-slider before-src="${PX}" after-src="${PX}" before-alt="Before" after-alt="After" ${attrs} style="${style}"></ge-comparison-slider>`);
    const el = page.firstElementChild as GeComparisonSlider;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await el.updateComplete;
    return el;
}
const part = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const range = (el: Element) => part(el, 'input.range') as unknown as HTMLInputElement;
const at = (el: Element, fx: number, fy: number) => {
    const box = el.getBoundingClientRect();
    return { clientX: box.left + box.width * fx, clientY: box.top + box.height * fy };
};
const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('ge-comparison-slider', () => {
    it('is a 16:9 box as wide as its parent, the after image filling it and the before image clipped to the divider, at the same size as the after one', async () => {
        const el = await slider('position="25"');
        const box = el.getBoundingClientRect();
        const clip = part(el, '.clip').getBoundingClientRect();
        const before = part(el, '.before').getBoundingClientRect();

        expect(box.width).toBe(400);
        expect(box.height).toBeCloseTo(225, 0);
        expect(getComputedStyle(el).overflow).toBe('hidden');
        expect(part(el, '.after').getBoundingClientRect().width).toBe(400);
        expect(clip.width).toBe(100);
        expect(clip.height).toBeCloseTo(225, 0);
        expect(before.width).toBe(400);
        expect(part(el, '.before').getAttribute('alt')).toBe('Before');
        expect(part(el, '.after').getAttribute('alt')).toBe('After');
    });

    it('centres the divider and its handle on the position, and keeps the handle in the middle of the height', async () => {
        const el = await slider('position="30"');
        const box = el.getBoundingClientRect();
        const handle = part(el, '.handle').getBoundingClientRect();

        expect(handle.left + handle.width / 2).toBeCloseTo(box.left + 120, 0);
        expect(handle.top + handle.height / 2).toBeCloseTo(box.top + box.height / 2, 0);
        expect(handle.width).toBe(40);
        expect(part(el, '.divider').getBoundingClientRect().width).toBe(4);
    });

    it('wipes top to bottom when vertical, with the divider across the box', async () => {
        const el = await slider('orientation="vertical" position="40"');
        const box = el.getBoundingClientRect();
        const clip = part(el, '.clip').getBoundingClientRect();
        const handle = part(el, '.handle').getBoundingClientRect();

        expect(clip.height).toBeCloseTo(box.height * 0.4, 0);
        expect(clip.width).toBe(400);
        expect(part(el, '.before').getBoundingClientRect().height).toBeCloseTo(box.height, 0);
        expect(handle.top + handle.height / 2).toBeCloseTo(box.top + box.height * 0.4, 0);
        expect(handle.left + handle.width / 2).toBeCloseTo(box.left + 200, 0);
    });

    it('jumps to the point pressed and follows the pointer until it is released, clamped to the box, announcing each move', async () => {
        const el = await slider();
        const seen: number[] = [];
        el.addEventListener('position-change', (e) => seen.push((e as CustomEvent<number>).detail));

        el.dispatchEvent(new MouseEvent('mousedown', { ...at(el, 0.2, 0.5), bubbles: true }));
        expect(el.position).toBeCloseTo(20, 0);
        window.dispatchEvent(new MouseEvent('mousemove', at(el, 0.7, 0.5)));
        await frame();
        expect(el.position).toBeCloseTo(70, 0);
        expect(part(el, '.clip').getBoundingClientRect().width).toBeCloseTo(280, 0);
        window.dispatchEvent(new MouseEvent('mousemove', at(el, 1.6, 0.5)));
        expect(el.position).toBe(100);
        window.dispatchEvent(new MouseEvent('mouseup'));
        window.dispatchEvent(new MouseEvent('mousemove', at(el, 0.1, 0.5)));
        expect(el.position).toBe(100);
        expect(seen.length).toBe(3);
        expect(seen.at(-1)).toBe(100);
    });

    it('follows the pointer down the box when vertical, and stops following the earlier drag when pressed again', async () => {
        const el = await slider('orientation="vertical"');
        const seen: number[] = [];
        el.addEventListener('position-change', (e) => seen.push((e as CustomEvent<number>).detail));
        el.dispatchEvent(new MouseEvent('mousedown', { ...at(el, 0.9, 0.25), bubbles: true }));
        expect(el.position).toBeCloseTo(25, 0);
        el.dispatchEvent(new MouseEvent('mousedown', { ...at(el, 0.1, 0.5), bubbles: true }));
        seen.length = 0;
        window.dispatchEvent(new MouseEvent('mousemove', at(el, 0.5, 0.8)));
        expect(el.position).toBeCloseTo(80, 0);
        expect(seen).toHaveLength(1);
        window.dispatchEvent(new MouseEvent('mouseup'));
    });

    it('follows a finger the same way and keeps the page from scrolling', async () => {
        const el = await slider();
        const start = new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: el, ...at(el, 0.4, 0.5) })], bubbles: true, cancelable: true });
        el.dispatchEvent(start);
        expect(start.defaultPrevented).toBe(true);
        expect(el.position).toBeCloseTo(40, 0);
        window.dispatchEvent(new TouchEvent('touchmove', { touches: [new Touch({ identifier: 1, target: el, ...at(el, 0.9, 0.5) })] }));
        expect(el.position).toBeCloseTo(90, 0);
        window.dispatchEvent(new TouchEvent('touchend', { touches: [] }));
    });

    it('moves by one with the arrows, Up and Down following the orientation, and to the ends with Home and End', async () => {
        const el = await slider('position="50"');
        const press = async (key: string) => {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            range(el).dispatchEvent(event);
            await el.updateComplete;
            return event.defaultPrevented;
        };

        expect(await press('ArrowRight')).toBe(true);
        expect(el.position).toBe(51);
        await press('ArrowLeft');
        await press('ArrowLeft');
        expect(el.position).toBe(49);
        await press('ArrowUp');
        expect(el.position).toBe(50);
        await press('ArrowDown');
        expect(el.position).toBe(49);
        await press('End');
        expect(el.position).toBe(100);
        await press('ArrowRight');
        expect(el.position).toBe(100);
        await press('Home');
        expect(el.position).toBe(0);
        expect(await press('a')).toBe(false);

        el.orientation = 'vertical';
        await el.updateComplete;
        await press('ArrowDown');
        expect(el.position).toBe(1);
        await press('ArrowUp');
        await press('ArrowUp');
        expect(el.position).toBe(0);
    });

    it('describes the handle to assistive tech: a localised name, the split in words and the orientation', async () => {
        const el = await slider('position="30" locale="de"');
        expect(range(el).getAttribute('aria-label')).toBe('Vergleichsregler');
        expect(range(el).getAttribute('aria-valuetext')).toBe('30% before, 70% after');
        expect(range(el).value).toBe('30');
        expect(range(el).getAttribute('aria-orientation')).toBe('horizontal');
        expect(part(el, '.handle').getAttribute('aria-hidden')).toBe('true');
    });

    it('shows a caption in each top corner only when one is given, truncating long ones', async () => {
        const none = await slider();
        expect(none.shadowRoot!.querySelectorAll('.label')).toHaveLength(0);

        const el = await slider('before-label="Original" after-label="An exceedingly long caption that cannot possibly fit"', 'width:300px');
        const box = el.getBoundingClientRect();
        const start = part(el, '.label.start').getBoundingClientRect();
        const end = part(el, '.label.end').getBoundingClientRect();

        expect(start.left - box.left).toBe(8);
        expect(start.top - box.top).toBe(8);
        expect(box.right - end.right).toBe(8);
        expect(end.width).toBeLessThanOrEqual(200);
        expect(getComputedStyle(part(el, '.label.end')).textOverflow).toBe('ellipsis');
    });

    it('shows a position outside 0-100 clamped, and keeps the before image sized to the box when the box resizes', async () => {
        const el = await slider('position="150"');
        expect(part(el, '.clip').getBoundingClientRect().width).toBe(400);

        el.position = 50;
        el.style.width = '200px';
        await frame();
        await frame();
        await el.updateComplete;
        expect(part(el, '.clip').getBoundingClientRect().width).toBe(100);
        expect(part(el, '.before').getBoundingClientRect().width).toBe(200);
    });
});
