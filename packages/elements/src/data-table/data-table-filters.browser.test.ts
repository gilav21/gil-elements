import axe from 'axe-core';
import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axTree, bodyRows, cellAt, headCell, makeColumns, makeRows, mountTable, q, qa, type SampleRow, settle } from './data-table-fixtures.js';
import { dateFilterFn, dateRangeFilterFn, multiselectFilterFn } from './data-table-filters.js';
import { emulateTouch, frames, mouseDrag, openPopover, parkMouse, press, scrollGrid, touchLongPressDrag, typeText, whenDefined, withRtl, withTheme } from './data-table-input-fixtures.js';
import type { GeDataTable } from './data-table.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import type { ColumnDef, DataTableDateRange, FilterCondition, FilterGroup } from './data-table.types.js';

afterEach(parkMouse);

interface Row {
    id: string;
    name: string;
    role: string;
    day: Date;
    [field: string]: unknown;
}

const now = new Date();
const dayOf = (d: number): Date => new Date(now.getFullYear(), now.getMonth(), d);
const ROWS: Row[] = [
    { id: '1', name: 'Alice', role: 'Engineer', day: dayOf(3) },
    { id: '2', name: 'Bob', role: 'Designer', day: dayOf(5) },
    { id: '3', name: 'Carol', role: 'Engineer', day: dayOf(5) },
    { id: '4', name: 'Dave', role: 'Manager', day: dayOf(9) },
];

type Table = GeDataTable<Row>;

const dateColumn: ColumnDef<Row> = {
    accessorKey: 'day',
    header: 'Day',
    width: '160px',
    enableFiltering: true,
    filterComponent: 'ge-data-table-date-filter',
    filterFn: (row, value) => dateFilterFn(row, value as Date | null, (r) => r.day),
    cell: (row) => String(row.day.getDate()),
};
const rangeColumn: ColumnDef<Row> = { ...dateColumn, filterComponent: 'ge-data-table-date-range-filter', filterFn: (row, value) => dateRangeFilterFn(row, value as DataTableDateRange | null, (r) => r.day) };
const roleColumn: ColumnDef<Row> = {
    accessorKey: 'role',
    header: 'Role',
    width: '160px',
    enableFiltering: true,
    filterComponent: 'ge-data-table-multiselect-filter',
    filterComponentInputs: { options: ['Engineer', 'Designer', 'Manager'] },
    filterFn: (row, value) => multiselectFilterFn(row, value as unknown[] | null, (r) => r.role),
};
const nameColumn: ColumnDef<Row> = { accessorKey: 'name', header: 'Name', width: '160px' };

const mount = (props: Record<string, unknown> = {}, attrs: Record<string, string> = {}): Promise<Table> =>
    mountTable<Row>({ columns: [nameColumn, dateColumn, roleColumn], data: ROWS, ...props }, attrs) as Promise<Table>;

const trigger = (table: Element, key: string): HTMLButtonElement => headCell(table, key).querySelector<HTMLButtonElement>('[data-slot="data-table-filter-trigger"]')!;
const names = (table: Element): string[] => bodyRows(table).map((r) => r.querySelector('[data-column="name"]')?.textContent?.trim() ?? '');
const record = (table: Element, name: string): CustomEvent[] => {
    const seen: CustomEvent[] = [];
    table.addEventListener(name, (e) => seen.push(e as CustomEvent));
    return seen;
};
const shadow = (el: Element | null | undefined, selector: string): HTMLElement => el!.shadowRoot!.querySelector<HTMLElement>(selector)!;
const panelButton = (panel: Element, text: string): HTMLElement => [...panel.shadowRoot!.querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent?.trim() === text)!;
const calendarDay = (panel: Element, d: number): HTMLElement => shadow(panel.shadowRoot!.querySelector('ge-calendar'), `ge-button.day[aria-label="${d}"]`);

async function openPanel(table: Table, key: string, tag: string): Promise<HTMLElement> {
    const content = await openPopover(trigger(table, key), tag);
    await settle(table);
    const panel = content!.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>(tag)!;
    await panel.updateComplete;
    await frames(1);
    return panel;
}

async function closePopover(table: Table): Promise<void> {
    await press('{Escape}');
    await settle(table);
}

describe('F1 the header filter trigger', () => {
    it('is drawn only for enableFiltering with a panel, after the sort control', async () => {
        const table = await mount({ columns: [nameColumn, { ...dateColumn, enableFiltering: false }, roleColumn, { ...nameColumn, accessorKey: 'id', header: 'Id', enableFiltering: true }] });
        expect(trigger(table, 'day')).toBeNull();
        expect(trigger(table, 'id')).toBeNull();
        const button = trigger(table, 'role');
        expect(button).not.toBeNull();
        const controls = headCell(table, 'role').querySelector('[data-slot="data-table-head-controls"]')!;
        expect(controls.firstElementChild!.localName).toBe('ge-data-table-column-header');
        expect(button.getAttribute('aria-label')).toBe('Filter Role');
        expect(button.hasAttribute('data-active')).toBe(false);
    });

    it('says "filter applied" and turns primary with a solid icon while the column is filtered', async () => {
        const table = await mount({ columnFilters: { role: ['Engineer'] } });
        const button = trigger(table, 'role');
        expect(button.getAttribute('aria-label')).toBe('Filter Role, filter applied');
        expect(button.hasAttribute('data-active')).toBe(true);
        expect(button.querySelector('svg')!.getAttribute('fill')).toBe('currentColor');
        const probe = document.createElement('span');
        probe.style.color = 'var(--primary)';
        table.append(probe);
        expect(getComputedStyle(button).color).toBe(getComputedStyle(probe).color);
        probe.remove();
        // inactive for an empty value
        table.columnFilters = { role: [] };
        await settle(table);
        expect(trigger(table, 'role').hasAttribute('data-active')).toBe(false);
    });

    it('is also drawn beside a custom headerRenderer (D1)', async () => {
        const table = await mount({ columns: [nameColumn, { ...roleColumn, headerRenderer: () => html`<span data-test="mine">Role!</span>` }] });
        const controls = headCell(table, 'role').querySelector('[data-slot="data-table-head-controls"]')!;
        expect(controls.hasAttribute('data-bare')).toBe(false);
        expect(controls.querySelector('[data-test="mine"]')).not.toBeNull();
        expect(trigger(table, 'role')).not.toBeNull();
    });

    it('opens with the keyboard (Enter, Space), and Escape closes it and returns the focus to the trigger', async () => {
        const table = await mount();
        const button = trigger(table, 'role');
        button.focus();
        await press('{Enter}');
        await frames(2);
        await whenDefined('ge-data-table-multiselect-filter');
        await settle(table);
        const popover = button.closest('ge-popover') as HTMLElement & { open: boolean };
        expect(popover.open).toBe(true);
        expect(popover.querySelector('ge-data-table-multiselect-filter')).not.toBeNull();
        await closePopover(table);
        expect(popover.open).toBe(false);
        expect(document.activeElement).toBe(trigger(table, 'role'));
        // the panel leaves the DOM with the popover: each open is a fresh panel
        expect(popover.querySelector('ge-data-table-multiselect-filter')).toBeNull();
        trigger(table, 'role').focus();
        await press(' ');
        await frames(2);
        await settle(table);
        expect(popover.open).toBe(true);
        await closePopover(table);
    });

    it('loads the panel on hover of its trigger, before it is opened (prefetch)', async () => {
        const table = await mount({ columns: [nameColumn, rangeColumn] });
        await userEvent.hover(trigger(table, 'day'));
        await whenDefined('ge-data-table-date-range-filter');
        expect(customElements.get('ge-data-table-date-range-filter')).toBeDefined();
    });

    it('grows the trigger to 44x44 on a coarse pointer only', async () => {
        const table = await mount();
        const fine = trigger(table, 'role').getBoundingClientRect();
        expect([fine.width, fine.height]).toEqual([32, 32]);
        await emulateTouch(true);
        await frames(2);
        const coarse = trigger(table, 'role').getBoundingClientRect();
        expect(Math.min(coarse.width, coarse.height)).toBeGreaterThanOrEqual(44);
    });
});

describe('F2 the date panel', () => {
    it('filters by the clicked day, once, and shows the current day when reopened (D2)', async () => {
        const table = await mount();
        const changes = record(table, 'column-filters-change');
        const globals = record(table, 'filter-change');
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        await userEvent.click(calendarDay(panel, 5));
        await settle(table);
        expect(changes).toHaveLength(1);
        expect((table.columnFilters['day'] as Date).getTime()).toBe(dayOf(5).getTime());
        expect(globals).toHaveLength(0);
        expect(names(table)).toEqual(['Bob', 'Carol']);
        expect(trigger(table, 'day').hasAttribute('data-active')).toBe(true);
        await closePopover(table);
        const again = await openPanel(table, 'day', 'ge-data-table-date-filter');
        expect(calendarDay(again, 5).hasAttribute('data-selected')).toBe(true);
        await closePopover(table);
    });

    it('Today picks local midnight, Clear removes the filter (null stays a key, D5)', async () => {
        const table = await mount();
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        await userEvent.click(panelButton(panel, 'Today'));
        await settle(table);
        const today = table.columnFilters['day'] as Date;
        expect([today.getHours(), today.getMinutes(), today.getDate()]).toEqual([0, 0, now.getDate()]);
        await userEvent.click(panelButton(panel, 'Clear'));
        await settle(table);
        expect(Object.hasOwn(table.columnFilters, 'day')).toBe(true);
        expect(table.columnFilters['day']).toBeNull();
        expect(names(table)).toHaveLength(4);
        await closePopover(table);
    });

    it('draws month and year selects, and follows an RTL locale', async () => {
        const table = await mount({ locale: 'he' });
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        const calendar = panel.shadowRoot!.querySelector('ge-calendar')!;
        expect(calendar.hasAttribute('show-month-select')).toBe(true);
        expect(calendar.hasAttribute('show-year-select')).toBe(true);
        expect(shadow(panel, '[data-slot="date-filter"]').getAttribute('dir')).toBe('rtl');
        await closePopover(table);
    });
});

