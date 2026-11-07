import { html } from 'lit';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeVirtualScroll } from './virtual-scroll.js';

const frames = (n: number) => new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
});
interface Row {
    id: number;
    height?: number;
}
const rows = (count: number, height?: number): Row[] => Array.from({ length: count }, (_, id) => ({ id, height }));
const renderCell = (row: unknown) => html`<div style="box-sizing:border-box;width:var(--cell-width);height:var(--cell-height,100%);border:1px solid #ddd">${(row as Row).id}</div>`;
const renderRow = (row: unknown) => {
    const { id, height } = row as Row;
    return html`<div class="row" style="height:${height ?? 50}px;box-sizing:border-box;border-bottom:1px solid #ddd">Row ${id}</div>`;
};
async function list(attrs = '', items: unknown[] = rows(1000), style = 'height:300px;width:300px', render = renderRow): Promise<GeVirtualScroll> {
    const page = await mount(`<ge-virtual-scroll ${attrs} style="${style}"></ge-virtual-scroll>`);
    const el = page.firstElementChild as GeVirtualScroll;
    el.renderItem = render;
    el.items = items;
    await frames(4);
    return el;
}
const viewport = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('.viewport')!;
const rendered = (el: Element) => [...el.querySelectorAll<HTMLElement>('[data-virtual-item]')].map((n) => Number(n.dataset.index));
const scrollTo = async (el: GeVirtualScroll, top: number) => {
    viewport(el).scrollTop = top;
    await frames(4);
};

