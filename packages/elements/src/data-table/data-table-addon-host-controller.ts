import { SlotRegistry } from '../shared/registry.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { AddonsService, CellActionSlot, DataTableProviders, HeaderActionSlot } from './data-table-providers.js';

/** What the table's addons contribute: a ⋮ button in every data row's action cell and in every column header. */
export interface DataTableSlots<T> {
    readonly cellActions: SlotRegistry<CellActionSlot<T>>;
    readonly headerActions: SlotRegistry<HeaderActionSlot<T>>;
}

export function createDataTableSlots<T>(): DataTableSlots<T> {
    return { cellActions: new SlotRegistry(), headerActions: new SlotRegistry() };
}

/** The `addons` service: the slot registries plus the busy labels by owner (the overlay shows the latest); `onChange` is the element's re-render. */
export function createAddonsService<T>(onChange: () => void): AddonsService<T> {
    const slots = createDataTableSlots<T>();
    const busy = new Map<string, string>(); // insertion order = recency
    slots.cellActions.subscribe(onChange);
    slots.headerActions.subscribe(onChange);
    const label = (): string | null => [...busy.values()].at(-1) ?? null;
    return {
        ...slots,
        busyLabel: label,
        setBusy(next, owner = '') {
            const before = label();
            busy.delete(owner);
            if (next !== null) busy.set(owner, next);
            if (label() !== before) onChange();
        },
        clearBusy() {
            if (busy.size === 0) return;
            busy.clear();
            onChange();
        },
    };
}

/**
 * Provides the `addons` service: the row and header action slots addons register and the busy-overlay label. A change to
 * either re-renders the table. The service is the controller's for its whole life (`services`), so an addon's teardown at a
 * disconnect can still unregister and clear its busy label after the providers are gone.
 */
export class AddonHostController<T> {
    private readonly service: AddonsService<T>;
    readonly services: Pick<DataTableProviders, 'addons'>;
    private unprovide: (() => void) | undefined;

    constructor(private readonly host: DataTableCoreHost<T>) {
        this.service = createAddonsService<T>(() => host.requestRender());
        this.services = { addons: this.service as unknown as AddonsService<unknown> }; // the slot callbacks are typed by row; the services map is not
    }

    attach(): void {
        this.unprovide = this.host.provide('addons', this.service);
    }

    detach(): void {
        this.service.clearBusy();
        this.unprovide?.();
        this.unprovide = undefined;
    }
}
