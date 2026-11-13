/** Wave 7 step 0: the addon host on a real table (use, the `addons` attribute, addonOptions, expose, emit, announce, the services, the action buttons) and the inert AI methods. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataTableAddon, DataTableAddonHost } from './data-table-addon-kit.js';
import { registerDataTableAddon } from './data-table-addon-registry.js';
import type { GeDataTable } from './data-table.js';
import { bodyRows, headCell, makeRows, mountTable, q, qa, SAMPLE_COLUMNS, SAMPLE_ROWS, settle, stubDownload, trackTable, type DownloadStub, type SampleRow } from './data-table-fixtures.js';
import { emulateTouch, mouseDrag, parkMouse, typeText } from './data-table-input-fixtures.js';
import type { RowActionContext } from './data-table.types.js';

/** An addon that hands its host (and options) to the test. */
function probe(id: string) {
    const runs: { host: DataTableAddonHost<SampleRow>; options: unknown }[] = [];
    const stops: number[] = [];
    const addon: DataTableAddon<SampleRow> = {
        id,
        setup: (host, options) => {
            runs.push({ host, options });
            return () => stops.push(runs.length);
        },
    };
    return { addon, runs, stops };
}

/** Whether the anchor prototype has its own `click` before any test stubs it (it inherits HTMLElement's). */
const ANCHOR_OWN_CLICK = Object.hasOwn(HTMLAnchorElement.prototype, 'click');

let id = 0;
const uniqueId = (): string => `step0-probe-${++id}`;
const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replace('​', '');

let downloads: DownloadStub | undefined;
afterEach(async () => {
    downloads?.restore();
    downloads = undefined;
    await parkMouse(); // the pointer one test leaves over a table must not hover the next one (memory: pointer leaks across tests)
});

