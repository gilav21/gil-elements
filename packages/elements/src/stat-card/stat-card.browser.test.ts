import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeStatCard } from './index.js';

const card = (page: HTMLElement) => page.querySelector<GeStatCard>('ge-stat-card')!;
const inner = (page: HTMLElement, selector: string) => card(page).shadowRoot!.querySelector<HTMLElement>(selector);
const settle = async (page: HTMLElement) => {
    await card(page).updateComplete;
    await card(page).updateComplete;
};
const shown = (e: Element | null) => !!e && getComputedStyle(e).display !== 'none';

describe('ge-stat-card', () => {
    it('shows the label and value as given, and a delta badge whose colour and arrow follow the trend', async () => {
        const page = await mount(`<div style="width:16rem"><ge-stat-card label="Total Revenue" value="$45,231.89" delta="+20.1%" trend="up"></ge-stat-card></div>`);
        await settle(page);

        expect(inner(page, 'ge-card-description')!.textContent!.trim()).toBe('Total Revenue');
        expect(inner(page, 'ge-card-title')!.textContent!.trim()).toBe('$45,231.89');
        expect(inner(page, 'ge-badge')!.getAttribute('variant')).toBe('default');
        expect(inner(page, 'ge-badge')!.textContent!.trim()).toBe('+20.1%');
        expect(inner(page, '[data-slot="stat-card-trend"]')!.getAttribute('data-trend')).toBe('up');

        card(page).trend = 'down';
        await settle(page);
        expect(inner(page, 'ge-badge')!.getAttribute('variant')).toBe('destructive');
        expect(inner(page, '[data-slot="stat-card-trend"]')!.getAttribute('data-trend')).toBe('down');

        card(page).trend = 'neutral';
        await settle(page);
        expect(inner(page, 'ge-badge')!.getAttribute('variant')).toBe('secondary');
        expect(inner(page, '[data-slot="stat-card-trend"]')).toBeNull();
    });

    it('keeps the trend colour without the arrow when hide-trend-icon is set', async () => {
        const page = await mount(`<ge-stat-card label="Users" value="2,350" delta="-4%" trend="down" hide-trend-icon></ge-stat-card>`);
        await settle(page);

        expect(inner(page, 'ge-badge')!.getAttribute('variant')).toBe('destructive');
        expect(inner(page, '[data-slot="stat-card-trend"]')).toBeNull();
    });

    it('draws the content row only when there is a delta or projected content', async () => {
        const page = await mount(`<ge-stat-card label="Users" value="2,350"></ge-stat-card>`);
        await settle(page);
        expect(shown(inner(page, 'ge-card-content'))).toBe(false);

        card(page).delta = '+1%';
        await settle(page);
        expect(shown(inner(page, 'ge-card-content'))).toBe(true);

        card(page).delta = '';
        card(page).insertAdjacentHTML('beforeend', '<div id="spark" style="height:40px">spark</div>');
        await new Promise((r) => setTimeout(r, 0));
        await settle(page);
        expect(shown(inner(page, 'ge-card-content'))).toBe(true);
        expect(inner(page, 'ge-badge')).toBeNull();
    });

    it('truncates a long label and value inside a narrow card instead of widening it', async () => {
        const page = await mount(`<div style="width:8rem"><ge-stat-card label="Total recurring revenue this quarter" value="$1,234,567,890.12"></ge-stat-card></div>`);
        await settle(page);
        const box = inner(page, 'ge-card')!.getBoundingClientRect();
        for (const part of ['ge-card-description', 'ge-card-title']) {
            const style = getComputedStyle(inner(page, part)!);
            expect([style.overflowX, style.textOverflow, style.whiteSpace]).toEqual(['clip', 'ellipsis', 'nowrap']);
        }
        const title = inner(page, 'ge-card-title')!;
        const range = document.createRange();
        range.selectNodeContents(title);
        expect(range.getBoundingClientRect().width).toBeGreaterThan(title.getBoundingClientRect().width);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no axe violations', async () => {
            const page = await mount(`<ge-stat-card label="Total Revenue" value="$45,231.89" delta="+20.1%" trend="up"></ge-stat-card>`);
            await settle(page);
            const result = await axe.run(page, { rules: { 'color-contrast': { enabled: false } } });
            expect(result.violations).toEqual([]);
        });
    });
});
