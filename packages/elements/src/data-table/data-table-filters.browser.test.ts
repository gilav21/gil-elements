import axe from 'axe-core';
import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { axTree, bodyRows, cellAt, headCell, mountTable, q, qa, settle } from './data-table-fixtures.js';
import { dateFilterFn, dateRangeFilterFn, multiselectFilterFn } from './data-table-filters.js';
import { emulateTouch, frames, openPopover, parkMouse, press, typeText, whenDefined, withRtl, withTheme } from './data-table-input-fixtures.js';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef, DataTableDateRange, FilterGroup } from './data-table.types.js';

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

describe('F4 the multiselect panel', () => {
    const optionRow = (panel: Element, label: string): HTMLElement => panel.shadowRoot!.querySelector<HTMLElement>(`ge-command-item[value="${label}"]`)!;

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
