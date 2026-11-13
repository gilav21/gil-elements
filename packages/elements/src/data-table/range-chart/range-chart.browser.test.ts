/**
 * `ge-data-table-range-chart` in a real browser (spec E): the dialog, the switcher, the three charts, the series picker, the `for`
 * wiring on a real `ge-data-table`, focus return, the accessible figure, axe, forced colours, and the integration with a real
 * wave-6 range selection and the readout's Chart button.
 */
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../define.js';
import { mount, useTheme } from '../../test-utils.js';
import type { GeDataTable } from '../data-table.js';
import { axTree, cellAt, mountTable, q, send, settle as settleTable, type SampleRow } from '../data-table-fixtures.js';
import { frames, mouseDrag, parkMouse } from '../data-table-input-fixtures.js';
import type { ColumnDef, RangeChartPayload } from '../data-table.types.js';
import { RANGE_CHART_LOCALES, type GeDataTableRangeChart, type RangeChartData } from './index.js';

const SINGLE: RangeChartData = { categories: ['Alice', 'Bob'], series: [{ name: 'Sales', values: [10, 30] }] };
const MULTI: RangeChartData = {
    categories: ['Alice', 'Bob', 'Cara'],
    series: [
        { name: 'Q1', values: [10, 30, 20] },
        { name: 'Q2', values: [20, 40, 5] },
    ],
};

beforeEach(async () => {
    await parkMouse();
});
afterEach(async () => {
    await parkMouse();
    await send('Emulation.setEmulatedMedia', { features: [] });
});

async function settle(el: GeDataTableRangeChart): Promise<void> {
    await el.updateComplete;
    await frames(2);
    await el.updateComplete;
}

async function chart(payload: RangeChartData | null = MULTI, attrs = 'open'): Promise<GeDataTableRangeChart> {
    const page = await mount(`<ge-data-table-range-chart ${attrs}></ge-data-table-range-chart>`);
    const el = page.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
    el.payload = payload;
    await settle(el);
    return el;
}

const root = (el: GeDataTableRangeChart): ShadowRoot => el.shadowRoot!;
const switches = (el: GeDataTableRangeChart): HTMLElement[] => [...root(el).querySelectorAll<HTMLElement>('[data-slot="range-chart-switcher"] ge-button')];
const inner = (button: Element): HTMLButtonElement => button.shadowRoot!.querySelector('button')!;
const labels = (el: GeDataTableRangeChart): string[] => switches(el).map((b) => b.textContent!.trim());
const pressed = (el: GeDataTableRangeChart): string[] => switches(el).map((b) => inner(b).getAttribute('aria-pressed')!);
const switchFor = (el: GeDataTableRangeChart, type: string): HTMLButtonElement => inner(root(el).querySelector(`[data-slot="range-chart-switcher"] ge-button[data-type="${type}"]`)!);
const drawn = (el: GeDataTableRangeChart): string[] => ['ge-bar-chart', 'ge-pie-chart', 'ge-stacked-bar-chart'].filter((tag) => root(el).querySelector(tag));
const panel = (el: GeDataTableRangeChart): HTMLElement | null => root(el).querySelector('ge-dialog-content')!.shadowRoot!.querySelector<HTMLElement>('[role="dialog"]');
const figure = (el: GeDataTableRangeChart): HTMLElement => root(el).querySelector<HTMLElement>('[data-slot="range-chart-canvas"]')!;
const deepActive = (): Element | null => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
};
/**
 * `label-content-name-mismatch` is an experimental axe rule; `ge-pie-chart` itself trips it (a slice's visible "16.7%" against its
 * name "Alice: 10 (16.7%) of 60 total", pie-chart.ts sliceGroup), so it is the pie chart's to settle, not this dialog's; only the pie case turns it off.
 */
const violations = async (el: Element, pie = false): Promise<string[]> => {
    const result = await axe.run(el, pie ? { rules: { 'label-content-name-mismatch': { enabled: false } } } : {});
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
};

