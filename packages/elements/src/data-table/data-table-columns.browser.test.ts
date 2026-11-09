import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef, DataTableViewState } from './data-table.types.js';
import {
    axProps, axTree, cellAt, headCell, makeColumns, makeRows, mountTable, q, qa, SAMPLE_COLUMNS, SAMPLE_ROWS, send, settle, type SampleRow,
} from './data-table-fixtures.js';
import { emulateTouch, frames, mouseDblClick, mouseDrag, parkMouse, press, touchDrag, touchTap, withRtl, type Point } from './data-table-input-fixtures.js';

afterEach(() => parkMouse());

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const widthOf = (el: Element | null): number => el!.getBoundingClientRect().width;
const handleOf = (table: Element, key: string): HTMLElement => q(headCell(table, key), '[data-slot="data-table-resize-handle"]');
/** A point on the resize handle of `key` (the handle sits inside the head, at its inline-end edge). */
function onHandle(table: Element, key: string, rtl = false): Point {
    const rect = headCell(table, key).getBoundingClientRect();
    return { x: rtl ? rect.left + 3 : rect.right - 3, y: rect.top + rect.height / 2 };
}
const collect = <D>(table: GeDataTable<SampleRow>, name: string): D[] => {
    const got: D[] = [];
    table.addEventListener(name, (event) => got.push((event as CustomEvent<D>).detail));
    return got;
};
const announcement = (table: Element): string => q(table, '[data-slot="data-table-announcer"]').textContent!.replaceAll('​', '').trim();
const order = (table: Element): string[] => qa(table, '[data-slot="table-head"][data-column-id]').map((h) => h.dataset['columnId']!);
const headCenter = (table: Element, key: string): Point => {
    const rect = headCell(table, key).getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};
/** A point inside head `key`, `fraction` of the way from its left edge. */
const inHead = (table: Element, key: string, fraction: number): Point => {
    const rect = headCell(table, key).getBoundingClientRect();
    return { x: rect.left + rect.width * fraction, y: rect.top + rect.height / 2 };
};

const sortButton = (table: Element, key: string): HTMLElement => headCell(table, key).querySelector('ge-data-table-column-header')!.shadowRoot!.querySelector<HTMLElement>('ge-button')!;

/** The sort label: `ge-button` itself has no box, so a pointer aims at its title. */
const sortLabel = (table: Element, key: string): HTMLElement => headCell(table, key).querySelector('ge-data-table-column-header')!.shadowRoot!.querySelector<HTMLElement>('.title')!;

/** A table in a box leaves its box behind on `remove()`; take the box, so the next table sits where this one was. */
const unmount = (table: Element): void => table.parentElement!.remove();

const mountResizable = (props: Record<string, unknown> = {}, box = { width: 700, height: 400 }) =>
    mountTable<SampleRow>({ enableColumnResize: true, showPagination: false, ...props }, {}, box);
const mountWide = (props: Record<string, unknown> = {}, attrs: Record<string, string> = {}, columns = 4) =>
    mountTable<SampleRow>({ columns: makeColumns(columns), data: makeRows(5, { columns }), enableColumnReorder: true, showPagination: false, ...props }, attrs, { width: 700, height: 400 });

