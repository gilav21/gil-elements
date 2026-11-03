import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeScrollArea } from './scroll-area.js';

const rows = (n: number) => Array.from({ length: n }, (_, i) => `<div style="height:2rem;white-space:nowrap">Row ${i + 1} with some text to make it wide enough to overflow sideways when asked</div>`).join('');
const AREA = (attrs: string, n: number, wide = false) => `<ge-scroll-area ${attrs} style="height:10rem;width:12rem"><div style="${wide ? 'width:40rem' : ''}">${rows(n)}</div></ge-scroll-area>`;
const part = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector);
const viewport = (el: Element) => part(el, '.viewport')!;
const settle = (el: GeScrollArea) => new Promise((resolve) => setTimeout(resolve, 50)).then(() => el.updateComplete);

describe('ge-scroll-area', () => {
    it('shows a thumb only while the content overflows, sized to the share of it that is visible', async () => {
        const page = await mount(`${AREA('id="few"', 2)}${AREA('id="many"', 20)}`);
        const few = page.querySelector<GeScrollArea>('#few')!;
        const many = page.querySelector<GeScrollArea>('#many')!;
        await Promise.all([settle(few), settle(many)]);

        expect(part(few, '.scrollbar')).toBeNull();
        const v = viewport(many);
        const thumb = part(many, '.thumb')!;
        expect(parseFloat(thumb.style.height)).toBeCloseTo((v.clientHeight / v.scrollHeight) * 100, 1);
        expect(thumb.style.top).toBe('0%');
    });

    it('moves the thumb as the content scrolls, to the end of its track at the bottom', async () => {
        const page = await mount(AREA('', 20));
        const el = page.querySelector<GeScrollArea>('ge-scroll-area')!;
        await settle(el);

        viewport(el).scrollTop = viewport(el).scrollHeight;
        await settle(el);
        const thumb = part(el, '.thumb')!;

        expect(parseFloat(thumb.style.top) + parseFloat(thumb.style.height)).toBeCloseTo(100, 1);
    });

    it('gates the thumbs by orientation: vertical, horizontal, or both with a corner', async () => {
        const page = await mount(`${AREA('id="v"', 20, true)}${AREA('id="h" orientation="horizontal"', 20, true)}${AREA('id="b" orientation="both"', 20, true)}`);
        const [v, h, b] = ['v', 'h', 'b'].map((id) => page.querySelector<GeScrollArea>(`#${id}`)!);
        await Promise.all([v, h, b].map(settle));
        const bars = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('.scrollbar')].map((s) => s.dataset.orientation);

        expect(bars(v)).toEqual(['vertical']);
        expect(bars(h)).toEqual(['horizontal']);
        expect(bars(b)).toEqual(['vertical', 'horizontal']);
        expect(part(b, '.corner')).not.toBeNull();
        expect(part(v, '.corner')).toBeNull();
    });

    it('scrolls the content when the thumb is dragged, scaled so the thumb follows the pointer', async () => {
        const page = await mount(AREA('', 20));
        const el = page.querySelector<GeScrollArea>('ge-scroll-area')!;
        await settle(el);
        const v = viewport(el);
        const thumb = part(el, '.thumb')!;
        const { x, y } = thumb.getBoundingClientRect();
        const trackStep = 20;

        thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x + 2, clientY: y + 2 }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 2, clientY: y + 2 + trackStep }));
        const dragged = v.scrollTop;
        window.dispatchEvent(new MouseEvent('mouseup'));
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x + 2, clientY: y + 2 + 2 * trackStep }));

        expect(dragged).toBeCloseTo(trackStep * (v.scrollHeight / v.clientHeight), 0);
        expect(v.scrollTop).toBe(dragged);
    });

    it('scrolls to the bottom on request, after layout, and is keyboard scrollable', async () => {
        const page = await mount(AREA('', 20));
        const el = page.querySelector<GeScrollArea>('ge-scroll-area')!;
        await settle(el);
        const v = viewport(el);

        v.focus();
        await userEvent.keyboard('{ArrowDown}');
        await settle(el);
        expect(v.scrollTop).toBeGreaterThan(0);

        el.scrollToBottom();
        await settle(el);
        expect(v.scrollTop).toBe(v.scrollHeight - v.clientHeight);
    });
});
