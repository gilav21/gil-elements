import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartDataPoint, GeBarRaceChart } from './index.js';

const pts = (values: Record<string, number>): ChartDataPoint[] => Object.entries(values).map(([name, value]) => ({ name, value }));
const FRAMES = [pts({ Apple: 120, Banana: 80, Cherry: 60, Date: 20 }), pts({ Apple: 130, Banana: 160, Cherry: 90, Date: 40 }), pts({ Apple: 150, Banana: 170, Cherry: 240, Date: 75 })];
const LABELS = ['2021', '2022', '2023'];
const chart = async (attrs = '', frames = FRAMES, labels = LABELS) => {
    const page = await mount(`<div style="width:600px"><ge-bar-race-chart ${attrs}></ge-bar-race-chart></div>`);
    const el = page.querySelector<GeBarRaceChart>('ge-bar-race-chart')!;
    el.frames = frames;
    el.frameLabels = labels;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const rects = (el: Element) => [...root(el).querySelectorAll<SVGRectElement>('[data-slot="race-bar"] rect')];
const names = (el: Element) => [...root(el).querySelectorAll('[data-slot="race-bar"] .name')].map((t) => t.textContent);
const values = (el: Element) => [...root(el).querySelectorAll('[data-slot="race-bar"] .value')].map((t) => t.textContent);
const events = (el: Element, name: string) => {
    const seen: unknown[] = [];
    el.addEventListener(name, (e) => seen.push((e as CustomEvent).detail));
    return seen;
};
const tick = async (el: GeBarRaceChart, ms: number) => {
    await vi.advanceTimersByTimeAsync(ms);
    await el.updateComplete;
};

afterEach(() => vi.useRealTimers());

describe('ge-bar-race-chart', () => {
    it('ranks the frame by value, cuts it to max-bars and lets the last entry of a name win', async () => {
        const dup = [[...pts({ A: 5, B: 50, C: 20, D: 10 }), { name: 'A', value: 90 }]];
        const el = await chart('max-bars="3"', dup, []);
        expect(names(el)).toEqual(['A', 'B', 'C']);
        expect(values(el)).toEqual(['90', '50', '20']);
        const [a, b] = rects(el).map((r) => Number(r.getAttribute('width')));
        expect(a).toBeGreaterThan(b!);
    });

    it('moves the same bar to its new rank and length when the frame changes, instead of replacing it', async () => {
        const el = await chart();
        const cherry = () => rects(el)[names(el).indexOf('Cherry')]!;
        const node = cherry();
        const before = { y: Number(node.getAttribute('y')), width: Number(node.getAttribute('width')) };
        expect(names(el)).toEqual(['Apple', 'Banana', 'Cherry', 'Date']);
        el.goToFrame(2);
        await el.updateComplete;
        expect(names(el)).toEqual(['Cherry', 'Banana', 'Apple', 'Date']);
        expect(cherry()).toBe(node);
        expect(Number(node.getAttribute('y'))).toBeLessThan(before.y);
        expect(Number(node.getAttribute('width'))).toBeGreaterThan(before.width);
        expect(root(el).querySelector('.caption')!.textContent).toBe('2023');
    });

    it('keeps a name\'s colour across frames, takes a point\'s own colour, and falls back to "Frame N" without a label', async () => {
        const frames = [[{ name: 'Red', value: 5, color: '#ef4444' }, { name: 'B', value: 3 }], [{ name: 'B', value: 9 }, { name: 'Red', value: 1, color: '#ef4444' }]];
        const el = await chart('', frames, []);
        const fill = (n: string) => rects(el)[names(el).indexOf(n)]!.getAttribute('fill');
        const before = { red: fill('Red'), b: fill('B') };
        expect(before.red).toBe('#ef4444');
        el.goToFrame(1);
        await el.updateComplete;
        expect(fill('Red')).toBe(before.red);
        expect(fill('B')).toBe(before.b);
        expect(root(el).querySelector('.caption')!.textContent).toBe('Frame 2');
        expect(root(el).querySelector('.ends')!.children).toHaveLength(0);
    });

    it('grows negative bars from the zero baseline toward the start edge, and moves a crowded label inside the bar', async () => {
        const el = await chart('', [pts({ Revenue: 1200, Loss: -450, Refunds: -40 })], []);
        const box = (n: string) => {
            const r = rects(el)[names(el).indexOf(n)]!;
            return { x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')) };
        };
        const rev = box('Revenue');
        const loss = box('Loss');
        expect(loss.x + loss.w).toBeCloseTo(rev.x, 5);
        const label = (n: string) => root(el).querySelectorAll<SVGTextElement>('[data-slot="race-bar"] .value')[names(el).indexOf(n)]!;
        expect(label('Revenue').getAttribute('text-anchor')).toBe('start');
        expect(label('Refunds').getAttribute('text-anchor')).toBe('end');
        expect(Number(label('Refunds').getAttribute('x'))).toBeLessThan(box('Refunds').x);
        expect(label('Loss').getAttribute('text-anchor')).toBe('start');
        expect(Number(label('Loss').getAttribute('x'))).toBeGreaterThan(loss.x);
    });

    it('plays one frame per animation-duration, then stops and fires animation-complete once', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const el = await chart('animation-duration="200"');
        const frames = events(el, 'frame-change');
        const done = events(el, 'animation-complete');
        el.play();
        expect(frames).toEqual([1]);
        expect(el.playing).toBe(true);
        await tick(el, 200);
        expect(frames).toEqual([1, 2]);
        expect(done).toHaveLength(0);
        await tick(el, 200);
        expect(done).toHaveLength(1);
        expect(el.playing).toBe(false);
        expect(frames).toEqual([1, 2]);
        await tick(el, 1000);
        expect(done).toHaveLength(1);
    });

    it('wraps to the first frame while looping and never completes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const el = await chart('loop animation-duration="100"');
        const frames = events(el, 'frame-change');
        const done = events(el, 'animation-complete');
        el.play();
        await tick(el, 300);
        expect(frames).toEqual([1, 2, 0, 1]);
        expect(done).toHaveLength(0);
        el.pause();
    });

    it('pause stops on the current frame without completing, and play resumes from there', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const el = await chart('animation-duration="100"');
        const done = events(el, 'animation-complete');
        el.togglePlay();
        el.togglePlay();
        await tick(el, 1000);
        expect(el.frameIndex).toBe(1);
        expect(done).toHaveLength(0);
        el.play();
        expect(el.frameIndex).toBe(2);
    });

    it('reset returns to the first frame and stays stopped; goToFrame clamps and repeats a frame it is already on', async () => {
        const el = await chart();
        const frames = events(el, 'frame-change');
        el.goToFrame(9);
        el.goToFrame(9);
        el.goToFrame(-4);
        expect(frames).toEqual([2, 2, 0]);
        el.goToFrame(2);
        el.reset();
        expect(el.frameIndex).toBe(0);
        expect(el.playing).toBe(false);
        expect(frames.at(-1)).toBe(0);
    });

    it('scrubbing the slider pauses playback and jumps to that frame; the buttons reflect the state', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const el = await chart('animation-duration="100"');
        const play = root(el).querySelector<HTMLButtonElement>('[data-slot="race-play"]')!;
        expect(play.getAttribute('aria-label')).toBe('Play');
        play.click();
        await el.updateComplete;
        expect(play.getAttribute('aria-label')).toBe('Pause');
        const slider = root(el).querySelector<HTMLInputElement>('[data-slot="race-slider"]')!;
        slider.value = '0';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await tick(el, 1000);
        expect(el.playing).toBe(false);
        expect(el.frameIndex).toBe(0);
        expect(slider.getAttribute('aria-valuetext')).toBe('2021');
        expect(slider.max).toBe('2');
        expect([...root(el).querySelectorAll('.ends span')].map((s) => s.textContent)).toEqual(['2021', '2023']);
    });

    it('starts on its own with auto-play once frames exist, and does not start again after it has finished', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const el = await chart('auto-play animation-duration="100"');
        const done = events(el, 'animation-complete');
        expect(el.playing).toBe(true);
        expect(el.frameIndex).toBe(1);
        await tick(el, 1000);
        expect(done).toHaveLength(1);
        expect(el.playing).toBe(false);
        expect(el.frameIndex).toBe(2);
    });

    it('names the controls in the chosen locale and lays out right to left for an RTL locale or direction', async () => {
        const he = await chart('locale="he"');
        expect(root(he).querySelector('[data-slot="bar-race-chart"]')!.getAttribute('dir')).toBe('rtl');
        expect(root(he).querySelector('[data-slot="race-play"]')!.getAttribute('aria-label')).toBe('הפעל');
        const en = await chart();
        expect(root(en).querySelector('[data-slot="bar-race-chart"]')!.hasAttribute('dir')).toBe(false);
        const rtl = await chart('dir="rtl"');
        const nameX = (e: Element) => Number(root(e).querySelector('.name')!.getAttribute('x'));
        expect(nameX(rtl)).toBeGreaterThan(nameX(en));
        const zero = (e: GeBarRaceChart) => root(e).querySelector('svg[role="img"]')!.getBoundingClientRect();
        expect(rects(rtl)[0]!.getBoundingClientRect().right).toBeCloseTo(zero(rtl).right - 120, 0);
        expect(rects(en)[0]!.getBoundingClientRect().left).toBeCloseTo(zero(en).left + 120, 0);
    });

    it('shows no bars for an empty frame, and describes the chart for assistive tech', async () => {
        const el = await chart('heading="Fruit"', [[]], ['Nothing']);
        expect(rects(el)).toHaveLength(0);
        expect(root(el).querySelector('svg[role="img"]')!.getAttribute('aria-label')).toBe('Fruit. Bar race chart with 0 data points.');
    });
});
