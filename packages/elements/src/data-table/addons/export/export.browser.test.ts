/** The export addon on a real `ge-data-table` (spec B.4): what it exports of a filtered, sorted, paged table, the XLSX an XML parser reads, busy and announcements. */
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { readZip } from '../../../file-viewer/parsers/zip-reader.js';
import { bodyRows, makeRows, mountTable, q, settle, stubDownload, type DownloadStub, type SampleRow } from '../../data-table-fixtures.js';
import { parkMouse, withTheme } from '../../data-table-input-fixtures.js';
import type { GeDataTable } from '../../data-table.js';
import './define.js';
import { exportAddon, type ExportApi } from './index.js';

let downloads: DownloadStub;
afterEach(async () => {
    downloads?.restore();
    await parkMouse();
});

const announcer = (table: Element): string => (q(table, '[data-slot="data-table-announcer"]').textContent ?? '').replaceAll('​', '').trim();
const csvOf = async (stub: DownloadStub, i = 0): Promise<string> => new TextDecoder('utf-8', { ignoreBOM: true }).decode(await stub.downloads[i]!.blob!.arrayBuffer());

async function mountWithExport(props: Partial<Record<keyof GeDataTable<SampleRow>, unknown>> = {}): Promise<{ table: GeDataTable<SampleRow>; api: ExportApi<SampleRow> }> {
    const table = await mountTable(props);
    table.use(exportAddon);
    await settle(table);
    return { table, api: table.addon<ExportApi<SampleRow>>('export')! };
}

describe('export addon on a real table', () => {
    it('exports every row that matches the filter, in sort order, not only the page', async () => {
        downloads = stubDownload();
        const { table, api } = await mountWithExport({
            data: makeRows(12),
            globalFilter: 'n1',
            sortState: { column: 'age', direction: 'desc' },
            paginationState: { pageIndex: 0, pageSize: 2 },
        });
        expect(bodyRows(table)).toHaveLength(2);
        await api.exportToCsv('people');
        expect(downloads.downloads.map((d) => d.name)).toEqual(['people.csv']);
        expect(await csvOf(downloads)).toBe('﻿Name,Age\r\nn11,11\r\nn10,10\r\nn1,1');
    });

    it('exports every node of a collapsed, paged tree table, and only the selected children with scope selected (review)', async () => {
        const kids = (from: number, n: number): SampleRow[] => Array.from({ length: n }, (_, i) => ({ id: `c${from + i}`, name: `c${from + i}`, age: from + i }));
        const data = [
            { id: 'p1', name: 'p1', age: 1, children: kids(0, 4) },
            { id: 'p2', name: 'p2', age: 2, children: kids(4, 3) },
            { id: 'p3', name: 'p3', age: 3, children: kids(7, 3) },
        ];
        const { table, api } = await mountWithExport({ data, enableSubRows: true, enableRowSelection: true, paginationState: { pageIndex: 0, pageSize: 2 }, rowSelection: { c1: true, c8: true } });
        expect(bodyRows(table)).toHaveLength(2); // collapsed and paged: two parents drawn
        const names = (await api.toCsv()).split('\r\n').slice(1).map((line) => line.split(',')[0]);
        expect(names).toEqual(['p1', 'c0', 'c1', 'c2', 'c3', 'p2', 'c4', 'c5', 'c6', 'p3', 'c7', 'c8', 'c9']);
        expect(await api.toCsv({ scope: 'selected' })).toBe('Name,Age\r\nc1,1\r\nc8,8');
    });

    it("leaves hidden columns out, and columns: 'all' puts them back", async () => {
        const { api } = await mountWithExport({ columnVisibility: { age: false } });
        expect((await api.toCsv()).split('\r\n')[0]).toBe('Name');
        expect((await api.toCsv({ columns: 'all' })).split('\r\n')[0]).toBe('Name,Age');
    });

    it("exports the rows selected with real checkbox clicks with scope: 'selected'", async () => {
        const { table, api } = await mountWithExport({ enableRowSelection: true });
        const box = (i: number): HTMLElement => bodyRows(table)[i]!.querySelector('ge-checkbox')!;
        await userEvent.click(box(0));
        await userEvent.click(box(2));
        await settle(table);
        expect(await api.toCsv({ scope: 'selected' })).toBe('Name,Age\r\nCarol,41\r\nBob,25');
    });

    it('downloads an XLSX whose every part an XML parser accepts, through the addons attribute', async () => {
        downloads = stubDownload();
        const table = await mountTable({ data: [{ id: 'x', name: 'A & <B> "c"\u0001', age: 3 }] }, { addons: 'export' });
        await table.addon<ExportApi>('export')!.exportToExcel('book', { sheetName: 'Team [1]', typedCells: true });
        expect(downloads.downloads.map((d) => d.name)).toEqual(['book.xlsx']);
        const files = readZip(new Uint8Array(await downloads.downloads[0]!.blob!.arrayBuffer()));
        expect(files.size).toBe(7);
        for (const [path, bytes] of files) {
            const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml');
            expect(doc.getElementsByTagName('parsererror'), path).toHaveLength(0);
        }
        const sheet = new TextDecoder().decode(files.get('xl/worksheets/sheet1.xml'));
        expect(sheet).toContain('<c r="B2" t="n"><v>3</v></c>');
    });

    it('shows the busy overlay while a slow provider runs, clears it after, and announces the result', async () => {
        downloads = stubDownload();
        let release!: (rows: SampleRow[]) => void;
        const table = await mountTable();
        table.use(exportAddon, { provider: () => new Promise<SampleRow[]>((resolve) => (release = resolve)) });
        await settle(table);
        const pending = table.addon<ExportApi<SampleRow>>('export')!.exportToCsv();
        await settle(table);
        const busy = q(table, '[data-slot="data-table-loader"][data-kind="busy"]');
        expect(busy.textContent).toContain('Exporting…');
        release([{ id: 'p', name: 'Provided', age: 1 }]);
        await pending;
        await settle(table);
        expect(table.querySelector('[data-kind="busy"]')).toBeNull();
        expect(announcer(table)).toBe('Export complete');
        expect(await csvOf(downloads)).toBe('﻿Name,Age\r\nProvided,1');
    });

    // The theme is set before the mount: switched under a drawn table, colours still transitioning give axe false contrast reads.
    it.each(['light', 'dark'])('passes axe with the busy overlay up (%s)', async (mode) => {
        withTheme(mode);
        try {
            const table = await mountTable();
            table.use(exportAddon, { provider: () => new Promise<SampleRow[]>(() => undefined) });
            void table.addon<ExportApi>('export')!.exportToCsv();
            await settle(table);
            expect(table.querySelector('[data-kind="busy"]')).not.toBeNull();
            const result = await axe.run(table);
            expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
        } finally {
            withTheme('light');
        }
    });

    it('fires export-complete on the table, and its API goes away when the table is removed', async () => {
        downloads = stubDownload();
        const { table, api } = await mountWithExport();
        const seen: unknown[] = [];
        document.addEventListener('export-complete', (e) => seen.push((e as CustomEvent).detail), { once: true });
        await api.exportToExcel();
        expect(seen).toEqual([{ format: 'xlsx', filename: 'export.xlsx', rows: 4, bytes: downloads.downloads[0]!.blob!.size }]);
        table.remove();
        expect(table.addon('export')).toBeUndefined();
    });
});
