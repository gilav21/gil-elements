import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { chromeIcon } from './data-table-icons.js';
import { BUILT_IN_FILTER_PANELS, builderColumns, currentFilterValue, EMPTY_GROUP, FILTER_ANNOUNCE_MS, builtInPanelOf, filterInputsOf, hasAnyFloatingFilter, hasFilterTrigger, hasFloatingFilter, isFilterActive, sameStructure } from './data-table-filters.js';
import type { FilterUiService } from './data-table-grid-filters.js';
import { composedContains, type DataTableCoreHost, requireProvider, VIEWPORT } from './data-table-host.js';
import { type LazyElement, lazyElement } from './data-table-lazy.js';
import { countConditions, memoLast } from './data-table-query.js';
import { EN_FILTER_BUILDER_LABELS, type FilterBuilderLabels, interpolate } from './data-table.locales.js';
import type { ColumnDef, ComponentOutputs, FilterGroup } from './data-table.types.js';

/** The header panel's `ge-popover` as the scroll watch uses it. */
type PanelPopover = HTMLElement & { hide(): void };

const panels = (): Promise<unknown> => import('./lazy/filter-panels.js');
/** The ready-made panels (one lazy entry defines all three, with `ge-calendar` and `ge-command`): loaded when a trigger carrying one is hovered, focused or opened. */
const PANELS: ReadonlyMap<string, LazyElement> = new Map(BUILT_IN_FILTER_PANELS.map((tag) => [tag, lazyElement(tag, panels)]));
const BUILDER = lazyElement('ge-data-table-filter-builder', () => import('./lazy/filter-builder.js'));

interface ColumnHandlers {
    set: (value: unknown) => void;
    change: (event: Event) => void;
    input: (event: Event) => void;
    toggle: (event: CustomEvent<boolean>) => void;
    /** The trigger's hover and focus: starts loading the column's lazy panel. */
    prefetch: () => void;
    /** The header panel's listeners, kept for the consumer's `filterComponentOutputs` OBJECT (the cache key; the column object may be rebuilt every render). */
    panel?: { readonly own: object | null; readonly outputs: ComponentOutputs };
    /** The floating component's listeners: only the table's `filter-change`. */
    floating: ComponentOutputs;
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
    /** The pending debounced floating-input writes, by column key: the timer's cancel and the text it will write (what the input shows meanwhile). */
    private readonly pending = new Map<string, { cancel: () => void; text: string }>();
    /** Stable per-column handlers, so the component listeners and the input's `@input` are not re-bound at every render; dropped at detach. */
    private readonly handlers = new Map<string, ColumnHandlers>();

    /** Drops the floating writes still waiting on their debounce: all of them, or those of the given columns. */
    private dropPending(keys?: Iterable<string>): void {
        for (const key of keys ?? [...this.pending.keys()]) {
            this.pending.get(key)?.cancel();
            this.pending.delete(key);
        }
    }

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: FilterUiService<T> = {
        isActive: (key) => isFilterActive(this.host.model.get('columnFilters'), key),
        hasFloating: (column) => hasFloatingFilter(column),
        hasAnyFloating: () => hasAnyFloatingFilter(this.host.provider('columns')?.enhancedColumns() ?? this.host.config.columns),
        advancedCount: () => countConditions(this.host.model.get('advancedFilter')),
        hasTrigger: (column) => hasFilterTrigger(column),
        panelOpen: (key) => this.openColumn === key,
        onPanelToggle: (key) => this.handlersOf(key).toggle,
        prefetch: (key) => this.handlersOf(key).prefetch,
        panelInputs: (column) => this.panelInputs(column),
        panelOutputs: (column) => this.panelOutputs(column),
        floatingOutputs: (column) => this.handlersOf(String(column.accessorKey)).floating,
        setter: (key) => this.handlersOf(key).set,
        floatingInput: (key) => this.handlersOf(key).input,
        floatingText: (key) => this.pending.get(key)?.text,
    };