describe('column resize by mouse', () => {
    it('widens the head and the body cells together, shifts later columns, and reports one change', async () => {
        const table = await mountResizable();
        const events = collect<{ columnKey: string; oldWidth: string; newWidth: string }>(table, 'column-resize');
        const widths = collect<Record<string, string>>(table, 'column-widths-change');
        const ageBefore = headCell(table, 'age').getBoundingClientRect().left;

        await mouseDrag(onHandle(table, 'name'), { dx: 80, dy: 0 });
        await settle(table);

        expect(widthOf(headCell(table, 'name'))).toBe(280);
        expect(widthOf(cellAt(table, 0, 'name'))).toBe(280);
        expect(widthOf(cellAt(table, 3, 'name'))).toBe(280);
        expect(headCell(table, 'age').getBoundingClientRect().left - ageBefore).toBe(80);
        expect(events).toEqual([{ columnKey: 'name', oldWidth: '200px', newWidth: '280px' }]);
        expect(widths).toEqual([{ name: '280px' }]);
        expect(q(table, '[data-slot="data-table-viewport"]').hasAttribute('data-table-resizing')).toBe(false);
        expect(handleOf(table, 'name').hasAttribute('data-resizing')).toBe(false);
    });

    it('shows the drag live: only one custom property changes while the button is down', async () => {
        const table = await mountResizable();
        const surface = q(table, '[data-slot="table"]');
        const before = surface.style.cssText;
        const drag = mouseDrag(onHandle(table, 'name'), { dx: 50, dy: 0 }, { holdMs: 300 });
        await sleep(200);

        const during = surface.style;
        expect(during.getPropertyValue('--ge-dt-col-0')).toBe('250px');
        expect(during.getPropertyValue('--ge-dt-col-1')).toBe('120px');
        expect(surface.style.cssText).not.toBe(before);
        expect(handleOf(table, 'name').hasAttribute('data-resizing')).toBe(true);
        expect(q(table, '[data-slot="data-table-viewport"]').hasAttribute('data-table-resizing')).toBe(true);
        await drag;
    });

    it('stops at the floor in px, and in rem', async () => {
        const px = await mountResizable({ columns: [{ accessorKey: 'name', header: 'Name', width: '200px', minWidth: '150px' }, ...SAMPLE_COLUMNS.slice(1)] });
        await mouseDrag(onHandle(px, 'name'), { dx: -150, dy: 0 });
        await settle(px);
        expect(widthOf(headCell(px, 'name'))).toBe(150);
        expect(widthOf(cellAt(px, 0, 'name'))).toBe(150);
        unmount(px);

        const rem = await mountResizable({ columns: [{ accessorKey: 'name', header: 'Name', width: '10rem', minWidth: '8rem' }, ...SAMPLE_COLUMNS.slice(1)] });
        const events = collect<{ newWidth: string }>(rem, 'column-resize');
        await mouseDrag(onHandle(rem, 'name'), { dx: -150, dy: 0 });
        await settle(rem);
        expect(widthOf(headCell(rem, 'name'))).toBe(128);
        // A drag that ended on the floor from above moves; one that starts on it and goes lower does not.
        await mouseDrag(onHandle(rem, 'name'), { dx: -40, dy: 0 });
        expect(events.map((e) => e.newWidth)).toEqual(['128px']);
    });

    it('starts from the rendered width of a rem column, not its digits', async () => {
        const table = await mountResizable({ columns: [{ accessorKey: 'name', header: 'Name', width: '10rem' }, ...SAMPLE_COLUMNS.slice(1)] });
        await mouseDrag(onHandle(table, 'name'), { dx: 40, dy: 0 });
        expect(widthOf(headCell(table, 'name'))).toBe(200);
    });

    it('resizes the other way in rtl', async () => {
        const table = await mountResizable();
        await withRtl(table);
        const before = widthOf(headCell(table, 'name'));
        await mouseDrag(onHandle(table, 'name', true), { dx: -80, dy: 0 });
        await settle(table);
        expect(widthOf(headCell(table, 'name'))).toBe(before + 80);
        expect(widthOf(cellAt(table, 1, 'name'))).toBe(before + 80);
    });

    it('moves the offset of a pinned column that follows while the drag is live', async () => {
        const columns = makeColumns(3, { width: '150px', pinLeft: 2 });
        const table = await mountResizable({ columns, data: makeRows(3, { columns: 3 }) });
        const second = () => headCell(table, 'c1').getBoundingClientRect().left;
        const before = second();
        const drag = mouseDrag(onHandle(table, 'c0'), { dx: 40, dy: 0 }, { holdMs: 250 });
        await sleep(180);
        expect(second() - before).toBe(40);
        await drag;
        await settle(table);
        expect(second() - before).toBe(40);
    });

    it('resizes a column that has no width (auto) and fixes it', async () => {
        const table = await mountResizable({ columns: [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'age', header: 'Age', width: '120px' }] });
        const before = widthOf(headCell(table, 'name'));
        await mouseDrag(onHandle(table, 'name'), { dx: -60, dy: 0 });
        await settle(table);
        expect(widthOf(headCell(table, 'name'))).toBe(Math.round(before) - 60);
        expect(headCell(table, 'name').dataset['width']).toBe('fixed');
    });

    it('commits nothing when Escape cancels the drag, or when the press does not move', async () => {
        const table = await mountResizable();
        const events = collect(table, 'column-resize');
        const widths = collect(table, 'column-widths-change');
        const before = q(table, '[data-slot="table"]').style.cssText;

        const drag = mouseDrag(onHandle(table, 'name'), { dx: 70, dy: 0 }, { holdMs: 400 });
        await sleep(250);
        expect(widthOf(headCell(table, 'name'))).toBe(270);
        await press('{Escape}');
        expect(widthOf(headCell(table, 'name'))).toBe(200);
        await drag;
        await settle(table);

        expect(widthOf(headCell(table, 'name'))).toBe(200);
        expect(q(table, '[data-slot="table"]').style.cssText).toBe(before);
        await mouseDrag(onHandle(table, 'name'), { dx: 0, dy: 0 });
        expect(events).toEqual([]);
        expect(widths).toEqual([]);
    });
});

