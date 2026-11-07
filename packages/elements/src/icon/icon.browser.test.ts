import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import { DEFAULT_ICONS, SOLID_ICONS, SOLID_SUPPORTED_ICONS } from './icons.js';
import { registerIcons, type GeIcon } from './icon.js';

async function icon(attrs = '', style = ''): Promise<GeIcon> {
    const page = await mount(`<ge-icon ${attrs} style="${style}"></ge-icon>`);
    const el = page.firstElementChild as GeIcon;
    await el.updateComplete;
    return el;
}
const svg = (el: GeIcon) => el.shadowRoot!.querySelector('svg')!;
const attrs = (el: GeIcon, ...names: string[]) => names.map((n) => svg(el).getAttribute(n));

describe('ge-icon', () => {
    it('draws a 24px stroked glyph in the surrounding text colour, inline', async () => {
        const el = await icon('name="check"', 'color:rgb(200, 0, 0)');

        expect(getComputedStyle(el).display).toBe('inline-flex');
        expect(attrs(el, 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin')).toEqual(['24', '24', '0 0 24 24', 'none', 'currentColor', '2', 'round', 'round']);
        expect(svg(el).innerHTML).toContain('<path d="m4 12.5 5 5L20 6.5"');
        expect(getComputedStyle(svg(el)).stroke).toBe('rgb(200, 0, 0)');
        expect(svg(el).getBoundingClientRect().width).toBe(24);
    });

    it('takes a preset size or any SVG length, and a colour of its own', async () => {
        const sizes = [];
        for (const size of ['xs', 'sm', 'lg', 'xl', '2rem']) sizes.push(attrs(await icon(`name="check" size="${size}"`), 'width', 'height'));
        expect(sizes).toEqual([['12', '12'], ['16', '16'], ['32', '32'], ['48', '48'], ['2rem', '2rem']]);

        const tinted = await icon('name="check" color="rgb(0, 128, 0)"', 'color:red');
        expect(getComputedStyle(svg(tinted)).stroke).toBe('rgb(0, 128, 0)');
    });

    it('maps weight to stroke width, lets stroke-width and fill-color override, and fills a solid glyph with no stroke', async () => {
        const widths = [];
        for (const weight of ['light', 'regular', 'thick']) widths.push(attrs(await icon(`name="plus" weight="${weight}"`), 'stroke-width')[0]);
        expect(widths).toEqual(['1.5', '2', '2.5']);

        expect(attrs(await icon('name="plus" weight="thick" stroke-width="4"'), 'stroke-width')).toEqual(['4']);
        expect(attrs(await icon('name="circle" fill-color="rgb(255, 0, 0)"'), 'fill')).toEqual(['rgb(255, 0, 0)']);

        const solid = await icon('name="circle-check" weight="solid"');
        expect(attrs(solid, 'fill', 'stroke', 'stroke-width')).toEqual(['currentColor', 'none', '0']);
        expect(svg(solid).querySelector('g[fill="none"]')).not.toBeNull();
        expect(attrs(await icon('name="heart" weight="solid" fill-color="rgb(255, 0, 0)"'), 'fill', 'stroke')).toEqual(['rgb(255, 0, 0)', 'none']);
    });

    it('a glyph without a solid form stays outlined at weight solid', async () => {
        expect(SOLID_SUPPORTED_ICONS.has('arrow-up')).toBe(false);
        const el = await icon('name="arrow-up" weight="solid"');
        expect(attrs(el, 'fill', 'stroke', 'stroke-width')).toEqual(['none', 'currentColor', '2']);
        expect(svg(el).innerHTML).toContain('M12 20V4');
    });

    it('draws an empty svg for an unknown or missing name instead of throwing', async () => {
        for (const attr of ['name="no-such-icon"', '']) expect((await icon(attr)).shadowRoot!.querySelector('svg')!.childElementCount).toBe(0);
    });

    it('registerIcons adds glyphs, replaces built-in ones, wins over the solid form, and redraws icons already on the page', async () => {
        const el = await icon('name="brand-logo"');
        const same = await icon('name="check" weight="solid"');
        expect(svg(el).childElementCount).toBe(0);

        registerIcons({ 'brand-logo': '<circle cx="12" cy="12" r="5" />', check: '<path d="M1 1h22" />' });
        await el.updateComplete;
        await same.updateComplete;

        expect(svg(el).querySelector('circle')!.getAttribute('r')).toBe('5');
        expect(svg(same).innerHTML).toContain('M1 1h22');
        const solidCustom = await icon('name="circle-check" weight="solid"');
        registerIcons({ 'circle-check': '<path d="M0 0" />' });
        await solidCustom.updateComplete;
        expect(svg(solidCustom).innerHTML).toContain('M0 0');

        const gone = await icon('name="check"');
        let redrawn = 0;
        gone.requestUpdate = () => void redrawn++;
        gone.remove();
        registerIcons({ unused: '<path d="M0 0" />' });
        expect(redrawn).toBe(0);
    });

    it('ships a well-formed glyph for every built-in and solid name', () => {
        const parse = (inner: string) => new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`, 'image/svg+xml');
        const broken = [...Object.entries(DEFAULT_ICONS), ...Object.entries(SOLID_ICONS)].filter(([, inner]) => parse(inner).querySelector('parsererror') || !parse(inner).documentElement.childElementCount).map(([name]) => name);
        expect(broken).toEqual([]);
        expect(Object.keys(DEFAULT_ICONS).length).toBeGreaterThan(1000);
        for (const name of Object.keys(SOLID_ICONS)) expect(SOLID_SUPPORTED_ICONS.has(name)).toBe(true);
    });
});
