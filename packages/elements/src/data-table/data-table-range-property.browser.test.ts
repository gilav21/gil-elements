import { describe, expect, it } from 'vitest';
import type { GeDataTable } from './data-table.js';
import { mountTable, SAMPLE_COLUMNS, SAMPLE_ROWS, settle } from './data-table-fixtures.js';
import { resetBadRangeWarning } from './data-table-range.js';
import { registerDataTableLocale } from './data-table.locales.js';

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
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS }); // rows: an emptied data set ends the range
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

    it('reads back the very object that was assigned, and an equal re-assignment asks for no render', async () => {
        const table = await mountTable();
        table.enableCellRangeSelection = true;
        await settle(table);
        const mine = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };
        table.cellRange = mine;
        expect(table.cellRange).toBe(mine);
        await settle(table);
        let renders = 0;
        const requestUpdate = table.requestUpdate.bind(table);
        table.requestUpdate = ((...args: Parameters<typeof requestUpdate>) => {
            renders++;
            return requestUpdate(...args);
        }) as typeof table.requestUpdate;
        table.cellRange = { ...mine }; // equal field by field
        expect(renders).toBe(0);
        table.cellRange = { ...mine, endRow: 2 }; // a different range does render
        expect(renders).toBeGreaterThan(0);
        table.requestUpdate = requestUpdate;
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
        Object.assign(table, { columns: SAMPLE_COLUMNS, data: SAMPLE_ROWS });
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

    it('survives `cellRange = r; columns = [...]` and `columns = [...]; cellRange = r` in one tick (the columns are looked up at the update)', async () => {
        const columns = [{ accessorKey: 'name', header: 'Name' }, { accessorKey: 'age', header: 'Age' }, { accessorKey: 'city', header: 'City' }];
        const data = [{ name: 'a', age: 1, city: 'x' }, { name: 'b', age: 2, city: 'y' }, { name: 'c', age: 3, city: 'z' }];
        const wideRange = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'city' };
        const first = await mountTable({ enableCellRangeSelection: true, columns: [{ accessorKey: 'name', header: 'Name' }], data });
        first.cellRange = wideRange; // `city` is not a column yet ...
        first.columns = columns; // ... the columns arrive in the same tick
        await settle(first);
        expect(first.cellRange).toEqual(wideRange);
        const second = await mountTable({ enableCellRangeSelection: true, columns: [{ accessorKey: 'name', header: 'Name' }], data });
        second.columns = columns;
        second.cellRange = wideRange;
        await settle(second);
        expect(second.cellRange).toEqual(wideRange);
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
            table.cellRange = { startRow: 0, startCol: 7, endRow: 1, endCol: 'age' } as never;
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

describe('a range across a phase with no drawn rows', () => {
    const wide = { startRow: 0, startCol: 'name', endRow: 2, endCol: 'age' };

    it('survives data that arrives later (a fetch without `loading`), and is trimmed onto the rows that arrive', async () => {
        const table = await mountTable({ enableCellRangeSelection: true, data: [] });
        table.cellRange = wide;
        await settle(table);
        expect(table.cellRange).toEqual(wide);
        table.data = SAMPLE_ROWS.slice(0, 2);
        await settle(table);
        expect(table.cellRange).toEqual({ ...wide, endRow: 1 }); // the accepted edge: trimmed onto the first rows of the load
    });

    it('survives collapsing every group (no rows drawn) and expanding them again', async () => {
        const rows = SAMPLE_ROWS.map((row, i) => ({ ...row, group: i % 2 === 0 ? 'g0' : 'g1' }));
        const table = await mountTable({ enableCellRangeSelection: true, groupBy: 'group', data: rows });
        table.cellRange = wide;
        await settle(table);
        table.collapseAllGroups();
        await settle(table);
        table.expandAllGroups();
        await settle(table);
        expect(table.cellRange).toEqual({ ...wide, endRow: Math.min(2, rows.length - 1) });
    });

    it('survives a skeleton phase', async () => {
        const table = await mountTable({ enableCellRangeSelection: true, skeleton: true });
        table.cellRange = wide;
        await settle(table);
        table.skeleton = false;
        await settle(table);
        expect(table.cellRange).toEqual({ ...wide, endRow: Math.min(2, SAMPLE_ROWS.length - 1) });
    });
});

describe('the default message of a rejected write', () => {
    it('is the invalidValue of the locale of the table', async () => {
        registerDataTableLocale('xx', { invalidValue: 'Nope, not that' });
        try {
            const table = await mountTable({ locale: 'xx', columns: [{ accessorKey: 'name', header: 'Name', editable: true, editValidator: () => false, valueSetter: (row: { name: string }, value: unknown) => ({ ...row, name: String(value) }) }] });
            expect(table.writeCell({ rowIndex: 0, columnKey: 'name' }, 'x', { report: false })).toMatchObject({ status: 'rejected', message: 'Nope, not that' });
        } finally {
            registerDataTableLocale('xx', {});
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