describe('column auto-fit', () => {
    const columns: ColumnDef<SampleRow>[] = [
        { accessorKey: 'name', header: 'Name', width: '60px' },
        { accessorKey: 'age', header: 'Age', width: '300px', minWidth: '90px' },
        { accessorKey: 'id', header: 'Id', width: '300px', minWidth: '250px' },
    ];
    const data: SampleRow[] = [{ id: 'a', name: 'A fairly long name to fit', age: 1 }, { id: 'b', name: 'Bob', age: 2 }];

    it('grows a narrow column to its content and shrinks a wide one, never below the minimum', async () => {
        const table = await mountResizable({ columns, data });
        const events = collect<{ columnKey: string; oldWidth: string; newWidth: string }>(table, 'column-resize');
        table.autoSizeColumn('name');
        table.autoSizeColumn('age');
        table.autoSizeColumn('id');
        await settle(table);

        const name = widthOf(headCell(table, 'name'));
        const age = widthOf(headCell(table, 'age'));
        expect(name).toBeGreaterThan(120);
        expect(age).toBeLessThan(150);
        expect(age).toBeGreaterThanOrEqual(90);
        expect(widthOf(headCell(table, 'id'))).toBe(250);
        // The widest cell now fits without being cut off.
        const cell = cellAt(table, 0, 'name')!;
        const text = cell.firstElementChild ?? cell;
        expect(text.scrollWidth).toBeLessThanOrEqual(Math.ceil(text.clientWidth));
        expect(widthOf(cellAt(table, 1, 'name'))).toBe(name);
        expect(events.map((e) => [e.columnKey, e.oldWidth])).toEqual([['name', '60px'], ['age', '300px'], ['id', '300px']]);
        expect(events[0]!.newWidth).toBe(`${name}px`);
        // Nothing measured is left behind.
        expect(table.querySelector('[data-measure], [data-measuring]')).toBeNull();
    });

    it('counts the header text', async () => {
        const table = await mountResizable({ columns: [{ accessorKey: 'name', header: 'A header much longer than any cell value', width: '50px' }], data: [{ id: 'a', name: 'x', age: 1 }] });
        table.autoSizeColumn('name');
        await settle(table);
        expect(widthOf(headCell(table, 'name'))).toBeGreaterThan(200);
    });

    it('fits all columns in one pass, one event per changed column', async () => {
        const table = await mountResizable({ columns, data });
        const events = collect(table, 'column-resize');
        const widths = collect(table, 'column-widths-change');
        table.autoSizeAllColumns();
        await settle(table);
        expect(events).toHaveLength(3);
        expect(widths).toHaveLength(1);
        table.autoSizeAllColumns();
        expect(events).toHaveLength(3);
    });

    it('measures a custom element whose content lives in a shadow root', async () => {
        customElements.define(
            'ge-test-wide-cell',
            class extends HTMLElement {
                constructor() {
                    super();
                    this.attachShadow({ mode: 'open' }).innerHTML = '<span style="display:inline-block;width:260px">wide</span>';
                }
            },
        );
        const table = await mountResizable({ columns: [{ accessorKey: 'name', header: 'Name', width: '80px', component: 'ge-test-wide-cell' }], data });
        table.autoSizeColumn('name');
        await settle(table);
        expect(widthOf(headCell(table, 'name'))).toBeGreaterThanOrEqual(262);
        expect(widthOf(headCell(table, 'name'))).toBeLessThan(330);
    });

    it('fits on a double click of the handle, and reports once', async () => {
        const table = await mountResizable({ columns, data });
        const events = collect(table, 'column-resize');
        await mouseDblClick(onHandle(table, 'name'));
        await settle(table);
        expect(events).toHaveLength(1);
        expect(widthOf(headCell(table, 'name'))).toBeGreaterThan(120);
    });

    it('fits only the rendered rows, and fits the columns to the viewport evenly', async () => {
        const table = await mountResizable({ columns, data });
        table.fitColumnsToViewport();
        await settle(table);
        const each = Math.floor(q(table, '[data-slot="data-table-viewport"]').clientWidth / 3);
        expect(['name', 'age', 'id'].map((key) => widthOf(headCell(table, key)))).toEqual([each, each, each]);
    });
});

