import type { TemplateResult } from 'lit';
import type { DataTableCoreHost } from './data-table-host.js';
import type { FilterService } from './data-table-providers.js';

/**
 * The column and advanced filter UI (wave 5, package A owns this file): the toolbar's advanced-filter trigger and badge, the debounced
 * result announcement. It owns no model state (the model owns `columnFilters` and `advancedFilter`). Joint step 0: it provides an inert `filters`
 * service and draws nothing. Package A adds, together with the triggers that use them, the lazy elements of its two build entries
 * (`lazyElement('ge-data-table-filter-builder', () => import('./lazy/filter-builder.js'))` and the panels' `lazy/filter-panels.js`, see
 * `data-table-lazy.ts`) and their prefetch on hover and focus.
 */
export class FilterUiController<T> {
    private unprovide: (() => void) | undefined;

    constructor(protected readonly host: DataTableCoreHost<T>) {}

    private readonly service: FilterService<T> = {
        isActive: () => false,
        hasFloating: () => false,
        hasAnyFloating: () => false,
        advancedCount: () => 0,
    };

    attach(): void {
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
