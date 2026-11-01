import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeSlider } from './slider.js';

const first = (page: HTMLElement) => page.querySelector<GeSlider>('ge-slider')!;
const part = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const WIDTH = 200;
const FRAME = `<div style="width: ${WIDTH}px">`;
/** Pointer X at a fraction of the slider's width, wherever the page has put it. */
const at = (el: Element, fraction: number) => {
    const rect = part(el, '.root').getBoundingClientRect();
    return rect.left + rect.width * fraction;
};
const mouse = (target: EventTarget, type: string, clientX: number) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX }));
const touch = (target: Element, type: string, clientX: number) => {
    const point = new Touch({ identifier: 1, target, clientX, clientY: 5 });
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [point], changedTouches: [point] }));
};
const record = (el: Element) => {
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    return events;
};

describe('ge-slider', () => {
    it('jumps to the pressed spot on the track, follows the drag clamped to the ends, and announces change once on release', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume"></ge-slider></div>`);
        const slider = first(page);
        const events = record(slider);

        mouse(part(slider, '.track'), 'mousedown', at(slider, 0.25));
        expect(slider.value).toBe(25);
        mouse(document, 'mousemove', at(slider, 0.6));
        expect(slider.value).toBe(60);
        mouse(document, 'mousemove', at(slider, 3));
        expect(slider.value).toBe(100);
        mouse(document, 'mousemove', at(slider, -2));
        expect(slider.value).toBe(0);
        mouse(document, 'mouseup', at(slider, -2));
        mouse(document, 'mousemove', at(slider, 0.5));

        expect(slider.value).toBe(0);
        expect(events).toEqual(['input', 'input', 'input', 'input', 'change']);
    });

    it('drags from the thumb without jumping, and snaps to the step grid inside a custom range', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Temp" min="5" max="15" step="2.5" value="10"></ge-slider></div>`);
        const slider = first(page);

        mouse(part(slider, '.thumb'), 'mousedown', at(slider, 0.9));
        expect(slider.value).toBe(10);
        mouse(document, 'mousemove', at(slider, 0.84));
        expect(slider.value).toBe(12.5);
        mouse(document, 'mouseup', 0);

        expect(slider.rendered).toBe(12.5);
    });

    it('mirrors pointer position, fill and thumb in right-to-left text', async () => {
        const page = await mount(`<div dir="rtl">${FRAME}<ge-slider aria-label="Volume" value="25"></ge-slider></div></div>`);
        const slider = first(page);
        const root = part(slider, '.root').getBoundingClientRect();

        expect(part(slider, '.thumb').getBoundingClientRect().left + part(slider, '.thumb').getBoundingClientRect().width / 2).toBeCloseTo(root.right - root.width * 0.25, 0);
        mouse(part(slider, '.track'), 'mousedown', at(slider, 0.9));
        mouse(document, 'mouseup', 0);

        expect(slider.value).toBe(10);
    });

    it('slides with a finger and announces change when it lifts', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume"></ge-slider></div>`);
        const slider = first(page);
        const events = record(slider);

        touch(part(slider, '.root'), 'touchstart', at(slider, 0.1));
        touch(document.body, 'touchmove', at(slider, 0.7));
        expect(slider.value).toBe(70);
        touch(document.body, 'touchend', at(slider, 0.7));
        touch(document.body, 'touchmove', at(slider, 0.2));

        expect([slider.value, events]).toEqual([70, ['input', 'input', 'change']]);
    });

    it('announces a change made through the native range input once, as a screen reader would make it', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume"></ge-slider></div>`);
        const slider = first(page);
        const events = record(slider);
        const input = part(slider, 'input') as HTMLInputElement;

        input.value = '42';
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

        expect([slider.value, events]).toEqual([42, ['input']]);
    });

    it('is a tab stop that the keys move, announcing each change once and nothing at the end of the range', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume" value="50" step="5"></ge-slider></div>`);
        const slider = first(page);
        const events = record(slider);

        await userEvent.tab();
        await userEvent.keyboard('{ArrowRight}');
        expect(slider.value).toBe(55);
        await userEvent.keyboard('{ArrowDown}{ArrowLeft}');
        expect(slider.value).toBe(45);
        await userEvent.keyboard('{PageUp}');
        expect(slider.value).toBe(95);
        await userEvent.keyboard('{End}{End}');
        expect(slider.value).toBe(100);
        await userEvent.keyboard('{Home}');
        expect(slider.value).toBe(0);
        await userEvent.keyboard('{PageDown}');

        expect(slider.value).toBe(0);
        expect(events.filter((e) => e === 'input')).toHaveLength(6);
        expect(events.filter((e) => e === 'change')).toHaveLength(6);
    });

    it('swaps Left and Right in right-to-left text but never Up and Down', async () => {
        const page = await mount(`<div dir="rtl">${FRAME}<ge-slider aria-label="Volume" value="50"></ge-slider></div></div>`);
        const slider = first(page);

        await userEvent.tab();
        await userEvent.keyboard('{ArrowLeft}');
        expect(slider.value).toBe(51);
        await userEvent.keyboard('{ArrowRight}{ArrowRight}');
        expect(slider.value).toBe(49);
        await userEvent.keyboard('{ArrowUp}');
        expect(slider.value).toBe(50);
    });

    it('shows a value outside the range or off the grid as the nearest allowed one', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="a" value="250"></ge-slider><ge-slider aria-label="b" value="12" step="5"></ge-slider><ge-slider aria-label="c" value="-4"></ge-slider></div>`);

        expect([...page.querySelectorAll<GeSlider>('ge-slider')].map((slider) => slider.rendered)).toEqual([100, 10, 0]);
        expect(part(first(page), '.fill').style.width).toBe('100%');
    });

    it('ignores pointer, touch and keys while disabled or in a disabled fieldset', async () => {
        const page = await mount(`
            ${FRAME}<ge-slider id="off" disabled aria-label="a" value="30"></ge-slider>
            <fieldset disabled><ge-slider id="fs" aria-label="b" value="30"></ge-slider></fieldset></div>`);
        const all = ['off', 'fs'].map((id) => page.querySelector<GeSlider>(`#${id}`)!);

        for (const slider of all) {
            mouse(part(slider, '.track'), 'mousedown', at(slider, 0.9));
            touch(part(slider, '.root'), 'touchstart', at(slider, 0.9));
            part(slider, 'input').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        }

        expect(all.map((slider) => slider.value)).toEqual([30, 30]);
    });

    it('stops listening to the document when it is removed mid-drag', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume"></ge-slider></div>`);
        const slider = first(page);
        const events = record(slider);

        mouse(part(slider, '.track'), 'mousedown', at(slider, 0.2));
        slider.remove();
        mouse(document, 'mousemove', 0);
        mouse(document, 'mouseup', 0);

        expect(events).toEqual(['input']);
    });

    it('exposes a named slider with its value, range and spoken text, named by a ge-label elsewhere in the page', async () => {
        const page = await mount(`
            <ge-label id="vol-label" for="vol">Volume</ge-label>
            ${FRAME}<ge-slider id="vol" value="1234" max="5000" locale="en"></ge-slider></div>`);
        await first(page).updateComplete;
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const frameId = frameTree.childFrames?.[0]?.frame.id;
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId });
        const slider = nodes.find((n) => n.role?.value === 'slider');
        const read = Object.fromEntries((slider?.properties ?? []).map((p) => [p.name, p.value.value]));

        expect(part(first(page), 'input').getAttribute('aria-valuetext')).toBe('1,234');
        expect(slider?.name?.value).toBe('Volume');
        // Chromium reports the plain number as `valuetext` for a native range, so the spoken text is asserted on the attribute above.
        expect([slider?.value?.value, read.valuemin, read.valuemax]).toEqual([1234, 0, 5000]);
    });

    it('scales the track and thumb with its density token', async () => {
        const page = await mount(`${FRAME}<ge-slider aria-label="a"></ge-slider></div>${FRAME}<ge-slider aria-label="b" style="--density-slider: 1.5"></ge-slider></div>`);
        const sizes = [...page.querySelectorAll('ge-slider')].map((s) => [part(s, '.track').getBoundingClientRect().height, part(s, '.thumb').getBoundingClientRect().width]);

        expect(sizes).toEqual([[6, 16], [9, 24]]);
    });

    it('submits its snapped value under its name and a form reset restores the markup', async () => {
        const page = await mount(`<form>${FRAME}<ge-slider name="vol" aria-label="a" value="30"></ge-slider></div></form>`);
        const form = page.querySelector('form')!;
        const slider = first(page);

        expect(new FormData(form).get('vol')).toBe('30');
        mouse(part(slider, '.track'), 'mousedown', at(slider, 0.8));
        mouse(document, 'mouseup', 0);
        await slider.updateComplete;
        expect(new FormData(form).get('vol')).toBe('80');

        form.reset();
        await slider.updateComplete;
        expect([slider.value, new FormData(form).get('vol')]).toEqual([30, '30']);
    });

    it.each(['light', 'dark'])('has no accessibility violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`${FRAME}<ge-slider aria-label="Volume" value="40"></ge-slider><ge-slider aria-label="Locked" disabled></ge-slider></div>`);
        expect((await axe.run(page)).violations).toEqual([]);
    });
});
