import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { ChartClickEvent } from '../shared/chart/chart.types.js';
import { formatPeriod, isRising, normalizeOhlc, ohlcExtent, toTimestamp, type GeCandlestick, type OhlcPoint } from './index.js';

const day = (n: number) => `2024-03-${String(n).padStart(2, '0')}`;
const WEEK: OhlcPoint[] = [
    { date: day(4), open: 100, high: 108, low: 98, close: 105 },
    { date: day(5), open: 105, high: 110, low: 101, close: 102 },
    { date: day(6), open: 102, high: 104, low: 95, close: 96 },
    { date: day(7), open: 96, high: 103, low: 94, close: 102 },
    { date: day(8), open: 102, high: 112, low: 102, close: 102 },
];

const chart = async (attrs = '', points: OhlcPoint[] = WEEK, width = 500) => {
    const page = await mount(`<div style="width:${width}px"><ge-candlestick ${attrs}></ge-candlestick></div>`);
    const el = page.querySelector<GeCandlestick>('ge-candlestick')!;
    el.points = points;
    await el.updateComplete;
    return el;
};
const root = (el: Element) => el.shadowRoot!;
const candles = (el: Element) => [...root(el).querySelectorAll<SVGGElement>('[data-slot="candlestick-candle"]')];
const body = (g: Element) => g.querySelector('[data-slot="candlestick-body"]')!.getBoundingClientRect();
const wick = (g: Element) => g.querySelector('[data-slot="candlestick-wick"]')!.getBoundingClientRect();
const ticks = (el: Element) => [...root(el).querySelectorAll('text.tick')].map((t) => t.textContent!);
const tipText = (el: Element) => root(el).querySelector('ge-chart-tooltip')!.shadowRoot!.querySelector('[role="tooltip"]')!.textContent!.replaceAll(/\s+/g, '');
const hover = async (el: GeCandlestick, i: number) => {
    candles(el)[i]!.dispatchEvent(new MouseEvent('mouseenter'));
    await el.updateComplete;
    await root(el).querySelector('ge-chart-tooltip')!.updateComplete;
};

describe('candlestick helpers', () => {
    it('reads a Date, epoch ms or ISO string as a time, and anything else as no time, never Invalid Date', () => {
        const ms = Date.UTC(2024, 2, 4);
        expect(toTimestamp(new Date(ms))).toBe(ms);
        expect(toTimestamp(ms)).toBe(ms);
        expect(toTimestamp('2024-03-04')).toBe(ms);
        expect(toTimestamp('2024-03-04T10:30:00Z')).toBe(Date.UTC(2024, 2, 4, 10, 30));
        for (const bad of ['Week 1', 'March', '', Number.NaN, Number.POSITIVE_INFINITY]) expect(toTimestamp(bad)).toBeNaN();
        expect(formatPeriod('2024-03-04')).toBe('Mar 4');
        expect(formatPeriod(Date.UTC(2024, 2, 4), 'de-DE')).toBe(new Intl.DateTimeFormat('de-DE', { month: 'short', day: 'numeric' }).format(Date.UTC(2024, 2, 4)));
        expect(formatPeriod('Week 1')).toBe('Week 1');
    });

    it('calls a close at or above the open rising, drops rows with any non-finite price, and finds the extent over all four prices', () => {
        expect(isRising({ date: 'a', open: 1, high: 2, low: 0, close: 1 })).toBe(true);
        expect(isRising({ date: 'a', open: 2, high: 2, low: 0, close: 1 })).toBe(false);
        const rows: OhlcPoint[] = [WEEK[0]!, { date: 'x', open: Number.NaN, high: 1, low: 1, close: 1 }, { date: 'y', open: 1, high: Number.POSITIVE_INFINITY, low: 1, close: 1 }, WEEK[1]!];
        expect(normalizeOhlc(rows)).toEqual([WEEK[0], WEEK[1]]);
        for (const field of ['open', 'high', 'low', 'close'] as const) expect(normalizeOhlc([{ ...WEEK[0]!, [field]: Number.NEGATIVE_INFINITY }])).toEqual([]);
        expect(ohlcExtent(WEEK)).toEqual([94, 112]);
        expect(ohlcExtent([])).toBeNull();
        expect(ohlcExtent([{ date: 'z', open: 50, high: 40, low: 60, close: 55 }])).toEqual([40, 60]);
        expect(ohlcExtent(Array.from({ length: 200_000 }, (...[, i]) => ({ date: i, open: i, high: i + 1, low: i - 1, close: i }))))
            .toEqual([-1, 200_000]);
    });
});