describe('the dialog', () => {
    it('draws nothing while closed and a named modal dialog with the default title when open', async () => {
        const el = await chart(MULTI, '');
        expect(panel(el)).toBeNull();
        expect(root(el).querySelector('[data-slot="range-chart"]')).toBeNull();
        el.open = true;
        await settle(el);
        expect(panel(el)!.getAttribute('aria-modal')).toBe('true');
        expect(panel(el)!.getAttribute('aria-label')).toBe('Chart');
        expect(root(el).querySelector('ge-dialog-content')!.shadowRoot!.querySelector('ge-dialog-title')!.textContent!.trim()).toBe('Chart');
    });

    it('takes the title from heading', async () => {
        const el = await chart(MULTI, 'open heading="Range Report"');
        expect(panel(el)!.getAttribute('aria-label')).toBe('Range Report');
        expect(root(el).querySelector('ge-dialog-content')!.shadowRoot!.querySelector('ge-dialog-title')!.textContent!.trim()).toBe('Range Report');
    });

    it('closes on Escape, says so once and returns focus to where it was', async () => {
        const page = await mount(`<button id="opener">Open</button>`);
        const opener = page.querySelector<HTMLButtonElement>('#opener')!;
        opener.focus();
        const el = await chart(MULTI, '');
        const changes: boolean[] = [];
        el.addEventListener('open-change', (event) => changes.push((event as CustomEvent<boolean>).detail));
        el.open = true;
        await settle(el);
        await vi.waitFor(() => expect(document.activeElement).toBe(el));
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect(el.open).toBe(false);
        expect(el.hasAttribute('open')).toBe(false);
        expect(changes).toEqual([false]);
        expect(document.activeElement).toBe(opener);
    });
});

describe('the switcher', () => {
    it('offers bar, pie and stacked for several series, and no stacked for one, as a named group', async () => {
        const el = await chart(MULTI);
        expect(labels(el)).toEqual(['Bar', 'Pie', 'Stacked']);
        expect(root(el).querySelector('[data-slot="range-chart-switcher"]')!.getAttribute('role')).toBe('group');
        expect(root(el).querySelector('[data-slot="range-chart-switcher"]')!.getAttribute('aria-label')).toBe('Chart type');
        el.payload = SINGLE;
        await settle(el);
        expect(labels(el)).toEqual(['Bar', 'Pie']);
    });

    it('draws the bar chart first, then pie and stacked on a real click, with aria-pressed and chart-type-change', async () => {
        const el = await chart(MULTI);
        const types: string[] = [];
        el.addEventListener('chart-type-change', (event) => types.push((event as CustomEvent<string>).detail));
        expect(drawn(el)).toEqual(['ge-bar-chart']);
        expect(pressed(el)).toEqual(['true', 'false', 'false']);

        await userEvent.click(switchFor(el, 'pie'));
        await settle(el);
        expect(drawn(el)).toEqual(['ge-pie-chart']);
        expect(pressed(el)).toEqual(['false', 'true', 'false']);
        expect(el.chartType).toBe('pie');
        expect(el.getAttribute('chart-type')).toBe('pie');

        await userEvent.click(switchFor(el, 'stacked'));
        await settle(el);
        expect(drawn(el)).toEqual(['ge-stacked-bar-chart']);
        const stacked = root(el).querySelector('ge-stacked-bar-chart') as HTMLElement & { series: { name: string }[]; categories: string[] };
        expect(stacked.series.map((s) => s.name)).toEqual(['Q1', 'Q2']);
        expect(stacked.categories).toEqual(['Alice', 'Bob', 'Cara']);

        // pressing the pressed switch changes nothing
        await userEvent.click(switchFor(el, 'stacked'));
        await settle(el);
        expect(types).toEqual(['pie', 'stacked']);
    });

    it('draws a bar chart, shown pressed, for chart-type="stacked" with one series', async () => {
        const el = await chart(SINGLE, 'open chart-type="stacked"');
        expect(drawn(el)).toEqual(['ge-bar-chart']);
        expect(pressed(el)).toEqual(['true', 'false']);
        expect(el.chartType).toBe('stacked');
        el.payload = MULTI;
        await settle(el);
        expect(drawn(el)).toEqual(['ge-stacked-bar-chart']);
    });
});

