import { describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { mountTable, settle } from './data-table-fixtures.js';

const range = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };

describe('the cellRange property', () => {
    it('reads the range while the table is detached, and gives it back when it is attached again', async () => {
        const table = await mountTable();
        table.cellRange = range;
        expect(table.cellRange).toEqual(range);
        table.remove();
        expect(table.cellRange).toEqual(range);
        document.body.append(table);
        await settle(table);
        expect(table.cellRange).toEqual(range);
    });

    it('takes a range assigned before the element was upgraded, through the setter and not as an own property', async () => {
        const inert = document.implementation.createHTMLDocument('');
        const early = inert.createElement('ge-data-table') as GeDataTable;
        (early as unknown as { cellRange: unknown }).cellRange = range;
        expect(Object.hasOwn(early, 'cellRange')).toBe(true);
        const table = document.adoptNode(early);
        document.body.append(table);
        await settle(table);
        expect(Object.hasOwn(table, 'cellRange')).toBe(false);
        expect(table.cellRange).toEqual(range);
        expect(table.provider('range')?.range()).toEqual(range);
        table.cellRange = null;
        expect(table.cellRange).toBeNull();
        table.remove();
    });
});
