import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeChartLegend } from './index.js';

const ITEMS = [
    { key: 'a', label: 'Revenue', color: '#2563eb' },
    { key: 'b', label: 'Costs', color: '#16a34a' },
];
const legend = async (attrs = '', hidden: string[] = []) => {
    const page = await mount(`<ge-chart-legend ${attrs}></ge-chart-legend>`);
    const el = page.querySelector<GeChartLegend>('ge-chart-legend')!;
    el.items = ITEMS;
    el.hiddenKeys = hidden;
    await el.updateComplete;
    return el;
};
const entries = (el: Element) => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-slot="chart-legend-item"]')];

describe('ge-chart-legend', () => {
    it('lists the entries as pressed buttons, and a hidden series as not pressed', async () => {
        const el = await legend('', ['b']);
        expect(entries(el).map((e) => [e.textContent, e.getAttribute('role'), e.getAttribute('aria-pressed')])).toEqual([
            ['Revenue', 'button', 'true'],
            ['Costs', 'button', 'false'],
        ]);
    });

    it('reports the key on a click, Enter and Space, but never changes the hidden list itself', async () => {
        const el = await legend();
        const keys: string[] = [];
        el.addEventListener('item-toggle', (event) => keys.push((event as CustomEvent<string>).detail));
        entries(el)[1]!.click();
        entries(el)[0]!.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(keys).toEqual(['b', 'a', 'a']);
        expect(el.hiddenKeys).toEqual([]);
    });

    it('is a plain key when not interactive: no buttons, no events', async () => {
        const el = await legend('interactive="false"');
        const keys: string[] = [];
        el.addEventListener('item-toggle', (event) => keys.push((event as CustomEvent<string>).detail));
        entries(el)[0]!.click();
        expect(keys).toEqual([]);
        expect(entries(el).some((e) => e.hasAttribute('role') || e.hasAttribute('tabindex'))).toBe(false);
    });
});
