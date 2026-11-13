/** The export addon against a fake host (no DOM): the Angular export spec's cases plus the wave 7 additions (spec B.4). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readZip } from '../../../file-viewer/parsers/zip-reader.js';
import { stubDownload, type DownloadStub } from '../../data-table-addon-fixtures.js';
import type { DataTableAddonHost } from '../../data-table-addon-kit.js';
import type { QueryService, SelectionService } from '../../data-table-providers.js';
import type { ColumnDef, DataTableExportOptions, DataTableExportQuery } from '../../data-table.types.js';
import { EXPORT_CHUNK_ROWS, exportAddon, exportFilename, REVOKE_DELAY_MS, typedCell, type ExportApi, type ExportOptions } from './export.js';
import type { ExportLocale } from './export-locale.js';

interface Row {
    id: string;
    name: string;
    score: number | string;
    when?: unknown;
}

const COLUMNS: ColumnDef<Row>[] = [
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'score', header: 'Score' },
];
const HIDDEN: ColumnDef<Row> = { accessorKey: 'when', header: 'When' };
const QUERY: DataTableExportQuery = { globalFilter: 'Alice', columnFilters: { name: 'Bob' }, sort: { column: 'score', direction: 'desc' }, sortStates: [] };

/** A query service that draws `COLUMNS` (plus the hidden column with `onlyVisible: false`) the way the core does: `cell()` or the stringified value. */
function fakeQuery(state: { sorted: Row[]; raw: Row[]; page: Row[]; columns: ColumnDef<Row>[] }) {
    const calls: { options: DataTableExportOptions; rows: number }[] = [];
    const exportColumns = (options: DataTableExportOptions = {}) => (options.onlyVisible === false ? [...state.columns, HIDDEN] : state.columns);
    const value = (row: Row, key: string | keyof Row): unknown => (row as unknown as Record<string, unknown>)[String(key)];
    const query = {
        sortedData: () => state.sorted,
        rawRows: () => state.raw,
        renderedRows: () => state.page,
        rowId: (row: Row) => row.id,
        exportQuery: () => QUERY,
        cellValue: value,
        exportColumns,
        exportData: (options: DataTableExportOptions = {}, rows?: readonly Row[]) => {
            const columns = exportColumns(options);
            calls.push({ options, rows: rows?.length ?? -1 });
            const body = (rows ?? state.sorted).map((row) => columns.map((c) => (c.cell ? c.cell(row) : String(value(row, c.accessorKey) ?? ''))));
            return options.includeHeaders === false ? body : [columns.map((c) => c.header), ...body];
        },
    };
    return { query: query as unknown as QueryService<Row>, calls };
}

interface Setup {
    api: ExportApi<Row>;
    busy: (string | null)[];
    announced: string[];
    events: [string, unknown][];
    calls: { options: DataTableExportOptions; rows: number }[];
    state: { sorted: Row[]; raw: Row[]; page: Row[]; columns: ColumnDef<Row>[] };
    selected: Set<string>;
    teardown: () => void;
}

function setup(options?: ExportOptions<Row> | false, localeCode = 'en'): Setup {
    const rows: Row[] = [{ id: '1', name: 'Alice', score: 30 }];
    const state = { sorted: rows, raw: rows, page: rows, columns: COLUMNS };
    const { query, calls } = fakeQuery(state);
    const selected = new Set<string>();
    const selection = { isSelected: (id: string) => selected.has(id) } as unknown as SelectionService<Row>;
    const busy: (string | null)[] = [];
    const announced: string[] = [];
    const events: [string, unknown][] = [];
    let api: ExportApi<Row> | undefined;
    const host = {
        root: {} as HTMLElement,
        resolvedLocale: { code: localeCode },
        emit: (name: string, detail: unknown) => events.push([name, detail]),
        announce: (message: string) => announced.push(message),
        setBusy: (label: string | null) => busy.push(label),
        expose: (a: object) => (api = a as ExportApi<Row>),
        provider: (key: string) => (key === 'query' ? query : key === 'selection' ? selection : undefined),
    } as unknown as DataTableAddonHost<Row>;
    const teardown = (exportAddon.setup(host as DataTableAddonHost, options) ?? (() => undefined)) as () => void;
    return { api: api as ExportApi<Row>, busy, announced, events, calls, state, selected, teardown };
}

