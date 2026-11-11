import { describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { mountTable, settle } from './data-table-fixtures.js';

const range = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };

describe('the cellRange property', () => {
    it('reads the range while the table is detached, and gives it back when it is attached again', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
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
        early.setAttribute('enable-cell-range-selection', '');
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

    it('is ignored while range selection and fill are off: nothing is held, the getter says null', async () => {
        const table = await mountTable();
        table.cellRange = range;
        expect(table.cellRange).toBeNull();
        table.enableCellRangeSelection = true;
        await settle(table);
        expect(table.cellRange).toBeNull();
    });

    it('refuses a value that is not a range of this table (warned once) and keeps the old one', async () => {
        const warn = console.warn;
        const warnings: unknown[][] = [];
        console.warn = (...args: unknown[]) => void warnings.push(args);
        try {
            const table = await mountTable({ enableCellRangeSelection: true });
            table.cellRange = range;
            table.cellRange = { startRow: 0, startCol: 'nope', endRow: 1, endCol: 'age' };
            table.cellRange = 'A1:B2' as never;
            expect(table.cellRange).toEqual(range);
            expect(warnings.filter((args) => String(args[0]).includes('cellRange'))).toHaveLength(1);
            table.cellRange = undefined as never;
            expect(table.cellRange).toBeNull();
        } finally {
            console.warn = warn;
        }
    });
});

describe('the read-only state accessors', () => {
    it('ignore an assignment (a framework property binding) instead of throwing, with one warning, and keep reading the service', async () => {
        const warn = console.warn;
        const warnings: string[] = [];
        console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));
        try {
            const table = await mountTable();
            expect(() => {
                (table as unknown as { editingCell: unknown }).editingCell = { rowIndex: 0, columnKey: 'name' };
                (table as unknown as { cellEditError: unknown }).cellEditError = { message: 'x' };
            }).not.toThrow();
            expect(table.editingCell).toBeNull();
            expect(table.cellEditError).toBeNull();
            // The warning is once per name for the whole page, so a test cannot see whether it was the first: it is at most one each.
            expect(warnings.filter((m) => m.includes('editingCell')).length).toBeLessThanOrEqual(1);
            expect(warnings.filter((m) => m.includes('cellEditError')).length).toBeLessThanOrEqual(1);
        } finally {
            console.warn = warn;
        }
    });

    it('drop a value assigned before the upgrade, so it does not shadow the getter', async () => {
        const inert = document.implementation.createHTMLDocument('');
        const early = inert.createElement('ge-data-table') as GeDataTable;
        (early as unknown as { editingCell: unknown }).editingCell = { rowIndex: 3, columnKey: 'age' };
        (early as unknown as { cellEditError: unknown }).cellEditError = { message: 'x' };
        const table = document.adoptNode(early);
        document.body.append(table);
        await settle(table);
        expect(Object.hasOwn(table, 'editingCell')).toBe(false);
        expect(Object.hasOwn(table, 'cellEditError')).toBe(false);
        expect(table.editingCell).toBeNull();
        expect(table.cellEditError).toBeNull();
        table.remove();
    });
});