describe('the series picker', () => {
    const bar = (el: GeDataTableRangeChart) => root(el).querySelector('ge-bar-chart') as HTMLElement & { data: { name: string; value: number }[] };
    const picker = (el: GeDataTableRangeChart) => root(el).querySelector<HTMLElement & { value: unknown }>('ge-select');

    it('is shown for bar and pie with several series only, named, and defaults to the first', async () => {
        const el = await chart(MULTI);
        expect(picker(el)).not.toBeNull();
        expect(picker(el)!.value).toBe(0);
        expect(bar(el).data.map((d) => d.value)).toEqual([10, 30, 20]);
        const trigger = picker(el)!.shadowRoot!.querySelector('ge-select-trigger')!.shadowRoot!.querySelector('button')!;
        expect(trigger.ariaLabelledByElements?.map((n) => n.textContent)).toEqual(['Series']);
        el.chartType = 'stacked';
        await settle(el);
        expect(picker(el)).toBeNull();
        el.chartType = 'pie';
        el.payload = SINGLE;
        await settle(el);
        expect(picker(el)).toBeNull();
    });

    it('charts the series picked with real clicks and fires series-change', async () => {
        const el = await chart(MULTI);
        const picks: number[] = [];
        el.addEventListener('series-change', (event) => picks.push((event as CustomEvent<number>).detail));
        // the picker's own change and open-change events stay inside
        let leaked = 0;
        for (const name of ['change', 'input', 'open-change', 'value-change']) el.addEventListener(name, () => leaked++);
        const select = picker(el)!;
        await userEvent.click(select.shadowRoot!.querySelector('ge-select-trigger')!.shadowRoot!.querySelector('button')!);
        await settle(el);
        const items = [...select.shadowRoot!.querySelectorAll<HTMLElement>('ge-select-item')];
        expect(items.map((i) => i.textContent!.trim())).toEqual(['Q1', 'Q2']);
        await userEvent.click(items[1]!);
        await settle(el);
        expect(picks).toEqual([1]);
        expect(leaked).toBe(0);
        expect(el.seriesIndex).toBe(1);
        expect(bar(el).data.map((d) => d.value)).toEqual([20, 40, 5]);
        expect(el.open).toBe(true);
        // the picked series carries over to the pie
        await userEvent.click(switchFor(el, 'pie'));
        await settle(el);
        const pie = root(el).querySelector('ge-pie-chart') as HTMLElement & { data: { value: number }[] };
        expect(pie.data.map((d) => d.value)).toEqual([20, 40, 5]);
    });
});

describe('review fixes', () => {
    const picker = (el: GeDataTableRangeChart) => root(el).querySelector<HTMLElement & { value: unknown }>('ge-select')!;
    const shownSeries = (el: GeDataTableRangeChart) => picker(el).shadowRoot!.querySelector('ge-select-value')!.shadowRoot!.textContent!.trim();

    async function withPageLang(lang: string, run: () => Promise<void>): Promise<void> {
        const before = document.documentElement.lang;
        RANGE_CHART_LOCALES['he'] = { ...RANGE_CHART_LOCALES.en, code: 'he', title: 'תרשים', bar: 'עמודות' } as typeof RANGE_CHART_LOCALES.en;
        document.documentElement.lang = lang;
        try {
            await run();
        } finally {
            document.documentElement.lang = before;
            delete RANGE_CHART_LOCALES['he'];
        }
    }

    it('takes the page language inside a shadow root, as the table does', async () => {
        await withPageLang('he', async () => {
            const page = await mount('<div id="host"></div>');
            const shadow = page.querySelector('#host')!.attachShadow({ mode: 'open' });
            shadow.innerHTML = '<ge-data-table-range-chart open></ge-data-table-range-chart>';
            const el = shadow.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
            el.payload = MULTI;
            await settle(el);
            expect(panel(el)!.getAttribute('aria-label')).toBe('תרשים');
            expect(labels(el)[0]).toBe('עמודות');
        });
    });

    it('falls back to the page language for an unknown locale id, and to English for an entry left undefined', async () => {
        await withPageLang('he', async () => {
            const el = await chart(MULTI, 'open locale="xx"');
            expect(panel(el)!.getAttribute('aria-label')).toBe('תרשים');
            el.locale = { title: undefined } as never;
            await settle(el);
            expect(panel(el)!.getAttribute('aria-label')).toBe('Chart');
            expect(labels(el)[0]).toBe('Bar');
        });
    });

    it('draws an unknown chart-type as bar, pressed and named so', async () => {
        const el = await chart(MULTI, 'open chart-type="line"');
        expect(drawn(el)).toEqual(['ge-bar-chart']);
        expect(pressed(el)).toEqual(['true', 'false', 'false']);
        expect(figure(el).getAttribute('aria-label')).toBe('Chart, Bar chart: Q1');
    });

    it('shows the series a series-change handler puts back', async () => {
        const el = await chart(MULTI);
        el.addEventListener('series-change', () => (el.seriesIndex = 0));
        const select = picker(el);
        await userEvent.click(select.shadowRoot!.querySelector('ge-select-trigger')!.shadowRoot!.querySelector('button')!);
        await settle(el);
        await userEvent.click(select.shadowRoot!.querySelectorAll<HTMLElement>('ge-select-item')[1]!);
        await settle(el);
        expect(el.seriesIndex).toBe(0);
        expect(select.value).toBe(0);
        expect(shownSeries(el)).toBe('Q1');
    });
});

