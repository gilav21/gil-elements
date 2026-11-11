import { describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { mountTable, settle } from './data-table-fixtures.js';
import { resetBadRangeWarning } from './data-table-range.js';

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

    it('is held while range selection and fill are off (the getter says null) and applies when the mode is switched on: either property order', async () => {
        const table = await mountTable();
        table.cellRange = range;
        expect(table.cellRange).toBeNull();
        table.enableCellRangeSelection = true;
        await settle(table);
        expect(table.cellRange).toEqual(range);
        // and switched off again: the range goes with the mode
        table.enableCellRangeSelection = false;
        await settle(table);
        expect(table.cellRange).toBeNull();
        table.enableCellRangeSelection = true;
        await settle(table);
        expect(table.cellRange).toBeNull();

        const other = await mountTable();
        other.enableCellRangeSelection = true;
        other.cellRange = range;
        await settle(other);
        expect(other.cellRange).toEqual(range);
    });

    it('answers the same before the first connect as after it: held, reported only while range mode is on, malformed values refused', () => {
        resetBadRangeWarning();
        const warn = console.warn;
        const warnings: unknown[][] = [];
        console.warn = (...args: unknown[]) => void warnings.push(args);
        try {
            const table = document.createElement('ge-data-table') as GeDataTable;
            table.cellRange = range;
            expect(table.cellRange).toBeNull(); // range mode is off: held, not reported
            table.enableCellRangeSelection = true;
            expect(table.cellRange).toEqual(range); // and applied when the mode is on
            table.cellRange = { startRow: 'x' } as never;
            table.cellRange = 'A1' as never;
            expect(table.cellRange).toEqual(range);
            expect(warnings.filter((args) => String(args[0]).includes('cellRange'))).toHaveLength(1);
            table.enableCellRangeSelection = false;
            expect(table.cellRange).toBeNull();
            table.cellRange = undefined as never;
            table.enableCellRangeSelection = true;
            expect(table.cellRange).toBeNull();
        } finally {
            console.warn = warn;
        }
    });

    const assembled = (table: GeDataTable): boolean => (table as unknown as { built: unknown }).built !== null;

    it('assembles no controller before the first connect: assigning and reading cellRange on a never-connected element builds nothing', () => {
        const table = document.createElement('ge-data-table') as GeDataTable;
        table.enableCellRangeSelection = true;
        table.cellRange = range;
        expect(table.cellRange).toEqual(range);
        expect(assembled(table)).toBe(false);
    });

    it('does not assemble controllers when a range assigned before the upgrade is reclaimed by the constructor, and hands it to the session at the connect', async () => {
        const inert = document.implementation.createHTMLDocument('');
        const early = inert.createElement('ge-data-table') as GeDataTable;
        early.setAttribute('enable-cell-range-selection', '');
        (early as unknown as { cellRange: unknown }).cellRange = range;
        const table = document.adoptNode(early);
        customElements.upgrade(table); // the constructor runs, the element is not connected
        expect(assembled(table)).toBe(false);
        expect(Object.hasOwn(table, 'cellRange')).toBe(false);
        document.body.append(table);
        await settle(table);
        expect(assembled(table)).toBe(true);
        expect(table.provider('range')?.range()).toEqual(range);
        expect(table.cellRange).toEqual(range);
        table.remove();
    });

    it('reads a detached table (connected once before) from the session, not by building anything new', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        table.cellRange = range;
        table.remove();
        const built = (table as unknown as { built: unknown }).built;
        expect(table.cellRange).toEqual(range);
        expect((table as unknown as { built: unknown }).built).toBe(built);
    });

    it('keeps a range assigned before the first connect (range mode on) through the connect', async () => {
        const table = document.createElement('ge-data-table') as GeDataTable;
        table.enableCellRangeSelection = true;
        table.cellRange = range;
        Object.assign(table, { columns: [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'age', header: 'Age' }], data: [{ name: 'a', age: 1 }, { name: 'b', age: 2 }, { name: 'c', age: 3 }] });
        document.body.append(table);
        await settle(table);
        expect(table.cellRange).toEqual(range);
        table.remove();
    });

    it('can be assigned to a detached table without throwing: the checked value waits and is clamped at the next attach', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        const rows = table.data.length;
        table.remove();
        expect(() => {
            table.cellRange = { startRow: 0, startCol: 'name', endRow: rows + 40, endCol: 'age' };
        }).not.toThrow();
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: rows + 40, endCol: 'age' });
        expect(() => {
            table.cellRange = 'junk' as never;
        }).not.toThrow();
        document.body.append(table);
        await settle(table);
        expect(table.cellRange).toEqual({ startRow: 0, startCol: 'name', endRow: rows - 1, endCol: 'age' });
    });

    it('refuses a value that is not a range of this table (warned once) and keeps the old one', async () => {
        resetBadRangeWarning();
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