/** A minimal `document` whose anchors record their click into the download stub's list (the stub patches `HTMLAnchorElement` only where it exists). */
function fakeDocument(stub: DownloadStub) {
    const body: { removed: boolean }[] = [];
    const doc = {
        body: { append: (a: { removed: boolean }) => body.push(a) },
        createElement: () => {
            const a = {
                href: '',
                download: '',
                style: {} as Record<string, string>,
                removed: false,
                click() {
                    stub.downloads.push({ name: a.download, href: a.href, blob: undefined });
                },
                remove() {
                    a.removed = true;
                },
            };
            return a;
        },
    };
    return { doc, body };
}

let stub: DownloadStub;
let blobs: Blob[];
let anchors: { removed: boolean }[];

beforeEach(() => {
    stub = stubDownload();
    blobs = [];
    const create = URL.createObjectURL;
    URL.createObjectURL = (object: Blob | MediaSource) => (blobs.push(object as Blob), create(object));
    const { doc, body } = fakeDocument(stub);
    anchors = body;
    vi.stubGlobal('document', doc);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    stub.restore();
});

const text = async (blob: Blob | undefined): Promise<string> => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await (blob as Blob).arrayBuffer());
const sheetXml = (bytes: Uint8Array): string => new TextDecoder().decode(readZip(bytes).get('xl/worksheets/sheet1.xml'));