describe('final review fixes', () => {
    const payload: RangeChartPayload = { categories: ['a', 'b'], series: [{ name: 'Q1', values: [1, 2] }, { name: 'Q2', values: [30, 40] }] };

    it('keeps a series-index set before the first range arrives', async () => {
        const table = await mountTable<Row>({ columns: COLUMNS, data: ROWS }, { id: 'early' });
        const page = await mount(`<ge-data-table-range-chart for="early" series-index="1"></ge-data-table-range-chart>`);
        const el = page.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
        await settle(el);
        table.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        await settle(el);
        expect(el.seriesIndex).toBe(1);
        const bar = root(el).querySelector('ge-bar-chart') as HTMLElement & { data: { value: number }[] };
        expect(bar.data.map((d) => d.value)).toEqual([30, 40]);
    });

    it('a click on the drawn type\'s switch makes the pick explicit: stacked with one series becomes bar, once, and stays bar for the next range', async () => {
        const el = await chart(SINGLE, 'open chart-type="stacked"');
        const types: string[] = [];
        el.addEventListener('chart-type-change', (event) => types.push((event as CustomEvent<string>).detail));
        await userEvent.click(switchFor(el, 'bar'));
        await settle(el);
        expect(el.chartType).toBe('bar');
        expect(types).toEqual(['bar']);
        // the value did not change: no second event
        await userEvent.click(switchFor(el, 'bar'));
        await settle(el);
        expect(types).toEqual(['bar']);
        el.payload = MULTI;
        await settle(el);
        expect(drawn(el)).toEqual(['ge-bar-chart']);
    });

    it('shows the series picker\'s last option, unclipped, on a short viewport with many series', async () => {
        await page.viewport(1280, 420);
        try {
            const many: RangeChartData = { categories: ['a', 'b'], series: Array.from({ length: 12 }, (_, i) => ({ name: `S${i + 1}`, values: [i, i + 1] })) };
            const el = await chart(many);
            const select = root(el).querySelector<HTMLElement>('ge-select')!;
            await userEvent.click(select.shadowRoot!.querySelector('ge-select-trigger')!.shadowRoot!.querySelector('button')!);
            await settle(el);
            const items = [...select.shadowRoot!.querySelectorAll<HTMLElement>('ge-select-item')];
            const last = items.at(-1)!;
            // scroll the listbox itself (its own scroller inside the select), never the dialog box: a clipped popup must show as clipped
            const listbox = select.shadowRoot!.querySelector<HTMLElement>('ge-select-content')!;
            const scrollers = [listbox, ...listbox.shadowRoot!.querySelectorAll<HTMLElement>('*')].filter((n) => n.scrollHeight > n.clientHeight + 1);
            for (const scroller of scrollers) scroller.scrollTop = scroller.scrollHeight;
            await frames(2);
            const box = last.getBoundingClientRect();
            expect(box.height).toBeGreaterThan(0);
            expect(box.bottom).toBeLessThanOrEqual(420);
            // what the pointer meets at both ends of the option is the option itself: nothing clips or covers it
            const hitAt = (x: number, y: number): Element | null => {
                let hit: Element | null = document.elementFromPoint(x, y);
                while (hit?.shadowRoot) {
                    const inner = hit.shadowRoot.elementFromPoint(x, y);
                    if (!inner || inner === hit) break;
                    hit = inner;
                }
                return hit;
            };
            for (const x of [box.left + 2, box.right - 2]) {
                const hit = hitAt(x, box.top + box.height / 2);
                expect(last === hit || last.contains(hit) || last.shadowRoot!.contains(hit)).toBe(true);
            }
            expect(panel(el)!.scrollLeft).toBe(0);
            await userEvent.click(last);
            await settle(el);
            expect(el.seriesIndex).toBe(11);
        } finally {
            await page.viewport(1280, 800);
        }
    });

    it('names the figure without a dangling colon when the series has no name', async () => {
        const el = await chart({ categories: ['a'], series: [{ name: '', values: [1] }] });
        expect(figure(el).getAttribute('aria-label')).toBe('Chart, Bar chart');
    });

    it('keeps the panel within a short viewport and scrolls the chart area, with the heading and the switches in view', async () => {
        await page.viewport(1280, 300);
        try {
            const el = await chart(MULTI);
            const box = panel(el)!;
            expect(box.getBoundingClientRect().bottom).toBeLessThanOrEqual(300);
            const scroller = root(el).querySelector<HTMLElement>('[data-slot="range-chart-scroll"]')!;
            expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
            expect(switchFor(el, 'bar').getBoundingClientRect().bottom).toBeLessThanOrEqual(300);
            const title = root(el).querySelector('ge-dialog-content')!.shadowRoot!.querySelector('ge-dialog-title')!;
            expect(title.getBoundingClientRect().top).toBeGreaterThanOrEqual(0);
        } finally {
            await page.viewport(1280, 800);
        }
    });

    it('opens for a table inside a nested shadow root', async () => {
        const wrapper = await mount('<div id="outer"></div><ge-data-table-range-chart for="deep"></ge-data-table-range-chart>');
        const el = wrapper.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
        const inner = wrapper.querySelector('#outer')!.attachShadow({ mode: 'open' });
        inner.innerHTML = '<div id="mid"></div>';
        const deeper = inner.querySelector('#mid')!.attachShadow({ mode: 'open' });
        deeper.innerHTML = '<div id="deep"></div>';
        await settle(el);
        deeper.querySelector('#deep')!.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        await settle(el);
        expect(el.open).toBe(true);
        expect(el.payload).toEqual(payload);
    });
});

