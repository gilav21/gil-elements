/**
 * Wave 6, package A in a real browser: range selection by mouse, keys and touch, the readout, the fill handle, auto-scroll in a virtual grid and
 * the leaks (spec E.2, package A). Real input through CDP (`mouseDrag`, `touchLongPressDrag`); scrolling through `scrollGrid`, never the wheel.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { GeDataTable } from './data-table.js';
import { bodyRows, cellAt, makeRows, mountTable, q, qa, type SampleRow, settle } from './data-table-fixtures.js';
import { emulateTouch, frames, mouseDrag, parkMouse, press, scrollGrid, touchDrag, touchLongPressDrag, withRtl } from './data-table-input-fixtures.js';
import type { ColumnDef, FillSeriesEvent, RangeChartPayload } from './data-table.types.js';

afterEach(async () => {
    await parkMouse();
    await emulateTouch(false);
});

interface Row extends SampleRow {
    score: number;
    label: string;
    day: string;
}

const ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, name: `n${i}`, age: 20 + i, score: i + 1, label: `Item ${i + 1}`, day: `2024-01-0${i + 1}` }));
const set = (key: keyof Row) => (row: Row, value: unknown): Row => ({ ...row, [key]: value });
const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'name', header: 'Name', width: '120px' },
    { accessorKey: 'score', header: 'Score', width: '100px', valueSetter: set('score') },
    { accessorKey: 'label', header: 'Label', width: '120px', valueSetter: set('label') },
    { accessorKey: 'day', header: 'Day', width: '140px', valueSetter: set('day') },
];

async function mountRange(props: Record<string, unknown> = {}, box?: { width: number | string; height: number | string }): Promise<GeDataTable<Row>> {
    const table = await mountTable<Row>({ columns: COLUMNS, data: ROWS, enableCellRangeSelection: true, ...props }, {}, box);
    await vi.waitFor(() => expect(table.provider('range')?.active()).toBe(true));
    await settle(table);
    return table;
}

const cell = (table: Element, row: number, key: string): HTMLElement => {
    const el = cellAt(table, row, key);
    if (!el) throw new Error(`no cell ${row}/${key}`);
    return el;
};
const inRange = (table: Element): string[] => qa(table, '[data-slot="table-cell"][data-in-range]').map((c) => `${c.dataset['rowIndex']}:${c.dataset['column']}`);
const deepActive = (): Element | null => document.activeElement;
/** Gives the cell the roving focus and DOM focus (a cell that is not the roving one has no tabindex: `focus()` alone would do nothing). */
async function focusAt(table: GeDataTable<Row>, row: number, key: string): Promise<void> {
    table.focusCell(row, key);
    await settle(table);
}
const announcer = (table: Element): string => q(table, '[data-slot="data-table-announcer"]').textContent ?? '';
const handle = (table: Element): HTMLElement | null => table.querySelector<HTMLElement>('[data-slot="fill-handle"]');

