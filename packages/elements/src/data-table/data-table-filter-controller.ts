import { html, nothing, svg, type TemplateResult } from 'lit';
import { builderColumns, emptyGroup, filterInputsOf, hasAnyFloatingFilter, hasFilterTrigger, hasFloatingFilter, isFilterActive } from './data-table-filters.js';
import type { FilterUiService } from './data-table-grid-filters.js';
import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { type LazyElement, lazyElement } from './data-table-lazy.js';
import { countConditions } from './data-table-query.js';
import { EN_FILTER_BUILDER_LABELS, interpolate } from './data-table.locales.js';
import type { ColumnDef, ComponentOutputs, FilterGroup } from './data-table.types.js';

const FILTER_GLYPH = svg`<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z" />`;

/** The `filter` glyph of `ge-icon` inline (the header trigger and the toolbar trigger); `solid` is its filled weight (fill, no stroke), the "filter applied" state. */
export const filterIcon = (px: number, solid = false): TemplateResult =>
    html`<span data-slot="dt-icon"><svg xmlns="http://www.w3.org/2000/svg" width=${px} height=${px} viewBox="0 0 24 24" fill=${solid ? 'currentColor' : 'none'} stroke=${solid ? 'none' : 'currentColor'} stroke-width=${solid ? '0' : '2'} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FILTER_GLYPH}</svg></span>`;

/** How long the result announcement of a column or advanced filter waits for the edits to settle (D7). */
export const FILTER_UI_ANNOUNCE_MS = 500;

const panels = (): Promise<unknown> => import('./lazy/filter-panels.js');
/** The ready-made panels (one lazy entry defines all three, with `ge-calendar` and `ge-command`): loaded when a trigger carrying one is hovered, focused or opened. */
const PANELS: ReadonlyMap<string, LazyElement> = new Map(['ge-data-table-date-filter', 'ge-data-table-date-range-filter', 'ge-data-table-multiselect-filter'].map((tag) => [tag, lazyElement(tag, panels)]));
const BUILDER = lazyElement('ge-data-table-filter-builder', () => import('./lazy/filter-builder.js'));

interface ColumnHandlers {
    set: (value: unknown) => void;
    change: (event: Event) => void;
    input: (event: Event) => void;
    toggle: (event: CustomEvent<boolean>) => void;
}

/**
 * The column and advanced filter UI (wave 5, package A): the `filters` service (with the view's extra members, `FilterUiService`, read by
 * `data-table-grid-filters.ts`), the toolbar's advanced-filter trigger, badge and builder popover, the debounced floating text input and
 * the debounced result announcement (D7). It owns no model state: the model owns `columnFilters` and `advancedFilter`, written through the
 * `query` service. The panels and the builder are lazy (`lazy/filter-panels`, `lazy/filter-builder`), prefetched on hover and focus of their trigger.
 */
export class FilterUiController<T> {
    private teardown: (() => void)[] = [];
    /** The column whose panel popover is open (one at a time: opening another closes the first by its outside click). */
    private openColumn: string | null = null;
    private builderOpen = false;
    private cancelAnnounce: (() => void) | undefined;
    /** The pending debounced floating-input writes, by column key. */
    private readonly pending = new Map<string, () => void>();
    /** Stable per-column handlers, so the component listeners and the input's `@input` are not re-bound at every render; dropped at detach. */
    private readonly handlers = new Map<string, ColumnHandlers>();

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: FilterUiService<T> = {
        isActive: (key) => isFilterActive(this.host.model.get('columnFilters'), key),
        hasFloating: (column) => hasFloatingFilter(column),
        hasAnyFloating: () => hasAnyFloatingFilter(this.host.provider('columns')?.enhancedColumns() ?? this.host.config.columns),
        advancedCount: () => countConditions(this.host.model.get('advancedFilter')),
        hasTrigger: (column) => hasFilterTrigger(column),
        panelOpen: (key) => this.openColumn === key,
        onPanelToggle: (key) => this.handlersOf(key).toggle,
        prefetch: (column) => this.prefetch(column),
        panelInputs: (column) => this.panelInputs(column),
        panelOutputs: (column) => ({ ...column.filterComponentOutputs, 'filter-change': this.handlersOf(String(column.accessorKey)).change }) as ComponentOutputs,
        setter: (key) => this.handlersOf(key).set,
        floatingInput: (key) => this.handlersOf(key).input,
    };

    attach(): void {
        const { model } = this.host;
        // A latched load failure of an earlier attach is retried (a load in flight, e.g. another table's, is left alone).
        for (const lazy of [...PANELS.values(), BUILDER]) lazy.resetIfFailed();
        this.teardown = [
            this.host.provide('filters', this.service),
            model.subscribe('columnFilters', (_, origin) => origin === 'internal' && this.scheduleAnnouncement()),
            model.subscribe('advancedFilter', (_, origin) => origin === 'internal' && this.scheduleAnnouncement()),
        ];
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.cancelAnnounce?.();
        this.cancelAnnounce = undefined;
        for (const cancel of this.pending.values()) cancel();
        this.pending.clear();
        this.handlers.clear();
        this.openColumn = null;
        this.builderOpen = false;
    }