describe('export addon: Angular parity', () => {
    it('exportToCsv downloads a BOM-prefixed CSV that quotes commas, quotes and newlines (Angular spec 208)', async () => {
        const t = setup();
        t.state.sorted = [
            { id: '1', name: 'Smith, John', score: 1 },
            { id: '2', name: 'She said "hi"', score: 2 },
            { id: '3', name: '12 Main St\nSpringfield', score: 3 },
            { id: '4', name: 'Plain', score: 4 },
        ];
        await t.api.exportToCsv('myfile');
        expect(stub.downloads.map((d) => d.name)).toEqual(['myfile.csv']);
        expect(blobs[0]?.type).toBe('text/csv;charset=utf-8;');
        expect(await text(blobs[0])).toBe('﻿ID,Name,Score\r\n1,"Smith, John",1\r\n2,"She said ""hi""",2\r\n3,"12 Main St\nSpringfield",3\r\n4,Plain,4');
        expect(t.busy.at(-1)).toBeNull();
    });

    it('quotes cells a spreadsheet would run as formulas, but keeps plain numbers numeric (Angular spec 229)', async () => {
        const t = setup();
        t.state.sorted = [
            { id: '1', name: '=HYPERLINK("http://evil.example","click")', score: -12 },
            { id: '2', name: '@SUM(A1:A2)', score: 3 },
            { id: '3', name: '+cmd', score: 4 },
            { id: '4', name: '\tindented', score: 5 },
            { id: '-5', name: "'=already quoted", score: 6 },
        ];
        await t.api.exportToCsv();
        expect(await text(blobs[0])).toBe(
            '﻿ID,Name,Score\r\n' +
                '1,"\'=HYPERLINK(""http://evil.example"",""click"")",-12\r\n' +
                "2,'@SUM(A1:A2),3\r\n" +
                "3,'+cmd,4\r\n" +
                "4,'\tindented,5\r\n" +
                "-5,''=already quoted,6",
        );
        expect(stub.downloads[0]?.name).toBe('export.csv');
    });

    it('shows the localised busy label during export, then clears it (Angular spec 252)', async () => {
        const t = setup();
        await t.api.exportToCsv();
        expect(t.busy).toEqual(['Exporting…', null]);
    });

    it('exports the provider rows instead of the table rows, handing it the query (Angular spec 260)', async () => {
        const provider = vi.fn(async (_query: DataTableExportQuery) => [{ id: '99', name: 'Provided', score: 0 }]);
        const t = setup({ provider });
        await t.api.exportToCsv();
        expect(provider).toHaveBeenCalledWith(QUERY);
        const csv = await text(blobs[0]);
        expect(csv).toBe('﻿ID,Name,Score\r\n99,Provided,0');
        expect(csv).not.toContain('Alice');
    });

    it('forwards the query to a server-side provider on Excel export (Angular spec 279), and a per-call provider wins', async () => {
        const fromOptions = vi.fn(async () => []);
        const perCall = vi.fn(async () => []);
        const t = setup({ provider: fromOptions });
        await t.api.exportToExcel('server-all', { provider: perCall });
        expect(perCall).toHaveBeenCalledTimes(1);
        expect(perCall.mock.calls[0]).toEqual([QUERY]);
        expect(fromOptions).not.toHaveBeenCalled();
    });

    it('exportToExcel downloads an .xlsx zip and clears busy (Angular spec 305)', async () => {
        const t = setup();
        await t.api.exportToExcel('sheet');
        expect(stub.downloads.map((d) => d.name)).toEqual(['sheet.xlsx']);
        expect(blobs[0]?.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const bytes = new Uint8Array(await (blobs[0] as Blob).arrayBuffer());
        expect(String.fromCodePoint(bytes[0] as number, bytes[1] as number)).toBe('PK');
        expect(sheetXml(bytes)).toContain('<c r="A1" t="s" s="1">');
        expect(t.busy).toEqual(['Exporting…', null]);
    });

    it('takes the rows as the second argument, as Angular customData', async () => {
        const t = setup();
        await t.api.exportToCsv('x', [{ id: '7', name: 'Given', score: 1 }]);
        expect(await text(blobs[0])).toBe('﻿ID,Name,Score\r\n7,Given,1');
    });
});

describe('export addon: rows, columns and data', () => {
    const A: Row = { id: 'a', name: 'A', score: 1 };
    const B: Row = { id: 'b', name: 'B', score: 2 };
    const C: Row = { id: 'c', name: 'C', score: 3 };

    it('picks the rows by scope: filtered (default), all, selected (in filtered order, hidden selected rows left out), page', async () => {
        const t = setup();
        Object.assign(t.state, { sorted: [C, A], raw: [A, B, C], page: [C] });
        t.selected.add('a').add('b').add('c');
        expect(await t.api.toCsv()).toBe('ID,Name,Score\r\nc,C,3\r\na,A,1');
        expect(await t.api.toCsv({ scope: 'all' })).toBe('ID,Name,Score\r\na,A,1\r\nb,B,2\r\nc,C,3');
        t.selected.delete('c');
        expect(await t.api.toCsv({ scope: 'selected' })).toBe('ID,Name,Score\r\na,A,1');
        expect(await t.api.toCsv({ scope: 'page' })).toBe('ID,Name,Score\r\nc,C,3');
    });

    it("includes hidden columns with columns: 'all' and leaves the header out with includeHeaders: false", async () => {
        const t = setup();
        t.state.sorted = [{ ...A, when: 'x' }];
        expect(await t.api.toCsv({ columns: 'all' })).toBe('ID,Name,Score,When\r\na,A,1,x');
        expect(await t.api.toCsv({ includeHeaders: false })).toBe('a,A,1');
    });

    it('builds the grid in chunks of rows, yielding between them', async () => {
        const t = setup();
        t.state.sorted = Array.from({ length: EXPORT_CHUNK_ROWS * 2 + 1 }, (_, i) => ({ id: `r${i}`, name: 'n', score: i }));
        const csv = await t.api.toCsv();
        expect(csv.split('\r\n')).toHaveLength(EXPORT_CHUNK_ROWS * 2 + 2);
        expect(t.calls.map((c) => c.rows)).toEqual([0, EXPORT_CHUNK_ROWS, EXPORT_CHUNK_ROWS, 1]);
    });

    it('toCsv returns the text without the BOM, toXlsx the workbook bytes, neither downloads', async () => {
        const t = setup();
        expect(await t.api.toCsv()).toBe('ID,Name,Score\r\n1,Alice,30');
        const bytes = await t.api.toXlsx({ sheetName: 'People' });
        expect(new TextDecoder().decode(readZip(bytes).get('xl/workbook.xml'))).toContain('name="People"');
        expect(stub.downloads).toEqual([]);
        expect(t.busy).toEqual(['Exporting…', null, 'Exporting…', null]);
    });

    it('writes typed cells for columns without cell() only with typedCells, ISO date strings as dates', async () => {
        const t = setup();
        t.state.columns = [...COLUMNS, { accessorKey: 'when', header: 'When' }, { accessorKey: 'score', header: 'Formatted', cell: (r) => `#${r.score}` }];
        t.state.sorted = [{ id: '007', name: 'N', score: 12.5, when: '2024-02-29' }];
        const typed = sheetXml(await t.api.toXlsx({ typedCells: true }));
        expect(typed).toContain('<c r="A2" t="s">'); // '007' stays text
        expect(typed).toContain('<c r="C2" t="n"><v>12.5</v></c>');
        expect(typed).toContain('<c r="D2" s="2"><v>45351</v></c>');
        expect(typed).toContain('<c r="E2" t="s">'); // a cell() column stays its text
        const plain = sheetXml(await t.api.toXlsx());
        expect(plain).toContain('<c r="C2" t="s">');
        expect(plain).not.toContain('t="n"');
    });

    it('typedCell keeps finite numbers, booleans, valid dates and ISO date strings, and nothing else', () => {
        expect(typedCell(3)).toBe(3);
        expect(typedCell(Number.NaN)).toBeUndefined();
        expect(typedCell(false)).toBe(false);
        expect(typedCell(new Date(Number.NaN))).toBeUndefined();
        expect(typedCell('2024-02-30')).toBeUndefined();
        expect((typedCell('2024-02-29') as Date).getDate()).toBe(29);
        expect(typedCell('2024-02-29T10:00:00Z')).toBeInstanceOf(Date);
        expect(typedCell('12')).toBeUndefined();
        expect(typedCell(null)).toBeUndefined();
    });

    it('bolds no row without a header, and none with boldHeader: false', async () => {
        const t = setup();
        expect(sheetXml(await t.api.toXlsx({ includeHeaders: false }))).not.toContain('s="1"');
        expect(sheetXml(await t.api.toXlsx({ boldHeader: false }))).not.toContain('s="1"');
    });
});

describe('export addon: download, signals and lifecycle', () => {
    it('makes predictable file names', () => {
        expect(exportFilename(undefined, 'csv')).toBe('export.csv');
        expect(exportFilename('  ', 'xlsx')).toBe('export.xlsx');
        expect(exportFilename('report.CSV', 'csv')).toBe('report.CSV');
        expect(exportFilename('a/b\\c:d*e?f"g<h>i|j\u0001k', 'csv')).toBe('a_b_c_d_e_f_g_h_i_j_k.csv');
        expect(exportFilename('report.csv', 'xlsx')).toBe('report.csv.xlsx');
    });

    it('uses the option filename when a call gives none', async () => {
        const t = setup({ filename: 'people' });
        await t.api.exportToCsv();
        expect(stub.downloads[0]?.name).toBe('people.csv');
    });

    it('revokes the object URL and removes the anchor only after a delay (Angular revokes at once, B1)', async () => {
        vi.useFakeTimers();
        const t = setup();
        await t.api.exportToCsv();
        expect(stub.downloads).toHaveLength(1);
        expect(stub.revoked).toEqual([]);
        expect(anchors[0]?.removed).toBe(false);
        vi.advanceTimersByTime(REVOKE_DELAY_MS);
        expect(stub.revoked).toEqual([stub.created[0]]);
        expect(anchors[0]?.removed).toBe(true);
    });

    it('announces success and emits export-complete with format, file name, rows and bytes', async () => {
        const t = setup();
        await t.api.exportToCsv('f');
        expect(t.announced).toEqual(['Export complete']);
        expect(t.events).toEqual([['export-complete', { format: 'csv', filename: 'f.csv', rows: 1, bytes: blobs[0]?.size }]]);
    });

    it('on a provider rejection emits export-error, announces the failure, clears busy and rejects', async () => {
        const error = new Error('server down');
        const t = setup({ provider: () => Promise.reject(error) });
        await expect(t.api.exportToExcel()).rejects.toBe(error);
        expect(t.events).toEqual([['export-error', { format: 'xlsx', error }]]);
        expect(t.announced).toEqual(['Export failed']);
        expect(t.busy).toEqual(['Exporting…', null]);
        expect(stub.downloads).toEqual([]);
    });

    it('returns the running promise for a second call of the same method, and downloads once', async () => {
        let release!: (rows: Row[]) => void;
        const t = setup({ provider: () => new Promise<Row[]>((resolve) => (release = resolve)) });
        const first = t.api.exportToCsv();
        const second = t.api.exportToCsv();
        expect(second).toBe(first);
        release([]);
        await first;
        expect(stub.downloads).toHaveLength(1);
        await t.api.exportToCsv('again', { rows: [] }); // a later call runs again
        expect(stub.downloads).toHaveLength(2);
    });

    it('keeps the busy overlay until the last of two concurrent exports ends', async () => {
        let release!: (rows: Row[]) => void;
        const t = setup();
        const slow = t.api.exportToCsv('slow', { provider: () => new Promise<Row[]>((resolve) => (release = resolve)) });
        await t.api.exportToExcel('fast');
        expect(t.busy).toEqual(['Exporting…']);
        release([]);
        await slow;
        expect(t.busy).toEqual(['Exporting…', null]);
    });

    it('an aborted signal clears busy, downloads nothing, rejects with its reason, and reports no error', async () => {
        const t = setup();
        const controller = new AbortController();
        const pending = t.api.exportToCsv('x', { signal: controller.signal, provider: async () => (controller.abort('stop'), []) });
        await expect(pending).rejects.toBe('stop');
        expect(stub.downloads).toEqual([]);
        expect(t.busy).toEqual(['Exporting…', null]);
        expect(t.events).toEqual([]);
        expect(t.announced).toEqual([]);
        await expect(t.api.toCsv({ signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('downloads nothing for an empty grid (no header, no row) and says so', async () => {
        const t = setup();
        t.state.sorted = [];
        await t.api.exportToCsv('x', { includeHeaders: false });
        expect(stub.downloads).toEqual([]);
        expect(t.announced).toEqual(['Nothing to export']);
        await t.api.exportToExcel('y'); // header only: a file with one row
        expect(stub.downloads.map((d) => d.name)).toEqual(['y.xlsx']);
    });

    it('an export running at teardown downloads nothing and rejects', async () => {
        let release!: (rows: Row[]) => void;
        const t = setup({ provider: () => new Promise<Row[]>((resolve) => (release = resolve)) });
        const pending = t.api.exportToCsv();
        t.teardown();
        release([]);
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        expect(stub.downloads).toEqual([]);
        expect(t.events).toEqual([]);
    });

    it('does nothing when switched off, and reads its strings from a locale option or the table locale (en fallback)', async () => {
        const off = setup(false);
        expect(off.api).toBeUndefined();
        const custom: ExportLocale = { exporting: 'Busy', exportDone: 'Done', exportFailed: 'Failed', exportEmpty: 'Empty' };
        const t = setup({ locale: custom });
        await t.api.exportToCsv();
        expect(t.busy[0]).toBe('Busy');
        expect(t.announced).toEqual(['Done']);
        const fallback = setup(undefined, 'xx-YY');
        await fallback.api.exportToCsv();
        expect(fallback.busy[0]).toBe('Exporting…');
    });
});