describe('use() and the addon host', () => {
    it('starts an addon used before the first connect only at the connect, with the table as root and the services provided', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = trackTable(document.createElement('ge-data-table') as GeDataTable<SampleRow>);
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS });
        table.use(addon, { x: 1 });
        expect(runs).toHaveLength(0);
        document.body.append(table);
        await settle(table);
        expect(runs).toHaveLength(1);
        const [{ host, options }] = runs as [(typeof runs)[0]];
        expect(options).toEqual({ x: 1 });
        expect(host.root).toBe(table);
        expect(host.resolvedLocale.code).toBe('en');
        expect(host.provider('query')?.rawRows()).toBe(SAMPLE_ROWS);
        expect(host.provider('query')?.rowId(SAMPLE_ROWS[1] as SampleRow)).toBe('b');
        expect(host.provider('columns')?.navigableKeys()).toEqual(['name', 'age']);
        expect(host.provider('interaction')?.rangeSelectionEnabled?.()).toBe(false);
    });

    it('tears an addon down when its use() is undone and at a disconnect, and starts it again at the reconnect', async () => {
        const { addon, runs, stops } = probe(uniqueId());
        const table = await mountTable();
        const off = table.use(addon);
        table.remove();
        expect(stops).toEqual([1]);
        document.body.append(table);
        expect(runs).toHaveLength(2);
        off();
        expect(stops).toEqual([1, 2]);
        table.remove();
    });

    it('fires an addon event as a bubbling, composed CustomEvent on the table, and announces through the live region', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        const heard = vi.fn();
        document.body.addEventListener('row-menu-open', heard);
        runs[0]!.host.emit('row-menu-open', { index: 2 });
        document.body.removeEventListener('row-menu-open', heard);
        const event = heard.mock.calls[0]![0] as CustomEvent;
        expect(event.target).toBe(table);
        expect([event.detail, event.bubbles, event.composed]).toEqual([{ index: 2 }, true, true]);
        runs[0]!.host.announce('Exported 4 rows');
        await settle(table);
        expect(announcer(table)).toBe('Exported 4 rows');
    });

    it('reaches the selection service: selectedRows is the table getter', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ enableRowSelection: true, rowSelection: { b: true, d: true, gone: true } });
        table.use(addon);
        const selection = runs[0]!.host.provider('selection');
        expect(selection?.selectedRows().map((r) => r.id)).toEqual(['b', 'd']);
        expect(selection?.selectedRows()).toEqual(table.selectedRows);
    });

    it('applies filters for an addon in one step: back to page 0, one filter-change', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ paginationState: { pageIndex: 1, pageSize: 2 } });
        table.use(addon);
        const changes: string[] = [];
        table.addEventListener('filter-change', (e) => changes.push((e as CustomEvent<string>).detail));
        runs[0]!.host.provider('query')?.applyFilters({ globalFilter: 'Al' });
        await settle(table);
        expect(changes).toEqual(['Al']);
        expect(table.paginationState.pageIndex).toBe(0);
        expect(bodyRows(table).map((r) => r.textContent?.trim())).toEqual([expect.stringContaining('Alice')]);
    });

    it('keeps the busy overlay while another addon is busy, and drops a busy addon label at its teardown (review)', async () => {
        const one = probe(uniqueId());
        const two = probe(uniqueId());
        const table = await mountTable();
        table.use(one.addon);
        const offTwo = table.use(two.addon);
        one.runs[0]!.host.setBusy('Exporting…');
        two.runs[0]!.host.setBusy('Pivoting…');
        one.runs[0]!.host.setBusy(null);
        await settle(table);
        expect(q(table, '[data-kind="busy"]').textContent).toContain('Pivoting…');
        offTwo();
        await settle(table);
        expect(table.querySelector('[data-kind="busy"]')).toBeNull();
    });

    it('shows the model text again in the toolbar box when applyFilters drops a typed text still waiting (final review 3)', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ filterDebounce: 5000 });
        table.use(addon);
        const box = q(table, '[data-slot="data-table-filter"] ge-input') as HTMLElement & { value: string };
        const inner = box.shadowRoot!.querySelector('input')!;
        await typeText(inner, 'abc'); // waits on the debounce: the model is still ''
        expect(table.globalFilter).toBe('');
        runs[0]!.host.provider('query')?.applyFilters({ globalFilter: '' });
        await settle(table);
        expect(box.value).toBe('');
        expect(table.globalFilter).toBe('');
    });

    it('keeps typed global text that waits on the debounce across an unrelated render (final review 4)', async () => {
        const table = await mountTable({ filterDebounce: 5000 });
        const box = q(table, '[data-slot="data-table-filter"] ge-input') as HTMLElement & { value: string };
        await typeText(box.shadowRoot!.querySelector('input')!, 'abc');
        table.showRowBorders = false; // an unrelated render
        await settle(table);
        expect(box.value).toBe('abc');
        expect(table.globalFilter).toBe('');
    });

    it('drops the floating column-filter writes still waiting when applyFilters sets the column filters (final review 4)', async () => {
        const { addon, runs } = probe(uniqueId());
        const columns = [{ accessorKey: 'name', header: 'Name', enableFiltering: true }, { accessorKey: 'age', header: 'Age' }];
        const table = await mountTable({ columns, enableFloatingFilters: true, filterDebounce: 300 });
        table.use(addon);
        const input = table.querySelector('[data-kind="filter"] ge-input')!.shadowRoot!.querySelector('input')!;
        await typeText(input, 'Al'); // waits on the debounce
        runs[0]!.host.provider('query')?.applyFilters({ columnFilters: { age: '30' } });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await settle(table);
        expect(table.columnFilters).toEqual({ age: '30' });
        expect(input.value).toBe('');
    });

    it('shows the busy overlay with the label an addon sets, and clears it', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        runs[0]!.host.setBusy('Exporting…');
        await settle(table);
        expect(q(table, '[data-slot="data-table-loader"][data-kind="busy"]').textContent).toContain('Exporting…');
        runs[0]!.host.setBusy(null);
        await settle(table);
        expect(table.querySelector('[data-kind="busy"]')).toBeNull();
    });
});

