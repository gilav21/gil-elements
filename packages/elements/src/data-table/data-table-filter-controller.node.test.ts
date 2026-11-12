import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disposables } from '../shared/registry.js';
import { FILTER_UI_ANNOUNCE_MS, FilterUiController } from './data-table-filter-controller.js';
import type { FilterUiService } from './data-table-grid-filters.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { ModelStore } from './data-table-model.js';
import { DATA_TABLE_LOCALES } from './data-table.locales.js';
import type { ColumnDef, FilterGroup } from './data-table.types.js';

interface Row {
    name: string;
}

function fakeHost(config: Partial<Record<string, unknown>> = {}) {
    const model = new ModelStore<Row>(() => undefined);
    const provided = new Map<string, unknown>();
    const announce = vi.fn();
    const requestRender = vi.fn();
    const query = {
        changeColumnFilter: vi.fn((key: string, value: unknown) => model.set('columnFilters', { ...model.get('columnFilters'), [key]: value })),
        changeAdvancedFilter: vi.fn((group: FilterGroup | null) => model.set('advancedFilter', group)),
        filteredCount: vi.fn(() => 3 as number | undefined),
        // The query service's one count rule, reduced to "now, if there is a count" (the waiting half is the query controller's, browser-tested).
        whenCounted: (say: (count: number) => void): void => {
            const count = query.filteredCount();
            if (count !== undefined) say(count);
        },
    };
    const columns: ColumnDef<Row>[] = [{ accessorKey: 'name', header: 'Name', enableFiltering: true }];
    const disposables = new Disposables();
    const host = {
        config: { columns, filterDebounce: 0, enableAdvancedFilter: false, ...config },
        model,
        provide: (key: string, value: unknown) => {
            provided.set(key, value);
            return () => provided.delete(key);
        },
        provider: (key: string) => (key === 'query' ? query : key === 'columns' ? { enhancedColumns: () => columns } : provided.get(key)),
        announce,
        requestRender,
        disposables,
        resolvedLocale: DATA_TABLE_LOCALES.en,
    } as unknown as DataTableCoreHost<Row>;
    const controller = new FilterUiController(host);
    controller.attach();
    const service = provided.get('filters') as FilterUiService<Row>;
    return { controller, service, model, provided, announce, requestRender, query, disposables };
}

