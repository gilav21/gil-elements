import type { DataTableCoreHost } from './data-table-host.js';
import type { LoadingService } from './data-table-providers.js';
import type { DataTableLoadingTrigger } from './data-table.types.js';
import type { ModelKey } from './data-table-model.js';

/** What each state change means to the busy overlay: the cause the consumer's `loading` spell is for. */
const TRIGGERS: readonly (readonly [ModelKey, DataTableLoadingTrigger])[] = [
    ['globalFilter', 'filtering'],
    ['columnFilters', 'filtering'],
    ['advancedFilter', 'filtering'],
    ['sortState', 'sorting'],
    ['multiSortState', 'sorting'],
    ['paginationState', 'pagination'],
];

/** Which user action the overlay stands for, so `loadingVisibility` can silence it per trigger. */
export class LoadingController<T> {
    private current: DataTableLoadingTrigger = 'initial';
    /** The first cause seen since the last flush: a sort that resets the page is a sort, not a page change. */
    private pending: DataTableLoadingTrigger | null = null;
    private teardown: (() => void)[] = [];

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: LoadingService = {
        trigger: () => this.current,
        setTrigger: (trigger) => {
            this.current = trigger;
            this.host.requestRender();
        },
        visible: () => {
            const { loading, loadingVisibility } = this.host.config;
            return loading && loadingVisibility?.[this.current] !== false;
        },
    };

    attach(): void {
        const { model } = this.host;
        this.teardown = [
            this.host.provide('loading', this.service),
            ...TRIGGERS.map(([key, trigger]) => model.subscribe(key, () => (this.pending ??= trigger))),
            model.onFlush(() => {
                if (this.pending) this.current = this.pending;
                this.pending = null;
            }),
        ];
    }

    detach(): void {
        for (const undo of this.teardown.reverse()) undo();
        this.teardown = [];
    }
}
