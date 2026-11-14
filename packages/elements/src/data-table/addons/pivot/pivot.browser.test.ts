/** The pivot addon on real tables (spec C): one table pivots its raw data, a second one renders the result; the API goes with the addon. */
import { afterEach, describe, expect, it } from 'vitest';
import { bodyRows, mountTable, qa, settle } from '../../data-table-fixtures.js';
import { parkMouse } from '../../data-table-input-fixtures.js';
import type { ColumnDef } from '../../data-table.types.js';
import './define.js';
import { pivotAddon, pivotToColumns, type PivotApi } from './index.js';

afterEach(parkMouse);

interface Sale {
    id: string;
    region: string;
    product: string;
    sales: number;
    detail: { units: number };
}

const SALES: Sale[] = [
    { id: '1', region: 'NA', product: 'A', sales: 100, detail: { units: 1 } },
    { id: '2', region: 'NA', product: 'B', sales: 50, detail: { units: 2 } },
    { id: '3', region: 'EU', product: 'A', sales: 80, detail: { units: 3 } },
    { id: '4', region: 'NA', product: 'A', sales: 20, detail: { units: 4 } },
];
const COLUMNS: ColumnDef<Sale>[] = [
    { accessorKey: 'region', header: 'Region' },
    { accessorKey: 'product', header: 'Product' },
    { accessorKey: 'sales', header: 'Sales' },
    { accessorKey: 'units', header: 'Units', accessorFn: (row) => row.detail.units },
];

/** The text an element shows, its descendants' shadow roots included (the header text sits in `ge-data-table-column-header`'s). */
function shown(node: Node): string {
    const own = node instanceof Element && node.shadowRoot ? shown(node.shadowRoot) : '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    return own + [...node.childNodes].map(shown).join('');
}
const texts = (els: Element[]): string[] => els.map((el) => shown(el).replace(/\s+/g, ' ').trim());

describe('pivot addon on a real table', () => {
    it('pivots the raw data (filters ignored) and a second table renders the result with totals', async () => {
        const source = await mountTable<Sale>({ columns: COLUMNS, data: SALES, globalFilter: 'EU' });
        source.use(pivotAddon);
        await settle(source);
        const result = source.addon<PivotApi<Sale>>('pivot')!.getPivot({ rows: ['region'], column: 'product', value: 'sales', aggregate: 'sum', showRowTotals: true });
        const target = await mountTable<Record<string, unknown>>({ columns: pivotToColumns(result), data: result.rows, getRowId: (row: Record<string, unknown>) => String(row['region']) });
        await settle(target);
        expect(texts(qa(target, '[role="columnheader"]'))).toEqual(['region', 'A', 'B', 'Total']);
        expect(bodyRows(target).map((row) => texts(qa(row, '[role="gridcell"], [role="cell"]')))).toEqual([
            ['NA', '120', '50', '170'],
            ['EU', '80', '0', '80'],
        ]);
    });

    it('reads values through the column accessors and pivots given rows', async () => {
        const source = await mountTable<Sale>({ columns: COLUMNS, data: SALES }, { addons: 'pivot' });
        const api = source.addon<PivotApi<Sale>>('pivot')!;
        const units = api.getPivot({ rows: ['region'], column: 'product', value: 'units', aggregate: 'sum' });
        expect(units.rows[0]).toMatchObject({ region: 'NA', 'pivot:A': 5, 'pivot:B': 2 });
        const some = api.getPivot({ rows: ['region'], column: 'product', value: 'sales', aggregate: 'count' }, SALES.slice(0, 1));
        expect(some.rows).toEqual([{ region: 'NA', 'pivot:A': 1 }]);
    });

    it('pivots every node of a tree table, children included (final review)', async () => {
        type Node = Sale & { children?: Sale[] };
        const kids = (region: string, from: number): Sale[] =>
            Array.from({ length: 10 }, (_, i) => ({ id: `${region}${i}`, region, product: 'A', sales: from + i, detail: { units: 1 } }));
        const data: Node[] = [
            { id: 'na', region: 'NA', product: 'A', sales: 1000, detail: { units: 1 }, children: kids('NA', 1) },
            { id: 'eu', region: 'EU', product: 'A', sales: 2000, detail: { units: 1 }, children: kids('EU', 100) },
        ];
        const source = await mountTable<Node>({ columns: COLUMNS, data, enableSubRows: true }, { addons: 'pivot' });
        const result = source.addon<PivotApi<Node>>('pivot')!.getPivot({ rows: ['region'], column: 'product', value: 'sales', aggregate: 'sum' });
        expect(result.rows).toEqual([
            { region: 'NA', 'pivot:A': 1000 + 55 },
            { region: 'EU', 'pivot:A': 2000 + 1045 },
        ]);
    });

    it('tears down with the table: the API is gone', async () => {
        const source = await mountTable<Sale>({ columns: COLUMNS, data: SALES });
        source.use(pivotAddon);
        expect(source.addon('pivot')).toBeDefined();
        source.remove();
        expect(source.addon('pivot')).toBeUndefined();
    });
});
