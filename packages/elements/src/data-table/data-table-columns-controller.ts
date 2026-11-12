import { type ColumnLayout, computeColumnLayout, duplicateColumnKeys, isSpecialColumn, pinGroupOf } from './data-table-columns.js';
import { baseColumnOrder, moveToIndex } from './data-table-column-order.js';
import { sameStructure } from './data-table-filters.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { ColumnsService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';
import { applyColumnState, applyViewState, type ColumnLayout as ColumnOverrides, readColumnState, readViewState, type ViewModel } from './data-table-view-state.js';
import { interpolate } from './data-table.locales.js';
import type { DataTableColumnState, EnhancedColumnDef } from './data-table.types.js';
import { sameRecord } from './data-table.utils.js';

type Pin = 'left' | 'right' | undefined;

/** Resolves the drawn columns from the definitions and the user's runtime overrides, and serves them as `columns`. */
export class ColumnsController<T> {
    private pins: Readonly<Record<string, Pin>> = {};
    /** Widths (px) a drag is showing right now; folded into the layout so an incidental render keeps them. */
    private live: ReadonlyMap<string, number> = new Map();
    private last: ColumnLayout<T> | null = null;
    private warned: unknown = null;

    private readonly layout = memoLast(
        (columns: DataTableCoreHost<T>['config']['columns'], widths: Record<string, string>, live: ReadonlyMap<string, number>, visibility: Record<string, boolean>, order: string[], pins: Readonly<Record<string, Pin>>, selection: boolean, expansion: boolean) =>
            computeColumnLayout<T>({
                columns,
                widths: live.size === 0 ? widths : { ...widths, ...Object.fromEntries([...live].map(([key, px]) => [key, `${px}px`])) },
                visibility,
                order,
                pins,
                enableRowSelection: selection,
                enableRowExpansion: expansion,
                hasActions: false,
            }),
    );

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private current(): ColumnLayout<T> {
        const { config, model } = this.host;
        return this.layout(config.columns, model.get('columnWidths'), this.live, model.get('columnVisibility'), model.get('columnOrder'), this.pins, config.enableRowSelection, config.enableRowExpansion);
    }

    private overrides(): ColumnOverrides {
        const { model } = this.host;
        return { widths: model.get('columnWidths'), visibility: model.get('columnVisibility'), pins: this.pins, order: model.get('columnOrder') };
    }

    /** Writes a merged layout: only the parts that differ reach the model, all in one batch (one flush, no intermediate `query`). */
    private writeOverrides(next: ColumnOverrides): void {
        const { model } = this.host;
        model.batch(() => {
            if (!sameRecord(next.widths, model.get('columnWidths'))) model.set('columnWidths', { ...next.widths });
            if (!sameRecord(next.visibility, model.get('columnVisibility'))) model.set('columnVisibility', { ...next.visibility });
            const order = model.get('columnOrder');
            if (next.order.length !== order.length || next.order.some((key, i) => key !== order[i])) model.set('columnOrder', [...next.order]);
        });
        if (!sameRecord(next.pins, this.pins)) {
            this.pins = next.pins;
            this.host.requestRender();
        }
    }

    private viewModel(): ViewModel {
        const { model } = this.host;
        return {
            layout: this.overrides(),
            sort: model.get('sortState'),
            sortStates: model.get('multiSortState'),
            columnFilters: model.get('columnFilters'),
            advancedFilter: model.get('advancedFilter'),
            globalFilter: model.get('globalFilter'),
            pagination: model.get('paginationState'),
        };
    }

    private isLastVisibleDataColumn(key: string): boolean {
        const data = this.current().columns.filter((c) => !isSpecialColumn(c));
        return data.length === 1 && String(data[0]?.accessorKey) === key;
    }

    /** The visibility checkbox flipped itself before the refusal: put it back once the panel has rendered. */
    private keepChecked(key: string): void {
        const { config, resolvedLocale: locale, root } = this.host;
        const column = config.columns.find((c) => String(c.accessorKey) === key);
        const label = interpolate(locale.toggleColumnAriaLabel, { column: column?.header ?? key });
        this.host.afterRender(() => {
            for (const box of root.querySelectorAll<HTMLElement & { checked: boolean }>('[data-slot="data-table-columns-panel"] ge-checkbox')) {
                if (box.getAttribute('aria-label') === label) box.checked = true;
            }
        });
    }