    attach(): void {
        const { model } = this.host;
        // A latched load failure of an earlier attach is retried (a load in flight, e.g. another table's, is left alone).
        for (const lazy of [...PANELS.values(), BUILDER]) lazy.resetIfFailed();
        let last = model.get('columnFilters');
        let lastAdvanced = model.get('advancedFilter') ?? null;
        this.teardown = [
            this.host.provide('filters', this.service),
            model.subscribe('columnFilters', (filters, origin) => {
                // A floating write still waiting on its debounce is dropped when ITS column's filter changed under it (the consumer reset it, a view
                // was restored, a panel wrote it): it was typed against a value that is gone. Other columns' waiting text stays, and an echo (a new
                // but structurally equal object) changes no column.
                const changed = [...this.pending.keys()].filter((key) => !sameStructure(last[key], filters[key]));
                const same = sameStructure(last, filters);
                last = filters;
                this.dropPending(changed);
                // Only a table write that CHANGED the filters is announced (a restored view that changed only the sort rewrites an equal object).
                if (origin === 'internal' && !same) this.scheduleAnnouncement();
            }),
            model.subscribe('advancedFilter', (group, origin) => {
                const same = sameStructure(lastAdvanced, group ?? null);
                lastAdvanced = group ?? null;
                if (origin === 'internal' && !same) this.scheduleAnnouncement();
            }),
        ];
    }

    detach(): void {
        // The open builder's typed value still waiting on the debounce goes in FIRST, while the query service exists (the table detaches before its
        // builder disconnects, so the builder's own flush would come too late).
        this.builder?.flush?.();
        this.builder = undefined;
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
        this.cancelAnnounce?.();
        this.cancelAnnounce = undefined;
        this.dropPending();
        this.handlers.clear();
        this.stopScrollWatch();
        this.openColumn = null;
        this.builderOpen = false;
    }

    /** The toolbar slot after the global filter input: the advanced-filter trigger and its builder popover (html 380-413). */
    renderToolbar(): TemplateResult | null {
        const { config, model, resolvedLocale } = this.host;
        if (!config.enableAdvancedFilter) return null;
        const labels = this.builderLabels(resolvedLocale.advancedFilter);
        const group = model.get('advancedFilter');
        const count = countConditions(group);
        return html`<ge-popover @open-change=${this.onBuilderToggle}>
            <ge-popover-trigger><button type="button" data-slot="advanced-filter-trigger" aria-label=${count > 0 ? `${labels.filterButton} (${count})` : labels.filterButton}
                @pointerenter=${this.prefetchBuilder} @focus=${this.prefetchBuilder}>${chromeIcon('filter', 'xs')}<span data-hide-below="sm">${labels.filterButton}</span>${count > 0 ? html`<span data-slot="data-table-count-badge" aria-hidden="true">${count}</span>` : nothing}</button></ge-popover-trigger>
            <ge-popover-content data-slot="advanced-filter-panel">${this.builderOpen
                ? html`<div data-slot="advanced-filter-body"><ge-data-table-filter-builder ${ref(this.onBuilderRef)} .group=${group ?? EMPTY_GROUP} .columns=${this.builderColumns(config.columns)} .labels=${labels} .debounce=${config.filterDebounce} @group-change=${this.onGroupChange}></ge-data-table-filter-builder>${count > 0
                      ? html`<button type="button" data-slot="advanced-filter-clear" @click=${this.onClear}>${labels.clearFilters}</button>`
                      : nothing}</div>`
                : nothing}</ge-popover-content>
        </ge-popover>`;
    }

    // The builder's inputs keep their identity while their sources do, so a table render that changes nothing of them does not re-render the builder.
    private readonly builderColumns = memoLast((columns: readonly ColumnDef<T>[]) => builderColumns(columns));
    private readonly builderLabels = memoLast((own: Partial<FilterBuilderLabels> | undefined) => ({ ...EN_FILTER_BUILDER_LABELS, ...own }));

    private readonly prefetchBuilder = (): void => void BUILDER.load();

    /**
     * The drawn builder (lazy: its `flush` exists once it is defined), for the flush at detach. An `undefined` from the ref is ignored: the table's own
     * disconnect clears its refs BEFORE its controllers detach. It is dropped when the builder popover closes (the builder's own disconnect flushes then).
     */
    private builder: { flush?: () => void } | undefined;
    private readonly onBuilderRef = (el: Element | undefined): void => {
        if (el) this.builder = el as { flush?: () => void };
    };

