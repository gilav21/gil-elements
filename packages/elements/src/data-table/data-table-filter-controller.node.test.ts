import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disposables } from '../shared/registry.js';
import { FilterUiController } from './data-table-filter-controller.js';
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
        announceFilters: vi.fn(),
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
        root: { querySelectorAll: () => [] },
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
        // Round 13: a key present with undefined is "none" too.
        model.set('columnFilters', { name: undefined });
        expect(service.panelInputs(column).value).toBeNull();
        model.set('columnFilters', { name: ['a'] });
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

    it('writes a pending floating value at detach, once, while the query service exists (round 19: flushed, not dropped)', () => {
        const { controller, service, query } = fakeHost({ filterDebounce: 200 });
        service.floatingInput('name')({ currentTarget: { value: 'a' } } as unknown as Event);
        controller.detach();
        expect(query.changeColumnFilter).toHaveBeenCalledTimes(1);
        expect(query.changeColumnFilter).toHaveBeenCalledWith('name', 'a');
        vi.advanceTimersByTime(500);
        expect(query.changeColumnFilter).toHaveBeenCalledTimes(1);
    });

    // Round 20: the announcement itself (the 500 ms settle, the count, "all filters cleared", the server wait) is the query service's ONE
    // `announceFilters` (browser-tested in F9, its "any filter on" rule node-tested as anyFilterOn); the filter UI hands it every table write.
    it('hands each table write of the column or advanced filter to the query service announcement (D7)', () => {
        const { service, model, query } = fakeHost();
        service.setter('name')('a');
        expect(query.announceFilters).toHaveBeenCalledTimes(1);
        model.set('advancedFilter', { type: 'group', combinator: 'and', rules: [{ type: 'condition', column: 'name', operator: 'contains', value: 'a' }] });
        expect(query.announceFilters).toHaveBeenCalledTimes(2);
    });

    it('hands over nothing for a table write that leaves the filters structurally equal (round 16)', () => {
        const { model, query } = fakeHost();
        model.set('columnFilters', { name: 'a' });
        expect(query.announceFilters).toHaveBeenCalledTimes(1);
        model.set('columnFilters', { name: 'a' }); // a new, equal object (a restore that changed only the sort)
        model.set('advancedFilter', null);
        expect(query.announceFilters).toHaveBeenCalledTimes(1);
    });

    it('hands over nothing for a filter the consumer set as a property', () => {
        const { model, query } = fakeHost();
        model.assign('columnFilters', { name: 'x' });
        expect(query.announceFilters).not.toHaveBeenCalled();
    });

    it('hands one stable prefetch handler per column (round 15)', () => {
        const { service } = fakeHost();
        expect(service.prefetch('name')).toBe(service.prefetch('name'));
        expect(service.prefetch('name')).not.toBe(service.prefetch('other'));
        expect(() => service.prefetch('name')()).not.toThrow();
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