    /** The toolbar slot after the global filter input: the advanced-filter trigger and its builder popover (html 380-413). */
    renderToolbar(): TemplateResult | null {
        const { config, model, resolvedLocale } = this.host;
        if (!config.enableAdvancedFilter) return null;
        const labels = { ...EN_FILTER_BUILDER_LABELS, ...resolvedLocale.advancedFilter };
        const group = model.get('advancedFilter');
        const count = countConditions(group);
        return html`<ge-popover @open-change=${this.onBuilderToggle}>
            <ge-popover-trigger><button type="button" data-slot="advanced-filter-trigger" aria-label=${count > 0 ? `${labels.filterButton} (${count})` : labels.filterButton}
                @pointerenter=${this.prefetchBuilder} @focus=${this.prefetchBuilder}>${filterIcon(12)}<span data-hide-below="sm">${labels.filterButton}</span>${count > 0 ? html`<span data-slot="data-table-count-badge" aria-hidden="true">${count}</span>` : nothing}</button></ge-popover-trigger>
            <ge-popover-content data-slot="advanced-filter-panel">${this.builderOpen
                ? html`<div data-slot="advanced-filter-body"><ge-data-table-filter-builder .group=${group ?? emptyGroup()} .columns=${builderColumns(config.columns)} .labels=${labels} @group-change=${this.onGroupChange}></ge-data-table-filter-builder>${count > 0
                      ? html`<button type="button" data-slot="advanced-filter-clear" @click=${this.onClear}>${labels.clearFilters}</button>`
                      : nothing}</div>`
                : nothing}</ge-popover-content>
        </ge-popover>`;
    }

    private readonly prefetchBuilder = (): void => void BUILDER.load();

    private readonly onBuilderToggle = (event: CustomEvent<boolean>): void => {
        if (event.target !== event.currentTarget) return; // a popover inside the builder
        this.builderOpen = event.detail;
        if (event.detail) this.prefetchBuilder();
        this.host.requestRender();
    };

    private readonly onGroupChange = (event: CustomEvent<FilterGroup>): void => {
        event.stopPropagation();
        requireProvider(this.host, 'query').changeAdvancedFilter(event.detail);
    };

    /** "Clear all filters" clears the ADVANCED filter only (Angular cmp 1169, D9). */
    private readonly onClear = (): void => requireProvider(this.host, 'query').changeAdvancedFilter(null);

    private prefetch(column: ColumnDef<T>): void {
        const lazy = column.filterComponent ? PANELS.get(column.filterComponent) : undefined;
        if (lazy && !lazy.ready() && !lazy.requested()) void lazy.load();
    }

    private panelInputs(column: ColumnDef<T>): Record<string, unknown> {
        const key = String(column.accessorKey);
        const filters = this.host.model.get('columnFilters');
        // The ready-made panels follow the table's locale (Angular: the injected locale id); a consumer's own component is given only its contract.
        // The id the consumer gave wins over the resolved dictionary's code: a calendar dictionary may exist for a language the table has none for.
        const { locale } = this.host.config;
        const own = column.filterComponent && PANELS.has(column.filterComponent) ? { locale: typeof locale === 'string' && locale ? locale : this.host.resolvedLocale.code } : {};
        return { ...own, ...filterInputsOf(column), column, value: Object.hasOwn(filters, key) ? filters[key] : null };
    }

    private handlersOf(key: string): ColumnHandlers {
        let handlers = this.handlers.get(key);
        if (handlers) return handlers;
        const set = (value: unknown): void => {
            this.pending.get(key)?.();
            this.pending.delete(key);
            this.host.provider('query')?.changeColumnFilter(key, value);
        };
        handlers = {
            set,
            change: (event) => {
                // The panel's event bubbles and is composed: stopped here, so it never reaches a listener of the table's own (global) `filter-change` (D4).
                event.stopPropagation();
                set((event as CustomEvent).detail ?? null);
            },
            input: (event) => {
                const value = (event.currentTarget as HTMLInputElement).value;
                const debounce = this.host.config.filterDebounce;
                if (debounce <= 0) return set(value);
                this.pending.get(key)?.();
                this.pending.set(
                    key,
                    this.host.disposables.timeout(() => {
                        this.pending.delete(key);
                        this.host.provider('query')?.changeColumnFilter(key, value);
                    }, debounce),
                );
            },
            toggle: (event) => {
                if (event.target !== event.currentTarget) return; // a popover inside the panel (a month select)
                if (event.detail) {
                    this.openColumn = key;
                    const column = this.host.config.columns.find((c) => String(c.accessorKey) === key);
                    if (column) this.prefetch(column);
                } else if (this.openColumn === key) this.openColumn = null;
                this.host.requestRender();
            },
        };
        this.handlers.set(key, handlers);
        return handlers;
    }

    /** One polite message once the column and advanced filter edits have settled: the rows that match now, or that every filter is cleared (D7). */
    private scheduleAnnouncement(): void {
        this.cancelAnnounce?.();
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            this.cancelAnnounce = undefined;
            const { model, resolvedLocale: locale } = this.host;
            const filters = model.get('columnFilters');
            const any = Object.keys(filters).some((key) => isFilterActive(filters, key)) || countConditions(model.get('advancedFilter')) > 0 || model.get('globalFilter').trim() !== '';
            if (!any) return this.host.announce(locale.filtersClearedAnnouncement);
            const count = this.host.provider('query')?.filteredCount();
            if (count === undefined) return;
            this.host.announce(count === 1 ? locale.filteredRowOneAnnouncement : interpolate(locale.filteredRowsAnnouncement, { count }));
        }, FILTER_UI_ANNOUNCE_MS);
    }
}