    private readonly onBuilderToggle = (event: CustomEvent<boolean>): void => {
        if (event.target !== event.currentTarget) return; // a popover inside the builder
        if (!event.detail) {
            // The typed value still waiting on the debounce is reported NOW, from this event, before the render that removes the builder: its own
            // disconnect flush would write the filter DURING the table's render (a change in update).
            this.builder?.flush?.();
            this.builder = undefined;
        }
        this.builderOpen = event.detail;
        if (event.detail) this.prefetchBuilder();
        this.host.requestRender();
    };

    private readonly onGroupChange = (event: CustomEvent<FilterGroup>): void => {
        event.stopPropagation();
        // `?.`: the detach flushes the builder first, so this is only a guard for an event that still arrives after it.
        this.host.provider('query')?.changeAdvancedFilter(event.detail);
    };

    /** "Clear all filters" clears the ADVANCED filter only (Angular cmp 1169, D9). */
    private readonly onClear = (): void => requireProvider(this.host, 'query').changeAdvancedFilter(null);

    private prefetch(column: ColumnDef<T>): void {
        const builtIn = builtInPanelOf(column.filterComponent); // case-insensitive, like a tag name
        const lazy = builtIn ? PANELS.get(builtIn) : undefined;
        if (lazy && !lazy.ready() && !lazy.requested()) void lazy.load();
    }

    private panelInputs(column: ColumnDef<T>): Record<string, unknown> {
        const key = String(column.accessorKey);
        const filters = this.host.model.get('columnFilters');
        // The ready-made panels follow the table's locale (Angular: the injected locale id); a consumer's own component is given only its contract.
        // The id the consumer gave wins over the resolved dictionary's code: a calendar dictionary may exist for a language the table has none for.
        // The multiselect panel reads the TABLE dictionary: it gets the resolved object itself, so the labels of a custom locale object reach it.
        // The date panels read the CALENDAR dictionary (Today, Clear, presets), a separate registry: they get its id.
        const { locale } = this.host.config;
        const panel = builtInPanelOf(column.filterComponent);
        const calendarId = typeof locale === 'string' && locale ? locale : this.host.resolvedLocale.code;
        const own = panel ? { locale: panel === 'ge-data-table-multiselect-filter' ? this.host.resolvedLocale : calendarId } : {};
        return { ...own, ...filterInputsOf(column), column, value: currentFilterValue(filters, key) };
    }

    /**
     * The header panel's listeners: the consumer's `filterComponentOutputs`, with its own `filter-change` (if any) COMPOSED with the table's,
     * consumer first: the table never replaces a handler the consumer gave. Kept in the column's ONE handlers entry (by accessorKey, dropped at
     * detach) for the consumer's `filterComponentOutputs` object, so the panel's listeners keep their identity across renders.
     */
    private panelOutputs(column: ColumnDef<T>): ComponentOutputs {
        const handlers = this.handlersOf(String(column.accessorKey));
        const ownKey = column.filterComponentOutputs ?? null;
        if (handlers.panel && handlers.panel.own === ownKey) return handlers.panel.outputs;
        const own = column.filterComponentOutputs ?? {};
        const table = handlers.change;
        const consumer = own['filter-change'];
        const outputs: ComponentOutputs = {
            ...own,
            'filter-change': consumer
                ? (event) => {
                      consumer(event);
                      table(event);
                  }
                : table,
        };
        handlers.panel = { own: ownKey, outputs };
        return outputs;
    }

    private handlersOf(key: string): ColumnHandlers {
        let handlers = this.handlers.get(key);
        if (handlers) return handlers;
        const set = (value: unknown): void => {
            this.dropPending([key]); // this write supersedes the column's own waiting text
            this.host.provider('query')?.changeColumnFilter(key, value);
        };
        const change = (event: Event): void => {
            // The panel's event bubbles and is composed: stopped here, so it never reaches a listener of the table's own (global) `filter-change` (D4).
            event.stopPropagation();
            set((event as CustomEvent).detail ?? null);
        };
        // The column as drawn now, read when the handler runs (the handler outlives a column object rebuilt by a render).
        const prefetch = (): void => {
            const column = this.host.provider('columns')?.enhancedColumns().find((c) => String(c.accessorKey) === key);
            if (column) this.prefetch(column);
        };
        handlers = {
            set,
            change,
            prefetch,
            floating: { 'filter-change': change },
            input: (event) => {
                const value = (event.currentTarget as HTMLInputElement).value;
                const debounce = this.host.config.filterDebounce;
                if (debounce <= 0) return set(value);
                this.pending.get(key)?.cancel();
                const cancel = this.host.disposables.timeout(() => {
                    this.pending.delete(key);
                    set(value);
                }, debounce);
                this.pending.set(key, { cancel, text: value });
            },
            toggle: (event) => {
                if (event.target !== event.currentTarget) return; // a popover inside the panel (a month select)
                if (event.detail) {
                    this.openColumn = key;
                    this.watchScroll(event.currentTarget as PanelPopover);
                    prefetch();
                } else if (this.openColumn === key) {
                    this.openColumn = null;
                    this.stopScrollWatch();
                }
                this.host.requestRender();
            },
        };
        this.handlers.set(key, handlers);
        return handlers;
    }

