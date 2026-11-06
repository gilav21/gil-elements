import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeCopyTo } from './copy-to.js';

const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
let write: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
    write = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
});
afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
    if (original) Object.defineProperty(Navigator.prototype, 'clipboard', original);
    for (const badge of document.querySelectorAll('[data-slot="copy-to-indicator"]')) badge.remove();
});

const badges = () => [...document.querySelectorAll<HTMLElement>('[data-slot="copy-to-indicator"]')];
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function copyTo(attrs = 'value="sk-123"'): Promise<GeCopyTo> {
    const page = await mount(`<div style="padding:80px"><ge-copy-to ${attrs}><button style="width:120px;height:32px">Copy key</button></ge-copy-to></div>`);
    return page.querySelector('ge-copy-to')!;
}

describe('ge-copy-to', () => {
    it('copies the value as it is at the time of the click, whichever part of the content is clicked', async () => {
        const el = await copyTo();
        el.querySelector('button')!.click();
        el.value = 'sk-456';
        el.querySelector('button')!.click();

        expect(write.mock.calls).toEqual([['sk-123'], ['sk-456']]);
    });

    it('announces `copied` once the write succeeds, and only then floats the label centred 30px above the content', async () => {
        const el = await copyTo();
        let badgesWhenAnnounced = -1;
        el.addEventListener('copied', () => { badgesWhenAnnounced = badges().length; });
        el.querySelector('button')!.click();
        expect(badges()).toHaveLength(0);
        await flush();

        const [badge] = badges();
        const box = el.querySelector('button')!.getBoundingClientRect();
        const rect = badge!.getBoundingClientRect();
        expect(el.getBoundingClientRect().width).toBe(0);
        expect(badgesWhenAnnounced).toBe(0);
        expect(badge!.textContent).toBe('Copied!');
        expect(badge!.parentElement).toBe(document.body);
        expect(rect.top).toBeCloseTo(box.top - 30, 0);
        expect(rect.left + rect.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
        expect(getComputedStyle(badge!).position).toBe('fixed');
        expect(getComputedStyle(badge!).pointerEvents).toBe('none');
        expect(getComputedStyle(badge!).zIndex).toBe('9999');
    });

    it('centres the label over the union of the boxes when it wraps several things', async () => {
        const page = await mount(`<div style="padding:80px"><ge-copy-to value="x"><button style="width:60px;height:20px">A</button><button style="width:100px;height:40px;margin-left:40px">B</button></ge-copy-to></div>`);
        const [a, b] = [...page.querySelectorAll('button')].map((button) => button.getBoundingClientRect());
        page.querySelector('button')!.click();
        await flush();
        const rect = badges()[0]!.getBoundingClientRect();

        expect(rect.left + rect.width / 2).toBeCloseTo((a!.left + b!.right) / 2, 0);
        expect(rect.top).toBeCloseTo(Math.min(a!.top, b!.top) - 30, 0);
    });

    it('still shows the label, at a finite place, when it wraps only text', async () => {
        const page = await mount(`<div style="padding:80px"><ge-copy-to value="x">just text</ge-copy-to></div>`);
        page.querySelector('ge-copy-to')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await flush();
        const rect = badges()[0]!.getBoundingClientRect();

        expect(Number.isFinite(rect.top) && Number.isFinite(rect.left)).toBe(true);
        expect(rect.top).toBeCloseTo(-30, 0);
    });

    it('says it in the locale asked for, or the page\'s', async () => {
        const he = await copyTo('value="x" locale="he"');
        he.querySelector('button')!.click();
        await flush();
        expect(badges()[0]!.textContent).toBe('!הועתק');
        badges()[0]!.remove();

        const custom = await copyTo('value="x"');
        custom.locale = { ...JSON.parse('{"code":"xx","selectPlaceholder":"","noResults":"","oneTimeCode":"","previousSlide":"","nextSlide":"","close":""}'), copied: 'Done' };
        custom.querySelector('button')!.click();
        await flush();
        expect(badges()[0]!.textContent).toBe('Done');
    });

    it('removes the label after 1.5 seconds, and shows only one at a time', async () => {
        const el = await copyTo();
        el.querySelector('button')!.click();
        await flush();
        const shownAt = performance.now();
        el.querySelector('button')!.click();
        await flush();
        expect(badges()).toHaveLength(1);

        await new Promise((resolve) => setTimeout(resolve, 1200));
        expect(badges()).toHaveLength(1);
        await vi.waitFor(() => expect(badges()).toHaveLength(0), { timeout: 2000 });
        expect(performance.now() - shownAt).toBeGreaterThan(1450);
    });

    it('stays silent when the clipboard refuses, and clears a label still showing when removed', async () => {
        const el = await copyTo();
        write.mockRejectedValueOnce(new Error('denied'));
        const seen = vi.fn();
        el.addEventListener('copied', seen);
        el.querySelector('button')!.click();
        await flush();
        expect(seen).not.toHaveBeenCalled();
        expect(badges()).toHaveLength(0);

        el.querySelector('button')!.click();
        await flush();
        expect(badges()).toHaveLength(1);
        el.remove();
        expect(badges()).toHaveLength(0);
    });
});
