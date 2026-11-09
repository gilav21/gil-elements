import {
    allFlagged,
    allNodesExpanded,
    collapseAllNodes,
    createListedRows,
    depthOf,
    expandAllNodes,
    isFlagged,
    nodeExpanded,
    setFlags,
    toggleFlag,
    treeHostKey,
    treeKeyAction,
    withFlag,
} from './data-table-expansion.js';
import { cellAddressOf, type DataTableCoreHost, ownEvents, requireProvider } from './data-table-host.js';
import type { ExpansionService } from './data-table-providers.js';
import { memoLast } from './data-table-query.js';

/**
 * Owns `expandedRows` (detail rows), `subRowExpandedRows` (tree nodes) and `collapsedGroups`. Clicks on the expander,
 * tree-toggle and group buttons are handled by one delegated listener on the element, found by `data-action` / `data-group-key`.
 */
export class ExpansionController<T> {
    private teardowns: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private get query() {
        return requireProvider(this.host, 'query');
    }

    private readonly listedRows = createListedRows<T>();
    private readonly idsOf = memoLast((rows: readonly T[], getId: (row: T) => string): string[] => rows.map(getId));

    /** The ids the header expander covers: every filtered row across pages (the visible tree rows in tree mode). */
    private listedIds(): string[] {
        const { config } = this.host;
        return this.idsOf(this.listedRows(this.query, config.enableSubRows), config.getRowId);
    }

    private get defaultDepth(): number {
        return this.host.config.subRowDefaultExpanded ? -1 : 0;
    }

    private allSubRowsExpanded(): boolean {
        const { config, model } = this.host;
        return allNodesExpanded(model.get('data'), config.getRowId, config.getChildren, model.get('subRowExpandedRows'), this.defaultDepth);
    }

    private flag(key: 'expandedRows' | 'subRowExpandedRows' | 'collapsedGroups', id: string, value: boolean | undefined): void {
        this.host.model.set(key, withFlag(this.host.model.get(key), id, value));
    }

    private readonly service: ExpansionService<T> = {
        isRowExpanded: (id) => isFlagged(this.host.model.get('expandedRows'), id),
        toggleRow: (row) => this.host.model.set('expandedRows', toggleFlag(this.host.model.get('expandedRows'), this.host.config.getRowId(row))),
        isAllExpanded: () => allFlagged(this.host.model.get('expandedRows'), this.listedIds()),
        toggleAll: () => {
            const expanded = this.host.model.get('expandedRows');
            const ids = this.listedIds();
            this.host.model.set('expandedRows', setFlags(expanded, ids, !allFlagged(expanded, ids)));
        },
        isSubRowExpanded: (row) => {
            const id = this.host.config.getRowId(row);
            return nodeExpanded(this.host.model.get('subRowExpandedRows'), id, depthOf(this.query.treeIndex().parent, id), this.defaultDepth);
        },
        toggleSubRow: (row) => this.flag('subRowExpandedRows', this.host.config.getRowId(row), !this.service.isSubRowExpanded(row)),
        expandSubRow: (row) => this.flag('subRowExpandedRows', this.host.config.getRowId(row), true),
        collapseSubRow: (row) => this.flag('subRowExpandedRows', this.host.config.getRowId(row), false),
        expandAllSubRows: (toDepth) => {
            const { config, model } = this.host;
            model.set('subRowExpandedRows', expandAllNodes(model.get('data'), config.getRowId, config.getChildren, toDepth));
        },
        collapseAllSubRows: () => {
            const { config, model } = this.host;
            model.set('subRowExpandedRows', collapseAllNodes(model.get('data'), config.getRowId, config.getChildren));
        },
        isGroupCollapsed: (key) => isFlagged(this.host.model.get('collapsedGroups'), key),
        toggleGroup: (key) => this.flag('collapsedGroups', key, !this.service.isGroupCollapsed(key)),
        expandAllGroups: () => {
            if (Object.keys(this.host.model.get('collapsedGroups')).length > 0) this.host.model.set('collapsedGroups', {});
        },
        collapseAllGroups: () => this.host.model.set('collapsedGroups', Object.fromEntries(this.query.groupRows().map((g) => [g.groupKey, true] as const))),
    };

    private readonly onClick = (event: MouseEvent): void => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const group = target.closest('[data-kind="group"][data-group-key]');
        if (group) {
            this.service.toggleGroup(group.getAttribute('data-group-key') ?? '');
            return;
        }
        const action = target.closest('[data-action]');
        if (!action) return;
        const kind = action.getAttribute('data-action');
        if (kind === 'detail-all') return this.service.toggleAll();
        if (kind === 'tree-all') return this.allSubRowsExpanded() ? this.service.collapseAllSubRows() : this.service.expandAllSubRows();
        const address = cellAddressOf(action);
        const row = address ? this.query.renderedRowAt(address.rowIndex) : undefined;
        if (row === undefined) return;
        if (kind === 'detail') this.service.toggleRow(row);
        else if (kind === 'tree') this.service.toggleSubRow(row);
    };

    private readonly onKey = (event: KeyboardEvent): boolean => {
        const { config } = this.host;
        if ((!config.enableSubRows && !config.enableRowExpansion) || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return false;
        const cell = event.target;
        if (!(cell instanceof Element) || !cell.matches('[data-slot="table-cell"]')) return false;
        const address = cellAddressOf(cell);
        if (!address) return false;
        if (address.columnKey === '_expander') {
            const row = event.key === ' ' || event.key === 'Enter' ? this.query.renderedRowAt(address.rowIndex) : undefined;
            if (row === undefined) return false;
            event.preventDefault();
            this.service.toggleRow(row);
            return true;
        }
        if (!config.enableSubRows || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return false;
        if (address.columnKey !== treeHostKey(requireProvider(this.host, 'columns').enhancedColumns())) return false;
        const node = this.query.renderedTreeRowAt(address.rowIndex);
        const action = node && treeKeyAction(event.key, getComputedStyle(this.host.root).direction === 'rtl', node);
        if (!node || !action) return false;
        event.preventDefault();
        if (action === 'expand') this.service.expandSubRow(node.row);
        else this.service.collapseSubRow(node.row);
        return true;
    };

    attach(): void {
        const { host } = this;
        const announce = () => host.topics.emit('expansion');
        this.teardowns = [
            host.provide('expansion', this.service),
            host.model.subscribe('expandedRows', announce),
            host.model.subscribe('subRowExpandedRows', announce),
            host.model.subscribe('collapsedGroups', announce),
            host.disposables.listen<MouseEvent>(host.root, 'click', ownEvents(host.root, this.onClick)),
            host.addKeyHandler(50, this.onKey),
        ];
    }

    detach(): void {
        for (const teardown of this.teardowns.splice(0).reverse()) teardown();
    }
}