describe('column resize by touch', () => {
    it('drags with a finger without scrolling the viewport', async () => {
        const table = await mountResizable({ columns: makeColumns(4, { width: '200px' }), data: makeRows(3, { columns: 4 }) }, { width: 500, height: 300 });
        await emulateTouch(true);
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        expect(getComputedStyle(handleOf(table, 'c0')).touchAction).toBe('none');
        const events = collect(table, 'column-resize');
        await touchDrag(onHandle(table, 'c0'), { dx: 60, dy: 0 });
        await settle(table);
        expect(widthOf(headCell(table, 'c0'))).toBe(260);
        expect(viewport.scrollLeft).toBe(0);
        expect(events).toHaveLength(1);
    });

    it('fits on two taps within 300 ms, once, but not on two taps 450 ms apart or after a drag', async () => {
        const columns: ColumnDef<SampleRow>[] = [{ accessorKey: 'name', header: 'Name', width: '300px' }, { accessorKey: 'age', header: 'Age', width: '300px' }];
        const table = await mountResizable({ columns, data: SAMPLE_ROWS });
        await emulateTouch(true);
        const events = collect(table, 'column-resize');

        await touchTap(onHandle(table, 'name'));
        await touchTap(onHandle(table, 'name'));
        await settle(table);
        expect(events).toHaveLength(1);
        expect(widthOf(headCell(table, 'name'))).toBeLessThan(150);

        await touchTap(onHandle(table, 'age'));
        await sleep(450);
        await touchTap(onHandle(table, 'age'));
        await settle(table);
        expect(events).toHaveLength(1);

        await touchDrag(onHandle(table, 'age'), { dx: 30, dy: 0 });
        await touchTap(onHandle(table, 'age'));
        await settle(table);
        expect(events).toHaveLength(2);
        expect(events[1]!.newWidth).toBe('330px');
    });
});

describe('column resize by keyboard', () => {
    it('exposes a separator that Tab reaches from the sort button', async () => {
        const table = await mountResizable();
        const sort = headCell(table, 'name').querySelector('ge-data-table-column-header')!.shadowRoot!.querySelector<HTMLElement>('ge-button')!;
        sort.focus();
        await press('{Tab}');
        expect(document.activeElement).toBe(handleOf(table, 'name'));
        expect(handleOf(table, 'name').getAttribute('role')).toBe('separator');
        expect(handleOf(table, 'name').getAttribute('aria-valuenow')).toBe('200');

        const separator = (await axTree()).find((n) => n.role?.value === 'separator' && n.name?.value === 'Resize Name column');
        expect(separator).toBeDefined();
        expect((separator as { value?: { value?: number } }).value?.value).toBe(200);
        expect(axProps(separator)['valuemin']).toBe(80);
    });

    it('resizes with the arrows, Shift, Home and Enter, one change per press', async () => {
        const columns: ColumnDef<SampleRow>[] = [{ accessorKey: 'name', header: 'Name', width: '200px', minWidth: '120px' }, { accessorKey: 'age', header: 'Age', width: '120px' }];
        const table = await mountResizable({ columns, data: SAMPLE_ROWS });
        const events = collect<{ oldWidth: string; newWidth: string }>(table, 'column-resize');
        handleOf(table, 'name').focus();

        await press('{ArrowRight}');
        expect(widthOf(headCell(table, 'name'))).toBe(210);
        await press('{Shift>}{ArrowRight}{/Shift}');
        expect(widthOf(headCell(table, 'name'))).toBe(260);
        await press('{ArrowLeft}');
        expect(widthOf(headCell(table, 'name'))).toBe(250);
        await press('{Home}');
        expect(widthOf(headCell(table, 'name'))).toBe(120);
        await press('{ArrowLeft}');
        expect(widthOf(headCell(table, 'name'))).toBe(120);
        expect(events.map((e) => e.newWidth)).toEqual(['210px', '260px', '250px', '120px']);
        expect(events[1]!.oldWidth).toBe('210px');
        expect(document.activeElement).toBe(handleOf(table, 'name'));
        expect(handleOf(table, 'name').getAttribute('aria-valuenow')).toBe('120');

        await press('{Enter}');
        expect(widthOf(headCell(table, 'name'))).toBeLessThan(120 + 1);
        await press('{Escape}');
        expect(document.activeElement).not.toBe(handleOf(table, 'name'));
    });

    it('flips the arrows in rtl, and announces only the last width', async () => {
        const table = await mountResizable();
        await withRtl(table);
        handleOf(table, 'name').focus();
        await press('{ArrowLeft}');
        await press('{ArrowLeft}');
        expect(widthOf(headCell(table, 'name'))).toBe(220);
        await press('{ArrowRight}');
        expect(widthOf(headCell(table, 'name'))).toBe(210);
        expect(announcement(table)).toBe('');
        await sleep(450);
        expect(announcement(table)).toBe('Name width 210 pixels');
    });
});

