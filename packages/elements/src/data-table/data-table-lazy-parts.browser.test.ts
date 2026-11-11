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

    it('draws a range assigned to an attached table at the next frame (data-in-range, aria-selected)', async () => {
        const table = await mountTable({ enableCellRangeSelection: true });
        const range = { startRow: 0, startCol: 'name', endRow: 0, endCol: 'name' };
        const hits = (): number => table.querySelectorAll('[data-in-range]').length;
        table.provide('range', {
            range: () => range,
            normalized: () => null,
            isInRange: (row: number, key: string) => row === 0 && key === 'name',
            isFillPreview: () => false,
            edgeOf: () => 'top bottom start end',
            setRange: () => undefined,
            extendTo: () => undefined,
            stats: () => null,
            chartPayload: () => null,
            openChart: () => undefined,
            fillDownTo: () => false,
            fillHandleCell: () => null,
            gestureActive: () => false,
        });
        expect(hits()).toBe(0);
        table.cellRange = range;
        await settle(table);
        expect(hits()).toBe(1);
        expect(table.querySelector('[data-in-range]')?.getAttribute('aria-selected')).toBe('true');
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