describe('range selection by mouse', () => {
    it('marks exactly the rectangle between the two cells, with aria-selected, keeps the focus on the anchor and selects no text', async () => {
        const table = await mountRange();
        await mouseDrag(cell(table, 1, 'name'), cell(table, 3, 'label'));
        await settle(table);
        expect(inRange(table).sort()).toEqual(['1:label', '1:name', '1:score', '2:label', '2:name', '2:score', '3:label', '3:name', '3:score'].sort());
        expect(table.cellRange).toEqual({ startRow: 1, startCol: 'name', endRow: 3, endCol: 'label' });
        // the geometry of the highlighted cells is the rectangle between the two cells
        const first = cell(table, 1, 'name').getBoundingClientRect();
        const last = cell(table, 3, 'label').getBoundingClientRect();
        for (const c of qa(table, '[data-in-range]')) {
            const r = c.getBoundingClientRect();
            expect(r.left).toBeGreaterThanOrEqual(first.left - 1);
            expect(r.right).toBeLessThanOrEqual(last.right + 1);
            expect(r.top).toBeGreaterThanOrEqual(first.top - 1);
            expect(r.bottom).toBeLessThanOrEqual(last.bottom + 1);
        }
        expect(cell(table, 2, 'score').getAttribute('aria-selected')).toBe('true');
        expect(cell(table, 4, 'score').getAttribute('aria-selected')).toBe('false');
        expect(cell(table, 1, 'day').getAttribute('aria-selected')).toBe('false');
        expect(q(table, '[role="grid"]').getAttribute('aria-multiselectable')).toBe('true');
        expect(deepActive()).toBe(cell(table, 1, 'name'));
        expect(document.getSelection()?.toString()).toBe('');
        // the edges of the rectangle
        expect(cell(table, 1, 'name').dataset['rangeEdge']).toBe('top start');
        expect(cell(table, 3, 'label').dataset['rangeEdge']).toBe('bottom end');
    });

    it('leaves no range after a plain click, and shift+click extends from the focused cell', async () => {
        const table = await mountRange();
        await userEvent.click(cell(table, 2, 'score'));
        await settle(table);
        expect(table.cellRange).toBeNull();
        expect(deepActive()).toBe(cell(table, 2, 'score'));
        await userEvent.keyboard('{Shift>}');
        await userEvent.click(cell(table, 4, 'label'));
        await userEvent.keyboard('{/Shift}');
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'score', endRow: 4, endCol: 'label' });
        expect(deepActive()).toBe(cell(table, 2, 'score'));
        // and a plain click clears it again
        await userEvent.click(cell(table, 0, 'name'));
        await settle(table);
        expect(table.cellRange).toBeNull();
        expect(inRange(table)).toEqual([]);
    });

    it('starts nothing on a control in a cell, on the selection checkbox or from a special column', async () => {
        const table = await mountRange({
            enableRowSelection: true,
            columns: [...COLUMNS, { accessorKey: 'act', header: 'Act', cell: () => '', cellRenderer: () => document.createRange().createContextualFragment('<button data-act>go</button>') } as ColumnDef<Row>],
        });
        const box = q(table, '[data-slot="table-cell"][data-row-index="1"][data-column="_selection"]');
        await mouseDrag(box, cell(table, 3, 'score'));
        await settle(table);
        expect(table.cellRange).toBeNull();
        const button = table.querySelector<HTMLElement>('[data-row-index="1"] [data-act]');
        if (button) {
            await mouseDrag(button, cell(table, 3, 'score'));
            await settle(table);
            expect(table.cellRange).toBeNull();
        }
    });

    it('starts nothing while range selection is off: a drag is a click on the cell it ended on, no range', async () => {
        const table = await mountTable<Row>({ columns: COLUMNS, data: ROWS });
        await mouseDrag(cell(table, 1, 'name'), cell(table, 3, 'label'));
        await settle(table);
        expect(table.cellRange).toBeNull();
        expect(qa(table, '[data-in-range]')).toEqual([]);
        expect(cell(table, 1, 'name').hasAttribute('aria-selected')).toBe(false);
    });
});