    private stopScroll: (() => void) | undefined;

    private stopScrollWatch(): void {
        this.stopScroll?.();
        this.stopScroll = undefined;
    }

    /**
     * The open header panel closes on a scroll OUTSIDE the table (the page, an ancestor scroller: its anchor moved away), not on one of the table's own
     * (`close-on-scroll` would close it on both). A scroll of the table's viewport moves the trigger, and the fixed panel follows it; only when it scrolls
     * the trigger out of the viewport's box does the panel close. The scroll inside the panel itself (an option list) is the table's too.
     * Armed after this task, like the popover's own watch: the scroll a click-to-open causes does not close it at once.
     */
    private watchScroll(popover: PanelPopover): void {
        this.stopScrollWatch();
        const onScroll = (event: Event): void => {
            const target = event.composedPath()[0] as Node | undefined;
            if (target instanceof Node && composedContains(this.host.root, target)) {
                const viewport = this.host.root.querySelector<HTMLElement>(VIEWPORT);
                const trigger = popover.querySelector('[data-slot="data-table-filter-trigger"]'); // the button (`ge-popover-trigger` draws no box of its own)
                if (!viewport || !trigger) return;
                const box = viewport.getBoundingClientRect();
                const at = trigger.getBoundingClientRect();
                if (at.right > box.left && at.left < box.right && at.bottom > box.top && at.top < box.bottom) return;
            }
            popover.hide();
        };
        const timer = setTimeout(() => {
            globalThis.addEventListener('scroll', onScroll, { capture: true, passive: true });
            this.stopScroll = () => globalThis.removeEventListener('scroll', onScroll, { capture: true });
        }, 0);
        this.stopScroll = () => clearTimeout(timer);
    }

    /** One polite message once the column and advanced filter edits have settled: the rows that match now, or that every filter is cleared (D7). */
    private scheduleAnnouncement(): void {
        this.cancelAnnounce?.();
        // The change this announcement is for: a later filter change (a global one too, in the query controller) makes it an older one, which says nothing.
        const seq = this.host.provider('query')?.filterSeq() ?? 0;
        this.cancelAnnounce = this.host.disposables.timeout(() => {
            this.cancelAnnounce = undefined;
            const query = this.host.provider('query');
            if (!query || seq < query.filterSeq()) return;
            const { model, resolvedLocale: locale } = this.host;
            const filters = model.get('columnFilters');
            // A filter "on" is one that filters: a set value on a column with `enableFiltering` (a key of another column is skipped by the pipeline),
            // an advanced condition, or the global text.
            const filtering = new Set(this.host.config.columns.filter((c) => c.enableFiltering).map((c) => String(c.accessorKey)));
            const any =
                Object.keys(filters).some((key) => filtering.has(key) && isFilterActive(filters, key)) || countConditions(model.get('advancedFilter')) > 0 || model.get('globalFilter').trim() !== '';
            if (!any) return this.host.announce(locale.filtersClearedAnnouncement);
            const say = (count: number): void => this.host.announce(count === 1 ? locale.filteredRowOneAnnouncement : interpolate(locale.filteredRowsAnnouncement, { count }));
            // ONE rule with the global filter: the query service says the count now, or (server filtering) once the query's answer is in, or never
            // (no total); a newer filter change drops a waiting one.
            query.whenCounted(say, seq);
        }, FILTER_ANNOUNCE_MS);
    }
}