describe('ge-candlestick', () => {
    it('draws a candle per period in order, bodies from open to close and wicks from low to high, on one price scale', async () => {
        const el = await chart();
        const c = candles(el);
        expect(c).toHaveLength(5);
        expect(body(c[0]!).left).toBeLessThan(body(c[1]!).left);
        expect(body(c[3]!).left).toBeLessThan(body(c[4]!).left);
        const perUnit = body(c[0]!).height / 5;
        expect(body(c[1]!).height).toBeCloseTo(3 * perUnit, 0);
        expect(wick(c[0]!).height).toBeCloseTo(10 * perUnit, 0);
        expect(wick(c[2]!).height).toBeCloseTo(9 * perUnit, 0);
        expect(wick(c[0]!).top).toBeLessThan(body(c[0]!).top + 0.5);
        expect(wick(c[0]!).left + wick(c[0]!).width / 2).toBeCloseTo(body(c[0]!).left + body(c[0]!).width / 2, 0);
        expect(root(el).querySelector('svg')!.getBoundingClientRect().height).toBe(300);
    });

    it('colours rising candles green and falling red, a doji counting as rising, and takes custom colours', async () => {
        const el = await chart();
        const fill = (i: number) => candles(el)[i]!.querySelector('[data-slot="candlestick-body"]')!.getAttribute('fill');
        expect([0, 1, 2, 3, 4].map((i) => candles(el)[i]!.dataset.direction)).toEqual(['rising', 'falling', 'falling', 'rising', 'rising']);
        expect(fill(0)).toBe('hsl(142, 71%, 45%)');
        expect(fill(1)).toBe('hsl(0, 84%, 60%)');
        const custom = await chart('rising-color="rgb(0, 0, 255)" falling-color="rgb(255, 0, 255)"');
        expect(candles(custom)[0]!.querySelector('[data-slot="candlestick-wick"]')!.getAttribute('stroke')).toBe('rgb(0, 0, 255)');
        expect(candles(custom)[1]!.querySelector('[data-slot="candlestick-wick"]')!.getAttribute('stroke')).toBe('rgb(255, 0, 255)');
    });

    it('keeps a doji visible as a 1px body, and a candle no wider than 28px however few there are', async () => {
        const el = await chart();
        expect(body(candles(el)[4]!).height).toBeGreaterThanOrEqual(1);
        expect(body(candles(el)[4]!).height).toBeLessThan(3);
        const two = await chart('', WEEK.slice(0, 2));
        expect(body(candles(two)[0]!).width).toBe(28);
        const crowded = await chart('', Array.from({ length: 400 }, (...[, i]) => ({ date: i, open: 10, high: 12, low: 9, close: 11 })));
        expect(body(candles(crowded)[0]!).width).toBeGreaterThanOrEqual(1);
    });

    it('spaces periods evenly on the ordinal axis, a missing weekend leaving no gap, and on the time axis shows the real gap', async () => {
        const gapped: OhlcPoint[] = [WEEK[0]!, WEEK[1]!, { ...WEEK[2]!, date: day(11) }, { ...WEEK[3]!, date: day(12) }];
        const ordinal = await chart('', gapped);
        const left = (el: Element, i: number) => body(candles(el)[i]!).left;
        expect(left(ordinal, 1) - left(ordinal, 0)).toBeCloseTo(left(ordinal, 2) - left(ordinal, 1), 0);
        const time = await chart('axis-mode="time"', gapped);
        expect(left(time, 2) - left(time, 1)).toBeGreaterThan((left(time, 1) - left(time, 0)) * 3);
    });

    it('labels the period axis with every candle up to eight, then every nth, verbatim for text labels', async () => {
        const el = await chart();
        expect(ticks(el).filter((t) => /^Mar \d$/.test(t))).toEqual(['Mar 4', 'Mar 5', 'Mar 6', 'Mar 7', 'Mar 8']);
        const many = await chart('', Array.from({ length: 20 }, (...[, i]) => ({ date: `W${i + 1}`, open: 10, high: 12, low: 9, close: 11 })));
        expect(ticks(many).filter((t) => /^W\d+$/.test(t))).toEqual(['W1', 'W4', 'W7', 'W10', 'W13', 'W16', 'W19']);
        const german = await chart('locale="de-DE"');
        expect(ticks(german)).toContain(new Intl.DateTimeFormat('de-DE', { month: 'short', day: 'numeric' }).format(Date.UTC(2024, 2, 4)));
    });

    it('drops unplaceable rows on the time axis only, and draws a lone period', async () => {
        const mixed: OhlcPoint[] = [{ date: 'Week 1', open: 1, high: 2, low: 0, close: 1 }, WEEK[0]!];
        expect(candles(await chart('', mixed))).toHaveLength(2);
        expect(candles(await chart('axis-mode="time"', mixed))).toHaveLength(1);
        const lone = await chart('axis-mode="time"', [WEEK[0]!]);
        expect(candles(lone)).toHaveLength(1);
        const svg = root(lone).querySelector('svg')!.getBoundingClientRect();
        expect(body(candles(lone)[0]!).left + body(candles(lone)[0]!).width / 2 - svg.left).toBeCloseTo(52, 0);
        const month = Array.from({ length: 30 }, (...[, i]) => ({ date: day(i + 1), open: 10, high: 12, low: 9, close: 11 }));
        const dense = await chart('axis-mode="time"', month);
        expect(body(candles(dense)[0]!).width).toBeCloseTo(((500 - 52 - 12) / 30) * 0.6, 1);
    });

    it('reverses the period axis in RTL, the newest candle on the left, with the price labels on the right', async () => {
        const page = await mount('<div dir="rtl" style="width:500px"><ge-candlestick></ge-candlestick></div>');
        const el = page.querySelector<GeCandlestick>('ge-candlestick')!;
        el.points = WEEK;
        await el.updateComplete;
        expect(body(candles(el)[0]!).left).toBeGreaterThan(body(candles(el)[4]!).left);
        const price = [...root(el).querySelectorAll('text.tick')].find((t) => t.textContent === '$100' || t.textContent === '100')!;
        expect(price.getBoundingClientRect().left).toBeGreaterThan(body(candles(el)[0]!).right);
        const time = await mount('<div dir="rtl" style="width:500px"><ge-candlestick axis-mode="time"></ge-candlestick></div>');
        const t = time.querySelector<GeCandlestick>('ge-candlestick')!;
        t.points = WEEK;
        await t.updateComplete;
        expect(body(candles(t)[0]!).left).toBeGreaterThan(body(candles(t)[4]!).left);
    });

    it('lists open, high, low and close with the unit for the hovered candle, dims the rest, emits hover, then clears', async () => {
        const el = await chart('unit="$"');
        const seen: (ChartClickEvent<OhlcPoint> | null)[] = [];
        el.addEventListener('candle-hover', (event) => seen.push((event as CustomEvent).detail));
        await hover(el, 2);
        expect(tipText(el)).toBe('Mar6Open102$High104$Low95$Close96$');
        expect(getComputedStyle(candles(el)[0]!).opacity).toBe('0.5');
        expect(getComputedStyle(candles(el)[2]!).opacity).toBe('1');
        expect(seen[0]!.point.close).toBe(96);
        candles(el)[2]!.dispatchEvent(new MouseEvent('mouseleave'));
        await el.updateComplete;
        expect(seen.at(-1)).toBeNull();
        expect(candles(el)[2]!.getAttribute('aria-label')).toBe('Mar 6: open 102$, high 104$, low 95$, close 96$');
        expect(root(await chart('show-tooltip="false"')).querySelector('ge-chart-tooltip')).toBeNull();
    });

    it('activates on click, Enter and Space and takes focus', async () => {
        const el = await chart();
        const clicks: ChartClickEvent<OhlcPoint>[] = [];
        el.addEventListener('candle-click', (event) => clicks.push((event as CustomEvent).detail));
        candles(el)[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(clicks[0]!.point.open).toBe(96);
        expect(clicks[0]!.event).toBeInstanceOf(MouseEvent);
        candles(el)[1]!.focus();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');
        expect(clicks.slice(1).map((c) => c.index)).toEqual([1, 1]);
        expect(clicks[1]!.event).toBeUndefined();
    });

    it('draws price gridlines and labels, the grid hideable on its own, and says so when no row is usable', async () => {
        const el = await chart();
        expect(root(el).querySelectorAll('[data-slot="grid-line"]').length).toBeGreaterThanOrEqual(4);
        const none = await chart('show-grid="false"');
        expect(root(none).querySelectorAll('[data-slot="grid-line"]')).toHaveLength(0);
        expect(ticks(none).length).toBeGreaterThan(5);
        const empty = await chart('heading="ACME"', [{ date: 'x', open: Number.NaN, high: 1, low: 1, close: 1 }]);
        expect(root(empty).querySelector('[data-slot="candlestick-empty"]')!.textContent).toBe('No data to display');
        expect(root(empty).querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('ACME. Candlestick chart with 0 data points.');
        expect(root(await chart('', [])).querySelector('[data-slot="candlestick-empty"]')).not.toBeNull();
    });
});