describe('F3 the date-range panel', () => {
    it('reports only a complete range: the first click is silent, the second emits once; reopened it shows the range', async () => {
        const table = await mount({ columns: [nameColumn, rangeColumn] });
        const changes = record(table, 'column-filters-change');
        const panel = await openPanel(table, 'day', 'ge-data-table-date-range-filter');
        await userEvent.click(calendarDay(panel, 4));
        await settle(table);
        expect(changes).toHaveLength(0);
        await userEvent.click(calendarDay(panel, 9));
        await settle(table);
        expect(changes).toHaveLength(1);
        expect(names(table)).toEqual(['Bob', 'Carol', 'Dave']);
        await closePopover(table);
        const again = await openPanel(table, 'day', 'ge-data-table-date-range-filter');
        expect(calendarDay(again, 4).hasAttribute('data-range-start')).toBe(true);
        expect(calendarDay(again, 9).hasAttribute('data-range-end')).toBe(true);
        await closePopover(table);
    });

    it('applies a preset at once; custom presets replace the built-in ones', async () => {
        const range = { start: dayOf(1), end: dayOf(3) };
        const table = await mount({ columns: [nameColumn, { ...rangeColumn, filterComponentInputs: { presets: [{ label: 'Early', range }] } }] });
        const panel = await openPanel(table, 'day', 'ge-data-table-date-range-filter');
        expect(panelButton(panel, 'Last 7 days')).toBeUndefined();
        await userEvent.click(panelButton(panel, 'Early'));
        await settle(table);
        expect(table.columnFilters['day']).toBe(range);
        expect(names(table)).toEqual(['Alice']);
        await closePopover(table);
    });
});

describe('a press inside an open header panel never drags its column (round 5)', () => {
    /** A point at `fraction` of a header's width, mid-height: where a column drag drops (as the column tests aim). */
    const inHead = (table: Element, key: string, fraction: number): { x: number; y: number } => {
        const rect = headCell(table, key).getBoundingClientRect();
        return { x: rect.left + rect.width * fraction, y: rect.top + rect.height / 2 };
    };
    const mountWide = (): Promise<Table> =>
        mountTable<Row>({ columns: [nameColumn, roleColumn, dateColumn], data: ROWS, enableColumnReorder: true, showPagination: false }, {}, { width: 900, height: 500 }) as Promise<Table>;

    it('(control) a mouse drag from the header itself does reorder', async () => {
        const table = await mountWide();
        await mouseDrag(inHead(table, 'day', 0.3), inHead(table, 'name', 0.2));
        await settle(table);
        expect(table.columnOrder[0]).toBe('day');
    });

    /** A point on the panel's own padding (not on a control: the calendar and the command list are value controls the drag already skips). */
    const onPanelPadding = (table: Element): { x: number; y: number } => {
        const rect = q(table, '[data-slot="data-table-filter-panel"]').getBoundingClientRect();
        return { x: rect.left + 3, y: rect.top + 3 };
    };

    it('a mouse drag from a calendar day, or from the panel padding, does not reorder', async () => {
        const table = await mountWide();
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        await mouseDrag(calendarDay(panel, 10), inHead(table, 'name', 0.2));
        await settle(table);
        expect(table.columnOrder).toEqual([]);
        const again = await openPanel(table, 'day', 'ge-data-table-date-filter');
        void again;
        await mouseDrag(onPanelPadding(table), inHead(table, 'name', 0.2));
        await settle(table);
        expect(table.columnOrder).toEqual([]);
    });

    it('a touch long press and drag in the panel does not reorder', async () => {
        const table = await mountWide();
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        await emulateTouch(true);
        try {
            void panel;
            await touchLongPressDrag(onPanelPadding(table), inHead(table, 'name', 0.2));
            await settle(table);
            expect(table.columnOrder).toEqual([]);
        } finally {
            await emulateTouch(false);
        }
    });
});

describe('round 8', () => {
    const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replaceAll('​', '').trim();

    it('an outside reset within the debounce also clears the text shown in the floating input', async () => {
        // Round 15: the reset must CHANGE the column's value (an equal write is an echo and keeps the text): the column starts filtered.
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, filterDebounce: 400, columnFilters: { name: 'a' } });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input') as HTMLInputElement;
        await typeText(input, 'bc');
        table.requestUpdate(); // a render while the write waits keeps the typed text
        await settle(table);
        expect(input.value).toBe('abc');
        table.columnFilters = {};
        await settle(table);
        await frames(1);
        expect(input.value).toBe('');
        await new Promise((resolve) => setTimeout(resolve, 450));
        expect(table.columnFilters).toEqual({}); // the dropped write never lands
    });

    it("a consumer's echo (a new, equal object a tick later) keeps the announcement and another column's waiting text (round 15)", async () => {
        const idColumn: ColumnDef<Row> = { accessorKey: 'id', header: 'Id', width: '80px', enableFiltering: true };
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, idColumn], enableFloatingFilters: true, filterDebounce: 200 });
        // Vue-style two-way binding: every emitted value is written back as a fresh copy, a tick later.
        table.addEventListener('column-filters-change', (e) => setTimeout(() => (table.columnFilters = structuredClone((e as CustomEvent).detail)), 0));
        const [nameInput, idInput] = [...table.querySelectorAll('[data-kind="filter"] ge-input')].map((el) => shadow(el, 'input') as HTMLInputElement);
        await typeText(nameInput!, 'Al');
        await new Promise((resolve) => setTimeout(resolve, 250)); // the name write lands, its echo follows
        await typeText(idInput!, '1'); // waits on the debounce while the echo arrives
        await new Promise((resolve) => setTimeout(resolve, 20));
        await settle(table);
        expect(idInput!.value).toBe('1');
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(table.columnFilters).toEqual({ name: 'Al', id: '1' });
        await new Promise((resolve) => setTimeout(resolve, 600));
        await settle(table);
        expect(announcer(table)).toBe('1 row matches the filters');
    });

    it('with the consumer driving loading, a data push during the request does not end the wait; loading false does', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        table.addEventListener('query', () => {
            table.loading = true;
            setTimeout(() => Object.assign(table, { data: [...table.data], total: 999 }), 300); // an unrelated live push
            setTimeout(() => Object.assign(table, { data: [...table.data], total: 3, loading: false }), 1100); // the answer
        });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 800));
        await settle(table);
        expect(announcer(table)).toBe('');
        expect(table.provider('query')?.filteredCount()).toBeUndefined();
        await new Promise((resolve) => setTimeout(resolve, 500));
        await settle(table);
        expect(announcer(table)).toBe('3 rows match the filters');
    });

    it('a column filter change within 500 ms of global typing drops the global announcement: only the column count is spoken (round 10)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn] });
        const spoken: string[] = [];
        new MutationObserver(() => spoken.push(announcer(table))).observe(q(table, '[data-slot="data-table-announcer"]'), { childList: true, characterData: true, subtree: true });
        table.provider('query')?.changeGlobalFilter('a');
        await new Promise((resolve) => setTimeout(resolve, 100));
        table.provider('query')?.changeColumnFilter('role', ['Engineer']);
        await new Promise((resolve) => setTimeout(resolve, 800));
        await settle(table);
        expect(spoken.filter((s) => s !== '')).toEqual([announcer(table)]);
        expect(announcer(table)).toMatch(/rows? match(es)? the filters/);
    });

    it('the other order: a global change within 500 ms of a column change is the one spoken, the column announcement says nothing (round 11)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn] });
        const spoken: string[] = [];
        new MutationObserver(() => spoken.push(announcer(table))).observe(q(table, '[data-slot="data-table-announcer"]'), { childList: true, characterData: true, subtree: true });
        table.provider('query')?.changeColumnFilter('role', ['Engineer']);
        await new Promise((resolve) => setTimeout(resolve, 100));
        table.provider('query')?.changeGlobalFilter('a');
        await new Promise((resolve) => setTimeout(resolve, 800));
        await settle(table);
        const said = spoken.filter((s) => s !== '');
        expect(said).toHaveLength(1);
        expect(said[0]).toMatch(/for "a"/); // the global announcement's text
    });

    it('a restored view state is ONE filter change: an older global announcement says nothing, the restore speaks once (round 15)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn] });
        const spoken: string[] = [];
        new MutationObserver(() => spoken.push(announcer(table))).observe(q(table, '[data-slot="data-table-announcer"]'), { childList: true, characterData: true, subtree: true });
        const seq = table.provider('query')!.filterSeq();
        table.provider('query')?.changeGlobalFilter('o');
        await new Promise((resolve) => setTimeout(resolve, 100));
        const state = table.getViewState()!; // the global text stays 'o' in the restore (round 16: a changed one is announced by the global rule)
        expect(table.applyViewState({ ...state, columnFilters: { name: 'Bob' } })).toBe(true);
        expect(table.provider('query')!.filterSeq()).toBe(seq + 2); // the global change, then the restore: one number
        await new Promise((resolve) => setTimeout(resolve, 800));
        await settle(table);
        const said = spoken.filter((s) => s !== '');
        expect(said).toEqual(['1 row matches the filters']); // not the global filter's 'for "o"'
        // A restore that changes no filter numbers nothing.
        const now = table.provider('query')!.filterSeq();
        table.applyViewState({ ...table.getViewState()!, columnFilters: { name: 'Bob' } });
        expect(table.provider('query')!.filterSeq()).toBe(now);
    });

    it('a global filter typed, then replaced from outside within the debounce, keeps the outside value (round 18)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn], filterDebounce: 300 });
        const state = table.getViewState()!;
        table.provider('query')?.changeGlobalFilter('Al'); // waits on the debounce
        table.applyViewState({ ...structuredClone(state), globalFilter: 'Bob' });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await settle(table);
        expect(table.globalFilter).toBe('Bob');
        table.provider('query')?.changeGlobalFilter('Ca');
        table.globalFilter = 'Dave'; // a property write that is not an echo
        await new Promise((resolve) => setTimeout(resolve, 400));
        await settle(table);
        expect(table.globalFilter).toBe('Dave');
    });

    it('one restore, one announcement: global and column changed -> the global result; global emptied, column kept -> the count (round 17)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn] });
        const spoken: string[] = [];
        new MutationObserver(() => spoken.push(announcer(table))).observe(q(table, '[data-slot="data-table-announcer"]'), { childList: true, characterData: true, subtree: true });
        const state = table.getViewState()!;
        table.applyViewState({ ...structuredClone(state), globalFilter: 'Bob', columnFilters: { name: 'o' } });
        await new Promise((resolve) => setTimeout(resolve, 700));
        await settle(table);
        expect(spoken.filter((s) => s !== '')).toEqual(['1 result found for "Bob"']);
        spoken.length = 0;
        table.applyViewState({ ...table.getViewState()!, globalFilter: '' }); // the column filter 'o' stays
        await new Promise((resolve) => setTimeout(resolve, 700));
        await settle(table);
        expect(spoken.filter((s) => s !== '')).toEqual(['2 rows match the filters']);
    });

    it('a restore that changes only the sort announces nothing; one that changes the global text announces its result (round 16)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn], columnFilters: { name: 'o' } });
        const spoken: string[] = [];
        new MutationObserver(() => spoken.push(announcer(table))).observe(q(table, '[data-slot="data-table-announcer"]'), { childList: true, characterData: true, subtree: true });
        const state = table.getViewState()!;
        table.applyViewState({ ...structuredClone(state), sort: { column: 'name', direction: 'desc' } });
        await new Promise((resolve) => setTimeout(resolve, 700));
        await settle(table);
        expect(spoken.filter((s) => s !== '')).toEqual([]);
        table.applyViewState({ ...structuredClone(state), globalFilter: 'Bob' });
        await new Promise((resolve) => setTimeout(resolve, 700));
        await settle(table);
        expect(spoken.filter((s) => s !== '')).toEqual(['1 result found for "Bob"']);
    });

    it('a cache answering in the same task (loading true, data, loading false) ends the wait at once (round 9)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        table.addEventListener('query', () => {
            table.loading = true;
            table.data = [...table.data]; // the same total: only the loading cycle says this is the answer
            table.loading = false;
        });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 800)); // well before the 2 s fallback
        await settle(table);
        expect(announcer(table)).toBe('500 rows match the filters');
    });

    it('a filter change right after the answer drops the announcement it had already scheduled (round 9)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        let answered = false;
        table.addEventListener('query', () => {
            if (answered) return;
            answered = true;
            setTimeout(() => {
                Object.assign(table, { data: [...table.data], total: 3 }); // the answer: the announcement is scheduled a tick later
                table.provider('query')?.changeColumnFilter('name', 'zz'); // same task: a newer filter
            }, 700);
        });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 850));
        await settle(table);
        expect(announcer(table)).toBe('');
    });

    it('an unchanged advanced filter keeps a waiting announcement (no-op before the drop)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, enableAdvancedFilter: true, localFiltering: false, total: 500 });
        table.addEventListener('query', () => setTimeout(() => Object.assign(table, { data: [...table.data], total: 2 }), 800));
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 600)); // the announcement waits for the answer
        table.provider('query')?.changeAdvancedFilter(null); // already null: no change
        await new Promise((resolve) => setTimeout(resolve, 400));
        await settle(table);
        expect(announcer(table)).toBe('2 rows match the filters');
    });
});

