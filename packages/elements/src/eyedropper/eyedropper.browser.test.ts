import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeEyedropper } from './index.js';

const button = (el: Element) => el.shadowRoot!.querySelector('button')!;
const first = (page: HTMLElement) => page.querySelector<GeEyedropper>('ge-eyedropper')!;
const noNativeApi = () => vi.stubGlobal('EyeDropper', undefined);

/** A canvas that is red on the left half and blue on the right half, the way a real swatch strip is split. */
const swatch = (page: HTMLElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    canvas.style.cssText = 'display:block;width:200px;height:100px';
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(100, 0, 100, 100);
    page.append(canvas);
    return canvas;
};
const log = (el: GeEyedropper) => {
    const events: string[] = [];
    for (const name of ['pick-start', 'color-pick', 'pick-cancel']) {
        el.addEventListener(name, (event) => events.push(`${name}${(event as CustomEvent<string | undefined>).detail ? `:${(event as CustomEvent<string>).detail}` : ''}`));
    }
    return events;
};
const clickAt = (target: Element, fx: number, fy: number) => {
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width * fx, clientY: rect.top + rect.height * fy }));
};

afterEach(() => vi.unstubAllGlobals());

describe('ge-eyedropper', () => {
    it('uses the native EyeDropper: announces the start, shows it is pressed, and reports the hex or a cancel', async () => {
        let finish: (hex: string) => void = () => {};
        let outcome: 'pick' | 'dismiss' = 'pick';
        vi.stubGlobal('EyeDropper', class {
            open() {
                return new Promise<{ sRGBHex: string }>((resolve, reject) => {
                    finish = (hex) => (outcome === 'pick' ? resolve({ sRGBHex: hex }) : reject(new DOMException('closed', 'AbortError')));
                });
            }
        });
        const page = await mount('<ge-eyedropper></ge-eyedropper>');
        const el = first(page);
        const events = log(el);

        button(el).click();
        await el.updateComplete;
        expect(button(el).getAttribute('aria-pressed')).toBe('true');
        button(el).click();
        finish('#12ab34');
        await expect.poll(() => events).toEqual(['pick-start', 'color-pick:#12ab34']);
        await el.updateComplete;
        expect(button(el).getAttribute('aria-pressed')).toBe('false');

        outcome = 'dismiss';
        button(el).click();
        finish('#000000');
        await expect.poll(() => events).toEqual(['pick-start', 'color-pick:#12ab34', 'pick-start', 'pick-cancel']);
    });

    it('samples the fallback target under the pointer, using the image pixel rather than the screen pixel', async () => {
        noNativeApi();
        const page = await mount('<ge-eyedropper></ge-eyedropper>');
        const el = first(page);
        const canvas = swatch(page);
        canvas.style.width = '150px';
        canvas.style.height = '75px';
        canvas.getContext('2d')!.fillStyle = '#0000ff';
        canvas.getContext('2d')!.fillRect(99, 0, 101, 100);
        el.fallbackTarget = canvas;
        await el.updateComplete;
        const events = log(el);

        await el.pick();
        expect(canvas.style.cursor).toBe('crosshair');
        clickAt(canvas, 0.75, 0.5);
        await el.updateComplete;
        expect(events).toEqual(['pick-start', 'color-pick:#0000ff']);
        expect(canvas.style.cursor).toBe('');

        // Screen pixel 74 of 150 is source pixel 98.67, which is the red pixel just left of the edge at 99.
        await el.pick();
        canvas.dispatchEvent(new MouseEvent('click', { clientX: canvas.getBoundingClientRect().left + 74, clientY: canvas.getBoundingClientRect().top + 10 }));
        expect(events.at(-1)).toBe('color-pick:#ff0000');
    });

    it('treats a click outside the target as a cancel, leaves the page scrollable, and follows a drag to the last pixel it crossed', async () => {
        noNativeApi();
        const page = await mount('<ge-eyedropper></ge-eyedropper>');
        const el = first(page);
        const canvas = swatch(page);
        el.fallbackTarget = canvas;
        await el.updateComplete;
        const events = log(el);

        await el.pick();
        expect(document.body.style.overflow).toBe('');
        clickAt(canvas, 1.5, 0.5);
        expect(events).toEqual(['pick-start', 'pick-cancel']);

        // A touch release carries no position of its own, so the pixel the finger last crossed is the answer.
        const rect = canvas.getBoundingClientRect();
        await el.pick();
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 150, clientY: rect.top + 50 }));
        canvas.dispatchEvent(new Event('touchend'));
        expect(events.at(-1)).toBe('color-pick:#0000ff');

        const removed = vi.spyOn(window, 'removeEventListener');
        await el.pick();
        clickAt(canvas, 0.25, 0.5);
        expect(removed.mock.calls.map(([type]) => type)).toContain('mousemove');
        removed.mockRestore();
    });

    it('cancels fallback sampling with Escape and only then, and stays one session at a time', async () => {
        noNativeApi();
        const page = await mount('<ge-eyedropper></ge-eyedropper>');
        const el = first(page);
        const canvas = swatch(page);
        el.fallbackTarget = canvas;
        await el.updateComplete;
        const events = log(el);

        await el.pick();
        await el.pick();
        await userEvent.keyboard('{Escape}');
        await el.updateComplete;

        expect(events).toEqual(['pick-start', 'pick-cancel']);
        expect(button(el).getAttribute('aria-pressed')).toBe('false');
        clickAt(canvas, 0.5, 0.5);
        expect(events).toEqual(['pick-start', 'pick-cancel']);
    });

    it('is disabled with an explanation when nothing can sample, and when asked to be', async () => {
        noNativeApi();
        const page = await mount('<ge-eyedropper></ge-eyedropper><ge-eyedropper disabled></ge-eyedropper>');
        const [bare, off] = page.querySelectorAll<GeEyedropper>('ge-eyedropper') as unknown as [GeEyedropper, GeEyedropper];
        expect([button(bare).disabled, button(bare).title]).toEqual([true, 'Eyedropper not supported in this browser']);

        bare.fallbackTarget = swatch(page);
        off.fallbackTarget = swatch(page);
        await Promise.all([bare.updateComplete, off.updateComplete]);
        expect([button(bare).disabled, button(bare).title, button(off).disabled]).toEqual([false, 'Pick color', true]);

        const events = log(off);
        await off.pick();
        expect(events).toEqual([]);
    });

    it('shows the label beside the icon in the button variant, in the page language and direction', async () => {
        const page = await mount('<ge-eyedropper variant="button" locale="he"></ge-eyedropper><ge-eyedropper label="Grab"></ge-eyedropper>');
        const [hebrew, custom] = page.querySelectorAll<GeEyedropper>('ge-eyedropper') as unknown as [GeEyedropper, GeEyedropper];

        expect(button(hebrew).textContent!.trim()).toBe('בחר צבע');
        expect([button(hebrew).dir, button(hebrew).getAttribute('aria-label')]).toEqual(['rtl', 'בחר צבע']);
        expect([button(custom).textContent!.trim(), button(custom).getAttribute('aria-label')]).toEqual(['', 'Grab']);
        expect(button(hebrew).getBoundingClientRect().width).toBeGreaterThan(button(custom).getBoundingClientRect().width);
        expect(button(custom).getBoundingClientRect().width).toBe(36);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations', async () => {
            const page = await mount('<ge-eyedropper variant="button"></ge-eyedropper><ge-eyedropper></ge-eyedropper>');
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
