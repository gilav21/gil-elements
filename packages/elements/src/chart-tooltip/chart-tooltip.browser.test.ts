import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeChartTooltip } from './index.js';

const tooltip = async (attrs: string) => {
    const page = await mount(`<div style="position:relative;height:200px"><ge-chart-tooltip ${attrs}></ge-chart-tooltip></div>`);
    const el = page.querySelector<GeChartTooltip>('ge-chart-tooltip')!;
    el.rows = [
        { label: 'Revenue', value: '$1,200', color: '#2563eb' },
        { label: 'Notes', value: '3' },
    ];
    await el.updateComplete;
    return el;
};
const surface = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[role="tooltip"]');

describe('ge-chart-tooltip', () => {
    it('renders nothing while hidden, and the heading and rows once visible, with a swatch only where a row has a colour', async () => {
        const el = await tooltip('x="40" y="30" heading="January"');
        expect(surface(el)).toBeNull();
        el.visible = true;
        await el.updateComplete;
        const box = surface(el)!;
        expect(box.textContent).toContain('January');
        expect([...box.querySelectorAll('.row')].map((row) => [row.textContent!.replaceAll(/\s+/g, ' ').trim(), row.querySelector('.dot') !== null])).toEqual([
            ['Revenue $1,200', true],
            ['Notes 3', false],
        ]);
    });

    it('sits at x and y from the positioned parent, and flips to the other side of that point', async () => {
        const el = await tooltip('visible x="150" y="100"');
        const parent = el.parentElement!.getBoundingClientRect();
        const plain = surface(el)!.getBoundingClientRect();
        expect([plain.left - parent.left, plain.top - parent.top]).toEqual([150, 100]);
        el.flipX = true;
        el.flipY = true;
        await el.updateComplete;
        const flipped = surface(el)!.getBoundingClientRect();
        expect(flipped.right - parent.left).toBeCloseTo(150, 0);
        expect(flipped.bottom - parent.top).toBeCloseTo(100, 0);
    });
});
