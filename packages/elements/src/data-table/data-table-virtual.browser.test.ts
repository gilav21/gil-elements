import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';
import { ariaIndexes, bodyRows, cellAt, dataIndexes, headCell, makeColumns, makeRows, mountTable, q, qa, roving, settle, type SampleRow } from './data-table-fixtures.js';
import { countConstructions, frames, parkMouse, perf, press, scrollGrid, withRtl } from './data-table-input-fixtures.js';

const ROW = 40;
const BUFFER = 5;

let errors: string[] = [];
const onError = (event: ErrorEvent): void => void errors.push(event.message);
beforeEach(async () => {
    errors = [];
    window.addEventListener('error', onError);
    await parkMouse();
});
afterEach(() => {
    window.removeEventListener('error', onError);
    expect(errors.filter((m) => m.includes('ResizeObserver'))).toEqual([]);
});

const viewportOf = (table: Element): HTMLElement => q(table, '[data-slot="data-table-viewport"]');
const bodyOf = (table: Element): HTMLElement => q(table, '[data-slot="table-body"]');
const padTop = (table: Element): number => Number.parseFloat(getComputedStyle(bodyOf(table)).paddingTop);
const padBottom = (table: Element): number => Number.parseFloat(getComputedStyle(bodyOf(table)).paddingBottom);

function mountVirtual(props: Record<string, unknown> = {}, attrs: Record<string, string> = {}, box = { width: 600, height: 400 }, rows = 10000, columns = 8): Promise<GeDataTable<SampleRow>> {
    return mountTable<SampleRow>(
        { columns: makeColumns(columns), data: makeRows(rows, { columns }), enableVirtualScroll: true, virtualRowHeight: ROW, showPagination: false, showToolbar: false, ...props },
        attrs,
        box,
    );
}

/** Scrolls and waits for the window to be drawn. */
async function scrollTo(table: GeDataTable<SampleRow>, pos: { top?: number; left?: number }): Promise<void> {
    await scrollGrid(table, pos);
    await settle(table);
}

/** Rows whose box intersects the scroller's box and is not under the sticky header. */
function visibleIndexes(table: Element): number[] {
    const view = viewportOf(table).getBoundingClientRect();
    const head = q(table, '[data-slot="table-header"]').getBoundingClientRect();
    return bodyRows(table)
        .filter((r) => {
            const b = r.getBoundingClientRect();
            return b.bottom > head.bottom && b.top < view.bottom;
        })
        .map((r) => Number(r.dataset['rowIndex']));
}