describe('round 7: pending floating writes', () => {
    it('a reset of the filters from outside within the debounce drops the waiting write', async () => {
        // Round 15: the column starts filtered, so the reset changes its value (an equal write would be an echo).
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, filterDebounce: 250, columnFilters: { name: 'A' } });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'l');
        table.columnFilters = {};
        await new Promise((resolve) => setTimeout(resolve, 350));
        await settle(table);
        expect(table.columnFilters).toEqual({});
        expect(names(table)).toHaveLength(4);
    });

    it('typing then deleting within the debounce is no change: no event, no page reset', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, filterDebounce: 200, paginationState: { pageIndex: 1, pageSize: 2 } }, { 'show-pagination': 'true' });
        const changes = record(table, 'column-filters-change');
        const pages = record(table, 'page-change');
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'x');
        await press('{Backspace}');
        await new Promise((resolve) => setTimeout(resolve, 300));
        await settle(table);
        expect(changes).toHaveLength(0);
        expect(pages).toHaveLength(0);
        expect(table.paginationState.pageIndex).toBe(1);
    });
});

describe('round 7: the floating row under a column window', () => {
    it('keys its cells by column: a window shift keeps the text typed in column 12 in column 12', async () => {
        const columns = makeColumns(30).map((c) => ({ ...c, enableFiltering: true }));
        const table = await mountTable<SampleRow>(
            { columns, data: makeRows(50, { columns: 30 }), enableVirtualScroll: true, virtualRowHeight: 36, enableFloatingFilters: true, filterDebounce: 60000, showPagination: false, showToolbar: false },
            {},
            { width: 600, height: 400 },
        );
        const inputOf = (key: string): HTMLInputElement | null => {
            const index = columns.findIndex((c) => c.accessorKey === key);
            const head = qa(table, '[data-kind="filter"] > [data-slot="table-head"]').find((h) => h.getAttribute('aria-colindex') === String(index + 1));
            return head?.querySelector('ge-input')?.shadowRoot?.querySelector('input') ?? null;
        };
        await scrollGrid(table, { left: 150 * 10 });
        await settle(table);
        const input = inputOf('c12')!;
        await typeText(input, 'ab');
        await scrollGrid(table, { left: 150 * 10 + 400 });
        await settle(table);
        expect(inputOf('c12')).toBe(input);
        expect(inputOf('c12')!.value).toBe('ab');
        expect(table.columnFilters).toEqual({});
    });
});

describe('round 6: floating row index, handlers across a reattach', () => {
    it('the floating row is the second header row (aria-rowindex 2), the first data row the third', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true });
        expect(q(table, '[data-kind="filter"]').getAttribute('aria-rowindex')).toBe('2');
        expect(bodyRows(table)[0]!.getAttribute('aria-rowindex')).toBe('3');
    });

    it('the floating cells are opaque, so a pinned one covers the content scrolled under it (round 18)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true, pin: 'left' }, roleColumn], enableFloatingFilters: true });
        const cell = q(table, '[data-kind="filter"] > [data-slot="table-head"][data-pinned]');
        // Read the computed color back through a canvas: the alpha of what the cell paints, whatever color syntax the browser reports.
        const ctx = document.createElement('canvas').getContext('2d')!;
        ctx.fillStyle = getComputedStyle(cell).backgroundColor;
        ctx.fillRect(0, 0, 1, 1);
        expect(ctx.getImageData(0, 0, 1, 1).data[3]).toBe(255);
    });

    it("each floating cell's aria-colindex is its column's, as the header row and the body cells have it (round 13)", async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn, { accessorKey: 'id', header: 'Id', width: '80px', enableFiltering: true }], enableFloatingFilters: true, enableRowSelection: true });
        const headIndex = (key: string): string | null =>
            q(table, `[data-slot="table-header"] > [data-slot="table-row"]:not([data-kind]) > [data-column-id="${key}"]`).getAttribute('aria-colindex');
        const floating = qa(table, '[data-kind="filter"] > [data-slot="table-head"][role="columnheader"]');
        expect(floating.map((h) => h.getAttribute('aria-colindex'))).toEqual([headIndex('name'), headIndex('id')]);
        expect(headIndex('id')).not.toBeNull();
        expect(floating[0]!.getAttribute('aria-colindex')).toBe(bodyRows(table)[0]!.querySelector('[data-column="name"]')!.getAttribute('aria-colindex'));
    });

    it('new column objects with the same outputs object keep one composed listener: the consumer handler runs once per change (round 9)', async () => {
        const consumer = vi.fn();
        const outputs = { 'filter-change': consumer };
        const column: ColumnDef<Row> = { ...nameColumn, enableFiltering: true, filterComponent: 'x-text-filter', filterComponentOutputs: outputs };
        const table = await mount({ columns: [column, roleColumn] });
        const content = await openPopover(trigger(table, 'name'));
        await settle(table);
        table.columns = table.columns.map((c) => ({ ...c })); // new column objects, the same outputs object
        await settle(table);
        await typeText(content!.querySelector('x-text-filter')!.querySelector('input')!, 'E');
        await settle(table);
        expect(consumer).toHaveBeenCalledTimes(1);
        expect(table.columnFilters['name']).toBe('E');
        await closePopover(table);
    });

    it('after a detach and reattach the panel still filters, and the consumer handler runs once per change', async () => {
        const consumer = vi.fn();
        const column: ColumnDef<Row> = { ...nameColumn, enableFiltering: true, filterComponent: 'x-text-filter', filterComponentOutputs: { 'filter-change': consumer } };
        const table = await mount({ columns: [column, roleColumn] });
        const parent = table.parentElement!;
        table.remove();
        parent.append(table);
        await settle(table);
        const content = await openPopover(trigger(table, 'name'));
        await settle(table);
        await typeText(content!.querySelector('x-text-filter')!.querySelector('input')!, 'D');
        await settle(table);
        expect(table.columnFilters['name']).toBe('D');
        expect(consumer).toHaveBeenCalledTimes(1);
        await closePopover(table);
    });
});