describe('FilterUiController', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('provides the filters service while attached and unprovides it at detach', () => {
        const { controller, service, provided, model } = fakeHost();
        expect(service.isActive('name')).toBe(false);
        model.set('columnFilters', { name: 'x' });
        expect(service.isActive('name')).toBe(true);
        expect(service.hasAnyFloating()).toBe(true);
        expect(service.advancedCount()).toBe(0);
        controller.detach();
        expect(provided.has('filters')).toBe(false);
    });

    it('draws no toolbar trigger without enable-advanced-filter, and one with it', () => {
        expect(fakeHost().controller.renderToolbar()).toBeNull();
        expect(fakeHost({ enableAdvancedFilter: true }).controller.renderToolbar()).not.toBeNull();
    });

    it('counts the advanced conditions, nested groups included', () => {
        const { service, model } = fakeHost();
        model.set('advancedFilter', { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }, { type: 'group', combinator: 'or', rules: [{ type: 'condition', column: 'name', operator: 'isEmpty' }] }] });
        expect(service.advancedCount()).toBe(2);
    });

    it('hands a panel filterComponentInputs first, then column and the current value (D2)', () => {
        const { service, model } = fakeHost();
        model.set('columnFilters', { name: ['a'] });
        const column: ColumnDef<Row> = { accessorKey: 'name', header: 'Name', filterComponent: 'x-panel', filterComponentInputs: () => ({ options: ['a', 'b'], value: 'ignored' }) };
        expect(service.panelInputs(column)).toEqual({ options: ['a', 'b'], column, value: ['a'] });
        expect(service.panelInputs({ ...column, accessorKey: 'other' }).value).toBeNull();
        // The ready-made panels also get the table's locale.
        expect(service.panelInputs({ ...column, filterComponent: 'ge-data-table-date-filter' })).toMatchObject({ locale: 'en' });
    });

    it('wires filter-change LAST over the consumer outputs, stops its propagation and writes the column filter', () => {
        const { service, query } = fakeHost();
        const mine = vi.fn();
        const column: ColumnDef<Row> = { accessorKey: 'name', header: 'Name', filterComponent: 'x-panel', filterComponentOutputs: { 'filter-change': mine, other: mine } };
        const outputs = service.panelOutputs(column);
        expect(outputs['other']).toBe(mine);
        expect(outputs['filter-change']).not.toBe(mine);
        expect(service.panelOutputs(column)['filter-change']).toBe(outputs['filter-change']); // stable across renders
        const event = new CustomEvent('filter-change', { detail: ['a'], bubbles: true });
        const stop = vi.spyOn(event, 'stopPropagation');
        outputs['filter-change']!(event);
        expect(stop).toHaveBeenCalled();
        expect(query.changeColumnFilter).toHaveBeenCalledWith('name', ['a']);
    });

    it('writes the floating text input at once without filterDebounce, after it with one (D6)', () => {
        const immediate = fakeHost();
        immediate.service.floatingInput('name')({ currentTarget: { value: 'al' } } as unknown as Event);
        expect(immediate.query.changeColumnFilter).toHaveBeenCalledWith('name', 'al');

        const debounced = fakeHost({ filterDebounce: 200 });
        debounced.service.floatingInput('name')({ currentTarget: { value: 'a' } } as unknown as Event);
        debounced.service.floatingInput('name')({ currentTarget: { value: 'al' } } as unknown as Event);
        expect(debounced.query.changeColumnFilter).not.toHaveBeenCalled();
        vi.advanceTimersByTime(200);
        expect(debounced.query.changeColumnFilter).toHaveBeenCalledTimes(1);
        expect(debounced.query.changeColumnFilter).toHaveBeenCalledWith('name', 'al');
    });

    it('cancels a pending floating write at detach', () => {
        const { controller, service, query } = fakeHost({ filterDebounce: 200 });
        service.floatingInput('name')({ currentTarget: { value: 'a' } } as unknown as Event);
        controller.detach();
        vi.advanceTimersByTime(500);
        expect(query.changeColumnFilter).not.toHaveBeenCalled();
    });

    it('announces the settled count once, 500 ms after the last column or advanced edit (D7)', () => {
        const { service, announce, query } = fakeHost();
        service.setter('name')('a');
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS - 1);
        service.setter('name')('al');
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS - 1);
        expect(announce).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith('3 rows match the filters');
        query.filteredCount.mockReturnValue(1);
        service.setter('name')('ali');
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS);
        expect(announce).toHaveBeenLastCalledWith('1 row matches the filters');
    });

    it('announces that every filter is cleared, and nothing for an unknown server count', () => {
        const { service, announce, query } = fakeHost();
        service.setter('name')('a');
        service.setter('name')(null);
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS);
        expect(announce).toHaveBeenCalledWith('All filters cleared, showing all rows');
        query.filteredCount.mockReturnValue(undefined);
        service.setter('name')('b');
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS);
        expect(announce).toHaveBeenCalledTimes(1);
    });

    it('does not announce a filter the consumer set as a property, nor after detach', () => {
        const { controller, model, announce, service } = fakeHost();
        model.assign('columnFilters', { name: 'x' });
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS);
        expect(announce).not.toHaveBeenCalled();
        service.setter('name')('y');
        controller.detach();
        vi.advanceTimersByTime(FILTER_UI_ANNOUNCE_MS);
        expect(announce).not.toHaveBeenCalled();
    });

    it('tracks the open panel from its own popover only, and asks for a render', () => {
        const { service, requestRender } = fakeHost();
        const popover = {};
        service.onPanelToggle('name')({ target: popover, currentTarget: popover, detail: true } as unknown as CustomEvent<boolean>);
        expect(service.panelOpen('name')).toBe(true);
        expect(requestRender).toHaveBeenCalled();
        // an open-change from a popover inside the panel (a month select) is not the panel's
        service.onPanelToggle('name')({ target: {}, currentTarget: popover, detail: false } as unknown as CustomEvent<boolean>);
        expect(service.panelOpen('name')).toBe(true);
        service.onPanelToggle('name')({ target: popover, currentTarget: popover, detail: false } as unknown as CustomEvent<boolean>);
        expect(service.panelOpen('name')).toBe(false);
    });
});