describe('last review fixes', () => {
    const payload: RangeChartPayload = { categories: ['a'], series: [{ name: 'S', values: [1] }] };
    const rows = (el: GeDataTableRangeChart) =>
        [...root(el).querySelector<HTMLTableElement>('[data-slot="range-chart-data"]')!.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent));

    it('carries the picked series over to a new range, clamped to it', async () => {
        const el = await chart(MULTI);
        el.seriesIndex = 1;
        await settle(el);
        el.payload = { categories: ['x', 'y'], series: [{ name: 'A', values: [1, 2] }, { name: 'B', values: [3, 4] }] };
        await settle(el);
        expect(el.seriesIndex).toBe(1);
        expect(rows(el)).toEqual([['x', '3'], ['y', '4']]);
        el.payload = { categories: ['x'], series: [{ name: 'A', values: [7] }] };
        await settle(el);
        expect(rows(el)).toEqual([['x', '7']]);
    });

    it('stays open when an open-change handler sets open back', async () => {
        const el = await chart(MULTI);
        el.addEventListener('open-change', () => (el.open = true));
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect(el.open).toBe(true);
        expect(panel(el)).not.toBeNull();
    });

    it('opens only for the event\'s own target, not an ancestor carrying the id', async () => {
        const wrapper = await mount('<div id="anc"><span></span></div><ge-data-table-range-chart for="anc"></ge-data-table-range-chart>');
        const el = wrapper.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
        await settle(el);
        wrapper.querySelector('#anc span')!.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        await settle(el);
        expect(el.open).toBe(false);
    });

    it('lists only what the pie draws in the data table', async () => {
        const el = await chart({ categories: ['a', 'b', 'c'], series: [{ name: 'Delta', values: [5, -3, 2] }] }, 'open chart-type="pie"');
        expect(rows(el)).toEqual([['a', '5'], ['c', '2']]);
        el.chartType = 'bar';
        await settle(el);
        expect(rows(el)).toEqual([['a', '5'], ['b', '-3'], ['c', '2']]);
    });
});

