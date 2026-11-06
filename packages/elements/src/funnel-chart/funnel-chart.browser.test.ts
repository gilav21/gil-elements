import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent, ChartDataPoint, GeFunnelChart } from './index.js';

const DATA: ChartDataPoint[] = [{ name: 'Visitors', value: 1000 }, { name: 'Signups', value: 500 }, { name: 'Paid', value: 100 }];
const funnel = async (attrs = '', data = DATA) => {
    const page = await mount(`<div style="width:440px"><ge-funnel-chart ${attrs}></ge-funnel-chart></div>`);
    const el = page.querySelector<GeFunnelChart>('ge-funnel-chart')!;
    el.data = data;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const stages = (el: Element) => [...root(el).querySelectorAll<SVGPolygonElement>('[data-slot="funnel-stage"]')];
const captions = (el: Element) => [...root(el).querySelectorAll('.caption')].map((t) => t.textContent);
const tooltip = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]');
const hover = async (el: GeFunnelChart, index: number) => {
    stages(el)[index]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('ge-funnel-chart', () => {
    it('stacks stages top to bottom with widths following the values, centred, each captioned with its share of the first', async () => {
        const el = await funnel();
        const boxes = stages(el).map((s) => s.getBoundingClientRect());
        expect(boxes[0]!.width).toBeGreaterThan(boxes[1]!.width);
        expect(boxes[1]!.width).toBeGreaterThan(boxes[2]!.width);
        expect(boxes[0]!.width).toBeCloseTo(440 - 16, 0);
        expect(boxes[1]!.width).toBeCloseTo((440 - 16) * 0.5, 0);
        expect(boxes[1]!.top).toBeGreaterThan(boxes[0]!.bottom);
        const centre = (b: DOMRect) => b.left + b.width / 2;
        expect(centre(boxes[2]!)).toBeCloseTo(centre(boxes[0]!), 0);
        expect(captions(el)).toEqual(['Visitors · 100.0%', 'Signups · 50.0%', 'Paid · 10.0%']);
        expect(stages(el)[1]!.getAttribute('aria-label')).toBe('Signups: 500 (50.0%)');
        expect(root(el).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Funnel chart with 3 data points.');
    });

    it('measures shares against the previous stage with percentage-mode="previous"', async () => {
        const el = await funnel('percentage-mode="previous"');
        expect(captions(el)).toEqual(['Visitors · 100.0%', 'Signups · 50.0%', 'Paid · 20.0%']);
    });

    it('treats a negative or zero value as no width and writes no caption on it', async () => {
        const el = await funnel('', [{ name: 'A', value: 100 }, { name: 'B', value: -30 }, { name: 'C', value: 0 }]);
        expect(captions(el)).toEqual(['A · 100.0%']);
        expect(stages(el)).toHaveLength(3);
        const all = await funnel('', [{ name: 'A', value: 0 }, { name: 'B', value: 0 }]);
        expect(captions(all)).toEqual([]);
        expect(stages(el)[1]!.getAttribute('aria-label')).toBe('B: -30 (0.0%)');
    });

    it('narrows each stage towards the next, fills the height between the padding, and clamps the tooltip inside the top edge', async () => {
        const el = await funnel('gap="10"');
        const first = stages(el)[0]!;
        const inner = 440 - 16;
        const bottomLeft = (offset: number) => first.isPointInFill(new DOMPoint(220 - offset * inner, 100 - 8 - 10 - 1));
        expect(bottomLeft(0.2)).toBe(true);
        expect(bottomLeft(0.4)).toBe(false);
        const svg = root(el).querySelector('svg')!.getBoundingClientRect();
        expect(stages(el)[2]!.getBoundingClientRect().bottom).toBeCloseTo(svg.top + 300 - 8, 0);
        const many = await funnel('', Array.from({ length: 20 }, (...[, i]) => ({ name: `S${i}`, value: 100 - i })));
        await hover(many, 0);
        const box = root(many).querySelector('svg')!.getBoundingClientRect();
        expect(tooltip(many)!.getBoundingClientRect().top).toBeCloseTo(box.top + 8, 0);
    });

    it('spaces stages by gap and hides the captions with show-values="false"', async () => {
        const tight = await funnel('gap="0"');
        const loose = await funnel('gap="12" show-values="false"');
        const space = (el: Element) => stages(el)[1]!.getBoundingClientRect().top - stages(el)[0]!.getBoundingClientRect().bottom;
        expect(space(tight)).toBeCloseTo(0, 0);
        expect(space(loose)).toBeCloseTo(12, 0);
        expect(captions(loose)).toEqual([]);
    });

    it('dims the other stages on hover or focus and shows the stage name with its value and share above its centre', async () => {
        const el = await funnel();
        await hover(el, 1);
        expect(stages(el).map((s) => s.getAttribute('fill-opacity'))).toEqual(['0.55', '0.9', '0.55']);
        const tip = tooltip(el)!;
        expect(tip.textContent).toContain('Signups');
        expect(tip.textContent!.replaceAll(/\s+/g, '')).toContain('Value500');
        expect(tip.textContent!.replaceAll(/\s+/g, '')).toContain('Share50.0%');
        const box = stages(el)[1]!.getBoundingClientRect();
        expect(tip.getBoundingClientRect().left).toBeCloseTo(box.left + box.width / 2, -1);
        stages(el)[1]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(stages(el).every((s) => s.getAttribute('fill-opacity') === '0.9')).toBe(true);
        stages(el)[2]!.dispatchEvent(new FocusEvent('focus'));
        await el.updateComplete;
        expect(stages(el)[0]!.getAttribute('fill-opacity')).toBe('0.55');
    });

    it('emits stage-click with the point on click and on Enter only, and has no tooltip with show-tooltip="false"', async () => {
        const el = await funnel();
        const seen: ChartClickEvent[] = [];
        el.addEventListener('stage-click', (e) => seen.push((e as CustomEvent).detail));
        stages(el)[2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        stages(el)[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        stages(el)[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(seen).toEqual([{ point: DATA[2], index: 2 }, { point: DATA[0], index: 0 }]);
        expect(root(await funnel('show-tooltip="false"')).querySelector('ge-chart-tooltip')).toBeNull();
    });
});
