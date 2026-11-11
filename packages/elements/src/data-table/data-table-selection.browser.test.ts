import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { paintedToken } from '../test-utils.js';
import { axProps, axTree, bodyRows, makeRows, mountTable, q, qa, type SampleRow, settle } from './data-table-fixtures.js';
import { columnHelper } from './data-table-column-builder.js';
import { emulateTouch, frames, parkMouse, press, withTheme } from './data-table-input-fixtures.js';
import type { GeDataTable } from './data-table.js';

afterEach(parkMouse);

type Table = GeDataTable<SampleRow>;

const rowCheckbox = (table: Element, rowId: string): HTMLElement => q(table, `[data-slot="table-row"][data-row-id="${rowId}"] ge-checkbox`);
const headCheckbox = (table: Element): HTMLElement => q(table, '[data-slot="table-head"] ge-checkbox');
const selectedIds = (table: Table): string[] => Object.keys(table.rowSelection).sort();
const stateOf = (table: Element, rowId: string): string | null => q(table, `[data-slot="table-row"][data-row-id="${rowId}"]`).getAttribute('data-state');
const click = async (el: Element, table: Table): Promise<void> => {
    await userEvent.click(el);
    await settle(table);
};
const shiftClick = async (el: Element, table: Table): Promise<void> => {
    await userEvent.keyboard('{Shift>}');
    try {
        await userEvent.click(el);
    } finally {
        await userEvent.keyboard('{/Shift}');
    }
    await settle(table);
};
const record = (table: Table, name: string): CustomEvent[] => {
    const seen: CustomEvent[] = [];
    table.addEventListener(name, (e) => seen.push(e as CustomEvent));
    return seen;
};
const mountSelectable = (props: Record<string, unknown> = {}, attrs: Record<string, string> = {}): Promise<Table> =>
    mountTable<SampleRow>({ enableRowSelection: true, data: makeRows(25), ...props }, attrs);

describe('row selection by click', () => {
    it('draws one selection column when the consumer defined it with columnHelper().select()', async () => {
        const helper = columnHelper<SampleRow>();
        const table = await mountSelectable({ columns: [helper.select(), { accessorKey: 'name', header: 'Name' }] });
        expect(qa(table, '[data-slot="table-head"][data-special="selection"]')).toHaveLength(1);
        expect(qa(table, '[data-row-id="r1"] ge-checkbox')).toHaveLength(1);
    });

    it('selects a row from its checkbox only, with aria-selected, data-state and one event carrying the new record', async () => {
        const table = await mountSelectable();
        const events = record(table, 'row-selection-change');

        await click(rowCheckbox(table, 'r2'), table);
        expect(table.rowSelection).toEqual({ r2: true });
        expect(q(table, '[data-row-id="r2"]').getAttribute('aria-selected')).toBe('true');
        expect(stateOf(table, 'r2')).toBe('selected');
        expect(stateOf(table, 'r3')).toBeNull();
        expect(events.map((e) => e.detail)).toEqual([{ r2: true }]);

        // Clicking the cells of a row does not select it.
        await click(q(table, '[data-row-id="r3"] [data-column="name"]'), table);
        expect(selectedIds(table)).toEqual(['r2']);
        expect(events).toHaveLength(1);

        await click(rowCheckbox(table, 'r2'), table);
        expect(table.rowSelection).toEqual({});
        expect(stateOf(table, 'r2')).toBeNull();
        expect(events.map((e) => e.detail)).toEqual([{ r2: true }, {}]);
    });

    it('does not select on ctrl or meta click of a row, and keeps the selection of a consumer property write quiet', async () => {
        const table = await mountSelectable();
        const events = record(table, 'row-selection-change');
        const cell = q(table, '[data-row-id="r1"] [data-column="name"]');
        await userEvent.keyboard('{Control>}');
        await userEvent.click(cell);
        await userEvent.keyboard('{/Control}');
        await userEvent.keyboard('{Meta>}');
        await userEvent.click(cell);
        await userEvent.keyboard('{/Meta}');
        await settle(table);
        expect(selectedIds(table)).toEqual([]);

        table.rowSelection = { r5: true };
        await settle(table);
        expect(stateOf(table, 'r5')).toBe('selected');
        expect(events).toHaveLength(0);
    });

    it('keeps stale ids: selected ids with no row still count in the record, not in selectedRows', async () => {
        const table = await mountSelectable({ rowSelection: { r1: true, gone: true } });
        expect(table.selectedRows.map((r) => r.id)).toEqual(['r1']);
        table.data = makeRows(3);
        await settle(table);
        expect(table.rowSelection).toEqual({ r1: true, gone: true });
        expect(table.selectedRows.map((r) => r.id)).toEqual(['r1']);
    });

    it('does not select a disabled row, and shows its checkbox disabled', async () => {
        const table = await mountSelectable({ disabledRowIds: ['r1'] });
        expect(rowCheckbox(table, 'r1').hasAttribute('disabled')).toBe(true);
        await click(rowCheckbox(table, 'r1'), table);
        expect(selectedIds(table)).toEqual([]);
        expect(q(table, '[data-row-id="r1"]').getAttribute('aria-disabled')).toBe('true');
        table.selectRows([table.data[1]!]);
        await settle(table);
        expect(selectedIds(table)).toEqual(['r1']);
    });
});

