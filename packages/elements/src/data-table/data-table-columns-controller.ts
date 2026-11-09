import { type ColumnLayout, computeColumnLayout, duplicateColumnKeys, isSpecialColumn } from './data-table-columns.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { ColumnsService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';
import type { EnhancedColumnDef } from './data-table.types.js';

type Pin = 'left' | 'right' | undefined;

/** Resolves the drawn columns from the definitions and the user's runtime overrides, and serves them as `columns`. */
export class ColumnsController<T> {
    private pins: Readonly<Record<string, Pin>> = {};
    private last: ColumnLayout<T> | null = null;
    private warned: unknown = null;

    private readonly layout = memoLast(
        (columns: DataTableCoreHost<T>['config']['columns'], widths: Record<string, string>, visibility: Record<string, boolean>, order: string[], pins: Readonly<Record<string, Pin>>, selection: boolean, expansion: boolean) =>
            computeColumnLayout<T>({ columns, widths, visibility, order, pins, enableRowSelection: selection, enableRowExpansion: expansion, hasActions: false }),
    );

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private current(): ColumnLayout<T> {
        const { config, model } = this.host;
        return this.layout(
            config.columns,
            model.get('columnWidths'),
            model.get('columnVisibility'),
            model.get('columnOrder'),
            this.pins,
            config.enableRowSelection,
            config.enableRowExpansion,
        );
    }

    private readonly service: ColumnsService<T> = {
        enhancedColumns: (): readonly EnhancedColumnDef<T>[] => this.current().columns,
        navigableKeys: () =>
            this.current()
                .columns.filter((c) => !isSpecialColumn(c))
                .map((c) => String(c.accessorKey)),
        pinOf: (key) => this.current().columns.find((c) => String(c.accessorKey) === key)?._pin,
        setPin: (key, pin) => {
            this.pins = Object.fromEntries([...Object.entries(this.pins), [key, pin]]);
            this.host.requestRender();
        },
        setVisible: (key, visible) => {
            const next = Object.fromEntries([...Object.entries(this.host.model.get('columnVisibility')), [String(key), visible]]);
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