describe('range selection by keys', () => {
    it('extends the end with Shift+arrows and keeps the DOM focus on the anchor; Escape clears it', async () => {
        const table = await mountRange();
        await focusAt(table, 1, 'score');
        await press('{Shift>}{ArrowDown}{ArrowDown}{ArrowRight}{/Shift}');
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 1, startCol: 'score', endRow: 3, endCol: 'label' });
        expect(deepActive()).toBe(cell(table, 1, 'score'));
        await press('{Escape}');
        await settle(table);
        expect(table.cellRange).toBeNull();
        expect(inRange(table)).toEqual([]);
        expect(deepActive()).toBe(cell(table, 1, 'score'));
    });

    it('Shift+End, Shift+Ctrl+End and Shift+PageDown move the end; coming back onto the anchor is plain focus', async () => {
        const table = await mountRange();
        await focusAt(table, 2, 'name');
        await press('{Shift>}{End}{/Shift}');
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'name', endRow: 2, endCol: 'day' });
        await press('{Shift>}{Control>}{End}{/Control}{/Shift}');
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'name', endRow: 7, endCol: 'day' });
        await press('{Shift>}{Home}{/Shift}');
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'name', endRow: 7, endCol: 'name' });
        await press('{Shift>}{Control>}{Home}{/Control}{/Shift}');
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'name', endRow: 0, endCol: 'name' });
        await press('{Shift>}{PageDown}{/Shift}');
        expect(table.cellRange?.endRow).toBeGreaterThan(0);
        table.cellRange = { startRow: 2, startCol: 'name', endRow: 3, endCol: 'name' };
        await settle(table);
        await press('{Shift>}{ArrowUp}{/Shift}');
        expect(table.cellRange).toBeNull();
    });

    it('flips ArrowLeft and ArrowRight in rtl', async () => {
        const table = await mountRange();
        await withRtl(table);
        await focusAt(table, 1, 'score');
        await press('{Shift>}{ArrowLeft}{/Shift}');
        expect(table.cellRange).toEqual({ startRow: 1, startCol: 'score', endRow: 1, endCol: 'label' });
    });

    it('Ctrl+A selects every drawn cell; with the feature off Shift+Arrow is plain navigation', async () => {
        const table = await mountRange();
        await focusAt(table, 0, 'name');
        await press('{Control>}a{/Control}');
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: 7, endCol: 'day' });
        expect(inRange(table)).toHaveLength(8 * 4);

        const plain = await mountTable<Row>({ columns: COLUMNS, data: ROWS });
        await focusAt(plain, 1, 'name');
        await press('{Shift>}{ArrowDown}{/Shift}');
        expect(plain.cellRange).toBeNull();
        expect(deepActive()).toBe(cell(plain, 2, 'name'));
    });

    it('leaves a text field in a cell alone', async () => {
        // one input per row, kept across renders (a new node per render would drop the focus)
        const inputs = new Map<string, HTMLInputElement>();
        const inputOf = (id: string): HTMLInputElement => {
            let input = inputs.get(id);
            if (!input) inputs.set(id, (input = Object.assign(document.createElement('input'), { value: 'text' })));
            input.dataset['note'] = '';
            return input;
        };
        const table = await mountRange({
            columns: [...COLUMNS, { accessorKey: 'note', header: 'Note', cellRenderer: ({ row }: { row: Row }) => inputOf(row.id) } as ColumnDef<Row>],
        });
        const input = table.querySelector<HTMLInputElement>('[data-row-index="1"] [data-note]');
        if (!input) return;
        input.focus();
        await press('{Shift>}{ArrowLeft}{/Shift}');
        await press('{Control>}a{/Control}');
        expect(table.cellRange).toBeNull();
    });
});

