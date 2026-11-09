import { footerValues, hasFooterRow } from './data-table-cells.js';
import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import type { FooterService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';
import type { ColumnDef } from './data-table.types.js';

/** The footer row: whether it draws, and each column's text over ALL filtered rows (not just the page). */
export class FooterController<T> {
    private unprovide: (() => void) | undefined;
    private readonly compute = memoLast((columns: readonly ColumnDef<T>[], rows: readonly T[]) => footerValues(columns, rows));

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: FooterService = {
        visible: () => hasFooterRow(this.host.config.showFooter, requireProvider(this.host, 'columns').enhancedColumns()),
        values: () => (this.service.visible() ? this.compute(requireProvider(this.host, 'columns').enhancedColumns(), requireProvider(this.host, 'query').sortedData()) : new Map()),
    };

    attach(): void {
        this.unprovide = this.host.provide('footer', this.service);
    }

    detach(): void {
        this.unprovide?.();
    }
}