describe('ge-virtual-scroll', () => {
    it('renders only the rows in view plus the buffer, and spaces them so the scroll height is the whole list', async () => {
        const el = await list();
        const indexes = rendered(el);

        // 300px / 50px = 6 rows in view, 5 more of buffer below (none above at the top).
        expect(indexes[0]).toBe(0);
        expect(indexes.at(-1)).toBe(10);
        expect(indexes).toHaveLength(11);
        expect(el.querySelector('[data-virtual-item]')!.textContent).toContain('Row 0');
        expect(viewport(el).scrollHeight).toBe(1000 * 50);
        expect(getComputedStyle(viewport(el)).overflowY).toBe('auto');
        expect(getComputedStyle(viewport(el)).overflowX).toBe('hidden');
    });

    it('moves the window as it scrolls, keeping the rows at their true offsets and recycling the ones that stay', async () => {
        const el = await list();
        const kept = el.querySelector('[data-index="8"]');
        await scrollTo(el, 5000);
        const indexes = rendered(el);

        expect(indexes[0]).toBe(95);
        expect(indexes.at(-1)).toBe(110);
        const row100 = el.querySelector('[data-index="100"]')!.getBoundingClientRect();
        const top = viewport(el).getBoundingClientRect().top;
        expect(Math.round(row100.top - top)).toBe(0);
        expect(el.querySelector('[data-index="8"]')).toBeNull();
        await scrollTo(el, 400);
        expect(kept !== null && el.querySelector('[data-index="8"]') !== null).toBe(true);
    });

    it('measures rows of other heights and corrects the total, so the scrollbar settles on the real height', async () => {
        const items = rows(40).map((r) => ({ ...r, height: r.id < 20 ? 100 : 50 }));
        const el = await list('buffer="0"', items);
        await scrollTo(el, 1500);
        await scrollTo(el, 0);
        await scrollTo(el, 1000);
        await scrollTo(el, 1700);
        // 20 x 100 + 20 x 50 = 3000 once every row has been seen; rows not yet seen count at the 50px estimate.
        expect(viewport(el).scrollHeight).toBeGreaterThan(2000);
        expect(viewport(el).scrollHeight).toBeLessThanOrEqual(3000);
        await scrollTo(el, 0);
        const first = el.querySelector<HTMLElement>('[data-index="1"]')!.getBoundingClientRect();
        expect(Math.round(first.top - viewport(el).getBoundingClientRect().top)).toBe(100);
    });

    it('keeps what you are reading in place when a row above the viewport changes size', async () => {
        const el = await list('buffer="2"', rows(200));
        await scrollTo(el, 2000);
        const reading = el.querySelector<HTMLElement>('[data-index="42"]')!;
        const before = reading.getBoundingClientRect().top;
        const above = el.querySelector<HTMLElement>('[data-index="38"]')!;
        above.firstElementChild!.setAttribute('style', 'height:150px');
        await frames(4);

        expect(Math.round(reading.getBoundingClientRect().top - before)).toBe(0);
        expect(viewport(el).scrollTop).toBe(2100);
    });

    it('ignores sub-pixel differences between the estimate and what it measures', async () => {
        const el = await list('', rows(200, 50.3));
        await scrollTo(el, 3000);
        await scrollTo(el, 0);
        await scrollTo(el, 1500);
        const spacer = el.shadowRoot!.querySelector<HTMLElement>('.content')!;
        expect(Number.parseFloat(spacer.style.paddingTop) % 50).toBe(0);
        expect(Number.parseFloat(spacer.style.paddingBottom) % 50).toBe(0);
    });

    it('announces the rendered window when it moves, and the scroll state with progress', async () => {
        const el = await list();
        const windows: { start: number; end: number }[] = [];
        const states: { windowStart: number; totalItems: number; scrollProgress: number }[] = [];
        el.addEventListener('window-change', (e) => windows.push((e as CustomEvent).detail));
        el.addEventListener('scroll-state', (e) => states.push((e as CustomEvent).detail));
        await scrollTo(el, 2500);

        expect(windows.at(-1)).toEqual({ start: 45, end: 61 });
        expect(states.at(-1)!.totalItems).toBe(1000);
        expect(states.at(-1)!.windowStart).toBe(45);
        expect(states.at(-1)!.scrollProgress).toBeCloseTo(2500 / (50000 - 300), 3);
    });

    it('fires scroll-end within two rows of the end, only while more exist and nothing is loading, and shows the loading row', async () => {
        const el = await list('', rows(20));
        let ends = 0;
        el.addEventListener('scroll-end', () => ends++);
        await scrollTo(el, 100);
        expect(ends).toBe(0);
        await scrollTo(el, 700);
        expect(ends).toBeGreaterThan(0);

        el.loading = true;
        await frames(3);
        const whileLoading = ends;
        await scrollTo(el, 690);
        await scrollTo(el, 700);
        expect(ends).toBe(whileLoading);
        expect(el.shadowRoot!.querySelector('.indicator')!.textContent).toContain('Loading...');

        el.loading = false;
        el.setAttribute('has-more', 'false');
        await frames(3);
        const afterDone = ends;
        await scrollTo(el, 690);
        await scrollTo(el, 700);
        expect(ends).toBe(afterDone);
    });

    it('swaps the loading indicator for a slotted one', async () => {
        const el = await list('loading', rows(20));
        const mine = document.createElement('span');
        mine.slot = 'loading';
        mine.textContent = 'Fetching';
        el.append(mine);
        await frames(2);
        const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="loading"]')!;
        expect(slot.assignedElements()).toEqual([mine]);
        expect(mine.getBoundingClientRect().width).toBeGreaterThan(0);
    });

    it('virtualizes along x when horizontal, each cell as tall as the box', async () => {
        const el = await list('orientation="horizontal" min-item-width="100" buffer="1"', rows(500), 'height:80px;width:300px;--cell-width:100px', renderCell);
        const indexes = rendered(el);

        expect(indexes[0]).toBe(0);
        expect(indexes.at(-1)).toBe(3);
        expect(viewport(el).scrollWidth).toBe(500 * 100);
        expect(getComputedStyle(viewport(el)).overflowX).toBe('auto');
        expect(el.querySelector<HTMLElement>('[data-virtual-item]')!.getBoundingClientRect().height).toBe(80);

        viewport(el).scrollLeft = 3000;
        await frames(4);
        expect(rendered(el)[0]).toBe(29);
        expect(Math.round(el.querySelector<HTMLElement>('[data-index="30"]')!.getBoundingClientRect().left - viewport(el).getBoundingClientRect().left)).toBe(0);
    });

    it('windows both axes of a flat row-major grid, announcing the cell window', async () => {
        const el = await list('orientation="both" column-count="50" min-item-height="40" min-item-width="80" buffer="1"', rows(50 * 100), 'height:120px;width:240px;--cell-width:80px;--cell-height:40px', renderCell);
        const cells = [...el.querySelectorAll<HTMLElement>('[data-virtual-item]')];
        const columns = new Set(cells.map((c) => c.dataset.column));
        const rowsSeen = new Set(cells.map((c) => c.dataset.row));

        // 240/80 = 3 columns in view + 1 buffer = 4; 120/40 = 3 rows + 1 buffer = 4.
        expect([...columns].length).toBe(4);
        expect([...rowsSeen].length).toBe(4);
        expect(cells[0]!.dataset.index).toBe('0');
        expect(cells.find((c) => c.dataset.row === '1' && c.dataset.column === '2')!.dataset.index).toBe('52');
        expect(viewport(el).scrollWidth).toBe(50 * 80);
        expect(viewport(el).scrollHeight).toBe(100 * 40);

        let cellWindow: unknown;
        el.addEventListener('cell-window-change', (e) => (cellWindow = (e as CustomEvent).detail));
        el.scrollToCell(30, 20);
        await frames(4);
        expect(cellWindow).toEqual({ rowStart: 29, rowEnd: 34, columnStart: 19, columnEnd: 24 });
        const cell = el.querySelector<HTMLElement>('[data-row="30"][data-column="20"]')!;
        expect(cell.dataset.index).toBe(String(30 * 50 + 20));
        const box = viewport(el).getBoundingClientRect();
        expect(Math.round(cell.getBoundingClientRect().left - box.left)).toBe(0);
        expect(Math.round(cell.getBoundingClientRect().top - box.top)).toBe(0);
    });

    it('keeps the cell you are reading in place when a column before the viewport changes width', async () => {
        const el = await list('orientation="both" column-count="50" min-item-height="40" min-item-width="80" buffer="1"', rows(50 * 100), 'height:120px;width:240px;--cell-width:80px;--cell-height:40px', renderCell);
        el.scrollToCell(10, 25);
        await frames(4);
        const reading = el.querySelector<HTMLElement>('[data-row="10"][data-column="26"]')!;
        const before = reading.getBoundingClientRect().left;
        for (const cell of el.querySelectorAll<HTMLElement>('[data-column="24"]')) (cell.firstElementChild as HTMLElement).style.width = '180px';
        await frames(4);

        expect(Math.round(reading.getBoundingClientRect().left - before)).toBe(0);
        expect(viewport(el).scrollLeft).toBe(25 * 80 + 100);
    });

    it('jumps to an item, the top and the estimated bottom, instantly', async () => {
        const el = await list();
        el.scrollToIndex(300);
        await frames(3);
        expect(viewport(el).scrollTop).toBe(15000);
        expect(rendered(el)).toContain(300);
        el.scrollToBottom();
        await frames(3);
        expect(viewport(el).scrollTop).toBe(viewport(el).scrollHeight - 300);
        el.scrollToTop();
        await frames(3);
        expect(viewport(el).scrollTop).toBe(0);
        expect(rendered(el)[0]).toBe(0);
    });

    it('keeps the rows it already made when the window moves, using the id as the key', async () => {
        const el = await list();
        const row = el.querySelector('[data-index="3"]');
        await scrollTo(el, 50);
        expect(el.querySelector('[data-index="3"]') === row).toBe(true);
    });

    it('renders nothing for an empty list', async () => {
        const el = await list('', []);
        expect(rendered(el)).toEqual([]);
        expect(viewport(el).scrollHeight).toBe(300);
    });
});