describe('the range readout', () => {
    it('shows Count / Sum / Avg / Min / Max computed from the data, as a named group, and a Chart button that fires range-chart-open', async () => {
        const table = await mountRange({ enableRangeActions: true });
        table.cellRange = { startRow: 0, startCol: 'score', endRow: 2, endCol: 'score' };
        await settle(table);
        const readout = q(table, '[data-slot="range-actions"]');
        expect(readout.getAttribute('role')).toBe('group');
        expect(readout.getAttribute('aria-label')).toBe('Selection summary');
        expect(readout.hasAttribute('data-pointer-transparent')).toBe(true);
        const text = readout.textContent?.replaceAll(/\s+/g, ' ') ?? '';
        expect(text).toContain('Count: 3');
        expect(text).toContain('Sum: 6');
        expect(text).toContain('Avg: 2');
        expect(text).toContain('Min: 1');
        expect(text).toContain('Max: 3');
        const payloads: RangeChartPayload[] = [];
        table.addEventListener('range-chart-open', (event) => payloads.push((event as CustomEvent<RangeChartPayload>).detail));
        const button = q(table, '[data-slot="range-chart"]');
        expect(button.getAttribute('aria-label')).toBe('Chart');
        await userEvent.click(button);
        expect(payloads).toEqual([{ categories: ['Row 1', 'Row 2', 'Row 3'], series: [{ name: 'Score', values: [1, 2, 3] }] }]);
        // the button press is the button's: the range stays
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'score', endRow: 2, endCol: 'score' });
    });

    it('is hidden for one cell, without the flag, and shows Count only (no Chart) for text', async () => {
        const table = await mountRange({ enableRangeActions: true });
        table.cellRange = { startRow: 0, startCol: 'score', endRow: 0, endCol: 'score' };
        await settle(table);
        expect(table.querySelector('[data-slot="range-actions"]')).toBeNull();
        table.cellRange = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'name' };
        await settle(table);
        const text = q(table, '[data-slot="range-actions"]').textContent ?? '';
        expect(text).toContain('Count');
        expect(text).not.toContain('Sum');
        expect(table.querySelector('[data-slot="range-chart"]')).toBeNull();
        table.enableRangeActions = false;
        await settle(table);
        expect(table.querySelector('[data-slot="range-actions"]')).toBeNull();
    });

    it('gives the Chart button a 44 px target on a touch screen', async () => {
        await emulateTouch(true);
        const table = await mountRange({ enableRangeActions: true });
        table.cellRange = { startRow: 0, startCol: 'score', endRow: 2, endCol: 'score' };
        await settle(table);
        // the host is `display: contents`: the target is its inner button
        const button = q(table, '[data-slot="range-chart"]');
        await vi.waitFor(() => expect(button.shadowRoot?.querySelector('button')?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44));
    });

    it('announces once, 500 ms after the last change, with the final size', async () => {
        const table = await mountRange({ enableRangeActions: true });
        const texts: string[] = [];
        const announcer = q(table, '[data-slot="data-table-announcer"]');
        const observer = new MutationObserver(() => texts.push(announcer.textContent ?? ''));
        observer.observe(announcer, { childList: true, characterData: true, subtree: true });
        await focusAt(table, 0, 'score');
        for (let i = 0; i < 4; i++) await press('{Shift>}{ArrowDown}{/Shift}');
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(texts.filter((t) => t.includes('selected'))).toEqual([]);
        await vi.waitFor(() => expect(texts.some((t) => t.includes('5 rows by 1 columns selected'))).toBe(true), { timeout: 2000 });
        observer.disconnect();
        expect(texts.filter((t) => t.includes('selected'))).toHaveLength(1);
        expect(texts.find((t) => t.includes('selected'))).toContain('Sum: 15');
    });
});