    private readonly service: ColumnsService<T> = {
        enhancedColumns: (): readonly EnhancedColumnDef<T>[] => this.current().columns,
        navigableKeys: () =>
            this.current()
                .columns.filter((c) => !isSpecialColumn(c))
                .map((c) => String(c.accessorKey)),
        focusableKeys: () =>
            this.current()
                .columns.filter((c) => c.accessorKey !== '_actions')
                .map((c) => String(c.accessorKey)),
        pinOf: (key) => this.current().columns.find((c) => String(c.accessorKey) === key)?._pin,
        liveWidth: (key, px) => {
            if (px === null && !this.live.has(key)) return;
            const next = new Map(this.live);
            if (px === null) next.delete(key);
            else next.set(key, px);
            this.live = next;
        },
        getState: (): DataTableColumnState[] => readColumnState(this.host.config.columns, this.overrides()),
        applyState: (states) => this.writeOverrides(applyColumnState(this.overrides(), states)),
        getViewState: () => readViewState(this.host.config.columns, this.viewModel()),
        applyViewState: (state) => {
            const next = applyViewState(this.viewModel(), state);
            if (next === null) return false;
            const { model } = this.host;
            // wave5: a restore that changes a filter is ONE filter change: numbered once, before the batch (older announcements say nothing).
            // A changed global text is announced like a typed one (the column / advanced part is the filter UI's, when it changed).
            const globalChange = model.get('globalFilter') !== next.globalFilter;
            const filtersChange = globalChange || !sameStructure(model.get('columnFilters'), next.columnFilters) || !sameStructure(model.get('advancedFilter') ?? null, next.advancedFilter ?? null);
            if (filtersChange) this.host.provider('query')?.filterChanged(globalChange ? next.globalFilter : undefined);
            // One batch; `paginationState` flushes last, and these writes bypass the filter handlers whose page reset would clobber it.
            model.batch(() => {
                this.writeOverrides(next.layout);
                model.set('sortState', next.sort);
                model.set('multiSortState', next.sortStates);
                model.set('columnFilters', next.columnFilters);
                model.set('advancedFilter', next.advancedFilter);
                model.set('globalFilter', next.globalFilter);
                model.set('paginationState', next.pagination);
            });
            return true;
        },
        move: (key, targetIndex) => {
            const { config, model } = this.host;
            const base = baseColumnOrder(config.columns, model.get('columnOrder'));
            // Only inside the column's pin group, like a drag: the layout draws the groups apart, so a move across them could not show.
            const next = moveToIndex(base, pinGroupOf(this.current().columns, key) ?? [], key, targetIndex);
            if (next) model.set('columnOrder', next);
        },
        setPin: (key, pin) => {
            this.pins = Object.fromEntries([...Object.entries(this.pins), [key, pin]]);
            this.host.requestRender();
        },
        setVisible: (key, visible) => {
            const name = String(key);
            if (!visible && this.isLastVisibleDataColumn(name)) return this.keepChecked(name);
            const next = Object.fromEntries([...Object.entries(this.host.model.get('columnVisibility')), [name, visible]]);
            this.host.model.set('columnVisibility', next);
        },
        showAll: () => {
            if (Object.keys(this.host.model.get('columnVisibility')).length > 0) this.host.model.set('columnVisibility', {});
        },
    };

    private unprovide: (() => void) | undefined;

    attach(): void {
        this.unprovide = this.host.provide('columns', this.service);
    }

    detach(): void {
        this.unprovide?.();
        this.last = null;
        this.live = new Map();
    }

    hostUpdate(): void {
        const { columns } = this.host.config;
        if (this.warned !== columns) {
            this.warned = columns;
            const dupes = duplicateColumnKeys(columns);
            if (dupes.length > 0) console.warn(`[ge-data-table] Duplicate accessorKey values: [${dupes.join(', ')}]. Only the first column of each key is drawn.`);
        }
        const next = this.current();
        if (next !== this.last) {
            this.last = next;
            this.host.topics.emit('columns');
        }
    }
}
