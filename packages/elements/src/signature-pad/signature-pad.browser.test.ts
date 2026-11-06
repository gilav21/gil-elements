import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeSignaturePad } from './signature-pad.js';

/** A saved signature as a form would hold it: a real 1x1 PNG data URL. */
const SAVED_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
// The host draws no box of its own, so the width belongs to the wrapper it sits in.
async function pad(attrs = '', style = 'width:300px'): Promise<GeSignaturePad> {
    const page = await mount(`<form><div class="frame" style="${style}"><ge-signature-pad ${attrs}></ge-signature-pad></div></form>`);
    const el = page.querySelector<GeSignaturePad>('ge-signature-pad')!;
    await el.updateComplete;
    await frame();
    await frame();
    return el;
}
const canvas = (el: GeSignaturePad) => el.shadowRoot!.querySelector<HTMLCanvasElement>('canvas')!;
const button = (el: GeSignaturePad, slot: string) => el.shadowRoot!.querySelector<HTMLElement & { disabled: boolean }>(`[data-slot="signature-pad-${slot}"]`)!;
const pointer = (el: GeSignaturePad, type: string, x: number, y: number, extra: PointerEventInit = {}) => {
    const rect = canvas(el).getBoundingClientRect();
    return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: rect.left + x, clientY: rect.top + y, ...extra });
};
async function draw(el: GeSignaturePad, points: readonly (readonly [number, number])[], extra: PointerEventInit = {}) {
    const [first, ...rest] = points;
    canvas(el).dispatchEvent(pointer(el, 'pointerdown', first![0], first![1], extra));
    for (const [x, y] of rest) canvas(el).dispatchEvent(pointer(el, 'pointermove', x, y, extra));
    const last = points.at(-1)!;
    canvas(el).dispatchEvent(pointer(el, 'pointerup', last[0], last[1], extra));
    await el.updateComplete;
}
const ink = (el: GeSignaturePad) => {
    const surface = canvas(el);
    const { data } = surface.getContext('2d')!.getImageData(0, 0, surface.width, surface.height);
    let total = 0;
    for (let alpha = 3; alpha < data.length; alpha += 4) if (data[alpha]! > 0) total++;
    return total;
};
const record = (el: Element) => {
    const events: string[] = [];
    for (const type of ['input', 'change', 'stroke-end']) el.addEventListener(type, () => events.push(type));
    return events;
};
const SQUIGGLE: [number, number][] = [[10, 10], [60, 80], [120, 20], [200, 90]];