describe('column reorder by mouse', () => {
    it('drops a header on the start half or the end half of another, with a bar showing where', async () => {
        const table = await mountWide();
        const seen: string[] = [];
        const first = mouseDrag(headCenter(table, 'c2'), inHead(table, 'c0', 0.2), { holdMs: 300 });
        await sleep(200);
        const bar = q(table, '[data-slot="data-table-drop-indicator"]');
        seen.push(bar.dataset['edge']!, bar.parentElement!.dataset['columnId']!);
        expect(headCell(table, 'c2').hasAttribute('data-dragging')).toBe(true);
        expect(cellAt(table, 0, 'c2')!.hasAttribute('data-dragging')).toBe(true);
        await first;
        await settle(table);
        expect(seen).toEqual(['start', 'c0']);
        expect(order(table)).toEqual(['c2', 'c0', 'c1', 'c3']);
        expect(table.columnOrder).toEqual(['c2', 'c0', 'c1', 'c3']);
        expect(table.querySelector('[data-slot="data-table-drop-indicator"], [data-dragging]')).toBeNull();

        await mouseDrag(headCenter(table, 'c2'), inHead(table, 'c3', 0.8));
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c1', 'c3', 'c2']);
        // The body cells follow the headers.
        expect(cellAt(table, 0, 'c2')!.getBoundingClientRect().left).toBeGreaterThan(cellAt(table, 0, 'c3')!.getBoundingClientRect().left);
    });

    it('places the bar by the pointer half in rtl', async () => {
        const table = await mountWide();
        await withRtl(table);
        // In rtl c0 is on the right: its start half is its right half.
        await mouseDrag(headCenter(table, 'c1'), inHead(table, 'c0', 0.8));
        await settle(table);
        expect(order(table)).toEqual(['c1', 'c0', 'c2', 'c3']);
        await mouseDrag(headCenter(table, 'c3'), inHead(table, 'c1', 0.8));
        await settle(table);
        expect(order(table)).toEqual(['c3', 'c1', 'c0', 'c2']);
    });

    it('does not move a column into another pin group, and keeps hidden columns in their slots', async () => {
        const pinned = await mountWide({ columns: makeColumns(4, { pinLeft: 1 }) });
        const pinnedDrag = mouseDrag(headCenter(pinned, 'c2'), inHead(pinned, 'c0', 0.3), { holdMs: 700 });
        await sleep(500);
        expect(pinned.querySelector('[data-slot="data-table-drop-indicator"]')).toBeNull();
        await pinnedDrag;
        await settle(pinned);
        expect(pinned.columnOrder).toEqual([]);
        expect(order(pinned)).toEqual(['c0', 'c1', 'c2', 'c3']);
        unmount(pinned);

        const hidden = await mountWide({ columnVisibility: { c1: false } });
        await mouseDrag(headCenter(hidden, 'c2'), inHead(hidden, 'c0', 0.2));
        await settle(hidden);
        expect(hidden.columnOrder).toEqual(['c2', 'c1', 'c0', 'c3']);
        expect(order(hidden)).toEqual(['c2', 'c0', 'c3']);
    });

    it('scrolls the viewport at its edge while a header is held there', async () => {
        const table = await mountWide({ columns: makeColumns(10), data: makeRows(3, { columns: 10 }) });
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        const edge = viewport.getBoundingClientRect();
        const at = { x: edge.right - 12, y: edge.top + 20 };
        await mouseDrag(headCenter(table, 'c0'), at, { holdMs: 600 });
        expect(viewport.scrollLeft).toBeGreaterThan(50);
    });

    it('does not drag a column that opted out, or when reordering is off, and a click on the sort button still sorts', async () => {
        const off = await mountWide({ enableColumnReorder: false });
        await mouseDrag(headCenter(off, 'c1'), inHead(off, 'c0', 0.2));
        expect(off.columnOrder).toEqual([]);
        unmount(off);

        const columns = makeColumns(3);
        columns[1] = { ...columns[1]!, enableReordering: false };
        const some = await mountWide({ columns });
        expect(headCell(some, 'c1').hasAttribute('data-draggable')).toBe(false);
        await mouseDrag(headCenter(some, 'c1'), inHead(some, 'c0', 0.2));
        expect(some.columnOrder).toEqual([]);
        unmount(some);

        const table = await mountWide();
        // A press that never reaches the threshold is a click: it sorts.
        await mouseDrag(sortLabel(table, 'c1'), { dx: 2, dy: 0 });
        await settle(table);
        expect(table.sortState).toEqual({ column: 'c1', direction: 'asc' });
        // A real drag that ends over the sort button is not.
        await mouseDrag(sortLabel(table, 'c2'), sortLabel(table, 'c0'));
        await settle(table);
        expect(table.sortState).toEqual({ column: 'c1', direction: 'asc' });
        expect(order(table)).toEqual(['c2', 'c0', 'c1', 'c3']);
    });

    it('cancels with Escape', async () => {
        const table = await mountWide();
        const drag = mouseDrag(headCenter(table, 'c2'), inHead(table, 'c0', 0.2), { holdMs: 400 });
        await sleep(250);
        await press('{Escape}');
        await drag;
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c1', 'c2', 'c3']);
        expect(table.columnOrder).toEqual([]);
    });
});