describe('an equal column filter write is a no-op (round 6)', () => {
    it('Clear on an empty panel and the same day picked again fire nothing and keep the page', async () => {
        const table = await mount({ paginationState: { pageIndex: 0, pageSize: 2 } }, { 'show-pagination': 'true' });
        const changes = record(table, 'column-filters-change');
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        await userEvent.click(panelButton(panel, 'Clear'));
        await settle(table);
        expect(changes).toHaveLength(0);
        await userEvent.click(calendarDay(panel, 5));
        await settle(table);
        expect(changes).toHaveLength(1);
        const stored = table.columnFilters;
        table.paginationState = { pageIndex: 1, pageSize: 1 };
        await settle(table);
        await userEvent.click(calendarDay(panel, 5));
        await settle(table);
        expect(changes).toHaveLength(1);
        expect(table.columnFilters).toBe(stored);
        expect(table.paginationState.pageIndex).toBe(1);
        await closePopover(table);
    });

    it('any array or object written is a change (round 10): two Sets, the same mutated array re-emitted, [""] then [null]', async () => {
        const table = await mount();
        const changes = record(table, 'column-filters-change');
        const write = (value: unknown): void => table.provider('query')?.changeColumnFilter('role', value);
        write(new Set(['Engineer']));
        write(new Set(['Designer']));
        const same = ['Engineer'];
        write(same);
        same.push('Manager');
        write(same);
        write(['']);
        write([null]);
        await settle(table);
        expect(changes).toHaveLength(6);
    });

    it('the floating input ending a debounce on the text already stored fires nothing', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, filterDebounce: 200 });
        const changes = record(table, 'column-filters-change');
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'a');
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(changes).toHaveLength(1);
        await typeText(input, 'b');
        await press('{Backspace}');
        await new Promise((resolve) => setTimeout(resolve, 300));
        await settle(table);
        expect(changes).toHaveLength(1);
    });
});

describe('date panels given a filter restored from JSON (ISO strings)', () => {
    const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    it('the date panel shows the day of an ISO string value, and the rows are filtered by it', async () => {
        const table = await mount({ columnFilters: { day: iso(dayOf(5)) } });
        expect(names(table)).toEqual(['Bob', 'Carol']);
        const panel = await openPanel(table, 'day', 'ge-data-table-date-filter');
        expect(calendarDay(panel, 5).hasAttribute('data-selected')).toBe(true);
        await closePopover(table);
    });

    it('the range panel shows both ends of a range of ISO strings', async () => {
        const table = await mount({ columns: [nameColumn, rangeColumn], columnFilters: { day: JSON.parse(JSON.stringify({ start: iso(dayOf(4)), end: iso(dayOf(9)) })) } });
        expect(names(table)).toEqual(['Bob', 'Carol', 'Dave']);
        const panel = await openPanel(table, 'day', 'ge-data-table-date-range-filter');
        expect(calendarDay(panel, 4).hasAttribute('data-range-start')).toBe(true);
        expect(calendarDay(panel, 9).hasAttribute('data-range-end')).toBe(true);
        await closePopover(table);
    });
});

describe('F4 the multiselect panel', () => {
    const optionRow = (panel: Element, label: string): HTMLElement => panel.shadowRoot!.querySelector<HTMLElement>(`ge-command-item[value="${label}"]`)!;

    it('a remove and re-add of the table writes the waiting floating text and draws the open popovers closed (round 19)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, roleColumn], enableFloatingFilters: true, filterDebounce: 1000, enableAdvancedFilter: true });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'Al');
        await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        const parent = table.parentElement!;
        table.remove();
        expect(table.columnFilters).toEqual({ name: 'Al' }); // flushed at the detach, not dropped
        parent.append(table);
        await settle(table);
        await frames(2);
        const panel = trigger(table, 'role').closest('ge-popover') as HTMLElement & { open: boolean };
        expect(panel.open).toBe(false);
        expect(q(table, '[data-slot="data-table-filter-panel"]').querySelector('ge-data-table-multiselect-filter')).toBeNull();
        expect(names(table)).toEqual(['Alice']);
    });

    it('an open panel whose column is hidden is closed with its scroll watch; showing the column again draws it closed (round 17)', async () => {
        const table = await mount();
        await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        await frames(2); // the scroll watch is armed after the opening task
        const service = table.provider('filters') as unknown as { panelOpen(key: string): boolean };
        expect(service.panelOpen('role')).toBe(true);
        const removed = vi.spyOn(globalThis, 'removeEventListener');
        try {
            table.columnVisibility = { role: false };
            await settle(table);
            expect(service.panelOpen('role')).toBe(false);
            expect(removed.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
        } finally {
            removed.mockRestore();
        }
        table.columnVisibility = {};
        await settle(table);
        expect(service.panelOpen('role')).toBe(false);
        expect(trigger(table, 'role')).not.toBeNull();
    });

    it("stays open when a pick shrinks the rows of a scrolled table (its own scroll); a page scroll closes it (round 14)", async () => {
        const data: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: `N${i}`, role: i === 0 ? 'Manager' : 'Engineer', day: dayOf(1) }));
        const table = (await mountTable<Row>({ columns: [nameColumn, roleColumn], data, showPagination: false }, {}, { width: 600, height: 300 })) as Table;
        const viewport = q(table, '[data-slot="data-table-viewport"]');
        await scrollGrid(table, { top: 5000 });
        expect(viewport.scrollTop).toBeGreaterThan(0);
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        const popover = trigger(table, 'role').closest('ge-popover') as HTMLElement & { open: boolean };
        await frames(2); // the watch is armed after the opening task
        await userEvent.click(optionRow(panel, 'Manager'));
        await settle(table);
        await frames(2);
        expect(names(table)).toEqual(['N0']);
        expect(viewport.scrollTop).toBe(0); // the table's own scroll, clamped by the shorter body
        expect(popover.open).toBe(true);
        document.dispatchEvent(new Event('scroll'));
        await settle(table);
        expect(popover.open).toBe(false);
    });

    it('toggles options in click order, keeps them when reopened, and clears to null', async () => {
        const table = await mount();
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        await userEvent.click(optionRow(panel, 'Manager'));
        await settle(table);
        await userEvent.click(optionRow(panel, 'Designer'));
        await settle(table);
        expect(table.columnFilters['role']).toEqual(['Manager', 'Designer']);
        expect(names(table)).toEqual(['Bob', 'Dave']);
        expect(optionRow(panel, 'Manager').getAttribute('aria-selected')).toBe('true');
        await closePopover(table);
        const again = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        expect(optionRow(again, 'Designer').getAttribute('aria-selected')).toBe('true');
        await userEvent.click(optionRow(again, 'Engineer'));
        await settle(table);
        // the panel was given the current filter, so the new pick ADDS to it (Angular replaced it: B5)
        expect(table.columnFilters['role']).toEqual(['Manager', 'Designer', 'Engineer']);
        await userEvent.click(panelButton(again, 'Clear'));
        await settle(table);
        expect(table.columnFilters['role']).toBeNull();
        await closePopover(table);
    });

    it('draws every option when two share a value (unique repeat keys), and keeps drawing them after a re-render', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            const table = await mount({ columns: [nameColumn, { ...roleColumn, filterComponentInputs: { options: ['Engineer', 'Engineer', 'Designer'] } }] });
            const panel = (await openPanel(table, 'role', 'ge-data-table-multiselect-filter')) as HTMLElement & { requestUpdate(): void; updateComplete: Promise<boolean> };
            expect(panel.shadowRoot!.querySelectorAll('ge-command-item')).toHaveLength(3);
            panel.requestUpdate();
            await panel.updateComplete;
            expect(panel.shadowRoot!.querySelectorAll('ge-command-item')).toHaveLength(3);
            expect(errors).not.toHaveBeenCalled();
            await closePopover(table);
        } finally {
            errors.mockRestore();
        }
    });

    it('recognises a built-in panel tag in any case (its locale is passed, its lazy load runs)', async () => {
        const table = await mount({ locale: 'he', columns: [nameColumn, { ...roleColumn, filterComponent: 'GE-Data-Table-Multiselect-Filter' }] });
        const panel = (await openPanel(table, 'role', 'ge-data-table-multiselect-filter')) as HTMLElement & { locale?: unknown };
        expect(panel.localName).toBe('ge-data-table-multiselect-filter');
        expect(panel.locale).toBe((table as unknown as { resolvedLocale: unknown }).resolvedLocale);
        await closePopover(table);
    });

    it('a column with a built-in structured panel gets no default floating text input; a text column does (round 12)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, dateColumn, roleColumn], enableFloatingFilters: true });
        const cells = qa(table, '[data-kind="filter"] > [data-slot="table-head"]');
        expect(cells[0]!.querySelector('ge-input')).not.toBeNull();
        expect(cells[1]!.querySelector('ge-input')).toBeNull();
        expect(cells[1]!.getAttribute('role')).toBe('presentation');
        expect(cells[2]!.querySelector('ge-input')).toBeNull();
    });

    it('Alt+Shift+Arrow typed in the panel search input is the input own: no column move (round 12)', async () => {
        const table = await mount({ enableColumnReorder: true });
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        const input = shadow(panel.shadowRoot!.querySelector('ge-command-input'), 'input') as HTMLInputElement;
        await typeText(input, 'Eng');
        await press('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
        await settle(table);
        expect(table.columnOrder).toEqual([]);
        expect(input.value).toBe('Eng');
        await closePopover(table);
    });

    it("an option's select-item stays inside the panel (round 11)", async () => {
        const table = await mount();
        const heard = vi.fn();
        table.addEventListener('select-item', heard);
        document.addEventListener('select-item', heard);
        try {
            const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
            await userEvent.click(optionRow(panel, 'Manager'));
            await settle(table);
            expect(table.columnFilters['role']).toEqual(['Manager']);
            expect(heard).not.toHaveBeenCalled();
            await closePopover(table);
        } finally {
            document.removeEventListener('select-item', heard);
        }
    });

    it('takes its heading from `heading` (round 8); `title` stays the global tooltip attribute and draws no heading', async () => {
        const table = await mount({ columns: [nameColumn, { ...roleColumn, filterComponentInputs: { ...(roleColumn.filterComponentInputs as object), heading: 'Pick roles' } }] });
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        expect(panel.shadowRoot!.querySelector('.title')?.textContent).toContain('Pick roles');
        expect(panel.shadowRoot!.querySelector('ge-command-list')?.getAttribute('aria-label')).toBe('Pick roles');
        await closePopover(table);
        const plain = document.createElement('ge-data-table-multiselect-filter') as HTMLElement & { updateComplete: Promise<boolean> };
        plain.setAttribute('title', 'Tooltip only');
        document.body.append(plain);
        try {
            await plain.updateComplete;
            expect(plain.shadowRoot!.querySelector('.title')).toBeNull();
        } finally {
            plain.remove();
        }
    });

    it('gets the RESOLVED table dictionary, so a custom locale object labels it (round 4)', async () => {
        const table = await mount({ locale: { ...DATA_TABLE_LOCALES.en, code: 'xx', selectAllRows: 'Pick every one', clearAll: 'Wipe' } });
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        expect(panelButton(panel, 'Pick every one')).toBeDefined();
        expect(panelButton(panel, 'Wipe')).toBeDefined();
        await closePopover(table);
    });

    it('searches by typing, and Select all selects every option whatever the search', async () => {
        const table = await mount();
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        const input = shadow(panel.shadowRoot!.querySelector('ge-command-input'), 'input');
        await typeText(input, 'Eng');
        await frames(2);
        expect(optionRow(panel, 'Designer').hidden || getComputedStyle(optionRow(panel, 'Designer')).display === 'none').toBe(true);
        await userEvent.click(panelButton(panel, 'Select all'));
        await settle(table);
        expect(table.columnFilters['role']).toEqual(['Engineer', 'Designer', 'Manager']);
        await closePopover(table);
    });

    it('keeps 200 options in a scrolling list', async () => {
        const options = Array.from({ length: 200 }, (_, i) => `Option ${i}`);
        const table = await mount({ columns: [nameColumn, { ...roleColumn, filterComponentInputs: { options } }] });
        const panel = await openPanel(table, 'role', 'ge-data-table-multiselect-filter');
        const list = panel.shadowRoot!.querySelector<HTMLElement>('ge-command-list')!;
        expect(panel.shadowRoot!.querySelectorAll('ge-command-item')).toHaveLength(200);
        expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(256 + 1);
        await closePopover(table);
    });
});

