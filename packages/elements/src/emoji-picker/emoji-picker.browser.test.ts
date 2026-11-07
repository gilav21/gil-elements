import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import { EMOJI_CATEGORIES, emojiLabel, filterCategories, type GeEmojiPicker } from './index.js';

const frames = (n = 3) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
const content = (el: GeEmojiPicker) => el.querySelector('ge-emoji-picker-content')!;
const root = (el: GeEmojiPicker) => content(el).shadowRoot!;
const panel = (el: GeEmojiPicker) => root(el).querySelector<HTMLElement>('.panel');
const emoji = (el: GeEmojiPicker, glyph: string) => [...root(el).querySelectorAll<HTMLButtonElement>('.emoji')].find((b) => b.textContent === glyph)!;
const tab = (el: GeEmojiPicker, id: string) => root(el).querySelectorAll<HTMLButtonElement>('.tab')[EMOJI_CATEGORIES.findIndex((c) => c.id === id)]!;
const search = (el: GeEmojiPicker) => root(el).querySelector('ge-input')!.shadowRoot!.querySelector('input')!;
const headings = (el: GeEmojiPicker) => [...root(el).querySelectorAll('.heading')].map((h) => h.textContent);
const viewport = (el: GeEmojiPicker) => root(el).querySelector('ge-scroll-area')!.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;

async function picker(attrs = '', contentAttrs = ''): Promise<GeEmojiPicker> {
    const page = await mount(`<div style="padding:40px 40px 400px"><ge-emoji-picker ${attrs}><ge-emoji-picker-trigger><button type="button">Pick</button></ge-emoji-picker-trigger><ge-emoji-picker-content ${contentAttrs}></ge-emoji-picker-content></ge-emoji-picker></div>`);
    return page.querySelector('ge-emoji-picker')!;
}
const open = async (el: GeEmojiPicker) => {
    el.querySelector('button')!.click();
    await el.updateComplete;
    await content(el).updateComplete;
    await frames();
};

