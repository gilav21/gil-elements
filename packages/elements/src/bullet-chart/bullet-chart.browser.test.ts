import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeBulletChart } from './index.js';

const bullet = async (attrs: string, ranges?: number[]) => {
    const page = await mount(`<div style="width:400px"><ge-bullet-chart ${attrs}></ge-bullet-chart></div>`);
    const el = page.querySelector<GeBulletChart>('ge-bullet-chart')!;
    if (ranges) el.ranges = ranges;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const box = (el: Element, slot: string) => root(el).querySelector(`[data-slot="${slot}"]`)!.getBoundingClientRect();
const bands = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="bullet-range"]')];
const track = (el: Element) => root(el).querySelector('svg')!.getBoundingClientRect();

describe('ge-bullet-chart', () => {
    it('scales the measure and target to the largest of value, target and ranges, from the left end of the track', async () => {
        const el = await bullet('value="50" target="80"', [100]);
        const t = track(el);
        const measure = box(el, 'bullet-measure');
        expect(measure.left).toBeCloseTo(t.left + 4, 0);
        expect(measure.width).toBeCloseTo((t.width - 8) * 0.5, 0);
        const target = box(el, 'bullet-target');
        expect(target.left + target.width / 2).toBeCloseTo(t.left + 4 + (t.width - 8) * 0.8, 0);
        expect(target.top).toBeCloseTo(t.top + t.height * 0.18, 0);
        const beyond = await bullet('value="50" target="200"', [100]);
        expect(box(beyond, 'bullet-measure').width).toBeCloseTo((track(beyond).width - 8) * 0.25, 0);
    });

    it('draws a band from each bound to the next, in order whatever order they were given, getting darker', async () => {
        const el = await bullet('value="40"', [100, 30, 60]);
        const [a, b, c] = bands(el).map((r) => r.getBoundingClientRect());
        expect(a!.width).toBeCloseTo(((a!.width + b!.width + c!.width) * 30) / 100, 0);
        expect(b!.left).toBeCloseTo(a!.right, 0);
        expect(c!.left).toBeCloseTo(b!.right, 0);
        const opacity = bands(el).map((r) => Number(r.getAttribute('fill-opacity')));
        expect(opacity[0]).toBeLessThan(opacity[1]!);
        expect(opacity[1]).toBeLessThan(opacity[2]!);
    });

    it('fills the measure with the primary colour unless colour is set, and keeps it thinner than the bands', async () => {
        const plain = await bullet('value="50"', [100]);
        const primary = getComputedStyle(plain).getPropertyValue('--primary').trim();
        expect(primary).not.toBe('');
        const probe = document.createElement('i');
        probe.style.color = 'var(--primary)';
        document.body.append(probe);
        const expected = getComputedStyle(probe).color;
        probe.remove();
        expect(getComputedStyle(root(plain).querySelector('[data-slot="bullet-measure"]')!).fill).toBe(expected);
        const custom = await bullet('value="50" color="rgb(225, 29, 72)"', [100]);
        expect(getComputedStyle(root(custom).querySelector('[data-slot="bullet-measure"]')!).fill).toBe('rgb(225, 29, 72)');
        expect(box(plain, 'bullet-measure').height).toBeCloseTo(box(plain, 'bullet-range').height / 3, 0);
    });

    it('clamps the measure to the track and starts the scale at min', async () => {
        const over = await bullet('value="140" target="90"', [50, 100]);
        expect(box(over, 'bullet-measure').width).toBeCloseTo(track(over).width - 8, 0);
        const shifted = await bullet('value="10" min="-50"', [50]);
        expect(box(shifted, 'bullet-measure').width).toBeCloseTo((track(shifted).width - 8) * (60 / 100), 0);
        expect(bands(shifted)[0]!.getBoundingClientRect().width).toBeCloseTo(track(shifted).width - 8, 0);
        const under = await bullet('value="-80" min="-50"', [50]);
        expect(box(under, 'bullet-measure').width).toBeCloseTo(0, 0);
    });

    it('omits the target mark without a target and describes the value, label, unit and target for assistive tech', async () => {
        const el = await bullet('value="70" target="80" label="Revenue" unit="k" heading="Q3"', [100]);
        expect(root(el).querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Q3. Bullet chart. Revenue: 70k (target 80k).');
        const none = await bullet('value="70"');
        expect(root(none).querySelector('[data-slot="bullet-target"]')).toBeNull();
        expect(root(none).querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Bullet chart. 70.');
    });
});