class TextFilter extends HTMLElement {
    value: unknown = null;
    column: unknown = null;
    extra: unknown = null;
    connectedCallback(): void {
        if (this.querySelector('input')) return;
        const input = document.createElement('input');
        input.setAttribute('aria-label', 'Text filter');
        input.value = typeof this.value === 'string' ? this.value : '';
        input.addEventListener('input', () => this.dispatchEvent(new CustomEvent('filter-change', { detail: input.value || null, bubbles: true, composed: true })));
        this.append(input);
    }
}
if (!customElements.get('x-text-filter')) customElements.define('x-text-filter', TextFilter);

describe('F5 a custom filter component', () => {
    it("runs the consumer's own filter-change output too (first), then the table's (round 4)", async () => {
        const order: string[] = [];
        const column: ColumnDef<Row> = {
            ...nameColumn,
            enableFiltering: true,
            filterComponent: 'x-text-filter',
            filterComponentOutputs: { 'filter-change': (event) => order.push(`consumer:${String((event as CustomEvent).detail)}`) },
        };
        const table = await mount({ columns: [column, roleColumn] });
        table.addEventListener('column-filters-change', () => order.push('table'));
        const content = await openPopover(trigger(table, 'name'));
        await settle(table);
        await typeText(content!.querySelector('x-text-filter')!.querySelector('input')!, 'B');
        await settle(table);
        expect(order).toEqual(['consumer:B', 'table']);
        expect(table.columnFilters['name']).toBe('B');
        await closePopover(table);
    });

    it('the floating component and renderer get null for no filter, like the header panel (round 10)', async () => {
        const seen: unknown[] = [];
        const columns: ColumnDef<Row>[] = [
            { ...nameColumn, enableFiltering: true, floatingFilterComponent: 'x-text-filter' },
            { ...roleColumn, floatingFilterRenderer: (ctx) => (seen.push(ctx.value), '') },
        ];
        const table = await mount({ columns, enableFloatingFilters: true });
        const floating = table.querySelector('[data-kind="filter"] x-text-filter') as TextFilter;
        expect(floating.value).toBeNull();
        expect(seen.at(-1)).toBeNull();
    });

    it('the floating component gets only its own contract: no header panel inputs or outputs (round 4)', async () => {
        const panelOutput = vi.fn();
        const column: ColumnDef<Row> = {
            ...nameColumn,
            enableFiltering: true,
            filterComponent: 'x-text-filter',
            filterComponentInputs: { extra: 'panel-only' },
            filterComponentOutputs: { 'filter-change': panelOutput },
            floatingFilterComponent: 'x-text-filter',
        };
        const table = await mount({ columns: [column, roleColumn], enableFloatingFilters: true });
        const floating = table.querySelector('[data-kind="filter"] x-text-filter') as TextFilter;
        expect(floating.extra).toBeNull();
        expect(floating.column).toMatchObject({ accessorKey: 'name' });
        await typeText(floating.querySelector('input')!, 'C');
        await settle(table);
        expect(table.columnFilters['name']).toBe('C');
        expect(panelOutput).not.toHaveBeenCalled();
    });

    it('gets value, column and its inputs (a factory re-read each render); its filter-change filters and never reaches the table own filter-change (D4)', async () => {
        let calls = 0;
        const column: ColumnDef<Row> = { ...nameColumn, enableFiltering: true, filterComponent: 'x-text-filter', filterComponentInputs: () => ({ extra: ++calls }) };
        const table = await mount({ columns: [column, roleColumn], columnFilters: { name: 'Al' } });
        const globals = record(table, 'filter-change');
        const outside = vi.fn();
        document.body.addEventListener('filter-change', outside);
        try {
            const content = await openPopover(trigger(table, 'name'));
            await settle(table);
            const filter = content!.querySelector('x-text-filter') as TextFilter;
            expect(filter.value).toBe('Al');
            expect(filter.column).toMatchObject({ accessorKey: 'name', header: 'Name', filterComponent: 'x-text-filter' });
            const before = calls;
            table.requestUpdate();
            await settle(table);
            expect(calls).toBeGreaterThan(before);
            expect(filter.extra).toBe(calls);
            await typeText(filter.querySelector('input')!, 'i');
            await settle(table);
            expect(table.columnFilters['name']).toBe('Ali');
            expect(names(table)).toEqual(['Alice']);
            expect(globals).toHaveLength(0);
            expect(outside).not.toHaveBeenCalled();
            await closePopover(table);
        } finally {
            document.body.removeEventListener('filter-change', outside);
        }
    });

    it('keeps a consumer filterComponentOutputs listener, the table one runs too', async () => {
        const mine = vi.fn();
        const column: ColumnDef<Row> = { ...nameColumn, enableFiltering: true, filterComponent: 'x-text-filter', filterComponentOutputs: { focusin: mine } };
        const table = await mount({ columns: [column] });
        const content = await openPopover(trigger(table, 'name'));
        await settle(table);
        await typeText(content!.querySelector('x-text-filter input') as HTMLElement, 'Bo');
        await settle(table);
        expect(mine).toHaveBeenCalled();
        expect(names(table)).toEqual(['Bob']);
        await closePopover(table);
    });
});

describe('F6 the floating filter row', () => {
    const floatingColumns: ColumnDef<Row>[] = [
        { ...nameColumn, enableFiltering: true },
        { accessorKey: 'role', header: 'Role', width: '160px', enableFiltering: true, floatingFilter: false },
        { accessorKey: 'id', header: 'Id', width: '100px' },
    ];
    const filterRow = (table: Element): HTMLElement | null => table.querySelector('[data-slot="table-row"][data-kind="filter"]');

    it('is drawn only with enable-floating-filters and a filterable column', async () => {
        expect(filterRow(await mount({ columns: floatingColumns }))).toBeNull();
        expect(filterRow(await mount({ columns: [nameColumn], enableFloatingFilters: true }))).toBeNull();
        const table = await mount({ columns: floatingColumns, enableFloatingFilters: true });
        const row = filterRow(table)!;
        expect(row.parentElement!.getAttribute('data-slot')).toBe('table-header');
        expect(row.getAttribute('aria-rowindex')).toBe('2');
        const cells = qa(row, ':scope > [data-slot="table-head"]');
        expect(cells.map((c) => c.getAttribute('role'))).toEqual(['columnheader', 'presentation', 'presentation', 'presentation']);
        expect(cells[0]!.querySelector('ge-input')!.getAttribute('aria-label')).toBe('Filter Name');
        expect(cells[0]!.querySelector('ge-input')!.getAttribute('placeholder')).toBe('Name');
        expect(cells[1]!.childElementCount).toBe(0);
        expect(bodyRows(table)[0]!.getAttribute('aria-rowindex')).toBe('3');
        expect(table.querySelector('[data-slot="table"]')!.getAttribute('aria-rowcount')).toBe(String(ROWS.length + 2));
    });

    it('filters as the user types, after filter-debounce (D6)', async () => {
        const table = await mount({ columns: floatingColumns, enableFloatingFilters: true, filterDebounce: 150 });
        const input = shadow(filterRow(table)!.querySelector('ge-input'), 'input');
        await typeText(input, 'ca');
        expect(names(table)).toHaveLength(4);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await settle(table);
        expect(table.columnFilters).toEqual({ name: 'ca' });
        expect(names(table)).toEqual(['Carol']);
        expect(input.value).toBe('ca');
    });

    it('exposes both header rows and the first data row as row 3 in the accessibility tree', async () => {
        const table = await mount({ columns: floatingColumns, enableFloatingFilters: true });
        void table;
        const nodes = await axTree();
        // two header rows, then the four data rows
        expect(nodes.filter((n) => n.role?.value === 'row')).toHaveLength(2 + ROWS.length);
        // the header row's three headers plus the floating row's one header (its other cells are presentation)
        expect(nodes.filter((n) => n.role?.value === 'columnheader')).toHaveLength(4);
        expect(nodes.some((n) => n.role?.value === 'textbox' && n.name?.value === 'Filter Name')).toBe(true);
    });

    it('draws a floatingFilterRenderer with value and setValue, and a floatingFilterComponent with the filter contract', async () => {
        const table = await mount({
            columns: [
                { ...nameColumn, enableFiltering: true, floatingFilterRenderer: ({ value, setValue }) => html`<button data-test="pick" @click=${() => setValue('Bob')}>${String(value ?? 'none')}</button>` },
                { ...roleColumn, floatingFilterComponent: 'x-text-filter' },
            ],
            enableFloatingFilters: true,
        });
        const row = filterRow(table)!;
        expect(row.querySelector('[data-test="pick"]')!.textContent).toBe('none');
        await userEvent.click(row.querySelector('[data-test="pick"]')!);
        await settle(table);
        expect(names(table)).toEqual(['Bob']);
        expect(row.querySelector('[data-test="pick"]')!.textContent).toBe('Bob');
        await typeText(row.querySelector('x-text-filter input') as HTMLElement, 'Designer');
        await settle(table);
        expect(table.columnFilters['role']).toBe('Designer');
    });

    it('follows pinned columns and RTL', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true, pin: 'left' }, { accessorKey: 'role', header: 'Role', width: '600px', enableFiltering: true }], enableFloatingFilters: true });
        await withRtl(table);
        const pinned = filterRow(table)!.querySelector<HTMLElement>('[data-pinned="left"]')!;
        expect(getComputedStyle(pinned).position).toBe('sticky');
        const head = headCell(table, 'name').getBoundingClientRect();
        const cell = pinned.getBoundingClientRect();
        expect(Math.round(cell.left)).toBe(Math.round(head.left));
        expect(Math.round(cell.width)).toBe(Math.round(head.width));
    });

    it('makes the floating input at least 44 px tall on a coarse pointer', async () => {
        const table = await mount({ columns: floatingColumns, enableFloatingFilters: true });
        const field = (): HTMLElement => shadow(filterRow(table)!.querySelector('ge-input'), 'input');
        expect(Math.round(field().getBoundingClientRect().height)).toBe(28);
        await emulateTouch(true);
        await frames(2);
        expect(field().getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    });
});