describe('ge-emoji-picker', () => {
    it('draws nothing until opened, then a 20rem panel 4px under the trigger with the search box, nine tabs and all categories', async () => {
        const el = await picker();
        expect(panel(el)).toBeNull();

        await open(el);
        const box = panel(el)!.getBoundingClientRect();
        const host = el.getBoundingClientRect();
        expect(box.width).toBe(320);
        expect(Math.abs(box.top - (host.bottom + 4))).toBeLessThan(1);
        expect(Math.abs(box.left - host.left)).toBeLessThan(1);
        expect(root(el).querySelectorAll('.tab')).toHaveLength(9);
        expect(headings(el)).toEqual(EMOJI_CATEGORIES.map((c) => c.name));
        expect(root(el).querySelector('ge-input')!.getAttribute('placeholder')).toBe('Search emojis...');
        expect(getComputedStyle(root(el).querySelector('.grid')!).gridTemplateColumns.split(' ')).toHaveLength(8);
    });

    it('hangs from the start edge: the left in left-to-right, the right in right-to-left', async () => {
        const el = await picker();
        el.parentElement!.dir = 'rtl';
        await open(el);
        expect(Math.abs(panel(el)!.getBoundingClientRect().right - el.getBoundingClientRect().right)).toBeLessThan(1);
    });

    it('announces the pick, then closes; with close-on-select="false" it stays open for the next one', async () => {
        const el = await picker();
        const picks: string[] = [];
        el.addEventListener('emoji-select', (event) => picks.push((event as CustomEvent<string>).detail));
        await open(el);
        emoji(el, '🎉').click();
        await el.updateComplete;
        expect(picks).toEqual(['🎉']);
        expect(el.open).toBe(false);

        const many = await picker('close-on-select="false"');
        const more: string[] = [];
        many.addEventListener('emoji-select', (event) => more.push((event as CustomEvent<string>).detail));
        await open(many);
        emoji(many, '😀').click();
        emoji(many, '🚀').click();
        await many.updateComplete;
        expect(more).toEqual(['😀', '🚀']);
        expect(many.open).toBe(true);
    });

    it('names each emoji from its first keywords, and a multi-code-point flag is announced whole', async () => {
        expect(emojiLabel('😀')).toBe('grinning face smile');
        expect(emojiLabel('🇩🇪')).toBe('flag de flag de');
        expect(emojiLabel('not-an-emoji')).toBe('not-an-emoji');

        const el = await picker();
        await open(el);
        expect(emoji(el, '😀').getAttribute('aria-label')).toBe('grinning face smile');
    });

    it('searches category names, glyphs and keywords, hides empty categories, and says so when nothing matches', async () => {
        expect(filterCategories('')).toBe(EMOJI_CATEGORIES);
        expect(filterCategories('flags').map((c) => c.id)).toEqual(['flags']);
        expect(filterCategories('emotion')).toEqual([EMOJI_CATEGORIES.find((c) => c.id === 'smileys')]);
        expect(filterCategories('  PIZZA ').flatMap((c) => c.emojis)).toContain('🍕');
        expect(filterCategories('🍕').flatMap((c) => c.emojis)).toEqual(['🍕']);

        const el = await picker();
        await open(el);
        await userEvent.fill(search(el), 'pizza');
        await content(el).updateComplete;
        expect(headings(el)).toEqual(['Food & Drink']);
        expect(root(el).querySelectorAll('.emoji').length).toBeGreaterThan(0);

        await userEvent.fill(search(el), 'zzzzqx');
        await content(el).updateComplete;
        expect(root(el).querySelector('.empty')!.textContent).toContain('No emojis found');
        expect(root(el).querySelectorAll('.emoji')).toHaveLength(0);
    });

    it('a tab clears the search and scrolls its category to the top; scrolling by hand moves the active tab', async () => {
        const el = await picker();
        await open(el);
        expect(tab(el, 'smileys').getAttribute('aria-current')).toBe('true');

        await userEvent.fill(search(el), 'pizza');
        await content(el).updateComplete;
        tab(el, 'travel').click();
        await content(el).updateComplete;
        await vi.waitFor(() => {
            const section = root(el).querySelector<HTMLElement>('[data-category="travel"]')!;
            expect(Math.abs(section.getBoundingClientRect().top - viewport(el).getBoundingClientRect().top)).toBeLessThan(2);
        }, { timeout: 4000 });
        expect(headings(el)).toHaveLength(EMOJI_CATEGORIES.length);
        expect(tab(el, 'travel').getAttribute('aria-current')).toBe('true');
        expect(tab(el, 'smileys').getAttribute('aria-current')).toBe('false');

        await new Promise((resolve) => setTimeout(resolve, 900));
        const flags = root(el).querySelector<HTMLElement>('[data-category="flags"]')!;
        viewport(el).scrollTop += flags.getBoundingClientRect().top - viewport(el).getBoundingClientRect().top;
        await vi.waitFor(() => expect(tab(el, 'flags').getAttribute('aria-current')).toBe('true'));
    });

    it('closes on a click outside and on Escape, handing focus back to the trigger', async () => {
        const el = await picker();
        await open(el);
        await userEvent.keyboard('{Escape}');
        await el.updateComplete;
        expect(el.open).toBe(false);
        await vi.waitFor(() => expect(document.activeElement).toBe(el.querySelector('button')));

        await open(el);
        document.body.click();
        await el.updateComplete;
        expect(el.open).toBe(false);
    });

    it('fixed strategy pins the panel in the top layer under the trigger; align and side follow the popover', async () => {
        const el = await picker('', 'strategy="fixed"');
        await open(el);
        expect(getComputedStyle(panel(el)!).position).toBe('fixed');
        const trigger = el.querySelector('ge-emoji-picker-trigger')!.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
        expect(Math.abs(panel(el)!.getBoundingClientRect().top - (trigger.bottom + 4))).toBeLessThan(1);
        expect(Math.abs(panel(el)!.getBoundingClientRect().left - trigger.left)).toBeLessThan(1);
    });

    it('has no accessibility violations open, in light and dark', async () => {
        const el = await picker();
        await open(el);
        for (const dark of [false, true]) {
            useTheme(dark ? 'dark' : 'light');
            await new Promise((resolve) => setTimeout(resolve, 300));
            const result = await axe.run(panel(el)!, { rules: { 'color-contrast': { enabled: true } } });
            expect(result.violations.map((v) => v.id)).toEqual([]);
        }
    });
});