describe('a throwing addon', () => {
    it('is reported once and skipped: the table connects, renders, runs the other addons, and disconnects', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { addon, runs } = probe(uniqueId());
        const table = trackTable(document.createElement('ge-data-table') as GeDataTable<SampleRow>);
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS });
        table.use({
            id: uniqueId(),
            setup: () => {
                throw new Error('setup failed');
            },
        });
        table.use({ id: uniqueId(), setup: () => () => { throw new Error('teardown failed'); } });
        table.use(addon);
        document.body.append(table);
        await settle(table);
        expect(bodyRows(table)).toHaveLength(4);
        expect(runs).toHaveLength(1);
        expect(() => table.remove()).not.toThrow();
        expect(error.mock.calls.map((call) => String(call[0]))).toEqual([expect.stringContaining('threw in setup'), expect.stringContaining('threw in teardown')]);
        error.mockRestore();
    });
});

describe('what an addon registered goes with it (final review)', () => {
    it('a setup that registers a row action and then throws leaves no button', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const table = await mountTable();
        table.use({
            id: uniqueId(),
            setup: (host) => {
                host.registerCellAction({ id: 'half', onClick: () => undefined });
                throw new Error('after registering');
            },
        });
        await settle(table);
        expect(table.querySelector('[data-action-id="half"]')).toBeNull();
        expect(table.querySelector('[data-column="_actions"]')).toBeNull();
        error.mockRestore();
    });

    it('a host kept after the teardown registers, emits and subscribes nothing', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        const stale = runs[0]!.host;
        table.remove();
        stale.registerCellAction({ id: 'late', onClick: () => undefined });
        stale.registerHeaderAction({ id: 'late-head', onClick: () => undefined });
        const heard = vi.fn();
        table.addEventListener('late-event', heard);
        stale.emit('late-event');
        const listener = vi.fn();
        stale.subscribe('locale', listener);
        document.body.append(table);
        await settle(table);
        table.locale = 'en-GB';
        await settle(table);
        expect(table.querySelector('[data-action-id="late"], [data-action-id="late-head"]')).toBeNull();
        expect(heard).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
        table.remove();
    });
});

describe('the selectedRows getter (final review)', () => {
    it('answers on a table that was never connected, from data and rowSelection', () => {
        const table = document.createElement('ge-data-table') as GeDataTable<SampleRow>;
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS, rowSelection: { b: true, c: true } });
        expect(table.selectedRows.map((r) => r.id)).toEqual(['b', 'c']);
    });
});

describe('the addons attribute, addonOptions and addon()', () => {
    it('starts a registered addon named in the attribute, with its options, and restarts it when they change', async () => {
        const name = uniqueId();
        const { addon, runs, stops } = probe(name);
        registerDataTableAddon(addon);
        const table = await mountTable({ addonOptions: { [name]: { a: 1 } } }, { addons: name });
        expect(runs.map((r) => r.options)).toEqual([{ a: 1 }]);
        table.addonOptions = { [name]: { a: 1 } }; // equal by value: no restart
        await settle(table);
        table.addonOptions = { [name]: { a: 2 } };
        await settle(table);
        expect(runs.map((r) => r.options)).toEqual([{ a: 1 }, { a: 2 }]);
        table.addons = '';
        await settle(table);
        expect(stops).toEqual([1, 2]);
    });

    it('stops the attribute addons when the attribute is removed, without throwing (final review 5)', async () => {
        const name = uniqueId();
        const { addon, runs, stops } = probe(name);
        registerDataTableAddon(addon);
        const table = await mountTable({}, { addons: name });
        expect(runs).toHaveLength(1);
        table.removeAttribute('addons');
        await settle(table);
        expect(stops).toEqual([1]);
        table.remove();
        document.body.append(table); // a connect with no attribute
        await settle(table);
        expect(runs).toHaveLength(1);
    });

    it('starts an addon the attribute lists as soon as its module registers it, after the connect', async () => {
        const name = uniqueId();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        await mountTable({}, { addons: name });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining(`unknown addon "${name}"`));
        warn.mockRestore();
        const { addon, runs } = probe(name);
        registerDataTableAddon(addon);
        expect(runs).toHaveLength(1);
    });

    it('returns what a running addon exposed, and undefined once it stops', async () => {
        const name = uniqueId();
        const table = await mountTable();
        const off = table.use({ id: name, setup: (host) => host.expose({ ping: () => 'pong' }) });
        expect(table.addon<{ ping(): string }>(name)?.ping()).toBe('pong');
        off();
        expect(table.addon(name)).toBeUndefined();
    });
});

