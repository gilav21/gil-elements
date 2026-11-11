import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditSession } from './data-table-edit-session.js';
import { bodyRows, mountTable, settle } from './data-table-fixtures.js';
import { frames } from './data-table-input-fixtures.js';
import { RangeSession } from './data-table-range-session.js';
import { RowDragPart } from './lazy/row-drag.js';

afterEach(() => vi.restoreAllMocks());

describe('lazy parts and the render', () => {
    it('draws the change a part makes when it attaches: rows become draggable with no other trigger', async () => {
        const inert = { active: () => false, isDragging: () => false, dragState: () => null, moveRow: () => false, reorderData: (data: readonly unknown[]) => [...data] };
        // The part answers `active()` through the service it plugs in when it attaches (what wave 6 C does).
        vi.spyOn(RowDragPart.prototype, 'attach').mockImplementation(function (this: { host: { provide(key: string, service: unknown): void } }) {
            this.host.provide('rowDrag', { ...inert, active: () => true });
        });
        const table = await mountTable({ enableRowDrag: true });
        await frames(3);
        await settle(table);
        expect(bodyRows(table).length).toBeGreaterThan(0);
        expect(bodyRows(table).every((row) => row.getAttribute('data-draggable') === '')).toBe(true);
    });

    it('asks for exactly one render when a range is assigned to an attached table (the session asks, the setter does not repeat it)', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        await frames(2);
        const render = vi.spyOn(table, 'requestRender');
        const update = vi.spyOn(table, 'requestUpdate');
        table.cellRange = { startRow: 0, startCol: 'name', endRow: 0, endCol: 'name' };
        expect(render).toHaveBeenCalledTimes(1);
        // requestRender is the element's own requestUpdate: one call for the render, none from the setter on top
        expect(update).toHaveBeenCalledTimes(1);
    });

    it('draws range mode (aria-selected, aria-multiselectable) only while the range part is active, and not on the special columns', async () => {
        const table = await mountTable({ enableCellRangeSelection: true, enableRowSelection: true });
        await settle(table);
        await frames(3);
        const real = table.provider('range')!;
        const grid = (): Element => table.querySelector('[data-slot="table"]')!;
        // not loaded (or a load that failed): the flag alone draws nothing of range mode
        table.provide('range', { ...real, active: () => false });
        table.requestUpdate();
        await settle(table);
        expect(table.querySelector('[data-slot="table-cell"][aria-selected]')).toBeNull();
        // row selection is on in this table, so the grid is multiselectable anyway: the cells are what show range mode
        table.provide('range', { ...real, active: () => true });
        table.requestUpdate();
        await settle(table);
        expect(grid().getAttribute('aria-multiselectable')).toBe('true');
        expect(table.querySelector('[data-slot="table-cell"][data-column="name"]')?.getAttribute('aria-selected')).toBe('false');
        expect(table.querySelector('[data-slot="table-cell"][data-special][aria-selected]')).toBeNull();
    });

    it('draws nothing of range mode with the range flag on and the (empty) step 0 part loaded, and isCellSelected reports the focused cell', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        table.focusCell(1, 'name');
        await settle(table);
        await frames(3); // the part has loaded by now
        expect(table.provider('range')?.active()).toBe(false);
        expect(table.querySelector('[data-slot="table"]')?.hasAttribute('aria-multiselectable')).toBe(false);
        expect(table.querySelector('[data-slot="table-cell"][aria-selected]')).toBeNull();
        const interaction = table.provider('interaction')!;
        expect(interaction.isCellSelected(1, 'name')).toBe(true);
        expect(interaction.isCellSelected(0, 'name')).toBe(false);
    });

    it('leaves aria-multiselectable off while range mode is not active', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        await settle(table);
        const real = table.provider('range')!;
        table.provide('range', { ...real, active: () => false });
        table.requestUpdate();
        await settle(table);
        expect(table.querySelector('[data-slot="table"]')?.hasAttribute('aria-multiselectable')).toBe(false);
    });
});

describe('the sessions attach after the services are provided', () => {
    it('lets both sessions read the interaction and range providers in attach(), the range session first', async () => {
        const seen: string[] = [];
        const probe = (name: string) =>
            function (this: { context: { host: { provider(key: string): unknown } } }) {
                const { host } = this.context;
                seen.push(`${name}:${host.provider('interaction') ? 'interaction' : '-'}:${host.provider('range') ? 'range' : '-'}`);
            };
        vi.spyOn(EditSession.prototype, 'attach').mockImplementation(probe('edit'));
        vi.spyOn(RangeSession.prototype, 'attach').mockImplementation(probe('range'));
        await mountTable();
        expect(seen).toEqual(['range:interaction:range', 'edit:interaction:range']);
    });
});