describe('ge-signature-pad', () => {
    it('is a bordered box with the given height and the width of its container, with Undo and Clear below', async () => {
        const el = await pad('height="120"', 'width:320px');
        const box = el.shadowRoot!.querySelector('.pad')!;
        expect(Math.round(canvas(el).getBoundingClientRect().height)).toBe(120);
        expect(Math.round(box.getBoundingClientRect().width)).toBe(320);
        expect(getComputedStyle(box).borderTopWidth).toBe('1px');
        expect(getComputedStyle(canvas(el)).touchAction).toBe('none');
        expect(canvas(el).getAttribute('role')).toBe('img');
        expect(canvas(el).getAttribute('aria-label')).toBe('Signature');
        expect(canvas(el).tabIndex).toBe(0);
        expect(button(el, 'undo').textContent!.trim()).toBe('Undo');
        expect(button(el, 'clear').textContent!.trim()).toBe('Clear');
        expect(button(el, 'undo').disabled && button(el, 'clear').disabled).toBe(true);
    });

    it('records a stroke normalised to the pad, paints it, and announces a PNG when the stroke ends', async () => {
        const el = await pad();
        const events = record(el);
        await draw(el, SQUIGGLE);

        const { width, height } = canvas(el).getBoundingClientRect();
        expect(el.strokes).toHaveLength(1);
        expect(el.strokes[0]!.map((p) => [Number(p.x.toFixed(4)), Number(p.y.toFixed(4))])).toEqual(SQUIGGLE.map(([x, y]) => [Number((x / width).toFixed(4)), Number((y / height).toFixed(4))]));
        expect(ink(el)).toBeGreaterThan(0);
        expect(el.value).toMatch(/^data:image\/png;base64,/);
        expect(events).toEqual(['input', 'change', 'stroke-end']);
        expect(button(el, 'undo').disabled).toBe(false);
    });

    it('draws a lone tap as a dot, and ignores points too close together', async () => {
        const el = await pad();
        await draw(el, [[50, 50]]);
        expect(el.strokes[0]).toHaveLength(1);
        expect(ink(el)).toBeGreaterThan(0);
        await draw(el, [[100, 100], [100.1, 100.1], [100.2, 100.1], [160, 100]]);
        expect(el.strokes[1]).toHaveLength(2);
    });

    it('draws in the pen colour and width, current colour by default', async () => {
        const red = await pad('pen-color="rgb(255, 0, 0)" pen-width="6"');
        await draw(red, [[10, 50], [200, 50]]);
        const rect = canvas(red);
        const ratio = rect.width / rect.getBoundingClientRect().width;
        const middle = rect.getContext('2d')!.getImageData(Math.round(100 * ratio), Math.round(50 * ratio), 1, 1).data;
        expect([middle[0], middle[1], middle[2]]).toEqual([255, 0, 0]);
        const thickness = [...Array.from({ length: 12 }, (_, i) => i)].filter((dy) => rect.getContext('2d')!.getImageData(Math.round(100 * ratio), Math.round((44 + dy) * ratio), 1, 1).data[3]! > 128).length;
        expect(thickness).toBeGreaterThanOrEqual(5);
        expect(thickness).toBeLessThanOrEqual(8);

        const plain = await pad();
        plain.parentElement!.style.color = 'rgb(0, 128, 0)';
        await draw(plain, [[10, 50], [200, 50]]);
        const dot = canvas(plain).getContext('2d')!.getImageData(Math.round(100 * (canvas(plain).width / 300)), Math.round(50 * (canvas(plain).width / 300)), 1, 1).data;
        expect([dot[0], dot[1], dot[2]]).toEqual([0, 128, 0]);
    });

    it('undoes the last stroke only, and clears everything, announcing each', async () => {
        const el = await pad();
        await draw(el, [[10, 10], [40, 40]]);
        await draw(el, [[50, 50], [70, 70]]);
        const both = el.value;
        const events = record(el);

        button(el, 'undo').click();
        await el.updateComplete;
        expect(el.strokes).toHaveLength(1);
        expect(el.value).not.toBe(both);
        expect(el.value).toMatch(/^data:image\/png/);
        expect(events).toEqual(['input', 'change']);

        button(el, 'clear').click();
        await el.updateComplete;
        expect(el.strokes).toHaveLength(0);
        expect(el.value).toBeNull();
        expect(ink(el)).toBe(0);
        expect(button(el, 'clear').disabled).toBe(true);
        el.undo();
        expect(events).toHaveLength(4);
    });

    it('draws on top of an image written in, which Undo leaves and Clear removes, and does not announce the write', async () => {
        const el = await pad();
        const events = record(el);
        el.value = SAVED_PNG;
        await vi.waitFor(() => expect(el.hasSignature).toBe(true));
        await el.updateComplete;
        expect(events).toEqual([]);
        expect(button(el, 'clear').disabled).toBe(false);
        expect(button(el, 'undo').disabled).toBe(true);

        await draw(el, SQUIGGLE);
        expect(el.strokes).toHaveLength(1);
        el.undo();
        expect(el.hasSignature).toBe(true);
        expect(el.strokes).toHaveLength(0);
        el.clear();
        expect(el.hasSignature).toBe(false);
        expect(el.value).toBeNull();
    });

    it('keeps live strokes when its own value comes back, but takes a different one, and blank when emptied', async () => {
        const el = await pad();
        await draw(el, SQUIGGLE);
        // The commit sets `value`, and the pad sees its own echo: it must not turn the live strokes into a flat image once that loads.
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(el.strokes).toHaveLength(1);

        el.value = SAVED_PNG;
        await vi.waitFor(() => expect(el.strokes).toHaveLength(0));
        expect(el.hasSignature).toBe(true);
        el.value = null;
        await el.updateComplete;
        expect(el.hasSignature).toBe(false);
        expect(ink(el)).toBe(0);

        // An image still loading when the value moves on must not appear afterwards.
        el.value = SAVED_PNG;
        await el.updateComplete;
        el.value = null;
        await el.updateComplete;
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(el.hasSignature).toBe(false);
    });

    it('draws at the screen pixel ratio so a signature is sharp on a dense display', async () => {
        const original = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
        Object.defineProperty(globalThis, 'devicePixelRatio', { value: 3, configurable: true });
        try {
            const el = await pad('height="100"', 'width:200px');
            await draw(el, [[20, 50], [100, 50]]);
            expect(canvas(el).width).toBe(Math.round(198 * 3));
            expect(canvas(el).height).toBe(300);
            expect(ink(el)).toBeGreaterThan(0);
        } finally {
            if (original) Object.defineProperty(globalThis, 'devicePixelRatio', original);
            else Reflect.deleteProperty(globalThis, 'devicePixelRatio');
        }
    });

    it('gives the signature as JPEG or as line-art SVG, and nothing while blank', async () => {
        const el = await pad('pen-color="rgb(10, 20, 30)" pen-width="3"');
        expect(el.toDataURL()).toBeNull();
        expect(el.toDataURL('svg')).toBeNull();
        await draw(el, SQUIGGLE);
        expect(el.toDataURL('image/jpeg')).toMatch(/^data:image\/jpeg/);
        expect(el.value).toMatch(/^data:image\/png/);
        const svg = decodeURIComponent(el.toDataURL('svg')!.replace('data:image/svg+xml;utf8,', ''));
        expect(svg).toContain('stroke="rgb(10, 20, 30)"');
        expect(svg).toContain('stroke-width="3"');
        expect(svg).toMatch(/<path d="M10,10Q/);
    });

    it('stays sharp when resized: strokes are redrawn from the normalised points at the new size, at the screen pixel ratio', async () => {
        const el = await pad('', 'width:200px');
        // 200px box less its 1px border on each side.
        await draw(el, [[20, 90], [100, 90]]);
        const inkAt = (x: number) => {
            const ratio = canvas(el).width / canvas(el).getBoundingClientRect().width;
            return canvas(el).getContext('2d')!.getImageData(Math.round(x * ratio), Math.round(90 * ratio), 1, 1).data[3]!;
        };
        expect(inkAt(60)).toBeGreaterThan(0);
        expect(inkAt(150)).toBe(0);

        el.parentElement!.style.width = '400px';
        await vi.waitFor(() => expect(Math.round(canvas(el).getBoundingClientRect().width)).toBe(398));
        await vi.waitFor(() => expect(canvas(el).width).toBe(Math.round(398 * (globalThis.devicePixelRatio || 1))));
        await frame();
        // The stroke ran from 10% to 50.5% of the pad, so it now ends near x = 201 and passes x = 150.
        expect(inkAt(150)).toBeGreaterThan(0);
        expect(inkAt(300)).toBe(0);
    });

    it('abandons a stroke when a second finger lands, and draws for a primary touch', async () => {
        const el = await pad();
        const touch = { pointerType: 'touch' } as const;
        canvas(el).dispatchEvent(pointer(el, 'pointerdown', 10, 10, { ...touch, pointerId: 1 }));
        canvas(el).dispatchEvent(pointer(el, 'pointermove', 50, 50, { ...touch, pointerId: 1 }));
        canvas(el).dispatchEvent(pointer(el, 'pointerdown', 120, 20, { ...touch, pointerId: 2, isPrimary: false }));
        canvas(el).dispatchEvent(pointer(el, 'pointermove', 200, 90, { ...touch, pointerId: 1 }));
        canvas(el).dispatchEvent(pointer(el, 'pointerup', 200, 90, { ...touch, pointerId: 1 }));
        expect(el.strokes).toHaveLength(0);
        expect(el.value).toBeNull();

        await draw(el, SQUIGGLE, { ...touch, pointerId: 3 });
        expect(el.strokes).toHaveLength(1);
    });

    it('follows only the pointer that began the stroke, and ends the stroke when the pointer leaves or is cancelled', async () => {
        const el = await pad();
        const events = record(el);
        canvas(el).dispatchEvent(pointer(el, 'pointermove', 30, 30));
        expect(el.strokes).toHaveLength(0);
        canvas(el).dispatchEvent(pointer(el, 'pointerdown', 10, 10));
        canvas(el).dispatchEvent(pointer(el, 'pointermove', 90, 90, { pointerId: 7 }));
        expect(el.strokes[0]).toHaveLength(1);
        canvas(el).dispatchEvent(pointer(el, 'pointermove', 90, 90));
        canvas(el).dispatchEvent(pointer(el, 'pointerleave', 90, 90));
        expect(events.filter((e) => e === 'stroke-end')).toHaveLength(1);
        canvas(el).dispatchEvent(pointer(el, 'pointerup', 90, 90));
        expect(events.filter((e) => e === 'stroke-end')).toHaveLength(1);
    });

    it('does not draw while disabled, and hides its buttons on request', async () => {
        const el = await pad('disabled');
        await draw(el, SQUIGGLE);
        expect(el.strokes).toHaveLength(0);
        expect(getComputedStyle(el.shadowRoot!.querySelector('.pad')!).opacity).toBe('0.5');
        expect(button(el, 'clear').disabled).toBe(true);
        const bare = await pad('hide-controls clear-label="Erase"');
        expect(bare.shadowRoot!.querySelector('.controls')).toBeNull();
        const labelled = await pad('clear-label="Erase" undo-label="Back" aria-label="Sign here"');
        expect(button(labelled, 'clear').textContent!.trim()).toBe('Erase');
        expect(button(labelled, 'undo').textContent!.trim()).toBe('Back');
        expect(canvas(labelled).getAttribute('aria-label')).toBe('Sign here');
    });

    it('takes part in a form by name, resets, and follows a disabled fieldset', async () => {
        const page = await mount('<form><ge-signature-pad name="sig"></ge-signature-pad></form>');
        const el = page.querySelector<GeSignaturePad>('ge-signature-pad')!;
        await el.updateComplete;
        await frame();
        expect(new FormData(page.querySelector('form')!).get('sig')).toBe('');
        await draw(el, SQUIGGLE);
        expect(String(new FormData(page.querySelector('form')!).get('sig'))).toMatch(/^data:image\/png/);
        page.querySelector('form')!.reset();
        await el.updateComplete;
        expect(el.value).toBeNull();
        expect(el.hasSignature).toBe(false);

        const locked = await mount('<fieldset disabled><ge-signature-pad></ge-signature-pad></fieldset>');
        const inner = locked.querySelector<GeSignaturePad>('ge-signature-pad')!;
        await inner.updateComplete;
        await draw(inner, SQUIGGLE);
        expect(inner.strokes).toHaveLength(0);
    });

    it('draws the other variants and passes an axe check in both themes', async () => {
        const underline = await pad('variant="underline"');
        const box = getComputedStyle(underline.shadowRoot!.querySelector('.pad')!);
        expect(box.borderTopWidth).toBe('0px');
        expect(box.borderBottomWidth).toBe('1px');
        const ghost = await pad('variant="ghost"');
        expect(getComputedStyle(ghost.shadowRoot!.querySelector('.pad')!).borderBottomWidth).toBe('0px');

        const el = await pad();
        await draw(el, SQUIGGLE);
        for (const theme of ['light', 'dark'] as const) {
            useTheme(theme);
            await new Promise((resolve) => setTimeout(resolve, 300));
            expect((await axe.run(el)).violations).toEqual([]);
        }
        useTheme('light');
    });
});
