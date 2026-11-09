import { cellAddressOf, type DataTableCoreHost, requireProvider } from './data-table-host.js';
import type { SelectionService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';
import {
    cascadeSelection,
    createIndeterminateIds,
    headerState,
    isSelectedId,
    patchSelection,
    rangeBetween,
    selectableIds,
    toggleAllSelection,
    toggleId,
} from './data-table-selection.js';
import type { FlattenedTreeRow } from './data-table.types.js';

const NO_ROWS: readonly never[] = [];

/** What the element offers beyond the core host: the disabled test needs `isRowDisabled`, which only the element holds. */
interface DisabledAware<T> {
    isDisabled?(row: T): boolean;
    isRowDisabled?: unknown;
}

/**
 * Owns `rowSelection` (and nothing else): every write is a new record, so `row-selection-change` fires once per command.
 * The checkboxes are handled by delegated listeners on the element, never per cell; Space on a focused cell toggles its row.
 */
export class SelectionController<T> {
    private teardowns: (() => void)[] = [];
    private anchor: string | null = null;
    private shift = false;
    private readonly indeterminate = createIndeterminateIds();

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private get query() {
        return requireProvider(this.host, 'query');
    }

    private isDisabled(row: T): boolean {
        const host = this.host as DataTableCoreHost<T> & DisabledAware<T>;
        if (host.isDisabled) return host.isDisabled(row);
        const ids = this.host.config.disabledRowIds;
        const id = this.host.config.getRowId(row);
        return ids === undefined ? false : 'has' in ids ? ids.has(id) : ids.includes(id);
    }

    private readonly rowsOf = memoLast((visible: readonly FlattenedTreeRow<T>[], sorted: readonly T[], tree: boolean): readonly T[] => (tree ? visible.map((r) => r.row) : sorted));

    /** The rows a header action covers: the filtered rows of EVERY page, or the visible tree rows (expanded nodes only). */
    private listed(): readonly T[] {
        const tree = this.host.config.enableSubRows;
        return this.rowsOf(tree ? this.query.visibleTreeRows() : NO_ROWS, tree ? NO_ROWS : this.query.sortedData(), tree);
    }

    private readonly selectableOf = memoLast((rows: readonly T[], _disabledIds: unknown, _disabledFn: unknown, getId: (row: T) => string): string[] =>
        selectableIds(rows, getId, (row) => this.isDisabled(row)),
    );

    private selectable(): string[] {
        const { config } = this.host;
        return this.selectableOf(this.listed(), config.disabledRowIds, (this.host as DisabledAware<T>).isRowDisabled, config.getRowId);
    }

    private readonly headerOf = memoLast((selection: Record<string, boolean>, selectable: string[]) => headerState(selection, selectable));

    private write(next: Record<string, boolean>): void {
        this.host.model.set('rowSelection', next);
    }

    private readonly service: SelectionService<T> = {
        isSelected: (id) => isSelectedId(this.host.model.get('rowSelection'), id),
        isDisabled: (row) => this.isDisabled(row),
        toggleRow: (row) => {
            if (this.isDisabled(row)) return;
            const id = this.host.config.getRowId(row);
            this.anchor = id;
            this.write(toggleId(this.host.model.get('rowSelection'), id));
        },
        toggleRowCascade: (row) => {
            const { config, model } = this.host;
            if (!config.enableSubRows || config.subRowSelectionMode === 'self') return this.service.toggleRow(row);
            if (this.isDisabled(row)) return;
            const id = config.getRowId(row);
            const visible = new Set(this.query.visibleTreeRows().map((r) => config.getRowId(r.row)));
            this.anchor = id;
            this.write(cascadeSelection(model.get('rowSelection'), id, config.subRowSelectionMode, this.query.treeIndex(), visible));
        },
        toggleAll: () => this.write(toggleAllSelection(this.host.model.get('rowSelection'), this.selectable())),
        selectRows: (rows) => this.write(patchSelection(this.host.model.get('rowSelection'), rows.map(this.host.config.getRowId), true)),
        unselectRows: (rows) => this.write(patchSelection(this.host.model.get('rowSelection'), rows.map(this.host.config.getRowId), false)),
        clearSelection: () => {
            if (Object.keys(this.host.model.get('rowSelection')).length > 0) this.write({});
        },
        selectAll: () => {
            const selection = this.host.model.get('rowSelection');
            const selectable = this.selectable();
            if (!selectable.every((id) => isSelectedId(selection, id))) this.write(patchSelection(selection, selectable, true));
        },
        header: () => this.headerOf(this.host.model.get('rowSelection'), this.selectable()),
        isIndeterminate: (id) => {
            const { config, model } = this.host;
            return config.enableSubRows && config.subRowSelectionMode !== 'self' && this.indeterminate(model.get('rowSelection'), this.query.treeIndex(), config.subRowSelectionMode).has(id);
        },
    };

    /** A range of the drawn rows between the last toggled row and this one takes the state the clicked checkbox now shows. */
    private selectRange(id: string, on: boolean): boolean {
        const { config, model } = this.host;
        if (this.anchor === null || this.anchor === id || (config.enableSubRows && config.subRowSelectionMode !== 'self')) return false;
        const drawn = this.query.renderedRows().filter((row) => !this.isDisabled(row));
        const ids = rangeBetween(drawn.map(config.getRowId), this.anchor, id);
        if (!ids) return false;
        this.anchor = id;
        this.write(patchSelection(model.get('rowSelection'), ids, on));
        return true;
    }

    private readonly onChange = (event: Event): void => {
        const box = event.target;
        if (!(box instanceof Element) || !box.matches('ge-checkbox')) return;
        const cell = box.closest('[data-special="selection"]');
        if (!cell) return;
        const shift = this.shift;
        this.shift = false;
        if (cell.matches('[data-slot="table-head"]')) {
            this.service.toggleAll();
            (box as HTMLElement & { checked: boolean }).checked = this.service.header().checked;
            return;
        }
        const address = cellAddressOf(cell);
        const row = address ? this.query.renderedRowAt(address.rowIndex) : undefined;
        if (row === undefined) return;
        const id = this.host.config.getRowId(row);
        const checkbox = box as HTMLElement & { checked: boolean };
        if (!(shift && !this.isDisabled(row) && this.selectRange(id, checkbox.checked))) {
            if (this.host.config.enableSubRows) this.service.toggleRowCascade(row);
            else this.service.toggleRow(row);
        }
        // The checkbox flipped itself on the click; if the table refused (or settled elsewhere) it shows the truth again.
        checkbox.checked = this.service.isSelected(id);
    };

    /** Shift is only on the click, not on the `change` it causes, so it is read on the way down. */
    private readonly onClick = (event: MouseEvent): void => {
        this.shift = event.shiftKey && event.target instanceof Element && event.target.closest('[data-special="selection"]') !== null;
    };

    private readonly onKey = (event: KeyboardEvent): boolean => {
        if (!this.host.config.enableRowSelection || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return false;
        if (event.key !== ' ' && event.key !== 'Enter') return false;
        const cell = event.target;
        if (!(cell instanceof Element) || !cell.matches('[data-slot="table-cell"]')) return false;
        const address = cellAddressOf(cell);
        if (!address || address.columnKey === '_expander' || address.columnKey === '_actions') return false;
        if (event.key === 'Enter' && address.columnKey !== '_selection') return false;
        const row = this.query.renderedRowAt(address.rowIndex);
        if (row === undefined) return false;
        event.preventDefault();
        if (this.host.config.enableSubRows) this.service.toggleRowCascade(row);
        else this.service.toggleRow(row);
        return true;
    };

    attach(): void {
        const { host } = this;
        this.teardowns = [
            host.provide('selection', this.service),
            host.model.subscribe('rowSelection', () => host.topics.emit('selection')),
            host.disposables.listen<MouseEvent>(host.root, 'click', this.onClick, true),
            host.disposables.listen(host.root, 'change', this.onChange),
            host.addKeyHandler(50, this.onKey),
        ];
    }

    detach(): void {
        for (const teardown of this.teardowns.splice(0).reverse()) teardown();
        this.anchor = null;
    }
}