describe('the header checkbox', () => {
    it('covers ALL filtered rows of every page, goes indeterminate and selects all again from there', async () => {
        const table = await mountSelectable();
        expect(bodyRows(table)).toHaveLength(10);

        await click(headCheckbox(table), table);
        expect(Object.keys(table.rowSelection)).toHaveLength(25);
        expect((headCheckbox(table) as HTMLElement & { checked: boolean }).checked).toBe(true);

        await click(rowCheckbox(table, 'r3'), table);
        const head = headCheckbox(table) as HTMLElement & { checked: boolean; indeterminate: boolean };
        expect(head.indeterminate).toBe(true);
        expect(head.checked).toBe(false);

        await click(head, table);
        expect(Object.keys(table.rowSelection)).toHaveLength(25);
        await click(head, table);
        expect(table.rowSelection).toEqual({});
    });

    it('selects only the filtered rows, leaves an earlier off-filter selection alone, and ignores disabled rows', async () => {
        const table = await mountSelectable({ rowSelection: { r24: true }, disabledRowIds: ['r10'] });
        table.globalFilter = 'n1';
        await settle(table);
        // n1, n10..n19 are the filtered rows; r10 is disabled.
        await click(headCheckbox(table), table);
        expect(selectedIds(table)).toEqual(['r1', 'r11', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17', 'r18', 'r19', 'r24']);
        await click(headCheckbox(table), table);
        expect(selectedIds(table)).toEqual(['r24']);
    });

    it('selectRows([]), unselectRows([]) and unselecting what is not selected fire no change', async () => {
        const table = await mountSelectable({ rowSelection: { r1: true } });
        const events = record(table, 'row-selection-change');
        table.selectRows([]);
        table.unselectRows([]);
        table.unselectRows([table.data[3]!]);
        table.selectRows([table.data[2]!]);
        await settle(table);
        expect(events).toHaveLength(1);
        expect(selectedIds(table)).toEqual(['r1', 'r2']);
    });

    it('does nothing when every selectable row is disabled', async () => {
        const table = await mountSelectable({ data: makeRows(2), disabledRowIds: ['r0', 'r1'] });
        const events = record(table, 'row-selection-change');
        await click(headCheckbox(table), table);
        expect(table.rowSelection).toEqual({});
        expect((headCheckbox(table) as HTMLElement & { checked: boolean }).checked).toBe(false);
        expect(events).toEqual([]);
    });
});

describe('selection semantics in the accessibility tree', () => {
    it('exposes the grid as multiselectable, selected rows, a disabled and a mixed checkbox', async () => {
        const table = await mountSelectable({ data: makeRows(4), rowSelection: { r1: true }, disabledRowIds: ['r3'] });
        const nodes = await axTree();
        const grid = nodes.find((n) => n.role?.value === 'grid' && axProps(n)['multiselectable'] === true);
        expect(grid).toBeDefined();
        const rows = nodes.filter((n) => n.role?.value === 'row' && 'selected' in axProps(n));
        expect(rows.filter((n) => axProps(n)['selected'] === true)).toHaveLength(1);
        const boxes = nodes.filter((n) => n.role?.value === 'checkbox' && n.name?.value === 'Select row');
        expect(boxes.filter((n) => axProps(n)['disabled'] === true)).toHaveLength(1);
        expect(axProps(nodes.find((n) => n.role?.value === 'checkbox' && n.name?.value === 'Select all'))['checked']).toBe('mixed');
        expect(table.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    });
});

describe('selection by keyboard', () => {
    const focusCell = (table: Table, rowId: string, key: string): HTMLElement => {
        const cell = q(table, `[data-row-id="${rowId}"] [data-column="${key}"]`);
        cell.tabIndex = 0;
        cell.focus();
        return cell;
    };

    it('toggles the row on Space from a focused cell, not on Enter, and not on a disabled row', async () => {
        const table = await mountSelectable({ disabledRowIds: ['r2'] });
        focusCell(table, 'r1', 'name');
        await press('{Enter}');
        expect(selectedIds(table)).toEqual([]);
        await press(' ');
        expect(selectedIds(table)).toEqual(['r1']);
        await press(' ');
        expect(selectedIds(table)).toEqual([]);

        focusCell(table, 'r2', 'name');
        await press(' ');
        expect(selectedIds(table)).toEqual([]);
    });

    it('lets Space type inside a text control of a row instead of selecting it', async () => {
        // One stable element: a renderer that makes a new input per render would lose the focus the test gives it.
        const input = document.createElement('input');
        const table = await mountSelectable({ data: makeRows(1), columns: [{ accessorKey: 'name', header: 'Name', width: '200px', cellRenderer: () => input }] });
        input.focus();
        await press(' ');
        expect(input.value).toBe(' ');
        expect(selectedIds(table)).toEqual([]);
    });

    it('takes the in-cell checkboxes (not the header ones) out of the tab order when a roving cell model exists (a stub here, the real controller in the full table)', async () => {
        const table = await mountSelectable();
        table.provide('interaction', { focusedCell: () => null, cellRange: () => null, editingCell: () => null, cellEditError: () => null, focusCell() {}, isCellSelected: () => false });
        table.requestRender();
        await settle(table);
        expect(rowCheckbox(table, 'r1').getAttribute('tabindex')).toBe('-1');
        // the header is not in the roving grid: its select-all stays a natural tab stop
        expect(headCheckbox(table).getAttribute('tabindex')).not.toBe('-1');
    });
});

describe('shift+click range on the row checkbox', () => {
    it('selects the rows between the last toggled row and this one, downwards and upwards', async () => {
        const table = await mountSelectable();
        await click(rowCheckbox(table, 'r2'), table);
        await shiftClick(rowCheckbox(table, 'r5'), table);
        expect(selectedIds(table)).toEqual(['r2', 'r3', 'r4', 'r5']);

        await click(rowCheckbox(table, 'r8'), table);
        await shiftClick(rowCheckbox(table, 'r6'), table);
        expect(selectedIds(table)).toEqual(['r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']);
    });

    it('unchecks a range when the clicked box unchecks, and skips disabled rows', async () => {
        const table = await mountSelectable({ disabledRowIds: ['r3'] });
        await click(headCheckbox(table), table);
        table.selectRows([table.data[3]!]);
        await settle(table);
        await click(rowCheckbox(table, 'r1'), table);
        await shiftClick(rowCheckbox(table, 'r5'), table);
        expect(selectedIds(table)).toEqual(expect.not.arrayContaining(['r1', 'r2', 'r4', 'r5']));
        expect(table.rowSelection['r3']).toBe(true);
        expect(table.rowSelection['r6']).toBe(true);
    });

    it('is a plain toggle when the anchor is on another page, and follows the drawn order after a sort', async () => {
        const table = await mountSelectable();
        await click(rowCheckbox(table, 'r2'), table);
        table.paginationState = { pageIndex: 1, pageSize: 10 };
        await settle(table);
        await shiftClick(rowCheckbox(table, 'r12'), table);
        expect(selectedIds(table)).toEqual(['r12', 'r2']);

        table.paginationState = { pageIndex: 0, pageSize: 10 };
        table.rowSelection = {};
        table.sortState = { column: 'name', direction: 'desc' };
        await settle(table);
        const order = bodyRows(table).map((r) => r.dataset['rowId']!);
        await click(rowCheckbox(table, order[1]!), table);
        await shiftClick(rowCheckbox(table, order[3]!), table);
        expect(selectedIds(table)).toEqual(order.slice(1, 4).sort());
    });
});

describe('tree selection', () => {
    const tree = (): SampleRow[] => [
        { id: 'a', name: 'a', age: 1, children: [{ id: 'a1', name: 'a1', age: 1, children: [{ id: 'a1x', name: 'a1x', age: 1 }, { id: 'a1y', name: 'a1y', age: 1 }] }, { id: 'a2', name: 'a2', age: 1 }] },
        { id: 'b', name: 'b', age: 1, children: [{ id: 'b1', name: 'b1', age: 1 }] },
    ];
    const mountTree = (props: Record<string, unknown>) => mountSelectable({ data: tree(), enableSubRows: true, subRowDefaultExpanded: true, ...props });
    const mixed = async (): Promise<number> => (await axTree()).filter((n) => n.role?.value === 'checkbox' && n.name?.value === 'Select row' && axProps(n)['checked'] === 'mixed').length;

    it('cascades through the whole subtree, selects a parent whose children are all selected, and shows the mixed state', async () => {
        const table = await mountTree({ subRowSelectionMode: 'descendants' });
        await click(rowCheckbox(table, 'a1x'), table);
        expect(selectedIds(table)).toEqual(['a1x']);
        expect((rowCheckbox(table, 'a1') as HTMLElement & { indeterminate: boolean }).indeterminate).toBe(true);
        expect((rowCheckbox(table, 'a') as HTMLElement & { indeterminate: boolean }).indeterminate).toBe(true);
        expect(await mixed()).toBeGreaterThanOrEqual(2);

        await click(rowCheckbox(table, 'a1'), table);
        expect(selectedIds(table)).toEqual(['a1', 'a1x', 'a1y']);
        await click(rowCheckbox(table, 'a2'), table);
        expect(selectedIds(table)).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2']);
        await click(rowCheckbox(table, 'a'), table);
        expect(table.rowSelection).toEqual({});
    });

    it('in self mode selects only the clicked row and shows no mixed state', async () => {
        const table = await mountTree({});
        await click(rowCheckbox(table, 'a'), table);
        expect(selectedIds(table)).toEqual(['a']);
        expect(await mixed()).toBe(0);
    });

    it('cascades only to the visible part of the subtree in filteredDescendants mode', async () => {
        const table = await mountTree({ subRowSelectionMode: 'filteredDescendants' });
        table.globalFilter = 'a1x';
        await settle(table);
        // The filter keeps a > a1 > a1x (parents of a match); a1y, a2 are filtered out.
        expect(bodyRows(table).map((r) => r.dataset['rowId'])).toEqual(['a', 'a1', 'a1x']);
        await click(rowCheckbox(table, 'a'), table);
        expect(selectedIds(table)).toEqual(['a', 'a1', 'a1x']);
    });

    it('selectedRows returns selected children of every level, in tree order', async () => {
        const table = await mountTree({ subRowSelectionMode: 'self' });
        await click(rowCheckbox(table, 'b1'), table);
        await click(rowCheckbox(table, 'a1x'), table);
        await click(rowCheckbox(table, 'a'), table);
        expect(table.selectedRows.map((r) => r.id)).toEqual(['a', 'a1x', 'b1']);
    });

    it('header select-all counts the visible tree rows of every page', async () => {
        const table = await mountTree({ subRowSelectionMode: 'self' });
        table.paginationState = { pageIndex: 0, pageSize: 1 };
        await settle(table);
        await click(headCheckbox(table), table);
        expect(selectedIds(table)).toEqual(['a', 'a1', 'a1x', 'a1y', 'a2', 'b', 'b1']);
    });
});

describe('selection on touch and in the dark theme', () => {
    it('gives the row and header checkboxes a 44px target on a touch screen', async () => {
        await emulateTouch(true);
        const table = await mountSelectable({ data: makeRows(3) });
        for (const box of [rowCheckbox(table, 'r0'), headCheckbox(table)]) {
            const { width, height } = box.getBoundingClientRect();
            expect(width).toBeGreaterThanOrEqual(44);
            expect(height).toBeGreaterThanOrEqual(44);
        }
    });

    it('tints a selected row in light and dark', async () => {
        for (const mode of ['light', 'dark']) {
            withTheme(mode);
            const table = await mountSelectable({ data: makeRows(3), rowSelection: { r1: true } });
            await new Promise((resolve) => setTimeout(resolve, 300)); // the row colour transitions
            await frames(1);
            const row = q(table, '[data-row-id="r1"]');
            expect(getComputedStyle(row).backgroundColor).toBe(paintedToken('--muted', row));
            expect(getComputedStyle(q(table, '[data-row-id="r0"]')).backgroundColor).not.toBe(paintedToken('--muted', row));
            table.remove();
        }
    });
});

describe('selection API', () => {
    it('selectRows, unselectRows, selectAll, toggleRow, toggleAll and clearSelection write one record each', async () => {
        const table = await mountSelectable();
        const events = record(table, 'row-selection-change');
        const [r0, r1, r2] = table.data as [SampleRow, SampleRow, SampleRow];
        table.selectRows([r0, r1]);
        table.unselectRows([r0]);
        table.toggleRow(r2);
        expect(selectedIds(table)).toEqual(['r1', 'r2']);
        table.selectAll();
        table.selectAll();
        expect(Object.keys(table.rowSelection)).toHaveLength(25);
        table.toggleAll();
        expect(table.rowSelection).toEqual({});
        table.clearSelection();
        expect(events.map((e) => Object.keys(e.detail).length)).toEqual([2, 1, 2, 25, 0]);
        await settle(table);
        expect(qa(table, '[data-state="selected"]')).toHaveLength(0);
    });
});