describe('F7 the advanced filter builder', () => {
    const advancedTrigger = (table: Element): HTMLElement => q(table, '[data-slot="advanced-filter-trigger"]');
    const builder = (table: Element): HTMLElement & { updateComplete: Promise<boolean> } => q(table, 'ge-data-table-filter-builder') as HTMLElement & { updateComplete: Promise<boolean> };
    const inner = (table: Element, selector: string): HTMLElement[] => [...builder(table).shadowRoot!.querySelectorAll<HTMLElement>(selector)];
    const byText = (table: Element, text: string): HTMLElement => inner(table, 'button, ge-button').find((b) => b.textContent?.trim() === text)!;

    async function openBuilder(table: Table): Promise<void> {
        await openPopover(advancedTrigger(table), 'ge-data-table-filter-builder');
        await settle(table);
        await builder(table).updateComplete;
    }
    const refresh = async (table: Table): Promise<void> => {
        await settle(table);
        await builder(table).updateComplete;
    };

    it('is in the toolbar only with enable-advanced-filter, with a count badge', async () => {
        expect((await mount({}, { 'show-toolbar': 'true' })).querySelector('[data-slot="advanced-filter-trigger"]')).toBeNull();
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }, { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'role', operator: 'isEmpty' }] }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        const button = advancedTrigger(table);
        expect(button.querySelector('[data-slot="data-table-count-badge"]')!.textContent).toBe('2');
        expect(button.getAttribute('aria-label')).toBe('Filter (2)');
        // after the global filter input, before the toolbar-start slot
        const start = q(table, '[data-slot="data-table-toolbar-start"]');
        expect(start.firstElementChild!.getAttribute('data-slot')).toBe('data-table-filter');
    });

    it('adds, edits, nests and removes rules; each edit is one whole new tree; the page returns to 0', async () => {
        const table = await mount({ enableAdvancedFilter: true, data: Array.from({ length: 30 }, (_, i) => ({ ...ROWS[i % 4]!, id: String(i) })), paginationState: { pageIndex: 1, pageSize: 10 } }, { 'show-pagination': 'true' });
        const trees = record(table, 'advanced-filter-change');
        const pages = record(table, 'page-change');
        await openBuilder(table);
        await userEvent.click(byText(table, '+ Condition'));
        await refresh(table);
        expect(trees).toHaveLength(1);
        expect(table.paginationState.pageIndex).toBe(0);
        expect(pages).toHaveLength(1);
        expect(table.advancedFilter).toEqual({ type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: '' }] });
        const first = table.advancedFilter;
        await typeText(inner(table, 'input.value')[0]!, 'Al');
        await refresh(table);
        expect(trees).toHaveLength(3); // one per keystroke
        expect(table.advancedFilter).not.toBe(first);
        expect(names(table)).toEqual(Array.from({ length: 8 }, () => 'Alice'));
        // a valueless operator hides the input and keeps the value
        const operator = inner(table, 'select.operator')[0] as unknown as HTMLSelectElement;
        await userEvent.selectOptions(operator, 'isNotEmpty');
        await refresh(table);
        expect(inner(table, 'input.value')).toHaveLength(0);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ operator: 'isNotEmpty', value: 'Al' });
        await userEvent.selectOptions(inner(table, 'select.operator')[0] as unknown as HTMLSelectElement, 'contains');
        await refresh(table);
        expect((inner(table, 'input.value')[0] as HTMLInputElement).value).toBe('Al');
        // nest a group, add a condition inside it, switch it to OR
        await userEvent.click(byText(table, '+ Group'));
        await refresh(table);
        const nested = inner(table, 'ge-data-table-filter-builder')[0] as HTMLElement & { updateComplete: Promise<boolean> };
        await nested.updateComplete;
        const nestedButton = (text: string): HTMLElement => [...nested.shadowRoot!.querySelectorAll<HTMLElement>('button, ge-button')].find((b) => b.textContent?.trim() === text)!;
        await userEvent.click(nestedButton('+ Condition'));
        await refresh(table);
        await nested.updateComplete;
        await userEvent.click(nestedButton('OR'));
        await refresh(table);
        expect(table.advancedFilter!.rules[1]).toMatchObject({ type: 'group', combinator: 'or', rules: [{ type: 'condition' }] });
        expect(advancedTrigger(table).querySelector('[data-slot="data-table-count-badge"]')!.textContent).toBe('2');
        // remove the group, then the condition
        await userEvent.click(byText(table, 'Remove group'));
        await refresh(table);
        expect(table.advancedFilter!.rules).toHaveLength(1);
        await userEvent.click(inner(table, 'button.remove')[0]!);
        await refresh(table);
        expect(table.advancedFilter!.rules).toHaveLength(0);
        expect(advancedTrigger(table).querySelector('[data-slot="data-table-count-badge"]')).toBeNull();
        await closePopover(table);
    });

    it('"Clear all filters" clears the advanced filter only (D9) and is shown while there is one', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, columnFilters: { role: ['Engineer'] }, globalFilter: 'a' });
        await openBuilder(table);
        await userEvent.click(q(table, '[data-slot="advanced-filter-clear"]'));
        await settle(table);
        expect(table.advancedFilter).toBeNull();
        expect(table.columnFilters).toEqual({ role: ['Engineer'] });
        expect(table.globalFilter).toBe('a');
        expect(table.querySelector('[data-slot="advanced-filter-clear"]')).toBeNull();
        await closePopover(table);
    });

    it('shows a condition on an unknown column as that key, selected and disabled, and picking a real column changes it', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'gone', operator: 'contains', value: 'a' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        const trees = record(table, 'advanced-filter-change');
        await openBuilder(table);
        const select = inner(table, 'select.column')[0] as unknown as HTMLSelectElement;
        expect(select.selectedOptions[0]?.textContent).toBe('gone');
        expect(select.selectedOptions[0]?.disabled).toBe(true);
        await userEvent.selectOptions(select, 'name');
        await refresh(table);
        expect(trees).toHaveLength(1);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ column: 'name' });
        expect(inner(table, 'select.column option[data-unknown]')).toHaveLength(0);
        await closePopover(table);
    });

    it('a value still waiting on the debounce is reported when the popover closes, once', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: '' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 1000 });
        const trees = record(table, 'advanced-filter-change');
        await openBuilder(table);
        await typeText(inner(table, 'input.value')[0]!, 'Bo');
        await closePopover(table);
        await settle(table);
        expect(trees).toHaveLength(1);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ value: 'Bo' });
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(trees).toHaveLength(1);
    });

    it('an unrelated table render does not re-render the open builder (its inputs keep their identity)', async () => {
        const table = await mount({ enableAdvancedFilter: true });
        await openBuilder(table);
        const b = builder(table) as HTMLElement & { render(): unknown };
        const render = vi.spyOn(b, 'render');
        table.requestUpdate();
        await refresh(table);
        table.sortState = { column: 'name', direction: 'asc' };
        await refresh(table);
        expect(render).not.toHaveBeenCalled();
        await closePopover(table);
    });

    it('a reused condition row shows the model: after removing condition 0, row 0 shows condition 1 column and operator', async () => {
        const group: FilterGroup = {
            type: 'group',
            combinator: 'and',
            rules: [
                { type: 'condition', column: 'name', operator: 'contains', value: 'a' },
                { type: 'condition', column: 'role', operator: 'equals', value: 'Engineer' },
            ],
        };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        await openBuilder(table);
        const op = (): HTMLSelectElement => inner(table, 'select.operator')[0] as unknown as HTMLSelectElement;
        // The user's own pick makes the options "dirty": their `selected` attribute no longer moves the selection.
        await userEvent.selectOptions(op(), 'startsWith');
        await refresh(table);
        await userEvent.selectOptions(op(), 'contains');
        await refresh(table);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ operator: 'contains' });
        await userEvent.click(inner(table, 'button.remove')[0]!);
        await refresh(table);
        expect(table.advancedFilter!.rules).toHaveLength(1);
        expect((inner(table, 'select.column')[0] as unknown as HTMLSelectElement).value).toBe('role');
        expect(op().value).toBe('equals');
        await closePopover(table);
    });

    it('a tree replaced from outside drops the waiting values: Clear all within the debounce, then + Condition, gives an empty condition (round 6)', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 1000 });
        await openBuilder(table);
        await typeText(inner(table, 'input.value')[0]!, 'xyz');
        await userEvent.click(q(table, '[data-slot="advanced-filter-clear"]'));
        await refresh(table);
        expect(table.advancedFilter).toBeNull();
        await userEvent.click(byText(table, '+ Condition'));
        await refresh(table);
        expect(table.advancedFilter!.rules).toEqual([{ type: 'condition', column: 'name', operator: 'contains', value: '' }]);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await refresh(table);
        expect(table.advancedFilter!.rules).toEqual([{ type: 'condition', column: 'name', operator: 'contains', value: '' }]);
        await closePopover(table);
    });

    it('a parent edit that leaves a nested group alone does not re-render its builder (round 12)', async () => {
        const group: FilterGroup = {
            type: 'group',
            combinator: 'and',
            rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }, { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'role', operator: 'contains', value: 'E' }] }],
        };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        await openBuilder(table);
        const nested = inner(table, 'ge-data-table-filter-builder')[0] as HTMLElement & { render(): unknown };
        const render = vi.spyOn(nested, 'render');
        await userEvent.click(byText(table, 'OR')); // the top group's combinator: a new top tree, the nested rule object is unchanged
        await refresh(table);
        expect(table.advancedFilter!.combinator).toBe('or');
        expect(render).not.toHaveBeenCalled();
        await closePopover(table);
    });

    describe('nested groups and the debounce (round 4)', () => {
        const cond = (column: string, value: string): FilterGroup['rules'][number] => ({ type: 'condition', column, operator: 'contains', value });
        const nestedInputs = (table: Table, at: number): HTMLInputElement[] => {
            const nested = inner(table, 'ge-data-table-filter-builder')[at] as HTMLElement;
            return [...nested.shadowRoot!.querySelectorAll<HTMLInputElement>('input.value')];
        };

        it('a value typed in subgroup 0, then subgroup 0 removed within the debounce, leaves subgroup 1 unchanged', async () => {
            const group: FilterGroup = {
                type: 'group',
                combinator: 'and',
                rules: [
                    { type: 'group', combinator: 'or', rules: [cond('name', 'a')] },
                    { type: 'group', combinator: 'or', rules: [cond('role', 'Eng')] },
                ],
            };
            const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 400 });
            await openBuilder(table);
            await typeText(nestedInputs(table, 0)[0]!, 'xyz');
            await userEvent.click(byText(table, 'Remove group')); // the first subgroup's
            await refresh(table);
            await new Promise((resolve) => setTimeout(resolve, 500));
            await refresh(table);
            expect(table.advancedFilter!.rules).toEqual([{ type: 'group', combinator: 'or', rules: [cond('role', 'Eng')] }]);
            await closePopover(table);
            expect(table.advancedFilter!.rules).toEqual([{ type: 'group', combinator: 'or', rules: [cond('role', 'Eng')] }]);
        });

        it('closing the popover within the debounce reports the value outside the render: no change-in-update, one query (round 16)', async () => {
            const group: FilterGroup = { type: 'group', combinator: 'and', rules: [cond('name', '')] };
            const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 1000 });
            const queries = record(table, 'query');
            await openBuilder(table);
            await typeText(inner(table, 'input.value')[0]!, 'Al');
            const warn = vi.spyOn(console, 'warn');
            try {
                await closePopover(table);
                await settle(table);
                expect(warn.mock.calls.filter((args) => String(args[0]).includes('change-in-update'))).toEqual([]);
            } finally {
                warn.mockRestore();
            }
            expect(table.advancedFilter).toEqual({ type: 'group', combinator: 'and', rules: [cond('name', 'Al')] });
            expect(queries).toHaveLength(1);
        });

        it('values typed at the top level and in a nested group, then the popover closed within the debounce, are both kept (one change)', async () => {
            const group: FilterGroup = { type: 'group', combinator: 'and', rules: [cond('name', ''), { type: 'group', combinator: 'or', rules: [cond('role', '')] }] };
            const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 1000 });
            const trees = record(table, 'advanced-filter-change');
            await openBuilder(table);
            await typeText(inner(table, 'input.value')[0]!, 'Al');
            await typeText(nestedInputs(table, 0)[0]!, 'Eng');
            await closePopover(table);
            await settle(table);
            expect(trees).toHaveLength(1);
            expect(table.advancedFilter).toEqual({ type: 'group', combinator: 'and', rules: [cond('name', 'Al'), { type: 'group', combinator: 'or', rules: [cond('role', 'Eng')] }] });
        });

        it('a value typed, then the table removed and put back within the debounce, is kept in the advanced filter (round 13)', async () => {
            const group: FilterGroup = { type: 'group', combinator: 'and', rules: [cond('name', '')] };
            const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 1000 });
            await openBuilder(table);
            await typeText(inner(table, 'input.value')[0]!, 'Al');
            const parent = table.parentElement!;
            table.remove();
            parent.append(table);
            await settle(table);
            expect(table.advancedFilter).toEqual({ type: 'group', combinator: 'and', rules: [cond('name', 'Al')] });
        });
    });

    it('an equal copy of the tree reassigned before anything was reported keeps the typed text; a different tree drops it (round 18)', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: '' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 400 });
        await openBuilder(table);
        const input = inner(table, 'input.value')[0]! as HTMLInputElement;
        await typeText(input, 'A');
        table.advancedFilter = structuredClone(group); // the same tree, a new object, nothing reported yet
        await settle(table);
        expect(input.value).toBe('A');
        await new Promise((resolve) => setTimeout(resolve, 500));
        await settle(table);
        expect((table.advancedFilter!.rules[0] as FilterCondition).value).toBe('A');
        await typeText(input, 'B');
        table.advancedFilter = { ...group, combinator: 'or' }; // a real replacement
        await new Promise((resolve) => setTimeout(resolve, 500));
        await settle(table);
        expect((table.advancedFilter!.rules[0] as FilterCondition).value).toBe('');
        await closePopover(table);
    });

    it("an async copy of the reported tree (a consumer's binding) keeps the text typed since (round 17)", async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: '' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 200 });
        table.addEventListener('advanced-filter-change', (e) => {
            const copy = structuredClone((e as CustomEvent<FilterGroup>).detail);
            setTimeout(() => (table.advancedFilter = copy), 100);
        });
        await openBuilder(table);
        const input = inner(table, 'input.value')[0]! as HTMLInputElement;
        await typeText(input, 'A');
        await new Promise((resolve) => setTimeout(resolve, 230)); // 'A' reported; its copy comes back in ~100 ms
        await typeText(input, 'B'); // waits on the debounce while the copy arrives
        await new Promise((resolve) => setTimeout(resolve, 150));
        await settle(table);
        expect(input.value).toBe('AB');
        await new Promise((resolve) => setTimeout(resolve, 300));
        await settle(table);
        expect((table.advancedFilter!.rules[0] as FilterCondition).value).toBe('AB');
        await closePopover(table);
    });

    it('a value typed and erased within the debounce emits no group-change (round 15)', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'A' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 200 });
        const trees = record(table, 'advanced-filter-change');
        await openBuilder(table);
        const input = inner(table, 'input.value')[0]!;
        await typeText(input, 'l');
        await press('{Backspace}');
        await new Promise((resolve) => setTimeout(resolve, 300));
        await settle(table);
        expect(trees).toHaveLength(0);
        expect(table.advancedFilter).toBe(group);
        await closePopover(table);
    });

    it('debounces a typed value with filterDebounce (other edits are never delayed)', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: '' }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group, filterDebounce: 300 });
        const trees = record(table, 'advanced-filter-change');
        await openBuilder(table);
        await typeText(inner(table, 'input.value')[0]!, 'Al');
        await refresh(table);
        expect(trees).toHaveLength(0);
        await new Promise((resolve) => setTimeout(resolve, 400));
        await refresh(table);
        expect(trees).toHaveLength(1);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ value: 'Al' });
        // A value still waiting is not lost to a structural edit: it lands in its slot first, in the same new tree.
        await typeText(inner(table, 'input.value')[0]!, 'i');
        await userEvent.click(byText(table, '+ Condition'));
        await refresh(table);
        expect(trees).toHaveLength(2);
        expect(table.advancedFilter!.rules).toHaveLength(2);
        expect(table.advancedFilter!.rules[0]).toMatchObject({ value: 'Ali' });
        await closePopover(table);
    });

    it('names every control (D8), and grows them to 44 px on a coarse pointer', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'Al' }, { type: 'group', combinator: 'or', rules: [] }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        await emulateTouch(true);
        await openBuilder(table);
        await frames(2);
        expect(inner(table, 'select.column')[0]!.getAttribute('aria-label')).toBe('Column');
        expect(inner(table, 'select.operator')[0]!.getAttribute('aria-label')).toBe('Operator');
        expect(inner(table, 'input.value')[0]!.getAttribute('aria-label')).toBe('Value');
        expect(inner(table, 'button.remove')[0]!.getAttribute('aria-label')).toBe('Remove condition');
        for (const el of [byText(table, 'AND'), byText(table, 'Remove group'), shadow(byText(table, '+ Condition'), 'button'), inner(table, 'select.column')[0]!, inner(table, 'input.value')[0]!, inner(table, 'button.remove')[0]!, advancedTrigger(table), q(table, '[data-slot="advanced-filter-clear"]')]) {
            const box = el.getBoundingClientRect();
            expect(Math.min(box.width, box.height), el.outerHTML.slice(0, 60)).toBeGreaterThanOrEqual(44);
        }
        await closePopover(table);
    });
});

