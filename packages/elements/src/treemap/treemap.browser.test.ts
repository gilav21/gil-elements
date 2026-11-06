import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import { flattenLayout, layoutTreemap, nodeValue, squarify } from '../shared/chart/treemap-layout.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import type { GeTreemap, TreemapNode } from './index.js';

const DISK: TreemapNode[] = [
    { label: 'Media', children: [{ label: 'Photos', value: 420 }, { label: 'Video', value: 300 }, { label: 'Music', value: 120 }] },
    { label: 'Code', children: [{ label: 'Repos', value: 180 }, { label: 'Builds', value: 60 }] },
    { label: 'Docs', value: 90 },
    { label: 'Trash', value: 30 },
];
const area = (r: { width: number; height: number }) => r.width * r.height;

const chart = async (attrs = '', nodes: TreemapNode[] = DISK, width = 500) => {
    const page = await mount(`<div style="width:${width}px"><ge-treemap ${attrs}></ge-treemap></div>`);
    const el = page.querySelector<GeTreemap>('ge-treemap')!;
    el.nodes = nodes;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const cells = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('[data-slot="treemap-cell"]')];
const byLabel = (el: Element, label: string) => cells(el).find((g) => g.getAttribute('aria-label')!.startsWith(`${label}:`))!;
const labels = (el: Element) => [...root(el).querySelectorAll('[data-slot="treemap-label"]')].map((t) => t.textContent);
const hover = async (el: GeTreemap, label: string) => {
    byLabel(el, label).dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('treemap layout', () => {
    it('sums groups, counts a missing, negative or non-finite value as zero, and lets an empty group stand as a leaf', () => {
        expect(nodeValue(DISK[0]!)).toBe(840);
        expect(nodeValue({ label: 'g', value: 999, children: [{ label: 'a', value: 5 }] })).toBe(5);
        for (const value of [undefined, -4, Number.NaN, Number.POSITIVE_INFINITY]) expect(nodeValue({ label: 'x', value })).toBe(0);
        expect(nodeValue({ label: 'e', value: 7, children: [] })).toBe(7);
    });

    it('fills the box with areas proportional to the values, in the caller\'s order, and keeps zeros out of the way', () => {
        const box = { x: 10, y: 20, width: 400, height: 300 };
        const values = [6, 6, 4, 3, 2, 2, 1];
        const rects = squarify(values, box);
        const total = values.reduce((a, b) => a + b, 0);
        rects.forEach((r, i) => expect(area(r)).toBeCloseTo((values[i]! / total) * area(box), 3));
        expect(rects.reduce((sum, r) => sum + area(r), 0)).toBeCloseTo(area(box), 3);
        for (const r of rects) {
            expect(r.x).toBeGreaterThanOrEqual(box.x - 1e-9);
            expect(r.y).toBeGreaterThanOrEqual(box.y - 1e-9);
            expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 1e-9);
            expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height + 1e-9);
            expect(Math.max(r.width / r.height, r.height / r.width)).toBeLessThan(4);
        }
        const withZero = squarify([5, 0, 5, -1], box);
        expect([withZero[1], withZero[3]]).toEqual([{ x: 10, y: 20, width: 0, height: 0 }, { x: 10, y: 20, width: 0, height: 0 }]);
        expect(area(withZero[0]!) + area(withZero[2]!)).toBeCloseTo(area(box), 3);
        expect(squarify([0, 0], box).every((r) => area(r) === 0)).toBe(true);
        expect(squarify([1, 2], { x: 0, y: 0, width: 0, height: 50 }).every((r) => area(r) === 0)).toBe(true);
    });

    it('nests children inside their group\'s inset box, gives index paths, and draws parents before children', () => {
        const box = { x: 0, y: 0, width: 400, height: 300 };
        const layout = layoutTreemap(DISK, box, 3);
        const media = layout[0]!;
        expect(media.children.map((c) => c.path)).toEqual(['0/0', '0/1', '0/2']);
        expect(media.children.map((c) => c.depth)).toEqual([1, 1, 1]);
        const inner = media.children.reduce((sum, c) => sum + area(c.rect), 0);
        expect(inner).toBeCloseTo((media.rect.width - 6) * (media.rect.height - 6), 3);
        for (const c of media.children) {
            expect(c.rect.x).toBeGreaterThanOrEqual(media.rect.x + 3 - 1e-9);
            expect(c.rect.y + c.rect.height).toBeLessThanOrEqual(media.rect.y + media.rect.height - 3 + 1e-9);
        }
        const sliver = layoutTreemap([{ label: 'big', value: 10_000 }, { label: 'tiny', children: [{ label: 'a', value: 1 }, { label: 'b', value: 1 }] }], box, 3);
        const tiny = sliver[1]!;
        expect(tiny.rect.width).toBeLessThan(6);
        for (const c of tiny.children) {
            expect(c.rect.width).toBeGreaterThanOrEqual(0);
            expect(c.rect.height).toBeGreaterThanOrEqual(0);
            expect(c.rect.x).toBeGreaterThanOrEqual(tiny.rect.x);
            expect(c.rect.x + c.rect.width).toBeLessThanOrEqual(tiny.rect.x + tiny.rect.width + 1e-9);
        }
        expect(flattenLayout(layout).map((n) => n.path)).toEqual(['0', '0/0', '0/1', '0/2', '1', '1/0', '1/1', '2', '3']);
    });
});