describe('the pie', () => {
    it('leaves negative values out and says so under the chart', async () => {
        const el = await chart({ categories: ['a', 'b', 'c'], series: [{ name: 'Delta', values: [5, -3, 2] }] }, 'open chart-type="pie"');
        const pie = root(el).querySelector('ge-pie-chart') as HTMLElement & { data: { name: string }[] };
        expect(pie.data.map((d) => d.name)).toEqual(['a', 'c']);
        expect(root(el).querySelector('[data-slot="range-chart-note"]')!.textContent!.trim()).toBe('Negative values are left out of the pie.');
        el.chartType = 'bar';
        await settle(el);
        expect(root(el).querySelector('[data-slot="range-chart-note"]')).toBeNull();
    });
});

describe('accessibility', () => {
    it('names the chart as a figure and gives it a visually hidden data table of what it draws', async () => {
        const el = await chart(MULTI, 'open heading="Scores"');
        expect(figure(el).getAttribute('role')).toBe('figure');
        expect(figure(el).getAttribute('aria-label')).toBe('Scores, Bar chart: Q1');
        const table = root(el).querySelector<HTMLTableElement>('[data-slot="range-chart-data"]')!;
        expect(table.parentElement!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
        expect(table.parentElement!.getBoundingClientRect().height).toBeLessThanOrEqual(1);
        expect(table.caption!.textContent).toBe('Chart data');
        expect([...table.tHead!.rows[0]!.cells].map((c) => c.textContent)).toEqual(['Category', 'Q1']);
        expect([...table.tBodies[0]!.rows].map((r) => [...r.cells].map((c) => c.textContent))).toEqual([['Alice', '10'], ['Bob', '30'], ['Cara', '20']]);
        el.chartType = 'stacked';
        await settle(el);
        expect(figure(el).getAttribute('aria-label')).toBe('Scores, Stacked chart: Q1, Q2');
        expect([...table.tHead!.rows[0]!.cells].map((c) => c.textContent)).toEqual(['Category', 'Q1', 'Q2']);

        const tree = await axTree();
        expect(tree.some((n) => n.role?.value === 'figure' && n.name?.value === 'Scores, Stacked chart: Q1, Q2')).toBe(true);
        expect(tree.some((n) => n.role?.value === 'table' && n.name?.value === 'Chart data')).toBe(true);
    });

    it('caps the data table at 50 rows and says so in its caption', async () => {
        const long: RangeChartData = { categories: Array.from({ length: 80 }, (_, i) => `r${i}`), series: [{ name: 'S', values: Array.from({ length: 80 }, (_, i) => i) }] };
        const el = await chart(long);
        const table = root(el).querySelector<HTMLTableElement>('[data-slot="range-chart-data"]')!;
        expect(table.tBodies[0]!.rows).toHaveLength(50);
        expect(table.caption!.textContent).toBe('Chart data, first 50 of 80 rows');
    });

    for (const mode of ['light', 'dark']) {
        for (const type of ['bar', 'pie', 'stacked']) {
            it(`passes axe in ${mode} mode with the ${type} chart`, async () => {
                await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
                useTheme(mode);
                const el = await chart(MULTI, `open chart-type="${type}"`);
                expect(drawn(el)).toHaveLength(1);
                expect(await violations(el, type === 'pie')).toEqual([]);
            });
        }
    }

    it('marks the pressed switch with the system highlight in forced-colors mode', async () => {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
        const el = await chart(MULTI);
        const on = getComputedStyle(switchFor(el, 'bar'));
        const off = getComputedStyle(switchFor(el, 'pie'));
        expect(on.backgroundColor).not.toBe(off.backgroundColor);
        expect(on.color).not.toBe(off.color);
    });
});

interface Row extends SampleRow {
    score: number;
    bonus: number;
}
const ROWS: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, age: 20 + i, score: i + 1, bonus: 10 * (i + 1) }));
const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name', width: '120px' },
    { accessorKey: 'score', header: 'Score', width: '100px' },
    { accessorKey: 'bonus', header: 'Bonus', width: '100px' },
];