describe('F8 keys typed in a floating filter input stay the input own (B1)', () => {
    it('Enter, F2 and Ctrl+Z open no editor and undo nothing', async () => {
        const table = await mount({
            columns: [{ ...nameColumn, enableFiltering: true, editable: true, valueSetter: (row: Row, value: unknown) => ({ ...row, name: String(value) }) }],
            enableFloatingFilters: true,
            enableEditHistory: true,
        });
        const undos = record(table, 'edit-undo');
        const edits = record(table, 'cell-edit');
        // a roving cell exists, so a key the grid took would act on it
        cellAt(table, 0, 'name')!.click();
        await settle(table);
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'b');
        await press('{Enter}');
        await press('{F2}');
        await press('{Control>}z{/Control}');
        await settle(table);
        expect(table.editingCell ?? null).toBeNull();
        expect(undos).toHaveLength(0);
        expect(edits).toHaveLength(0);
        expect(table.contains(document.activeElement) && document.activeElement!.closest('[data-kind="filter"]')).toBeTruthy();
    });

    it('with an edit to undo, Ctrl+Z in the floating input is the input own undo (its text), not a data undo; Enter there opens nothing', async () => {
        const table = await mount({
            columns: [{ ...nameColumn, enableFiltering: true, editable: true, valueSetter: (row: Row, value: unknown) => ({ ...row, name: String(value) }) }],
            enableFloatingFilters: true,
            enableEditHistory: true,
        });
        const undos = record(table, 'edit-undo');
        // One real edit, so the history has something a wrongly routed Ctrl+Z would undo.
        table.focusCell(0, 'name');
        await settle(table);
        await press('{Enter}');
        await settle(table);
        const editor = table.querySelector<HTMLInputElement>('[data-editing] input[data-edit-input]')!;
        await userEvent.type(editor, '!');
        await press('{Enter}');
        await settle(table);
        const edited = table.data[0]!.name;
        expect(edited.endsWith('!')).toBe(true);
        expect(table.canUndo).toBe(true);
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input') as HTMLInputElement;
        await typeText(input, 'xy');
        expect(input.value).toBe('xy');
        await press('{Control>}z{/Control}');
        await settle(table);
        expect(input.value).not.toBe('xy'); // the field's own undo ran
        expect(undos).toHaveLength(0);
        expect(table.data[0]!.name).toBe(edited);
        expect(table.canUndo).toBe(true);
        await press('{Enter}');
        await settle(table);
        expect(table.editingCell ?? null).toBeNull();
    });
});

