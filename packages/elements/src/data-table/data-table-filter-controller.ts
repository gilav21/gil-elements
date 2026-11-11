import type { TemplateResult } from 'lit';
import type { DataTableCoreHost } from './data-table-host.js';
import { lazyElement } from './data-table-lazy.js';
import type { FilterService } from './data-table-providers.js';

/**
 * The column and advanced filter UI (wave 5, package A owns this file): the toolbar's advanced-filter trigger and badge, the debounced
 * result announcement, and the prefetch of the lazy panels and builder. It owns no model state (the model owns `columnFilters` and
 * `advancedFilter`). Joint step 0: it provides an inert `filters` service and draws nothing.
 */
export class FilterUiController<T> {
    private unprovide: (() => void) | undefined;

    /** The advanced filter builder (`lazy/filter-builder.ts`); the three panels are `lazy/filter-panels.ts`. */
    protected readonly builder = lazyElement('ge-data-table-filter-builder', () => import('./lazy/filter-builder.js'));
    protected readonly panels = lazyElement('ge-data-table-date-filter', () => import('./lazy/filter-panels.js'));

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: FilterService<T> = {
        isActive: () => false,
        hasFloating: () => false,
        hasAnyFloating: () => false,
        advancedCount: () => 0,
    };

    /** Starts loading the lazy elements (a trigger was hovered or focused). A failed load is reported once and latched by `lazyElement`, not swallowed. */
    prefetch(): void {
        void this.builder.load();
        void this.panels.load();
    }

    attach(): void {
        this.builder.reset();
        this.panels.reset();
        this.unprovide = this.host.provide('filters', this.service);
    }

    detach(): void {
        this.unprovide?.();
    }

    /** The toolbar slot after the global filter input (the advanced-filter trigger, later the natural-language box). */
    renderToolbar(): TemplateResult | null {
        return null;
    }
}