describe('ge-treemap', () => {
    it('draws a rectangle per node with an area proportional to its value, groups drawn as hollow outlines around their children', async () => {
        const el = await chart();
        expect(cells(el)).toHaveLength(9);
        const photos = byLabel(el, 'Photos').querySelector('rect')!.getBoundingClientRect();
        const video = byLabel(el, 'Video').querySelector('rect')!.getBoundingClientRect();
        expect(area(photos) / area(video)).toBeCloseTo(420 / 300, 1);
        const media = byLabel(el, 'Media');
        expect(media.querySelector('rect')!.getAttribute('fill-opacity')).toBe('0');
        expect(media.dataset.leaf).toBe('false');
        expect(byLabel(el, 'Photos').dataset.leaf).toBe('true');
        expect(Number(byLabel(el, 'Photos').querySelector('rect')!.getAttribute('fill-opacity'))).toBeCloseTo(0.73, 2);
        const svg = root(el).querySelector('svg')!.getBoundingClientRect();
        expect(svg.height).toBe(320);
        expect(svg.width).toBe(500);
    });

    it('colours by the top-level node, an own colour winning and passing down to its descendants only when they set none', async () => {
        const el = await chart('', [
            { label: 'A', color: 'rgb(1, 2, 3)', children: [{ label: 'A1', value: 5 }, { label: 'A2', value: 5, color: 'rgb(9, 9, 9)' }] },
            { label: 'B', value: 10 },
        ]);
        const fill = (label: string) => byLabel(el, label).querySelector('rect')!.getAttribute('fill');
        expect(fill('A')).toBe('rgb(1, 2, 3)');
        expect(fill('A1')).toBe('rgb(1, 2, 3)');
        expect(fill('A2')).toBe('rgb(9, 9, 9)');
        expect(fill('B')).not.toBe(fill('A'));
        const palette = await chart();
        expect(fill('B')).not.toBe(null);
        expect(new Set(['Media', 'Code', 'Docs', 'Trash'].map((l) => byLabel(palette, l).querySelector('rect')!.getAttribute('fill'))).size).toBe(4);
        expect(byLabel(palette, 'Photos').querySelector('rect')!.getAttribute('fill')).toBe(byLabel(palette, 'Media').querySelector('rect')!.getAttribute('fill'));
    });

    it('labels only the rectangles big enough, and respects the thresholds and show-labels="false"', async () => {
        const el = await chart();
        expect(labels(el)).toContain('Photos');
        expect(labels(el)).not.toContain('Trash');
        const strict = await chart('min-label-width="300"');
        expect(labels(strict).length).toBeLessThan(labels(el).length);
        expect(labels(await chart('min-label-height="9999"'))).toEqual([]);
        expect(byLabel(el, 'Media').querySelector('rect')!.getAttribute('stroke-width')).toBe('1.5');
        expect(byLabel(el, 'Photos').querySelector('rect')!.getAttribute('stroke-width')).toBe('1');
        const none = await chart('show-labels="false"');
        expect(labels(none)).toEqual([]);
        const photos = byLabel(el, 'Photos').querySelector('rect')!.getBoundingClientRect();
        const text = root(el).querySelector('[data-slot="treemap-label"]')!.getBoundingClientRect();
        expect(text.left).toBeGreaterThanOrEqual(photos.left);
    });

    it('mirrors the layout in RTL, the biggest node going top-right and labels hugging the right edge', async () => {
        const ltr = await chart();
        const page = await mount('<div dir="rtl" style="width:500px"><ge-treemap></ge-treemap></div>');
        const rtl = page.querySelector<GeTreemap>('ge-treemap')!;
        rtl.nodes = DISK;
        await rtl.updateComplete;
        const box = (el: GeTreemap, label: string) => byLabel(el, label).querySelector('rect')!.getBoundingClientRect();
        const wide = root(ltr).querySelector('svg')!.getBoundingClientRect();
        const mirrored = root(rtl).querySelector('svg')!.getBoundingClientRect();
        const a = box(ltr, 'Photos');
        const b = box(rtl, 'Photos');
        expect(b.left - mirrored.left).toBeCloseTo(wide.right - a.right, 0);
        expect(root(rtl).querySelector('[data-slot="treemap-label"]')!.getAttribute('text-anchor')).toBe('start');
        const photos = byLabel(rtl, 'Photos');
        expect(photos.querySelector('text')!.getBoundingClientRect().left).toBeGreaterThanOrEqual(photos.querySelector('rect')!.getBoundingClientRect().left);
        expect(photos.querySelector('rect')!.getBoundingClientRect().right - photos.querySelector('text')!.getBoundingClientRect().right).toBeCloseTo(5, 0);
        expect(root(ltr).querySelector('[data-slot="treemap-label"]')!.getAttribute('text-anchor')).toBe('start');
    });

    it('keeps labels inside their rectangles when the layout direction is set against the inherited one', async () => {
        const forced = await chart();
        forced.chartDir = 'rtl';
        await forced.updateComplete;
        const photos = byLabel(forced, 'Photos');
        expect(root(forced).querySelector('[data-slot="treemap-label"]')!.getAttribute('text-anchor')).toBe('end');
        const rect = photos.querySelector('rect')!.getBoundingClientRect();
        const text = photos.querySelector('text')!.getBoundingClientRect();
        expect(rect.right - text.right).toBeCloseTo(5, 0);
        expect(text.left).toBeGreaterThanOrEqual(rect.left);
    });

    it('shows value and share for the hovered node, dims the others, and emits node-hover, then null on leave', async () => {
        const el = await chart('unit=" GB"');
        const seen: (ChartClickEvent<TreemapNode> | null)[] = [];
        el.addEventListener('node-hover', (event) => seen.push((event as CustomEvent).detail));
        await hover(el, 'Docs');
        const tooltip = root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!;
        expect(tooltip.textContent).toContain('Docs');
        expect(tooltip.textContent).toContain('90 GB');
        expect(tooltip.textContent).toContain('7.5%');
        expect(getComputedStyle(byLabel(el, 'Trash')).opacity).toBe('0.6');
        expect(getComputedStyle(byLabel(el, 'Docs')).opacity).toBe('1');
        expect(seen[0]!.point.label).toBe('Docs');
        byLabel(el, 'Docs').dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(byLabel(el, 'Docs').getAttribute('aria-label')).toBe('Docs: 90 GB');
        const quiet = await chart('show-tooltip="false"');
        expect(root(quiet).querySelector('ge-chart-tooltip')).toBeNull();
    });

    it('activates a group or a leaf on click, Enter and Space, and takes focus like a button', async () => {
        const el = await chart();
        const clicks: ChartClickEvent<TreemapNode>[] = [];
        el.addEventListener('node-click', (event) => clicks.push((event as CustomEvent).detail));
        byLabel(el, 'Media').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicks[0]!.point.label).toBe('Media');
        expect(clicks[0]!.event).toBeInstanceOf(MouseEvent);
        byLabel(el, 'Docs').focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(clicks.slice(1).map((c) => c.point.label)).toEqual(['Docs', 'Docs']);
        expect(clicks[1]!.event).toBeUndefined();
        expect(clicks[0]!.index).toBe(0);
        expect(el.hoverIndex).not.toBeNull();
    });

    it('says so when nothing has a positive value, and names itself for assistive tech', async () => {
        const empty = await chart('heading="Disk"', [{ label: 'x', value: 0 }, { label: 'y', value: -3 }]);
        expect(root(empty).querySelector('[data-slot="treemap-empty"]')!.textContent).toBe('No data to display');
        expect(cells(empty)).toHaveLength(0);
        expect(root(empty).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Disk. Treemap with 2 data points.');
        const none = await chart('', []);
        expect(root(none).querySelector('[data-slot="treemap-empty"]')).not.toBeNull();
    });

    it('re-lays out when the box is resized', async () => {
        const el = await chart();
        const before = byLabel(el, 'Photos').querySelector('rect')!.getBoundingClientRect().width;
        el.parentElement!.style.width = '300px';
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(root(el).querySelector('svg')!.getBoundingClientRect().width).toBe(300);
        expect(byLabel(el, 'Photos').querySelector('rect')!.getBoundingClientRect().width).toBeLessThan(before);
    });
});