describe('the fill handle', () => {
    const corner = (table: GeDataTable<Row>, row: number, key: string, rtl = false): { x: number; y: number } => {
        const r = cell(table, row, key).getBoundingClientRect();
        return { x: rtl ? r.left : r.right, y: r.bottom };
    };
    const centre = (el: HTMLElement): { x: number; y: number } => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    it('sits centred on the bottom inline-end corner of the range, in ltr and rtl, and after a scroll', async () => {
        const table = await mountRange({ enableFillHandle: true, data: makeRows(60).map((r, i) => ({ ...ROWS[i % 8], ...r })) }, { width: 400, height: 300 });
        table.cellRange = { startRow: 1, startCol: 'name', endRow: 2, endCol: 'score' };
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        await settle(table);
        let at = centre(handle(table)!);
        let want = corner(table, 2, 'score');
        expect(Math.abs(at.x - want.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(at.y - want.y)).toBeLessThanOrEqual(1);
        expect(handle(table)!.hasAttribute('data-pointer-transparent')).toBe(true);
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        await scrollGrid(viewport, { top: 20, left: 30 });
        await settle(table);
        at = centre(handle(table)!);
        want = corner(table, 2, 'score');
        expect(Math.abs(at.x - want.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(at.y - want.y)).toBeLessThanOrEqual(1);
        await scrollGrid(viewport, { top: 0, left: 0 });
        await withRtl(table);
        table.requestUpdate(); // a direction change alone is no render: the handle is measured after the next one
        await settle(table);
        await settle(table);
        at = centre(handle(table)!);
        want = corner(table, 2, 'score', true);
        expect(Math.abs(at.x - want.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(at.y - want.y)).toBeLessThanOrEqual(1);
    });

    it('is hidden with no focus and no range, with the flag off, and follows the focused cell', async () => {
        const table = await mountRange({ enableFillHandle: true });
        expect(handle(table)).toBeNull();
        await focusAt(table, 3, 'label');
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        table.enableFillHandle = false;
        await settle(table);
        expect(handle(table)).toBeNull();
    });

    it('previews exactly the rows below the source while dragged, writes the series on release, once, in one data-change', async () => {
        const table = await mountRange({ enableFillHandle: true });
        table.cellRange = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'day' };
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        const fills: FillSeriesEvent[] = [];
        let changes = 0;
        table.addEventListener('fill-series', (event) => fills.push((event as CustomEvent<FillSeriesEvent>).detail));
        table.addEventListener('data-change', () => changes++);
        await mouseDrag(handle(table)!, cell(table, 4, 'score'), { holdMs: 150 });
        await settle(table);
        expect(qa(table, '[data-fill-preview]')).toEqual([]); // released: no band left
        const data = table.data as Row[];
        expect(data.slice(2, 5).map((r) => r.score)).toEqual([3, 4, 5]);
        expect(data.slice(2, 5).map((r) => r.label)).toEqual(['Item 3', 'Item 4', 'Item 5']);
        expect(data.slice(2, 5).map((r) => r.day)).toEqual(['2024-01-03', '2024-01-04', '2024-01-05']);
        expect(data.slice(2, 5).map((r) => r.name)).toEqual(['n2', 'n3', 'n4']); // no valueSetter: untouched
        expect(fills).toEqual([{ source: { minRow: 0, maxRow: 1 }, filled: { startRow: 2, endRow: 4 }, columnKeys: ['score', 'label', 'day'] }]);
        expect(changes).toBe(1);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: 4, endCol: 'day' });
    });

    it('draws the preview band only below the source, mid-drag, and nothing when dragging up', async () => {
        const table = await mountRange({ enableFillHandle: true });
        table.cellRange = { startRow: 2, startCol: 'score', endRow: 3, endCol: 'label' };
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        const seen: string[][] = [];
        const record = (): void => void seen.push(qa(table, '[data-fill-preview]').map((c) => `${c.dataset['rowIndex']}:${c.dataset['column']}`));
        const observer = new MutationObserver(record);
        observer.observe(table, { attributes: true, subtree: true, attributeFilter: ['data-fill-preview'] });
        await mouseDrag(handle(table)!, cell(table, 5, 'name'), { holdMs: 100 });
        observer.disconnect();
        const widest = seen.reduce((a, b) => (b.length > a.length ? b : a), [] as string[]);
        expect(widest.sort()).toEqual(['4:label', '4:score', '5:label', '5:score']);
        // dragging up previews nothing and writes nothing
        seen.length = 0;
        const again = new MutationObserver(record);
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        again.observe(table, { attributes: true, subtree: true, attributeFilter: ['data-fill-preview'] });
        table.cellRange = { startRow: 4, startCol: 'score', endRow: 5, endCol: 'score' };
        await settle(table);
        await frames(2);
        const dataBefore = table.data;
        await mouseDrag(handle(table)!, cell(table, 0, 'score'), { holdMs: 50 });
        again.disconnect();
        expect(seen.every((s) => s.length === 0)).toBe(true);
        expect(table.data).toBe(dataBefore);
    });

    it('writes nothing when Escape is pressed mid-drag', async () => {
        const table = await mountRange({ enableFillHandle: true });
        table.cellRange = { startRow: 0, startCol: 'score', endRow: 1, endCol: 'score' };
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        const data = table.data;
        // press on the handle, move, Escape (the button still held), release
        const escape = setTimeout(() => cell(table, 0, 'score').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true })), 150);
        await mouseDrag(handle(table)!, cell(table, 5, 'score'), { holdMs: 400 });
        clearTimeout(escape);
        await settle(table);
        expect(table.data).toBe(data);
        expect(qa(table, '[data-fill-preview]')).toEqual([]);
    });

    it('Ctrl+D copies the first row of the range down into the rest (one undo step)', async () => {
        const table = await mountRange({ enableFillHandle: true, enableEditHistory: true });
        table.cellRange = { startRow: 1, startCol: 'score', endRow: 3, endCol: 'label' };
        await settle(table);
        await focusAt(table, 1, 'score');
        await press('{Control>}d{/Control}');
        await settle(table);
        const data = table.data as Row[];
        expect(data.slice(1, 4).map((r) => [r.score, r.label])).toEqual([
            [2, 'Item 2'],
            [2, 'Item 2'],
            [2, 'Item 2'],
        ]);
        expect(table.canUndo).toBe(true);
        table.undoEdit();
        await settle(table);
        expect((table.data as Row[]).slice(1, 4).map((r) => r.score)).toEqual([2, 3, 4]);
        expect(table.canUndo).toBe(false);
    });

    it('fillDownTo fills from the focused cell and answers whether it wrote', async () => {
        const table = await mountRange({ enableFillHandle: true });
        await focusAt(table, 0, 'score');
        await settle(table);
        expect(table.fillDownTo(0)).toBe(false);
        expect(table.fillDownTo(2)).toBe(true);
        expect((table.data as Row[]).slice(0, 3).map((r) => r.score)).toEqual([1, 1, 1]); // a single number repeats... (numeric series of one: step 0)
    });

    it('fills by a touch drag on the handle', async () => {
        const table = await mountRange({ enableFillHandle: true });
        table.cellRange = { startRow: 0, startCol: 'score', endRow: 1, endCol: 'score' };
        await settle(table);
        await vi.waitFor(() => expect(handle(table)).not.toBeNull());
        await touchDrag(handle(table)!, cell(table, 3, 'score'), { holdMs: 100 });
        await settle(table);
        expect((table.data as Row[]).slice(0, 4).map((r) => r.score)).toEqual([1, 2, 3, 4]);
    });
});