describe('the action buttons addons register', () => {
    it('adds the actions column with one out-of-tab-order button per enabled row, labelled, calling the slot with the row context', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ isRowDisabled: (row: SampleRow) => row.id === 'c' });
        expect(table.querySelector('[data-column="_actions"]')).toBeNull();
        table.use(addon);
        const clicks: RowActionContext<SampleRow>[] = [];
        const off = runs[0]!.host.registerCellAction({ id: 'menu', haspopup: 'menu', onClick: (_event, context) => clicks.push(context) });
        await settle(table);
        const buttons = qa(table, '[data-column="_actions"] button[data-action-id="menu"]');
        expect(buttons).toHaveLength(3); // row c is disabled
        expect(buttons.map((b) => [b.getAttribute('aria-label'), b.getAttribute('tabindex'), b.getAttribute('aria-haspopup')])).toEqual(Array(3).fill(['Row actions', '-1', 'menu']));
        buttons[1]!.click();
        expect(clicks).toEqual([{ row: SAMPLE_ROWS[1], index: 1, selected: false }]);
        off();
        await settle(table);
        expect(table.querySelector('[data-column="_actions"]')).toBeNull();
    });

    it('draws the header button as the header action the core already handles: hidden until hover, and a press-and-drag on it does not reorder (review)', async () => {
        await parkMouse();
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ enableColumnReorder: true }, {}, { width: 700, height: 400 });
        table.use(addon);
        runs[0]!.host.registerHeaderAction({ id: 'col', onClick: () => undefined });
        await settle(table);
        const kebab = headCell(table, 'name').querySelector<HTMLElement>('[data-action-id="col"]')!;
        expect(kebab.dataset['slot']).toBe('data-table-header-action');
        await parkMouse();
        // Files that emulate touch share the browser and can leave a touch-only pointer behind (`hover: none`), which shows the button at all
        // times (the CSS rule for touch); with a hovering pointer parked away it is hidden (as in toast.browser.test.ts).
        const touchOnly = matchMedia('(hover: none)').matches;
        await expect.poll(() => getComputedStyle(kebab).opacity).toBe(touchOnly ? '1' : '0');
        await mouseDrag(kebab, headCell(table, 'age'), { holdMs: 100 });
        await settle(table);
        expect(table.columnOrder).toEqual([]);
        await parkMouse();
    });

    it('draws aria-expanded from the slot, per row and per column, and none without `expanded`', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        let openRow = -1;
        let openColumn = '';
        runs[0]!.host.registerCellAction({ id: 'menu', expanded: (context) => context.index === openRow, onClick: () => undefined });
        runs[0]!.host.registerCellAction({ id: 'plain', onClick: () => undefined });
        runs[0]!.host.registerHeaderAction({ id: 'col', expanded: (column) => column.accessorKey === openColumn, onClick: () => undefined });
        openRow = 2;
        openColumn = 'age';
        table.requestUpdate();
        await settle(table);
        expect(qa(table, 'button[data-action-id="menu"]').map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'true', 'false']);
        expect(qa(table, 'button[data-action-id="plain"]').every((b) => !b.hasAttribute('aria-expanded'))).toBe(true);
        expect(headCell(table, 'age').querySelector('[data-action-id="col"]')?.getAttribute('aria-expanded')).toBe('true');
        expect(headCell(table, 'name').querySelector('[data-action-id="col"]')?.getAttribute('aria-expanded')).toBe('false');
    });

    it('redraws aria-expanded when the addon asks for a render (nothing else renders), and requestRender is a no-op while detached', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        const { host } = runs[0]!;
        let open = false;
        host.registerCellAction({ id: 'menu', expanded: (context) => open && context.index === 0, onClick: () => undefined });
        await settle(table);
        const first = (): string | null => q(table, 'button[data-action-id="menu"]').getAttribute('aria-expanded');
        expect(first()).toBe('false');
        open = true;
        await settle(table);
        expect(first()).toBe('false'); // no render was asked for
        host.requestRender();
        await settle(table);
        expect(first()).toBe('true');
        table.remove();
        const update = vi.spyOn(table, 'requestUpdate');
        expect(() => host.requestRender()).not.toThrow();
        expect(update).not.toHaveBeenCalled();
    });

    it("draws a consumer's own actions column content followed by the addon buttons, and only the content on a disabled row (final review)", async () => {
        const { addon, runs } = probe(uniqueId());
        const columns = [...SAMPLE_COLUMNS, { accessorKey: '_actions', header: '', cellRenderer: () => 'mine' }];
        const table = await mountTable({ columns, isRowDisabled: (row: SampleRow) => row.id === 'c' });
        table.use(addon);
        runs[0]!.host.registerCellAction({ id: 'menu', onClick: () => undefined });
        await settle(table);
        const cells = qa(table, '[data-slot="table-cell"][data-column="_actions"]');
        expect(cells.map((c) => c.textContent?.trim())).toEqual(['mine', 'mine', 'mine', 'mine']);
        expect(cells.map((c) => c.querySelectorAll('[data-action-id="menu"]').length)).toEqual([1, 1, 0, 1]);
        const buttonAfterContent = cells[0]!.lastElementChild;
        expect(buttonAfterContent?.getAttribute('data-action-id')).toBe('menu');
    });

    it.each([
        [false, 50],
        [true, 60],
    ])('sizes the actions column for one button at its real size (coarse pointer %s: %s px) (final review 5)', async (coarse, width) => {
        const real = window.matchMedia.bind(window);
        const media = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
            const list = real(query);
            if (query === '(pointer: coarse)') Object.defineProperty(list, 'matches', { value: coarse });
            return list;
        });
        try {
            const { addon, runs } = probe(uniqueId());
            const table = await mountTable({}, {}, { width: 900, height: 400 });
            table.use(addon);
            runs[0]!.host.registerCellAction({ id: 'one', onClick: () => undefined });
            await settle(table);
            expect(q(table, '[data-slot="table-cell"][data-column="_actions"]').getBoundingClientRect().width).toBeCloseTo(width, 0);
        } finally {
            media.mockRestore();
        }
    });

    it('draws a row action button at 2.75rem under a coarse pointer, over its data-size (final review 7)', async () => {
        await emulateTouch(true);
        try {
            expect(matchMedia('(pointer: coarse)').matches).toBe(true);
            const { addon, runs } = probe(uniqueId());
            const table = await mountTable();
            table.use(addon);
            runs[0]!.host.registerCellAction({ id: 'one', onClick: () => undefined });
            await settle(table);
            const button = q(table, '[data-action-id="one"]');
            expect(button.dataset['size']).toBe('lg');
            expect(button.getBoundingClientRect().height).toBeCloseTo(44, 0);
        } finally {
            await emulateTouch(false);
        }
    });

    it('asks matchMedia for the coarse pointer once, not at every column read (final review 6)', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable(); // (the virtual controller asks once at its attach: not counted)
        table.use(addon);
        const media = vi.spyOn(window, 'matchMedia');
        try {
            runs[0]!.host.registerCellAction({ id: 'one', onClick: () => undefined });
            await settle(table);
            const columns = runs[0]!.host.provider('columns')!;
            for (let i = 0; i < 5; i++) columns.enhancedColumns();
            table.requestUpdate();
            await settle(table);
            expect(media.mock.calls.filter(([query]) => query === '(pointer: coarse)').length).toBeLessThanOrEqual(1);
        } finally {
            media.mockRestore();
        }
    });

    it('reports a throwing onClick of a row or header action once per slot, with no uncaught error (final review 6)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const uncaught: ErrorEvent[] = [];
        const onError = (event: ErrorEvent): void => {
            uncaught.push(event);
            event.preventDefault();
        };
        window.addEventListener('error', onError);
        try {
            const { addon, runs } = probe(uniqueId());
            const table = await mountTable();
            table.use(addon);
            const boom = (): never => {
                throw new Error('click failed');
            };
            runs[0]!.host.registerCellAction({ id: 'row', onClick: boom });
            runs[0]!.host.registerHeaderAction({ id: 'head', onClick: boom });
            await settle(table);
            const row = qa(table, '[data-action-id="row"]');
            row[0]!.click();
            row[1]!.click();
            headCell(table, 'age').querySelector<HTMLElement>('[data-action-id="head"]')!.click();
            expect(uncaught).toEqual([]);
            expect(error).toHaveBeenCalledTimes(2); // once per slot
        } finally {
            window.removeEventListener('error', onError);
            error.mockRestore();
        }
    });

    it('keeps a header action visible while its menu is open (aria-expanded) (final review 5)', async () => {
        await parkMouse();
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        runs[0]!.host.registerHeaderAction({ id: 'open', expanded: () => true, onClick: () => undefined });
        await settle(table);
        const kebab = headCell(table, 'name').querySelector<HTMLElement>('[data-action-id="open"]')!;
        await expect.poll(() => getComputedStyle(kebab).opacity).toBe('1');
    });

    it("hands a header action the consumer's own column definition (final review 5)", async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        const seen: unknown[] = [];
        runs[0]!.host.registerHeaderAction({ id: 'col', expanded: (column) => (seen.push(column), false), onClick: (_event, column) => seen.push(column) });
        await settle(table);
        headCell(table, 'age').querySelector<HTMLButtonElement>('[data-action-id="col"]')!.click();
        expect(seen.at(-1)).toBe(table.columns[1]);
        expect(seen.filter((c) => (c as { accessorKey: string }).accessorKey === 'name').every((c) => c === table.columns[0])).toBe(true);
    });

    it('makes the actions column wide enough for its buttons: none overflows its cell (final review 3)', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({}, {}, { width: 900, height: 400 });
        table.use(addon);
        runs[0]!.host.registerCellAction({ id: 'one', onClick: () => undefined });
        runs[0]!.host.registerCellAction({ id: 'two', onClick: () => undefined });
        await settle(table);
        const cell = q(table, '[data-slot="table-cell"][data-column="_actions"]');
        const box = cell.getBoundingClientRect();
        const buttons = [...cell.querySelectorAll('button')];
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            const r = button.getBoundingClientRect();
            expect(r.left).toBeGreaterThanOrEqual(box.left - 0.5);
            expect(r.right).toBeLessThanOrEqual(box.right + 0.5);
        }
        // Two buttons at their drawn size and the padding (final review 5: the drawn size, not always the coarse one).
        expect(box.width).toBeGreaterThanOrEqual(2 * buttons[0]!.getBoundingClientRect().width + 16 - 0.5);
    });

    it('reports a throwing slot callback once and still draws the table and the button (final review)', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable();
        table.use(addon);
        runs[0]!.host.registerCellAction({ id: 'bad', expanded: () => { throw new Error('expanded failed'); }, onClick: () => undefined });
        runs[0]!.host.registerHeaderAction({ id: 'bad-head', expanded: () => { throw new Error('expanded failed'); }, onClick: () => undefined });
        await settle(table);
        table.requestUpdate();
        await settle(table);
        expect(bodyRows(table)).toHaveLength(4);
        const buttons = qa(table, '[data-action-id="bad"]');
        expect(buttons).toHaveLength(4);
        expect(buttons.some((b) => b.hasAttribute('aria-expanded'))).toBe(false);
        expect(headCell(table, 'age').querySelector('[data-action-id="bad-head"]')).not.toBeNull();
        expect(error).toHaveBeenCalledTimes(2); // once per slot
        error.mockRestore();
    });

    it('gives a tree row action its node: depth, leaf, parent and expansion (final review)', async () => {
        const { addon, runs } = probe(uniqueId());
        const data = makeRows(2, { children: 1 });
        const table = await mountTable({ data, enableSubRows: true, subRowDefaultExpanded: true });
        table.use(addon);
        const clicks: RowActionContext<SampleRow>[] = [];
        runs[0]!.host.registerCellAction({ id: 'menu', onClick: (_event, context) => clicks.push(context) });
        await settle(table);
        qa(table, '[data-action-id="menu"]')[1]!.click(); // r0's child
        expect(clicks[0]).toMatchObject({ row: (data[0]!['children'] as SampleRow[])[0], index: 1, depth: 1, isLeaf: true, parentRow: data[0], isExpanded: false });
    });

    it("leaves a consumer's own actions column as it was while no addon registers a row action", async () => {
        const columns = [...(await mountTable()).columns, { accessorKey: '_actions', header: '', cellRenderer: () => 'mine' }];
        const table = await mountTable({ columns });
        expect(qa(table, '[data-slot="table-cell"][data-column="_actions"]').map((c) => c.textContent?.trim())).toEqual(['mine', 'mine', 'mine', 'mine']);
    });

    it('draws a header button in every data column (in the tab order, labelled with the column), and passes the column on click', async () => {
        const { addon, runs } = probe(uniqueId());
        const table = await mountTable({ enableRowSelection: true });
        table.use(addon);
        const clicked: string[] = [];
        runs[0]!.host.registerHeaderAction({ id: 'col', onClick: (_event, column) => clicked.push(String(column.accessorKey)) });
        runs[0]!.host.registerHeaderAction({ id: 'custom', ariaLabel: 'Pivot by {column}', onClick: () => undefined });
        await settle(table);
        expect(headCell(table, '_selection').querySelector('[data-action-id]')).toBeNull();
        const button = headCell(table, 'age').querySelector<HTMLButtonElement>('button[data-action-id="col"]')!;
        expect([button.getAttribute('aria-label'), button.tabIndex]).toEqual(['Column menu for Age', 0]);
        expect(headCell(table, 'name').querySelector('[data-action-id="custom"]')?.getAttribute('aria-label')).toBe('Pivot by Name');
        button.click();
        expect(clicked).toEqual(['age']);
    });
});