describe('F9 result announcements (D7)', () => {
    // the live region appends a zero-width space to repeat an identical message
    const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replaceAll('​', '').trim();

    it('speaks one debounced message with the final count, and that all filters are cleared', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'a');
        await new Promise((resolve) => setTimeout(resolve, 200));
        await settle(table);
        expect(announcer(table)).toBe('');
        await typeText(input, 'l');
        await new Promise((resolve) => setTimeout(resolve, 600));
        await settle(table);
        expect(announcer(table)).toBe('1 row matches the filters');
        await userEvent.clear(input);
        await new Promise((resolve) => setTimeout(resolve, 600));
        await settle(table);
        expect(announcer(table)).toBe('All filters cleared, showing all rows');
        const live = (await axTree()).find((n) => (n.properties ?? []).some((p) => p.name === 'live' && p.value.value === 'polite'));
        expect(live).toBeDefined();
    });

    it("a consumer's own filter write cancels an older announcement: the column one and the global one (round 14)", async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'al');
        table.advancedFilter = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'o' }] };
        await new Promise((resolve) => setTimeout(resolve, 650));
        await settle(table);
        expect(announcer(table)).toBe('');
        table.provider('query')!.changeGlobalFilter('b');
        await settle(table);
        table.columnFilters = {};
        await new Promise((resolve) => setTimeout(resolve, 650));
        await settle(table);
        expect(announcer(table)).toBe('');
    });

    it('server filtering: an equal echo of the filters waits for no answer (round 16)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], localFiltering: false, total: 500, columnFilters: { name: 'a' } });
        table.columnFilters = { name: 'a' }; // a new, equal object
        await settle(table);
        expect(table.provider('query')?.filteredCount()).toBe(500); // no answer awaited: the total in hand still counts
        table.columnFilters = { name: 'b' };
        await settle(table);
        expect(table.provider('query')?.filteredCount()).toBeUndefined(); // a real change waits
    });

    it('server filtering announces the ANSWER total once its rows arrive, never the total from before the request', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        table.addEventListener('query', () => setTimeout(() => Object.assign(table, { data: [...table.data], total: 3 }), 900));
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'x');
        await new Promise((resolve) => setTimeout(resolve, 650));
        await settle(table);
        expect(announcer(table)).toBe(''); // the 500 in hand is the previous answer's
        expect(table.provider('query')?.filteredCount()).toBeUndefined();
        await new Promise((resolve) => setTimeout(resolve, 450));
        await settle(table);
        expect(announcer(table)).toBe('3 rows match the filters');
        expect(table.provider('query')?.filteredCount()).toBe(3);
    });

    it('server filtering: an answer that mutates the rows in place and changes only the total is an answer too (round 3)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        table.addEventListener('query', () =>
            setTimeout(() => {
                table.data.splice(1); // the same array, rows dropped in place
                table.total = 1;
            }, 800),
        );
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 650));
        await settle(table);
        expect(announcer(table)).toBe('');
        await new Promise((resolve) => setTimeout(resolve, 350));
        await settle(table);
        expect(announcer(table)).toBe('1 row matches the filters');
    });

    it('a newer filter change drops an announcement still waiting for the previous answer (round 5)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 500 });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 650)); // waiting for the answer to "q"
        await userEvent.clear(input);
        await new Promise((resolve) => setTimeout(resolve, 650));
        await settle(table);
        expect(announcer(table)).toBe('All filters cleared, showing all rows');
        Object.assign(table, { data: [...table.data], total: 3 }); // the answer to "q" arrives late
        await new Promise((resolve) => setTimeout(resolve, 50));
        await settle(table);
        expect(announcer(table)).toBe('All filters cleared, showing all rows');
    });

    it('a server sort arms no answer wait: no render 2 s after it, and the count is the total in hand (round 11)', async () => {
        const table = await mount({ localFiltering: false, localSorting: false, total: 40 });
        table.sortState = { column: 'name', direction: 'asc' };
        await settle(table);
        expect(table.provider('query')?.filteredCount()).toBe(40);
        const renders = vi.spyOn(table, 'requestUpdate');
        await new Promise((resolve) => setTimeout(resolve, 2200));
        expect(renders).not.toHaveBeenCalled();
    });

    it('a local table arms no answer wait: no render 2 s after a sort (round 5)', async () => {
        const table = await mount();
        table.sortState = { column: 'name', direction: 'asc' };
        await settle(table);
        const renders = vi.spyOn(table, 'requestUpdate');
        await new Promise((resolve) => setTimeout(resolve, 2200));
        expect(renders).not.toHaveBeenCalled();
        expect(table.provider('query')?.filteredCount()).toBe(table.provider('query')?.sortedData().length);
    });

    it('server filtering with no total says nothing, and stops waiting: a total set much later is not announced (round 4)', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false });
        table.addEventListener('query', () => setTimeout(() => (table.data = [...table.data]), 100));
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 2800));
        await settle(table);
        expect(announcer(table)).toBe('');
        table.total = 9;
        await settle(table);
        await frames(2);
        expect(announcer(table)).toBe('');
    });

    it('server filtering: an answer the table cannot see is trusted after the wait, with the total in hand', async () => {
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }], enableFloatingFilters: true, localFiltering: false, total: 4 });
        const input = shadow(table.querySelector('[data-kind="filter"] ge-input'), 'input');
        await typeText(input, 'q');
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await settle(table);
        expect(announcer(table)).toBe('');
        await new Promise((resolve) => setTimeout(resolve, 1300));
        await settle(table);
        expect(announcer(table)).toBe('4 rows match the filters');
    });
});

describe('the lazy panels and the leak rules', () => {
    it('a panel import that resolves after the table was removed does nothing (no throw, no render)', async () => {
        const table = await mount();
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            trigger(table, 'role').dispatchEvent(new PointerEvent('pointerenter'));
            table.remove();
            await whenDefined('ge-data-table-multiselect-filter');
            await frames(2);
            expect(errors).not.toHaveBeenCalled();
        } finally {
            errors.mockRestore();
        }
    });
});

describe('axe', () => {
    it.each(['light', 'dark'])('passes with a floating row, an active and an inactive trigger (%s)', async (mode) => {
        withTheme(mode);
        const table = await mount({ columns: [{ ...nameColumn, enableFiltering: true }, dateColumn, roleColumn], enableFloatingFilters: true, columnFilters: { role: ['Engineer'] } });
        const result = await axe.run(table);
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });

    it.each([
        ['date', 'day', 'ge-data-table-date-filter', [nameColumn, dateColumn]],
        ['date-range', 'day', 'ge-data-table-date-range-filter', [nameColumn, rangeColumn]],
        ['multiselect', 'role', 'ge-data-table-multiselect-filter', [nameColumn, roleColumn]],
    ] as const)('passes with the %s panel open', async (_, key, tag, columns) => {
        const table = await mount({ columns: [...columns] });
        const panel = await openPanel(table, key, tag);
        const result = await axe.run(panel.closest('ge-popover-content')!);
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        await closePopover(table);
    });

    it('passes with the builder open on a nested group', async () => {
        const group: FilterGroup = { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'Al' }, { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'role', operator: 'isEmpty' }] }] };
        const table = await mount({ enableAdvancedFilter: true, advancedFilter: group });
        await openPopover(q(table, '[data-slot="advanced-filter-trigger"]'), 'ge-data-table-filter-builder');
        await settle(table);
        await frames(2);
        const result = await axe.run(q(table, '[data-slot="advanced-filter-panel"]'));
        expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        await closePopover(table);
    });
});
