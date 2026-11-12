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

    it('a pinned cell in the range or the fill preview stays opaque (the tint is mixed over its own background), also on a hovered or selected row', async () => {
        const table = await mountTable({
            columns: [
                { accessorKey: 'id', header: 'Id', width: '100px', pin: 'left' },
                { accessorKey: 'name', header: 'Name', width: '200px' },
            ],
            enableRowSelection: true,
        });
        // The computed colour is in whatever space the browser keeps (rgb, oklab, color(srgb)): the alpha is the number after a slash, none means opaque.
        const alpha = (cell: HTMLElement): number => {
            const match = /\/\s*([\d.]+)(%?)\s*\)/.exec(getComputedStyle(cell).backgroundColor);
            return match ? Number(match[1]) / (match[2] ? 100 : 1) : 1;
        };
        const pinned = cellAt(table, 1, 'id')!;
        expect(pinned.hasAttribute('data-pinned')).toBe(true);
        for (const mark of ['data-in-range', 'data-fill-preview']) {
            pinned.setAttribute(mark, '');
            expect(alpha(pinned), mark).toBe(1);
            pinned.removeAttribute(mark);
        }
        const plain = cellAt(table, 1, 'name')!;
        plain.setAttribute('data-in-range', ''); // an unpinned cell keeps the see-through tint (the row colour shows)
        expect(alpha(plain)).toBeLessThan(1);
    });

    it('a row that is retained AND draggable stays out of flow (position: absolute): the drag rule does not beat the window rule', async () => {
        const table = await mountTable();
        const row = bodyRows(table)[0]!;
        row.setAttribute('data-retained', '');
        row.setAttribute('data-draggable', '');
        expect(getComputedStyle(row).position).toBe('absolute');
    });
});