describe('row windows on a real scroller', () => {
    it('draws only the window at first, with padding standing in for the rest', async () => {
        const table = await mountVirtual();
        const view = viewportOf(table);
        const drawn = dataIndexes(table);
        expect(drawn[0]).toBe(0);
        // ceil(398 / 40) rows in view plus the buffer below.
        expect(drawn.length).toBeGreaterThanOrEqual(Math.ceil(view.clientHeight / ROW) + BUFFER - 1);
        expect(drawn.length).toBeLessThan(40);
        expect(padTop(table)).toBe(0);
        expect(padBottom(table)).toBe((10000 - drawn.length) * ROW);
        const grid = q(table, '[data-slot="table"]');
        expect(grid.getAttribute('aria-rowcount')).toBe('10001');
        expect(ariaIndexes(table).slice(0, 3)).toEqual([2, 3, 4]);
        expect(table.getAttribute('data-virtual')).toBe('fixed');
        expect(getComputedStyle(view).contain).toContain('strict');
        expect(getComputedStyle(view).overflowAnchor).toBe('none');
    });

    it('a scroll of 200000px draws rows 4995 and on, with geometry that matches', async () => {
        const table = await mountVirtual();
        await scrollTo(table, { top: 200000 });
        const drawn = dataIndexes(table);
        expect(drawn[0]).toBe(5000 - BUFFER);
        expect(padTop(table)).toBe(drawn[0]! * ROW);
        expect(padTop(table) + drawn.length * ROW + padBottom(table)).toBe(10000 * ROW);
        const visible = visibleIndexes(table);
        expect(visible[0]).toBe(5000);
        expect(visible.length).toBeGreaterThanOrEqual(9);
        expect(ariaIndexes(table)[0]).toBe(drawn[0]! + 2);
    });

    it('clamps past the end and comes back to the top', async () => {
        const table = await mountVirtual();
        await scrollTo(table, { top: 1e9 });
        const drawn = dataIndexes(table);
        expect(drawn.at(-1)).toBe(9999);
        expect(drawn[0]).toBeLessThan(9999);
        await scrollTo(table, { top: 0 });
        expect(dataIndexes(table)[0]).toBe(0);
        expect(padTop(table)).toBe(0);
    });

    it('a scroll inside the buffer draws nothing new', async () => {
        const table = await mountVirtual();
        await scrollTo(table, { top: 4000 });
        const before = bodyRows(table)[0]!;
        const first = dataIndexes(table)[0];
        await scrollTo(table, { top: 4000 + ROW });
        expect(dataIndexes(table)[0]).toBe(first);
        expect(bodyRows(table)[0]).toBe(before);
    });

    it('with a pager on, virtual scroll true windows the whole list, not the page', async () => {
        const table = await mountVirtual({ showPagination: true }, {}, { width: 600, height: 500 });
        expect(q(table, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe('10001');
        await scrollTo(table, { top: 100000 });
        expect(dataIndexes(table)[0]).toBe(2500 - BUFFER);
    });

    it('draws only the rows that exist for a short list, with no padding', async () => {
        const table = await mountVirtual({}, {}, { width: 600, height: 400 }, 7);
        expect(dataIndexes(table)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(padBottom(table)).toBe(0);
    });
});

describe('auto mode', () => {
    const auto = (rows: number, props: Record<string, unknown> = {}, columns = 4) =>
        mountTable<SampleRow>({ columns: makeColumns(columns), data: makeRows(rows, { columns }), enableVirtualScroll: 'auto', showPagination: false, showToolbar: false, ...props }, {}, { width: 600, height: 400 });

    it('stays off at 500 rows and turns on above', async () => {
        expect((await auto(500)).hasAttribute('data-virtual')).toBe(false);
        const table = await auto(501);
        expect(table.getAttribute('data-virtual')).toBe('fixed');
        expect(bodyRows(table).length).toBeLessThan(40);
    });
    it('is off beside a pager however many rows there are', async () => {
        const table = await auto(2000, { showPagination: true });
        expect(table.hasAttribute('data-virtual')).toBe(false);
        expect(bodyRows(table).length).toBe(10);
    });
    it('turns on for more than 20 scrolling columns, and the pinned ones do not count', async () => {
        const few = await auto(10, {}, 20);
        expect(few.hasAttribute('data-virtual')).toBe(false);
        const many = await auto(10, { columns: makeColumns(23, { pinLeft: 2 }) }, 23);
        expect(many.hasAttribute('data-virtual')).toBe(true);
        const pinned = await auto(10, { columns: makeColumns(23, { pinLeft: 3 }) }, 23);
        expect(pinned.hasAttribute('data-virtual')).toBe(false);
    });
});

describe('column windows', () => {
    const mountWide = (props: Record<string, unknown> = {}, rows = 50) => mountVirtual({ columns: makeColumns(30, { pinLeft: 1 }), data: makeRows(rows, { columns: 30 }), ...props }, {}, { width: 600, height: 400 }, rows, 30);
    const columnsDrawn = (table: Element): string[] => [...new Set(qa(table, '[data-slot="table-cell"][data-column]').map((c) => c.dataset['column']!))];

    it('draws the pinned column and a window of the middle ones, with absolute aria-colindex', async () => {
        const table = await mountWide();
        await scrollTo(table, { left: 1500 });
        const keys = columnsDrawn(table);
        expect(keys).toContain('c0');
        expect(keys).not.toContain('c5');
        expect(keys).toContain('c11');
        expect(keys.length).toBeLessThan(15);
        for (const key of keys) {
            const index = Number(key.slice(1)) + 1;
            expect(cellAt(table, 0, key)!.getAttribute('aria-colindex')).toBe(String(index));
            expect(q(table, `[data-slot="table-head"][data-column-id="${key}"]`).getAttribute('aria-colindex')).toBe(String(index));
        }
        expect(q(table, '[data-slot="table"]').getAttribute('aria-colcount')).toBe('30');
        const pinned = cellAt(table, 0, 'c0')!.getBoundingClientRect();
        expect(pinned.left).toBeCloseTo(viewportOf(table).getBoundingClientRect().left + 1, 0);
        // the row is as wide as all columns together: spacers stand in for the missing ones
        expect(q(table, '[data-slot="table"]').scrollWidth).toBeGreaterThanOrEqual(30 * 150);
        expect(qa(table, '[data-slot="data-table-spacer"][aria-hidden="true"]').length).toBeGreaterThan(0);
    });

    it('keeps the measured width of an auto column that is windowed out', async () => {
        const wide = (): ColumnDef<SampleRow>[] => makeColumns(30).map((c, i) => (i === 0 ? { ...c, width: 'auto' } : c));
        const table = await mountWide({ columns: wide() });
        const measured = headCell(table, 'c0').getBoundingClientRect().width;
        expect(measured).not.toBe(150); // not the stand-in width the controller falls back to
        await scrollTo(table, { left: 2500 });
        const first = Math.min(...columnsDrawn(table).map((key) => Number(key.slice(1))));
        expect(first).toBeGreaterThan(3);
        table.refresh();
        await settle(table);
        await frames(3);
        const pad = qa(table, '[data-slot="data-table-spacer"][data-edge="start"]')[0]!.getBoundingClientRect().width;
        expect(Math.abs(pad - (measured + 150 * (first - 1)))).toBeLessThan(2);
    });

    it('does the same right-to-left, with a negative scrollLeft', async () => {
        const table = await mountWide();
        await withRtl(table);
        await scrollTo(table, { left: -1500 });
        expect(viewportOf(table).scrollLeft).toBeLessThan(0);
        const keys = columnsDrawn(table);
        expect(keys).toContain('c11');
        expect(keys).not.toContain('c5');
        const pinned = cellAt(table, 0, 'c0')!.getBoundingClientRect();
        expect(pinned.right).toBeCloseTo(viewportOf(table).getBoundingClientRect().right - 1, 0);
    });
});

describe('variable row height', () => {
    /** Rows 40px tall, every third one 100px: the content decides, there is no fixed height. */
    function heightColumn(): ColumnDef<SampleRow>[] {
        return [
            { accessorKey: 'name', header: 'Name', width: '200px' },
            {
                accessorKey: 'age',
                header: 'Age',
                width: '120px',
                cellRenderer: ({ row }) => {
                    const box = document.createElement('div');
                    box.dataset['grow'] = row.id;
                    box.style.height = `${Number(row.id.slice(1)) % 3 === 0 ? 100 : 40}px`;
                    return box;
                },
            },
        ];
    }
    const mountVariable = (props: Record<string, unknown> = {}) =>
        mountVirtual({ columns: heightColumn(), data: makeRows(2000), virtualVariableRowHeight: true, ...props }, {}, { width: 600, height: 400 }, 2000, 2);

    it('measures rows and keeps a consistent total', async () => {
        const table = await mountVariable();
        expect(table.getAttribute('data-virtual')).toBe('variable');
        await frames(3);
        const view = viewportOf(table);
        await scrollTo(table, { top: 20000 });
        await frames(3);
        // rows laid out one after another: the drawn ones start where the padding ends
        const first = bodyRows(table)[0]!;
        expect(Math.abs(first.getBoundingClientRect().top - bodyOf(table).getBoundingClientRect().top - padTop(table))).toBeLessThan(1);
        expect(view.scrollHeight).toBeGreaterThan(2000 * ROW);
    });

    it('does not move what the user sees when a row above the window grows', async () => {
        const table = await mountVariable();
        await scrollTo(table, { top: 20000 });
        await frames(3);
        const view = viewportOf(table);
        const head = q(table, '[data-slot="table-header"]').getBoundingClientRect();
        const anchor = bodyRows(table).find((r) => r.getBoundingClientRect().top > head.bottom + 2)!;
        const id = anchor.dataset['rowId']!;
        const before = anchor.getBoundingClientRect().top;
        const above = bodyRows(table).find((r) => r.getBoundingClientRect().bottom < head.bottom && Number(r.dataset['rowIndex']) < Number(anchor.dataset['rowIndex']))!;
        expect(above).toBeTruthy();
        const scrollBefore = view.scrollTop;
        q(above, '[data-grow]').style.height = '240px';
        await frames(4);
        const moved = bodyRows(table).find((r) => r.dataset['rowId'] === id)!;
        expect(Math.abs(moved.getBoundingClientRect().top - before)).toBeLessThan(1.5);
        expect(view.scrollTop).toBeGreaterThan(scrollBefore);
        expect(getComputedStyle(view).overflowAnchor).toBe('none');
    });

    it('keeps the measured heights and the scroll position when one cell value changes', async () => {
        const table = await mountVariable();
        await scrollTo(table, { top: 30000 });
        await frames(3);
        const view = viewportOf(table);
        const { scrollTop, scrollHeight } = view;
        const drawn = bodyRows(table)[3]!.dataset['rowId']!;
        table.data = table.data.map((row) => (row.id === drawn ? { ...row, name: 'edited' } : row));
        await settle(table);
        await frames(4);
        expect(qa(table, '[data-row-id]').some((r) => r.textContent!.includes('edited'))).toBe(true);
        expect(Math.abs(view.scrollTop - scrollTop)).toBeLessThan(1.5);
        expect(Math.abs(view.scrollHeight - scrollHeight)).toBeLessThan(1.5);
    });

    it('refresh() keeps the first visible row where it is', async () => {
        const table = await mountVariable();
        await scrollTo(table, { top: 30000 });
        await frames(3);
        const head = q(table, '[data-slot="table-header"]').getBoundingClientRect();
        const first = () => bodyRows(table).find((r) => r.getBoundingClientRect().top >= head.bottom - 1)!;
        const [id, top] = [first().dataset['rowId'], first().getBoundingClientRect().top];
        const { scrollTop, scrollHeight } = viewportOf(table);
        table.refresh();
        await settle(table);
        await frames(4);
        expect(first().dataset['rowId']).toBe(id);
        expect(Math.abs(first().getBoundingClientRect().top - top)).toBeLessThan(1.5);
        expect(Math.abs(viewportOf(table).scrollTop - scrollTop)).toBeLessThan(1.5);
        expect(Math.abs(viewportOf(table).scrollHeight - scrollHeight)).toBeLessThan(1.5);
    });

    it('measures an open detail row into the total height', async () => {
        const detail = (): HTMLElement => {
            const box = document.createElement('div');
            box.style.height = '120px';
            return box;
        };
        const table = await mountVariable({ enableRowExpansion: true, renderDetail: detail });
        await frames(3);
        const view = viewportOf(table);
        const before = view.scrollHeight;
        table.expandedRows = { r1: true };
        table.requestUpdate();
        await settle(table);
        await frames(4);
        expect(qa(table, '[data-kind="detail"]').length).toBe(1);
        expect(view.scrollHeight - before).toBeGreaterThan(100);
        expect(view.scrollHeight - before).toBeLessThan(140);
    });

    it('gives the height of a detail row back when it is collapsed while scrolled out of the window', async () => {
        const detail = (): HTMLElement => {
            const box = document.createElement('div');
            box.style.height = '120px';
            return box;
        };
        const table = await mountVirtual({ virtualRowHeight: 0, virtualVariableRowHeight: true, enableRowExpansion: true, renderDetail: detail }, {}, { width: 600, height: 400 }, 10000, 2);
        await frames(3);
        const view = viewportOf(table);
        table.expandedRows = { r1: true };
        await settle(table);
        await frames(4);
        await scrollTo(table, { top: 20000 });
        await frames(3);
        expect(qa(table, '[data-kind="detail"]').length).toBe(0);
        const open = view.scrollHeight;
        table.expandedRows = {};
        await settle(table);
        await frames(4);
        // the detail row (its 120px content and its own padding) leaves the total
        expect(open - view.scrollHeight).toBeGreaterThan(120);
        expect(open - view.scrollHeight).toBeLessThan(150);
    });
});

describe('several open detail rows in a flat variable-height list', () => {
    it('opening a second one keeps the height of the first', async () => {
        const detail = (): HTMLElement => Object.assign(document.createElement('div'), { style: 'height:120px' });
        const table = await mountVirtual({ virtualRowHeight: 0, virtualVariableRowHeight: true, enableRowExpansion: true, renderDetail: detail }, {}, { width: 600, height: 600 }, 2000, 2);
        await frames(3);
        const view = viewportOf(table);
        const closed = view.scrollHeight;
        const ids = [table.data[1]!.id, table.data[2]!.id];
        table.expandedRows = { [ids[0]!]: true };
        await settle(table);
        await frames(4);
        const one = view.scrollHeight - closed;
        table.expandedRows = { [ids[0]!]: true, [ids[1]!]: true };
        await settle(table);
        await frames(4);
        expect(one).toBeGreaterThan(120);
        expect(Math.abs(view.scrollHeight - closed - 2 * one)).toBeLessThan(2);
    });
});

describe('aria-rowindex with open detail rows above the window', () => {
    it('counts them in the drawn rows and in a retained one, as aria-rowcount does', async () => {
        const detail = (): HTMLElement => Object.assign(document.createElement('div'), { style: 'height:60px' });
        const table = await mountVirtual({ enableRowExpansion: true, renderDetail: detail }, {}, { width: 600, height: 400 }, 2000, 2);
        table.expandedRows = { [table.data[0]!.id]: true, [table.data[1]!.id]: true };
        await settle(table);
        table.focusCell(5, 'c0');
        await settle(table);
        await scrollTo(table, { top: 20000 });
        await frames(3);
        const index = (row: HTMLElement): number => Number(row.dataset['rowIndex']);
        const rowIndex = (row: HTMLElement): number => Number(row.getAttribute('aria-rowindex'));
        const drawn = bodyRows(table).filter((r) => !r.hasAttribute('data-retained'));
        expect(drawn.length).toBeGreaterThan(5);
        expect(index(drawn[0]!)).toBeGreaterThan(10);
        // header row + the data rows before + the two open detail rows + 1
        for (const row of drawn) expect(rowIndex(row)).toBe(1 + index(row) + 2 + 1);
        const retained = bodyRows(table).find((r) => r.hasAttribute('data-retained'))!;
        expect(rowIndex(retained)).toBe(1 + 5 + 2 + 1);
        expect(q(table, '[data-slot="table"]').getAttribute('aria-rowcount')).toBe(String(1 + 2000 + 2));
    });
});

describe('revealing a cell in the frame of a horizontal scroll', () => {
    it('reads the live scroll offset, so a cell already in view does not move the scroller', async () => {
        const table = await mountVirtual({ columns: makeColumns(30, { pinLeft: 1 }), data: makeRows(50, { columns: 30 }) }, {}, { width: 600, height: 400 }, 50, 30);
        const view = viewportOf(table);
        view.scrollLeft = 3000;
        table.focusCell(0, 'c22'); // same task: the scroll event, and the cached offset, have not caught up
        await frames(4);
        expect(view.scrollLeft).toBe(3000);
    });
});

describe('the scroll API', () => {
    it('scrollToRow, scrollToColumn and scrollToCell land the target in view', async () => {
        const table = await mountVirtual({ columns: makeColumns(30, { pinLeft: 1 }), data: makeRows(10000, { columns: 30 }) }, {}, { width: 600, height: 400 }, 10000, 30);
        table.scrollToRow(7500);
        await settle(table);
        expect(visibleIndexes(table)[0]).toBe(7500);
        table.scrollToColumn('c25');
        await settle(table);
        const cell = q(table, '[data-slot="table-cell"][data-column="c25"]').getBoundingClientRect();
        const view = viewportOf(table).getBoundingClientRect();
        expect(cell.left).toBeGreaterThanOrEqual(view.left);
        expect(cell.right).toBeLessThanOrEqual(view.right + 1);
        table.scrollToCell(100, 'c3');
        await settle(table);
        expect(visibleIndexes(table)).toContain(100);
        expect(cellAt(table, 100, 'c3')).not.toBeNull();
    });

    it('an index past the end clamps and does not throw; a pinned column is a no-op', async () => {
        const table = await mountVirtual({ columns: makeColumns(10, { pinLeft: 1 }) });
        expect(() => table.scrollToRow(999999)).not.toThrow();
        await settle(table);
        expect(dataIndexes(table).at(-1)).toBe(9999);
        const left = viewportOf(table).scrollLeft;
        table.scrollToColumn('c0');
        table.scrollToColumn('nope');
        expect(viewportOf(table).scrollLeft).toBe(left);
    });

    it('refresh() re-reads a changed viewport height', async () => {
        const table = await mountVirtual();
        const count = bodyRows(table).length;
        (table.parentElement as HTMLElement).style.height = '800px';
        await frames(3);
        table.refresh();
        await settle(table);
        expect(bodyRows(table).length).toBeGreaterThan(count + 5);
    });
});

describe('the focused row stays drawn', () => {
    it('keeps the focused cell and DOM focus while the window is far away', async () => {
        const table = await mountVirtual();
        table.focusCell(100, 'c1');
        await settle(table);
        const cell = cellAt(table, 100, 'c1')!;
        expect(document.activeElement).toBe(cell);
        await scrollTo(table, { top: 200000 });
        const kept = cellAt(table, 100, 'c1')!;
        expect(kept).not.toBeNull();
        expect(kept.closest('[data-slot="table-row"]')!.hasAttribute('data-retained')).toBe(true);
        expect(document.activeElement).toBe(kept);
        expect(kept.closest('[data-slot="table-row"]')!.getAttribute('aria-rowindex')).toBe('102');
        expect(roving(table)).toEqual([kept]);
        // ArrowDown continues from it, and scrolls it into view
        await press('{ArrowDown}');
        expect(table.focusedCell).toEqual({ rowIndex: 101, columnKey: 'c1' });
        await settle(table);
        expect(visibleIndexes(table)).toContain(101);
    });
});

describe('cells that are custom elements', () => {
    it('constructs few elements per scroll step (the recycling benchmark)', async () => {
        const counter = countConstructions('ge-bench-cell');
        const columns: ColumnDef<SampleRow>[] = Array.from({ length: 20 }, (_, i) => ({ accessorKey: `c${i}`, header: `C${i}`, width: '100px', component: 'ge-bench-cell' }));
        const table = await mountVirtual({ columns, data: makeRows(2000, { columns: 20 }) }, {}, { width: 900, height: 400 }, 2000, 20);
        counter.reset();
        const steps = 200;
        const result = await perf(async () => {
            for (let i = 0; i < steps; i++) await scrollGrid(table, { top: 40 * 3 * (i + 1) });
        });
        const perStep = counter.count / steps;
        console.info(`[virtual bench] custom-element cells: ${counter.count} constructions over ${steps} steps of 3 rows (${perStep.toFixed(1)}/step, a step brings 3 rows x ${bodyRows(table)[0]!.children.length} cells); script ${(result.scriptMs / steps).toFixed(2)} ms/step, p95 frame ${result.p95FrameMs.toFixed(1)} ms, nodes ${result.nodes}`);
        // 3 new rows x 20 cells per step is the keyed minimum
        expect(perStep).toBeLessThanOrEqual(2 * 3 * 20);
    });
});

describe('perf budgets (soft: numbers are logged)', () => {
    it('10k x 8: first render, and 200 scroll steps with no long task', async () => {
        const started = performance.now();
        const table = await mountVirtual();
        const first = performance.now() - started;
        const result = await perf(async () => {
            for (let i = 0; i < 200; i++) await scrollGrid(table, { top: 400 * (i + 1) });
        });
        console.info(`[virtual perf] 10k x 8 first render ${first.toFixed(0)} ms; 200 steps: script ${(result.scriptMs / 200).toFixed(2)} ms/step, layout ${(result.layoutMs / 200).toFixed(2)}, style ${(result.styleMs / 200).toFixed(2)}, layouts/step ${(result.layoutCount / 200).toFixed(2)}, long tasks ${result.longTasks} (max ${result.maxLongTaskMs.toFixed(0)} ms), p95 frame ${result.p95FrameMs.toFixed(1)} ms`);
        expect(first).toBeLessThan(450);
        expect(result.maxLongTaskMs).toBeLessThan(150);
        expect(result.layoutCount / 200).toBeLessThanOrEqual(6);
    });

    it('the DOM is as big for 100k rows as for 10k', async () => {
        const small = await mountVirtual();
        const smallNodes = qa(small, '*').length;
        const big = await mountVirtual({ data: makeRows(100000, { columns: 8 }) });
        await scrollTo(big, { top: 2_000_000 });
        expect(qa(big, '*').length).toBeLessThan(smallNodes * 1.6);
        const inWindow = bodyRows(big).length;
        expect(qa(big, '*').length).toBeLessThan(inWindow * (8 + 4) * 3);
    });

    it('selecting a row or toggling loading keeps the window', async () => {
        const table = await mountVirtual({ enableRowSelection: true });
        await scrollTo(table, { top: 4000 });
        const before = bodyRows(table)[0]!;
        const range = dataIndexes(table);
        table.loading = true;
        await settle(table);
        table.loading = false;
        await settle(table);
        expect(dataIndexes(table)).toEqual(range);
        expect(bodyRows(table)[0]).toBe(before);
    });
});
