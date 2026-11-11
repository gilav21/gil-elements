import { afterEach, describe, expect, it } from 'vitest';
import { bodyRows, cellAt, mountTable, send, settle } from './data-table-fixtures.js';

afterEach(async () => {
    await send('Emulation.setEmulatedMedia', { features: [] });
});

describe('the stylesheet cascade after the region files were spliced in', () => {
    it('forced colours: a focused cell in the fill preview shows the 2px Highlight focus outline, not the preview\'s dashed one', async () => {
        const table = await mountTable();
        table.focusCell(1, 'name');
        await settle(table);
        const cell = cellAt(table, 1, 'name')!;
        cell.setAttribute('data-fill-preview', ''); // what the range part sets on a preview cell
        (document.activeElement as HTMLElement | null)?.blur(); // DOM focus elsewhere: only `[data-focused]` (the mark) is left to draw the ring, the :focus rules do not apply
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
        const style = getComputedStyle(cell);
        expect(cell.hasAttribute('data-focused')).toBe(true);
        expect(style.outlineStyle).toBe('solid');
        expect(style.outlineWidth).toBe('2px');
    });

    it('a row that is retained AND draggable stays out of flow (position: absolute): the drag rule does not beat the window rule', async () => {
        const table = await mountTable();
        const row = bodyRows(table)[0]!;
        row.setAttribute('data-retained', '');
        row.setAttribute('data-draggable', '');
        expect(getComputedStyle(row).position).toBe('absolute');
    });
});
