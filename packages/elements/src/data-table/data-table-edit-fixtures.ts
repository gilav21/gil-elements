/**
 * Test kit of inline editing (wave 5, package B), for `*.browser.test.ts` files: editable columns over `SampleRow`, and reading the open
 * editor back from the DOM. Mounting and real input stay in data-table-fixtures.ts and data-table-input-fixtures.ts.
 */
import { userEvent } from 'vitest/browser';
import { cellAt, type SampleRow, settle } from './data-table-fixtures.js';
import type { GeDataTable } from './data-table.js';
import type { ColumnDef } from './data-table.types.js';

/** Name (text), age (number) and a read-only id: the setters return a new row, as a consumer's would. */
export const EDIT_COLUMNS: ColumnDef<SampleRow>[] = [
    { accessorKey: 'id', header: 'ID', width: '80px' },
    { accessorKey: 'name', header: 'Name', width: '200px', editable: true, valueSetter: (row, value) => ({ ...row, name: String(value) }) },
    { accessorKey: 'age', header: 'Age', width: '120px', editable: true, editType: 'number', valueSetter: (row, value) => ({ ...row, age: value as number }) },
];

/** A column of `EDIT_COLUMNS` with `patch` applied. */
export const editColumns = (patch: Partial<Record<'id' | 'name' | 'age', Partial<ColumnDef<SampleRow>>>> = {}, extra: ColumnDef<SampleRow>[] = []): ColumnDef<SampleRow>[] => [
    ...EDIT_COLUMNS.map((c) => ({ ...c, ...patch[c.accessorKey as 'id' | 'name' | 'age'] })),
    ...extra,
];

/** The open editor's own control (`[data-edit-input]`) in the cell, or null. */
export const editorIn = (table: Element, row: number, key: string): HTMLElement | null => cellAt(table, row, key)?.querySelector<HTMLElement>('[data-edit-input]') ?? null;

/** The one open editor's control anywhere in the table, or null. */
export const openEditor = (table: Element): HTMLElement | null => table.querySelector<HTMLElement>('[data-editing] [data-edit-input]');

/** The rejection message drawn in the table, or null. */
export const editError = (table: Element): HTMLElement | null => table.querySelector<HTMLElement>('[data-slot="cell-edit-error"]');

/** The events of `name` the table fires from now on. */
export function record<D = unknown>(table: Element, name: string): CustomEvent<D>[] {
    const seen: CustomEvent<D>[] = [];
    table.addEventListener(name, (event) => seen.push(event as CustomEvent<D>));
    return seen;
}

/** Opens the editor of a drawn cell through the public API and waits for the render that draws it (and its focus). */
export async function startEditingAt(table: GeDataTable<SampleRow>, row: number, key: string): Promise<boolean> {
    const target = table.provider('query')?.renderedRowAt(row);
    const opened = target !== undefined && table.startEditing(target, key);
    await settle(table);
    return opened;
}

/**
 * Picks an option of a select editor as the POINTER does: the press that opens the native list, then the pick (`userEvent.selectOptions` alone
 * is a programmatic change with no press, which the editor treats like a keyboard change: draft only).
 */
export async function pointerPick(select: HTMLSelectElement, value: string): Promise<void> {
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, pointerType: 'mouse' }));
    await userEvent.selectOptions(select, value);
}

/** The live region's text, without the zero-width space the table appends so that a repeated message is spoken again. */
export const announced = (table: Element): string => (table.querySelector('[data-slot="data-table-announcer"]')?.textContent ?? '').replaceAll('​', '');

/** The names of the data rows as drawn. */
export const names = (table: GeDataTable<SampleRow>): string[] => (table.provider('query')?.renderedRows() ?? []).map((r) => r.name);