describe('touch', () => {
    it('a swipe scrolls and starts no range; a long press and drag selects without scrolling', async () => {
        await emulateTouch(true);
        const table = await mountRange({ data: makeRows(60).map((r, i) => ({ ...ROWS[i % 8], ...r })) }, { width: 500, height: 300 });
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        await touchDrag(cell(table, 1, 'score'), { dx: 0, dy: -120 }, { steps: 6 });
        await settle(table);
        await vi.waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));
        expect(table.cellRange).toBeNull();
        await scrollGrid(viewport, { top: 0 });
        await settle(table);
        // (row 2 is clear of the 40 px auto-scroll band at the viewport's bottom edge)
        await touchLongPressDrag(cell(table, 0, 'name'), cell(table, 2, 'score'), { holdBeforeMs: 650, steps: 6 });
        await settle(table);
        expect(viewport.scrollTop).toBe(0);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: 2, endCol: 'score' });
        expect(table.provider('range')?.gestureActive()).toBe(false);
    });

    it('a long press on a cell that is already selected does not restart the range', async () => {
        await emulateTouch(true);
        const table = await mountRange();
        table.cellRange = { startRow: 1, startCol: 'name', endRow: 2, endCol: 'score' };
        await settle(table);
        await touchLongPressDrag(cell(table, 2, 'name'), cell(table, 4, 'label'), { holdBeforeMs: 650, steps: 4 });
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 1, startCol: 'name', endRow: 2, endCol: 'score' });
    });
});

