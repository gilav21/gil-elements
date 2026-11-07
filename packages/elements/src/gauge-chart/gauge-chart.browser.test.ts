import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GaugeThreshold, GeGaugeChart } from './index.js';

const ZONES: GaugeThreshold[] = [{ value: 0, color: 'rgb(34, 197, 94)' }, { value: 85, color: 'rgb(239, 68, 68)' }, { value: 60, color: 'rgb(234, 179, 8)' }];
const gauge = async (attrs: string, thresholds?: GaugeThreshold[]) => {
    const page = await mount(`<div style="width:220px"><ge-gauge-chart ${attrs}></ge-gauge-chart></div>`);
    const el = page.querySelector<GeGaugeChart>('ge-gauge-chart')!;
    if (thresholds) el.thresholds = thresholds;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const track = (el: Element) => root(el).querySelector('[data-slot="gauge-track"]')!.getBoundingClientRect();
const fill = (el: Element) => root(el).querySelector('[data-slot="gauge-value"]');
const filled = (el: Element) => fill(el)!.getBoundingClientRect();
const colour = (el: Element) => getComputedStyle(fill(el)!).fill;

describe('ge-gauge-chart', () => {
    it('fills the dial from the left in proportion to the value within min and max', async () => {
        const el = await gauge('value="300" min="200" max="1000"');
        const t = track(el);
        const f = filled(el);
        expect(f.left).toBeCloseTo(t.left, 0);
        const half = await gauge('value="50"');
        expect(filled(half).right).toBeCloseTo(track(half).left + track(half).width / 2, 0);
        expect(f.right).toBeLessThan(track(half).right);
        expect(filled(el).width).toBeLessThan(filled(half).width);
        expect(f.right).toBeCloseTo(filled(await gauge('value="12.5"')).right, 3);
    });

    it('draws nothing at or below min and the whole dial at or above max', async () => {
        expect(fill(await gauge('value="0"'))).toBeNull();
        expect(fill(await gauge('value="-20"'))).toBeNull();
        const full = await gauge('value="140"');
        expect(filled(full).width).toBeCloseTo(track(full).width, 0);
        expect(fill(await gauge('value="5" min="10" max="10"'))).toBeNull();
        expect(fill(await gauge('value="15" min="10" max="10"'))).toBeNull();
    });

    it('takes the colour of the highest threshold reached, whatever order they are given in', async () => {
        expect(colour(await gauge('value="30"', ZONES))).toBe('rgb(34, 197, 94)');
        expect(colour(await gauge('value="70"', ZONES))).toBe('rgb(234, 179, 8)');
        expect(colour(await gauge('value="92"', ZONES))).toBe('rgb(239, 68, 68)');
        expect(colour(await gauge('value="85"', ZONES))).toBe('rgb(239, 68, 68)');
        const unreached = await gauge('value="30"', [{ value: 90, color: 'rgb(1, 2, 3)' }]);
        expect(colour(unreached)).not.toBe('rgb(1, 2, 3)');
        expect(colour(unreached)).toBe(colour(await gauge('value="30"')));
    });

    it('reads the value with its unit and the label, and describes the gauge for assistive tech', async () => {
        const el = await gauge('value="72" unit="%" label="CPU load" heading="Server"');
        const texts = [...root(el).querySelectorAll('text')].map((t) => t.textContent);
        expect(texts).toEqual(['72%', 'CPU load']);
        expect(root(el).querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Server. Gauge. CPU load: 72% of 100%.');
    });

    it('drops the readout with show-value="false" but keeps the label', async () => {
        const el = await gauge('value="40" show-value="false" label="Quiet"');
        expect([...root(el).querySelectorAll('text')].map((t) => t.textContent)).toEqual(['Quiet']);
    });

    it('widens the band with thickness: a point 85% of the way out is inside a thick band and in the hole of a thin one', async () => {
        const insideBand = async (thickness: string) => {
            const el = await gauge(`value="100" size="220" thickness="${thickness}"`);
            const path = root(el).querySelector<SVGPathElement>('[data-slot="gauge-value"]')!;
            return path.isPointInFill(new DOMPoint(110 - 0.85 * 102, 110));
        };
        expect(await insideBand('0.5')).toBe(true);
        expect(await insideBand('0.08')).toBe(false);
    });
});
