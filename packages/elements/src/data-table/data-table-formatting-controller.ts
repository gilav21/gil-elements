import { resolveCellFormatting } from './data-table-cells.js';
import type { DataTableCoreHost } from './data-table-host.js';

/** Conditional formatting (class rules, style rules, colour scale, data bar, icon set) served as `formatting`. No flash yet. */
export class FormattingController<T> {
    private unprovide: (() => void) | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    attach(): void {
        this.unprovide = this.host.provide('formatting', { cell: resolveCellFormatting });
    }

    detach(): void {
        this.unprovide?.();
    }
}
