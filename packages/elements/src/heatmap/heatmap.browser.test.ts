import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeHeatmap, HeatmapCell } from './index.js';

const DATA: HeatmapCell[] = [
    { row: 'Tue', col: '10', value: 4 },
    { row: 'Tue', col: '9', value: 10 },
    { row: 'Mon', col: '10', value: 0 },
    { row: 'Mon', col: '9', value: 7 },
];
const map = async (attrs = '', data = DATA, width = 480) => {
    const page = await mount(`<div style="width:${width}px"><ge-heatmap ${attrs}></ge-heatmap></div>`);
    const el = page.querySelector<GeHeatmap>('ge-heatmap')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const cells = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="heatmap-cell"]')];
const box = (e: Element) => e.getBoundingClientRect();
const labels = (el: Element) => [...root(el).querySelectorAll('.label')].map((t) => t.textContent);
const fill = (e: Element) => getComputedStyle(e).fill;
const tip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
const enter = async (el: GeHeatmap, index: number) => {
    cells(el)[index]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')?.updateComplete;
};

describe('ge-heatmap', () => {
    it('places a cell at its row and column, both in the order they first appear, with labels and a summary', async () => {
        const el = await map();
        expect(labels(el)).toEqual(['10', '9', 'Tue', 'Mon']);
        const [tue10, tue9, mon10, mon9] = cells(el).map(box);
        expect(tue9!.top).toBeCloseTo(tue10!.top, 0);
        expect(tue9!.left).toBeGreaterThan(tue10!.left);
        expect(mon10!.top).toBeGreaterThan(tue10!.top);
        expect(mon10!.left).toBeCloseTo(tue10!.left, 0);
        expect(mon9!.left).toBeCloseTo(tue9!.left, 0);
        expect(cells(el)[1]!.getAttribute('aria-label')).toBe('Tue, 9: 10');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Heatmap with 2 rows and 2 columns.');
    });

    it('colours the lowest value with from-color, the highest with to-color and the rest between, and lets both be set', async () => {
        const el = await map('from-color="rgb(255, 255, 255)" to-color="rgb(0, 0, 0)"');
        const [mid, high, low] = [cells(el)[0]!, cells(el)[1]!, cells(el)[2]!].map(fill);
        expect(low).toBe('rgb(255, 255, 255)');
        expect(high).toBe('rgb(0, 0, 0)');
        const lightness = (c: string) => Number(/\d+/.exec(c)![0]);
        expect(lightness(mid!)).toBeGreaterThan(lightness(high!));
        expect(lightness(mid!)).toBeLessThan(lightness(low!));
        const defaults = await map();
        expect(fill(cells(defaults)[2]!)).not.toBe(fill(cells(defaults)[1]!));
    });

    it('sizes cells to fit the width between min-cell-size and max-cell-size', async () => {
        const roomy = await map('', DATA, 600);
        expect(box(cells(roomy)[0]!).width).toBeCloseTo(52, 0);
        const capped = await map('max-cell-size="30"', DATA, 600);
        expect(box(cells(capped)[0]!).width).toBeCloseTo(30, 0);
        const wide = Array.from({ length: 24 }, (...[, i]) => ({ row: 'R', col: `c${i}`, value: i }));
        const usedWidth = (el: Element) => Number(root(el).querySelector('svg')!.getAttribute('width'));
        const cellSize = (el: Element) => (usedWidth(el) - 48) / 24 - 2;
        expect(cellSize(await map('', wide, 480))).toBeCloseTo(18, 3);
        expect(cellSize(await map('min-cell-size="30"', wide, 480))).toBeCloseTo(30, 3);
        const mid = Array.from({ length: 10 }, (...[, i]) => ({ row: 'R', col: `c${i}`, value: i }));
        expect(((usedWidth(await map('', mid, 480)) - 48) / 10) - 2).toBeCloseTo((480 - 48 - 20) / 10, 3);
    });

    it('reads a hovered or focused cell out as "row · column" with its value and colour, and reports cell-hover', async () => {
        const el = await map();
        const seen: unknown[] = [];
        el.addEventListener('cell-hover', (e) => seen.push((e as CustomEvent).detail));
        await enter(el, 1);
        const text = tip(el).textContent!.replaceAll(/\s+/g, '');
        expect(text).toContain('Tue·9');
        expect(text).toContain('10');
        const cell = box(cells(el)[1]!);
        expect(box(tip(el)).left).toBeCloseTo(cell.left + cell.width / 2, -1);
        cells(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        cells(el)[3]!.dispatchEvent(new FocusEvent('focus'));
        cells(el)[3]!.dispatchEvent(new FocusEvent('blur'));
        await el.updateComplete;
        expect(seen).toEqual([DATA[1], null, DATA[3], null]);
        const dot = root(el).querySelector('ge-chart-tooltip')!;
        await enter(el, 1);
        expect(getComputedStyle(dot.shadowRoot!.querySelector('[role="tooltip"] span')!).backgroundColor).toBe(fill(cells(el)[1]!));
    });

    it('flips the tooltip to the left of a cell in the right part of the chart', async () => {
        const el = await map('', Array.from({ length: 8 }, (...[, i]) => ({ row: 'R', col: `c${i}`, value: i })), 480);
        await enter(el, 7);
        const cell = box(cells(el)[7]!);
        expect(box(tip(el)).right).toBeCloseTo(cell.left + cell.width / 2, -1);
    });

    it('writes the values on the cells and shows five Low to High swatches only when asked', async () => {
        const el = await map('show-values');
        expect([...root(el).querySelectorAll('.value')].map((t) => t.textContent)).toEqual(['4', '10', '0', '7']);
        const swatches = [...root(el).querySelectorAll<HTMLElement>('.swatch')];
        expect(swatches).toHaveLength(5);
        expect(root(el).querySelector('.legend')!.textContent).toMatch(/^Low.*High$/);
        expect(swatches[0]!.style.background).toBe(fill(cells(el)[2]!));
        expect(swatches[4]!.style.background).toBe(fill(cells(el)[1]!));
        const plain = await map('show-legend="false"');
        expect(root(plain).querySelectorAll('.value')).toHaveLength(0);
        expect(root(plain).querySelector('.legend')).toBeNull();
        expect(root(await map('show-tooltip="false"')).querySelector('ge-chart-tooltip')).toBeNull();
    });
});