describe('virtual grid', () => {
    const big = (): Row[] => Array.from({ length: 10_000 }, (_, i) => ({ id: `v${i}`, name: `n${i}`, age: i % 50, score: i, label: `Item ${i}`, day: '2024-01-01' }));

    it('auto-scrolls a drag held at the bottom edge past the first window; the readout counts the whole range; the range survives scrolling away and back', async () => {
        const table = await mountRange({ data: big(), enableVirtualScroll: true, enableRangeActions: true }, { width: 600, height: 320 });
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        const firstWindow = bodyRows(table).length;
        const box = viewport.getBoundingClientRect();
        await mouseDrag(cell(table, 0, 'score'), { x: box.left + 150, y: box.bottom - 12 }, { steps: 4, holdMs: 1500 });
        await settle(table);
        const range = table.cellRange;
        expect(range).not.toBeNull();
        expect(range!.endRow).toBeGreaterThan(firstWindow);
        expect(viewport.scrollTop).toBeGreaterThan(0);
        const rows = Math.abs(range!.endRow - range!.startRow) + 1;
        expect(q(table, '[data-slot="range-actions"]').textContent).toContain(`Count: ${rows}`);
        await scrollGrid(viewport, { top: 200_000 });
        await settle(table);
        await scrollGrid(viewport, { top: 0 });
        await settle(table);
        expect(table.cellRange).toEqual(range);
        expect(cell(table, 0, 'score').hasAttribute('data-in-range')).toBe(true);
    });

    it('is trimmed when the data shrinks and dropped when its column is hidden', async () => {
        const table = await mountRange();
        table.cellRange = { startRow: 2, startCol: 'score', endRow: 6, endCol: 'label' };
        await settle(table);
        table.data = ROWS.slice(0, 4);
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 2, startCol: 'score', endRow: 3, endCol: 'label' });
        table.provider('columns')?.setVisible('label', false);
        await settle(table);
        await settle(table);
        expect(table.cellRange).toBeNull();
    });
});

describe('leaks', () => {
    it('leaves no listener and no pending announcement after the flags go off or the table is removed', async () => {
        const added: { target: EventTarget; type: string }[] = [];
        const removed: { target: EventTarget; type: string }[] = [];
        const targets = [document, window];
        const origAdd = EventTarget.prototype.addEventListener;
        const origRemove = EventTarget.prototype.removeEventListener;
        const table = await mountRange({ enableFillHandle: true, enableRangeActions: true });
        EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
            if (targets.includes(this as never) || this === table) added.push({ target: this, type });
            return (origAdd as (...a: unknown[]) => void).call(this, type, ...rest);
        } as typeof origAdd;
        EventTarget.prototype.removeEventListener = function (this: EventTarget, type: string, ...rest: unknown[]) {
            if (targets.includes(this as never) || this === table) removed.push({ target: this, type });
            return (origRemove as (...a: unknown[]) => void).call(this, type, ...rest);
        } as typeof origRemove;
        try {
            await mouseDrag(cell(table, 0, 'score'), cell(table, 2, 'score'));
            await focusAt(table, 0, 'score');
            await press('{Shift>}{ArrowDown}{/Shift}'); // an announcement pending
            table.enableCellRangeSelection = false;
            table.enableFillHandle = false;
            await settle(table);
            table.remove();
        } finally {
            EventTarget.prototype.addEventListener = origAdd;
            EventTarget.prototype.removeEventListener = origRemove;
        }
        const count = (list: typeof added, type: string, target: EventTarget): number => list.filter((e) => e.type === type && e.target === target).length;
        for (const { target, type } of added) expect(count(removed, type, target), `${type}`).toBeGreaterThanOrEqual(count(added, type, target));
        const announcerText = announcer(table);
        await new Promise((resolve) => setTimeout(resolve, 700));
        expect(announcer(table)).toBe(announcerText);
    });
});
