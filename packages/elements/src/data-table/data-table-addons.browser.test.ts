/** Wave 7 step 0: the addon host on a real table (use, the `addons` attribute, addonOptions, expose, emit, announce, the services, the action buttons) and the inert AI methods. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DataTableAddon, DataTableAddonHost } from './data-table-addon-kit.js';
import { registerDataTableAddon } from './data-table-addon-registry.js';
import type { GeDataTable } from './data-table.js';
import { bodyRows, headCell, mountTable, q, qa, SAMPLE_COLUMNS, SAMPLE_ROWS, settle, stubDownload, trackTable, type DownloadStub, type SampleRow } from './data-table-fixtures.js';
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

let id = 0;
const uniqueId = (): string => `step0-probe-${++id}`;
const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replace('​', '');

let downloads: DownloadStub | undefined;
afterEach(() => {
    downloads?.restore();
    downloads = undefined;
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
        expect(() => host.requestRender()).not.toThrow();
        expect(table.isUpdatePending).toBe(false);
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
});
