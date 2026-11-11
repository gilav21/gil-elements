import { describe, expect, it, vi } from 'vitest';
import { mountTable, settle } from './data-table-fixtures.js';

const plan = vi.hoisted(() => ({ withoutCellInteraction: true }));
vi.mock('./data-table-factories.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data-table-factories.js')>();
    return {
        ...original,
        createFactories: <T,>() => {
            const factories = original.createFactories<T>();
            if (plan.withoutCellInteraction) {
                delete factories['cell-interaction'];
                delete factories.clipboard; // it needs `interaction`
            }
            return factories;
        },
    };
});

describe('cellRange of a table whose plan has no cell-interaction controller', () => {
    it('stays a held value only: it is reported while range mode is on, kept across reconnects, and never lost or thrown away', async () => {
        plan.withoutCellInteraction = true;
        const range = { startRow: 0, startCol: 'name', endRow: 1, endCol: 'age' };
        const table = await mountTable({ enableCellRangeSelection: true });
        expect(table.provider('range')).toBeUndefined(); // no range service at all
        table.cellRange = range;
        await settle(table);
        expect(table.cellRange).toEqual(range);
        table.remove();
        document.body.append(table);
        await settle(table);
        expect(table.cellRange).toEqual(range); // retried at the connect, nothing to hand it to: still held
        table.remove();
    });
});
