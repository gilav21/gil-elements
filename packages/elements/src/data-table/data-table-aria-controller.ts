import { type DataTableCoreHost, requireProvider } from './data-table-host.js';
import { interpolate } from './data-table.locales.js';

/** A selection that flips thousands of rows, or a key held down, is spoken once, when it settles (Angular's filter timer, 500 ms). */
const SELECTION_ANNOUNCE_MS = 500;

/**
 * What the live region says beyond sort and filter (the query controller announces those): the page after a page
 * change, and how many rows are selected. A discrete action (a page click) is spoken at once; a continuous one (a
 * select-all, checkbox after checkbox) is debounced, cancelled with the element, and reads the LIVE state when it
 * fires. Nothing is announced for focus moves, expansion (the state is on the focused element) or loading.
 */
export class AriaController<T> {
    private readonly stops: (() => void)[] = [];
    private cancelSelection: (() => void) | undefined;
    private pageIndex = 0;
    /** A sort or filter changed in this flush: it resets the page itself, and its own announcement must not be drowned by "Page 1". */
    private queryChanged = false;

    constructor(private readonly host: DataTableCoreHost<T>) {}

    /** Selected ids that still exist: a stale id (the row left the data) is kept by the model but is not a selected row. */
    private selectedCount(): number {
        const { config, model } = this.host;
        const selection = model.get('rowSelection');
        const ids = config.enableSubRows ? new Set(requireProvider(this.host, 'query').treeIndex().nodes.keys()) : new Set(model.get('data').map((row) => config.getRowId(row)));
        return Object.keys(selection).filter((id) => selection[id] === true && ids.has(id)).length;
    }

    private announceSelection(): void {
        const locale = this.host.resolvedLocale;
        const count = this.selectedCount();
        this.host.announce(count === 0 ? locale.selectionClearedAnnouncement : count === 1 ? locale.selectionAnnouncementOne : interpolate(locale.selectionAnnouncement, { count }));
    }

    attach(): void {
        const { model } = this.host;
        this.pageIndex = model.get('paginationState').pageIndex;
        this.stops.push(
            model.subscribe('paginationState', (page, origin) => {
                const changed = page.pageIndex !== this.pageIndex;
                this.pageIndex = page.pageIndex;
                // A consumer writing the property is not the user acting.
                if (!changed || origin !== 'internal' || this.queryChanged) return;
                const pages = Math.max(1, Math.ceil(requireProvider(this.host, 'query').totalItems() / Math.max(1, page.pageSize)));
                this.host.announce(interpolate(this.host.resolvedLocale.pageAnnouncement, { page: page.pageIndex + 1, pages }));
            }),
            ...(['sortState', 'multiSortState', 'globalFilter', 'columnFilters', 'advancedFilter'] as const).map((key) => model.subscribe(key, () => (this.queryChanged = true))),
            model.onFlush(() => (this.queryChanged = false)),
            model.subscribe('rowSelection', (_selection, origin) => {
                if (origin !== 'internal') return;
                this.cancelSelection?.();
                this.cancelSelection = this.host.disposables.timeout(() => this.announceSelection(), SELECTION_ANNOUNCE_MS);
            }),
        );
    }

    detach(): void {
        this.cancelSelection?.();
        for (const stop of this.stops.splice(0)) stop();
    }
}
