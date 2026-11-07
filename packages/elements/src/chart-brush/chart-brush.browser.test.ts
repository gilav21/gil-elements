import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { BrushSelection, GeChartBrush } from './index.js';

const brush = async (attrs = '', selection: BrushSelection | null = null) => {
    const page = await mount(`<div style="width:400px"><ge-chart-brush ${attrs}></ge-chart-brush></div>`);
    const el = page.querySelector<GeChartBrush>('ge-chart-brush')!;
    el.selection = selection;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const svgBox = (el: Element) => root(el).querySelector('svg')!.getBoundingClientRect();
const track = (el: Element) => root(el).querySelector<SVGRectElement>('.track')!;
const band = (el: Element) => root(el).querySelector<SVGRectElement>('.band');
const handles = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('.handle')];
const record = (el: Element) => {
    const seen: (BrushSelection | null)[] = [];
    el.addEventListener('selection-change', (e) => seen.push((e as CustomEvent).detail));
    return seen;
};
const at = (el: Element, x: number) => ({ clientX: svgBox(el).left + x, clientY: svgBox(el).top + 10, bubbles: true, composed: true });
const down = (el: Element, target: Element, x: number) => target.dispatchEvent(new MouseEvent('mousedown', { ...at(el, x), cancelable: true }));
const move = (el: Element, x: number) => globalThis.dispatchEvent(new MouseEvent('mousemove', at(el, x)));
const up = (el: Element, x: number) => globalThis.dispatchEvent(new MouseEvent('mouseup', at(el, x)));
const geometry = (rect: SVGRectElement) => ({ x: Number(rect.getAttribute('x')), width: Number(rect.getAttribute('width')) });

describe('ge-chart-brush', () => {
    it('sweeps a selection out of the track, reporting every move and the release, normalised and clamped to the width', async () => {
        const el = await brush();
        const seen = record(el);
        down(el, track(el), 300);
        move(el, 120);
        await el.updateComplete;
        expect(seen).toEqual([{ start: 120, end: 300 }]);
        expect(geometry(band(el)!)).toEqual({ x: 120, width: 180 });
        move(el, 999);
        move(el, -50);
        up(el, -50);
        await el.updateComplete;
        expect(seen.slice(1)).toEqual([{ start: 300, end: 400 }, { start: 0, end: 300 }, { start: 0, end: 300 }]);
        expect(geometry(band(el)!)).toEqual({ x: 0, width: 300 });
        expect(el.current).toEqual({ start: 0, end: 300 });
    });

    it('pans the band by the pointer delta keeping its width, squashing it against a wall, without starting a new selection', async () => {
        const el = await brush('', { start: 100, end: 200 });
        const seen = record(el);
        down(el, band(el)!, 150);
        move(el, 190);
        expect(seen.at(-1)).toEqual({ start: 140, end: 240 });
        move(el, 390);
        expect(seen.at(-1)).toEqual({ start: 340, end: 400 });
        move(el, 120);
        expect(seen.at(-1)).toEqual({ start: 70, end: 170 });
        move(el, 900);
        expect(seen.at(-1)).toEqual({ start: 400, end: 400 });
        move(el, 120);
        up(el, 120);
        await el.updateComplete;
        expect(geometry(band(el)!)).toEqual({ x: 70, width: 100 });
        const outer: Event[] = [];
        el.addEventListener('mousedown', (e) => outer.push(e));
        down(el, band(el)!, 100);
        down(el, handles(el)[0]!, 70);
        up(el, 70);
        expect(outer).toHaveLength(0);
    });

    it('drags one edge with the other pinned, sorts the range when an edge crosses its partner, and the handles sit on the band edges', async () => {
        const el = await brush('', { start: 100, end: 200 });
        await el.updateComplete;
        expect(handles(el).map((h) => Number(h.getAttribute('x')) + 3)).toEqual([100, 200]);
        const seen = record(el);
        down(el, handles(el)[0]!, 100);
        move(el, 60);
        expect(seen.at(-1)).toEqual({ start: 60, end: 200 });
        move(el, 260);
        expect(seen.at(-1)).toEqual({ start: 200, end: 260 });
        up(el, 260);
        await el.updateComplete;
        expect(el.current).toEqual({ start: 200, end: 260 });
        down(el, handles(el)[1]!, 260);
        move(el, 230);
        up(el, 230);
        expect(seen.at(-1)!.start).toBe(200);
        expect(seen.at(-1)!.end).toBeCloseTo(230, 5);
    });

    it('lets the selection property seed the brush only until the first interaction, and reset hands nothing back', async () => {
        const el = await brush('', { start: 50, end: 150 });
        expect(geometry(band(el)!)).toEqual({ x: 50, width: 100 });
        el.selection = { start: 10, end: 20 };
        await el.updateComplete;
        expect(geometry(band(el)!)).toEqual({ x: 10, width: 10 });
        const seen = record(el);
        down(el, track(el), 300);
        up(el, 300);
        el.selection = { start: 5, end: 6 };
        await el.updateComplete;
        expect(geometry(band(el)!)).toEqual({ x: 300, width: 0 });
        const reset = root(el).querySelector<HTMLButtonElement>('[data-slot="chart-brush-reset"]')!;
        reset.click();
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(band(el)).toBeNull();
        expect(root(el).querySelector('[data-slot="chart-brush-reset"]')).toBeNull();
        el.selection = { start: 5, end: 6 };
        await el.updateComplete;
        expect(band(el)).toBeNull();
    });

    it('ignores moves and releases when no drag is active, and stops listening on the window once a drag ends', async () => {
        const el = await brush('', { start: 100, end: 200 });
        const seen = record(el);
        move(el, 50);
        up(el, 50);
        el.pointerMoveTo(30);
        el.end();
        expect(seen).toEqual([]);
        down(el, track(el), 10);
        up(el, 10);
        const count = seen.length;
        move(el, 300);
        up(el, 300);
        expect(seen).toHaveLength(count);
        const none = await brush();
        none.beginMove(10);
        none.beginResize('end', 10);
        move(none, 100);
        expect(record(none)).toEqual([]);
        expect(none.current).toBeNull();
    });

    it('works with touch: a touch drag selects and stops the page from scrolling', async () => {
        const el = await brush();
        const seen = record(el);
        const touch = (x: number) => new Touch({ identifier: 1, target: track(el), clientX: svgBox(el).left + x, clientY: svgBox(el).top + 10 });
        track(el).dispatchEvent(new TouchEvent('touchstart', { touches: [touch(40)], bubbles: true, cancelable: true }));
        const moved = new TouchEvent('touchmove', { touches: [touch(160)], bubbles: true, cancelable: true });
        globalThis.dispatchEvent(moved);
        expect(moved.defaultPrevented).toBe(true);
        globalThis.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
        expect(seen).toEqual([{ start: 40, end: 160 }, { start: 40, end: 160 }]);
    });

    it('maps pointer pixels into its own width, so a wider coordinate space reports stretched values', async () => {
        const el = await brush('width="800"');
        const seen = record(el);
        down(el, track(el), 200);
        move(el, 300);
        up(el, 300);
        const scale = 800 / svgBox(el).width;
        expect(seen[0]!.start).toBeCloseTo(200 * scale, 0);
        expect(seen[0]!.end).toBeCloseTo(300 * scale, 0);
        expect(seen[0]!.end).toBeLessThanOrEqual(800);
    });
});