describe('column reorder by keyboard', () => {
    const focusedColumn = (table: Element): string | undefined => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-column-id]')?.dataset['columnId'] ?? undefined;

    it('moves the column with Alt+Shift+Arrow, keeps the focus on it, announces, and does nothing at the ends', async () => {
        const table = await mountWide();
        expect(sortButton(table, 'c1').parentElement).not.toBeNull();
        sortButton(table, 'c1').focus();

        await press('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c2', 'c1', 'c3']);
        expect(announcement(table)).toBe('C1 moved to position 3 of 4');
        expect(focusedColumn(table)).toBe('c1');

        await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
        await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
        await settle(table);
        expect(order(table)).toEqual(['c1', 'c0', 'c2', 'c3']);
        expect(announcement(table)).toBe('C1 moved to position 1 of 4');
        const spoken = announcement(table);
        await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
        expect(order(table)).toEqual(['c1', 'c0', 'c2', 'c3']);
        expect(announcement(table)).toBe(spoken);
        expect(table.columnOrder).toEqual(['c1', 'c0', 'c2', 'c3']);
    });

    it('flips in rtl and carries a keyboard hint on the sort button', async () => {
        const table = await mountWide();
        expect(sortButton(table, 'c1').getAttribute('aria-keyshortcuts')).toContain('Alt+Shift+ArrowLeft');
        expect(headCell(table, 'c1').getAttribute('aria-description')).toBe('Alt+Shift+Left or Right arrow moves this column');
        await withRtl(table);
        sortButton(table, 'c1').focus();
        await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c2', 'c1', 'c3']);
    });

    it('moves from the resize separator too, and through the moveColumn method', async () => {
        const table = await mountWide({ enableColumnResize: true });
        handleOf(table, 'c0').focus();
        await press('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
        await settle(table);
        expect(order(table)).toEqual(['c1', 'c0', 'c2', 'c3']);
        expect(document.activeElement).toBe(handleOf(table, 'c0'));
        table.moveColumn('c3', 0);
        await settle(table);
        expect(order(table)).toEqual(['c3', 'c1', 'c0', 'c2']);
        table.moveColumn('c3', 99);
        table.moveColumn('nope', 1);
        await settle(table);
        expect(order(table)).toEqual(['c1', 'c0', 'c2', 'c3']);
    });
});