async function wired(): Promise<{ table: GeDataTable<Row>; el: GeDataTableRangeChart }> {
    const table = await mountTable<Row>({ columns: COLUMNS, data: ROWS, enableCellRangeSelection: true, enableRangeActions: true }, { id: 'sales' });
    const page = await mount(`<ge-data-table-range-chart for="sales"></ge-data-table-range-chart>`);
    const el = page.querySelector<GeDataTableRangeChart>('ge-data-table-range-chart')!;
    await settle(el);
    return { table, el };
}

describe('for', () => {
    const payload: RangeChartPayload = { categories: ['Row 1', 'Row 2'], series: [{ name: 'Score', values: [1, 2] }] };

    it('opens with the payload of the named table\'s range-chart-open, once, and ignores another table', async () => {
        const { table, el } = await wired();
        const other = await mountTable<Row>({ columns: COLUMNS, data: ROWS }, { id: 'other' });
        const changes: boolean[] = [];
        el.addEventListener('open-change', (event) => changes.push((event as CustomEvent<boolean>).detail));

        other.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        await settle(el);
        expect(el.open).toBe(false);

        table.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        await settle(el);
        expect(el.open).toBe(true);
        expect(el.payload).toEqual(payload);
        expect(changes).toEqual([true]);
        expect(drawn(el)).toEqual(['ge-bar-chart']);
    });

    it('follows a for change and stops listening once removed', async () => {
        const { table, el } = await wired();
        const fire = () => table.dispatchEvent(new CustomEvent('range-chart-open', { detail: payload, bubbles: true, composed: true }));
        el.for = 'nothing';
        await settle(el);
        fire();
        await settle(el);
        expect(el.open).toBe(false);
        el.for = 'sales';
        await settle(el);
        fire();
        await settle(el);
        expect(el.open).toBe(true);

        el.open = false;
        await settle(el);
        el.remove();
        fire();
        expect(el.open).toBe(false);
    });

    it('opens from a real range selection and the readout\'s Chart button, and Escape returns focus to the button', async () => {
        const { table, el } = await wired();
        await vi.waitFor(() => expect(table.provider('range')?.active()).toBe(true));
        await settleTable(table);
        await mouseDrag(cellAt(table, 0, 'score')!, cellAt(table, 2, 'bonus')!);
        await settleTable(table);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'score', endRow: 2, endCol: 'bonus' });
        const button = q(table, '[data-slot="range-chart"]');
        await userEvent.click(button);
        await settle(el);

        expect(el.open).toBe(true);
        expect(el.payload).toEqual({ categories: ['Row 1', 'Row 2', 'Row 3'], series: [{ name: 'Score', values: [1, 2, 3] }, { name: 'Bonus', values: [10, 20, 30] }] });
        expect(labels(el)).toEqual(['Bar', 'Pie', 'Stacked']);
        const bar = root(el).querySelector('ge-bar-chart') as HTMLElement & { data: { name: string; value: number }[] };
        expect(bar.data).toEqual([{ name: 'Row 1', value: 1 }, { name: 'Row 2', value: 2 }, { name: 'Row 3', value: 3 }]);

        await parkMouse();
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect(el.open).toBe(false);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'score', endRow: 2, endCol: 'bonus' });
        expect(button.contains(deepActive()) || button.shadowRoot!.contains(deepActive())).toBe(true);
    });
});
