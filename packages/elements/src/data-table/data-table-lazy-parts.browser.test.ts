import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditSession } from './data-table-edit-session.js';
import { bodyRows, cellAt, mountTable, settle } from './data-table-fixtures.js';
import { frames } from './data-table-input-fixtures.js';
import { RangeSession } from './data-table-range-session.js';
import { RowDragPart } from './lazy/row-drag.js';

afterEach(() => vi.restoreAllMocks());

describe('lazy parts and the render', () => {
    it('draws the change a part makes when it attaches: rows become draggable with no other trigger', async () => {
        // The part says it handles drags (what wave 6 C does): the controller's service reports it, with no edit of the controller.
        vi.spyOn(RowDragPart.prototype, 'active').mockReturnValue(true);
        const table = await mountTable({ enableRowDrag: true });
        await frames(3);
        await settle(table);
        expect(bodyRows(table).length).toBeGreaterThan(0);
        expect(bodyRows(table).every((row) => row.getAttribute('data-draggable') === '')).toBe(true);
    });

    it('lets the copy methods resolve to the ClipboardResult, so a caller can tell what happened', async () => {
        const table = await mountTable();
        expect(await table.copyCellToClipboard()).toEqual({ status: 'unavailable' }); // the step 0 service
        const service = table.provider('clipboard') as { copy(scope: string): Promise<unknown> };
        service.copy = (scope) => Promise.resolve({ status: scope === 'all' ? 'denied' : 'done', cells: 1 });
        expect(await table.copyAllToClipboard()).toEqual({ status: 'denied', cells: 1 });
        expect(await table.copyRowToClipboard(table.data[0]!)).toEqual({ status: 'done', cells: 1 });
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

    it('blocks text selection on the viewport only while range selection is active: the flag alone with the inert part leaves it selectable', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        await settle(table);
        await frames(3);
        const viewport = table.querySelector<HTMLElement>('[data-slot="data-table-viewport"]')!;
        expect(table.hasAttribute('data-range-selection')).toBe(false);
        expect(getComputedStyle(viewport).userSelect).not.toBe('none');
        const real = table.provider('range')!;
        table.provide('range', { ...real, active: () => true });
        table.requestUpdate();
        await settle(table);
        expect(table.hasAttribute('data-range-selection')).toBe(true);
        expect(getComputedStyle(viewport).userSelect).toBe('none');
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

describe('data-editable', () => {
    it('is written from the column layout, with no state call: editable columns mark their cells, a disabled row does not', async () => {
        const table = await mountTable({
            columns: [{ accessorKey: 'name', header: 'Name', editable: true }, { accessorKey: 'age', header: 'Age' }],
        });
        table.isRowDisabled = (row) => row === table.data[1];
        table.requestUpdate();
        await settle(table);
        expect(cellAt(table, 0, 'name')!.hasAttribute('data-editable')).toBe(true);
        expect(cellAt(table, 0, 'age')!.hasAttribute('data-editable')).toBe(false);
        expect(cellAt(table, 1, 'name')!.hasAttribute('data-editable')).toBe(false); // the disabled row
    });
});

describe('a feature switching on in a plain grid', () => {
    it('keeps every drawn row and cell node, and the DOM focus: the same template is used whether or not a feature is active', async () => {
        const table = await mountTable();
        table.focusCell(1, 'name');
        await settle(table);
        const cell = cellAt(table, 1, 'name')!;
        const row = cell.closest('[data-slot="table-row"]')!;
        const other = cellAt(table, 0, 'age')!;
        expect(document.activeElement).toBe(cell);
        // flash switches the state on (the formatting service exists): the state flips from false to true ...
        table.enableCellFlash = true;
        await settle(table);
        await frames(2);
        expect(cellAt(table, 1, 'name')).toBe(cell);
        expect(cell.closest('[data-slot="table-row"]')).toBe(row);
        expect(cellAt(table, 0, 'age')).toBe(other);
        expect(document.activeElement).toBe(cell);
        // ... and back
        table.enableCellFlash = false;
        await settle(table);
        await frames(2);
        expect(cellAt(table, 1, 'name')).toBe(cell);
        expect(document.activeElement).toBe(cell);
    });

    it('does not remount a consumer component in a cell when a feature turns on', async () => {
        const host = document.createElement('span');
        let connected = 0;
        let disconnected = 0;
        class Probe extends HTMLElement {
            connectedCallback(): void {
                connected++;
            }
            disconnectedCallback(): void {
                disconnected++;
            }
        }
        if (!customElements.get('x-lazy-probe')) customElements.define('x-lazy-probe', Probe);
        const probe = document.createElement('x-lazy-probe');
        host.append(probe);
        const table = await mountTable({
            columns: [{ accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: ({ rowIndex, value }) => (rowIndex === 0 ? probe : String(value)) }, { accessorKey: 'age', header: 'Age', width: '120px' }],
        });
        const before = [connected, disconnected];
        table.enableCellFlash = true;
        await settle(table);
        await frames(2);
        expect([connected, disconnected]).toEqual(before);
        expect(probe.isConnected).toBe(true);
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