describe('the AI methods before package D', () => {
    it('are inert without the ai service: they resolve and change nothing', async () => {
        const table = await mountTable();
        await expect(table.runAiFilter()).resolves.toBeUndefined();
        await expect(table.applyNaturalLanguageFilter('older than 30')).resolves.toBeUndefined();
        await expect(table.aiFillColumn('name', 'uppercase', { rows: 'page' })).resolves.toBeUndefined();
        expect(() => table.cancelAi()).not.toThrow();
        expect(table.globalFilter).toBe('');
        expect(table.data).toBe(SAMPLE_ROWS);
    });
});

describe('stubDownload (browser)', () => {
    it('records an anchor download with its Blob instead of starting one', () => {
        downloads = stubDownload();
        const blob = new Blob(['x']);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'export.csv';
        a.click();
        expect(downloads.downloads).toEqual([{ name: 'export.csv', href: 'blob:stub/1', blob }]);
    });

    it('restores the prototype chain: no own click is left on HTMLAnchorElement.prototype (final review 4)', () => {
        stubDownload().restore();
        expect(Object.hasOwn(HTMLAnchorElement.prototype, 'click')).toBe(ANCHOR_OWN_CLICK); // as before any stub of this file
        expect(HTMLAnchorElement.prototype.click).toBe(HTMLElement.prototype.click);
    });
});