describe('column reorder by touch', () => {
    /** The kit has no press-hold-then-move; this is the touch point sequence of one. */
    async function holdThenDrag(from: Point, to: Point): Promise<void> {
        const frame = window.frameElement;
        const rect = frame?.getBoundingClientRect();
        const scale = rect ? rect.width / (window.innerWidth || 1) : 1;
        const top = (p: Point): Point => ({ x: (rect?.left ?? 0) + p.x * scale, y: (rect?.top ?? 0) + p.y * scale });
        const send_ = (type: string, at?: Point) => send('Input.dispatchTouchEvent', { type, touchPoints: at ? [top(at)] : [] });
        await send_('touchStart', from);
        await sleep(650);
        for (let i = 1; i <= 8; i++) await send_('touchMove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
        await send_('touchEnd');
        await frames(2);
    }

    it('picks a header up with a long press and moves it', async () => {
        const table = await mountWide();
        await emulateTouch(true);
        await holdThenDrag(headCenter(table, 'c2'), inHead(table, 'c0', 0.2));
        await settle(table);
        expect(order(table)).toEqual(['c2', 'c0', 'c1', 'c3']);
        expect(table.querySelector('[data-dragging], [data-slot="data-table-drop-indicator"]')).toBeNull();
    });

    it('lets a plain swipe scroll the header instead', async () => {
        const table = await mountWide({ columns: makeColumns(10), data: makeRows(3, { columns: 10 }) });
        await emulateTouch(true);
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        await touchDrag(headCenter(table, 'c3'), { dx: -200, dy: 0 });
        await frames(3);
        expect(viewport.scrollLeft).toBeGreaterThan(50);
        expect(table.columnOrder).toEqual([]);
    });
});

describe('column visibility, pins and state', () => {
    it('refuses to hide the last visible data column, and keeps its checkbox checked', async () => {
        const table = await mountTable<SampleRow>({ showPagination: false, columns: makeColumns(2), data: makeRows(3, { columns: 2 }) });
        const columns = table.provider('columns')!;
        columns.setVisible('c0', false);
        await settle(table);
        expect(order(table)).toEqual(['c1']);
        columns.setVisible('c1', false);
        await settle(table);
        expect(order(table)).toEqual(['c1']);
        expect(table.columnVisibility).toEqual({ c0: false });
        columns.setVisible('c0', true);
        columns.showAll();
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c1']);
    });

    it('draws the visibility panel from the checkboxes and puts a refused one back', async () => {
        const table = await mountTable<SampleRow>({ showPagination: false, columns: makeColumns(2), data: makeRows(3, { columns: 2 }) });
        await userEvent.click(q(table, '[data-slot="data-table-columns-trigger"]'));
        await frames(3);
        const boxes = qa(document.body, '[data-slot="data-table-columns-item"] ge-checkbox');
        expect(boxes).toHaveLength(2);
        await userEvent.click(boxes[0]!);
        await frames(2);
        expect(order(table)).toEqual(['c1']);
        await userEvent.click(boxes[1]!);
        await frames(4);
        expect(order(table)).toEqual(['c1']);
        expect((boxes[1] as HTMLElement & { checked: boolean }).checked).toBe(true);
    });

    it('puts back only its own table\'s checkbox, not the same column\'s in another table', async () => {
        const mount = () => mountTable<SampleRow>({ showPagination: false, columns: makeColumns(2), data: makeRows(3, { columns: 2 }) });
        const [one, other] = [await mount(), await mount()];
        const box = (table: GeDataTable<SampleRow>, i: number) => qa(table, '[data-slot="data-table-columns-item"] ge-checkbox')[i] as HTMLElement & { checked: boolean };
        other.provider('columns')!.setVisible('c1', false);
        await settle(other);
        expect(box(other, 1).checked).toBe(false);
        one.provider('columns')!.setVisible('c0', false);
        await settle(one);
        one.provider('columns')!.setVisible('c1', false);
        await settle(one);
        await frames(2);
        expect(box(one, 1).checked).toBe(true);
        expect(box(other, 1).checked).toBe(false);
    });

    it('moves a pin into the layout', async () => {
        const table = await mountWide({ enableColumnReorder: false });
        table.pinColumn('c2', 'left');
        await settle(table);
        expect(order(table)).toEqual(['c2', 'c0', 'c1', 'c3']);
        expect(headCell(table, 'c2').dataset['pinned']).toBe('left');
        table.pinColumn('c2', undefined);
        await settle(table);
        expect(order(table)).toEqual(['c0', 'c1', 'c2', 'c3']);
    });

    it('re-lays the grid out from applyColumnState and round-trips through getColumnState', async () => {
        const table = await mountWide({ enableColumnReorder: false });
        const changes = collect<unknown>(table, 'column-order-change');
        table.applyColumnState([
            { columnKey: 'c0', width: '90px', order: 2, visible: true },
            { columnKey: 'c1', visible: false, order: 3 },
            { columnKey: 'c2', width: '210px', order: 0, pin: 'right' },
            { columnKey: 'c3', order: 1 },
        ]);
        await settle(table);
        expect(order(table)).toEqual(['c3', 'c0', 'c2']);
        expect(widthOf(headCell(table, 'c0'))).toBe(90);
        expect(widthOf(cellAt(table, 0, 'c2'))).toBe(210);
        expect(headCell(table, 'c2').dataset['pinned']).toBe('right');
        expect(changes).toHaveLength(1);

        const saved = table.getColumnState();
        expect(saved.map((s) => s.columnKey)).toEqual(['c0', 'c1', 'c2', 'c3']);
        expect(saved.find((s) => s.columnKey === 'c2')).toMatchObject({ width: '210px', pin: 'right', visible: true, order: 0 });

        const fresh = await mountWide({ enableColumnReorder: false });
        fresh.applyColumnState(JSON.parse(JSON.stringify(saved)));
        await settle(fresh);
        expect(order(fresh)).toEqual(['c3', 'c0', 'c2']);
        expect(widthOf(headCell(fresh, 'c0'))).toBe(90);
        expect(fresh.getColumnState()).toEqual(saved);
        // Nothing changes when the same state goes in again.
        const again = collect<unknown>(fresh, 'column-widths-change');
        fresh.applyColumnState(saved);
        expect(again).toEqual([]);
    });

    it('saves and restores the whole view in one flush, and refuses a bad token', async () => {
        const table = await mountWide({ enableColumnReorder: false, columns: makeColumns(3), data: makeRows(30, { columns: 3 }) });
        table.showPagination = true;
        await settle(table);
        const source = await mountWide({ enableColumnReorder: false, columns: makeColumns(3), data: makeRows(30, { columns: 3 }) });
        source.showPagination = true;
        source.sortState = { column: 'c1', direction: 'desc' };
        source.globalFilter = '1';
        source.columnWidths = { c0: '111px' };
        source.paginationState = { pageIndex: 1, pageSize: 5 };
        await settle(source);
        const token = JSON.parse(JSON.stringify(source.getViewState())) as DataTableViewState;
        expect(token.version).toBe(1);

        const queries: unknown[] = [];
        table.addEventListener('query', (event) => queries.push((event as CustomEvent).detail));
        const widths = collect(table, 'column-widths-change');
        expect(table.applyViewState(token)).toBe(true);
        await settle(table);
        expect(queries).toHaveLength(1);
        // The token carries every column's width, declared ones included.
        expect(widths).toEqual([{ c0: '111px', c1: '150px', c2: '150px' }]);
        expect(table.sortState).toEqual({ column: 'c1', direction: 'desc' });
        expect(table.globalFilter).toBe('1');
        expect(table.paginationState).toEqual({ pageIndex: 1, pageSize: 5 });
        expect(widthOf(headCell(table, 'c0'))).toBe(111);

        const before = JSON.stringify(table.getViewState());
        const bad = { ...token, pagination: { pageIndex: -1, pageSize: 5 } } as DataTableViewState;
        expect(table.applyViewState(bad)).toBe(false);
        expect(table.applyViewState({ ...token, version: 99 })).toBe(false);
        expect(table.applyViewState(null)).toBe(false);
        expect(JSON.stringify(table.getViewState())).toBe(before);
        expect(queries).toHaveLength(1);
    });
});

describe('announcements', () => {
    /** Every text the live region held, in order. */
    function record(table: Element): string[] {
        const spoken: string[] = [];
        const region = q(table, '[data-slot="data-table-announcer"]');
        new MutationObserver(() => spoken.push(announcement(table))).observe(region, { childList: true, characterData: true, subtree: true });
        return spoken;
    }

    it('says the selection once, 500 ms after it settles, counting only rows that exist', async () => {
        const table = await mountTable<SampleRow>({ showPagination: false });
        const spoken = record(table);
        const set = (selection: Record<string, boolean>) => table.model.set('rowSelection', selection);
        set({ a: true });
        await sleep(100);
        set({ a: true, b: true });
        await sleep(100);
        set({ a: true, b: true, c: true, gone: true });
        await sleep(300);
        expect(spoken).toEqual([]);
        await sleep(400);
        expect(spoken).toEqual(['3 rows selected']);
        set({ a: true });
        await sleep(600);
        set({});
        await sleep(600);
        expect(spoken).toEqual(['3 rows selected', '1 row selected', 'Selection cleared']);
    });

    it('does not speak a selection the consumer wrote', async () => {
        const table = await mountTable<SampleRow>({ showPagination: false });
        const spoken = record(table);
        table.rowSelection = { a: true };
        await sleep(700);
        expect(spoken).toEqual([]);
    });

    it('says each page change at once, and a sort immediately', async () => {
        const table = await mountTable<SampleRow>({ data: makeRows(25), columns: makeColumns(2) });
        const spoken = record(table);
        const query = table.provider('query')!;
        query.changePage({ pageIndex: 1, pageSize: 10 });
        await frames(2);
        query.changePage({ pageIndex: 2, pageSize: 10 });
        await frames(2);
        expect(spoken).toEqual(['Page 2 of 3', 'Page 3 of 3']);

        const sort = headCell(table, 'c0').querySelector('ge-data-table-column-header')!.shadowRoot!.querySelector<HTMLElement>('ge-button')!;
        sort.click();
        await frames(2);
        expect(announcement(table)).toBe('Table sorted by C0, ascending');
        // The text sits in a node of the polite live region.
        const live = (await axTree()).find((n) => n.name?.value?.includes('sorted by C0'));
        expect(JSON.stringify(live)).toContain('sorted by C0');
        expect((await axTree()).some((n) => n.role?.value === 'status' && axProps(n)['live'] === 'polite')).toBe(true);
    });
});
