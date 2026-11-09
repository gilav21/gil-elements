import { describe, expect, it } from 'vitest';
import { cellText, footerValues, hasFooterRow, positionPercent, resolveCellFormatting, sortAriaLabel, styleText } from './data-table-cells.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import type { ColumnDef } from './data-table.types.js';

interface Row {
    n: number | string;
    name: string;
}
const col = (extra: Partial<ColumnDef<Row>> = {}): ColumnDef<Row> => ({ accessorKey: 'n', header: 'N', ...extra });
const en = DATA_TABLE_LOCALES.en;

describe('resolveCellFormatting', () => {
    it('is null for a column that declares none', () => {
        expect(resolveCellFormatting(col(), { n: 1, name: 'a' })).toBeNull();
    });

    it('joins the classes of the rules that match, and merges style rules with the colour scale', () => {
        const column = col({
            cellClassRules: [{ when: (v) => (v as number) > 5, class: 'big' }, { when: () => true, class: 'any' }, { when: () => false, class: 'never' }],
            cellStyleRules: () => ({ color: 'red' }),
            colorScale: { min: 0, max: 10, from: 'white', to: 'blue' },
        });
        const fmt = resolveCellFormatting(column, { n: 5, name: 'a' });
        expect(fmt?.class).toBe('any');
        expect(fmt?.style).toEqual({ color: 'red', 'background-color': 'color-mix(in srgb, blue 50%, white)' });
        expect(resolveCellFormatting(column, { n: 9, name: 'a' })?.class).toBe('big any');
    });

    it('sizes a data bar by position, clamps it, and draws none for a non-number', () => {
        const column = col({ dataBar: { min: 0, max: 200, color: 'green', track: 'grey' } });
        expect(resolveCellFormatting(column, { n: 50, name: '' })?.dataBar).toEqual({ width: '25%', color: 'green', track: 'grey' });
        expect(resolveCellFormatting(column, { n: 999, name: '' })?.dataBar?.width).toBe('100%');
        expect(resolveCellFormatting(column, { n: 'x', name: '' })?.dataBar).toBeNull();
        expect(positionPercent(3, 5, 5)).toBe(0);
    });

    it('asks the icon set for an icon', () => {
        const fmt = resolveCellFormatting(col({ iconSet: (v) => ((v as number) > 0 ? { name: 'check' } : undefined) }), { n: 1, name: '' });
        expect(fmt?.icon).toEqual({ name: 'check' });
    });
});

describe('text and style helpers', () => {
    it('prefers the column formatter, else stringifies the raw value (null as empty)', () => {
        expect(cellText(col({ cell: (r) => `#${r.n}` }), { n: 1, name: '' })).toBe('#1');
        expect(cellText(col(), { n: 7, name: '' })).toBe('7');
        expect(cellText(col({ accessorKey: 'missing' }), { n: 7, name: '' })).toBe('');
    });

    it('writes a style object as an inline style', () => {
        expect(styleText({ color: 'red', '--x': '1' })).toBe('color:red;--x:1');
        expect(styleText({})).toBe('');
    });
});

describe('footer', () => {
    it('draws when forced, or in auto mode when a column has a footer or an aggregate', () => {
        expect(hasFooterRow(true, [])).toBe(true);
        expect(hasFooterRow(false, [col({ footer: 'x' })])).toBe(false);
        expect(hasFooterRow('auto', [col()])).toBe(false);
        expect(hasFooterRow('auto', [col({ aggregateFn: 'sum' })])).toBe(true);
    });

    it('takes a footer text or function, else the aggregate over the rows', () => {
        const rows: Row[] = [{ n: 1, name: 'a' }, { n: 2, name: 'b' }];
        const values = footerValues([col({ aggregateFn: 'sum' }), col({ accessorKey: 'name', footer: (r) => `${r.length} rows` }), col({ accessorKey: 'z' })], rows);
        expect(Object.fromEntries(values)).toEqual({ n: '3', name: '2 rows' });
    });
});

describe('sortAriaLabel', () => {
    it('describes the state and what activating does, with the multi-sort priority', () => {
        expect(sortAriaLabel('Age', null, null, en)).toBe('Age, not sorted. Activate to sort ascending.');
        expect(sortAriaLabel('Age', 'asc', 1, en)).toBe('Age, sorted ascending, sort priority 2. Activate to sort descending.');
        expect(sortAriaLabel('Age', 'desc', null, en)).toBe('Age, sorted descending. Activate to remove sort.');
    });
});
