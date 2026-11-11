import { resolveCellFormatting } from './data-table-cells.js';
import type { DataTableCoreHost } from './data-table-host.js';

/**
 * Conditional formatting (class rules, style rules, colour scale, data bar, icon set) served as `formatting`. Cell flash (wave 6,
 * package C) joins here: `flash` answers which cells are flashing; joint step 0 answers none.
 */
export class FormattingController<T> {
    private unprovide: (() => void) | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    attach(): void {
        this.unprovide = this.host.provide('formatting', { cell: resolveCellFormatting, flash: () => undefined, anyFlashing: () => false });
    }

    detach(): void {
        this.unprovide?.();
    }
}
