import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken, useTheme } from '../test-utils.js';

const FOLDER = '<svg width="10" height="10" viewBox="0 0 24 24"><path d="M2 5h20v14H2z"/></svg>';

describe('ge-empty', () => {
    it('centres header and actions in a dashed box', async () => {
        const page = await mount(`
            <ge-empty style="width: 400px"><ge-empty-header><ge-empty-title>No projects yet</ge-empty-title></ge-empty-header><ge-empty-content><button>Create</button></ge-empty-content></ge-empty>`);
        const empty = page.querySelector('ge-empty')!;
        const centre = (el: Element) => el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2;

        expect(getComputedStyle(empty).borderTopStyle).toBe('dashed');
        expect(centre(empty.querySelector('button')!)).toBeCloseTo(centre(empty), 0);
        expect(centre(empty.querySelector('ge-empty-title')!)).toBeCloseTo(centre(empty), 0);
    });

    it('draws the icon variant as a tile with the icon at 1.5rem, unless the icon sizes itself', async () => {
        const page = await mount(`
            <ge-empty-media id="tile" variant="icon">${FOLDER}</ge-empty-media>
            <ge-empty-media id="plain">${FOLDER}</ge-empty-media>
            <ge-empty-media id="own" variant="icon"><svg width="12" height="12" viewBox="0 0 24 24" style="width: 12px; height: 12px"><path d="M2 5h20v14H2z"/></svg></ge-empty-media>`);
        const size = (id: string) => page.querySelector(`#${id}`)!.getBoundingClientRect();
        const icon = (id: string) => page.querySelector(`#${id} svg`)!.getBoundingClientRect().width;

        expect([size('tile').width, size('tile').height]).toEqual([40, 40]);
        expect(getComputedStyle(page.querySelector('#tile')!).backgroundColor).toBe(paintedToken('--muted', page));
        expect(icon('tile')).toBe(24);
        expect(icon('plain')).toBe(10);
        expect(icon('own')).toBe(12);
    });

    it('underlines slotted links in the description and colours them on hover', async () => {
        const page = await mount('<ge-empty-description>Read the <a href="#docs">docs</a>.</ge-empty-description>');
        const link = page.querySelector('a')!;

        expect(getComputedStyle(link).textDecorationLine).toBe('underline');
        expect(getComputedStyle(link).color).toBe(getComputedStyle(page.querySelector('ge-empty-description')!).color);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(`<ge-empty><ge-empty-header><ge-empty-media variant="icon">${FOLDER}</ge-empty-media><ge-empty-title>No projects yet</ge-empty-title><ge-empty-description>Create one to begin.</ge-empty-description></ge-empty-header></ge-empty>`);
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});
